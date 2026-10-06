'use strict';

require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();

// Configuration
const PORT = parseInt(process.env.PORT, 10) || 3000;
const ERP_MYAUTH = process.env.ERP_MYAUTH ? process.env.ERP_MYAUTH.trim() : '';
const ERP_ASP_NET_SESSION_ID = process.env.ERP_ASP_NET_SESSION_ID ? process.env.ERP_ASP_NET_SESSION_ID.trim() : '';

const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000; // 1 minute
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX, 10) || 30; // 30 requests per minute
const ERP_TIMEOUT_MS = parseInt(process.env.ERP_TIMEOUT_MS, 10) || 10000; // 10 seconds
const ERP_KEEPALIVE_INTERVAL_MINUTES = Math.max(1, parseInt(process.env.ERP_KEEPALIVE_INTERVAL_MINUTES, 10) || 10);
const ERP_KEEPALIVE_URL = process.env.ERP_KEEPALIVE_URL || 'https://erp.abes.ac.in/Home/Student/Default.aspx';
const ERP_KEEPALIVE_STARTUP_DELAY_MS = parseInt(process.env.ERP_KEEPALIVE_STARTUP_DELAY_MS, 10) || 30000; // 30 seconds default

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, x-api-key');
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
// API KEY AUTHENTICATION MIDDLEWARE
// ============================================================================
function apiKeyAuth(req, res, next) {
  const configuredKey = (process.env.API_KEY || '').trim();

  // If no API_KEY is set in environment, open access is allowed
  if (!configuredKey) {
    return next();
  }

  // Allow same-origin requests from the built-in web frontend
  const isSameOrigin = req.headers['sec-fetch-site'] === 'same-origin' ||
                       (req.headers.referer && req.headers.host && req.headers.referer.includes(req.headers.host));
  if (isSameOrigin && !req.headers['x-api-key'] && !req.headers['authorization'] && !req.query.api_key && !req.query.key) {
    return next();
  }

  // Extract client-supplied key from header or query parameter
  let clientKey = req.headers['x-api-key'] ||
                  (req.headers['authorization'] ? req.headers['authorization'].replace(/^Bearer\s+/i, '').trim() : '') ||
                  req.query.api_key ||
                  req.query.key;

  if (typeof clientKey === 'string') {
    clientKey = clientKey.trim();
  }

  if (!clientKey) {
    return res.status(401).json({
      error: 'API key is required. Provide it via "x-api-key" header, "Authorization: Bearer <key>", or "?api_key=<key>" query parameter.'
    });
  }

  // Support multiple valid keys separated by comma for easy key rotation
  const validKeys = configuredKey.split(',').map(k => k.trim()).filter(Boolean);
  const isValid = validKeys.some(validKey => {
    if (clientKey.length !== validKey.length) return false;
    return crypto.timingSafeEqual(Buffer.from(clientKey), Buffer.from(validKey));
  });

  if (!isValid) {
    return res.status(403).json({
      error: 'Invalid API key provided. Access denied.'
    });
  }

  next();
}

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
// ERP SESSION STATE & KEEP-ALIVE MANAGEMENT
// ============================================================================
let erpSessionStatus = 'unknown'; // 'unknown' | 'active' | 'expired' | 'temporarily_unavailable'
let keepAliveInProgress = false;
let lastKeepAliveTime = null;
let lastKnownCredentialsHash = '';

/**
 * Detect if credentials in process.env have changed.
 * If credentials changed, reset 'expired' state to 'unknown' so new credentials are tried.
 */
function checkCredentialsChanged(myAuth, sessionId) {
  const currentHash = `${myAuth}::${sessionId}`;
  if (currentHash !== lastKnownCredentialsHash) {
    lastKnownCredentialsHash = currentHash;
    if (erpSessionStatus === 'expired') {
      erpSessionStatus = 'unknown';
    }
  }
}

/**
 * Dedicated backend keep-alive function to keep the ERP session active.
 * Makes a normal, lightweight, authorized request using existing server credentials.
 * Never bypasses authentication or modifies cookies.
 */
