const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.testAccount = null;
    this.init();
  }

  // Initialiser la configuration email
  async init() {
    console.log('🔍 DEBUG - Variables d\'environnement:');
  console.log('EMAIL_USER:', process.env.EMAIL_USER ? 'DÉFINI' : 'NON DÉFINI');
  console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'DÉFINI (longueur: ' + process.env.EMAIL_PASS.length + ')' : 'NON DÉFINI');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  try {
    logger.info(`🔧 Initialisation email en mode: ${process.env.NODE_ENV || 'development'}`);
    
    // MODIFICATION: Vérifier d'abord si on a des credentials Gmail
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      logger.info('📧 Credentials Gmail détectés - Configuration Gmail forcée');
      await this.setupGmail();
    } else if (process.env.NODE_ENV === 'production') {
      await this.setupProductionEmail();
    } else {
      // Fallback sur Ethereal uniquement si pas de credentials Gmail
      logger.info('📧 Pas de credentials Gmail - Utilisation d\'Ethereal');
      await this.setupDevelopmentEmail();
    }
    
    this.isConfigured = true;
    logger.info('✅ Configuration email initialisée avec succès');
    
  } catch (error) {
    logger.error('❌ Erreur configuration email:', error);
    // Ne pas faire crash le serveur pour un problème d'email
    this.isConfigured = false;
    logger.warn('⚠️ Email désactivé - Le serveur continuera sans email');
  }
}

  // Configuration pour le développement (Ethereal)
  async setupDevelopmentEmail() {
    try {
      logger.info('🧪 Configuration email pour le développement avec Ethereal...');
      
      // Créer un compte de test Ethereal
      this.testAccount = await nodemailer.createTestAccount();
      
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
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
      logger.info('📧 Prévisualisation disponible sur: https://ethereal.email');
      
    } catch (error) {
      logger.error('❌ Erreur configuration Ethereal:', error);
      throw error;
    }
  }

  // Configuration pour la production
  async setupProductionEmail() {
    logger.info('🏭 Configuration email pour la production...');
    
    // Vérifier les variables d'environnement requises
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      logger.warn('⚠️ Variables EMAIL_USER et EMAIL_PASS manquantes');
      logger.info('💡 Pour configurer Gmail:');
      logger.info('   1. Activer la 2FA sur Gmail');
      logger.info('   2. Générer un App Password');
      logger.info('   3. Définir EMAIL_USER=votre-email@gmail.com');
      logger.info('   4. Définir EMAIL_PASS=votre-app-password');
      throw new Error('Configuration email production incomplète');
    }
    
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
    logger.info('📧 Configuration Gmail...');
    
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    logger.info(`📧 Gmail configuré pour: ${process.env.EMAIL_USER}`);
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
      secure: process.env.SMTP_SECURE === 'true',
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
        logger.warn('⚠️ Aucun transporter configuré');
        return false;
      }

      await this.transporter.verify();
      logger.info('✅ Connexion email vérifiée');
      return true;
      
    } catch (error) {
      logger.error('❌ Erreur vérification email:', error);
      return false;
    }
  }

  // Obtenir le transporter (avec vérification)
  getTransporter() {
    if (!this.isConfigured || !this.transporter) {
      logger.warn('⚠️ Email non configuré, utilisation du mode simulation');
      // Retourner un mock transporter pour éviter les erreurs
      return {
        sendMail: async (options) => {
          logger.info('📧 SIMULATION - Email qui aurait été envoyé:', {
            to: options.to,
            subject: options.subject,
            from: options.from
          });
          return { 
            messageId: 'simulation-' + Date.now(),
            response: '250 Email simulé avec succès'
          };
        }
      };
    }
    return this.transporter;
  }

  // Obtenir les informations de configuration
  getConfig() {
    return {
      isConfigured: this.isConfigured,
      environment: process.env.NODE_ENV || 'development',
      provider: process.env.EMAIL_PROVIDER || 'ethereal',
      testAccount: this.testAccount ? {
        user: this.testAccount.user,
        preview: 'https://ethereal.email'
      } : null,
      hasCredentials: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS)
    };
  }

  // Email de notification (pour vous)
  async sendNotificationEmail(contactData) {
  const { name, email, message, phone, company, budget, timeline, timestamp } = contactData;
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@devllow.com',
    to: process.env.EMAIL_TO || 'souleymanefall176@gmail.com',
    subject: `🚀 Nouveau contact de ${name} - ${company || 'Particulier'}`,
    html: this.generateNotificationHTML(contactData),
    text: this.generateNotificationText(contactData)
  };

  try {
    const transporter = this.getTransporter();
    const info = await transporter.sendMail(mailOptions);
    
    // CORRECTION: Afficher le lien de prévisualisation correctement
    if (process.env.NODE_ENV !== 'production' && this.testAccount) {
      const nodemailer = require('nodemailer');
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log('🔗 NOTIFICATION EMAIL PREVIEW:', previewUrl);
        logger.info(`🔗 Email notification preview: ${previewUrl}`);
      } else {
        console.log('📧 Info notification:', info);
        logger.info('📧 Notification email info:', { messageId: info.messageId, response: info.response });
      }
    }
    
    logger.info('✅ Email de notification envoyé avec succès');
    return info;
    
  } catch (error) {
    logger.error('❌ Erreur envoi email notification:', error);
    // Ne pas faire planter le processus pour un email
    return { error: error.message, messageId: 'error-' + Date.now() };
  }
}

  // Email de confirmation (pour le client)
  async sendConfirmationEmail(contactData) {
  const { name, email } = contactData;
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'Souleymane Fall <souleymanefall176@gmail.com>',
    to: email,
    subject: '✅ Message reçu - DevFlow vous répond sous 2h',
    html: this.generateConfirmationHTML(contactData),
    text: this.generateConfirmationText(contactData)
  };

  try {
    const transporter = this.getTransporter();
    const info = await transporter.sendMail(mailOptions);
    
    // CORRECTION: Afficher le lien de prévisualisation correctement
    if (process.env.NODE_ENV !== 'production' && this.testAccount) {
      const nodemailer = require('nodemailer');
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log('🔗 CONFIRMATION EMAIL PREVIEW:', previewUrl);
        logger.info(`🔗 Email confirmation preview: ${previewUrl}`);
      } else {
        console.log('📧 Info confirmation:', info);
        logger.info('📧 Confirmation email info:', { messageId: info.messageId, response: info.response });
      }
    }
    
    logger.info('✅ Email de confirmation envoyé avec succès');
    return info;
    
  } catch (error) {
    logger.error('❌ Erreur envoi email confirmation:', error);
    // Ne pas faire planter le processus pour un email
    return { error: error.message, messageId: 'error-' + Date.now() };
  }
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
      </head>
      <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">💼 Nouveau Contact</h1>
            <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">DevFlow - Formulaire de contact</p>
          </div>
          
          <div style="padding: 30px;">
            <h2 style="color: #333; margin-bottom: 20px;">Informations du contact</h2>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>👤 Nom:</strong> ${name}</p>
              <p><strong>📧 Email:</strong> <a href="mailto:${email}">${email}</a></p>
              <p><strong>📞 Téléphone:</strong> ${phone || 'Non renseigné'}</p>
              <p><strong>🏢 Entreprise:</strong> ${company || 'Non renseigné'}</p>
              <p><strong>💰 Budget:</strong> ${this.formatBudget(budget)}</p>
              <p><strong>⏱️ Délai:</strong> ${this.formatTimeline(timeline)}</p>
              <p><strong>📅 Date:</strong> ${new Date(timestamp).toLocaleString('fr-FR')}</p>
            </div>
            
            <div style="background: white; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0;">
              <h3 style="color: #333; margin-top: 0;">💭 Message:</h3>
              <p style="line-height: 1.6; color: #555; white-space: pre-wrap;">${message}</p>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="mailto:${email}" style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 5px;">
                Répondre par Email
              </a>
              ${phone ? `<a href="https://wa.me/${phone.replace(/[^\d]/g, '')}" style="background: #25d366; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 5px;">Contacter WhatsApp</a>` : ''}
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

