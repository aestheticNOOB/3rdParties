import express from "express";
import { getAllTransactions } from "../models/transaction.js";
import { getStripePayments } from "../services/stripe.js";

export default function createSalesRouter() {
  const router = express.Router();

  router.get("/actual_sales", async (req, res) => {
    try {
      const mongoData = await getAllTransactions();
      const stripeData = await getStripePayments();

      // Combine and sort by date
      const combined = [...mongoData, ...stripeData].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      );

      res.json(combined);
    } catch (err) {
      console.error("Error fetching sales:", err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
