import { ErrorCodes } from './error-codes.constant';

/**
 * Message severity levels for UI display and logging purposes
 */
type MessageSeverity = 'info' | 'success' | 'warning' | 'error';

/**
 * Supported languages for internationalization
 */
type SupportedLanguage = 'en' | 'he' | 'fr';

/**
 * Message template structure with translations
 */
interface MessageTemplate {
  code: string;
  severity: MessageSeverity;
  templates: Record<SupportedLanguage, string>;
}

/**
 * Comprehensive message templates for consistent user communication across the application.
 * Supports Hebrew (RTL), English, and French with cultural sensitivity considerations.
 */
export const Messages = {
  AUTH: {
    LOGIN_SUCCESS: {
      code: 'AUTH001',
      severity: 'success',
      templates: {
        en: 'Successfully logged in',
        he: 'התחברת בהצלחה',
        fr: 'Connexion réussie'
      }
    },
    LOGIN_FAILED: {
      code: 'AUTH002',
      severity: 'error',
      errorCode: ErrorCodes.INVALID_CREDENTIALS,
      templates: {
        en: 'Invalid credentials',
        he: 'פרטי התחברות שגויים',
        fr: 'Identifiants invalides'
      }
    },
    LOGOUT_SUCCESS: {
      code: 'AUTH003',
      severity: 'info',
      templates: {
        en: 'Successfully logged out',
        he: 'התנתקת בהצלחה',
        fr: 'Déconnexion réussie'
      }
    },
    SESSION_EXPIRED: {
      code: 'AUTH004',
      severity: 'warning',
      errorCode: ErrorCodes.INVALID_TOKEN,
      templates: {
        en: 'Your session has expired. Please log in again',
        he: 'פג תוקף החיבור שלך. אנא התחבר מחדש',
        fr: 'Votre session a expiré. Veuillez vous reconnecter'
      }
    }
  },

  VALIDATION: {
    REQUIRED_FIELD: {
      code: 'VAL001',
      severity: 'error',
      errorCode: ErrorCodes.VALIDATION_ERROR,
      templates: {
        en: 'Field {field} is required',
        he: 'שדה {field} הוא חובה',
        fr: 'Le champ {field} est requis'
      }
    },
    INVALID_FORMAT: {
      code: 'VAL002',
      severity: 'error',
      errorCode: ErrorCodes.VALIDATION_ERROR,
      templates: {
        en: 'Invalid format for {field}',
        he: 'פורמט לא תקין עבור {field}',
        fr: 'Format invalide pour {field}'
      }
    },
    AMOUNT_RANGE: {
      code: 'VAL003',
      severity: 'error',
      errorCode: ErrorCodes.VALIDATION_ERROR,
      templates: {
        en: 'Amount must be between {min} and {max}',
        he: 'הסכום חייב להיות בין {min} ל-{max}',
        fr: 'Le montant doit être compris entre {min} et {max}'
      }
    }
  },

  DONATION: {
    SUCCESS: {
      code: 'DON001',
      severity: 'success',
      templates: {
        en: 'Thank you for your donation of {amount} {currency}',
        he: 'תודה על תרומתך בסך {amount} {currency}',
        fr: 'Merci pour votre don de {amount} {currency}'
      }
    },
    PROCESSING: {
      code: 'DON002',
      severity: 'info',
      templates: {
        en: 'Processing your donation...',
        he: 'מעבד את תרומתך...',
        fr: 'Traitement de votre don...'
      }
    },
    FAILED: {
      code: 'DON003',
      severity: 'error',
      errorCode: ErrorCodes.PAYMENT_ERROR,
      templates: {
        en: 'Donation failed: {reason}',
        he: 'התרומה נכשלה: {reason}',
        fr: 'Échec du don: {reason}'
      }
    }
  },

  CAMPAIGN: {
    CREATED: {
      code: 'CAM001',
      severity: 'success',
      templates: {
        en: 'Campaign "{name}" created successfully',
        he: 'הקמפיין "{name}" נוצר בהצלחה',
        fr: 'Campagne "{name}" créée avec succès'
      }
    },
    GOAL_REACHED: {
      code: 'CAM002',
      severity: 'success',
      templates: {
        en: 'Campaign goal of {amount} {currency} reached!',
        he: 'יעד הקמפיין של {amount} {currency} הושג!',
        fr: 'Objectif de campagne de {amount} {currency} atteint!'
      }
    },
    EXPIRED: {
      code: 'CAM003',
      severity: 'warning',
      templates: {
        en: 'Campaign has ended on {date}',
        he: 'הקמפיין הסתיים בתאריך {date}',
        fr: 'La campagne s\'est terminée le {date}'
      }
    }
  },

  PAYMENT: {
    PROCESSING: {
      code: 'PAY001',
      severity: 'info',
      templates: {
        en: 'Processing payment...',
        he: 'מעבד תשלום...',
        fr: 'Traitement du paiement...'
      }
    },
    SUCCESS: {
      code: 'PAY002',
      severity: 'success',
      templates: {
        en: 'Payment processed successfully',
        he: 'התשלום עובד בהצלחה',
        fr: 'Paiement traité avec succès'
      }
    },
    FAILED: {
      code: 'PAY003',
      severity: 'error',
      errorCode: ErrorCodes.PAYMENT_ERROR,
      templates: {
        en: 'Payment failed: {reason}',
        he: 'התשלום נכשל: {reason}',
        fr: 'Échec du paiement: {reason}'
      }
    }
  },

  ASSOCIATION: {
    VERIFIED: {
      code: 'ASS001',
      severity: 'success',
      templates: {
        en: 'Association verified successfully',
        he: 'העמותה אומתה בהצלחה',
        fr: 'Association vérifiée avec succès'
      }
    },
    DOCUMENTS_REQUIRED: {
      code: 'ASS002',
      severity: 'warning',
      templates: {
        en: 'Additional documents required for verification',
        he: 'נדרשים מסמכים נוספים לאימות',
        fr: 'Documents supplémentaires requis pour la vérification'
      }
    },
    STATUS_UPDATED: {
      code: 'ASS003',
      severity: 'info',
      templates: {
        en: 'Association status updated to {status}',
        he: 'סטטוס העמותה עודכן ל-{status}',
        fr: 'Statut de l\'association mis à jour à {status}'
      }
    }
  },

  SYSTEM: {
    MAINTENANCE: {
      code: 'SYS001',
      severity: 'warning',
      templates: {
        en: 'System maintenance scheduled for {date}',
        he: 'תחזוקת מערכת מתוכננת ל-{date}',
        fr: 'Maintenance système prévue pour le {date}'
      }
    },
    ERROR: {
      code: 'SYS002',
      severity: 'error',
      errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
      templates: {
        en: 'An unexpected error occurred',
        he: 'אירעה שגיאה בלתי צפויה',
        fr: 'Une erreur inattendue s\'est produite'
      }
    },
    RATE_LIMIT: {
      code: 'SYS003',
      severity: 'error',
      errorCode: ErrorCodes.RATE_LIMIT_EXCEEDED,
      templates: {
        en: 'Too many requests. Please try again later',
        he: 'יותר מדי בקשות. אנא נסה שוב מאוחר יותר',
        fr: 'Trop de requêtes. Veuillez réessayer plus tard'
      }
    }
  }
};