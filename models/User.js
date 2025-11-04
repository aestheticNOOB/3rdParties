import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
  transactionId: String,
  amount: String,
  currency: String,
  date: String,
  description: String,
  status: String,
  paymentMethod: String,
  customerEmail: String,
  source: String,
});

const stripeSchema = new mongoose.Schema({
  accountId: String,
  accessToken: String,
  refreshToken: String,
  businessName: String,
  transactions: [transactionSchema],
});

const userSchema = new mongoose.Schema({
  tuid: { type: String, required: true, unique: true }, // user login ID
  password: { type: String, required: true },
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
  stripe: stripeSchema,
}, { timestamps: true });

const User = mongoose.model("User", userSchema);
export default User;
