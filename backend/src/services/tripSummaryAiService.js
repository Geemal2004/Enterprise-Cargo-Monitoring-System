function normalizeCargoType(value) {
  if (!value) {
    return "GENERAL_CARGO";
  }

  return String(value)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "GENERAL_CARGO";
}

function decodeApiKey(encoded) {
  if (!encoded) {
    return "";
  }

  try {
    return Buffer.from(String(encoded), "base64").toString("utf8").trim();
  } catch (_error) {
    return "";
  }
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toPercent(value, denominator) {
  if (!Number.isFinite(value) || !Number.isFinite(denominator) || denominator <= 0) {
    return null;
  }
  return Number(((value / denominator) * 100).toFixed(2));
}

function resolveCargoProfile(rawCargoType) {
  const code = normalizeCargoType(rawCargoType);

  const profiles = {
    GENERAL_CARGO: {
      code: "GENERAL_CARGO",
      label: "General cargo",
      prioritySignals: ["temperature", "humidity", "shock", "gas", "gps_fix"],
    },
    PERISHABLE_FOOD: {
      code: "PERISHABLE_FOOD",
      label: "Perishable food",
      prioritySignals: ["temperature", "humidity", "gps_fix", "trip_duration"],
    },
    PHARMACEUTICALS: {
      code: "PHARMACEUTICALS",
      label: "Pharmaceuticals",
      prioritySignals: ["temperature", "humidity", "gps_fix", "shock"],
    },
    GAS_CYLINDERS: {
      code: "GAS_CYLINDERS",
      label: "Gas cylinders",
      prioritySignals: ["gas", "shock", "temperature", "gps_fix"],
    },
    CHEMICALS: {
      code: "CHEMICALS",
      label: "Chemicals",
      prioritySignals: ["gas", "temperature", "humidity", "shock"],
    },
    ELECTRONICS: {
      code: "ELECTRONICS",
      label: "Electronics",
      prioritySignals: ["humidity", "shock", "temperature", "gps_fix"],
    },
    FRAGILE_GOODS: {
      code: "FRAGILE_GOODS",
      label: "Fragile goods",
      prioritySignals: ["shock", "tilt", "temperature", "gps_fix"],
    },
    LIQUID_CARGO: {
      code: "LIQUID_CARGO",
      label: "Liquid cargo",
      prioritySignals: ["tilt", "shock", "temperature", "gps_fix"],
    },
    LIVESTOCK: {
      code: "LIVESTOCK",
      label: "Livestock",
      prioritySignals: ["temperature", "humidity", "gps_fix", "trip_duration"],
    },
  };

  return profiles[code] || {
    code,
    label: code
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
    prioritySignals: ["temperature", "humidity", "gas", "shock", "gps_fix"],
  };
}

function buildMetricsSnapshot(metrics, alertSummary) {
  const sampleCount = Number(metrics?.sample_count || 0);
  const gpsFixRatePct = toPercent(Number(metrics?.gps_fix_true_count || 0), sampleCount);

  return {
    sampleCount,
    occurredAtStart: metrics?.first_point_at || null,
    occurredAtEnd: metrics?.last_point_at || null,
    environment: {
      temperature: {
        min: toNumber(metrics?.temperature_min),
        avg: toNumber(metrics?.temperature_avg),
        max: toNumber(metrics?.temperature_max),
      },
      humidity: {
        min: toNumber(metrics?.humidity_min),
        avg: toNumber(metrics?.humidity_avg),
        max: toNumber(metrics?.humidity_max),
      },
      pressure: {
        min: toNumber(metrics?.pressure_min),
        avg: toNumber(metrics?.pressure_avg),
        max: toNumber(metrics?.pressure_max),
      },
    },
    gas: {
      maxRaw: toNumber(metrics?.gas_max),
      avgRaw: toNumber(metrics?.gas_avg),
      gasAlertCount: Number(metrics?.gas_alert_count || 0),
    },
    motion: {
      shockCount: Number(metrics?.shock_count || 0),
      tiltMax: toNumber(metrics?.tilt_max),
    },
    gps: {
      fixRatePct: gpsFixRatePct,
    },
    alerts: {
      count: Number(alertSummary?.count || 0),
      bySeverity: alertSummary?.bySeverity || {},
    },
  };
}

function buildRuleBasedSummary({ cargoProfile, metricsSnapshot }) {
  const findings = [];
  const recommendations = [];

  if ((metricsSnapshot.environment.temperature.max || 0) >= 35) {
    findings.push("High temperature peaks detected during the trip.");
    recommendations.push("Review thermal insulation and cooling strategy for this route.");
  }

  if ((metricsSnapshot.gas.maxRaw || 0) >= 1500 || (metricsSnapshot.gas.gasAlertCount || 0) > 0) {
    findings.push("Gas readings entered alert range at least once.");
    recommendations.push("Inspect container sealing and verify gas sensor calibration.");
  }

  if ((metricsSnapshot.motion.shockCount || 0) > 0) {
    findings.push("Shock events were recorded during transit.");
    recommendations.push("Check suspension conditions and handling quality on critical segments.");
  }

  if ((metricsSnapshot.gps.fixRatePct || 0) < 90) {
    findings.push("GPS fix rate was below expected reliability.");
    recommendations.push("Verify GPS antenna placement and reduce signal obstructions.");
  }

  if (findings.length === 0) {
    findings.push("No major anomalies detected in monitored telemetry signals.");
    recommendations.push("Maintain current handling process and continue periodic calibration.");
  }

  return {
    provider: "rule_based",
    model: "fallback-local",
    condition: findings.length > 2 ? "ATTENTION_NEEDED" : "STABLE",
    summary:
      `Trip completed for ${cargoProfile.label}. ` +
      `Priority signals considered: ${cargoProfile.prioritySignals.join(", ")}. ` +
      `Samples analyzed: ${metricsSnapshot.sampleCount}.`,
    criticalFindings: findings,
    recommendations,
  };
}

function parseGeminiPayload(text) {
  if (!text) {
    return null;
  }

  const normalized = String(text)
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/, "")
    .trim();

  try {
    return JSON.parse(normalized);
  } catch (_error) {
    return null;
  }
}

