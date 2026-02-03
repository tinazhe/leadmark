import React from 'react';
import { Link } from 'react-router-dom';

const SUPPORT_EMAIL = 'support@leadmarka.co.zw';

const LegalFooter = ({ className = '' }) => {
  return (
    <div className={`text-center text-xs text-gray-500 ${className}`.trim()}>
      <p>
        Need help?{' '}
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="text-primary-600 hover:text-primary-700 font-medium"
        >
          {SUPPORT_EMAIL}
        </a>
      </p>
      <div className="mt-2 flex items-center justify-center gap-3">
        <Link
          to="/terms"
          className="text-gray-500 hover:text-gray-700"
        >
          Terms
        </Link>
        <span className="text-gray-300">•</span>
        <Link
          to="/privacy"
          className="text-gray-500 hover:text-gray-700"
        >
          Privacy
        </Link>
      </div>
    </div>
  );
};

export default LegalFooter;
