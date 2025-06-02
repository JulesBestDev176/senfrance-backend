const validator = require('validator');
const logger = require('./logger');

class Validators {
  // Validation personnalisée pour le nom
  static validateName(name) {
    if (!name || typeof name !== 'string') {
      return { isValid: false, message: 'Le nom est requis' };
    }
    
    const trimmedName = name.trim();
    
    if (trimmedName.length < 2) {
      return { isValid: false, message: 'Le nom doit contenir au moins 2 caractères' };
    }
    
    if (trimmedName.length > 50) {
      return { isValid: false, message: 'Le nom ne peut pas dépasser 50 caractères' };
    }
    
    // Vérifier les caractères autorisés (lettres, espaces, apostrophes, tirets)
    const nameRegex = /^[a-zA-ZÀ-ÿ\s'-]+$/;
    if (!nameRegex.test(trimmedName)) {
      return { isValid: false, message: 'Le nom ne peut contenir que des lettres, espaces, apostrophes et tirets' };
    }
    
    return { isValid: true, sanitized: trimmedName };
  }

  // Validation avancée pour l'email
  static validateEmail(email) {
    if (!email || typeof email !== 'string') {
      return { isValid: false, message: 'L\'email est requis' };
    }
    
    const trimmedEmail = email.trim().toLowerCase();
    
    if (!validator.isEmail(trimmedEmail)) {
      return { isValid: false, message: 'Format d\'email invalide' };
    }
    
    if (trimmedEmail.length > 100) {
      return { isValid: false, message: 'L\'email ne peut pas dépasser 100 caractères' };
    }
    
    // Vérifier les domaines suspects ou temporaires
    const suspiciousDomains = [
      '10minutemail.com',
      'tempmail.org',
      'guerrillamail.com',
      'mailinator.com'
    ];
    
    const domain = trimmedEmail.split('@')[1];
    if (suspiciousDomains.includes(domain)) {
      logger.warn(`Email temporaire détecté: ${trimmedEmail}`);
      return { isValid: false, message: 'Veuillez utiliser un email permanent' };
    }
    
    return { isValid: true, sanitized: trimmedEmail };
  }

  // Validation du numéro de téléphone
  static validatePhone(phone) {
    if (!phone) {
      return { isValid: true, sanitized: null }; // Optionnel
    }
    
    if (typeof phone !== 'string') {
      return { isValid: false, message: 'Format de téléphone invalide' };
    }
    
    const trimmedPhone = phone.trim();
    
    // Regex pour numéros internationaux
    const phoneRegex = /^[\+]?[0-9\s\-\(\)]{8,20}$/;
    if (!phoneRegex.test(trimmedPhone)) {
      return { isValid: false, message: 'Numéro de téléphone invalide' };
    }
    
    // Nettoyer le numéro (garder seulement les chiffres et le +)
    const cleanPhone = trimmedPhone.replace(/[^\d\+]/g, '');
    
    return { isValid: true, sanitized: cleanPhone };
  }

  // Validation du message
  static validateMessage(message) {
    if (!message || typeof message !== 'string') {
      return { isValid: false, message: 'Le message est requis' };
    }
    
    const trimmedMessage = message.trim();
    
    if (trimmedMessage.length < 10) {
      return { isValid: false, message: 'Le message doit contenir au moins 10 caractères' };
    }
    
    if (trimmedMessage.length > 2000) {
      return { isValid: false, message: 'Le message ne peut pas dépasser 2000 caractères' };
    }
    
    // Vérifier le contenu spam basique
    const spamKeywords = [
      'viagra', 'casino', 'lottery', 'win money', 
      'click here', 'free money', 'guaranteed'
    ];
    
    const lowerMessage = trimmedMessage.toLowerCase();
    const hasSpam = spamKeywords.some(keyword => lowerMessage.includes(keyword));
    
    if (hasSpam) {
      logger.warn(`Message suspect détecté: ${trimmedMessage.substring(0, 50)}...`);
      return { isValid: false, message: 'Message détecté comme spam' };
    }
    
    return { isValid: true, sanitized: trimmedMessage };
  }

  // Validation du budget
  static validateBudget(budget) {
    if (!budget) {
      return { isValid: true, sanitized: null }; // Optionnel
    }
    
    const validBudgets = ['2k-5k', '5k-10k', '10k-25k', '25k-50k', '50k+'];
    
    if (!validBudgets.includes(budget)) {
      return { isValid: false, message: 'Budget invalide' };
    }
    
    return { isValid: true, sanitized: budget };
  }

  // Validation du délai
  static validateTimeline(timeline) {
    if (!timeline) {
      return { isValid: true, sanitized: null }; // Optionnel
    }
    
    const validTimelines = ['asap', '1month', '2-3months', '3-6months', '6months+'];
    
    if (!validTimelines.includes(timeline)) {
      return { isValid: false, message: 'Délai invalide' };
    }
    
    return { isValid: true, sanitized: timeline };
  }

  // Validation de l'entreprise
  static validateCompany(company) {
    if (!company) {
      return { isValid: true, sanitized: null }; // Optionnel
    }
    
    if (typeof company !== 'string') {
      return { isValid: false, message: 'Nom d\'entreprise invalide' };
    }
    
    const trimmedCompany = company.trim();
    
    if (trimmedCompany.length > 100) {
      return { isValid: false, message: 'Le nom d\'entreprise ne peut pas dépasser 100 caractères' };
    }
    
    return { isValid: true, sanitized: trimmedCompany };
  }

  // Validation de l'IP (protection contre les bots)
  static validateIP(ip) {
    if (!ip) {
      return { isValid: false, message: 'IP manquante' };
    }
    
    // Vérifier si c'est une IP valide
    if (!validator.isIP(ip)) {
      return { isValid: false, message: 'IP invalide' };
    }
    
    // Bloquer certaines plages d'IP (exemple)
    const blockedRanges = [
      '127.0.0.1', // localhost (en production)
      '0.0.0.0'
    ];
    
    if (process.env.NODE_ENV === 'production' && blockedRanges.includes(ip)) {
      return { isValid: false, message: 'IP bloquée' };
    }
    
    return { isValid: true, sanitized: ip };
  }

  // Validation complète d'un objet contact
  static validateContactData(data) {
    const errors = [];
    const sanitized = {};
    
    // Valider chaque champ
    const validations = [
      { field: 'name', validator: this.validateName },
      { field: 'email', validator: this.validateEmail },
      { field: 'message', validator: this.validateMessage },
      { field: 'phone', validator: this.validatePhone },
      { field: 'company', validator: this.validateCompany },
      { field: 'budget', validator: this.validateBudget },
      { field: 'timeline', validator: this.validateTimeline }
    ];
    
    validations.forEach(({ field, validator }) => {
      const result = validator(data[field]);
      
      if (!result.isValid) {
        errors.push({
          field,
          message: result.message
        });
      } else {
        sanitized[field] = result.sanitized;
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitized
    };
  }

  // Détecter les tentatives de spam/bot
  static detectSpamBehavior(data, req) {
    const suspiciousIndicators = [];
    
    // Temps de remplissage trop rapide (si fourni par le frontend)
    if (data.fillTime && data.fillTime < 5) {
      suspiciousIndicators.push('Remplissage trop rapide');
    }
    
    // Champs cachés remplis (honeypot)
    if (data.honeypot) {
      suspiciousIndicators.push('Honeypot rempli');
    }
    
    // User-Agent suspect
    const userAgent = req.get('User-Agent') || '';
    const botPatterns = ['bot', 'crawler', 'spider', 'scraper'];
    
    if (botPatterns.some(pattern => userAgent.toLowerCase().includes(pattern))) {
      suspiciousIndicators.push('User-Agent suspect');
    }
    
    // Referer manquant (en production)
    if (process.env.NODE_ENV === 'production' && !req.get('Referer')) {
      suspiciousIndicators.push('Referer manquant');
    }
    
    return {
      isSuspicious: suspiciousIndicators.length > 0,
      indicators: suspiciousIndicators
    };
  }
}

module.exports = Validators;