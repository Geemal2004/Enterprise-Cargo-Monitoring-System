const express = require("express");
const cors = require("cors");
const { createApiRoutes } = require("./routes");
const { createOtaFirmwareHandler } = require("./routes/ota");
const { createRequestContextMiddleware } = require("./middleware/requestContext");
const {
  createErrorHandler,
  createNotFoundMiddleware,
} = require("./middleware/errorHandler");

function createApp(config, logger, services, runtimeState) {
  const app = express();

  app.use(cors({ origin: config.cors.origin }));
  app.use(createRequestContextMiddleware(logger));
  app.use(express.json({ limit: "1mb" }));

  app.get(`${config.server.apiPrefix}/ota/firmware/:target`, createOtaFirmwareHandler());
  app.use(config.server.apiPrefix, createApiRoutes(services, config, runtimeState));

  app.use(createNotFoundMiddleware());
  app.use(createErrorHandler(config, logger));

  return app;
}

module.exports = {
  createApp,
};
