const mongoose = require('mongoose');

// Schéma pour stocker les contacts (optionnel mais recommandé)
const ContactSchema = new mongoose.Schema({
  // Informations principales
  name: {
    type: String,
    required: [true, 'Le nom est requis'],
    trim: true,
    minlength: [2, 'Le nom doit contenir au moins 2 caractères'],
    maxlength: [50, 'Le nom ne peut pas dépasser 50 caractères'],
    match: [/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Le nom contient des caractères invalides']
  },
  
  email: {
    type: String,
    required: [true, 'L\'email est requis'],
    trim: true,
    lowercase: true,
    maxlength: [100, 'L\'email ne peut pas dépasser 100 caractères'],
    match: [/^\S+@\S+\.\S+$/, 'Format d\'email invalide']
  },
  
  message: {
    type: String,
    required: [true, 'Le message est requis'],
    trim: true,
    minlength: [10, 'Le message doit contenir au moins 10 caractères'],
    maxlength: [2000, 'Le message ne peut pas dépasser 2000 caractères']
  },
  
  // Informations optionnelles
  phone: {
    type: String,
    trim: true,
    match: [/^[\+]?[0-9\s\-\(\)]{8,20}$/, 'Numéro de téléphone invalide']
  },
  
  company: {
    type: String,
    trim: true,
    maxlength: [100, 'Le nom d\'entreprise ne peut pas dépasser 100 caractères']
  },
  
  budget: {
    type: String,
    enum: ['2k-5k', '5k-10k', '10k-25k', '25k-50k', '50k+']
  },
  
  timeline: {
    type: String,
    enum: ['asap', '1month', '2-3months', '3-6months', '6months+']
  },
  
  // Métadonnées
  status: {
    type: String,
    enum: ['nouveau', 'lu', 'en_cours', 'traite', 'archive'],
    default: 'nouveau'
  },
  
  priority: {
    type: String,
    enum: ['basse', 'normale', 'haute', 'urgente'],
    default: 'normale'
  },
  
  source: {
    type: String,
    default: 'website'
  },
  
  // Informations techniques
  ip: {
    type: String,
    required: true
  },
  
  userAgent: {
    type: String
  },
  
  referer: {
    type: String
  },
  
  // Gestion des emails
  emailSent: {
    notification: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      messageId: String
    },
    confirmation: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      messageId: String
    }
  },
  
  // Notes administratives
  notes: [{
    content: String,
    author: String,
    createdAt: { type: Date, default: Date.now }
  }],
  
  // Suivi
  followUpDate: Date,
  lastContactDate: Date,
  
  // Anti-spam
  spamScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  isSpam: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true, // Ajoute createdAt et updatedAt automatiquement
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index pour les performances
ContactSchema.index({ email: 1 });
ContactSchema.index({ createdAt: -1 });
ContactSchema.index({ status: 1 });
ContactSchema.index({ isSpam: 1 });

// Virtuel pour le nom complet formaté
ContactSchema.virtual('formattedName').get(function() {
  return this.name.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
});

// Virtuel pour l'âge du contact
ContactSchema.virtual('age').get(function() {
  const now = new Date();
  const created = this.createdAt;
  const diffTime = Math.abs(now - created);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) return '1 jour';
  if (diffDays < 7) return `${diffDays} jours`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} semaines`;
  return `${Math.floor(diffDays / 30)} mois`;
});

// Méthodes statiques
ContactSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

ContactSchema.statics.getRecentContacts = function(days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.find({
    createdAt: { $gte: startDate },
    isSpam: false
  }).sort({ createdAt: -1 });
};

ContactSchema.statics.getContactStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        thisMonth: {
          $sum: {
            $cond: [
              {
                $gte: ['$createdAt', new Date(new Date().getFullYear(), new Date().getMonth(), 1)]
              },
              1,
              0
            ]
          }
        },
        spam: { $sum: { $cond: ['$isSpam', 1, 0] } },
        avgResponseTime: { $avg: '$responseTime' }
      }
    }
  ]);
};

// Méthodes d'instance
ContactSchema.methods.markAsRead = function() {
  this.status = 'lu';
  return this.save();
};

ContactSchema.methods.markAsSpam = function() {
  this.isSpam = true;
  this.status = 'archive';
  return this.save();
};

ContactSchema.methods.addNote = function(content, author = 'System') {
  this.notes.push({
    content,
    author,
    createdAt: new Date()
  });
  return this.save();
};

ContactSchema.methods.calculateSpamScore = function() {
  let score = 0;
  
  // Facteurs de spam
  if (this.message.length < 20) score += 20;
  if (this.email.includes('temp')) score += 30;
  if (!this.phone) score += 10;
  if (this.message.toLowerCase().includes('viagra')) score += 50;
  
  this.spamScore = Math.min(score, 100);
  this.isSpam = score > 70;
  
  return this.save();
};

// Hooks (middleware)
ContactSchema.pre('save', function(next) {
  // Calculer le score de spam avant sauvegarde
  if (this.isNew) {
    this.calculateSpamScore();
  }
  next();
});

ContactSchema.post('save', function(doc) {
  // Log après sauvegarde
  console.log(`✅ Contact sauvegardé: ${doc.name} (${doc.email})`);
});

// Méthode pour nettoyer les anciens contacts
ContactSchema.statics.cleanOldContacts = function(days = 365) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return this.deleteMany({
    createdAt: { $lt: cutoffDate },
    status: 'archive'
  });
};

module.exports = mongoose.model('Contact', ContactSchema);