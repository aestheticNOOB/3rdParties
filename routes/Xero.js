import express from "express";
import axios from "axios";
import qs from "qs";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import Business from "../models/Business.js";

dotenv.config({ path: "./config/config.env" });

const router = express.Router();

// ---------- Helper: Update .env ----------
function updateEnv(key, value) {
  const envPath = path.resolve("./config/config.env");
  let envConfig = fs.readFileSync(envPath, "utf-8");
  const regex = new RegExp(`^${key}=.*`, "m");
  if (envConfig.match(regex)) {
    envConfig = envConfig.replace(regex, `${key}=${value}`);
  } else {
    envConfig += `\n${key}=${value}`;
  }
  fs.writeFileSync(envPath, envConfig);
}

// ---------- Helper: Refresh Xero Token ----------
async function refreshXeroToken() {
  const response = await axios.post(
    "https://identity.xero.com/connect/token",
    qs.stringify({
      grant_type: "refresh_token",
      refresh_token: process.env.XERO_REFRESH_TOKEN,
      client_id: process.env.XERO_CLIENT_ID,
      client_secret: process.env.XERO_CLIENT_SECRET,
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  const { access_token, refresh_token } = response.data;
  updateEnv("XERO_ACCESS_TOKEN", access_token);
  updateEnv("XERO_REFRESH_TOKEN", refresh_token);
  process.env.XERO_ACCESS_TOKEN = access_token;
  process.env.XERO_REFRESH_TOKEN = refresh_token;
  return access_token;
}

// ---------- Helper: Get Tenant ID ----------
async function getTenantId() {
  const res = await axios.get("https://api.xero.com/connections", {
    headers: {
      Authorization: `Bearer ${process.env.XERO_ACCESS_TOKEN}`,
      Accept: "application/json",
    },
  });

  if (!res.data || res.data.length === 0) {
    throw new Error("No Xero organization connected");
  }
  return res.data[0].tenantId;
}

// ---------- Helper: Safe Date Parse ----------
function safeDateParse(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

// ---------- POST: Connect to Xero via BID ----------
router.post("/connect", async (req, res) => {
  const { BID } = req.body;

  if (!BID) return res.status(400).json({ message: "BID is required" });

  try {
    const business = await Business.findOne({ BID });

    if (!business) {
      return res.status(404).json({ BID, message: "BID does not exist" });
    }

    const xeroUrl = `https://login.xero.com/identity/connect/authorize?response_type=code&client_id=${process.env.XERO_CLIENT_ID}&redirect_uri=${encodeURIComponent(
      process.env.XERO_REDIRECT_URI
    )}&scope=${encodeURIComponent(
      "openid profile email accounting.transactions accounting.contacts"
    )}&state=${BID}`;

    res.json({
      BID,
      message: "XERO url generated",
      url: xeroUrl,
    });
  } catch (err) {
    res.status(500).json({ BID, message: "Server error", error: err.message });
  }
});

// ---------- GET: Callback to exchange code for tokens ----------
router.get("/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("Authorization code missing");

  try {
    const response = await axios.post(
      "https://identity.xero.com/connect/token",
      qs.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.XERO_REDIRECT_URI,
        client_id: process.env.XERO_CLIENT_ID,
        client_secret: process.env.XERO_CLIENT_SECRET,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token, refresh_token } = response.data;
    updateEnv("XERO_ACCESS_TOKEN", access_token);
    updateEnv("XERO_REFRESH_TOKEN", refresh_token);
    process.env.XERO_ACCESS_TOKEN = access_token;
    process.env.XERO_REFRESH_TOKEN = refresh_token;

    res.json({ message: "Xero connected successfully", access_token, refresh_token });
  } catch (err) {
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// ---------- GET: Fetch bank transactions ----------
router.get("/bank_transactions", async (req, res) => {
  try {
    let accessToken = process.env.XERO_ACCESS_TOKEN;
    let tenantId;

    try {
      tenantId = await getTenantId();
    } catch {
      accessToken = await refreshXeroToken();
      tenantId = await getTenantId();
    }

    const response = await axios.get(process.env.XERO_BANK_TRANSACTIONS_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Xero-tenant-id": tenantId,
        Accept: "application/json",
      },
    });

    const transactions = response.data.BankTransactions
      .filter(tx => tx.Status !== "DELETED")
      .sort((a, b) => new Date(b.DateString) - new Date(a.DateString)) // newest first
      .map(tx => {
        const transaction_direction = tx.Type.toUpperCase(); // RECEIVE or SPEND
        const transaction_amount = transaction_direction === "SPEND" ? -tx.Total : tx.Total;
        const contactName = tx.Contact ? tx.Contact.Name : "";
        const isoDate = safeDateParse(tx.DateString);

        return {
          [isoDate || "unknown_date"]: {
            "3rd_party": "xero",
            "3rd_party_type": "bank transaction",
            "transaction_direction": transaction_direction,
            "transaction_from":
              transaction_direction === "SPEND" ? tx.BankAccount?.Name || "" : contactName,
            "transaction_to":
              transaction_direction === "RECEIVE" ? tx.BankAccount?.Name || "" : contactName,
            "batch_payment": tx.BatchPayment?.Reference || "",
            "is_reconciled": tx.IsReconciled,
            "reference": tx.Reference || "",
            "currency_code": tx.CurrencyCode || "",
            "currency_rate": tx.CurrencyRate || 1,
            "transaction_date": isoDate,
            "transaction_status": tx.Status || "AUTHORISED",
            "transaction_amount": transaction_amount,
            "transaction_total_tax": tx.TotalTax || 0,
            "transaction_total": transaction_direction === "SPEND" ? -tx.Total : tx.Total,
            "last_updated": safeDateParse(tx.UpdatedDateUTC),
            "our_categorisation": {
              "transaction_category": "",
              "trasnaction_subcategory": "",
              "transaction_department": "",
              "transaction_type": ""
            }
          }
        };
      });

    res.json({ transactions });
  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch Xero transactions",
      error: err.response?.data || err.message,
    });
  }
});

export default router;
