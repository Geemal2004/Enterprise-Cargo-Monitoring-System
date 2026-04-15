const express = require("express");

function createLatestRoutes(store) {
  const router = express.Router();

  router.get("/", (req, res) => {
    res.status(200).json({
      count: store.size(),
      byKey: store.getLatestByKeyObject(),
      items: store.getLatestList(),
    });
  });

  router.get("/:truckId/:containerId", (req, res) => {
    const { truckId, containerId } = req.params;
    const latest = store.getLatest(truckId, containerId);

    if (!latest) {
      return res.status(404).json({
        message: "Telemetry not found for truckId/containerId",
      });
    }

    return res.status(200).json(latest);
  });

  return router;
}

module.exports = {
  createLatestRoutes,
};
