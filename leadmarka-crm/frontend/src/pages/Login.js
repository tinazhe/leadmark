import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import LegalFooter from '../components/LegalFooter';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const logoUrl = `${process.env.PUBLIC_URL}/leadmarka_logo-color.svg`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(formData.email, formData.password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 flex flex-col justify-center px-4 py-8">
        <div className="max-w-sm mx-auto w-full">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-xl mb-4 border border-gray-200 shadow-sm">
              <img src={logoUrl} alt="LeadMarka logo" className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">LeadMarka</h1>
            <p className="text-gray-600 mt-1">Never forget a WhatsApp lead</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  data-testid="login-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  data-testid="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <Link
                to="/forgot-password"
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                Forgot password?
              </Link>
            </div>

            <button
              data-testid="login-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-primary-700 active:bg-primary-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Sign Up Link */}
          <p className="text-center mt-6 text-sm text-gray-600">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Sign up
            </Link>
          </p>

          <LegalFooter className="mt-6" />
        </div>
      </div>
    </div>
  );
};

export default Login;
