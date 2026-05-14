const axios = require("axios");

const BASE_URL = process.env.SMARTSUITE_BASE_URL || "https://app.smartsuite.com/api/v1";

function buildHeaders(creds) {
  if (!creds || !creds.apiKey || !creds.accountId) {
    throw new Error("Missing SmartSuite credentials");
  }
  return {
    Authorization: `Token ${creds.apiKey}`,
    "Account-ID": creds.accountId,
    "Content-Type": "application/json"
  };
}

function resolveTableId(creds, tableKey) {
  if (!tableKey) return null;
  const normalized = String(tableKey).toLowerCase();
  if (normalized === "customers" || normalized === "source") {
    return creds.sourceTableId;
  }
  if (normalized === "hub" || normalized === "intelligence") {
    return creds.destTableId;
  }
  return null;
}

async function listRecords({ creds, tableKey, limit = 50, offset = 0, sortBy, sortDir, filter }) {
  const tableId = resolveTableId(creds, tableKey);
  if (!tableId) throw new Error("Invalid table key or no table configured");

  const payload = { filter: filter || {}, sort: [] };
  if (sortBy) payload.sort.push({ field: sortBy, direction: sortDir || "asc" });

  const response = await axios.post(
    `${BASE_URL}/applications/${tableId}/records/list/`,
    payload,
    {
      headers: buildHeaders(creds),
      params: {
        limit: Math.min(Number(limit) || 50, 200),
        offset: Number(offset) || 0
      }
    }
  );

  return response.data;
}

module.exports = { listRecords };
