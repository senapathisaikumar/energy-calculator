
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const nodemailer = require("nodemailer");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const mongoSanitize = require("express-mongo-sanitize");

const app = express();
const port = process.env.PORT || 3000;

// ---------- Basic env check ----------
const requiredEnvs = ["MONGO_URI", "EMAIL_USER", "EMAIL_PASS", "EMAIL_FROM", "JWT_SECRET", "ALLOWED_ORIGIN"];
for (const key of requiredEnvs) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}. Check your .env file.`);
    process.exit(1);
  }
}
  
// ---------- Middlewares ----------
app.use(helmet());
app.use(express.json());
// app.use(mongoSanitize());
 // prevent NoSQL injection

// CORS - allow only configured origin
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN.split(",").map(s => s.trim()),
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));

// Rate limiter (basic)
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || "60", 10),
  message: { message: "Too many requests, please try again later." },
});
app.use(limiter);

// ---------- DB ----------
mongoose.connect(process.env.MONGO_URI, { })
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message || err);
    process.exit(1);
  });

// ---------- Schemas ----------
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  mail: { type: String, required: true, unique: true, lowercase: true, trim: true },
  otp: { type: String },
  otpExpires: { type: Date },
}, { timestamps: true });

const applianceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  applianceName: { type: String, required: true, trim: true },
  rating: { type: Number, required: true },
  hourlyUsage: { type: Number, required: true },
  quantity: { type: Number, required: true },
  dayFrequency: { type: Number, required: true },
  consumptionPerDay: { type: Number, required: true },
  consumptionPerWeek: { type: Number, required: true },
  consumptionPerMonth: { type: Number, required: true },
  monthlyCost: { type: Number, required: true },
  possibleSavings: { type: Number, default: 0 },
}, { timestamps: true });

const User = mongoose.model("User", userSchema);
const Appliance = mongoose.model("Appliance", applianceSchema);

// ---------- Mailer ----------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendOtpEmail(toEmail, name, otp) {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: toEmail,
    subject: "🔒 Your OTP for Energy Savings Calculator",
    html: `
      <div style="font-family: 'Arial', sans-serif; background-color: #f4f6f8; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <div style="background: #007bff; color: #ffffff; text-align: center; padding: 18px 16px; font-size: 20px; font-weight: bold;">
            ⚡ Energy Savings Calculator
          </div>
          
          <!-- Body -->
          <div style="padding: 28px; color: #333333; line-height: 1.6;">
            <p style="margin: 0 0 12px;">Hello <strong>${name}</strong>,</p>
            <p style="margin: 0 0 20px;">Your one-time password (OTP) is:</p>
            
            <!-- OTP Box -->
            <div style="background: #f1f5ff; border-radius: 8px; padding: 18px; text-align: center; font-size: 30px; font-weight: bold; letter-spacing: 6px; color: #007bff; margin: 24px 0;">
              ${otp}
            </div>
            
            <p style="margin: 0 0 12px;">This OTP will expire in <strong>10 minutes</strong>.</p>
            <p style="margin: 0;">If you did not request this, please ignore this email.</p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 32px 0 20px;" />
            
            <!-- Footer -->
            <div style="text-align: center;">
              <a href="https://www.antariot.com" style="color: #007bff; text-decoration: none; font-weight: 500;">
                www.antariot.com
              </a>
              <br />
              <a href="mailto:sales@antariot.com" style="color: #007bff; text-decoration: none; font-weight: 500;">
                sales@antariot.com
              </a>
              <p style="font-size: 13px; color: #777; margin-top: 14px;">
                © ${new Date().getFullYear()} Antar IoT Energy Savings Calculator. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </div>
