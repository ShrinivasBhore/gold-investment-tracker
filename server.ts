import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { format, subDays } from "date-fns";
import YahooFinance from 'yahoo-finance2';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const yahooFinance = new YahooFinance();

// --- MongoDB Setup ---
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aura-gold-tracker';

let isMongoConnected = false;

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 3000 // Fail fast if no MongoDB instance is found
})
  .then(() => {
    console.log('Connected to MongoDB');
    isMongoConnected = true;
  })
  .catch(err => {
    console.warn('MongoDB connection error. Falling back to in-memory storage.', err.message);
  });

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

const investmentSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  name: { type: String, required: true },
  weightGrams: { type: Number, required: true },
  purchasePricePerGram: { type: Number, required: true },
  purchaseDate: { type: String, required: true },
}, { timestamps: true });

const Investment = mongoose.model('Investment', investmentSchema);

// In-memory fallback storage
let inMemoryUsers: any[] = [];
let inMemoryInvestments = [
  { id: '1', userId: 'default', name: '10g Gold Coin (24K)', weightGrams: 10, purchasePricePerGram: 6200.00, purchaseDate: '2025-11-15' },
  { id: '2', userId: 'default', name: 'Gold Bar (1oz)', weightGrams: 31.1, purchasePricePerGram: 6000.00, purchaseDate: '2025-08-01' },
];

// Auth middleware
const authMiddleware = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// --- Real-time Data Fetcher ---
// Cache for API responses to avoid rate limits
let cachedGoldData: { currentPrice: number, history: any[] } = {
  currentPrice: 6500.00,
  history: []
};
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// 1 Troy Ounce = 31.1034768 grams
const TROY_OUNCE_TO_GRAMS = 31.1034768;

async function fetchRealGoldPrice() {
  try {
    const now = Date.now();
    // Return cached data if within duration and we have history
    if (now - lastFetchTime < CACHE_DURATION && cachedGoldData.history.length > 0) {
      return cachedGoldData;
    }

    console.log("Fetching fresh gold price data from Yahoo Finance...");

    // Fetch current quotes
    const goldQuote = await yahooFinance.quote('GC=F'); // Gold Futures (USD/oz)
    const inrQuote = await yahooFinance.quote('INR=X'); // USD to INR

    if (!goldQuote || !inrQuote) throw new Error("Failed to fetch quotes");

    const pricePerOunceUsd = goldQuote.regularMarketPrice || 2000;
    const usdToInr = inrQuote.regularMarketPrice || 83;
    const currentPriceInrPerGram = (pricePerOunceUsd / TROY_OUNCE_TO_GRAMS) * usdToInr;

    // Fetch historical data (last 30 days)
    const period1 = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const period2 = new Date(now);
    
    const goldChart = await yahooFinance.chart('GC=F', { period1, period2, interval: '1d' });
    const inrChart = await yahooFinance.chart('INR=X', { period1, period2, interval: '1d' });

    const goldHist = goldChart.quotes;
    const inrHist = inrChart.quotes;

    // Create a map of INR rates by date for easy lookup
    const inrMap = new Map();
    for (const row of inrHist) {
      if (!row.date || !row.close) continue;
      const dateStr = format(row.date, 'yyyy-MM-dd');
      inrMap.set(dateStr, row.close);
    }

    const history = [];
    for (const row of goldHist) {
      if (!row.date || !row.close) continue;
      const dateStr = format(row.date, 'yyyy-MM-dd');
      const inrRate = inrMap.get(dateStr) || usdToInr; // fallback to current if missing
      
      const priceInrPerGram = (row.close / TROY_OUNCE_TO_GRAMS) * inrRate;
      
      history.push({
        date: format(row.date, 'MMM dd'),
        price: Number(priceInrPerGram.toFixed(2))
      });
    }

    // Ensure the last point is the current live price
    if (history.length > 0) {
      history[history.length - 1].price = Number(currentPriceInrPerGram.toFixed(2));
    }

    cachedGoldData = {
      currentPrice: Number(currentPriceInrPerGram.toFixed(2)),
      history
    };
    lastFetchTime = now;

    return cachedGoldData;
  } catch (error: any) {
    console.error("Error fetching real gold price:", error);
    // Return cached data or fallback
    return cachedGoldData;
  }
}

