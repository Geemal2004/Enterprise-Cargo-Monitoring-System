const { randomUUID } = require("crypto");

function createRequestContextMiddleware(logger) {
  return (req, res, next) => {
    const startedAt = Date.now();

    req.context = {
      requestId: req.header("x-request-id") || randomUUID(),
      actorUserId: null,
      tenantCode: null,
    };

    res.setHeader("x-request-id", req.context.requestId);

    res.on("finish", () => {
      logger.info("HTTP request completed", {
        requestId: req.context.requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
      });
    });

    next();
  };
}

module.exports = {
  createRequestContextMiddleware,
};
