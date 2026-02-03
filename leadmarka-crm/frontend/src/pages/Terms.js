import React from 'react';
import { Link } from 'react-router-dom';

const SUPPORT_EMAIL = 'support@leadmarka.co.zw';

const Terms = () => {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/"
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Back to app
          </Link>
          <Link
            to="/privacy"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Privacy Policy
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-6">Effective date: February 3, 2026</p>

        <div className="space-y-4 text-sm text-gray-700">
          <p>
            These Terms of Service ("Terms") govern your use of LeadMarka ("LeadMarka", "we", "us").
            By creating an account or using the service, you agree to these Terms.
          </p>

          <h2 className="text-lg font-semibold text-gray-900">1. Accounts</h2>
          <p>
            You must provide accurate information and keep your login credentials secure. You are responsible for all
            activity on your account. If you believe your account is compromised, contact us immediately.
          </p>

          <h2 className="text-lg font-semibold text-gray-900">2. Use of the Service</h2>
          <p>
            You agree not to misuse the service, interfere with its operation, attempt unauthorized access, or use it to
            send unlawful, harmful, or deceptive content.
          </p>

          <h2 className="text-lg font-semibold text-gray-900">3. Your Data</h2>
          <p>
            You own the data you enter into LeadMarka, including leads, notes, and follow-ups. You grant us a limited
            license to host, process, and display your data solely to provide the service.
          </p>

          <h2 className="text-lg font-semibold text-gray-900">4. Third-Party Services</h2>
          <p>
            We rely on third-party providers (for example Supabase for data storage and Resend for email delivery). Your
            use of LeadMarka is subject to their relevant terms and policies.
          </p>

          <h2 className="text-lg font-semibold text-gray-900">5. Availability and Changes</h2>
          <p>
            We aim for high availability but do not guarantee uninterrupted service. We may update or change features
            over time. We will try to give notice of material changes when practical.
          </p>

          <h2 className="text-lg font-semibold text-gray-900">6. Termination</h2>
          <p>
            You may stop using the service at any time. We may suspend or terminate accounts that violate these Terms or
            pose a security risk. To request account deletion, contact us at {SUPPORT_EMAIL}.
          </p>

          <h2 className="text-lg font-semibold text-gray-900">7. Disclaimers</h2>
          <p>
            LeadMarka is provided "as is" and "as available". We do not warrant that the service will be error-free or
            meet all of your requirements.
          </p>

          <h2 className="text-lg font-semibold text-gray-900">8. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, LeadMarka will not be liable for indirect, incidental, special,
            consequential, or punitive damages, or for loss of profits or data arising from your use of the service.
          </p>

          <h2 className="text-lg font-semibold text-gray-900">9. Governing Law</h2>
          <p>
            These Terms are governed by the laws of Zimbabwe, without regard to conflict of law principles.
          </p>

          <h2 className="text-lg font-semibold text-gray-900">10. Contact</h2>
          <p>
            Questions about these Terms? Email us at{' '}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              {SUPPORT_EMAIL}
            </a>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Terms;
