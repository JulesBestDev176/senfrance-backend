const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailConfig {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.testAccount = null;
  }

  // Initialiser la configuration email
  async initialize() {
    try {
      if (process.env.NODE_ENV === 'development') {
        await this.setupDevelopmentEmail();
      } else {
        await this.setupProductionEmail();
      }
      
      this.isConfigured = true;
      logger.info('✅ Configuration email initialisée');
      
    } catch (error) {
      logger.error('❌ Erreur configuration email:', error);
      throw error;
    }
  }

  // Configuration pour le développement (Ethereal)
  async setupDevelopmentEmail() {
    try {
      // Créer un compte de test Ethereal
      this.testAccount = await nodemailer.createTestAccount();
      
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false, // true pour 465, false pour les autres ports
        auth: {
          user: this.testAccount.user,
          pass: this.testAccount.pass,
        },
        tls: {
          rejectUnauthorized: false
        }
      });
      
      logger.info('📧 Email configuré avec Ethereal pour le développement');
      logger.info(`📧 Compte test: ${this.testAccount.user}`);
      
    } catch (error) {
      logger.error('❌ Erreur configuration Ethereal:', error);
      throw error;
    }
  }

  // Configuration pour la production
  async setupProductionEmail() {
    const emailProvider = process.env.EMAIL_PROVIDER || 'gmail';
    
    switch (emailProvider.toLowerCase()) {
      case 'gmail':
        await this.setupGmail();
        break;
      case 'sendgrid':
        await this.setupSendGrid();
        break;
      case 'mailgun':
        await this.setupMailgun();
        break;
      case 'smtp':
        await this.setupCustomSMTP();
        break;
      default:
        throw new Error(`Fournisseur email non supporté: ${emailProvider}`);
    }
  }

  // Configuration Gmail
  async setupGmail() {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error('Variables EMAIL_USER et EMAIL_PASS requises pour Gmail');
    }

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // App Password
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    logger.info('📧 Email configuré avec Gmail');
  }

  // Configuration SendGrid
  async setupSendGrid() {
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error('Variable SENDGRID_API_KEY requise pour SendGrid');
    }

    this.transporter = nodemailer.createTransport({
      service: 'SendGrid',
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY,
      },
    });

    logger.info('📧 Email configuré avec SendGrid');
  }

  // Configuration Mailgun
  async setupMailgun() {
    if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
      throw new Error('Variables MAILGUN_API_KEY et MAILGUN_DOMAIN requises');
    }

    this.transporter = nodemailer.createTransport({
      service: 'Mailgun',
      auth: {
        user: process.env.MAILGUN_USER || 'api',
        pass: process.env.MAILGUN_API_KEY,
      },
    });

    logger.info('📧 Email configuré avec Mailgun');
  }

  // Configuration SMTP personnalisée
  async setupCustomSMTP() {
    const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Variables SMTP manquantes: ${missingVars.join(', ')}`);
    }

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true', // true pour 465, false pour les autres
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false'
      }
    });

    logger.info('📧 Email configuré avec SMTP personnalisé');
  }

  // Vérifier la configuration email
  async verifyConnection() {
    try {
      if (!this.transporter) {
        throw new Error('Transporter email non configuré');
      }

      await this.transporter.verify();
      logger.info('✅ Connexion email vérifiée');
      return true;
      
    } catch (error) {
      logger.error('❌ Erreur vérification email:', error);
      return false;
    }
  }

  // Obtenir le transporter
  getTransporter() {
    if (!this.isConfigured || !this.transporter) {
      throw new Error('Email non configuré. Appelez initialize() d\'abord.');
    }
    return this.transporter;
  }

  // Obtenir les informations de configuration
  getConfig() {
    return {
      isConfigured: this.isConfigured,
      environment: process.env.NODE_ENV,
      provider: process.env.EMAIL_PROVIDER || 'gmail',
      testAccount: this.testAccount ? {
        user: this.testAccount.user,
        preview: 'https://ethereal.email'
      } : null
    };
  }

  // Templates d'email
  getEmailTemplates() {
    return {
      // Template de notification
      notification: {
        subject: (data) => `🚀 Nouveau contact de ${data.name} - ${data.company || 'Particulier'}`,
        html: (data) => this.generateNotificationHTML(data),
        text: (data) => this.generateNotificationText(data)
      },
      
      // Template de confirmation
      confirmation: {
        subject: (data) => '✅ Message reçu - DevFlow vous répond sous 2h',
        html: (data) => this.generateConfirmationHTML(data),
        text: (data) => this.generateConfirmationText(data)
      }
    };
  }

  // Générer HTML de notification
  generateNotificationHTML(data) {
    const { name, email, message, phone, company, budget, timeline, timestamp } = data;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nouveau Contact - DevFlow</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { padding: 30px; }
          .info-box { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .field { margin: 10px 0; }
          .field strong { color: #333; }
          .message-box { background: white; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; }
          .actions { text-align: center; margin: 30px 0; }
          .btn { display: inline-block; padding: 12px 24px; margin: 5px; text-decoration: none; border-radius: 6px; font-weight: bold; }
          .btn-primary { background: #667eea; color: white; }
          .btn-success { background: #25d366; color: white; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💼 Nouveau Contact</h1>
            <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">DevFlow - Contact Website</p>
          </div>
          
          <div class="content">
            <h2 style="color: #333; margin-bottom: 20px;">Informations du contact</h2>
            
            <div class="info-box">
              <div class="field"><strong>👤 Nom:</strong> ${name}</div>
              <div class="field"><strong>📧 Email:</strong> <a href="mailto:${email}">${email}</a></div>
              <div class="field"><strong>📞 Téléphone:</strong> ${phone || 'Non renseigné'}</div>
              <div class="field"><strong>🏢 Entreprise:</strong> ${company || 'Non renseigné'}</div>
              <div class="field"><strong>💰 Budget:</strong> ${this.formatBudget(budget)}</div>
              <div class="field"><strong>⏱️ Délai:</strong> ${this.formatTimeline(timeline)}</div>
              <div class="field"><strong>📅 Date:</strong> ${new Date(timestamp).toLocaleString('fr-FR')}</div>
            </div>
            
            <div class="message-box">
              <h3 style="color: #333; margin-top: 0;">💭 Message:</h3>
              <p style="line-height: 1.6; color: #555; white-space: pre-wrap;">${message}</p>
            </div>
            
            <div class="actions">
              <a href="mailto:${email}" class="btn btn-primary">Répondre par Email</a>
              ${phone ? `<a href="https://wa.me/${phone.replace(/[^\d]/g, '')}" class="btn btn-success">Contacter WhatsApp</a>` : ''}
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #777; font-size: 14px;">
              <p>Cet email a été généré automatiquement par le formulaire de contact de DevFlow.com</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Générer texte de notification
  generateNotificationText(data) {
    const { name, email, message, phone, company, budget, timeline, timestamp } = data;
    
    return `
NOUVEAU CONTACT - DevFlow

Informations du contact:
- Nom: ${name}
- Email: ${email}
- Téléphone: ${phone || 'Non renseigné'}
- Entreprise: ${company || 'Non renseigné'}
- Budget: ${this.formatBudget(budget)}
- Délai: ${this.formatTimeline(timeline)}
- Date: ${new Date(timestamp).toLocaleString('fr-FR')}

Message:
${message}

Actions:
- Répondre: mailto:${email}
${phone ? `- WhatsApp: https://wa.me/${phone.replace(/[^\d]/g, '')}` : ''}
    `.trim();
  }

  // Générer HTML de confirmation
  generateConfirmationHTML(data) {
    const { name, email } = data;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Message Reçu - DevFlow</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { padding: 30px; }
          .highlight-box { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 20px; margin: 20px 0; border-radius: 4px; }
          .commitments { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .commitment-item { margin: 10px 0; padding: 8px 0; }
          .actions { text-align: center; margin: 30px 0; }
          .btn { display: inline-block; padding: 12px 24px; margin: 5px; text-decoration: none; border-radius: 6px; font-weight: bold; color: white; }
          .btn-whatsapp { background: #25d366; }
          .btn-phone { background: #2196f3; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #777; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚀 DevFlow</h1>
            <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">Votre message a été reçu</p>
          </div>
          
          <div class="content">
            <h2 style="color: #333;">Bonjour ${name} 👋</h2>
            
            <p style="line-height: 1.6; color: #555; font-size: 16px;">
              Merci pour votre message ! Nous avons bien reçu votre demande et nous vous répondrons dans les <strong style="color: #2196f3;">2 heures</strong> suivantes.
            </p>
            
            <div class="highlight-box">
              <p style="margin: 0; font-weight: bold; color: #1976d2;">
                ⚡ Nous nous engageons à vous répondre rapidement et à transformer votre vision en réalité digitale !
              </p>
            </div>
            
            <div class="commitments">
              <h3 style="color: #333; margin-top: 0;">🎯 Nos engagements</h3>
              <div class="commitment-item">✅ <strong>Première réponse sous 2h</strong></div>
              <div class="commitment-item">📊 <strong>Devis personnalisé sous 24h</strong></div>
              <div class="commitment-item">🚀 <strong>Démarrage du projet sous 1 semaine</strong></div>
              <div class="commitment-item">🛠️ <strong>Support technique 24/7</strong></div>
              <div class="commitment-item">⭐ <strong>100% satisfaction client</strong></div>
            </div>
            
            <p style="line-height: 1.6; color: #555;">
              En attendant notre réponse, n'hésitez pas à nous contacter directement pour toute question urgente :
            </p>
            
            <div class="actions">
              <a href="https://wa.me/221777151061" class="btn btn-whatsapp">💬 WhatsApp Direct</a>
              <a href="tel:+221777151061" class="btn btn-phone">📞 Appeler Maintenant</a>
            </div>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <h4 style="color: #333; margin-top: 0;">🌍 Basé à Dakar, Sénégal</h4>
              <p style="color: #666; margin: 10px 0;">Nous servons des clients dans toute l'Afrique de l'Ouest et au-delà</p>
              <div style="margin-top: 15px;">
                <span style="background: white; padding: 5px 12px; margin: 3px; border-radius: 15px; font-size: 12px; color: #666;">🌍 International</span>
                <span style="background: white; padding: 5px 12px; margin: 3px; border-radius: 15px; font-size: 12px; color: #666;">🇸🇳 Local</span>
                <span style="background: white; padding: 5px 12px; margin: 3px; border-radius: 15px; font-size: 12px; color: #666;">💬 Français/English</span>
              </div>
            </div>
            
            <div class="footer">
              <p><strong>Souleymane Fall</strong> - Développeur Full Stack</p>
              <p>📍 HLM Fass, Dakar, Sénégal | 📧 souleymanefall176@gmail.com</p>
              <p style="margin-top: 15px; font-size: 12px; opacity: 0.8;">
                Cet email de confirmation a été généré automatiquement. Merci de ne pas répondre à cet email.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Générer texte de confirmation
  generateConfirmationText(data) {
    const { name } = data;
    
    return `
Bonjour ${name},

Merci pour votre message ! Nous avons bien reçu votre demande et nous vous répondrons dans les 2 heures suivantes.

NOS ENGAGEMENTS:
✅ Première réponse sous 2h
📊 Devis personnalisé sous 24h
🚀 Démarrage du projet sous 1 semaine
🛠️ Support technique 24/7
⭐ 100% satisfaction client

CONTACT DIRECT:
💬 WhatsApp: https://wa.me/221777151061
📞 Téléphone: +221 77 715 10 61

Souleymane Fall - Développeur Full Stack
📍 Dakar, Sénégal
📧 souleymanefall176@gmail.com

Basé à Dakar, nous servons des clients dans toute l'Afrique de l'Ouest et au-delà.
    `.trim();
  }

  // Formater le budget
  formatBudget(budget) {
    const budgetMap = {
      '2k-5k': '2 000 - 5 000 €',
      '5k-10k': '5 000 - 10 000 €',
      '10k-25k': '10 000 - 25 000 €',
      '25k-50k': '25 000 - 50 000 €',
      '50k+': '50 000+ €'
    };
    return budgetMap[budget] || 'Non renseigné';
  }

  // Formater le délai
  formatTimeline(timeline) {
    const timelineMap = {
      'asap': 'Dès que possible',
      '1month': '1 mois',
      '2-3months': '2-3 mois',
      '3-6months': '3-6 mois',
      '6months+': '6+ mois'
    };
    return timelineMap[timeline] || 'Non renseigné';
  }

  // Health check email
  async healthCheck() {
    try {
      if (!this.isConfigured) {
        return {
          status: 'not_configured',
          message: 'Email non configuré'
        };
      }

      const isVerified = await this.verifyConnection();
      
      return {
        status: isVerified ? 'healthy' : 'unhealthy',
        message: isVerified ? 'Email service opérationnel' : 'Erreur de connexion email',
        config: this.getConfig()
      };
      
    } catch (error) {
      return {
        status: 'error',
        message: 'Erreur health check email',
        error: error.message
      };
    }
  }
}

// Instance singleton
const emailConfig = new EmailConfig();

module.exports = emailConfig;
      
