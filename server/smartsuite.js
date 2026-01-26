const axios = require("axios");

const BASE_URL = process.env.SMARTSUITE_BASE_URL || "https://app.smartsuite.com/api/v1";

function getHeaders() {
  const apiKey = process.env.SMARTSUITE_API_KEY;
  const accountId = process.env.SMARTSUITE_ACCOUNT_ID;

  if (!apiKey || !accountId) {
    throw new Error("Missing SMARTSUITE_API_KEY or SMARTSUITE_ACCOUNT_ID");
  }

  return {
    Authorization: `Token ${apiKey}`,
    "Account-ID": accountId,
    "Content-Type": "application/json"
  };
}

function resolveTableId(tableKey) {
  if (!tableKey) return null;
  const normalized = tableKey.toLowerCase();
  if (normalized === "customers" || normalized === "source") {
    return process.env.SOURCE_CUSTOMERS_TABLE_ID;
  }
  if (normalized === "hub" || normalized === "intelligence") {
    return process.env.DESTINATION_INTELLIGENCE_HUB_TABLE_ID;
  }
  return null;
}

async function listRecords({ tableKey, limit = 50, offset = 0, sortBy, sortDir, filter }) {
  const tableId = resolveTableId(tableKey);
  if (!tableId) {
    throw new Error("Invalid table key");
  }

  const payload = {
    filter: filter || {},
    sort: []
  };

  if (sortBy) {
    payload.sort.push({ field: sortBy, direction: sortDir || "asc" });
  }

  const response = await axios.post(
    `${BASE_URL}/applications/${tableId}/records/list/`,
    payload,
    {
      headers: getHeaders(),
      params: {
        limit: Math.min(Number(limit) || 50, 200),
        offset: Number(offset) || 0
      }
    }
  );

  return response.data;
}

module.exports = {
  listRecords
};
