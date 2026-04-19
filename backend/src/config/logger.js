const LEVEL_WEIGHT = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function createLogger(level = "info") {
  const configured = String(level || "info").toLowerCase();
  const minWeight = LEVEL_WEIGHT[configured] || LEVEL_WEIGHT.info;

  function shouldLog(targetLevel) {
    return (LEVEL_WEIGHT[targetLevel] || LEVEL_WEIGHT.info) >= minWeight;
  }

  function write(targetLevel, message, meta = {}) {
    if (!shouldLog(targetLevel)) {
      return;
    }

    const payload = {
      ts: new Date().toISOString(),
      level: targetLevel,
      message,
      ...meta,
    };

    const line = JSON.stringify(payload);
    if (targetLevel === "error") {
      console.error(line);
      return;
    }
    if (targetLevel === "warn") {
      console.warn(line);
      return;
    }
    console.log(line);
  }

  return {
    debug(message, meta) {
      write("debug", message, meta);
    },
    info(message, meta) {
      write("info", message, meta);
    },
    warn(message, meta) {
      write("warn", message, meta);
    },
    error(message, meta) {
      write("error", message, meta);
    },
  };
}

module.exports = {
  createLogger,
};
