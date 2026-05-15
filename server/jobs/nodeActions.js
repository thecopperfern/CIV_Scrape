const fs = require("fs");
const { processDueSends } = require("../outreach/send");

const NODE_ACTIONS = {
  "send-campaign-batch": async ({ orgId, params, logPath }) => {
    const logStream = fs.createWriteStream(logPath, { flags: "a" });
    const log = (msg) => logStream.write(msg + "\n");
    log(`== Node action started: ${new Date().toISOString()} ==`);
    log(`Action: send-campaign-batch org=${orgId}`);
    try {
      const result = await processDueSends({
        orgId,
        batchSize: Number(params?.batchSize) || 25,
        log
      });
      log(`Result: processed=${result.processed} sent=${result.sent} skipped=${result.skipped}`);
      log(`== Node action finished: ${new Date().toISOString()} (exit 0) ==`);
      logStream.end();
      return { code: 0, error: null, result: { ...result, kind: "outreach" } };
    } catch (err) {
      log(`== Node action error: ${err.message} ==`);
      log(`== Node action finished: ${new Date().toISOString()} (exit 1) ==`);
      logStream.end();
      return { code: 1, error: err.message, result: null };
    }
  }
};

module.exports = { NODE_ACTIONS };
