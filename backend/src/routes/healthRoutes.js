const express = require("express");

function createHealthRoutes(store, runtimeState) {
  const router = express.Router();

  router.get("/", (req, res) => {
    const runtime = runtimeState.snapshot();
    const healthy = runtime.mqtt.connected;

    res.status(200).json({
      status: healthy ? "ok" : "degraded",
      trackedDevices: store.size(),
      runtime,
    });
  });

  return router;
}

module.exports = {
  createHealthRoutes,
};