function createTripSummaryAiService(deps) {
  const { config, logger } = deps;

  async function generateTripSummary(input) {
    const cargoProfile = resolveCargoProfile(input?.cargoType);
    const metricsSnapshot = buildMetricsSnapshot(input?.metrics, input?.alertSummary);

    const fallback = {
      ...buildRuleBasedSummary({ cargoProfile, metricsSnapshot }),
      cargoProfile,
      metrics: metricsSnapshot,
      generatedAt: new Date().toISOString(),
    };

    if (!config.ai.tripSummaryEnabled) {
      return fallback;
    }

    const apiKey = decodeApiKey(config.ai.geminiApiKeyBase64);
    if (!apiKey) {
      logger.warn("Gemini key missing/invalid; using rule-based trip summary fallback");
      return fallback;
    }

    const prompt = {
      task: "Generate a concise post-trip cargo condition summary.",
      instructions: [
        "Assess condition using cargo-specific priorities first, then all remaining telemetry.",
        "Return strict JSON only with keys: condition, summary, criticalFindings, recommendations.",
        "condition must be one of: STABLE, WATCH, ATTENTION_NEEDED, CRITICAL.",
        "criticalFindings and recommendations must each be arrays of short strings.",
      ],
      cargoProfile,
      cargoDescription: input?.goodsDescription || null,
      metrics: metricsSnapshot,
    };

    const url =
      `${config.ai.geminiApiBaseUrl}/models/${config.ai.geminiModel}:generateContent` +
      `?key=${encodeURIComponent(apiKey)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.ai.tripSummaryTimeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: JSON.stringify(prompt) }],
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const bodyText = await response.text();
        throw new Error(`Gemini request failed (${response.status}): ${bodyText}`);
      }

      const data = await response.json();
      const modelText = (data?.candidates || [])
        .flatMap((candidate) => candidate?.content?.parts || [])
        .map((part) => part?.text || "")
        .join("\n")
        .trim();

      const parsed = parseGeminiPayload(modelText);
      if (!parsed) {
        logger.warn("Gemini output was not valid JSON; using fallback summary shape");
        return {
          ...fallback,
          provider: "gemini",
          model: config.ai.geminiModel,
          summary: modelText || fallback.summary,
        };
      }

      return {
        provider: "gemini",
        model: config.ai.geminiModel,
        generatedAt: new Date().toISOString(),
        cargoProfile,
        metrics: metricsSnapshot,
        condition: parsed.condition || fallback.condition,
        summary: parsed.summary || fallback.summary,
        criticalFindings: Array.isArray(parsed.criticalFindings)
          ? parsed.criticalFindings
          : fallback.criticalFindings,
        recommendations: Array.isArray(parsed.recommendations)
          ? parsed.recommendations
          : fallback.recommendations,
      };
    } catch (error) {
      logger.warn("Gemini trip summary generation failed; using fallback", {
        error: error.message,
      });
      return fallback;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    generateTripSummary,
    resolveCargoProfile,
  };
}

module.exports = {
  createTripSummaryAiService,
};
