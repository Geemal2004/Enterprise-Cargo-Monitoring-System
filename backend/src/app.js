const express = require("express");
const cors = require("cors");
const { createApiRoutes } = require("./routes");

function createApp(config, store, runtimeState) {
  const app = express();

  app.use(cors({ origin: config.cors.origin }));
  app.use(express.json({ limit: "1mb" }));

  app.use("/api", createApiRoutes(store, runtimeState));

  app.use((req, res) => {
    res.status(404).json({
      message: "Route not found",
    });
  });

  app.use((err, req, res, next) => {
    console.error("[API] Unhandled error", err);
    res.status(500).json({
      message: "Internal server error",
      detail: config.nodeEnv === "production" ? undefined : err.message,
    });
  });

  return app;
}

module.exports = {
  createApp,
};
