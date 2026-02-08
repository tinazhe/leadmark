/**
 * Paynow Configuration Module
 * Centralizes Paynow-related configuration and validates environment variables
 */

const PAYNOW_MODES = {
    LIVE: 'live',
    TEST: 'test',
};

/**
 * Get the current Paynow mode (live or test)
 * @returns {'live' | 'test'}
 */
function getPaynowMode() {
    const mode = (process.env.PAYNOW_MODE || 'live').trim().toLowerCase();
    if (!Object.values(PAYNOW_MODES).includes(mode)) {
        throw new Error(`Invalid PAYNOW_MODE: ${mode}. Must be 'live' or 'test'.`);
    }
    return mode;
}

/**
 * Validate Paynow configuration on startup
 * Throws an error if critical configuration is missing in production
 */
function validatePaynowConfig() {
    const mode = getPaynowMode();
    const isProduction = process.env.NODE_ENV === 'production';
    const errors = [];

    // Integration ID and Key are always required
    if (!process.env.PAYNOW_INTEGRATION_ID) {
        errors.push('PAYNOW_INTEGRATION_ID is not set');
    }

    if (!process.env.PAYNOW_INTEGRATION_KEY) {
        errors.push('PAYNOW_INTEGRATION_KEY is not set');
    }

    // Production-specific validations
    if (isProduction) {
        if (mode === PAYNOW_MODES.TEST) {
            console.warn('⚠️  WARNING: Paynow is in TEST mode in production environment. Set PAYNOW_MODE=live for production.');
        }

        if (!process.env.PAYNOW_RESULT_URL_BASE) {
            errors.push('PAYNOW_RESULT_URL_BASE is required in production (webhook callback URL)');
        }

        if (!process.env.PAYNOW_RETURN_URL_BASE && !process.env.FRONTEND_URL) {
            errors.push('PAYNOW_RETURN_URL_BASE or FRONTEND_URL is required in production');
        }
    }

    // Test mode validations
    if (mode === PAYNOW_MODES.TEST) {
        if (!process.env.PAYNOW_TEST_AUTH_EMAIL) {
            errors.push('PAYNOW_TEST_AUTH_EMAIL is required when PAYNOW_MODE=test');
        }
    }

    if (errors.length > 0) {
        const errorMessage = `Paynow configuration errors:\n${errors.map(e => `  - ${e}`).join('\n')}`;
        throw new Error(errorMessage);
    }

    // Log configuration summary (without sensitive data)
    console.log(`✓ Paynow configured: mode=${mode}, integration_id=${process.env.PAYNOW_INTEGRATION_ID?.substring(0, 4)}****`);
}

/**
 * Get Paynow configuration
 * @returns {Object} Paynow configuration object
 */
function getPaynowConfig() {
    const mode = getPaynowMode();
    const resultUrlBase = (process.env.PAYNOW_RESULT_URL_BASE || '').replace(/\/+$/, '');
    const returnUrlBase = (process.env.PAYNOW_RETURN_URL_BASE || process.env.FRONTEND_URL || '').replace(/\/+$/, '');

    return {
        mode,
        integrationId: process.env.PAYNOW_INTEGRATION_ID,
        integrationKey: process.env.PAYNOW_INTEGRATION_KEY,
        resultUrlBase,
        returnUrlBase,
        testAuthEmail: process.env.PAYNOW_TEST_AUTH_EMAIL || '',
        isLiveMode: mode === PAYNOW_MODES.LIVE,
        isTestMode: mode === PAYNOW_MODES.TEST,
    };
}

/**
 * Test Paynow EcoCash numbers for sandbox mode
 * These numbers simulate different payment scenarios
 */
const PAYNOW_TEST_ECOCASH_NUMBERS = new Set([
    '0771111111', // success (5s)
    '0772222222', // delayed success (30s)
    '0773333333', // user cancelled (failed after 30s)
    '0774444444', // insufficient balance (initiate error)
]);

/**
 * Phone number normalization for Zimbabwe
 * Converts +2637xxxxxxxx to 07xxxxxxxx format
 * @param {string} raw - Raw phone number input
 * @returns {string} Normalized phone number
 */
function normalizeZwPhone(raw) {
    const digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return '';
    // Convert +2637xxxxxxxx -> 07xxxxxxxx
    if (digits.startsWith('263') && digits.length === 12) {
        return `0${digits.slice(3)}`;
    }
    return digits;
}

/**
 * Map Paynow error messages to user-friendly messages
 * @param {string} rawError - Raw error from Paynow
 * @param {string} paynowMode - Current Paynow mode
 * @returns {string} User-friendly error message
 */
function mapPaynowError(rawError, paynowMode) {
    const msg = String(rawError || '');
    if (paynowMode === PAYNOW_MODES.TEST && msg.toLowerCase().includes('currently in test mode')) {
        return 'Paynow sandbox is enabled. For EcoCash test payments, use one of: 0771111111 (success), 0772222222 (delayed success), 0773333333 (cancelled), 0774444444 (insufficient balance).';
    }
    return msg || 'Payment initiation failed';
}

module.exports = {
    PAYNOW_MODES,
    getPaynowMode,
    validatePaynowConfig,
    getPaynowConfig,
    PAYNOW_TEST_ECOCASH_NUMBERS,
    normalizeZwPhone,
    mapPaynowError,
};
