const { createProxyMiddleware } = require('http-proxy-middleware');

// BACKEND_URL is set to https://backend:8443 inside Docker (service name).
// Falls back to https://localhost:8443 for local dev without Docker.
const target = process.env.BACKEND_URL || 'https://localhost:8443';

module.exports = function (app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target,
      changeOrigin: true,
      secure: false,   // self-signed cert in dev — never set false in production
    })
  );
};
