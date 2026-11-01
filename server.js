'use strict';

require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();

const PORT = parseInt(process.env.PORT, 10) || 3000;
const ERP_BASE_URL = process.env.ERP_BASE_URL || 'https://erp.abes.ac.in/Services/ProfilePic.aspx';
const ERP_LOGIN_URL = process.env.ERP_LOGIN_URL || 'https://erp.abes.ac.in/Login.aspx';
const ERP_KEEPALIVE_URL = process.env.ERP_KEEPALIVE_URL || 'https://erp.abes.ac.in/Home/Student/Default.aspx';

const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000;
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX, 10) || 30;
const MAX_IMAGE_SIZE_BYTES = parseInt(process.env.MAX_IMAGE_SIZE_BYTES, 10) || 5 * 1024 * 1024;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

function parseTimeoutMs(val) {
  const parsed = parseInt(val, 10);
  if (isNaN(parsed) || parsed <= 0) return 15000;
  if (parsed < 100) return parsed * 1000;
  return Math.max(10000, parsed);
}

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self';"
  );
  next();
});

app.use('/api', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, x-api-key');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Only GET requests are accepted.' });
  }
  next();
});

app.use(express.json());

class InMemoryRateLimiter {
  constructor(windowMs, maxRequests) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.hits = new Map();

