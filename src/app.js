const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const contactRoutes = require('./routes/contact');
const errorHandler = require('./middleware/errorHandler');
const { corsMiddleware, debugCors } = require('./middleware/cors');
const logger = require('./utils/logger');

require('dotenv').config();

const app = express();

// Debug CORS en développement
if (process.env.NODE_ENV === 'development') {
  app.use(debugCors);
}

// Sécurité
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Compression
app.use(compression());

// CORS - IMPORTANT: À mettre AVANT les autres middlewares
app.use(corsMiddleware);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: {
    success: false,
    error: 'Trop de requêtes, veuillez réessayer plus tard.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Contact form specific rate limiting
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: process.env.NODE_ENV === 'production' ? 5 : 50, // Plus permissif en dev
  message: {
    success: false,
    error: 'Trop de soumissions de formulaire. Veuillez réessayer dans 1 heure.'
  }
});

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: { write: message => logger.info(message.trim()) }
  }));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 5000
  });
});

// CORS test endpoint
app.get('/api/test-cors', (req, res) => {
  res.json({
    success: true,
    message: 'CORS fonctionne correctement',
    origin: req.get('Origin') || 'no-origin',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/contact', contactLimiter, contactRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route non trouvée: ${req.method} ${req.originalUrl}`,
    availableRoutes: [
      'GET /health',
      'GET /api/test-cors',
      'GET /api/contact/test',
      'POST /api/contact/send'
    ]
  });
});

// Error handling
app.use(errorHandler);

module.exports = app;