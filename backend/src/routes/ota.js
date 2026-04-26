const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const otaService = require("../services/otaService");
const { createRequireRolesMiddleware } = require("../middleware/authMiddleware");
const { asyncHandler } = require("../utils/asyncHandler");
const { AppError } = require("../utils/appError");

const TARGETS = ["gateway", "container"];
const FIRMWARE_DIR = path.join(__dirname, "..", "firmware-store");

if (!fs.existsSync(FIRMWARE_DIR)) {
  fs.mkdirSync(FIRMWARE_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, FIRMWARE_DIR),
  filename: (req, _file, cb) => {
    cb(null, `firmware-${req.params.target}.bin`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (String(file.originalname || "").toLowerCase().endsWith(".bin")) {
      cb(null, true);
      return;
    }

    cb(new Error("Only .bin firmware files are accepted"));
  },
});

function normalizeTarget(target) {
  return String(target || "").trim().toLowerCase();
}

function validateTarget(req, res, next) {
  const target = normalizeTarget(req.params.target);
  if (!TARGETS.includes(target)) {
    res.status(400).json({ error: `Target must be one of: ${TARGETS.join(", ")}` });
    return;
  }

  req.params.target = target;
  next();
}

function getFirmwarePath(target) {
  return path.join(FIRMWARE_DIR, `firmware-${normalizeTarget(target)}.bin`);
}

function describeFirmwareFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  const text = buffer.toString("latin1");
  const buildMatch =
    /FW_BUILD:([A-Za-z0-9_.:+-]{6,96})/.exec(text) ||
    /\b((?:gateway|container)-[A-Za-z0-9_.:+-]{6,96})/.exec(text);

  return {
    sizeBytes: buffer.length,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
    firmwareBuild: buildMatch ? buildMatch[1] : null,
  };
}

function getRequestedUnit(req) {
  const truckId = String(req.body?.truckId || req.query?.truckId || "").trim();
  const containerId = String(req.body?.containerId || req.query?.containerId || "").trim();

  if (!truckId || !containerId) {
    throw new AppError("truckId and containerId are required", 400);
  }

  return {
    tenantCode: req.context?.tenantCode || null,
    truckId,
    containerId,
  };
}

async function listAvailableUnits(services, tenantCode) {
  const [registryItems, liveItems] = await Promise.all([
    services.adminService
      ? services.adminService.listDeviceRegistry({
          tenantCode,
          limit: 2000,
        })
      : Promise.resolve([]),
    services.fleetService ? services.fleetService.getFleetUnits(tenantCode, null) : Promise.resolve([]),
  ]);

  const unitsByKey = new Map();

  for (const item of registryItems || []) {
    const truckId = String(item.truck_code || "").trim();
    const containerId = String(item.container_code || "").trim();
    if (!truckId || !containerId) {
      continue;
    }

    const key = `${truckId}::${containerId}`;
    unitsByKey.set(key, {
      key,
      tenantCode: item.tenant_code || tenantCode || null,
      truckId,
      containerId,
      fleetId: item.fleet_code || null,
      label: `${truckId} / ${containerId}`,
      isOnline: false,
      receivedAt: null,
      source: "registry",
    });
  }

  for (const item of liveItems || []) {
    const truckId = String(item.truckId || "").trim();
    const containerId = String(item.containerId || "").trim();
    if (!truckId || !containerId) {
      continue;
    }

    const key = `${truckId}::${containerId}`;
    const existing = unitsByKey.get(key) || {
      key,
      tenantCode: tenantCode || item.tenantId || null,
      truckId,
      containerId,
      fleetId: item.fleetId || null,
      label: `${truckId} / ${containerId}`,
      source: "live",
    };

    unitsByKey.set(key, {
      ...existing,
      tenantCode: existing.tenantCode || item.tenantId || tenantCode || null,
      fleetId: existing.fleetId || item.fleetId || null,
      isOnline: Boolean(item.isOnline),
      receivedAt: item.receivedAt || existing.receivedAt || null,
      source: existing.source === "registry" ? "both" : "live",
    });
  }

  return Array.from(unitsByKey.values()).sort((left, right) => {
    const leftTs = left.receivedAt ? Date.parse(left.receivedAt) : 0;
    const rightTs = right.receivedAt ? Date.parse(right.receivedAt) : 0;
    if (leftTs !== rightTs) {
      return rightTs - leftTs;
    }

    return left.label.localeCompare(right.label);
  });
}

async function ensureUnitExists(services, tenantCode, truckId, containerId) {
  const units = await listAvailableUnits(services, tenantCode);
  const key = `${truckId}::${containerId}`;
  const match = units.find((item) => item.key === key);

  if (!match) {
    throw new AppError("Selected truck/container pair was not found in the OTA registry", 404);
  }

  return match;
}

function resolveOtaHost() {
  if (process.env.OTA_HOST) {
    return process.env.OTA_HOST.trim().replace(/\/$/, "");
  }

  return "http://localhost:3000";
}

