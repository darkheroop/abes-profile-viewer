'use strict';

const { app } = require('../server');

/**
 * Vercel Serverless Function entry point for ABES Profile Viewer.
 * Wraps the Express application and normalizes URL paths so that
 * Vercel rewrites seamlessly map to Express /api routes.
 */
module.exports = (req, res) => {
  const originalUrl = req.headers['x-matched-path'] || req.url || '';
  const [pathname, search] = originalUrl.split('?');
  const queryStr = search ? `?${search}` : '';

  if (pathname && !pathname.startsWith('/api')) {
    req.url = '/api' + (pathname.startsWith('/') ? pathname : '/' + pathname) + queryStr;
  } else if (pathname && pathname.startsWith('/api')) {
    req.url = pathname + queryStr;
  }

  return app(req, res);
};
