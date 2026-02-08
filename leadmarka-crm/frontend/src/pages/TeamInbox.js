import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Filter, MessageCircle, UserPlus, X } from 'lucide-react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { leadsAPI, workspaceAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const STATUS_OPTIONS = [
  { value: 'new', label: 'New', className: 'status-new' },
  { value: 'contacted', label: 'Contacted', className: 'status-contacted' },
  { value: 'quoted', label: 'Quoted', className: 'status-quoted' },
  { value: 'follow-up', label: 'Follow-up', className: 'status-follow-up' },
  { value: 'negotiating', label: 'Negotiating', className: 'status-negotiating' },
  { value: 'won', label: 'Won', className: 'status-won' },
  { value: 'lost', label: 'Lost', className: 'status-lost' },
];

const TeamInbox = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [assignmentFeedback, setAssignmentFeedback] = useState(null);

  const isOwner = user?.role === 'owner';
  const teamInboxEnabled = Boolean(user?.teamInboxEnabled);

  const inboxQueryKey = useMemo(
    () => ['inbox', statusFilter, assignedFilter],
    [statusFilter, assignedFilter]
  );

  const {
    data: inboxLeads = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: inboxQueryKey,
    queryFn: async () => {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (assignedFilter === 'assigned') params.assignedToMe = true;
      if (assignedFilter === 'unassigned') params.unassigned = true;
      if (assignedFilter === 'overdue') params.overdue = true;
      const { data } = await leadsAPI.getInbox(params);
      return data || [];
    },
    placeholderData: keepPreviousData,
    enabled: teamInboxEnabled,
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['workspace', 'members'],
    queryFn: async () => {
      const { data } = await workspaceAPI.getMembers();
      return data || [];
    },
    enabled: teamInboxEnabled && isOwner,
  });

  const assignMutation = useMutation({
    mutationFn: ({ leadId, assignedUserId }) => leadsAPI.assign(leadId, assignedUserId),
    onSuccess: (_response, variables) => {
      const nextAssignedId = variables?.assignedUserId;
      const assigneeLabel = nextAssignedId
        ? teamMembers.find((member) => member.userId === nextAssignedId)?.fullName
          || teamMembers.find((member) => member.userId === nextAssignedId)?.email
          || (nextAssignedId === user?.id ? user?.fullName || user?.email : null)
          || 'team member'
        : 'Unassigned';
      setAssignmentFeedback({
        leadId: variables?.leadId,
        message: `Assigned to ${assigneeLabel}`,
      });
      setTimeout(() => setAssignmentFeedback(null), 2500);
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['lead'] });
    },
  });

  const handleAssign = (leadId, assignedUserId) => {
    assignMutation.mutate({ leadId, assignedUserId });
  };

  const clearFilters = () => {
    setStatusFilter('');
    setAssignedFilter('');
  };

  const hasFilters = statusFilter || assignedFilter;
  const error = isError ? 'Failed to load team inbox' : null;
  const assignedToMeCount = useMemo(() => (
    inboxLeads.filter((lead) => lead.assignedUserId === user?.id).length
  ), [inboxLeads, user?.id]);
  const unassignedCount = useMemo(() => (
    inboxLeads.filter((lead) => !lead.assignedUserId).length
  ), [inboxLeads]);
  const overdueCount = useMemo(() => (
    inboxLeads.filter((lead) => lead.isOverdue).length
  ), [inboxLeads]);

  if (!teamInboxEnabled) {
    return (
      <div className="p-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
          Team Inbox is not enabled for this workspace.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex-1 p-3 rounded-lg border transition-colors ${
            showFilters || hasFilters
              ? 'bg-primary-50 border-primary-300 text-primary-700'
              : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </div>
        </button>
      </div>
      <div className="flex justify-end">
        <Link to="/leads" className="text-sm text-primary-600 hover:text-primary-700">
          View all leads
        </Link>
      </div>

      {showFilters && (
        <div className="bg-white rounded-lg p-3 border border-gray-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Filters</span>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                Clear all
              </button>
            )}
          </div>

          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">Assignment</div>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'assigned', label: 'Assigned to me' },
                { value: 'unassigned', label: 'Unassigned' },
                { value: 'overdue', label: 'Overdue' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() =>
                    setAssignedFilter(assignedFilter === opt.value ? '' : opt.value)
                  }
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    assignedFilter === opt.value
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">Status</div>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status.value}
                  onClick={() =>
                    setStatusFilter(statusFilter === status.value ? '' : status.value)
                  }
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
        </div>
      )}

      {hasFilters && !showFilters && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
          Active filters
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary-100 text-primary-700"
          >
            Clear
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {!isLoading && inboxLeads.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() =>
              setAssignedFilter(assignedFilter === 'assigned' ? '' : 'assigned')
            }
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              assignedFilter === 'assigned'
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {assignedToMeCount} assigned to you
          </button>
          <button
            onClick={() =>
              setAssignedFilter(assignedFilter === 'unassigned' ? '' : 'unassigned')
            }
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              assignedFilter === 'unassigned'
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {unassignedCount} unassigned
          </button>
          <button
            onClick={() =>
              setAssignedFilter(assignedFilter === 'overdue' ? '' : 'overdue')
            }
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              assignedFilter === 'overdue'
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {overdueCount} overdue
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg animate-pulse"></div>
          ))}
        </div>
      )}

      {!isLoading && inboxLeads.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <div className="text-base font-medium text-gray-700">
            {hasFilters ? 'No leads match these filters.' : 'No leads in the inbox yet.'}
          </div>
          {!hasFilters && (
            <p className="text-sm text-gray-500 mt-2">
              Add leads from Leads or ask your team to assign you some.
            </p>
          )}
        </div>
      )}

      {!isLoading && inboxLeads.length > 0 && (
        <div className="space-y-3">
          {inboxLeads.map((lead) => (
            <div key={lead.id} className="bg-white rounded-lg p-4 border border-gray-200 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link to={`/leads/${lead.id}`} className="block">
                    <h3 className="font-semibold text-gray-900 truncate">{lead.name}</h3>
                    <p className="text-sm text-gray-600">{lead.phoneNumber}</p>
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      STATUS_OPTIONS.find((s) => s.value === lead.status)?.className || 'bg-gray-100 text-gray-700'
                    }`}>
                      {STATUS_OPTIONS.find((s) => s.value === lead.status)?.label || lead.status}
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      {lead.assignedUser?.fullName || 'Unassigned'}
                    </span>
                    {lead.nextFollowUpDate && (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        lead.isOverdue ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'
                      }`}>
                        {lead.nextFollowUpDate} {lead.nextFollowUpTime || ''}
                      </span>
                    )}
                    {!lead.assignedUserId && (
                      <button
                        onClick={() => handleAssign(lead.id, user?.id)}
                        className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700 hover:bg-primary-200"
                      >
                        Assign to me
                      </button>
                    )}
                    {assignmentFeedback?.leadId === lead.id && (
                      <span className="text-xs text-primary-600">
                        {assignmentFeedback.message}
                      </span>
                    )}
                  </div>
                </div>
                <a
                  href={lead.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-whatsapp-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-whatsapp-600 active:bg-whatsapp-700 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  Chat
                </a>
              </div>

              {isOwner && (
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-gray-400" />
                  <select
                    value={lead.assignedUserId || ''}
                    onChange={(e) => handleAssign(lead.id, e.target.value || null)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.fullName || member.email || member.userId}
                        {member.role === 'owner' ? ' (Owner)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeamInbox;
