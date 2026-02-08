const express = require('express');
const { body, validationResult } = require('express-validator');
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');
const { workspaceMiddleware } = require('../middleware/workspace');
const { initiateEcocashPayment, validateHash, pollTransaction } = require('../services/paynowService');
const { computeAccessState } = require('../middleware/subscription');
const { sendPaymentReceiptEmail } = require('../services/reminderService');
const { paymentRateLimiter, webhookRateLimiter } = require('../middleware/rateLimiter');
const {
  getPaynowConfig,
  PAYNOW_TEST_ECOCASH_NUMBERS,
  normalizeZwPhone,
  mapPaynowError
} = require('../config/paynow');
const { paymentLogger } = require('../utils/logger');

const router = express.Router();

const PLAN_AMOUNT = 15.00;
const PLAN_CURRENCY = 'USD';
const PLAN_NAME = 'LeadMarka Pro';

const PAID_STATUSES = ['paid', 'awaiting delivery', 'delivered'];

const isMissingTable = (error) => {
  const message = error?.message || '';
  return message.includes('does not exist');
};

const getOwnerEmail = async (ownerId) => {
  if (!ownerId) return null;
  try {
    const { data, error } = await supabase.auth.admin.getUserById(ownerId);
    if (error) return null;
    return data?.user?.email || null;
  } catch (err) {
    return null;
  }
};

const getOwnerDisplayName = async (ownerId) => {
  if (!ownerId) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('business_name, full_name')
    .eq('id', ownerId)
    .maybeSingle();
  if (error || !data) return null;
  return data.business_name || data.full_name || null;
};

const trySendReceiptEmail = async ({
  ownerId,
  reference,
  amount,
  currency,
  paynowReference,
  periodEnd,
}) => {
  // Guard: only send once per transaction
  const { data: lockRow } = await supabase
    .from('billing_transactions')
    .update({
      receipt_emailed_at: new Date().toISOString(),
      receipt_email_id: 'pending',
      updated_at: new Date().toISOString(),
    })
    .eq('reference', reference)
    .is('receipt_emailed_at', null)
    .select('reference')
    .maybeSingle();

  if (!lockRow) return false;

  const toEmail = await getOwnerEmail(ownerId);
  const ownerName = await getOwnerDisplayName(ownerId);
  if (!toEmail) return false;

  try {
    const emailRes = await sendPaymentReceiptEmail({
      toEmail,
      ownerName,
      amount,
      currency,
      paynowReference,
      reference,
      periodEnd,
    });

    const receiptEmailId = emailRes?.id || 'sent';
    await supabase
      .from('billing_transactions')
      .update({ receipt_email_id: receiptEmailId, updated_at: new Date().toISOString() })
      .eq('reference', reference);
  } catch (err) {
    console.error('Payment receipt email failed:', err?.message || err);
  }

  return true;
};

