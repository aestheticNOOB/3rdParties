import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema({
  "Subscription name": { type: String, required: true },
  total_customers: { type: Number, default: 0 },
  average_customers: { type: Number, default: 0 },
  monthly_data: { type: Map, of: Number, default: {} },
}, { _id: false });

const yearDataSchema = new mongoose.Schema({
  total_customers: { type: Number, default: 0 },
  subscriptions: [subscriptionSchema],
}, { _id: false });

const b2bStripeCustomersSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  contact: { type: String, required: true },
  years: { type: Map, of: yearDataSchema, default: {} },
  message: { type: String },
}, { timestamps: true, collection: "b2b_stripe_customers" });

// Ensure one record per business
b2bStripeCustomersSchema.index({ businessId: 1 }, { unique: true });

export default mongoose.model("B2BStripeCustomers", b2bStripeCustomersSchema);
