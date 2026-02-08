const supabase = require('../config/supabase');

/**
 * Compute the effective access state for a workspace subscription.
 *
 * States: 'active' | 'trialing' | 'grace' | 'read_only'
 *
 * Priority: comped > paid period > trial > grace > read_only
 */
const computeAccessState = (subscription) => {
  if (!subscription) return 'read_only';

  const now = Date.now();

  // Comped takes priority
  if (subscription.comped_until && new Date(subscription.comped_until).getTime() > now) {
    return 'active';
  }

  // Paid subscription period
  if (subscription.current_period_end && new Date(subscription.current_period_end).getTime() > now) {
    return 'active';
  }

  // Trial
  if (subscription.trial_end_at && new Date(subscription.trial_end_at).getTime() > now) {
    return 'trialing';
  }

  // Grace
  if (subscription.grace_end_at && new Date(subscription.grace_end_at).getTime() > now) {
    return 'grace';
  }

  return 'read_only';
};

/**
 * Express middleware that enforces subscription access.
 *
 * Must run AFTER workspaceMiddleware (depends on req.workspaceOwnerId).
 *
 * Behavior:
 * - trialing / grace / active: full access (next())
 * - read_only: GET/HEAD/OPTIONS allowed, writes blocked with 402
 */
const subscriptionMiddleware = async (req, res, next) => {
  try {
    const ownerId = req.workspaceOwnerId;
    if (!ownerId) {
      // No workspace context — let downstream routes handle it
      return next();
    }

    const { data: subscription, error } = await supabase
      .from('workspace_subscriptions')
      .select('*')
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (error) {
      // Table may not exist yet — fail open so users aren't blocked
      const msg = error?.message || '';
      if (msg.includes('workspace_subscriptions') && msg.includes('does not exist')) {
        req.subscriptionStatus = 'active';
        return next();
      }
      console.error('Subscription middleware error:', error.message);
      req.subscriptionStatus = 'active';
      return next();
    }

    const accessState = computeAccessState(subscription);
    req.subscriptionStatus = accessState;
    req.subscription = subscription;

    if (accessState === 'read_only') {
      const method = req.method.toUpperCase();
      if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        return res.status(402).json({
          code: 'SUBSCRIPTION_REQUIRED',
          status: 'read_only',
          message: 'Your subscription has expired. Please renew to continue using LeadMarka.',
        });
      }
    }

    next();
  } catch (err) {
    console.error('Subscription middleware error:', err);
    // Fail open — don't block the user if subscription check fails
    req.subscriptionStatus = 'active';
    next();
  }
};

module.exports = { subscriptionMiddleware, computeAccessState };
