const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { captureException } = require('../sentry');
const { paymentLogger } = require('../utils/logger');

const PAYNOW_INITIATE_URL = 'https://www.paynow.co.zw/interface/remotetransaction';
const REQUEST_TIMEOUT_MS = 30000; // 30 seconds
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000; // 1 second

/**
 * Generate a Paynow-compatible SHA512 hash.
 * Concatenate all values (excluding hash), append integration key, SHA512, uppercase hex.
 * @param {Array<string>} values - Array of values to hash
 * @param {string} integrationKey - Paynow integration key
 * @returns {string} Uppercase hex SHA512 hash
 */
const generateHash = (values, integrationKey) => {
  const concat = values.join('') + integrationKey;
  return crypto.createHash('sha512').update(concat, 'utf8').digest('hex').toUpperCase();
};

/**
 * Validate an inbound hash from Paynow using timing-attack resistant comparison.
 * @param {Object} fields - key/value pairs from Paynow (URL-decoded)
 * @param {string} receivedHash - the hash value from the message
 * @param {string} integrationKey - Paynow integration key
 * @returns {boolean} True if hash is valid
 */
const validateHash = (fields, receivedHash, integrationKey) => {
  if (!receivedHash) return false;

  const values = [];
  for (const [key, value] of Object.entries(fields)) {
    if (key.toLowerCase() !== 'hash') {
      values.push(value || '');
    }
  }

  const expectedHash = generateHash(values, integrationKey);
  const expectedHashUpper = expectedHash.toUpperCase();
  const receivedHashUpper = receivedHash.toUpperCase();

  // Timing-attack resistant comparison
  if (expectedHashUpper.length !== receivedHashUpper.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(expectedHashUpper),
    Buffer.from(receivedHashUpper)
  );
};

/**
 * Parse a Paynow URL-encoded response string into an object.
 * @param {string} responseStr - URL-encoded response from Paynow
 * @returns {Object} Parsed response object
 */
const parsePaynowResponse = (responseStr) => {
  const pairs = (responseStr || '').split('&');
  const result = {};
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const key = pair.substring(0, eqIdx).trim();
    const value = decodeURIComponent(pair.substring(eqIdx + 1).replace(/\+/g, ' '));
    result[key.toLowerCase()] = value;
  }
  return result;
};

/**
 * Low-level HTTP POST helper with timeout and retry support.
 * @param {string} url - URL to POST to
 * @param {string} body - Request body
 * @param {string} contentType - Content type header
 * @param {number} retryCount - Current retry attempt
 * @returns {Promise<string>} Response body
 */
const httpPost = (url, body, contentType = 'application/x-www-form-urlencoded', retryCount = 0) => {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const lib = urlObj.protocol === 'https:' ? https : http;

    const options = {
      method: 'POST',
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      headers: {
        'Content-Type': contentType,
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'LeadMarka/1.0',
      },
      timeout: REQUEST_TIMEOUT_MS,
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const error = new Error(`Request timeout after ${REQUEST_TIMEOUT_MS}ms`);

      // Retry on timeout
      if (retryCount < MAX_RETRIES) {
        paymentLogger.paymentFailed('unknown', error, { retryCount, retrying: true });
        setTimeout(() => {
          httpPost(url, body, contentType, retryCount + 1)
            .then(resolve)
            .catch(reject);
        }, RETRY_DELAY_MS);
      } else {
        reject(error);
      }
    });

    req.on('error', (err) => {
      // Retry on network errors
      if (retryCount < MAX_RETRIES && (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND')) {
        paymentLogger.paymentFailed('unknown', err, { retryCount, retrying: true, errorCode: err.code });
        setTimeout(() => {
          httpPost(url, body, contentType, retryCount + 1)
            .then(resolve)
            .catch(reject);
        }, RETRY_DELAY_MS);
      } else {
        reject(err);
      }
    });

    req.write(body);
    req.end();
  });
};

