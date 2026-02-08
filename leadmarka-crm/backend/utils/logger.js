/**
 * Structured logging utility
 * Provides consistent logging format with sensitive data sanitization
 */

const LOG_LEVELS = {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
};

/**
 * Sanitize sensitive data from logs
 * @param {any} data - Data to sanitize
 * @returns {any} Sanitized data
 */
function sanitize(data) {
    if (typeof data === 'string') {
        // Mask phone numbers (show first 3 and last 2 digits)
        data = data.replace(/(\d{3})\d{5}(\d{2})/g, '$1*****$2');

        // Mask API keys and secrets
        if (data.length > 8 && (data.includes('key') || data.includes('secret'))) {
            return `${data.substring(0, 4)}****${data.substring(data.length - 4)}`;
        }

        return data;
    }

    if (typeof data !== 'object' || data === null) {
        return data;
    }

    if (Array.isArray(data)) {
        return data.map(sanitize);
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase();

        // Completely redact sensitive fields
        if (lowerKey.includes('password') || lowerKey.includes('secret') || lowerKey.includes('key')) {
            sanitized[key] = '***REDACTED***';
        } else if (lowerKey.includes('phone')) {
            sanitized[key] = typeof value === 'string' ? value.replace(/(\d{3})\d{5}(\d{2})/g, '$1*****$2') : value;
        } else if (typeof value === 'object') {
            sanitized[key] = sanitize(value);
        } else {
            sanitized[key] = value;
        }
    }

    return sanitized;
}

/**
 * Format log message
 * @param {string} level - Log level
 * @param {string} component - Component name
 * @param {string} message - Log message
 * @param {Object} context - Additional context
 * @returns {string} Formatted log message
 */
function formatLog(level, component, message, context = {}) {
    const timestamp = new Date().toISOString();
    const sanitizedContext = sanitize(context);

    const logObject = {
        timestamp,
        level,
        component,
        message,
        ...sanitizedContext,
    };

    return JSON.stringify(logObject);
}

/**
 * Log a message
 * @param {string} level - Log level
 * @param {string} component - Component name
 * @param {string} message - Log message
 * @param {Object} context - Additional context
 */
function log(level, component, message, context = {}) {
    const formattedLog = formatLog(level, component, message, context);

    // In development, pretty print
    if (process.env.NODE_ENV !== 'production') {
        const emoji = {
            debug: '🔍',
            info: 'ℹ️',
            warn: '⚠️',
            error: '❌',
        };
        console.log(`${emoji[level] || ''} [${component}] ${message}`, Object.keys(context).length > 0 ? sanitize(context) : '');
    } else {
        // In production, output JSON for log aggregation
        console.log(formattedLog);
    }
}

/**
 * Payment-specific logger
 */
const paymentLogger = {
    /**
     * Log payment initiation
     */
    paymentInitiated(reference, amount, phone, context = {}) {
        log(LOG_LEVELS.INFO, 'payment', 'Payment initiated', {
            reference,
            amount,
            phone,
            ...context,
        });
    },

    /**
     * Log payment success
     */
    paymentSucceeded(reference, paynowReference, context = {}) {
        log(LOG_LEVELS.INFO, 'payment', 'Payment succeeded', {
            reference,
            paynowReference,
            ...context,
        });
    },

    /**
     * Log payment failure
     */
    paymentFailed(reference, error, context = {}) {
        log(LOG_LEVELS.ERROR, 'payment', 'Payment failed', {
            reference,
            error: error?.message || error,
            ...context,
        });
    },

    /**
     * Log webhook received
     */
    webhookReceived(reference, status, context = {}) {
        log(LOG_LEVELS.INFO, 'payment-webhook', 'Webhook received', {
            reference,
            status,
            ...context,
        });
    },

    /**
     * Log webhook validation failure
     */
    webhookValidationFailed(reason, context = {}) {
        log(LOG_LEVELS.WARN, 'payment-webhook', 'Webhook validation failed', {
            reason,
            ...context,
        });
    },

    /**
     * Log subscription extended
     */
    subscriptionExtended(ownerId, periodEnd, context = {}) {
        log(LOG_LEVELS.INFO, 'subscription', 'Subscription extended', {
            ownerId,
            periodEnd,
            ...context,
        });
    },
};

module.exports = {
    LOG_LEVELS,
    log,
    sanitize,
    paymentLogger,
};