`,
  };
  return transporter.sendMail(mailOptions);
}

// ---------- Helpers ----------
function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) return res.status(401).json({ message: "Unauthorized" });
  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { userId, mail }
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

// ---------- Routes ----------

// health
app.get("/", (req, res) => res.send("Energy Savings Calculator API is running"));

// send OTP - validate inputs
app.post(
  "/api/send-otp",
  [
    body("mail").isEmail().withMessage("Valid email required"),
    body("name").isLength({ min: 1 }).withMessage("Name required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

    const { mail, name } = req.body;
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

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

// verify OTP -> respond with jwt
app.post(
  "/api/verify-otp",
  [
    body("mail").isEmail(),
    body("otp").isLength({ min: 3 }).withMessage("Invalid OTP"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

    const { mail, otp } = req.body;
    try {
      const user = await User.findOne({ mail });
      if (!user) return res.status(404).json({ message: "User not found" });
      if (!user.otp || user.otp !== otp || new Date() > user.otpExpires) {
        return res.status(400).json({ message: "Invalid or expired OTP" });
      }

      // clear otp
      user.otp = undefined;
      user.otpExpires = undefined;
      await user.save();

      // sign token
      const token = signToken({ userId: user._id, mail: user.mail });
      return res.status(200).json({ token, userId: user._id, name: user.name, mail: user.mail });
    } catch (err) {
      console.error("Error in /api/verify-otp:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Create appliance - authenticated
app.post(
  "/api/appliances",
  authMiddleware,
  [
    body("applianceName").isLength({ min: 1 }),
    body("rating").isNumeric(),
    body("hourlyUsage").isNumeric(),
    body("quantity").isInt({ min: 1 }),
    body("dayFrequency").isInt({ min: 0 }),
  ],
  async (req, res) => {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return res.status(400).json({ message: errs.array()[0].msg });

    try {
      // compute derived fields to avoid trusting client
      const { applianceName, rating, hourlyUsage, quantity, dayFrequency } = req.body;
      const consumptionPerDay = (rating * hourlyUsage * quantity) / 1000;
      const consumptionPerWeek = consumptionPerDay * dayFrequency;
      const consumptionPerMonth = consumptionPerWeek * 4.33;
      const monthlyCost = consumptionPerMonth * 0.12; // move rate to env if needed

      const doc = new Appliance({
        userId: req.user.userId,
        applianceName,
        rating,
        hourlyUsage,
        quantity,
        dayFrequency,
        consumptionPerDay,
        consumptionPerWeek,
        consumptionPerMonth,
        monthlyCost,
      });
      await doc.save();
      return res.status(201).json(doc);
    } catch (err) {
      console.error("Error adding appliance:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Get appliances for logged in user
app.get("/api/appliances", authMiddleware, async (req, res) => {
  try {
    const appliances = await Appliance.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    return res.status(200).json(appliances);
  } catch (err) {
    console.error("Error fetching appliances:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Update appliance - ownership enforced
app.put(
  "/api/appliances/:id",
  authMiddleware,
  [
    body("applianceName").optional().isLength({ min: 1 }),
    body("rating").optional().isNumeric(),
    body("hourlyUsage").optional().isNumeric(),
    body("quantity").optional().isInt({ min: 1 }),
    body("dayFrequency").optional().isInt({ min: 0 }),
  ],
  async (req, res) => {
    try {
      const appliance = await Appliance.findById(req.params.id);
      if (!appliance) return res.status(404).json({ message: "Appliance not found" });
      if (appliance.userId.toString() !== req.user.userId) return res.status(403).json({ message: "Forbidden" });

      // merge updates and recalc derived fields if needed
      const updates = req.body;
      const merged = { ...appliance.toObject(), ...updates };
      const consumptionPerDay = (merged.rating * merged.hourlyUsage * merged.quantity) / 1000;
      const consumptionPerWeek = consumptionPerDay * merged.dayFrequency;
      const consumptionPerMonth = consumptionPerWeek * 4.33;
      const monthlyCost = consumptionPerMonth * 0.12;

      Object.assign(appliance, updates, { consumptionPerDay, consumptionPerWeek, consumptionPerMonth, monthlyCost });
      await appliance.save();
      return res.status(200).json(appliance);
    } catch (err) {
      console.error("Error updating appliance:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Delete appliance - ownership enforced
app.delete("/api/appliances/:id", authMiddleware, async (req, res) => {
  try {
    const appliance = await Appliance.findById(req.params.id);
    if (!appliance) return res.status(404).json({ message: "Appliance not found" });
    if (appliance.userId.toString() !== req.user.userId) return res.status(403).json({ message: "Forbidden" });

    await Appliance.findByIdAndDelete(req.params.id);
    return res.status(200).json({ message: "Appliance deleted successfully" });
  } catch (err) {
    console.error("Error deleting appliance:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ---------- Start ----------
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
