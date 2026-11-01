'use strict';

const { app } = require('../server');

/**
 * Vercel Serverless Function entry point for ABES Profile Viewer.
 * Wraps Express and guarantees URL paths start with /api so all
 * backend endpoints (/api/health, /api/profile/:id) match cleanly.
 */
module.exports = (req, res) => {
  const matchedPath = req.headers['x-matched-path'];
  if (matchedPath && matchedPath.startsWith('/api/') && matchedPath !== '/api/index.js') {
    req.url = matchedPath;
  } else if (req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  return app(req, res);
};
