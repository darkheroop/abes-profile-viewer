'use strict';

const { app } = require('../server');

const RENDER_BACKEND_URL = (process.env.RENDER_BACKEND_URL || 'https://abes-profile-api.onrender.com').replace(/\/+$/, '');

module.exports = async (req, res) => {
  const matchedPath = req.headers['x-matched-path'];
  let targetPath = req.url || '';
  if (matchedPath && matchedPath.startsWith('/api/') && matchedPath !== '/api/index.js') {
    targetPath = matchedPath;
  } else if (!targetPath.startsWith('/api')) {
    targetPath = '/api' + (targetPath.startsWith('/') ? targetPath : '/' + targetPath);
  }

  // If Render backend is configured, forward API requests directly to 24/7 Render instance
  if (RENDER_BACKEND_URL) {
    try {
      const upstreamUrl = `${RENDER_BACKEND_URL}${targetPath}`;
      const forwardHeaders = { ...req.headers };
      delete forwardHeaders.host;
      delete forwardHeaders.connection;

      const upstreamRes = await fetch(upstreamUrl, {
        method: req.method,
        headers: forwardHeaders,
        redirect: 'manual'
      });

      res.status(upstreamRes.status);
      for (const [k, v] of upstreamRes.headers.entries()) {
        if (!['content-encoding', 'transfer-encoding', 'connection'].includes(k.toLowerCase())) {
          res.setHeader(k, v);
        }
      }

      const buffer = Buffer.from(await upstreamRes.arrayBuffer());
      return res.send(buffer);
    } catch (err) {
      // Fallback to local server handler if proxy encountered an issue
    }
  }

  req.url = targetPath;
  return app(req, res);
};