// Initial fetch
fetchRealGoldPrice();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API Routes ---
  
  // Auth Routes
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);

      if (!isMongoConnected) {
        if (inMemoryUsers.find(u => u.email === email)) {
          return res.status(400).json({ error: 'User already exists' });
        }
        const newUser = { id: Date.now().toString(), email, password: hashedPassword };
        inMemoryUsers.push(newUser);
        const token = jwt.sign({ id: newUser.id }, JWT_SECRET, { expiresIn: '7d' });
        return res.status(201).json({ token });
      }

      const existingUser = await User.findOne({ email });
      if (existingUser) return res.status(400).json({ error: 'User already exists' });

      const user = new User({ email, password: hashedPassword });
      await user.save();

      const token = jwt.sign({ id: user._id.toString() }, JWT_SECRET, { expiresIn: '7d' });
      res.status(201).json({ token });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!isMongoConnected) {
        const user = inMemoryUsers.find(u => u.email === email);
        if (!user) return res.status(400).json({ error: 'Invalid credentials' });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });
        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
        return res.json({ token });
      }

      const user = await User.findOne({ email });
      if (!user) return res.status(400).json({ error: 'Invalid credentials' });

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

      const token = jwt.sign({ id: user._id.toString() }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ token });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  // Get current gold price and 30-day history
  app.get("/api/gold-price", async (req, res) => {
    const data = await fetchRealGoldPrice();
    res.json(data);
  });

  // Get all investments
  app.get("/api/investments", authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.id;
      if (!isMongoConnected) {
        return res.json(inMemoryInvestments.filter(inv => inv.userId === userId));
      }
      const investments = await Investment.find({ userId }).sort({ createdAt: -1 });
      res.json(investments.map(inv => ({
        id: inv._id.toString(),
        name: inv.name,
        weightGrams: inv.weightGrams,
        purchasePricePerGram: inv.purchasePricePerGram,
        purchaseDate: inv.purchaseDate
      })));
    } catch (error) {
      console.error("Error fetching investments:", error);
      res.status(500).json({ error: "Failed to fetch investments" });
    }
  });

  // Add a new investment
  app.post("/api/investments", authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { name, weightGrams, purchasePricePerGram, purchaseDate } = req.body;
      
      if (!isMongoConnected) {
        const newInv = {
          id: Date.now().toString(),
          userId,
          name,
          weightGrams,
          purchasePricePerGram,
          purchaseDate
        };
        inMemoryInvestments.unshift(newInv);
        return res.status(201).json(newInv);
      }

      const newInvestment = new Investment({
        userId,
        name,
        weightGrams,
        purchasePricePerGram,
        purchaseDate
      });
      await newInvestment.save();
      res.status(201).json({
        id: newInvestment._id.toString(),
        name: newInvestment.name,
        weightGrams: newInvestment.weightGrams,
        purchasePricePerGram: newInvestment.purchasePricePerGram,
        purchaseDate: newInvestment.purchaseDate
      });
    } catch (error) {
      console.error("Error adding investment:", error);
      res.status(500).json({ error: "Failed to add investment" });
    }
  });

  // Delete an investment
  app.delete("/api/investments/:id", authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      
      if (!isMongoConnected) {
        inMemoryInvestments = inMemoryInvestments.filter(inv => inv.id !== id || inv.userId !== userId);
        return res.status(200).json({ message: "Investment deleted successfully" });
      }

      await Investment.findOneAndDelete({ _id: id, userId });
      res.status(200).json({ message: "Investment deleted successfully" });
    } catch (error) {
      console.error("Error deleting investment:", error);
      res.status(500).json({ error: "Failed to delete investment" });
    }
  });

  // --- Vite Middleware for Development ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // --- Static Serving for Production ---
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
