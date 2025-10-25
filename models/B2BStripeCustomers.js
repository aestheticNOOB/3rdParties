import mongoose from "mongoose";

const B2BStripeCustomerSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  contact: { type: String },
  message: { type: String },
  target_market: { type: String },
  data: { type: Object, required: true }, // Stores yearly/monthly aggregated data
}, { timestamps: true });

export default mongoose.model("B2BStripeCustomers", B2BStripeCustomerSchema);
