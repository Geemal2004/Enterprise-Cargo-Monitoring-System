const express = require("express");
const otaService = require("../services/otaService");
const { createRequireRolesMiddleware } = require("../middleware/authMiddleware");
const { asyncHandler } = require("../utils/asyncHandler");
const { AppError } = require("../utils/appError");

const GATEWAY_WIFI_TOPIC_BASE =
  process.env.GATEWAY_TOPIC_BASE || "tenant/demo/truck/TRUCK01/gateway/wifi";

function normalizeTopicPart(value) {
  return String(value || "").trim();
}

function resolveGatewayWifiTopicBase(req) {
  const tenantCode = normalizeTopicPart(
    req.body?.tenantCode || req.query?.tenantCode || req.context?.tenantCode
  );
  const truckId = normalizeTopicPart(req.body?.truckId || req.query?.truckId);

  if (tenantCode && truckId) {
    return `tenant/${tenantCode}/truck/${truckId}/gateway/wifi`;
  }

  return GATEWAY_WIFI_TOPIC_BASE;
}

function createWifiRoutes() {
  const router = express.Router();
  const requireWifiManage = createRequireRolesMiddleware(["admin", "tenant_admin"]);

  router.use(requireWifiManage);

  router.post(
    "/scan",
    asyncHandler(async (req, res) => {
      const topicBase = resolveGatewayWifiTopicBase(req);
      const commandTopic = `${topicBase}/scan/request`;
      await otaService.publishMqttMessage(
        commandTopic,
        { command: "scan", timestamp: Date.now() },
        {
          qos: 1,
          retain: false,
          timeoutMs: 15000,
        }
      );

      res.status(200).json({
        ok: true,
        message: "Scan requested",
        topicBase,
        commandTopic,
        mqtt: otaService.getMqttConnectionState(),
      });
    })
  );

  router.post(
    "/connect",
    asyncHandler(async (req, res) => {
      const ssid = String(req.body?.ssid || "").trim();
      const password = String(req.body?.password || "");
      const channel = Number(req.body?.channel || 0);
      const bssid = String(req.body?.bssid || "").trim();
      const topicBase = resolveGatewayWifiTopicBase(req);

      if (!ssid || !password) {
        throw new AppError("ssid and password are required", 400);
      }

      const commandTopic = `${topicBase}/connect`;
      await otaService.publishMqttMessage(
        commandTopic,
        {
          ssid,
          password,
          ...(channel > 0 ? { channel } : {}),
          ...(bssid ? { bssid } : {}),
        },
        { qos: 1, retain: false, timeoutMs: 5000 }
      );

      res.status(200).json({
        ok: true,
        topicBase,
        commandTopic,
        mqtt: otaService.getMqttConnectionState(),
      });
    })
  );

  router.get(
    "/status",
    asyncHandler(async (req, res) => {
      const tenantCode = normalizeTopicPart(req.query?.tenantCode || req.context?.tenantCode);
      const truckId = normalizeTopicPart(req.query?.truckId);
      res.status(200).json({
        ok: true,
        topicBase: resolveGatewayWifiTopicBase(req),
        mqtt: otaService.getMqttConnectionState(),
        status: otaService.getWifiStatus({ tenantCode, truckId }),
        networks: otaService.getWifiNetworks({ tenantCode, truckId }),
      });
    })
  );

  return router;
}

module.exports = {
  createWifiRoutes,
  GATEWAY_WIFI_TOPIC_BASE,
};
