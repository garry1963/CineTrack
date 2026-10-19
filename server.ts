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

// Simple in-memory cache for TVmaze API proxy
const tvmazeCache = new Map<string, CacheEntry>();
const TVMAZE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache for TVmaze responses

// Allowed TVmaze endpoint prefixes for security
const ALLOWED_TVMAZE_PREFIXES = [
  '/shows',
  '/search',
  '/singlesearch',
  '/schedule',
  '/seasons',
  '/episodes',
  '/lookup',
  '/people',
  '/updates'
];

// Middleware to parse JSON bodies
app.use(express.json());

// API health endpoint
app.get('/api/health', (req, res) => {
  const hasTmdbKey = (!!process.env.TMDB_API_KEY && process.env.TMDB_API_KEY !== 'YOUR_TMDB_API_KEY') ||
                     (!!process.env.VITE_TMDB_API_KEY && process.env.VITE_TMDB_API_KEY !== 'YOUR_TMDB_API_KEY') ||
                     (!!process.env.REACT_APP_TMDB_API_KEY && process.env.REACT_APP_TMDB_API_KEY !== 'YOUR_TMDB_API_KEY');
  const hasTvmazeKey = !!process.env.TVMAZE_API_KEY && process.env.TVMAZE_API_KEY !== 'YOUR_TVMAZE_API_KEY';

  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    hasTmdbKey,
    hasTvmazeKey,
    providers: {
      tmdb: { available: true, secured: true },
      tvmaze: { available: true, secured: true }
    }
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

// Secure TVmaze API Proxy
app.get('/api/tvmaze', async (req, res) => {
  const { path: tvmazePath, ...rest } = req.query;

  if (!tvmazePath || typeof tvmazePath !== 'string') {
    return res.status(400).json({ 
      error: 'Path parameter is required (e.g. ?path=/shows/169 or ?path=/search/shows)' 
    });
  }

  // Security check: path must begin with '/' and not contain '..' or external protocols
  if (!tvmazePath.startsWith('/') || tvmazePath.includes('..') || tvmazePath.includes('://')) {
    return res.status(400).json({ error: 'Invalid path parameter format' });
  }

  // Security check: endpoint must start with an allowed TVmaze prefix
  const isAllowed = ALLOWED_TVMAZE_PREFIXES.some(prefix => 
    tvmazePath === prefix || tvmazePath.startsWith(`${prefix}/`) || tvmazePath.startsWith(`${prefix}?`)
  );
  if (!isAllowed) {
    return res.status(403).json({ 
      error: 'Requested TVmaze endpoint is not permitted for proxying',
      path: tvmazePath
    });
  }

  // Check optional TVmaze API key/token (from server environment or secure client header)
  let tvmazeKey = process.env.TVMAZE_API_KEY || process.env.VITE_TVMAZE_API_KEY;
  const clientKey = req.headers['x-tvmaze-key'] || req.query.user_tvmaze_key;
  if (clientKey && typeof clientKey === 'string' && clientKey !== 'YOUR_TVMAZE_API_KEY' && clientKey.trim() !== '') {
    tvmazeKey = clientKey;
  }

  // Construct TVmaze URL with query parameters
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined && key !== 'bypassCache' && key !== 'user_tvmaze_key') {
      if (Array.isArray(value)) {
        for (const item of value) {
          searchParams.append(key, String(item));
        }
      } else {
        searchParams.append(key, String(value));
      }
    }
  }

  const queryString = searchParams.toString();
  const fullRelativePath = queryString ? `${tvmazePath}?${queryString}` : tvmazePath;
  const cacheKey = `tvmaze:${fullRelativePath}`;

  // Check cache (unless client requests refresh via bypass)
  const isBypass = req.query.bypassCache === 'true';
  if (!isBypass && tvmazeCache.has(cacheKey)) {
    const entry = tvmazeCache.get(cacheKey)!;
    if (Date.now() < entry.expiresAt) {
      return res.json(entry.data);
    }
    tvmazeCache.delete(cacheKey);
  }

  try {
    const tvmazeUrl = `https://api.tvmaze.com${fullRelativePath}`;
    const headers: Record<string, string> = {
      'User-Agent': 'CineTrack-Media-App/1.0 (+https://cintrack.app)',
      'Accept': 'application/json'
    };

    if (tvmazeKey && tvmazeKey !== 'YOUR_TVMAZE_API_KEY') {
      headers['Authorization'] = `Bearer ${tvmazeKey}`;
    }

    const tvmazeResponse = await fetch(tvmazeUrl, { headers });

    if (!tvmazeResponse.ok) {
      const errText = await tvmazeResponse.text();
      return res.status(tvmazeResponse.status).json({
        error: `TVmaze API responded with status ${tvmazeResponse.status}`,
        details: errText
      });
    }

    const data = await tvmazeResponse.json();

    // Cache the response
    tvmazeCache.set(cacheKey, {
      data,
      expiresAt: Date.now() + TVMAZE_CACHE_TTL
    });

    res.json(data);
  } catch (error: any) {
    console.error('Error proxying TVmaze request:', error);
    res.status(500).json({ error: 'Failed to fetch from TVmaze API', details: error.message });
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
