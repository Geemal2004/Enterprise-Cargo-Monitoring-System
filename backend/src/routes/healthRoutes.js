const express = require("express");

function createHealthRoutes(runtimeState) {
  const router = express.Router();

  router.get("/", (req, res) => {
    const runtime = runtimeState.snapshot();
    const status = runtime.db.healthy && runtime.mqtt.connected ? "ok" : "degraded";

    res.status(200).json({
      status,
      runtime,
    });
  });

  return router;
}

module.exports = {
  createHealthRoutes,
};
