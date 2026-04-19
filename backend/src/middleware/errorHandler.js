const { AppError } = require("../utils/appError");

function createNotFoundMiddleware() {
  return (req, res) => {
    res.status(404).json({
      message: "Route not found",
      path: req.originalUrl,
    });
  };
}

function createErrorHandler(config, logger) {
  return (error, req, res, _next) => {
    const appError =
      error instanceof AppError
        ? error
        : new AppError("Internal server error", 500);

    logger.error("Unhandled API error", {
      requestId: req.context && req.context.requestId,
      path: req.originalUrl,
      method: req.method,
      statusCode: appError.statusCode,
      message: error.message,
      stack: config.nodeEnv === "production" ? undefined : error.stack,
    });

    res.status(appError.statusCode).json({
      message: appError.message,
      requestId: req.context && req.context.requestId,
      details:
        config.nodeEnv === "production" ? undefined : appError.details || error.message,
    });
  };
}

module.exports = {
  createNotFoundMiddleware,
  createErrorHandler,
};
