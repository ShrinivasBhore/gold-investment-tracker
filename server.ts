import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { format, subDays } from "date-fns";
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

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
  
  // Get current gold price and 30-day history
  app.get("/api/gold-price", async (req, res) => {
    const data = await fetchRealGoldPrice();
    res.json(data);
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
