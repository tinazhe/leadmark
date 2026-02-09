import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  CreditCard,
  Loader2,
  Phone,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import SettingsShell from './SettingsShell';
import { billingAPI } from '../../services/api';

const BillingSettings = () => {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';

  const [sub, setSub] = useState(user?.subscription || null);
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState('');
  const [payPhone, setPayPhone] = useState('');
  const [paying, setPaying] = useState(false);
  const [payRef, setPayRef] = useState(null);
  const [payMessage, setPayMessage] = useState('');
  const [paySuccess, setPaySuccess] = useState(false);

  const loadSubscription = useCallback(async () => {
    setSubLoading(true);
    setSubError('');
    try {
      const { data } = await billingAPI.getMe();
      setSub(data);
      if (data?.payerPhone && !payPhone) setPayPhone(data.payerPhone);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to load subscription';
      setSubError(typeof msg === 'string' ? msg : 'Failed to load subscription');
    } finally {
      setSubLoading(false);
    }
  }, [payPhone]);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  useEffect(() => {
    if (!payRef || paySuccess) return;
    let active = true;
    const poll = async () => {
      try {
        const { data } = await billingAPI.getTransaction(payRef);
        if (!active) return;
        const paidStatuses = ['paid', 'awaiting delivery', 'delivered'];
        if (paidStatuses.includes((data.status || '').toLowerCase())) {
          setPaySuccess(true);
          setPayMessage('Payment successful! Your subscription is now active.');
          setPayRef(null);
          loadSubscription();
        } else if (['cancelled', 'refunded', 'error'].includes((data.status || '').toLowerCase())) {
          setPayMessage(`Payment ${data.status.toLowerCase()}. Please try again.`);
          setPayRef(null);
        }
      } catch (err) {
        // ignore poll errors
      }
    };
    const interval = setInterval(poll, 4000);
    poll();
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [payRef, paySuccess, loadSubscription]);

  const handlePay = async () => {
    if (!payPhone.trim()) return;
    setPaying(true);
    setPayMessage('');
    setPaySuccess(false);
    setSubError('');
    try {
      const { data } = await billingAPI.startEcocash({ phone: payPhone.trim() });
      setPayRef(data.reference);
      setPayMessage(data.instructions || 'Check your phone to confirm the payment.');
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Payment failed';
      setSubError(typeof msg === 'string' ? msg : 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  if (!isOwner) {
    return (
      <SettingsShell
        title="Billing"
        description="Billing is managed by the workspace owner."
      >
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
          Only workspace owners can update billing or renew subscriptions.
        </div>
      </SettingsShell>
    );
  }

  return (
    <SettingsShell
      title="Billing"
      description="Review your plan, renewal, and payment details."
    >
      <div className={`rounded-lg p-4 border space-y-3 ${
        sub?.status === 'read_only'
          ? 'bg-red-50 border-red-200'
          : sub?.status === 'grace'
            ? 'bg-yellow-50 border-yellow-200'
            : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-gray-400" />
            {sub?.plan || 'LeadMarka Pro'}
          </h3>
          {subLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
        </div>

        {sub?.paynowMode === 'test' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-800 text-sm flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-medium">Paynow sandbox (test mode)</div>
              <div className="text-xs text-yellow-800/90">
                For EcoCash test payments use one of:
                {' '}
                <span className="font-mono">0771111111</span> (success),
                {' '}
                <span className="font-mono">0772222222</span> (delayed success),
                {' '}
                <span className="font-mono">0773333333</span> (cancelled),
                {' '}
                <span className="font-mono">0774444444</span> (insufficient balance).
              </div>
            </div>
          </div>
        )}

        {subError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
            {subError}
          </div>
        )}

        {paySuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm flex items-center gap-2">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            {payMessage}
          </div>
        )}

        {sub && !subLoading && (
          <div className="text-sm text-gray-700 space-y-1">
            {sub.status === 'trialing' && (
              <>
                <p className="font-medium text-primary-700">
                  Free trial — Day {Math.max(1, 8 - (sub.trialDaysLeft || 0))} of 7
                </p>
                <p className="text-gray-500 text-xs">
                  Your follow-ups are working. Pro users close 2x more deals.
                </p>
              </>
            )}
            {sub.status === 'grace' && (
              <p className="font-medium text-yellow-700 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Trial ended — grace period (1 day remaining)
              </p>
            )}
            {sub.status === 'read_only' && (
              <p className="font-medium text-red-700 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Subscription expired — your account is read-only
              </p>
            )}
            {sub.status === 'active' && (
              <>
                <p className="font-medium text-green-700 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  Active
                </p>
                {sub.currentPeriodEnd && (
                  <p className="text-gray-500 text-xs">
                    Renews: {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                  </p>
                )}
                {sub.compedUntil && (
                  <p className="text-gray-500 text-xs">
                    Complimentary access until {new Date(sub.compedUntil).toLocaleDateString()}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {sub && !sub.compedUntil && sub.status !== 'no_subscription' && (
          <div className="space-y-2 pt-1">
            <label className="block text-sm font-medium text-gray-700">
              EcoCash number
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  value={payPhone}
                  onChange={(event) => setPayPhone(event.target.value)}
                  placeholder="07XX XXX XXX"
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                />
              </div>
              <button
                type="button"
                onClick={handlePay}
                disabled={paying || !payPhone.trim() || !!payRef}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 whitespace-nowrap"
              >
                {paying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : sub.status === 'active' ? (
                  `Pay $${sub.amount || 15} to extend`
                ) : (
                  `Pay $${sub.amount || 15}/month to continue`
                )}
              </button>
            </div>

            {payRef && !paySuccess && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-700 text-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                <span>{payMessage || 'Waiting for EcoCash confirmation...'}</span>
              </div>
            )}

            {!payRef && payMessage && !paySuccess && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                {payMessage}
              </div>
            )}

            <p className="text-xs text-gray-500">
              ${sub.amount || 15}/month per business. Unlimited leads, follow-ups, and team access.
            </p>
          </div>
        )}
      </div>
    </SettingsShell>
  );
};

export default BillingSettings;
