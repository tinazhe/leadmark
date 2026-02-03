import React from 'react';
import { Link } from 'react-router-dom';

const SUPPORT_EMAIL = 'support@leadmarka.co.zw';

const Privacy = () => {
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
            to="/terms"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Terms of Service
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-6">Effective date: February 3, 2026</p>

        <div className="space-y-4 text-sm text-gray-700">
          <p>
            This Privacy Policy explains how LeadMarka ("we", "us") collects, uses, and shares information when you use
            our service.
          </p>

          <h2 className="text-lg font-semibold text-gray-900">1. Information We Collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Account data such as your name, business name, and email address.</li>
            <li>Lead data you enter, including contact details, notes, and follow-up reminders.</li>
            <li>Settings data such as timezone and reminder preferences.</li>
            <li>Basic usage and diagnostic data to keep the service reliable and secure.</li>
          </ul>

          <h2 className="text-lg font-semibold text-gray-900">2. How We Use Information</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Provide and improve the LeadMarka service.</li>
            <li>Send reminder and account-related emails.</li>
            <li>Respond to support requests and troubleshoot issues.</li>
            <li>Protect against fraud, abuse, or security risks.</li>
          </ul>

          <h2 className="text-lg font-semibold text-gray-900">3. How We Share Information</h2>
          <p>
            We do not sell your personal information. We share data only with service providers needed to run the
            product, such as Supabase (data storage) and Resend (email delivery), or if required by law.
          </p>

          <h2 className="text-lg font-semibold text-gray-900">4. Data Storage and Security</h2>
          <p>
            We use industry-standard security practices to protect your information. However, no method of storage is
            completely secure, so we cannot guarantee absolute security.
          </p>

          <h2 className="text-lg font-semibold text-gray-900">5. Cookies and Local Storage</h2>
          <p>
            LeadMarka uses local storage in your browser to keep you signed in. You can clear your browser data to remove
            these tokens, but you will need to log in again.
          </p>

          <h2 className="text-lg font-semibold text-gray-900">6. Data Retention</h2>
          <p>
            We retain your data while your account is active. You can delete leads and notes within the app. To request
            account deletion, contact us at {SUPPORT_EMAIL}.
          </p>

          <h2 className="text-lg font-semibold text-gray-900">7. International Transfers</h2>
          <p>
            Our service providers may process data in countries outside your own. By using LeadMarka, you consent to
            these transfers.
          </p>

          <h2 className="text-lg font-semibold text-gray-900">8. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will post the updated version in the app with a new
            effective date.
          </p>

          <h2 className="text-lg font-semibold text-gray-900">9. Contact</h2>
          <p>
            For privacy questions or requests, email us at{' '}
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

export default Privacy;
