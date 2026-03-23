import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { format, subDays } from "date-fns";

// --- Mock Data Generator ---
const generateHistoricalData = (days: number, basePrice: number) => {
  const data = [];
  let currentPrice = basePrice;
  for (let i = days; i >= 0; i--) {
    const date = format(subDays(new Date(), i), 'MMM dd');
    // Random walk with slight upward bias
    const change = (Math.random() - 0.45) * 1.5;
    currentPrice = currentPrice + change;
    data.push({ date, price: Number(currentPrice.toFixed(2)) });
  }
  return data;
};

// Initialize server-side state
const INITIAL_PRICE_PER_GRAM = 76.50; // USD
let priceHistory = generateHistoricalData(30, 74.00);
let currentPrice = priceHistory[priceHistory.length - 1].price;

// Simulate real-time price updates on the server
setInterval(() => {
  const change = (Math.random() - 0.5) * 0.1; // Small fluctuations
  currentPrice = Number((currentPrice + change).toFixed(2));
  
  // Update the last point in history to reflect current price
  priceHistory[priceHistory.length - 1] = {
    ...priceHistory[priceHistory.length - 1],
    price: currentPrice
  };
}, 5000); // Update every 5 seconds

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API Routes ---
  
  // Get current gold price and 30-day history
  app.get("/api/gold-price", (req, res) => {
    res.json({
      currentPrice,
      history: priceHistory
    });
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