/** Extend the workspace subscription by 30 days from the later of now or current_period_end. */
const extendSubscription = async (ownerId) => {
  const { data: sub } = await supabase
    .from('workspace_subscriptions')
    .select('current_period_end')
    .eq('owner_id', ownerId)
    .maybeSingle();

  const currentEnd = sub?.current_period_end ? new Date(sub.current_period_end) : new Date();
  const baseDate = currentEnd.getTime() > Date.now() ? currentEnd : new Date();
  const newEnd = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);

  await supabase
    .from('workspace_subscriptions')
    .update({
      status: 'active',
      current_period_end: newEnd.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('owner_id', ownerId);

  return newEnd;
};

// ──────────────────────────────────────────────────────────────
// GET /api/billing/me — subscription status for the workspace
// ──────────────────────────────────────────────────────────────
router.get('/me', authMiddleware, workspaceMiddleware, async (req, res) => {
  try {
    const ownerId = req.workspaceOwnerId;
    const paynowConfig = getPaynowConfig();
    const paynowMode = paynowConfig.mode;

    const { data: subscription, error } = await supabase
      .from('workspace_subscriptions')
      .select('*')
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (error) {
      if (isMissingTable(error)) {
        return res.json({
          status: 'active',
          plan: PLAN_NAME,
          amount: PLAN_AMOUNT,
          currency: PLAN_CURRENCY,
          paynowMode,
        });
      }
      return res.status(400).json({ error: error.message });
    }

    if (!subscription) {
      return res.json({
        status: 'no_subscription',
        plan: PLAN_NAME,
        amount: PLAN_AMOUNT,
        currency: PLAN_CURRENCY,
        paynowMode,
      });
    }

    const accessState = computeAccessState(subscription);

    const trialDaysLeft = subscription.trial_end_at
      ? Math.max(0, Math.ceil((new Date(subscription.trial_end_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 0;

    res.json({
      status: accessState,
      plan: PLAN_NAME,
      amount: PLAN_AMOUNT,
      currency: PLAN_CURRENCY,
      trialEndsAt: subscription.trial_end_at,
      trialDaysLeft: accessState === 'trialing' ? trialDaysLeft : 0,
      graceEndsAt: subscription.grace_end_at,
      currentPeriodEnd: subscription.current_period_end,
      payerPhone: subscription.payer_phone,
      compedUntil: subscription.comped_until,
      paynowMode,
    });
  } catch (error) {
    console.error('Billing me error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──────────────────────────────────────────────────────────────
// POST /api/billing/paynow/ecocash — initiate EcoCash payment
// ──────────────────────────────────────────────────────────────
router.post('/paynow/ecocash', paymentRateLimiter, authMiddleware, workspaceMiddleware, [
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const ownerId = req.workspaceOwnerId;
    const { phone } = req.body;

    // Get Paynow configuration
    const paynowConfig = getPaynowConfig();
    const phoneNormalized = normalizeZwPhone(phone);

    if (!paynowConfig.integrationId || !paynowConfig.integrationKey) {
      paymentLogger.paymentFailed('unknown', 'Payment system not configured', { ownerId });
      return res.status(503).json({ error: 'Payment system not configured' });
    }

    if (paynowConfig.isTestMode) {
      if (!paynowConfig.testAuthEmail) {
        return res.status(503).json({
          error: 'Paynow sandbox is enabled but PAYNOW_TEST_AUTH_EMAIL is not set on the server.',
        });
      }
      if (!PAYNOW_TEST_ECOCASH_NUMBERS.has(phoneNormalized)) {
        return res.status(400).json({
          error: mapPaynowError('The ID specified is currently in test mode.', paynowConfig.mode),
        });
      }
    }

    const reference = `LM-${ownerId.slice(0, 8)}-${Date.now()}`;
    const resultUrlBase = paynowConfig.resultUrlBase;
    const returnUrlBase = paynowConfig.returnUrlBase;

    // Create billing transaction record
    const { data: txRow, error: txError } = await supabase
      .from('billing_transactions')
      .insert([{
        owner_id: ownerId,
        reference,
        amount: PLAN_AMOUNT,
        status: 'Created',
      }])
      .select()
      .single();

    if (txError) {
      if (isMissingTable(txError)) {
        return res.status(503).json({
          error: 'Billing tables not set up. Run the billing migration in Supabase SQL Editor.',
        });
      }
      return res.status(400).json({ error: txError.message });
    }

    // Call Paynow remote transaction
    const authEmail = paynowConfig.isTestMode
      ? paynowConfig.testAuthEmail
      : req.userEmail;
    const result = await initiateEcocashPayment({
      integrationId: paynowConfig.integrationId,
      integrationKey: paynowConfig.integrationKey,
      reference,
      amount: PLAN_AMOUNT,
      email: authEmail,
      phone: phoneNormalized,
      resultUrl: `${resultUrlBase}/api/billing/paynow/result`,
      returnUrl: `${returnUrlBase}/settings?payment=complete`,
      additionalInfo: `${PLAN_NAME} - $${PLAN_AMOUNT}/month`,
    });

    if (!result.success) {
      await supabase
        .from('billing_transactions')
        .update({ status: 'Error', updated_at: new Date().toISOString() })
        .eq('id', txRow.id);
      return res.status(400).json({ error: mapPaynowError(result.error, paynowConfig.mode) });
    }

    // Update transaction with poll URL
    await supabase
      .from('billing_transactions')
      .update({
        poll_url: result.pollUrl,
        paynow_reference: result.paynowReference,
        status: 'Sent',
        updated_at: new Date().toISOString(),
      })
      .eq('id', txRow.id);

    // Remember payer phone for next time
    await supabase
      .from('workspace_subscriptions')
      .update({ payer_phone: phone, updated_at: new Date().toISOString() })
      .eq('owner_id', ownerId);

    res.json({
      reference,
      status: 'Sent',
      message: 'Check your phone to confirm the EcoCash payment.',
      instructions: 'A USSD prompt has been sent to your phone. Enter your EcoCash PIN to authorize the payment.',
    });
  } catch (error) {
    console.error('EcoCash payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──────────────────────────────────────────────────────────────
// POST /api/billing/paynow/result — webhook callback from Paynow
// No auth — Paynow calls this directly. Secured by hash validation.
// ──────────────────────────────────────────────────────────────
router.post('/paynow/result', webhookRateLimiter, express.urlencoded({ extended: false }), async (req, res) => {
  try {
    const paynowConfig = getPaynowConfig();
    const { integrationKey } = paynowConfig;

    if (!integrationKey) {
      paymentLogger.webhookValidationFailed('Integration key not configured');
      return res.status(200).send('ok');
    }

    const fields = req.body || {};
    const receivedHash = fields.hash || fields.Hash || '';

    if (!validateHash(fields, receivedHash, integrationKey)) {
      paymentLogger.webhookValidationFailed('Invalid hash signature', {
        ip: req.ip,
        reference: fields.reference,
      });
      return res.status(200).send('ok');
    }

    const reference = fields.reference || '';
    const status = fields.status || '';
    const paynowReference = fields.paynowreference || '';

    if (!reference) {
      paymentLogger.webhookValidationFailed('Missing reference in webhook');
      return res.status(200).send('ok');
    }

    paymentLogger.webhookReceived(reference, status, {
      paynowReference,
      source: 'webhook',
    });

    // Update billing transaction
    const updateFields = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (paynowReference) updateFields.paynow_reference = paynowReference;

    const { data: tx, error: txError } = await supabase
      .from('billing_transactions')
      .update(updateFields)
      .eq('reference', reference)
      .select('owner_id, amount, reference, paynow_reference')
      .single();

    if (txError || !tx) {
      console.warn(`Paynow webhook: transaction not found for ref=${reference}`);
      return res.status(200).send('ok');
    }

    // If payment succeeded, extend the workspace subscription
    if (PAID_STATUSES.includes(status.toLowerCase())) {
      const newEnd = await extendSubscription(tx.owner_id);
      paymentLogger.subscriptionExtended(tx.owner_id, newEnd.toISOString(), {
        reference: tx.reference,
        amount: tx.amount,
      });
      paymentLogger.paymentSucceeded(tx.reference, tx.paynow_reference, {
        ownerId: tx.owner_id,
        amount: tx.amount,
      });
      await trySendReceiptEmail({
        ownerId: tx.owner_id,
        reference: tx.reference,
        amount: tx.amount,
        currency: PLAN_CURRENCY,
        paynowReference: tx.paynow_reference,
        periodEnd: newEnd,
      });
    }

    res.status(200).send('ok');
  } catch (error) {
    console.error('Paynow result webhook error:', error);
    // Always return 200 so Paynow doesn't retry indefinitely
    res.status(200).send('ok');
  }
});

// ──────────────────────────────────────────────────────────────
// GET /api/billing/transactions/:reference — check a transaction
// ──────────────────────────────────────────────────────────────
router.get('/transactions/:reference', authMiddleware, workspaceMiddleware, async (req, res) => {
  try {
    const { reference } = req.params;
    const ownerId = req.workspaceOwnerId;

    const { data: tx, error } = await supabase
      .from('billing_transactions')
      .select('*')
      .eq('reference', reference)
      .eq('owner_id', ownerId)
      .single();

    if (error || !tx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // If status is still pending, try polling Paynow for an update
    const pendingStatuses = ['created', 'sent'];
    if (pendingStatuses.includes(tx.status.toLowerCase()) && tx.poll_url) {
      const pollResult = await pollTransaction(tx.poll_url);
      if (pollResult && pollResult.status) {
        const newStatus = pollResult.status;
        if (newStatus.toLowerCase() !== tx.status.toLowerCase()) {
          await supabase
            .from('billing_transactions')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', tx.id);
          tx.status = newStatus;

          if (PAID_STATUSES.includes(newStatus.toLowerCase())) {
            const newEnd = await extendSubscription(ownerId);
            await trySendReceiptEmail({
              ownerId,
              reference: tx.reference,
              amount: tx.amount,
              currency: PLAN_CURRENCY,
              paynowReference: tx.paynow_reference,
              periodEnd: newEnd,
            });
          }
        }
      }
    }

    res.json({
      reference: tx.reference,
      amount: tx.amount,
      status: tx.status,
      paynowReference: tx.paynow_reference,
      createdAt: tx.created_at,
      updatedAt: tx.updated_at,
    });
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
