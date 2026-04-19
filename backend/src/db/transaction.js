async function withTransaction(pool, task) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await task(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_rollbackError) {
      // Ignore rollback failures to preserve the original error.
    }
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  withTransaction,
};