async function keepErpSessionAlive() {
  // Concurrency protection: skip execution if one is already running
  if (keepAliveInProgress) {
    console.log('[ERP KEEPALIVE] Another keep-alive request is currently in progress. Skipping.');
    return erpSessionStatus;
  }

  const myAuth = (process.env.ERP_MYAUTH || '').trim();
  const sessionId = (process.env.ERP_ASP_NET_SESSION_ID || '').trim();

  if (!myAuth || !sessionId) {
    erpSessionStatus = 'unknown';
    console.log('[ERP KEEPALIVE] Session credentials not configured in environment.');
    return erpSessionStatus;
  }

  checkCredentialsChanged(myAuth, sessionId);

  keepAliveInProgress = true;
  console.log('[ERP KEEPALIVE] Started');

  const controller = new AbortController();
  const timeoutMs = parseInt(process.env.ERP_TIMEOUT_MS, 10) || ERP_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const keepAliveUrl = process.env.ERP_KEEPALIVE_URL || ERP_KEEPALIVE_URL;

  try {
    const cookieHeader = `MyAuth=${myAuth}; ASP.NET_SessionId=${sessionId}`;
    const upstreamRes = await fetch(keepAliveUrl, {
      method: 'GET',
      headers: {
        'Cookie': cookieHeader,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://erp.abes.ac.in/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      redirect: 'manual',
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    lastKeepAliveTime = Date.now();

    const status = upstreamRes.status;
    const location = (upstreamRes.headers.get('location') || '').toLowerCase();

    // 1. Session expiration redirects (301/302 to Login page)
    if (status === 301 || status === 302) {
      if (location.includes('login')) {
        erpSessionStatus = 'expired';
        console.warn('[ERP KEEPALIVE] ERP session expired');
        return erpSessionStatus;
      }
      erpSessionStatus = 'temporarily_unavailable';
      console.warn(`[ERP KEEPALIVE] Upstream returned unexpected redirect: ${location}`);
      return erpSessionStatus;
    }

    // 2. Direct HTTP 401 / 403
    if (status === 401 || status === 403) {
      erpSessionStatus = 'expired';
      console.warn(`[ERP KEEPALIVE] ERP session expired (status ${status})`);
      return erpSessionStatus;
    }

    // 3. Upstream 5xx errors
    if (status >= 500) {
      erpSessionStatus = 'temporarily_unavailable';
      console.error(`[ERP KEEPALIVE] Upstream error - status ${status}`);
      return erpSessionStatus;
    }

    // 4. HTTP 200: Check content
    if (status === 200) {
      console.log('[ERP KEEPALIVE] Success - status 200');
      const text = await upstreamRes.text();
      const lower = text.toLowerCase();

      // Check whether it is a login page rendered with HTTP 200
      const isLoginPage = lower.includes('<title>login') ||
                          lower.includes('txtusername') ||
                          lower.includes('login.aspx') ||
                          lower.includes('name="txtpassword"') ||
                          lower.includes('object moved to');

      if (isLoginPage) {
        erpSessionStatus = 'expired';
        console.warn('[ERP KEEPALIVE] ERP session expired');
      } else {
        erpSessionStatus = 'active';
        console.log('[ERP KEEPALIVE] ERP session appears active');
      }
      return erpSessionStatus;
    }

    erpSessionStatus = 'temporarily_unavailable';
    console.warn(`[ERP KEEPALIVE] Unexpected status code: ${status}`);
    return erpSessionStatus;

  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      erpSessionStatus = 'temporarily_unavailable';
      console.error('[ERP KEEPALIVE] Timeout');
    } else {
      erpSessionStatus = 'temporarily_unavailable';
      console.error(`[ERP KEEPALIVE] Upstream error: ${err.message}`);
    }
    return erpSessionStatus;
  } finally {
    keepAliveInProgress = false;
  }
}

let keepAliveTimer = null;
let keepAliveInterval = null;

function startKeepAliveScheduler() {
  const myAuth = (process.env.ERP_MYAUTH || '').trim();
  const sessionId = (process.env.ERP_ASP_NET_SESSION_ID || '').trim();

  if (!myAuth || !sessionId) {
    console.log('[ERP KEEPALIVE] Session credentials not configured in environment. Scheduler idle.');
    return;
  }

  const intervalMinutes = Math.max(1, parseInt(process.env.ERP_KEEPALIVE_INTERVAL_MINUTES, 10) || 10);
  const startupDelayMs = parseInt(process.env.ERP_KEEPALIVE_STARTUP_DELAY_MS, 10) || 30000;

  console.log(`[ERP KEEPALIVE] Scheduler initialized. First run in ${startupDelayMs / 1000}s, interval ${intervalMinutes}m.`);

  keepAliveTimer = setTimeout(async () => {
    await keepErpSessionAlive();
    keepAliveInterval = setInterval(keepErpSessionAlive, intervalMinutes * 60 * 1000);
    if (keepAliveInterval.unref) keepAliveInterval.unref();
  }, startupDelayMs);

  if (keepAliveTimer.unref) keepAliveTimer.unref();
}

function stopKeepAliveScheduler() {
  if (keepAliveTimer) clearTimeout(keepAliveTimer);
  if (keepAliveInterval) clearInterval(keepAliveInterval);
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
  checkCredentialsChanged(myAuth, sessionId);

  res.json({
    status: 'ok',
    erpSession: erpSessionStatus,
    sessionConfigured: Boolean(myAuth && sessionId),
    apiKeyRequired: Boolean((process.env.API_KEY || '').trim()),
    rateLimitMax: RATE_LIMIT_MAX,
    windowSeconds: RATE_LIMIT_WINDOW_MS / 1000,
    keepAliveIntervalMinutes: ERP_KEEPALIVE_INTERVAL_MINUTES,
    lastKeepAlive: lastKeepAliveTime ? new Date(lastKeepAliveTime).toISOString() : null
  });
});

/**
 * GET /api/profile/:rollNumber
 * GET /api/profile/:rollNumber/json
 * Secure proxy to fetch the profile photo from ERP with authorized session
 */
app.get(['/api/profile/:rollNumber', '/api/profile/:rollNumber/json'], rateLimiter.middleware(), apiKeyAuth, async (req, res) => {
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

  checkCredentialsChanged(myAuth, sessionId);

  // If the session is already known to be expired, reject fast with clear error
  if (erpSessionStatus === 'expired') {
    console.warn(`[Profile Request] Blocked for ID ${sanitizedRoll}: ERP session is known to be expired.`);
    return res.status(401).json({
      error: 'ERP session has expired or is invalid. Please refresh the authorized ERP cookies on the server.'
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
        erpSessionStatus = 'expired';
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
      erpSessionStatus = 'expired';
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
        erpSessionStatus = 'expired';
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

    // Mark ERP session as confirmed active since a verified image was returned
    erpSessionStatus = 'active';

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
    console.log(` Keep-Alive Interval: ${ERP_KEEPALIVE_INTERVAL_MINUTES} minutes`);
    console.log(`====================================================`);
    startKeepAliveScheduler();
  });
}

module.exports = {
  app,
  server,
  validateRollNumber,
  InMemoryRateLimiter,
  apiKeyAuth,
  keepErpSessionAlive,
  startKeepAliveScheduler,
  stopKeepAliveScheduler,
  getErpSessionStatus: () => erpSessionStatus,
  setErpSessionStatus: (status) => { erpSessionStatus = status; },
  checkCredentialsChanged
};