/**
 * Initiate an EcoCash mobile money payment via Paynow.
 * Sends a USSD push to the subscriber's phone.
 * @param {Object} params - Payment parameters
 * @param {string} params.integrationId - Paynow integration ID
 * @param {string} params.integrationKey - Paynow integration key
 * @param {string} params.reference - Unique payment reference
 * @param {number} params.amount - Payment amount in USD
 * @param {string} params.email - Customer email
 * @param {string} params.phone - Customer phone number (ZW format)
 * @param {string} params.resultUrl - Webhook callback URL
 * @param {string} params.returnUrl - User return URL after payment
 * @param {string} params.additionalInfo - Additional payment description
 * @returns {Promise<Object>} Payment initiation result
 */
const initiateEcocashPayment = async ({
  integrationId,
  integrationKey,
  reference,
  amount,
  email,
  phone,
  resultUrl,
  returnUrl,
  additionalInfo,
}) => {
  const startTime = Date.now();

  try {
    if (!integrationId || !integrationKey) {
      throw new Error('Paynow integration credentials are required');
    }

    if (!reference || !amount || !phone) {
      throw new Error('Payment reference, amount, and phone are required');
    }

    const fields = {
      id: String(integrationId),
      reference,
      amount: Number(amount).toFixed(2),
      additionalinfo: additionalInfo || 'LeadMarka Pro subscription',
      returnurl: returnUrl,
      resulturl: resultUrl,
      authemail: email || '',
      phone,
      method: 'ecocash',
      status: 'Message',
    };

    const values = Object.values(fields);
    fields.hash = generateHash(values, integrationKey);

    const body = Object.entries(fields)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    paymentLogger.paymentInitiated(reference, amount, phone, {
      duration: 'initiating',
      resultUrl,
    });

    const responseStr = await httpPost(PAYNOW_INITIATE_URL, body);
    const parsed = parsePaynowResponse(responseStr);

    const duration = Date.now() - startTime;

    if ((parsed.status || '').toLowerCase() === 'error') {
      const error = parsed.error || 'Payment initiation failed';
      paymentLogger.paymentFailed(reference, error, { duration });
      return { success: false, error };
    }

    // Validate response hash
    if (parsed.hash) {
      const responseValues = [];
      for (const [key, value] of Object.entries(parsed)) {
        if (key !== 'hash') responseValues.push(value);
      }
      const expectedHash = generateHash(responseValues, integrationKey);
      if (expectedHash !== parsed.hash.toUpperCase()) {
        const error = 'Invalid response hash from Paynow';
        paymentLogger.paymentFailed(reference, error, { duration });
        return { success: false, error };
      }
    }

    paymentLogger.paymentInitiated(reference, amount, phone, {
      status: 'success',
      paynowReference: parsed.paynowreference,
      duration,
    });

    return {
      success: true,
      browserUrl: parsed.browserurl || null,
      pollUrl: parsed.pollurl || null,
      status: parsed.status,
      paynowReference: parsed.paynowreference || null,
    };
  } catch (err) {
    const duration = Date.now() - startTime;
    paymentLogger.paymentFailed(reference, err, { duration });
    captureException(err, {
      tags: { component: 'paynow-initiate' },
      extra: { reference, amount, phone },
    });
    throw err;
  }
};

/**
 * Poll Paynow for the current status of a transaction.
 * @param {string} pollUrl - Paynow poll URL
 * @returns {Promise<Object|null>} Transaction status or null on error
 */
const pollTransaction = async (pollUrl) => {
  if (!pollUrl) return null;

  try {
    const responseStr = await httpPost(pollUrl, '');
    const parsed = parsePaynowResponse(responseStr);

    if (parsed.reference) {
      paymentLogger.webhookReceived(parsed.reference, parsed.status, {
        source: 'poll',
        paynowReference: parsed.paynowreference,
      });
    }

    return parsed;
  } catch (err) {
    console.error('Paynow poll error:', err.message);
    captureException(err, {
      tags: { component: 'paynow-poll' },
      extra: { pollUrl },
    });
    return null;
  }
};

module.exports = {
  generateHash,
  validateHash,
  parsePaynowResponse,
  initiateEcocashPayment,
  pollTransaction,
};
