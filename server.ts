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
  assetType: { type: String, required: true, default: 'gold' }, // 'gold', 'silver', 'crypto'
  name: { type: String, required: true },
  quantity: { type: Number, required: true },
  purchasePrice: { type: Number, required: true },
  purchaseDate: { type: String, required: true },
}, { timestamps: true });

const Investment = mongoose.model('Investment', investmentSchema);

// In-memory fallback storage
let inMemoryUsers: any[] = [];
let inMemoryInvestments = [
  { id: '1', userId: 'default', assetType: 'gold', name: '10g Gold Coin (24K)', quantity: 10, purchasePrice: 6200.00, purchaseDate: '2025-11-15' },
  { id: '2', userId: 'default', assetType: 'gold', name: 'Gold Bar (1oz)', quantity: 31.1, purchasePrice: 6000.00, purchaseDate: '2025-08-01' },
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
let cachedAssetData: any = {
  gold: { currentPrice: 6500.00, history: [] },
  silver: { currentPrice: 80.00, history: [] },
  crypto: { currentPrice: 5000000.00, history: [] }
};
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// 1 Troy Ounce = 31.1034768 grams
const TROY_OUNCE_TO_GRAMS = 31.1034768;

async function fetchAssetPrices() {
  try {
    const now = Date.now();
    // Return cached data if within duration and we have history
    if (now - lastFetchTime < CACHE_DURATION && cachedAssetData.gold.history.length > 0) {
      return cachedAssetData;
    }

    console.log("Fetching fresh asset price data from Yahoo Finance...");

    // Fetch current quotes
    const [goldQuote, silverQuote, btcQuote, inrQuote] = await Promise.all([
      yahooFinance.quote('GC=F').catch(() => null),
      yahooFinance.quote('SI=F').catch(() => null),
      yahooFinance.quote('BTC-USD').catch(() => null),
      yahooFinance.quote('INR=X').catch(() => null)
    ]);

    const usdToInr = inrQuote?.regularMarketPrice || 83;
    
    const goldPriceUsd = goldQuote?.regularMarketPrice || 2000;
    const silverPriceUsd = silverQuote?.regularMarketPrice || 25;
    const btcPriceUsd = btcQuote?.regularMarketPrice || 60000;

    const goldPriceInrPerGram = (goldPriceUsd / TROY_OUNCE_TO_GRAMS) * usdToInr;
    const silverPriceInrPerGram = (silverPriceUsd / TROY_OUNCE_TO_GRAMS) * usdToInr;
    const btcPriceInr = btcPriceUsd * usdToInr;

    // Fetch historical data (last 30 days)
    const period1 = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const period2 = new Date(now);
    
    const [goldChart, silverChart, btcChart, inrChart] = await Promise.all([
      yahooFinance.chart('GC=F', { period1, period2, interval: '1d' }).catch(() => null),
      yahooFinance.chart('SI=F', { period1, period2, interval: '1d' }).catch(() => null),
      yahooFinance.chart('BTC-USD', { period1, period2, interval: '1d' }).catch(() => null),
      yahooFinance.chart('INR=X', { period1, period2, interval: '1d' }).catch(() => null)
    ]);

    // Create a map of INR rates by date for easy lookup
    const inrMap = new Map();
    if (inrChart?.quotes) {
      for (const row of inrChart.quotes) {
        if (!row.date || !row.close) continue;
        inrMap.set(format(row.date, 'yyyy-MM-dd'), row.close);
      }
    }

    const processHistory = (chart: any, isTroyOunce: boolean) => {
      const history = [];
      if (chart?.quotes) {
        for (const row of chart.quotes) {
          if (!row.date || !row.close) continue;
          const dateStr = format(row.date, 'yyyy-MM-dd');
          const inrRate = inrMap.get(dateStr) || usdToInr;
          
          let priceInr = row.close * inrRate;
          if (isTroyOunce) {
            priceInr = priceInr / TROY_OUNCE_TO_GRAMS;
          }
          
          history.push({
            date: format(row.date, 'MMM dd'),
            price: Number(priceInr.toFixed(2))
          });
        }
      }
      return history;
    };

    const goldHistory = processHistory(goldChart, true);
    const silverHistory = processHistory(silverChart, true);
    const btcHistory = processHistory(btcChart, false);

    // Ensure the last point is the current live price
    if (goldHistory.length > 0) goldHistory[goldHistory.length - 1].price = Number(goldPriceInrPerGram.toFixed(2));
    if (silverHistory.length > 0) silverHistory[silverHistory.length - 1].price = Number(silverPriceInrPerGram.toFixed(2));
    if (btcHistory.length > 0) btcHistory[btcHistory.length - 1].price = Number(btcPriceInr.toFixed(2));

    cachedAssetData = {
      gold: { currentPrice: Number(goldPriceInrPerGram.toFixed(2)), history: goldHistory },
      silver: { currentPrice: Number(silverPriceInrPerGram.toFixed(2)), history: silverHistory },
      crypto: { currentPrice: Number(btcPriceInr.toFixed(2)), history: btcHistory }
    };
    lastFetchTime = now;

    return cachedAssetData;
  } catch (error: any) {
    console.error("Error fetching real asset prices:", error);
    // Return cached data or fallback
    return cachedAssetData;
  }
}

// Initial fetch and auto-refresh
fetchAssetPrices();
setInterval(fetchAssetPrices, CACHE_DURATION);

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

  // Get current asset prices and 30-day history
  app.get("/api/prices", async (req, res) => {
    const data = await fetchAssetPrices();
    res.json(data);
  });

  // Get all investments
  app.get("/api/investments", authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.id;
      if (!isMongoConnected) {
        return res.json(inMemoryInvestments.filter(inv => inv.userId === userId).map(inv => ({
          ...inv,
          quantity: inv.quantity || (inv as any).weightGrams,
          purchasePrice: inv.purchasePrice || (inv as any).purchasePricePerGram
        })));
      }
      const investments = await Investment.find({ userId }).sort({ createdAt: -1 });
      res.json(investments.map(inv => ({
        id: inv._id.toString(),
        assetType: inv.assetType || 'gold',
        name: inv.name,
        quantity: inv.quantity || (inv as any).weightGrams,
        purchasePrice: inv.purchasePrice || (inv as any).purchasePricePerGram,
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
      const { assetType, name, quantity, purchasePrice, purchaseDate } = req.body;
      
      if (!isMongoConnected) {
        const newInv = {
          id: Date.now().toString(),
          userId,
          assetType: assetType || 'gold',
          name,
          quantity,
          purchasePrice,
          purchaseDate
        };
        inMemoryInvestments.unshift(newInv);
        return res.status(201).json(newInv);
      }

      const newInvestment = new Investment({
        userId,
        assetType: assetType || 'gold',
        name,
        quantity,
        purchasePrice,
        purchaseDate
      });
      await newInvestment.save();
      res.status(201).json({
        id: newInvestment._id.toString(),
        assetType: newInvestment.assetType,
        name: newInvestment.name,
        quantity: newInvestment.quantity,
        purchasePrice: newInvestment.purchasePrice,
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
