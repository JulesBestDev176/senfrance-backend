const cors = require('cors');
const logger = require('../utils/logger');

// Configuration CORS avancée avec gestion dynamique des ports
const corsConfig = {
  // Origines autorisées selon l'environnement
  origin: function (origin, callback) {
    // En développement : autoriser tous les localhost et 127.0.0.1
    if (process.env.NODE_ENV === 'development') {
      const allowedPatterns = [
        /^http:\/\/localhost:\d+$/,     // localhost:n'importe-quel-port
        /^http:\/\/127\.0\.0\.1:\d+$/,  // 127.0.0.1:n'importe-quel-port
        /^http:\/\/0\.0\.0\.0:\d+$/,    // 0.0.0.0:n'importe-quel-port
      ];
      
      // Autoriser les requêtes sans origin (Postman, apps mobiles, etc.)
      if (!origin) {
        logger.debug('✅ CORS: Requête sans origin autorisée');
        return callback(null, true);
      }
      
      // Vérifier si l'origin correspond aux patterns autorisés
      const isAllowed = allowedPatterns.some(pattern => pattern.test(origin));
      
      if (isAllowed) {
        logger.debug(`✅ CORS: Origin autorisée en développement: ${origin}`);
        callback(null, true);
      } else {
        logger.warn(`⚠️ CORS: Origin non autorisée: ${origin}`);
        callback(null, true); // En dev, on autorise quand même pour éviter les blocages
      }
    } else {
      // En production : liste stricte des domaines autorisés
      const allowedOrigins = [
        process.env.FRONTEND_URL,
        'https://devllow.com',
        'https://www.devllow.com',
        'https://portfolio.devllow.com'
      ].filter(Boolean); // Supprimer les valeurs nulles/undefined

      // Autoriser les requêtes sans origin en production aussi (API calls, mobile apps)
      if (!origin) {
        logger.debug('✅ CORS: Requête sans origin autorisée en production');
        return callback(null, true);
      }
      
      if (allowedOrigins.includes(origin)) {
        logger.info(`✅ CORS: Origin autorisée en production: ${origin}`);
        callback(null, true);
      } else {
        logger.error(`🚫 CORS: Origine non autorisée en production: ${origin}`);
        callback(new Error('Non autorisé par la politique CORS'));
      }
    }
  },

  // Méthodes autorisées
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  
  // Headers autorisés
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-CSRF-Token',
    'X-Forwarded-For',
    'User-Agent'
  ],
  
  // Headers exposés au client
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Total-Count'
  ],

  // Autoriser les cookies et credentials
  credentials: true,

  // Cache pour les requêtes preflight (OPTIONS)
  maxAge: 86400, // 24 heures

  // Statut de succès pour OPTIONS
  optionsSuccessStatus: 200,

  // Préflight pour toutes les routes
  preflightContinue: false
};

// Middleware CORS avec logging détaillé
const corsMiddleware = (req, res, next) => {
  const origin = req.get('Origin');
  const method = req.method;
  const url = req.url;
  
  // Logger les requêtes CORS importantes
  if (method === 'OPTIONS') {
    logger.debug(`🔄 Requête OPTIONS de ${origin || 'unknown'} vers ${url}`);
  } else if (origin && origin !== `http://localhost:${process.env.PORT || 5000}`) {
    logger.debug(`🌐 Requête ${method} de ${origin} vers ${url}`);
  }

  // Appliquer CORS
  cors(corsConfig)(req, res, (err) => {
    if (err) {
      logger.error(`❌ Erreur CORS: ${err.message}`, {
        origin: origin,
        method: method,
        url: url,
        userAgent: req.get('User-Agent')?.substring(0, 100) + '...'
      });
      
      return res.status(403).json({
        success: false,
        message: 'Accès refusé par la politique CORS',
        error: process.env.NODE_ENV === 'development' ? {
          message: err.message,
          origin: origin,
          allowed: 'localhost:* en développement'
        } : 'Origine non autorisée'
      });
    }
    
    next();
  });
};

// Configuration CORS pour des endpoints spécifiques
const publicCorsConfig = {
  origin: '*',
  methods: ['GET'],
  allowedHeaders: ['Content-Type'],
  credentials: false
};

// Configuration CORS restrictive pour l'admin
const adminCorsConfig = {
  origin: process.env.ADMIN_URL || /^http:\/\/localhost:\d+$/,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Middleware pour débugger CORS
const debugCors = (req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    const origin = req.get('Origin');
    const method = req.method;
    
    logger.debug(`🔍 CORS Debug:`, {
      method: method,
      origin: origin || 'no-origin',
      url: req.url,
      headers: {
        'access-control-request-method': req.get('Access-Control-Request-Method'),
        'access-control-request-headers': req.get('Access-Control-Request-Headers'),
      }
    });
  }
  next();
};

module.exports = {
  corsMiddleware,
  corsConfig,
  publicCorsConfig,
  adminCorsConfig,
  debugCors
};