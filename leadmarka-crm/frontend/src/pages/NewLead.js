import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Phone, Mail, Building2, Loader2, CheckCircle, Package, Wallet, Zap } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsAPI } from '../services/api';

const SOURCE_OPTIONS = [
  { value: '', label: 'Select source (optional)' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'referral', label: 'Referral' },
  { value: 'other', label: 'Other' },
];

const CONVERSATION_LABEL_SUGGESTIONS = [
  'Price enquiry',
  'Catalog sent',
  'Delivery pending',
  'Stock check in progress',
  'Waiting for payday',
  'Needs approval',
  'Awaiting response',
  'Closed – Lost',
];

const NewLead = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    email: '',
    companyName: '',
    productOrService: '',
    variantSpecs: '',
    budgetRange: '',
    urgency: '',
    source: '',
    referrerName: '',
    status: 'new',
    conversationLabel: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const createLeadMutation = useMutation({
    mutationFn: (payload) => leadsAPI.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['leads'] });
      setSuccess(true);
      setTimeout(() => {
        navigate('/leads');
      }, 1500);
    },
    onError: (err) => {
      setError(err?.response?.data?.error || 'Failed to create lead');
    },
  });

  const loading = createLeadMutation.isPending;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    const payload = { ...formData };
    if (!payload.email?.trim()) payload.email = undefined;
    if (!payload.companyName?.trim()) payload.companyName = undefined;
    if (!payload.productOrService?.trim()) payload.productOrService = undefined;
    if (!payload.variantSpecs?.trim()) payload.variantSpecs = undefined;
    if (!payload.budgetRange?.trim()) payload.budgetRange = undefined;
    if (!payload.urgency?.trim()) payload.urgency = undefined;
    if (!payload.source?.trim()) payload.source = undefined;
    if (!payload.referrerName?.trim()) payload.referrerName = undefined;
    createLeadMutation.mutate(payload);
  };

  if (success) {
    return (
      <div className="p-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-green-900 mb-1">
            Lead created!
          </h3>
          <p className="text-green-700">
            Redirecting to leads list...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name *
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              placeholder="e.g., John Smith"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number *
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              placeholder="e.g., +263 77 123 4567"
              required
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Include country code (e.g., +263 for Zimbabwe)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email (optional)
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              placeholder="e.g., john@company.com"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Company name (optional)
          </label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              placeholder="e.g., ABC Ltd"
              maxLength={200}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Product or service (optional)
          </label>
          <div className="relative">
            <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={formData.productOrService}
              onChange={(e) => setFormData({ ...formData, productOrService: e.target.value })}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              placeholder="e.g., iPhone 13 Pro"
              maxLength={200}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Variant specs (optional)
          </label>
          <input
            type="text"
            value={formData.variantSpecs}
            onChange={(e) => setFormData({ ...formData, variantSpecs: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            placeholder="e.g., 256GB, Space Gray"
            maxLength={300}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Budget range (optional)
          </label>
          <div className="relative">
            <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={formData.budgetRange}
              onChange={(e) => setFormData({ ...formData, budgetRange: e.target.value })}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              placeholder="e.g., $500–$800"
              maxLength={120}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Urgency (optional)
          </label>
          <div className="relative">
            <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={formData.urgency}
              onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
            >
              <option value="">Not set</option>
              <option value="now">Now</option>
              <option value="soon">Soon</option>
              <option value="browsing">Just browsing</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Source (optional)
          </label>
          <select
            value={formData.source}
            onChange={(e) => setFormData({ ...formData, source: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
          >
            {SOURCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Where did this lead come from?
          </p>
        </div>

        {formData.source === 'referral' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Referrer name
            </label>
            <input
              type="text"
              value={formData.referrerName}
              onChange={(e) => setFormData({ ...formData, referrerName: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              placeholder="e.g., Jane Doe"
              maxLength={120}
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Initial Status
          </label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
          >
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="quoted">Quoted</option>
            <option value="follow-up">Follow-up</option>
            <option value="negotiating">Negotiating</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Conversation tag (optional)
          </label>
          <input
            type="text"
            list="conversation-tag-suggestions"
            value={formData.conversationLabel}
            onChange={(e) => setFormData({ ...formData, conversationLabel: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            placeholder="e.g., Price enquiry"
            maxLength={60}
          />
          <datalist id="conversation-tag-suggestions">
            {CONVERSATION_LABEL_SUGGESTIONS.map((opt) => (
              <option key={opt} value={opt} />
            ))}
          </datalist>
          <div className="flex flex-wrap gap-2 mt-2" aria-label="Conversation tag suggestions">
            {CONVERSATION_LABEL_SUGGESTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setFormData({ ...formData, conversationLabel: opt })}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 border-0 cursor-pointer"
              >
                {opt}
              </button>
            ))}
            {formData.conversationLabel && (
              <button
                type="button"
                onClick={() => setFormData({ ...formData, conversationLabel: '' })}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              >
                Clear
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Quick label to remember the WhatsApp context.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-primary-700 active:bg-primary-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Creating...
            </>
          ) : (
            'Create Lead'
          )}
        </button>
      </form>
    </div>
  );
};

export default NewLead;
