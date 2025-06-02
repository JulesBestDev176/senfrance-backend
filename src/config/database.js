const mongoose = require('mongoose');
const logger = require('../utils/logger');

class Database {
  constructor() {
    this.connection = null;
    this.isConnected = false;
  }

  // Connexion à MongoDB
  async connect() {
    try {
      // Configuration de connexion
      const options = {
        // Nouvelle syntaxe MongoDB
        useNewUrlParser: true,
        useUnifiedTopology: true,
        
        // Gestion des connexions
        maxPoolSize: 10, // Maintenir jusqu'à 10 connexions socket
        serverSelectionTimeoutMS: 5000, // Garder en vie pendant 5s
        socketTimeoutMS: 45000, // Fermer les sockets après 45s d'inactivité
        bufferMaxEntries: 0, // Désactiver le buffering Mongoose
        
        // Authentification et sécurité
        authSource: 'admin',
        ssl: process.env.NODE_ENV === 'production',
        
        // Retry logic
        retryWrites: true,
        w: 'majority'
      };

      // URL de base de données selon l'environnement
      const mongoURI = this.getMongoURI();
      
      logger.info(`🔌 Connexion à MongoDB...`);
      
      this.connection = await mongoose.connect(mongoURI, options);
      this.isConnected = true;
      
      logger.info(`✅ MongoDB connecté: ${this.connection.connection.host}`);
      
      // Écouteurs d'événements
      this.setupEventListeners();
      
      return this.connection;
      
    } catch (error) {
      logger.error('❌ Erreur de connexion MongoDB:', error);
      throw error;
    }
  }

  // Obtenir l'URI MongoDB selon l'environnement
  getMongoURI() {
    if (process.env.NODE_ENV === 'production') {
      // Production: MongoDB Atlas ou serveur distant
      return process.env.MONGODB_URI || process.env.MONGODB_URL;
    } else if (process.env.NODE_ENV === 'test') {
      // Test: Base de données de test
      return process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/devflow_test';
    } else {
      // Développement: MongoDB local
      return process.env.MONGODB_URI || 'mongodb://localhost:27017/devflow_dev';
    }
  }

  // Configuration des écouteurs d'événements
  setupEventListeners() {
    // Connexion établie
    mongoose.connection.on('connected', () => {
      logger.info('🟢 Mongoose connecté à MongoDB');
    });

    // Erreur de connexion
    mongoose.connection.on('error', (err) => {
      logger.error('🔴 Erreur de connexion Mongoose:', err);
    });

    // Connexion fermée
    mongoose.connection.on('disconnected', () => {
      logger.warn('🟡 Mongoose déconnecté de MongoDB');
      this.isConnected = false;
    });

    // Reconnexion
    mongoose.connection.on('reconnected', () => {
      logger.info('🔵 Mongoose reconnecté à MongoDB');
      this.isConnected = true;
    });

    // Gestion de la fermeture de l'application
    process.on('SIGINT', async () => {
      await this.disconnect();
      process.exit(0);
    });
  }

  // Déconnexion propre
  async disconnect() {
    try {
      if (this.connection) {
        await mongoose.connection.close();
        logger.info('🔌 Connexion MongoDB fermée');
        this.isConnected = false;
      }
    } catch (error) {
      logger.error('❌ Erreur lors de la fermeture MongoDB:', error);
    }
  }

  // Vérifier l'état de la connexion
  checkConnection() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name
    };
  }

  // Nettoyer la base de données (pour les tests)
  async clearDatabase() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('clearDatabase ne peut être utilisé qu\'en mode test');
    }
    
    const collections = mongoose.connection.collections;
    
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
    
    logger.info('🧹 Base de données de test nettoyée');
  }

  // Initialiser les index pour la performance
  async createIndexes() {
    try {
      const Contact = require('../models/contact');
      
      // Créer les index si ils n'existent pas
      await Contact.createIndexes();
      
      logger.info('📊 Index MongoDB créés');
    } catch (error) {
      logger.error('❌ Erreur création des index:', error);
    }
  }

  // Statistiques de la base de données
  async getStats() {
    try {
      const db = mongoose.connection.db;
      const stats = await db.stats();
      
      return {
        collections: stats.collections,
        dataSize: stats.dataSize,
        storageSize: stats.storageSize,
        indexes: stats.indexes,
        indexSize: stats.indexSize
      };
    } catch (error) {
      logger.error('❌ Erreur récupération stats DB:', error);
      return null;
    }
  }

  // Health check de la base de données
  async healthCheck() {
    try {
      await mongoose.connection.db.admin().ping();
      return {
        status: 'healthy',
        message: 'Base de données accessible',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Base de données inaccessible',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Instance singleton
const database = new Database();

module.exports = database;