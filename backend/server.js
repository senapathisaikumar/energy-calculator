// ---------- Imports ----------
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const nodemailer = require("nodemailer");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");

// ---------- Initialize ----------
const app = express();
const port = process.env.PORT || 3000;

// ---------- Middlewares ----------
app.use(helmet());
app.use(express.json());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN
      ? process.env.ALLOWED_ORIGIN.split(",").map((s) => s.trim())
      : "*", // fallback for dev
    credentials: true,
  })
);

// ---------- Rate Limiting ----------
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // max requests per minute
  message: { message: "Too many requests, please try again later." },
});
app.use(limiter);

// ---------- MongoDB Connection ----------
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// ---------- Schemas ----------
const userSchema = new mongoose.Schema({
  name: String,
  mail: { type: String, unique: true },
  otp: String,
  otpExpires: Date,
});

const applianceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    applianceName: { type: String, required: true },
    rating: { type: Number, required: true }, // kW
    hourlyUsage: { type: Number, required: true },
    quantity: { type: Number, required: true },
    dayFrequency: { type: Number, required: true },
    unitRate: { type: Number, required: true }, // ₹ per kWh
    consumptionPerDay: Number,
    consumptionPerWeek: Number,
    consumptionPerMonth: Number,
    monthlyCost: Number,
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
const Appliance = mongoose.model("Appliance", applianceSchema);

// ---------- Helper: Send OTP Email ----------
async function sendOtpEmail(mail, name, otp) {
  const transporter = nodemailer.createTransport({
    service: "gmail", // use your email service
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"Energy Calculator" <${process.env.EMAIL_USER}>`,
    to: mail,
    subject: "Your OTP Code for Energy Calculator",
    html: `
      <div style="font-family: Arial, sans-serif; background:#f6f9fc; padding:20px; text-align:center;">
        <h2 style="color:#333;">Hello ${name},</h2>
        <p style="font-size:16px;">Your One-Time Password (OTP) is:</p>
        <h1 style="background:#4CAF50; color:#fff; display:inline-block; padding:10px 20px; border-radius:5px;">${otp}</h1>
        <p style="font-size:14px; color:#555;">This OTP is valid for 10 minutes.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}

// ---------- JWT Helpers ----------
function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

// ---------- Routes ----------

// Health Check
app.get("/", (req, res) => res.send("⚡ Energy Calculator API is running!"));

// ---------- Send OTP ----------
app.post(
  "/api/send-otp",
  [
    body("mail").isEmail().withMessage("Valid email required"),
    body("name").isLength({ min: 1 }).withMessage("Name required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ message: errors.array()[0].msg });

    const { mail, name } = req.body;
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    try {
      await User.findOneAndUpdate(
        { mail },
        { name, mail, otp, otpExpires },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      await sendOtpEmail(mail, name, otp);
      return res.status(200).json({ message: "OTP sent successfully" });
    } catch (error) {
      console.error("Error in /api/send-otp:", error);
      return res.status(500).json({ message: "Failed to send OTP" });
    }
  }
);

// ---------- Verify OTP ----------
app.post(
  "/api/verify-otp",
  [
    body("mail").isEmail(),
    body("otp").isLength({ min: 3 }).withMessage("Invalid OTP"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ message: errors.array()[0].msg });

    const { mail, otp } = req.body;
    try {
      const user = await User.findOne({ mail });
      if (!user) return res.status(404).json({ message: "User not found" });

      if (!user.otp || user.otp !== otp || new Date() > user.otpExpires) {
        return res.status(400).json({ message: "Invalid or expired OTP" });
      }

      // clear OTP
      user.otp = undefined;
      user.otpExpires = undefined;
      await user.save();

      // sign token
      const token = signToken({ userId: user._id, mail: user.mail });
      return res.status(200).json({
        token,
        userId: user._id,
        name: user.name,
        mail: user.mail,
      });
    } catch (err) {
      console.error("Error in /api/verify-otp:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// ---------- Create Appliance ----------
app.post(
  "/api/appliances",
  authMiddleware,
  [
    body("applianceName").isLength({ min: 1 }),
    body("rating").isNumeric(),
    body("hourlyUsage").isNumeric(),
    body("quantity").isInt({ min: 1 }),
    body("dayFrequency").isInt({ min: 0 }),
    body("unitRate").isNumeric(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ message: errors.array()[0].msg });

    try {
      const { applianceName, rating, hourlyUsage, quantity, dayFrequency, unitRate } =
        req.body;

      // Energy calculations
      const consumptionPerDay = rating * hourlyUsage * quantity;
      const consumptionPerWeek = consumptionPerDay * dayFrequency;
      const consumptionPerMonth = consumptionPerWeek * 4.33;
      const monthlyCost = consumptionPerMonth * unitRate;

      const appliance = new Appliance({
        userId: req.user.userId,
        applianceName,
        rating,
        hourlyUsage,
        quantity,
        dayFrequency,
        unitRate,
        consumptionPerDay,
        consumptionPerWeek,
        consumptionPerMonth,
        monthlyCost,
      });

      await appliance.save();
      res.status(201).json(appliance);
    } catch (err) {
      console.error("Error creating appliance:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

// ---------- Get Appliances ----------
app.get("/api/appliances", authMiddleware, async (req, res) => {
  try {
    const appliances = await Appliance.find({ userId: req.user.userId }).sort({
      createdAt: -1,
    });
    res.json(appliances);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------- Update Appliance ----------
app.put("/api/appliances/:id", authMiddleware, async (req, res) => {
  try {
    const appliance = await Appliance.findById(req.params.id);
    if (!appliance) return res.status(404).json({ message: "Appliance not found" });

    if (!appliance.userId.equals(req.user.userId))
      return res.status(403).json({ message: "Forbidden" });

    const updates = req.body;
    const merged = { ...appliance.toObject(), ...updates };

    // Recalculate
    const consumptionPerDay = merged.rating * merged.hourlyUsage * merged.quantity;
    const consumptionPerWeek = consumptionPerDay * merged.dayFrequency;
    const consumptionPerMonth = consumptionPerWeek * 4.33;
    const monthlyCost = consumptionPerMonth * merged.unitRate;

    Object.assign(appliance, updates, {
      consumptionPerDay,
      consumptionPerWeek,
      consumptionPerMonth,
      monthlyCost,
    });

    await appliance.save();
    res.json(appliance);
  } catch (err) {
    console.error("Error updating appliance:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------- Delete Appliance ----------
app.delete("/api/appliances/:id", authMiddleware, async (req, res) => {
  try {
    const appliance = await Appliance.findById(req.params.id);
    if (!appliance) return res.status(404).json({ message: "Appliance not found" });

    if (!appliance.userId.equals(req.user.userId))
      return res.status(403).json({ message: "Forbidden" });

    await Appliance.findByIdAndDelete(req.params.id);
    res.json({ message: "Appliance deleted successfully" });
  } catch (err) {
    console.error("Error deleting appliance:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------- Start Server ----------
app.listen(port, () => console.log(`🚀 Server running at http://localhost:${port}`));

