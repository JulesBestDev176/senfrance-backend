const app = require('./src/app');
const logger = require('./src/utils/logger');
require('dotenv').config();

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

app.listen(PORT, () => {
  logger.info(`🚀 Serveur démarré sur le port ${PORT} en mode ${NODE_ENV}`);
  logger.info(`📍 URL: http://localhost:${PORT}`);
});

// Gestion des erreurs non capturées
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  process.exit(1);
});