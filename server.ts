import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Simple in-memory cache for TMDB API proxy
interface CacheEntry {
  data: any;
  expiresAt: number;
}
const tmdbCache = new Map<string, CacheEntry>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache for TMDB responses

// Middleware to parse JSON bodies
app.use(express.json());

// API health endpoint
app.get('/api/health', (req, res) => {
  const hasTmdbKey = (!!process.env.TMDB_API_KEY && process.env.TMDB_API_KEY !== 'YOUR_TMDB_API_KEY') ||
                     (!!process.env.VITE_TMDB_API_KEY && process.env.VITE_TMDB_API_KEY !== 'YOUR_TMDB_API_KEY') ||
                     (!!process.env.REACT_APP_TMDB_API_KEY && process.env.REACT_APP_TMDB_API_KEY !== 'YOUR_TMDB_API_KEY');
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    hasTmdbKey
  });
});

// TMDB API Proxy
app.get('/api/tmdb', async (req, res) => {
  const { path: tmdbPath, ...rest } = req.query;

  if (!tmdbPath || typeof tmdbPath !== 'string') {
    return res.status(400).json({ error: 'Path parameter is required (e.g. ?path=/movie/popular)' });
  }

  // Get TMDB Key (with fallback to client-supplied key if the server doesn't have one configured)
  let tmdbKey = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || process.env.REACT_APP_TMDB_API_KEY;
  const clientKey = req.headers['x-tmdb-key'] || req.query.user_api_key;
  
  const isValidClientKey = clientKey && 
    typeof clientKey === 'string' && 
    clientKey !== 'YOUR_TMDB_API_KEY' && 
    clientKey !== 'undefined' && 
    clientKey !== 'null' && 
    clientKey.trim() !== '';

  if (isValidClientKey) {
    tmdbKey = clientKey as string;
  }

  if (!tmdbKey || tmdbKey === 'YOUR_TMDB_API_KEY') {
    return res.status(500).json({
      error: 'TMDB_API_KEY is not configured.',
      needsConfig: true,
      message: 'Please configure the TMDB_API_KEY environment variable in your server environment, or provide your own in the App Settings page.'
    });
  }

  // Construct TMDB URL with all query params
  const searchParams = new URLSearchParams();
  searchParams.append('api_key', tmdbKey);
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) {
      searchParams.append(key, String(value));
    }
  }

  const cacheKey = `${tmdbPath}?${searchParams.toString()}`;

  // Check cache (unless client requests refresh via bypass)
  const isBypass = req.query.bypassCache === 'true';
  if (!isBypass && tmdbCache.has(cacheKey)) {
    const entry = tmdbCache.get(cacheKey)!;
    if (Date.now() < entry.expiresAt) {
      return res.json(entry.data);
    }
    tmdbCache.delete(cacheKey); // Evict expired
  }

  try {
    const tmdbUrl = `https://api.themoviedb.org/3${tmdbPath}?${searchParams.toString()}`;
    const tmdbResponse = await fetch(tmdbUrl);
    
    if (!tmdbResponse.ok) {
      const errText = await tmdbResponse.text();
      return res.status(tmdbResponse.status).json({
        error: `TMDB API responded with status ${tmdbResponse.status}`,
        details: errText
      });
    }

    const data = await tmdbResponse.json();

    // Cache the successful response
    tmdbCache.set(cacheKey, {
      data,
      expiresAt: Date.now() + CACHE_TTL
    });

    res.json(data);
  } catch (error: any) {
    console.error('Error fetching from TMDB:', error);
    res.status(500).json({ error: 'Failed to fetch from TMDB API', details: error.message });
  }
});

// Start dev server or serve static build
async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    console.log('Starting Express in DEVELOPMENT mode with Vite middleware...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    console.log('Starting Express in PRODUCTION mode...');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CineTrack server is running on http://0.0.0.0:${PORT}`);
  });
}

setupServer().catch((err) => {
  console.error('Failed to boot server:', err);
});
