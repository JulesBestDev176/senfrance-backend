const express = require('express');
const { body } = require('express-validator');
const contactController = require('../controllers/contactController');
const validate = require('../middleware/validation');

const router = express.Router();

// Validation rules
const contactValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Le nom doit contenir entre 2 et 50 caractères')
    .matches(/^[a-zA-ZÀ-ÿ\s'-]+$/)
    .withMessage('Le nom ne doit contenir que des lettres'),
  
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Email invalide')
    .isLength({ max: 100 })
    .withMessage('Email trop long'),
  
  body('message')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Le message doit contenir entre 10 et 2000 caractères'),
  
  body('phone')
    .optional()
    .trim()
    .matches(/^[\+]?[0-9\s\-\(\)]{8,20}$/)
    .withMessage('Numéro de téléphone invalide'),
  
  body('company')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Nom de l\'entreprise trop long'),
  
  body('budget')
    .optional()
    .isIn(['2k-5k', '5k-10k', '10k-25k', '25k-50k', '50k+'])
    .withMessage('Budget invalide'),
  
  body('timeline')
    .optional()
    .isIn(['asap', '1month', '2-3months', '3-6months', '6months+'])
    .withMessage('Délai invalide')
];

// Routes
router.post('/send', contactValidation, validate, contactController.sendMessage);
router.get('/test', contactController.testEndpoint);

module.exports = router;