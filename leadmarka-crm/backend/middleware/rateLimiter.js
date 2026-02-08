/**
 * Rate limiting middleware for payment endpoints
 * Prevents abuse and protects against DoS attacks
 */

const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for payment initiation
 * Max 5 payment attempts per minute per IP/user
 */
const paymentRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // Max 5 requests per window
    message: {
        error: 'Too many payment attempts. Please wait a moment and try again.',
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // Use IP + userId for rate limiting (more accurate than IP alone)
    keyGenerator: (req) => {
        const userId = req.userId || req.workspaceOwnerId || 'anonymous';
        const ip = req.ip || req.connection.remoteAddress;
        return `${ip}:${userId}`;
    },
    skip: (req) => {
        // Don't rate limit health checks or webhook callbacks
        return req.path.includes('/health') || req.path.includes('/result');
    },
    handler: (req, res) => {
        const { log } = require('../utils/logger');
        log('warn', 'rate-limit', 'Payment rate limit exceeded', {
            ip: req.ip,
            userId: req.userId || req.workspaceOwnerId,
            path: req.path,
        });

        res.status(429).json({
            error: 'Too many payment attempts. Please wait a moment and try again.',
        });
    },
});

/**
 * Rate limiter for webhook endpoints (more lenient)
 * Max 100 webhook callbacks per minute
 */
const webhookRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // Max 100 requests per window
    message: {
        error: 'Too many webhook requests.',
    },
    standardHeaders: false,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Rate limit by IP for webhooks
        return req.ip || req.connection.remoteAddress || 'unknown';
    },
});

module.exports = {
    paymentRateLimiter,
    webhookRateLimiter,
};
