const express = require("express");

function createAlertsRoutes(store) {
  const router = express.Router();

  router.get("/", (req, res) => {
    const alerts = store.getActiveAlerts();
    res.status(200).json({
      count: alerts.length,
      items: alerts,
    });
  });

  return router;
}

module.exports = {
  createAlertsRoutes,
};