function createOtaFirmwareHandler() {
  return function serveFirmware(req, res) {
    const target = normalizeTarget(req.params.target);
    if (!TARGETS.includes(target)) {
      res.status(400).json({ error: `Target must be one of: ${TARGETS.join(", ")}` });
      return;
    }

    const firmwarePath = getFirmwarePath(target);
    if (!fs.existsSync(firmwarePath)) {
      res.status(404).json({ error: "Firmware not found. Upload first." });
      return;
    }

    const stat = fs.statSync(firmwarePath);
    const descriptor = describeFirmwareFile(firmwarePath);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Content-Disposition", `attachment; filename="firmware-${target}.bin"`);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Firmware-Sha256", descriptor.sha256);
    if (descriptor.firmwareBuild) {
      res.setHeader("X-Firmware-Build", descriptor.firmwareBuild);
    }
    fs.createReadStream(firmwarePath).pipe(res);
  };
}

function createOtaRoutes(services) {
  const router = express.Router();
  const requireOtaManage = createRequireRolesMiddleware(["admin", "tenant_admin"]);

  router.use(requireOtaManage);

  router.get(
    "/units",
    asyncHandler(async (req, res) => {
      const tenantCode = req.context?.tenantCode || null;
      const items = await listAvailableUnits(services, tenantCode);
      res.status(200).json({
        count: items.length,
        items,
      });
    })
  );

  router.post("/upload/:target", validateTarget, upload.single("firmware"), (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const target = req.params.target;
    const descriptor = describeFirmwareFile(req.file.path);
    if (!descriptor.firmwareBuild) {
      fs.unlinkSync(req.file.path);
      throw new AppError(
        "Uploaded firmware does not contain an FW_BUILD marker. Export a fresh application .bin from the current sketch and upload that file.",
        400
      );
    }

    const staged = {
      filename: req.file.originalname,
      sizeBytes: req.file.size,
      sizeKb: Number((req.file.size / 1024).toFixed(1)),
      sha256: descriptor.sha256,
      firmwareBuild: descriptor.firmwareBuild,
      uploadedAt: new Date().toISOString(),
      path: req.file.path,
    };

    otaService.setStagedFirmware(target, staged);
    res.status(200).json({
      ok: true,
      target,
      ...staged,
    });
  });

  router.get(
    "/status",
    asyncHandler(async (req, res) => {
      const requested = getRequestedUnit(req);
      await ensureUnitExists(services, requested.tenantCode, requested.truckId, requested.containerId);

      res.status(200).json({
        truckId: requested.truckId,
        containerId: requested.containerId,
        staged: otaService.getAllStagedFirmware(),
        statuses: otaService.getUnitStatuses(requested),
      });
    })
  );

  router.get(
    "/status/:target",
    validateTarget,
    asyncHandler(async (req, res) => {
      const requested = getRequestedUnit(req);
      await ensureUnitExists(services, requested.tenantCode, requested.truckId, requested.containerId);

      res.status(200).json({
        target: req.params.target,
        staged: otaService.getStagedFirmware(req.params.target),
        otaStatus: otaService.getOtaStatus(req.params.target, requested),
      });
    })
  );

  router.post(
    "/trigger/:target",
    validateTarget,
    asyncHandler(async (req, res) => {
      const target = req.params.target;
      const staged = otaService.getStagedFirmware(target);

      if (!staged) {
        throw new AppError(`No firmware staged for ${target}. Upload first.`, 400);
      }

      const requested = getRequestedUnit(req);
      const unit = await ensureUnitExists(
        services,
        requested.tenantCode,
        requested.truckId,
        requested.containerId
      );

      const otaHost = resolveOtaHost();
      const firmwareUrl = `${otaHost}/api/ota/firmware/${target}`;

      await otaService.triggerOta({
        tenantCode: unit.tenantCode || requested.tenantCode,
        truckId: unit.truckId,
        containerId: unit.containerId,
        target,
        firmwareUrl,
        staged,
      });

      res.status(200).json({
        ok: true,
        target,
        truckId: unit.truckId,
        containerId: unit.containerId,
        firmwareUrl,
      });
    })
  );

  router.post(
    "/cancel/:target",
    validateTarget,
    asyncHandler(async (req, res) => {
      const target = req.params.target;
      const requested = getRequestedUnit(req);
      const unit = await ensureUnitExists(
        services,
        requested.tenantCode,
        requested.truckId,
        requested.containerId
      );

      const status = await otaService.cancelOta({
        tenantCode: unit.tenantCode || requested.tenantCode,
        truckId: unit.truckId,
        containerId: unit.containerId,
        target,
      });

      res.status(200).json({
        ok: true,
        target,
        truckId: unit.truckId,
        containerId: unit.containerId,
        status,
      });
    })
  );

  return router;
}

module.exports = {
  createOtaRoutes,
  createOtaFirmwareHandler,
};
