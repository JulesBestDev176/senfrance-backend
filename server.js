// server.js - Version corrigée
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configuration CORS pour production et development
const corsOrigins = process.env.NODE_ENV === 'production' 
  ? [
      'https://senfrance-reprise-voyage.onrender.com',
      'https://www.senfrance-reprise-voyage.onrender.com',
      process.env.CORS_ORIGIN
    ].filter(Boolean)
  : [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8080',
      'http://localhost:8081',
      'http://127.0.0.1:8081',
      'http://localhost:4173'
    ];

console.log('🔗 CORS Origins autorisées:', corsOrigins);

// Configuration CORS
app.use(cors({
  origin: function (origin, callback) {
    console.log('🌐 Origin reçue:', origin);
    
    // Permettre les requêtes sans origin (ex: Postman, mobile apps)
    if (!origin) return callback(null, true);
    
    if (corsOrigins.includes(origin)) {
      console.log('✅ Origin autorisée:', origin);
      callback(null, true);
    } else {
      console.log('❌ CORS bloqué pour origine:', origin);
      callback(new Error('Non autorisé par CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Type', 'Authorization']
}));

// Middlewares de base
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging middleware unifié
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.get('Origin') || 'N/A'}`);
  if (req.method === 'POST') {
    console.log('📦 Body:', req.body);
  }
  next();
});

// Configuration Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Rate limiting
const emailLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 60 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || (process.env.NODE_ENV === 'production' ? 10 : 5),
  message: {
    success: false,
    message: 'Trop de messages envoyés. Réessayez dans une heure.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Vérification de la configuration email
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Erreur de configuration email:', error);
  } else {
    console.log('✅ Serveur email prêt');
  }
});

// Route de test
app.get('/', (req, res) => {
  res.json({ 
    message: 'Serveur SenFrance opérationnel',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    cors: 'enabled',
    port: PORT,
    emailConfigured: !!process.env.EMAIL_USER,
    corsOrigins: corsOrigins
  });
});

// Route de santé pour Render
app.get('/health', async (req, res) => {
  const health = {
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    port: PORT,
    services: {
      email: 'unknown',
      cors: corsOrigins.length > 0 ? 'configured' : 'not configured'
    }
  };

  try {
    await transporter.verify();
    health.services.email = 'connected';
  } catch (error) {
    health.services.email = 'disconnected';
    health.status = 'DEGRADED';
  }

  const status = health.services.email === 'connected' ? 200 : 503;
  res.status(status).json(health);
});

// Middleware explicite pour OPTIONS (preflight)
app.options('*', (req, res) => {
  const origin = req.get('Origin');
  console.log('🔄 OPTIONS request from:', origin);
  
  if (corsOrigins.includes(origin) || !origin) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');
    console.log('✅ OPTIONS headers set for origin:', origin);
  } else {
    console.log('❌ OPTIONS denied for origin:', origin);
  }
  res.sendStatus(200);
});

// Route principale pour envoyer l'email
app.post('/api/contact', emailLimiter, async (req, res) => {
  console.log('📧 Nouvelle demande de contact reçue');
  console.log('📝 Données reçues:', { 
    name: req.body.name, 
    email: req.body.email, 
    subject: req.body.subject,
    messageLength: req.body.message?.length 
  });
  
  const { name, email, subject, message } = req.body;

  // Validation des données
  const errors = [];
  
  if (!name || name.trim().length < 2) {
    errors.push('Le nom doit contenir au moins 2 caractères');
  }
  
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Format d\'email invalide');
  }
  
  if (!subject || subject.trim().length < 3) {
    errors.push('Le sujet doit contenir au moins 3 caractères');
  }
  
  if (!message || message.trim().length < 10) {
    errors.push('Le message doit contenir au moins 10 caractères');
  }

  if (errors.length > 0) {
    console.log('❌ Erreurs de validation:', errors);
    return res.status(400).json({
      success: false,
      message: 'Erreurs de validation',
      errors: errors
    });
  }

  try {
    // Email principal vers SenFrance
    const mainMailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_TO || 'contact@senfrance.com',
      subject: `[CONTACT SENFRANCE] ${subject}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #18133E 0%, #FFC3BC 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .info-box { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #FFC3BC; }
            .message-box { background: #fff; padding: 20px; border: 1px solid #e9ecef; border-radius: 5px; margin: 20px 0; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 12px; }
            .label { font-weight: bold; color: #495057; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📧 Nouveau Contact - SenFrance</h1>
              <p>Message reçu le ${new Date().toLocaleDateString('fr-FR', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</p>
            </div>
            
            <div class="content">
              <div class="info-box">
                <h3 style="margin-top: 0; color: #18133E;">👤 Informations du contact</h3>
                <p><span class="label">Nom :</span> ${name}</p>
                <p><span class="label">Email :</span> <a href="mailto:${email}">${email}</a></p>
                <p><span class="label">Sujet :</span> ${subject}</p>
              </div>
              
              <div class="message-box">
                <h3 style="margin-top: 0; color: #495057;">💬 Message</h3>
                <div style="white-space: pre-wrap; line-height: 1.6;">${message}</div>
              </div>
            </div>
            
            <div class="footer">
              <p>Message envoyé depuis le site SenFrance</p>
              <p>Environnement: ${process.env.NODE_ENV}</p>
            </div>
          </div>
        </body>
        </html>
      `,
      replyTo: email
    };

    // Email de confirmation pour l'expéditeur
    const confirmationMailOptions = {
      from: 'contact@senfrance.com',
      to: email,
      subject: '✅ Confirmation de réception - SenFrance',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #00a651 0%, #20c997 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .highlight-box { background: #d1ecf1; border-left: 4px solid #17a2b8; padding: 20px; margin: 20px 0; border-radius: 5px; }
            .contact-info { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 12px; }
            .btn { background: #18133E; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Merci pour votre message !</h1>
              <p>Nous avons bien reçu votre demande</p>
            </div>
            
            <div class="content">
              <p>Bonjour <strong>${name}</strong>,</p>
              
              <p>Nous vous confirmons la bonne réception de votre message concernant : <strong>"${subject}"</strong></p>
              
              <div class="highlight-box">
                <h4 style="margin-top: 0;">⏰ Délai de réponse</h4>
                <p style="margin-bottom: 0;">Notre équipe vous répondra dans les <strong>24 heures</strong> suivant la réception de votre message.</p>
              </div>
              
              <div class="contact-info">
                <h4 style="margin-top: 0;">📞 Contact urgent</h4>
                <p>Si votre demande est urgente, vous pouvez nous contacter directement :</p>
                <ul>
                  <li>📱 <a href="tel:+33972146697">+33 9 72 14 66 97</a></li>
                  <li>📱 <a href="tel:+33744518296">+33 7 44 51 82 96</a></li>
                  <li>📧 <a href="mailto:contact@senfrance.com">contact@senfrance.com</a></li>
                </ul>
                
                <div style="text-align: center; margin-top: 20px;">
                  <a href="https://senfrance-reprise-voyage.onrender.com" class="btn">Visiter notre site</a>
                </div>
              </div>
              
              <p>Nous vous remercions de votre confiance et restons à votre disposition.</p>
              
              <p>Cordialement,<br>
              <strong>L'équipe SenFrance</strong></p>
            </div>
            
            <div class="footer">
              <p><strong>SenFrance</strong> - Votre partenaire pour les études en France</p>
              <p>Message envoyé automatiquement depuis notre plateforme</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    // Envoi des emails
    console.log('📤 Envoi de l\'email principal...');
    await transporter.sendMail(mainMailOptions);
    
    console.log('📤 Envoi de l\'email de confirmation...');
    await transporter.sendMail(confirmationMailOptions);

    console.log('✅ Emails envoyés avec succès');

    res.status(200).json({
      success: true,
      message: 'Message envoyé avec succès ! Vous recevrez une confirmation par email.',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi:', error);
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi du message. Veuillez réessayer dans quelques instants.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  console.error('💥 Erreur serveur:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Erreur interne du serveur'
  });
});

// Gestion des routes non trouvées
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée'
  });
});

// Démarrage du serveur
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Serveur SenFrance démarré`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌍 Environnement: ${process.env.NODE_ENV}`);
  console.log(`📧 Email configuré: ${process.env.EMAIL_USER}`);
  console.log(`🔗 URL: ${process.env.NODE_ENV === 'production' ? 'https://senfrance-backend.onrender.com' : `http://localhost:${PORT}`}`);
  console.log(`✅ CORS configuré pour:`, corsOrigins);
  console.log(`📊 Rate limiting: ${process.env.NODE_ENV === 'production' ? '10' : '5'} emails/heure\n`);
});

// Gestion propre de l'arrêt
process.on('SIGTERM', () => {
  console.log('🛑 Arrêt du serveur...');
  process.exit(0);
});

module.exports = app;