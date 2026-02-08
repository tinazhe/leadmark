# Paynow Production Setup Guide

## Overview

This guide covers setting up the Paynow EcoCash payment integration for LeadMarka Pro subscriptions in production. Paynow is Zimbabwe's leading payment gateway for mobile money and card payments.

## Prerequisites

- Paynow merchant account
- Access to Paynow merchant portal
- Backend deployed and accessible from the public internet
- SSL/HTTPS enabled on your backend

## Step 1: Paynow Account Setup

### 1.1 Create a Paynow Merchant Account

1. Visit [Paynow](https://www.paynow.co.zw/)
2. Sign up for a merchant account
3. Complete the verification process (business registration required)
4. Wait for account approval (typically 1-3 business days)

### 1.2 Get Integration Credentials

Once your account is approved:

1. Log in to the [Paynow Merchant Portal](https://www.paynow.co.zw/Merchants/Login.aspx)
2. Navigate to **Settings** → **Integration Keys**
3. Note down your **Integration ID** and **Integration Key**
4. Keep these credentials secure - they are like passwords

> [!CAUTION]
> Never commit your Integration ID and Key to version control. Store them as environment variables only.

## Step 2: Configure Webhook URL

Webhooks allow Paynow to notify your backend when payment status changes.

### 2.1 Set Result URL in Paynow Portal

1. In the Paynow Merchant Portal, go to **Settings** → **Integration**
2. Set **Result URL** to: `https://your-backend-url.com/api/billing/paynow/result`
3. Save the settings

### 2.2 Test Webhook Accessibility

Ensure your webhook endpoint is publicly accessible:

```bash
curl -X POST https://your-backend-url.com/api/billing/paynow/result \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "status=test&reference=TEST&hash=abc"
```

You should receive a `200 OK` response (even with invalid data, since the endpoint always returns 200).

## Step 3: Environment Configuration

Configure the following environment variables in your backend deployment:

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PAYNOW_MODE` | Set to `live` for production | `live` |
| `PAYNOW_INTEGRATION_ID` | Your Integration ID from Paynow | `12345` |
| `PAYNOW_INTEGRATION_KEY`  | Your Integration Key from Paynow | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `PAYNOW_RESULT_URL_BASE` | Your backend base URL (for webhooks) | `https://api.leadmarka.co.zw` |
| `PAYNOW_RETURN_URL_BASE` | Frontend URL (where users return after payment) | `https://app.leadmarka.co.zw` |

### Example `.env` Configuration

```env
# Paynow Configuration (Production)
PAYNOW_MODE=live
PAYNOW_INTEGRATION_ID=12345
PAYNOW_INTEGRATION_KEY=your-integration-key-here
PAYNOW_RESULT_URL_BASE=https://api.leadmarka.co.zw
PAYNOW_RETURN_URL_BASE=https://app.leadmarka.co.zw

# Other required variables
FRONTEND_URL=https://app.leadmarka.co.zw
NODE_ENV=production
```

## Step 4: Testing in Sandbox Mode

Before going live, test your integration in sandbox mode.

### 4.1 Enable Test Mode

```env
PAYNOW_MODE=test
PAYNOW_TEST_AUTH_EMAIL=your-test-email@example.com
```

### 4.2 Use Test Phone Numbers

With `PAYNOW_MODE=test`, use these special test numbers:

| Phone Number | Scenario |
|--------------|----------|
| `0771111111` | Successful payment (completes in ~5 seconds) |
| `0772222222` | Delayed success (completes in ~30 seconds) |
| `0773333333` | User cancels payment (fails after ~30s) |
| `0774444444` | Insufficient balance (fails immediately) |

### 4.3 Test Payment Flow

1. Start your backend with `PAYNOW_MODE=test`
2. Log in to your frontend
3. Navigate to Settings → Subscription
4. Click "Subscribe to LeadMarka Pro"
5. Use one of the test phone numbers
6. Observe the payment flow and webhook callbacks
7. Check server logs for payment status updates

## Step 5: Going Live

### 5.1 Pre-Launch Checklist

- [ ] Paynow merchant account fully verified and approved
- [ ] Integration ID and Key obtained from Paynow portal
- [ ] Webhook URL configured in Paynow portal
- [ ] Webhook endpoint publicly accessible via HTTPS
- [ ] Environment variables set with `PAYNOW_MODE=live`
- [ ] Tested payment flow in sandbox mode
- [ ] Monitored logs for any errors

### 5.2 Switch to Live Mode

1. Update environment variables:
   ```env
   PAYNOW_MODE=live
   ```

2. Remove test-only variables:
   - Delete `PAYNOW_TEST_AUTH_EMAIL`

3. Restart your backend server

4. Verify configuration on startup:
   ```
   ✓ Paynow configured: mode=live, integration_id=1234****
   ```

### 5.3 Make a Test Payment

1. Use a real EcoCash number
2. Initiate a $15 payment through the frontend
3. Complete the USSD prompt on your phone
4. Verify subscription is activated
5. Check that receipt email is sent

## Step 6: Monitoring and Troubleshooting

### 6.1 Key Metrics to Monitor

- **Payment success rate**: Track successful vs failed payments
- **Webhook delivery**: Ensure webhooks are being received
- **Subscription activations**: Verify payments extend subscriptions
- **Receipt emails**: Confirm users receive payment confirmations

### 6.2 Common Issues

#### Webhook Not Received

**Symptoms**: Payment completes on phone but subscription not activated

**Solutions**:
1. Check webhook URL is correct in Paynow portal
2. Ensure backend is publicly accessible
3. Check firewall/security group settings
4. Review server logs for webhook requests
5. Check Paynow portal logs for delivery failures

#### Invalid Hash Errors

**Symptoms**: "Invalid response hash from Paynow" errors

**Solutions**:
1. Verify `PAYNOW_INTEGRATION_KEY` is correct
2. Ensure no whitespace in environment variables
3. Check Paynow portal for key changes
4. Review server logs for hash comparison details

#### Payment Stuck in "Sent" Status

**Symptoms**: Payment initiated but never completes

**Solutions**:
1. User may not have completed USSD prompt
2. Check EcoCash balance is sufficient
3. Verify phone number is correct format (0771234567)
4. Use transaction polling endpoint to check status
5. Contact Paynow support if issue persists

#### Rate Limiting Errors

**Symptoms**: "Too many payment attempts" error

**Solutions**:
1. This is by design - max 5 payment attempts per minute
2. Wait 1 minute before retrying
3. If legitimate high volume, contact system administrator

### 6.3 Server Logs

Monitor these log events:

```
✓ Paynow configured: mode=live
ℹ️ [payment] Payment initiated
✅ [payment] Payment succeeded
❌ [payment] Payment failed
⚠️ [payment-webhook] Webhook validation failed
ℹ️ [subscription] Subscription extended
```

### 6.4 Testing Webhook Manually

Test webhook handling with a valid signature:

```bash
# Generate a valid hash using the integration key
# Use the test script in tools/test-webhook.js

node tools/test-webhook.js
```

## Step 7: Operational Procedures

### 7.1 Handling Failed Payments

1. Check server logs for error reason
2. Verify user phone number is correct
3. Confirm EcoCash balance is sufficient
4. Check Paynow portal for transaction details
5. Support user via email/WhatsApp

### 7.2 Manual Subscription Extension

If payment succeeded but subscription wasn't extended:

```sql
-- In Supabase SQL Editor
UPDATE workspace_subscriptions
SET 
  status = 'active',
  current_period_end = NOW() + INTERVAL '30 days',
  updated_at = NOW()
WHERE owner_id = '<user-id>';
```

### 7.3 Refund Process

Paynow refunds must be initiated manually:

1. Log in to Paynow Merchant Portal
2. Navigate to **Transactions**
3. Find the transaction by Paynow reference
4. Click **Refund**
5. Complete refund process
6. Manually adjust subscription in database if needed

### 7.4 Security Best Practices

- Never log full Integration Keys
- Always validate webhook signatures
- Use HTTPS only for all endpoints
- Rotate integration keys periodically (every 6-12 months)
- Monitor for unusual payment patterns
- Set up alerts for failed payments

## Step 8: Compliance and Regulations

### 8.1 Data Protection

- Phone numbers are sanitized in logs
- Payment details are not stored beyond transaction reference
- All communication uses HTTPS
- Comply with Zimbabwe data protection laws

### 8.2 Financial Record Keeping

- Retain transaction records for 7 years minimum
- Export transaction history monthly
- Reconcile Paynow portal with database records
- Maintain audit trail for all subscription changes

## Support

### Paynow Support

- **Website**: https://www.paynow.co.zw
- **Email**: support@paynow.co.zw
- **Phone**: +263 242 786 615

### LeadMarka Support

For integration issues, check:
1. Server logs
2. Paynow portal transaction logs
3. This documentation
4. Contact system administrator

## Appendix: Environment Variables Reference

Complete list of Paynow-related environment variables:

```env
# Required in production
PAYNOW_MODE=live                                # Payment mode (live or test)
PAYNOW_INTEGRATION_ID=12345                     # From Paynow portal
PAYNOW_INTEGRATION_KEY=xxx-xxx-xxx              # From Paynow portal
PAYNOW_RESULT_URL_BASE=https://api.example.com  # Backend URL for webhooks
PAYNOW_RETURN_URL_BASE=https://app.example.com  # Frontend URL for redirects

# Required only in test mode
PAYNOW_TEST_AUTH_EMAIL=test@example.com         # Email for test transactions

# General backend configuration
FRONTEND_URL=https://app.example.com            # Fallback for PAYNOW_RETURN_URL_BASE
NODE_ENV=production                             # Environment mode
```

---

**Remember**: Test thoroughly in sandbox mode before going live. Monitor closely during the first week of production.
