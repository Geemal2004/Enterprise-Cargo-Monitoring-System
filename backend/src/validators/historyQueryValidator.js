const { AppError } = require("../utils/appError");
const { parseDateInput } = require("../utils/time");

const INTERVAL_SHORTCUTS = {
  "1m": "1 minute",
  "5m": "5 minutes",
  "10m": "10 minutes",
  "15m": "15 minutes",
  "30m": "30 minutes",
  "1h": "1 hour",
  "3h": "3 hours",
  "6h": "6 hours",
  "12h": "12 hours",
  "1d": "1 day",
};

const INTERVAL_PATTERN = /^\d+\s*(second|minute|hour|day)s?$/i;

function normalizeInterval(raw) {
  if (!raw) {
    return null;
  }

  const lower = String(raw).trim().toLowerCase();
  if (INTERVAL_SHORTCUTS[lower]) {
    return INTERVAL_SHORTCUTS[lower];
  }

  if (INTERVAL_PATTERN.test(lower)) {
    return lower;
  }

  throw new AppError(
    "Invalid interval. Use values like 5m, 15m, 1h, or '5 minutes'.",
    400
  );
}

function normalizeBucketMinutes(raw) {
  if (raw === undefined || raw === null || raw === "") {
    return null;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AppError("bucketMinutes must be a positive number", 400);
  }

  const rounded = Math.floor(parsed);
  if (rounded > 24 * 60) {
    throw new AppError("bucketMinutes cannot exceed 1440 (24 hours)", 400);
  }

  return rounded;
}

function parseHistoryQuery(query, config) {
  const from = parseDateInput(query.from);
  const to = parseDateInput(query.to);

  if (query.from && !from) {
    throw new AppError("Invalid 'from' timestamp", 400);
  }
  if (query.to && !to) {
    throw new AppError("Invalid 'to' timestamp", 400);
  }
  if (from && to && from > to) {
    throw new AppError("'from' must be earlier than or equal to 'to'", 400);
  }

  const requestedLimit = Number(query.limit || config.query.historyDefaultLimit);
  if (!Number.isFinite(requestedLimit) || requestedLimit <= 0) {
    throw new AppError("limit must be a positive number", 400);
  }

  const limit = Math.min(Math.floor(requestedLimit), config.query.historyMaxLimit);
  const bucketMinutes = normalizeBucketMinutes(query.bucketMinutes);
  const interval = normalizeInterval(query.interval) ||
    (bucketMinutes ? `${bucketMinutes} minutes` : null);

  return {
    from: from ? from.toISOString() : null,
    to: to ? to.toISOString() : null,
    limit,
    bucketMinutes,
    interval,
  };
}

module.exports = {
  parseHistoryQuery,
};