Informations:
- Nom: ${name}
- Email: ${email}
- Téléphone: ${phone || 'Non renseigné'}
- Entreprise: ${company || 'Non renseigné'}
- Budget: ${this.formatBudget(budget)}
- Délai: ${this.formatTimeline(timeline)}
- Date: ${new Date(timestamp).toLocaleString('fr-FR')}

Message:
${message}

Répondre: mailto:${email}
${phone ? `WhatsApp: https://wa.me/${phone.replace(/[^\d]/g, '')}` : ''}
    `.trim();
  }

  // Générer HTML de confirmation
  generateConfirmationHTML(data) {
    const { name } = data;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Message Reçu - DevFlow</title>
      </head>
      <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🚀 DevFlow</h1>
            <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">Votre message a été reçu</p>
          </div>
          
          <div style="padding: 30px;">
            <h2 style="color: #333;">Bonjour ${name} 👋</h2>
            
            <p style="line-height: 1.6; color: #555; font-size: 16px;">
              Merci pour votre message ! Nous avons bien reçu votre demande et nous vous répondrons dans les <strong style="color: #2196f3;">2 heures</strong> suivantes.
            </p>
            
            <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 20px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; font-weight: bold; color: #1976d2;">
                ⚡ Nous nous engageons à vous répondre rapidement !
              </p>
            </div>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #333; margin-top: 0;">🎯 Nos engagements</h3>
              <div style="margin: 10px 0;">✅ <strong>Première réponse sous 2h</strong></div>
              <div style="margin: 10px 0;">📊 <strong>Devis personnalisé sous 24h</strong></div>
              <div style="margin: 10px 0;">🚀 <strong>Démarrage du projet sous 1 semaine</strong></div>
              <div style="margin: 10px 0;">🛠️ <strong>Support technique 24/7</strong></div>
            </div>
            
            <p style="line-height: 1.6; color: #555;">
              En attendant, n'hésitez pas à nous contacter directement :
            </p>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="https://wa.me/221777151061" style="background: #25d366; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 5px;">💬 WhatsApp</a>
              <a href="tel:+221777151061" style="background: #2196f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 5px;">📞 Appeler</a>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #777; font-size: 14px;">
              <p><strong>Souleymane Fall</strong> - Développeur Full Stack</p>
              <p>📍 Dakar, Sénégal | 📧 souleymanefall176@gmail.com</p>
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

Merci pour votre message ! Nous vous répondrons dans les 2 heures suivantes.

NOS ENGAGEMENTS:
✅ Première réponse sous 2h
📊 Devis personnalisé sous 24h
🚀 Démarrage du projet sous 1 semaine
🛠️ Support technique 24/7

CONTACT DIRECT:
💬 WhatsApp: https://wa.me/221777151061
📞 Téléphone: +221 77 715 10 61

Souleymane Fall - Développeur Full Stack
📍 Dakar, Sénégal
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
          message: 'Email non configuré - Mode simulation actif',
          config: this.getConfig()
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
        error: error.message,
        config: this.getConfig()
      };
    }
  }
}

// Instance singleton
const emailService = new EmailService();

module.exports = emailService;