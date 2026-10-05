'use strict';

require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();

// Configuration
const PORT = parseInt(process.env.PORT, 10) || 3000;
const ERP_MYAUTH = process.env.ERP_MYAUTH ? process.env.ERP_MYAUTH.trim() : '';
const ERP_ASP_NET_SESSION_ID = process.env.ERP_ASP_NET_SESSION_ID ? process.env.ERP_ASP_NET_SESSION_ID.trim() : '';

const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000; // 1 minute
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX, 10) || 30; // 30 requests per minute
const ERP_TIMEOUT_MS = parseInt(process.env.ERP_TIMEOUT_MS, 10) || 10000; // 10 seconds

// Security limits
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB max response size
const ERP_BASE_URL = 'https://erp.abes.ac.in/Services/ProfilePic.aspx';

// Disable fingerprinting
app.disable('x-powered-by');

// Trust proxy for accurate client IP resolution behind reverse proxies
app.set('trust proxy', 1);

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// CORS Middleware for API endpoints (allows external frontends e.g. React/Next.js/mobile)
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
app.use('/api', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// JSON body parser (if needed for API requests)
app.use(express.json());

// ============================================================================
// RATE LIMITING MIDDLEWARE (In-memory per-IP token/window limiter)
// ============================================================================
class InMemoryRateLimiter {
  constructor(windowMs, maxRequests) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.hits = new Map();

    // Periodically remove stale entries to avoid memory growth
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [ip, record] of this.hits.entries()) {
        if (now - record.startTime > this.windowMs) {
          this.hits.delete(ip);
        }
      }
    }, 60000);

    if (cleanupInterval.unref) {
      cleanupInterval.unref();
    }
  }

  middleware() {
    return (req, res, next) => {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      const now = Date.now();
      let record = this.hits.get(clientIp);

      if (!record || (now - record.startTime > this.windowMs)) {
        record = { count: 1, startTime: now };
        this.hits.set(clientIp, record);
      } else {
        record.count++;
      }

      const remaining = Math.max(0, this.maxRequests - record.count);
      const resetTimeSeconds = Math.ceil((record.startTime + this.windowMs - now) / 1000);

      res.setHeader('RateLimit-Limit', this.maxRequests);
      res.setHeader('RateLimit-Remaining', remaining);
      res.setHeader('RateLimit-Reset', resetTimeSeconds);

      if (record.count > this.maxRequests) {
        res.setHeader('Retry-After', resetTimeSeconds);
        return res.status(429).json({
          error: `Rate limit exceeded. Maximum ${this.maxRequests} requests per minute allowed. Please try again in ${resetTimeSeconds} seconds.`
        });
      }

      next();
    };
  }
}

const rateLimiter = new InMemoryRateLimiter(RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX);

// ============================================================================
// ROLL NUMBER VALIDATION
// ============================================================================
/**
 * Whitelist validation for roll number:
 * - Only letters (A-Z, a-z), numbers (0-9), hyphens (-), underscores (_)
 * - Length between 3 and 30 characters
 */
const ROLL_NUMBER_REGEX = /^[A-Za-z0-9_-]{3,30}$/;

function validateRollNumber(rollNumber) {
  if (!rollNumber || typeof rollNumber !== 'string') {
    return { valid: false, error: 'Roll number is required.' };
  }

  const trimmed = rollNumber.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Roll number cannot be empty.' };
  }

  if (trimmed.length < 3 || trimmed.length > 30) {
    return { valid: false, error: 'Roll number must be between 3 and 30 characters in length.' };
  }

  if (!ROLL_NUMBER_REGEX.test(trimmed)) {
    return {
      valid: false,
      error: 'Invalid roll number format. Only letters, numbers, hyphens, and underscores are allowed.'
    };
  }

  return { valid: true, value: trimmed };
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * Health check endpoint (does not leak any credentials)
 */
app.get('/api/health', (req, res) => {
  const myAuth = (process.env.ERP_MYAUTH || '').trim();
  const sessionId = (process.env.ERP_ASP_NET_SESSION_ID || '').trim();
  res.json({
    status: 'ok',
    sessionConfigured: Boolean(myAuth && sessionId),
    rateLimitMax: RATE_LIMIT_MAX,
    windowSeconds: RATE_LIMIT_WINDOW_MS / 1000
  });
});

/**
 * GET /api/profile/:rollNumber
 * Secure proxy to fetch the profile photo from ERP with authorized session
 */
