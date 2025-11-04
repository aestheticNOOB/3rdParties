import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

const router = express.Router();

// Register new business owner
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    //  Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields (name, email, password) are required.",
      });
    }

    //  Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: " business already exists.",
      });
    }

    // Hash password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    //  Create new user in MongoDB
    const user = await User.create({ name, email, password: hashedPassword });

    //  Get user ID after creation
    const userId = user._id.toString();

    //  Generate Stripe Connect URL using userId
    const stripeRedirectUrl = `https://connect.stripe.com/oauth/authorize?response_type=code&client_id=${process.env.STRIPE_CLIENT_ID}&scope=read_write&state=${userId}&redirect_uri=${process.env.STRIPE_REDIRECT_URI}`;

    //  Response
    res.status(201).json({
      success: true,
      message: "Business account created successfully!",
      data: {
        _id: userId,
        name: user.name,
        email: user.email,
        stripeRedirectUrl,
      },
    });
  } catch (err) {
    console.error(" Registration Error:", err);

    if (err.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Invalid input data.",
        error: err.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "An unexpected error occurred while registering the business.",
      error: err.message,
    });
  }
});

export default router;
