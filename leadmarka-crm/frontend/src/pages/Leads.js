import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, MessageCircle, ChevronRight, Filter, X, Check, Clock, Tag } from 'lucide-react';
import { formatDistanceToNow, isToday, parseISO } from 'date-fns';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { leadsAPI } from '../services/api';

const STATUS_OPTIONS = [
  { value: 'new', label: 'New', className: 'status-new' },
  { value: 'interested', label: 'Interested', className: 'status-interested' },
  { value: 'follow-up', label: 'Follow-up', className: 'status-follow-up' },
  { value: 'won', label: 'Won', className: 'status-won' },
  { value: 'lost', label: 'Lost', className: 'status-lost' },
];

const Leads = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const queryClient = useQueryClient();

  const {
    data: leads = [],
    isLoading: loading,
    isError,
  } = useQuery({
    queryKey: ['leads', searchQuery, statusFilter],
    queryFn: async () => {
      const params = {};
      if (searchQuery) params.search = searchQuery;
      if (statusFilter) params.status = statusFilter;
      const { data } = await leadsAPI.getAll(params);
      return data || [];
    },
    placeholderData: keepPreviousData,
  });

  const error = isError ? 'Failed to load leads' : null;

  const updateStatusMutation = useMutation({
    mutationFn: ({ leadId, status }) => leadsAPI.update(leadId, { status }),
    onSuccess: (_res, { leadId, status }) => {
      // Optimistic-ish update so UI doesn't wait for refetch.
      queryClient.setQueriesData({ queryKey: ['leads'] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((lead) => (lead.id === leadId ? { ...lead, status } : lead));
      });
      queryClient.setQueryData(['lead', leadId], (old) => (old ? { ...old, status } : old));
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
    },
  });

  const markContactedMutation = useMutation({
    mutationFn: async ({ leadId }) => {
      const { data } = await leadsAPI.markWhatsappContactNow(leadId);
      return { leadId, lastWhatsappContactAt: data?.lastWhatsappContactAt || new Date().toISOString() };
    },
    onSuccess: ({ leadId, lastWhatsappContactAt }) => {
      queryClient.setQueriesData({ queryKey: ['leads'] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((lead) =>
          lead.id === leadId ? { ...lead, lastWhatsappContactAt } : lead
        );
      });
      queryClient.setQueryData(['lead', leadId], (old) => (old ? { ...old, lastWhatsappContactAt } : old));
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
    },
  });

  const handleStatusChange = (leadId, newStatus) => {
    updateStatusMutation.mutate({ leadId, status: newStatus });
  };

  const handleMarkContactedToday = async (leadId) => {
    const res = await markContactedMutation.mutateAsync({ leadId });
    return res?.lastWhatsappContactAt;
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
  };

  const hasFilters = searchQuery || statusFilter;

  return (
    <div className="p-4 space-y-4">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or phone..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`p-3 rounded-lg border transition-colors ${
            showFilters || statusFilter
              ? 'bg-primary-50 border-primary-300 text-primary-700'
              : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Filter className="w-5 h-5" />
        </button>
      </div>

      {/* Status Filter */}
      {showFilters && (
        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Filter by status</span>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status.value}
                onClick={() => setStatusFilter(statusFilter === status.value ? '' : status.value)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  statusFilter === status.value
                    ? status.className
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active Filter Badge */}
      {statusFilter && !showFilters && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Filtered by:</span>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-primary-100 text-primary-700">
            {STATUS_OPTIONS.find(s => s.value === statusFilter)?.label}
            <button
              onClick={() => setStatusFilter('')}
              className="hover:text-primary-900"
            >
              <X className="w-4 h-4" />
            </button>
          </span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg animate-pulse"></div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && leads.length === 0 && (
        <div className="text-center py-12">
          <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No leads found
          </h3>
          <p className="text-gray-600 mb-4">
            {hasFilters
              ? 'Try adjusting your search or filters'
              : 'Start by adding your first lead'}
          </p>
          {!hasFilters && (
            <Link
              to="/leads/new"
              className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700 active:bg-primary-800 transition-colors"
            >
              Add New Lead
            </Link>
          )}
        </div>
      )}

      {/* Leads List */}
      {!loading && leads.length > 0 && (
        <div className="space-y-3">
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onStatusChange={handleStatusChange}
              onMarkContactedToday={handleMarkContactedToday}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const LeadCard = ({ lead, onStatusChange, onMarkContactedToday }) => {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [markingContacted, setMarkingContacted] = useState(false);

  const lastContactText = (() => {
    if (!lead.lastWhatsappContactAt) return null;
    try {
      const date = parseISO(lead.lastWhatsappContactAt);
      if (isToday(date)) return 'Today';
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return null;
    }
  })();

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <Link to={`/leads/${lead.id}`} className="block">
            <h3 className="font-semibold text-gray-900 truncate">{lead.name}</h3>
            <p className="text-sm text-gray-600">{lead.phoneNumber}</p>

            {(lead.conversationLabel || lastContactText) && (
              <div className="flex flex-wrap gap-2 mt-2">
                {lead.conversationLabel && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-50 text-primary-700 border border-primary-200">
                    <Tag className="w-3.5 h-3.5" />
                    {lead.conversationLabel}
                  </span>
                )}
                {lastContactText && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200">
                    <Clock className="w-3.5 h-3.5" />
                    Last WA: {lastContactText}
                  </span>
                )}
              </div>
            )}
            
            {lead.latestNote && (
              <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                {lead.latestNote.content}
              </p>
            )}
          </Link>
        </div>
        
        <Link
          to={`/leads/${lead.id}`}
          className="p-2 text-gray-400 hover:text-gray-600"
        >
          <ChevronRight className="w-5 h-5" />
        </Link>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        {/* Status Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              STATUS_OPTIONS.find(s => s.value === lead.status)?.className || 'bg-gray-100 text-gray-800'
            }`}
          >
            {STATUS_OPTIONS.find(s => s.value === lead.status)?.label || lead.status}
          </button>
          
          {showStatusMenu && (
            <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-[120px]">
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status.value}
                  onClick={() => {
                    onStatusChange(lead.id, status.value);
                    setShowStatusMenu(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                    lead.status === status.value ? 'bg-gray-50 font-medium' : ''
                  }`}
                >
                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                    status.value === 'new' ? 'bg-gray-400' :
                    status.value === 'interested' ? 'bg-blue-400' :
                    status.value === 'follow-up' ? 'bg-yellow-400' :
                    status.value === 'won' ? 'bg-green-400' :
                    'bg-red-400'
                  }`}></span>
                  {status.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              try {
                setMarkingContacted(true);
                await onMarkContactedToday(lead.id);
              } catch (err) {
                console.error('Failed to mark contacted today:', err);
              } finally {
                setMarkingContacted(false);
              }
            }}
            disabled={markingContacted}
            className="flex items-center gap-1.5 bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200 active:bg-gray-300 transition-colors disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            {markingContacted ? 'Saving...' : (lastContactText === 'Today' ? 'Update' : 'Mark today')}
          </button>

          {/* WhatsApp Button */}
          <a
            href={lead.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 bg-whatsapp-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-whatsapp-600 active:bg-whatsapp-700 transition-colors whatsapp-btn"
          >
            <MessageCircle className="w-4 h-4" />
            Chat
          </a>
        </div>
      </div>
    </div>
  );
};

export default Leads;
