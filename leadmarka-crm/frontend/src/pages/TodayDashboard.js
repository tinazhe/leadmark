import React from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, CheckCircle, AlertCircle, Clock, ChevronRight } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardAPI, followUpsAPI } from '../services/api';

const TodayDashboard = () => {
  const queryClient = useQueryClient();

  const {
    data,
    isLoading: loading,
    isError,
  } = useQuery({
    queryKey: ['dashboard', 'today'],
    queryFn: async () => {
      const { data } = await dashboardAPI.getToday();
      return data;
    },
  });

  const followUps = {
    today: data?.today || [],
    overdue: data?.overdue || [],
  };

  const stats = data?.summary || { todayCount: 0, overdueCount: 0, totalActionRequired: 0 };
  const leadCount = Number.isFinite(data?.leadCount) ? data.leadCount : 0;

  const error = isError ? 'Failed to load dashboard' : null;

  const completeMutation = useMutation({
    mutationFn: (followUpId) => followUpsAPI.complete(followUpId),
    onMutate: async (followUpId) => {
      await queryClient.cancelQueries({ queryKey: ['dashboard', 'today'] });
      const previous = queryClient.getQueryData(['dashboard', 'today']);

      queryClient.setQueryData(['dashboard', 'today'], (old) => {
        if (!old) return old;

        const inOverdue = Array.isArray(old.overdue) && old.overdue.some((fu) => fu.id === followUpId);
        const inToday = Array.isArray(old.today) && old.today.some((fu) => fu.id === followUpId);

        const nextOverdue = Array.isArray(old.overdue) ? old.overdue.filter((fu) => fu.id !== followUpId) : old.overdue;
        const nextToday = Array.isArray(old.today) ? old.today.filter((fu) => fu.id !== followUpId) : old.today;

        const prevSummary = old.summary || { todayCount: 0, overdueCount: 0, totalActionRequired: 0 };
        const nextSummary = {
          ...prevSummary,
          totalActionRequired: Math.max(0, (prevSummary.totalActionRequired || 0) - 1),
          overdueCount: inOverdue ? Math.max(0, (prevSummary.overdueCount || 0) - 1) : prevSummary.overdueCount,
          todayCount: inToday ? Math.max(0, (prevSummary.todayCount || 0) - 1) : prevSummary.todayCount,
        };

        return { ...old, overdue: nextOverdue, today: nextToday, summary: nextSummary };
      });

      return { previous };
    },
    onError: (_err, _followUpId, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(['dashboard', 'today'], ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'today'] });
    },
  });

  const handleComplete = async (followUpId) => {
    try {
      await completeMutation.mutateAsync(followUpId);
    } catch (err) {
      console.error('Failed to complete follow-up:', err);
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-gray-200 rounded-lg"></div>
          <div className="h-32 bg-gray-200 rounded-lg"></div>
          <div className="h-32 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  const hasFollowUps = followUps.today.length > 0 || followUps.overdue.length > 0;
  const hasLeads = leadCount > 0;

  return (
    <div className="p-4 space-y-4">
      {/* Summary Card */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-primary-100 text-sm">Follow-ups Today</p>
            <p className="text-3xl font-bold">{stats.totalActionRequired}</p>
          </div>
          <div className="bg-white/20 rounded-full p-3">
            <Clock className="w-8 h-8" />
          </div>
        </div>
        {stats.overdueCount > 0 && (
          <div className="mt-3 flex items-center gap-2 bg-danger-500/30 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">
              {stats.overdueCount} overdue - needs attention
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Empty State */}
      {!hasFollowUps && !error && (
        <div className="text-center py-12">
          <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {hasLeads ? 'All caught up!' : 'Add your first lead to get started'}
          </h3>
          <p className="text-gray-600 mb-4">
            {hasLeads
              ? 'No follow-ups due today. Time to find new leads?'
              : 'Create your first lead so you can track statuses and set follow-up reminders.'}
          </p>
          <Link
            to="/leads/new"
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700 active:bg-primary-800 transition-colors"
          >
            {hasLeads ? 'Add New Lead' : 'Add Lead'}
          </Link>
        </div>
      )}

      {/* Overdue Follow-ups */}
      {followUps.overdue.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-danger-500" />
            Overdue ({followUps.overdue.length})
          </h2>
          <div className="space-y-3">
            {followUps.overdue.map((followUp) => (
              <FollowUpCard
                key={followUp.id}
                followUp={followUp}
                isOverdue
                onComplete={() => handleComplete(followUp.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Today's Follow-ups */}
      {followUps.today.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary-600" />
            Today ({followUps.today.length})
          </h2>
          <div className="space-y-3">
            {followUps.today.map((followUp) => (
              <FollowUpCard
                key={followUp.id}
                followUp={followUp}
                onComplete={() => handleComplete(followUp.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const FollowUpCard = ({ followUp, isOverdue, onComplete }) => {
  return (
    <div className={`bg-white rounded-lg p-4 border ${
      isOverdue ? 'border-danger-200 shadow-sm' : 'border-gray-200'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 truncate">
              {followUp.leadName}
            </h3>
            {isOverdue && (
              <span className="bg-danger-100 text-danger-700 text-xs px-2 py-0.5 rounded-full font-medium">
                Overdue
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3 text-sm text-gray-600 mb-2">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {followUp.time}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium status-${followUp.leadStatus}`}>
              {followUp.leadStatus}
            </span>
          </div>
          
          {followUp.note && (
            <p className="text-sm text-gray-600 mb-3 bg-gray-50 rounded p-2">
              {followUp.note}
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <a
          href={followUp.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 bg-whatsapp-500 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-whatsapp-600 active:bg-whatsapp-700 transition-colors whatsapp-btn"
        >
          <MessageCircle className="w-4 h-4" />
          Chat
        </a>
        
        <button
          onClick={onComplete}
          className="flex items-center justify-center gap-2 bg-success-500 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-success-600 active:bg-success-700 transition-colors"
        >
          <CheckCircle className="w-4 h-4" />
          Done
        </button>
        
        <Link
          to={`/leads/${followUp.leadId}`}
          className="flex items-center justify-center p-2.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 active:bg-gray-300 transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </Link>
      </div>
    </div>
  );
};

export default TodayDashboard;
