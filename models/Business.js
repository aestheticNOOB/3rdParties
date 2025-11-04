import mongoose from "mongoose";

const businessSchema = new mongoose.Schema({
  tuid: { type: String, unique: true },
  password: { type: String },
  authToken: { type: String, unique: true },
  business_data: {
    _id: String,
    BID: String,
    contact: String,
    business_name: String,
    business_country: String,
    registration_number: String,
    payment_status: String,
    contact_verification: Boolean,
    temp_premium: Object,
  },
  stripe: {
    accountId: String,
    accessToken: String,
    refreshToken: String,
    businessName: String,
    transactions: Array,
  }
}, { timestamps: true });

const Business = mongoose.model("Business", businessSchema, "businesses"); // note collection name
export default Business;