app.get(['/api/profile/:rollNumber', '/api/profile/:rollNumber/json'], rateLimiter.middleware(), async (req, res) => {
  const { rollNumber } = req.params;

  // 1. Input Validation
  const validation = validateRollNumber(rollNumber);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const sanitizedRoll = validation.value;

  // 2. Check server-side ERP session configuration
  const myAuth = (process.env.ERP_MYAUTH || '').trim();
  const sessionId = (process.env.ERP_ASP_NET_SESSION_ID || '').trim();

  if (!myAuth || !sessionId) {
    console.error('[Config Error] ERP session credentials are missing in environment.');
    return res.status(500).json({
      error: 'Server is not configured with valid ERP session credentials. Please check server environment configuration.'
    });
  }

  // 3. Prepare ERP request
  const upstreamUrl = `${ERP_BASE_URL}?ID=${encodeURIComponent(sanitizedRoll)}`;
  const cookieHeader = `MyAuth=${myAuth}; ASP.NET_SessionId=${sessionId}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ERP_TIMEOUT_MS);

  try {
    console.log(`[ERP Request] Initiating profile fetch for ID: ${sanitizedRoll}`);

    // We set redirect to 'manual' so we can catch 302 redirects to Login.aspx directly
    const upstreamRes = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        'Cookie': cookieHeader,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://erp.abes.ac.in/',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      },
      redirect: 'manual',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const status = upstreamRes.status;
    const location = upstreamRes.headers.get('location') || '';
    const contentType = (upstreamRes.headers.get('content-type') || '').toLowerCase();

    console.log(`[ERP Response] Status: ${status}, Content-Type: ${contentType || 'none'}`);

    // Check for session expiration redirects (301/302 to Login page)
    if (status === 301 || status === 302) {
      if (location.toLowerCase().includes('login')) {
        console.warn(`[Auth Warning] ERP redirected to login page (${location}). Session has expired or credentials are invalid.`);
        return res.status(401).json({
          error: 'ERP session has expired or is invalid. Please refresh the authorized ERP cookies on the server.'
        });
      }
      return res.status(502).json({
        error: `ERP returned unexpected redirect to: ${location}`
      });
    }

    // Direct HTTP authentication errors from ERP
    if (status === 401 || status === 403) {
      console.warn(`[Auth Warning] ERP returned status ${status}.`);
      return res.status(401).json({
        error: 'ERP session is unauthorized or has expired. Please update credentials.'
      });
    }

    // Resource not found on ERP
    if (status === 404) {
      return res.status(404).json({
        error: `Profile image not found for roll number: ${sanitizedRoll}`
      });
    }

    // Upstream server errors
    if (status >= 500) {
      console.error(`[ERP Error] Upstream server error status: ${status}`);
      return res.status(502).json({
        error: `ABES ERP server encountered an error (HTTP ${status}). Please try again later.`
      });
    }

    // If unexpected non-200 status
    if (status !== 200) {
      return res.status(502).json({
        error: `ERP returned unexpected status code: ${status}`
      });
    }

    // Status is 200: Validate Content-Type
    // Expected Content-Types for photos: image/jpeg, image/png, image/gif, image/webp
    const isImage = contentType.startsWith('image/') ||
                    contentType.includes('jpeg') ||
                    contentType.includes('png') ||
                    contentType.includes('webp');

    if (!isImage) {
      // ERP returned 200 with HTML or non-image content (likely an error or login page rendered as 200)
      console.warn(`[Validation Error] ERP returned non-image content type: ${contentType}`);
      const bodySnippet = (await upstreamRes.text()).slice(0, 1000);
      if (bodySnippet.toLowerCase().includes('login') || bodySnippet.toLowerCase().includes('object moved')) {
        return res.status(401).json({
          error: 'ERP session has expired or is invalid. Please re-authenticate and update credentials.'
        });
      }
      return res.status(502).json({
        error: 'ERP returned an unexpected response format instead of an image.'
      });
    }

    // Read image buffer
    const arrayBuffer = await upstreamRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate response size
    if (buffer.length === 0) {
      return res.status(404).json({
        error: `No image data returned for roll number: ${sanitizedRoll}`
      });
    }

    if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
      console.error(`[Security Warning] Image size exceeded maximum limit: ${buffer.length} bytes`);
      return res.status(502).json({
        error: 'Profile image returned by ERP exceeds maximum permissible size.'
      });
    }

    // Send image to client (supports raw binary image or JSON metadata + Base64 dataUrl)
    const isJsonRequested = req.path.endsWith('/json') || 
                            (req.query.format && req.query.format.toLowerCase() === 'json');
    const cleanContentType = contentType.split(';')[0].trim();

    if (isJsonRequested) {
      const base64Data = buffer.toString('base64');
      return res.status(200).json({
        success: true,
        rollNumber: sanitizedRoll,
        contentType: cleanContentType,
        sizeBytes: buffer.length,
        base64: base64Data,
        dataUrl: `data:${cleanContentType};base64,${base64Data}`
      });
    }

    res.setHeader('Content-Type', cleanContentType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    return res.status(200).send(buffer);

  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      console.error(`[Timeout] Request to ERP timed out after ${ERP_TIMEOUT_MS}ms for roll number: ${sanitizedRoll}`);
      return res.status(504).json({
        error: `ERP request timed out after ${ERP_TIMEOUT_MS / 1000} seconds. The upstream server may be offline or unreachable.`
      });
    }

    console.error(`[Fetch Error] Failed to retrieve ERP profile: ${err.message}`);
    return res.status(502).json({
      error: 'Failed to communicate with ABES ERP server. Please try again later.'
    });
  }
});

// ============================================================================
// SERVE FRONTEND STATIC FILES
// ============================================================================
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all for API 404s
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// Single Page Application fallback to index.html for UI routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global Error Handler (prevents leaking internal stack traces)
app.use((err, req, res, next) => {
  console.error('[Internal Server Error]', err && err.message ? err.message : 'Unknown error');
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ error: 'An unexpected internal server error occurred.' });
});

// Start server only when executed directly (allows clean testing & importing)
let server = null;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` ABES Student Profile Viewer running on port ${PORT}`);
    console.log(` Local access: http://localhost:${PORT}`);
    console.log(` ERP Session configured: ${Boolean(ERP_MYAUTH && ERP_ASP_NET_SESSION_ID) ? 'YES' : 'NO'}`);
    console.log(` Rate Limit: ${RATE_LIMIT_MAX} req / ${RATE_LIMIT_WINDOW_MS / 1000}s per IP`);
    console.log(`====================================================`);
  });
}

module.exports = { app, server, validateRollNumber, InMemoryRateLimiter };
