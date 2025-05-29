// server.js
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware CORS - CORRECTION AJOUT PORT 8081
const corsOrigins = process.env.NODE_ENV === 'production' 
  ? (process.env.CORS_ORIGIN || '').split(',').filter(Boolean)
  : [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8080',
      'http://localhost:8081',
      'http://127.0.0.1:8081',
      'http://localhost:4173'
    ];

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.get('Origin')}`);
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
    message: 'Trop de messages envoyés. Réessayez plus tard.'
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
    cors: 'enabled'
  });
});

// Route de santé
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    uptime: process.uptime(),
    cors: 'enabled',
    emailConfigured: !!process.env.EMAIL_USER
  });
});

// OPTIONS pour preflight CORS
app.options('/api/contact', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.get('Origin'));
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
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
              <p>Message envoyé depuis le formulaire de contact SenFrance</p>
              <p>15 quai des Chartrons, Bordeaux - France</p>
            </div>
          </div>
        </body>
        </html>
      `,
      replyTo: email
    };

    // Email de confirmation pour l'expéditeur
    const confirmationMailOptions = {
      from: process.env.EMAIL_USER,
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
                  <a href="https://senfrance.com/services" class="btn">Découvrir nos services</a>
                </div>
              </div>
              
              <p>Nous vous remercions de votre confiance et restons à votre disposition.</p>
              
              <p>Cordialement,<br>
              <strong>L'équipe SenFrance</strong></p>
            </div>
            
            <div class="footer">
              <p><strong>SenFrance</strong> - Votre partenaire pour les études en France</p>
              <p>15 quai des Chartrons, 33000 Bordeaux - France</p>
              <p><a href="https://senfrance.com">www.senfrance.com</a></p>
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
app.listen(PORT, () => {
  console.log(`\n🚀 Serveur SenFrance démarré`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌍 Environnement: ${process.env.NODE_ENV}`);
  console.log(`📧 Email configuré: ${process.env.EMAIL_USER}`);
  console.log(`🔗 URL: http://localhost:${PORT}`);
  console.log(`✅ CORS configuré pour les ports: 3000, 5173, 8080, 8081, 4173\n`);
});

// Gestion propre de l'arrêt
process.on('SIGTERM', () => {
  console.log('🛑 Arrêt du serveur...');
  process.exit(0);
});

module.exports = app;