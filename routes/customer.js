import express from "express";
import Stripe from "stripe";
import dotenv from "dotenv";
import Business from "../models/Business.js";
import B2BStripeCustomers from "../models/B2BStripeCustomers.js";

dotenv.config({ path: "./config/config.env" });

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const initMonthlyData = () => {
  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];
  const data = {};
  months.forEach((m) => (data[m] = { actual: 0 }));
  return data;
};

router.post("/actual_customer", async (req, res) => {
  const { BID } = req.body;
  if (!BID) return res.status(400).json({ message: "Missing BID in request body" });

  try {
    const business = await Business.findOne({ BID });
    if (!business) return res.status(404).json({ message: "Business not found" });
    if (!business.stripe?.accountId)
      return res.status(400).json({ message: "Stripe account not connected for this business" });

    const stripeAccount = business.stripe.accountId;

    const customers = await stripe.customers.list({ limit: 100 }, { stripeAccount });
    const subscriptions = await stripe.subscriptions.list({ limit: 100 }, { stripeAccount });
    const products = await stripe.products.list({ limit: 100 }, { stripeAccount });

    const productMap = {};
    products.data.forEach((p) => { productMap[p.id] = p.name; });

    const currentYear = new Date().getFullYear();
    const groupedSubscriptions = {};
    const uniqueCustomers = new Set();

    subscriptions.data.forEach((sub) => {
      const customerId = sub.customer;
      uniqueCustomers.add(customerId);

      const item = sub.items.data[0];
      const productId = item?.price?.product;
      const productName = productMap[productId] || "Unknown Subscription";

      if (!groupedSubscriptions[productName]) {
        groupedSubscriptions[productName] = {
          data: {
            [currentYear]: { total_customers: 0, average_customers: 0, monthly_data: initMonthlyData() }
          }
        };
      }

      groupedSubscriptions[productName].data[currentYear].total_customers += 1;

      const createdDate = new Date(sub.created * 1000);
      const month = createdDate.toLocaleString("en-US", { month: "long" });
      groupedSubscriptions[productName].data[currentYear].monthly_data[month].actual += 1;
    });

    const totalCustomers = uniqueCustomers.size;
    const averageCustomers = totalCustomers ? Math.floor(totalCustomers / 12) : 0;

    for (const data of Object.values(groupedSubscriptions)) {
      data.data[currentYear].average_customers = averageCustomers;
    }

    const output = {
      BID,
      message: "Customers actuals details retrieved",
      total_customers: totalCustomers,
      updatedAt: new Date(),
      subscription: groupedSubscriptions
    };

    await B2BStripeCustomers.findOneAndUpdate(
      { businessId: business._id },
      output,
      { upsert: true, new: true, strict: false }
    );

    res.json(output);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch customers", error: err.message });
  }
});

export default router;
