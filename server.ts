import express from "express";
import path from "path";
import axios from "axios";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_KEY = process.env.OPENWEATHER_API_KEY || "7d29fc724f204783858b244921c9f237";
const BASE_URL = "https://api.openweathermap.org";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/weather/dashboard", async (req, res) => {
    const { city } = req.query;

    if (!city || typeof city !== "string") {
      return res.status(400).json({ error: "City name is required" });
    }

    try {
      // 1. Geocoding
      const geoUrl = `${BASE_URL}/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${API_KEY}`;
      const geoRes = await axios.get(geoUrl);
      
      if (!geoRes.data || geoRes.data.length === 0) {
        return res.status(404).json({ error: `City not found: ${city}` });
      }

      const { lat, lon, name, country } = geoRes.data[0];

      // 2. Concurrent requests for Current, Forecast, and Pollution
      const [currentRes, forecastRes, pollutionRes] = await Promise.all([
        axios.get(`${BASE_URL}/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`),
        axios.get(`${BASE_URL}/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`),
        axios.get(`${BASE_URL}/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`)
      ]);

      const dashboard = {
        city: name,
        country,
        current: currentRes.data,
        forecast: forecastRes.data,
        pollution: pollutionRes.data
      };

      res.json(dashboard);
    } catch (error: any) {
      console.error("Weather API Error:", error.message);
      res.status(502).json({ 
        error: "Failed to fetch weather data", 
        details: error.response?.data?.message || error.message 
      });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