    const cleanup = setInterval(() => {
      const now = Date.now();
      for (const [ip, record] of this.hits.entries()) {
        if (now - record.startTime > this.windowMs) this.hits.delete(ip);
      }
    }, 60000);
    if (cleanup.unref) cleanup.unref();
  }

  middleware() {
    return (req, res, next) => {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      const now = Date.now();
      let record = this.hits.get(clientIp);

      if (!record || now - record.startTime > this.windowMs) {
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

function apiKeyAuth(req, res, next) {
  const configuredKey = (process.env.API_KEY || '').trim();
  if (!configuredKey) return next();

  const isSameOrigin = req.headers['sec-fetch-site'] === 'same-origin' ||
    (req.headers.referer && req.headers.host && req.headers.referer.includes(req.headers.host));
  if (isSameOrigin && !req.headers['x-api-key'] && !req.headers['authorization'] && !req.query.api_key && !req.query.key) {
    return next();
  }

  let clientKey = req.headers['x-api-key'] ||
    (req.headers['authorization'] ? req.headers['authorization'].replace(/^Bearer\s+/i, '').trim() : '') ||
    req.query.api_key ||
    req.query.key;

  if (typeof clientKey === 'string') clientKey = clientKey.trim();

  if (!clientKey) {
    return res.status(401).json({
      error: 'API key is required. Provide it via "x-api-key" header, "Authorization: Bearer <key>", or "?api_key=<key>" query parameter.'
    });
  }

  const validKeys = configuredKey.split(',').map(k => k.trim()).filter(Boolean);
  const isValid = validKeys.some(validKey => {
    if (clientKey.length !== validKey.length) return false;
    return crypto.timingSafeEqual(Buffer.from(clientKey), Buffer.from(validKey));
  });

  if (!isValid) {
    return res.status(403).json({ error: 'Invalid API key provided. Access denied.' });
  }
  next();
}

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

class ErpCookieJar {
  constructor() {
    this.cookies = new Map();
  }

  set(name, value, options = {}) {
    if (!name || typeof name !== 'string') return;
    const cleanName = name.trim();
    if (!value || (options.expires && options.expires < Date.now()) || options.maxAge === 0) {
      this.cookies.delete(cleanName);
      return;
    }
    this.cookies.set(cleanName, {
      value: String(value).trim(),
      domain: options.domain || '',
      path: options.path || '/',
      expires: options.expires || null
    });
  }

  get(name) {
    if (!name) return null;
    const entry = this.cookies.get(name.trim());
    if (!entry) return null;
    if (entry.expires && entry.expires < Date.now()) {
      this.cookies.delete(name.trim());
      return null;
    }
    return entry.value;
  }

  has(name) {
    return Boolean(this.get(name));
  }

  storeCookies(setCookieHeaders, requestUrl) {
    if (!setCookieHeaders) return;
    const headerList = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    for (const header of headerList) {
      if (!header || typeof header !== 'string') continue;
      const parts = header.split(';').map(p => p.trim());
      if (parts.length === 0) continue;
      const [nameVal, ...attrList] = parts;
      const eqIdx = nameVal.indexOf('=');
      if (eqIdx === -1) continue;
      const name = nameVal.slice(0, eqIdx).trim();
      const value = nameVal.slice(eqIdx + 1).trim();

      const options = {};
      for (const attr of attrList) {
        const [k, v] = attr.split('=').map(s => (s ? s.trim() : ''));
        const lowerK = k.toLowerCase();
        if (lowerK === 'expires' && v) {
          const expMs = new Date(v).getTime();
          if (!isNaN(expMs)) options.expires = expMs;
        } else if (lowerK === 'max-age' && v) {
          const maxAgeSec = parseInt(v, 10);
          if (!isNaN(maxAgeSec)) options.expires = Date.now() + maxAgeSec * 1000;
        } else if (lowerK === 'path' && v) {
          options.path = v;
        } else if (lowerK === 'domain' && v) {
          options.domain = v;
        }
      }
      this.set(name, value, options);
    }
  }

  getCookieString() {
    const pairs = [];
    const now = Date.now();
    for (const [name, entry] of this.cookies.entries()) {
      if (entry.expires && entry.expires < now) {
        this.cookies.delete(name);
        continue;
      }
      pairs.push(`${name}=${entry.value}`);
    }
    return pairs.join('; ');
  }

  clear() {
    this.cookies.clear();
  }

  loadFromEnv() {
    const myAuth = (process.env.ERP_MYAUTH || '').trim();
    const sessionId = (process.env.ERP_ASP_NET_SESSION_ID || '').trim();
    if (myAuth) this.set('MyAuth', myAuth, { path: '/' });
    if (sessionId) this.set('ASP.NET_SessionId', sessionId, { path: '/' });
  }
}

const erpCookieJar = new ErpCookieJar();

let erpSessionStatus = 'unknown';
let keepAliveInProgress = false;
let lastKeepAliveTime = null;
let lastKnownCredentialsHash = '';
let activeLoginPromise = null;

function checkCredentialsChanged(myAuth, sessionId) {
  const currentHash = `${myAuth}::${sessionId}::${process.env.ERP_USERNAME || ''}`;
  if (currentHash !== lastKnownCredentialsHash) {
    lastKnownCredentialsHash = currentHash;
    if (erpSessionStatus === 'expired') erpSessionStatus = 'unknown';
  }
}

function syncCredentialsToJar() {
  const myAuth = (process.env.ERP_MYAUTH || '').trim();
  const sessionId = (process.env.ERP_ASP_NET_SESSION_ID || '').trim();
  checkCredentialsChanged(myAuth, sessionId);

  if (myAuth && !erpCookieJar.has('MyAuth')) {
    erpCookieJar.set('MyAuth', myAuth, { path: '/' });
  }
  if (sessionId && !erpCookieJar.has('ASP.NET_SessionId')) {
    erpCookieJar.set('ASP.NET_SessionId', sessionId, { path: '/' });
  }
}

function isTimeoutOrAbortError(err) {
  if (!err) return false;
  return err.name === 'AbortError' ||
         err.name === 'TimeoutError' ||
         err.code === 'ABORT_ERR' ||
         Boolean(err.cause && (err.cause.name === 'AbortError' || err.cause.name === 'TimeoutError' || err.cause.code === 'ABORT_ERR')) ||
         (typeof err.message === 'string' && (err.message.includes('aborted') || err.message.includes('timeout')));
}

async function checkErpSession() {
  syncCredentialsToJar();
  const keepAliveUrl = process.env.ERP_KEEPALIVE_URL || ERP_KEEPALIVE_URL;
  const cookieString = erpCookieJar.getCookieString(keepAliveUrl);

  if (!cookieString || (!erpCookieJar.has('MyAuth') && !erpCookieJar.has('ASP.NET_SessionId'))) {
    erpSessionStatus = 'expired';
    return { authenticated: false, status: 'expired', reason: 'no_session_cookies' };
  }

  const controller = new AbortController();
  const timeoutMs = parseTimeoutMs(process.env.ERP_TIMEOUT_MS);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const upstreamRes = await fetch(keepAliveUrl, {
      method: 'GET',
      headers: {
        'Cookie': cookieString,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://erp.abes.ac.in/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      redirect: 'manual',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const setCookies = upstreamRes.headers.getSetCookie ? upstreamRes.headers.getSetCookie() : [upstreamRes.headers.get('set-cookie')];
    erpCookieJar.storeCookies(setCookies, keepAliveUrl);

    const status = upstreamRes.status;
    const location = (upstreamRes.headers.get('location') || '').toLowerCase();

    if (status === 301 || status === 302) {
      if (location.includes('login')) {
        erpSessionStatus = 'expired';
        return { authenticated: false, status: 'expired', reason: 'redirect_to_login' };
      }
      erpSessionStatus = 'temporarily_unavailable';
      return { authenticated: false, status: 'temporarily_unavailable', reason: 'unexpected_redirect' };
    }

    if (status === 401 || status === 403) {
      erpSessionStatus = 'expired';
      return { authenticated: false, status: 'expired', reason: 'unauthorized' };
    }

    if (status >= 500) {
      erpSessionStatus = 'temporarily_unavailable';
      return { authenticated: false, status: 'temporarily_unavailable', reason: 'upstream_error' };
    }

    if (status === 200) {
      const text = await upstreamRes.text();
      const lower = text.toLowerCase();
      const isLoginPage = lower.includes('<title>login') ||
                          lower.includes('txtusername') ||
                          (lower.includes('txtuser') && lower.includes('login.aspx')) ||
                          lower.includes('name="txtpassword"') ||
                          lower.includes('object moved to');

      if (isLoginPage) {
        erpSessionStatus = 'expired';
        return { authenticated: false, status: 'expired', reason: 'login_form_returned' };
      }
      erpSessionStatus = 'active';
      return { authenticated: true, status: 'active' };
    }

    erpSessionStatus = 'temporarily_unavailable';
    return { authenticated: false, status: 'temporarily_unavailable', reason: `status_${status}` };
  } catch (err) {
    clearTimeout(timeoutId);
    erpSessionStatus = 'temporarily_unavailable';
    return {
      authenticated: false,
      status: 'temporarily_unavailable',
      reason: isTimeoutOrAbortError(err) ? 'timeout' : 'network_error'
    };
  }
}

async function executeErpLoginFlow() {
  const username = (process.env.ERP_USERNAME || '').trim();
  const password = (process.env.ERP_PASSWORD || '').trim();
  const myAuth = (process.env.ERP_MYAUTH || '').trim();
  const sessionId = (process.env.ERP_ASP_NET_SESSION_ID || '').trim();

  if (!username && !password && !myAuth && !sessionId) {
    return {
      success: false,
      code: 'ERP_CREDENTIALS_MISSING',
      message: 'Server is not configured with ERP credentials (ERP_USERNAME/ERP_PASSWORD or ERP_MYAUTH/ERP_ASP_NET_SESSION_ID).'
    };
  }

  if (username && password) {
    const loginUrl = process.env.ERP_LOGIN_URL || 'https://erp.abes.ac.in/Login.aspx';
    const controller = new AbortController();
    const timeoutMs = parseTimeoutMs(process.env.ERP_TIMEOUT_MS);
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const getRes = await fetch(loginUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        signal: controller.signal
      });

      const getCookies = getRes.headers.getSetCookie ? getRes.headers.getSetCookie() : [getRes.headers.get('set-cookie')];
      erpCookieJar.storeCookies(getCookies, loginUrl);

      const html = await getRes.text();
      const vsMatch = html.match(/name=["']__VIEWSTATE["'][^>]*value=["']([^"']*)["']/i);
      const vsgMatch = html.match(/name=["']__VIEWSTATEGENERATOR["'][^>]*value=["']([^"']*)["']/i);
      const evMatch = html.match(/name=["']__EVENTVALIDATION["'][^>]*value=["']([^"']*)["']/i);

      if (!vsMatch) {
        return { success: false, code: 'ERP_LOGIN_SCRAPE_FAILED', message: 'Could not parse ERP Login page.' };
      }

      try {
        const typeUrl = loginUrl.replace(/Login\.aspx.*$/i, 'Login.aspx/GetUserLoginType');
        const typeRes = await fetch(typeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Cookie': erpCookieJar.getCookieString(loginUrl)
          },
          body: JSON.stringify({ UserID: username }),
          signal: controller.signal
        });
        if (typeRes.ok) {
          const typeData = await typeRes.json();
          const userType = typeData.d;
          const isDirectStaff = userType === 'School' || userType === 'school' || userType === 'EventAdmin';
          if (!isDirectStaff && userType) {
            return {
              success: false,
              code: 'ERP_CHALLENGE_REQUIRED',
              message: 'ABES ERP requires OTP and reCAPTCHA challenge for student accounts. Please set ERP_MYAUTH and ERP_ASP_NET_SESSION_ID.'
            };
          }
        }
      } catch (e) {}

      const params = new URLSearchParams();
      params.append('__EVENTTARGET', '');
      params.append('__EVENTARGUMENT', '');
      params.append('__VIEWSTATE', vsMatch[1]);
      if (vsgMatch) params.append('__VIEWSTATEGENERATOR', vsgMatch[1]);
      if (evMatch) params.append('__EVENTVALIDATION', evMatch[1]);
      params.append('txtuser', username);
      params.append('txtUserName', username);
      params.append('txtPassword', password);
      params.append('txtuserPassword', '');
      params.append('btnStaff', 'Login');
      params.append('btnSubmit', 'Login');

      const cookieStr = erpCookieJar.getCookieString(loginUrl);
      const postRes = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Cookie': cookieStr,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Referer': loginUrl,
          'Origin': 'https://erp.abes.ac.in'
        },
        body: params.toString(),
        redirect: 'manual',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const postCookies = postRes.headers.getSetCookie ? postRes.headers.getSetCookie() : [postRes.headers.get('set-cookie')];
      erpCookieJar.storeCookies(postCookies, loginUrl);

      const postStatus = postRes.status;
      const postLocation = (postRes.headers.get('location') || '').toLowerCase();
      const postBody = await postRes.text();

      if (postBody.toLowerCase().includes('otp') || postBody.toLowerCase().includes('recaptcha')) {
        erpSessionStatus = 'expired';
        return {
          success: false,
          code: 'ERP_CHALLENGE_REQUIRED',
          message: 'ABES ERP requires OTP or reCAPTCHA challenge. Manual authorization required.'
        };
      }

      if (postStatus === 302 || postStatus === 301) {
        if (!postLocation.includes('login')) {
          const sessionCheck = await checkErpSession();
          if (sessionCheck.authenticated) {
            erpSessionStatus = 'active';
            return { success: true, code: 'LOGIN_SUCCESS' };
          }
        }
      }

      if (erpCookieJar.has('MyAuth') && erpCookieJar.has('ASP.NET_SessionId')) {
        erpSessionStatus = 'active';
        return { success: true, code: 'LOGIN_SUCCESS' };
      }

      erpSessionStatus = 'expired';
      return { success: false, code: 'ERP_LOGIN_FAILED', message: 'ERP login failed. Please verify credentials.' };
    } catch (err) {
      clearTimeout(timeoutId);
      return {
        success: false,
        code: isTimeoutOrAbortError(err) ? 'ERP_TIMEOUT' : 'ERP_UNAVAILABLE',
        message: err.message
      };
    }
  }

  syncCredentialsToJar();
  const sessionCheck = await checkErpSession();
  if (sessionCheck.authenticated) {
    return { success: true, code: 'SESSION_RESTORED' };
  }
  return {
    success: false,
    code: 'ERP_SESSION_ESTABLISHMENT_FAILED',
    message: 'ERP session establishment failed. Configured ERP session cookies are expired or invalid.'
  };
}

function performErpLogin() {
  if (activeLoginPromise) return activeLoginPromise;
  activeLoginPromise = (async () => {
    try {
      return await executeErpLoginFlow();
    } finally {
      activeLoginPromise = null;
    }
  })();
  return activeLoginPromise;
}

async function keepErpSessionAlive() {
  if (keepAliveInProgress) return erpSessionStatus;
  const hasCredentials = Boolean(
    (process.env.ERP_USERNAME && process.env.ERP_PASSWORD) ||
    (process.env.ERP_MYAUTH && process.env.ERP_ASP_NET_SESSION_ID) ||
    erpCookieJar.has('MyAuth') || erpCookieJar.has('ASP.NET_SessionId')
  );

  if (!hasCredentials) {
    erpSessionStatus = 'unknown';
    return erpSessionStatus;
  }

  keepAliveInProgress = true;
  try {
    const check = await checkErpSession();
    lastKeepAliveTime = Date.now();
    return erpSessionStatus;
  } finally {
    keepAliveInProgress = false;
  }
}

let keepAliveTimer = null;
let keepAliveInterval = null;

function startKeepAliveScheduler() {
  if (process.env.ERP_KEEPALIVE_ENABLED === 'false') return;
  const hasCredentials = Boolean(
    (process.env.ERP_USERNAME && process.env.ERP_PASSWORD) ||
    (process.env.ERP_MYAUTH && process.env.ERP_ASP_NET_SESSION_ID)
  );
  if (!hasCredentials) return;

  const intervalMinutes = Math.max(1, parseInt(process.env.ERP_KEEPALIVE_INTERVAL_MINUTES, 10) || 10);
  const startupDelayMs = parseInt(process.env.ERP_KEEPALIVE_STARTUP_DELAY_MS, 10) || 30000;

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

app.get('/api/health', (req, res) => {
  const hasUserPass = Boolean(process.env.ERP_USERNAME && process.env.ERP_PASSWORD);
  const hasCookies = Boolean(
    (process.env.ERP_MYAUTH && process.env.ERP_ASP_NET_SESSION_ID) ||
    erpCookieJar.has('MyAuth') || erpCookieJar.has('ASP.NET_SessionId')
  );

  res.json({
    status: 'ok',
    erpSession: erpSessionStatus,
    sessionConfigured: Boolean(hasUserPass || hasCookies),
    loginConfigured: hasUserPass,
    apiKeyRequired: Boolean((process.env.API_KEY || '').trim()),
    rateLimitMax: RATE_LIMIT_MAX,
    windowSeconds: RATE_LIMIT_WINDOW_MS / 1000,
    keepAliveEnabled: process.env.ERP_KEEPALIVE_ENABLED !== 'false',
    keepAliveIntervalMinutes: parseInt(process.env.ERP_KEEPALIVE_INTERVAL_MINUTES, 10) || 10,
    lastKeepAlive: lastKeepAliveTime ? new Date(lastKeepAliveTime).toISOString() : null
  });
});

app.get(['/api/profile/:rollNumber', '/api/profile/:rollNumber/json'], rateLimiter.middleware(), apiKeyAuth, async (req, res) => {
  const { rollNumber } = req.params;
  const validation = validateRollNumber(rollNumber);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const sanitizedRoll = validation.value;
  syncCredentialsToJar();

  const hasUserPass = Boolean(process.env.ERP_USERNAME && process.env.ERP_PASSWORD);
  if (hasUserPass && erpSessionStatus === 'expired') {
    await performErpLogin();
  }

  const profileBaseUrl = process.env.ERP_BASE_URL || ERP_BASE_URL;
  const upstreamUrl = `${profileBaseUrl}?ID=${encodeURIComponent(sanitizedRoll)}`;
  const cookieHeader = erpCookieJar.getCookieString(upstreamUrl);

  const reqTimeoutMs = parseTimeoutMs(process.env.ERP_TIMEOUT_MS);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), reqTimeoutMs);

  try {
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

    const setCookies = upstreamRes.headers.getSetCookie ? upstreamRes.headers.getSetCookie() : [upstreamRes.headers.get('set-cookie')];
    erpCookieJar.storeCookies(setCookies, upstreamUrl);

    const status = upstreamRes.status;
    const location = upstreamRes.headers.get('location') || '';
    const contentType = (upstreamRes.headers.get('content-type') || '').toLowerCase();

    if (status === 301 || status === 302) {
      if (location.toLowerCase().includes('login')) {
        erpSessionStatus = 'expired';
        return res.status(401).json({
          error: 'ERP session has expired or is invalid. Please refresh the authorized ERP credentials.',
          code: 'ERP_SESSION_EXPIRED'
        });
      }
      return res.status(502).json({ error: `ERP returned unexpected redirect to: ${location}` });
    }

    if (status === 401 || status === 403) {
      erpSessionStatus = 'expired';
      return res.status(401).json({
        error: 'ERP session is unauthorized or has expired. Please update credentials.',
        code: 'ERP_SESSION_EXPIRED'
      });
    }

    if (status === 404) {
      return res.status(404).json({ error: `Profile image not found for roll number: ${sanitizedRoll}` });
    }

    if (status >= 500) {
      return res.status(502).json({
        error: `ABES ERP server encountered an error (HTTP ${status}). Please try again later.`,
        code: 'ERP_UNAVAILABLE'
      });
    }

    if (status !== 200) {
      return res.status(502).json({ error: `ERP returned unexpected status code: ${status}` });
    }

    const isImage = contentType.startsWith('image/') ||
                    contentType.includes('jpeg') ||
                    contentType.includes('png') ||
                    contentType.includes('webp');

    if (!isImage) {
      const bodySnippet = (await upstreamRes.text()).slice(0, 1000);
      if (bodySnippet.toLowerCase().includes('login') || bodySnippet.toLowerCase().includes('object moved')) {
        erpSessionStatus = 'expired';
        return res.status(401).json({
          error: 'ERP session has expired or is invalid. Please refresh the authorized ERP credentials.',
          code: 'ERP_SESSION_EXPIRED'
        });
      }
      return res.status(502).json({ error: 'ERP returned an unexpected response format instead of an image.' });
    }

    const arrayBuffer = await upstreamRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return res.status(404).json({ error: `No image data returned for roll number: ${sanitizedRoll}` });
    }

    if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
      return res.status(502).json({ error: 'Profile image returned by ERP exceeds maximum permissible size.' });
    }

    erpSessionStatus = 'active';

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

    if (isTimeoutOrAbortError(err)) {
      return res.status(504).json({
        error: `ERP request timed out after ${Math.round(reqTimeoutMs / 1000)} seconds. The upstream server may be offline or unreachable.`,
        code: 'GATEWAY_TIMEOUT'
      });
    }

    return res.status(502).json({
      error: 'Failed to communicate with ABES ERP server. Please try again later.'
    });
  }
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

app.get('*', (req, res) => {
  const publicIndex = path.join(__dirname, 'public', 'index.html');
  const rootIndex = path.join(__dirname, 'index.html');
  if (fs.existsSync(publicIndex)) return res.sendFile(publicIndex);
  if (fs.existsSync(rootIndex)) return res.sendFile(rootIndex);
  res.status(404).send('Not Found');
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'An unexpected internal server error occurred.' });
});

let server = null;
if (require.main === module) {
  server = app.listen(PORT, () => {
    startKeepAliveScheduler();
  });
}

app.app = app;
app.server = server;
app.validateRollNumber = validateRollNumber;
app.InMemoryRateLimiter = InMemoryRateLimiter;
app.apiKeyAuth = apiKeyAuth;
app.ErpCookieJar = ErpCookieJar;
app.erpCookieJar = erpCookieJar;
app.checkErpSession = checkErpSession;
app.executeErpLoginFlow = executeErpLoginFlow;
app.performErpLogin = performErpLogin;
app.keepErpSessionAlive = keepErpSessionAlive;
app.startKeepAliveScheduler = startKeepAliveScheduler;
app.stopKeepAliveScheduler = stopKeepAliveScheduler;
app.getErpSessionStatus = () => erpSessionStatus;
app.setErpSessionStatus = (status) => { erpSessionStatus = status; };
app.checkCredentialsChanged = checkCredentialsChanged;

module.exports = app;
