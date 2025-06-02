const emailService = require('../services/emailService');
const logger = require('../utils/logger');

const contactController = {
  // Envoyer un message de contact
  async sendMessage(req, res) {
    try {
      const { name, email, message, phone, company, budget, timeline } = req.body;
      
      logger.info(`📨 Nouveau message de contact de ${name} (${email})`);

      // Préparer les données
      const contactData = {
        name,
        email,
        message,
        phone: phone || 'Non renseigné',
        company: company || 'Non renseigné',
        budget: budget || 'Non renseigné',
        timeline: timeline || 'Non renseigné',
        timestamp: new Date().toISOString(),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      };

      // Envoyer les emails
      const emailResults = await Promise.allSettled([
        emailService.sendNotificationEmail(contactData),
        emailService.sendConfirmationEmail(contactData)
      ]);

      // Vérifier les résultats
      const notificationResult = emailResults[0];
      const confirmationResult = emailResults[1];

      if (notificationResult.status === 'rejected') {
        logger.error('Erreur envoi email notification:', notificationResult.reason);
      }

      if (confirmationResult.status === 'rejected') {
        logger.error('Erreur envoi email confirmation:', confirmationResult.reason);
      }

      // Réponse de succès même si un email échoue
      const response = {
        success: true,
        message: 'Message envoyé avec succès',
        data: {
          timestamp: contactData.timestamp,
          notificationSent: notificationResult.status === 'fulfilled',
          confirmationSent: confirmationResult.status === 'fulfilled'
        }
      };

      logger.info(`✅ Message traité avec succès pour ${email}`);
      res.status(200).json(response);

    } catch (error) {
      logger.error('Erreur dans sendMessage:', error);
      
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Endpoint de test
  async testEndpoint(req, res) {
    res.status(200).json({
      success: true,
      message: 'API Contact fonctionnelle',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    });
  }
};

module.exports = contactController;