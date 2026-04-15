function startOfflineScanner(store, intervalMs) {
  const timer = setInterval(() => {
    store.refreshAlerts();
  }, intervalMs);

  if (typeof timer.unref === "function") {
    timer.unref();
  }

  return () => clearInterval(timer);
}

module.exports = {
  startOfflineScanner,
};
