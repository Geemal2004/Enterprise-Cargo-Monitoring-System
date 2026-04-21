const { AppError } = require("../utils/appError");
const { withTransaction } = require("../db/transaction");

function normalizeTripStatus(raw) {
  if (!raw) {
    return null;
  }

  const value = String(raw).toUpperCase();
  if (!["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(value)) {
    throw new AppError("status must be PLANNED, IN_PROGRESS, COMPLETED, or CANCELLED", 400);
  }

  return value;
}

function buildTripCode() {
  const now = new Date();
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..*$/, "")
    .replace("T", "");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TRIP-${stamp}-${suffix}`;
}

function toLatLon(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new AppError("Invalid coordinate value", 400);
  }

  return parsed;
}

function normalizeCargoType(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function createTripsService(deps) {
  const {
    pool,
    tripsRepository,
    assetRepository,
    auditRepository,
    alertsRepository,
    tripSummaryAiService,
  } = deps;

  async function listTrips(query, context) {
    const tenantCode = context?.tenantCode || null;
    const status = normalizeTripStatus(query.status);

    return tripsRepository.listTrips(pool, {
      tenantCode,
      status,
      truckCode: query.truckCode || null,
      containerCode: query.containerCode || null,
      managerUserId: context?.managerUserId || null,
      limit: Math.min(Number(query.limit) || 500, 2000),
    });
  }

  async function createTrip(input, context) {
    if (!input || typeof input !== "object") {
      throw new AppError("Request body must be a JSON object", 400);
    }

    const tenantCode = (context?.tenantCode || input.tenantCode || "").toString().trim();
     if (!tenantCode && !context?.isSuperAdmin) {
      throw new AppError("tenantCode is required", 400);
    }

    const truckCode = String(input.truckCode || "").trim();
    const containerCode = String(input.containerCode || "").trim();
    const originName = String(input.originName || "").trim();
    const destinationName = String(input.destinationName || "").trim();
    const cargoTypeInput = String(input.cargoType || "").trim();
    const goodsDescription = String(input.goodsDescription || "").trim();

    if (!truckCode || !containerCode) {
      throw new AppError("truckCode and containerCode are required", 400);
    }

    if (!originName || !destinationName) {
      throw new AppError("originName and destinationName are required", 400);
    }

    if (!cargoTypeInput) {
      throw new AppError("cargoType is required", 400);
    }

    const cargoProfile = tripSummaryAiService?.resolveCargoProfile
      ? tripSummaryAiService.resolveCargoProfile(cargoTypeInput)
      : {
          code: normalizeCargoType(cargoTypeInput) || "GENERAL_CARGO",
          label: cargoTypeInput,
          prioritySignals: ["temperature", "humidity", "gas", "shock", "gps_fix"],
        };

    const originLat = toLatLon(input.originLat);
    const originLon = toLatLon(input.originLon);
    const destinationLat = toLatLon(input.destinationLat);
    const destinationLon = toLatLon(input.destinationLon);

    const plannedStartAt = input.plannedStartAt ? new Date(input.plannedStartAt).toISOString() : null;
    const plannedEndAt = input.plannedEndAt ? new Date(input.plannedEndAt).toISOString() : null;

    const tripCode = input.tripCode ? String(input.tripCode).trim() : buildTripCode();

    return withTransaction(pool, async (client) => {
      const contextRow = await assetRepository.resolveAssetContextByCodes(client, {
        tenantCode,
        truckCode,
        containerCode,
      });

      if (!contextRow) {
        throw new AppError("Truck/container mapping not found", 404);
      }

      if (context?.managerUserId) {
        const assignment = await tripsRepository.getActiveManagerAssignment(client, {
          tenantId: contextRow.tenant_id,
          containerId: contextRow.container_id,
          managerUserId: context.managerUserId,
        });
        if (!assignment) {
          throw new AppError("Container is not assigned to this fleet manager", 403);
        }
      }

      const activeTrip = await tripsRepository.getActiveTripByAsset(client, {
        tenantId: contextRow.tenant_id,
        truckId: contextRow.truck_id,
        containerId: contextRow.container_id,
      });
      if (activeTrip) {
        throw new AppError("An active trip already exists for this truck/container", 409);
      }

      let created;
      try {
        created = await tripsRepository.createTrip(client, {
          tenantId: contextRow.tenant_id,
          tripCode,
          fleetId: contextRow.fleet_id,
          truckId: contextRow.truck_id,
          containerId: contextRow.container_id,
          routeId: null,
          originName,
          destinationName,
          plannedStartAt,
          plannedEndAt,
          status: "PLANNED",
          metadata: {
            origin: {
              name: originName,
              lat: originLat,
              lon: originLon,
            },
            destination: {
              name: destinationName,
              lat: destinationLat,
              lon: destinationLon,
            },
            cargo: {
              cargoType: cargoProfile.code,
              cargoLabel: cargoProfile.label,
              goodsDescription: goodsDescription || null,
              prioritySignals: cargoProfile.prioritySignals,
            },
          },
        });
      } catch (error) {
        if (error && error.code === "23505") {
          throw new AppError("Trip code already exists", 409);
        }
        throw error;
      }

      if (auditRepository) {
        await auditRepository.insertAuditLog(client, {
          tenantId: contextRow.tenant_id,
          actorUserId: context?.actorUserId || null,
          action: "TRIP_CREATE",
          targetType: "trip",
          targetId: created.id,
          metadata: {
            tripCode,
            truckCode,
            containerCode,
            originName,
            destinationName,
            cargoType: cargoProfile.code,
            goodsDescription: goodsDescription || null,
          },
          ipAddress: context?.ipAddress || null,
          userAgent: context?.userAgent || null,
        });
      }

      return created;
    });
  }

  async function startTrip(tripId, context) {
    if (!tripId) {
      throw new AppError("tripId is required", 400);
    }

    const tenantCode = (context?.tenantCode || context?.tenantCodeOverride || "")
      .toString()
      .trim();
     if (!tenantCode && !context?.isSuperAdmin) {
      throw new AppError("tenantCode is required", 400);
    }

    return withTransaction(pool, async (client) => {
      const existing = await tripsRepository.getTripById(client, {
        tripId,
        tenantCode,
        managerUserId: context?.managerUserId || null,
      });

      if (!existing) {
        throw new AppError("Trip not found", 404);
      }

      if (existing.status !== "PLANNED") {
        throw new AppError("Trip cannot be started from current status", 409);
      }

      const updated = await tripsRepository.startTrip(client, {
        tripId,
        tenantId: existing.tenant_id,
      });

      if (!updated) {
        throw new AppError("Trip not found", 404);
      }

      if (auditRepository) {
        await auditRepository.insertAuditLog(client, {
          tenantId: existing.tenant_id,
          actorUserId: context?.actorUserId || null,
          action: "TRIP_START",
          targetType: "trip",
          targetId: existing.id,
          metadata: {
            tripCode: existing.trip_code,
          },
          ipAddress: context?.ipAddress || null,
          userAgent: context?.userAgent || null,
        });
      }

      return updated;
    });
  }

  async function completeTrip(tripId, context) {
    if (!tripId) {
      throw new AppError("tripId is required", 400);
    }

    const tenantCode = (context?.tenantCode || context?.tenantCodeOverride || "")
      .toString()
      .trim();
     if (!tenantCode && !context?.isSuperAdmin) {
      throw new AppError("tenantCode is required", 400);
    }

    return withTransaction(pool, async (client) => {
      const existing = await tripsRepository.getTripById(client, {
        tripId,
        tenantCode,
        managerUserId: context?.managerUserId || null,
      });

      if (!existing) {
        throw new AppError("Trip not found", 404);
      }

      if (existing.status !== "IN_PROGRESS") {
        throw new AppError("Trip cannot be completed from current status", 409);
      }

      const updated = await tripsRepository.completeTrip(client, {
        tripId,
        tenantId: existing.tenant_id,
      });

      if (!updated) {
        throw new AppError("Trip not found", 404);
      }

      const metadata =
        existing.metadata_json && typeof existing.metadata_json === "object"
          ? existing.metadata_json
          : {};
      const cargo = metadata.cargo || {
        cargoType: "GENERAL_CARGO",
        cargoLabel: "General cargo",
        goodsDescription: null,
        prioritySignals: ["temperature", "humidity", "gas", "shock", "gps_fix"],
      };

      const metrics = await tripsRepository.getTripTelemetryAggregate(client, {
        tenantId: existing.tenant_id,
        tripId: existing.id,
      });

      const alertSummary = alertsRepository
        ? await alertsRepository.getAlertSummaryByTrip(client, {
            tenantId: existing.tenant_id,
            tripId: existing.id,
          })
        : { count: 0, bySeverity: {} };

      let finalTrip = updated;
      if (tripSummaryAiService?.generateTripSummary) {
        const aiSummary = await tripSummaryAiService.generateTripSummary({
          cargoType: cargo.cargoType,
          goodsDescription: cargo.goodsDescription || null,
          metrics,
          alertSummary,
        });

        const patched = await tripsRepository.updateTripMetadata(client, {
          tripId: existing.id,
          tenantId: existing.tenant_id,
          patch: {
            aiSummary,
            cargo,
          },
        });

        if (patched) {
          finalTrip = patched;
        }
      }

      if (auditRepository) {
        await auditRepository.insertAuditLog(client, {
          tenantId: existing.tenant_id,
          actorUserId: context?.actorUserId || null,
          action: "TRIP_COMPLETE",
          targetType: "trip",
          targetId: existing.id,
          metadata: {
            tripCode: existing.trip_code,
            cargoType: cargo.cargoType,
          },
          ipAddress: context?.ipAddress || null,
          userAgent: context?.userAgent || null,
        });
      }

      return finalTrip;
    });
  }

  return {
    listTrips,
    createTrip,
    startTrip,
    completeTrip,
  };
}

module.exports = {
  createTripsService,
};
