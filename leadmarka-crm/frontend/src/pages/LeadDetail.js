import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MessageCircle, Calendar, Plus, Trash2, Edit2, Check, X, Clock, Tag, UserPlus, Mail, Building2, Package, Wallet, Zap } from 'lucide-react';
import { format, parseISO, formatDistanceToNow, isToday } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { activityAPI, leadsAPI, notesAPI, followUpsAPI, workspaceAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const STATUS_OPTIONS = [
  { value: 'new', label: 'New', className: 'bg-gray-100 text-gray-800' },
  { value: 'contacted', label: 'Contacted', className: 'bg-blue-100 text-blue-800' },
  { value: 'quoted', label: 'Quoted', className: 'bg-indigo-100 text-indigo-800' },
  { value: 'follow-up', label: 'Follow-up', className: 'bg-yellow-100 text-yellow-800' },
  { value: 'negotiating', label: 'Negotiating', className: 'bg-amber-100 text-amber-800' },
  { value: 'won', label: 'Won', className: 'bg-green-100 text-green-800' },
  { value: 'lost', label: 'Lost', className: 'bg-red-100 text-red-800' },
];

const SOURCE_OPTIONS = [
  { value: '', label: 'Not set' },
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

const LEGACY_STATUS_LABELS = { interested: 'Contacted' };
const formatStatusValue = (value) => {
  if (!value) return '';
  const normalized = typeof value === 'string' ? value.toLowerCase() : value;
  return STATUS_OPTIONS.find((status) => status.value === normalized)?.label
    || LEGACY_STATUS_LABELS[normalized]
    || value;
};

const formatAssignmentValue = (value) => (value ? 'Assigned' : 'Unassigned');

const getActivityLabel = (entry) => {
  const metadata = entry?.metadata || {};
  switch (entry?.action) {
    case 'note_added':
      return 'Added a note';
    case 'note_edited':
      return 'Edited a note';
    case 'lead_created':
      return 'Created lead';
    case 'lead_updated':
      return metadata.lastWhatsappContactAt ? 'Marked WhatsApp contact' : 'Updated lead';
    case 'status_change':
      return 'Changed status';
    case 'lead_reassigned':
      return 'Reassigned lead';
    case 'follow_up_created':
      return 'Scheduled follow-up';
    case 'follow_up_completed':
      return 'Completed follow-up';
    default:
      return entry?.action ? entry.action.replace(/_/g, ' ') : 'Activity';
  }
};

const getActivityMeta = (entry) => {
  const metadata = entry?.metadata || {};
  switch (entry?.action) {
    case 'status_change':
      return `${formatStatusValue(metadata.from)} → ${formatStatusValue(metadata.to)}`.trim();
    case 'lead_reassigned':
      return `From ${formatAssignmentValue(metadata.from)} to ${formatAssignmentValue(metadata.to)}`;
    case 'follow_up_created': {
      const when = [metadata.date, metadata.time].filter(Boolean).join(' ');
      return when || null;
    }
    default:
      return null;
  }
};

const LeadDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('notes');

  const [conversationLabelDraft, setConversationLabelDraft] = useState('');
  const [isConversationLabelDirty, setIsConversationLabelDirty] = useState(false);
  const [savingConversationLabel, setSavingConversationLabel] = useState(false);
  const [lastMessageSummaryDraft, setLastMessageSummaryDraft] = useState('');
  const [isLastMessageSummaryDirty, setIsLastMessageSummaryDirty] = useState(false);
  const [savingLastMessageSummary, setSavingLastMessageSummary] = useState(false);
  const [lastMessageSummaryError, setLastMessageSummaryError] = useState('');
  const [isEditingIdentity, setIsEditingIdentity] = useState(false);
  const [identityDraft, setIdentityDraft] = useState({ email: '', companyName: '', source: '', referrerName: '' });
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [identityError, setIdentityError] = useState('');
  const [isEditingIntent, setIsEditingIntent] = useState(false);
  const [intentDraft, setIntentDraft] = useState({
    productOrService: '',
    variantSpecs: '',
    budgetRange: '',
    urgency: '',
  });
  const [savingIntent, setSavingIntent] = useState(false);
  const [intentError, setIntentError] = useState('');
  const [markingContacted, setMarkingContacted] = useState(false);
  const [whatsAppContextError, setWhatsAppContextError] = useState('');

  // Notes state
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [editingNote, setEditingNote] = useState(null);

  // Follow-up state
  const [showAddFollowUp, setShowAddFollowUp] = useState(false);
  const [followUpData, setFollowUpData] = useState({
    date: '',
    time: '',
    note: '',
  });
  const [followUpError, setFollowUpError] = useState('');

  const {
    data: lead,
    isLoading: loading,
    isError,
  } = useQuery({
    queryKey: ['lead', id],
    queryFn: async () => {
      const { data } = await leadsAPI.getById(id);
      return data;
    },
    enabled: !!id,
  });

  const { data: leadViewers = [] } = useQuery({
    queryKey: ['leadViewers', id],
    queryFn: async () => {
      const { data } = await leadsAPI.getViewers(id);
      return data || [];
    },
    enabled: !!id,
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  const error = isError ? 'Failed to load lead' : null;
  const isOwner = user?.role === 'owner';
  const teamInboxEnabled = Boolean(user?.teamInboxEnabled);

  useEffect(() => {
    // When switching leads, reset draft state.
    setIsConversationLabelDirty(false);
    setIsLastMessageSummaryDirty(false);
  }, [id]);

  useEffect(() => {
    if (isConversationLabelDirty) return;
    setConversationLabelDraft(lead?.conversationLabel || '');
  }, [lead?.conversationLabel, isConversationLabelDirty]);

  useEffect(() => {
    if (isLastMessageSummaryDirty) return;
    setLastMessageSummaryDraft(lead?.lastMessageSummary || '');
  }, [lead?.lastMessageSummary, isLastMessageSummaryDirty]);

  useEffect(() => {
    if (!isEditingIdentity && lead) {
      setIdentityDraft({
        email: lead.email || '',
        companyName: lead.companyName || '',
        source: lead.source || '',
        referrerName: lead.referrerName || '',
      });
    }
  }, [lead, isEditingIdentity]);

  useEffect(() => {
    if (!isEditingIntent && lead) {
      setIntentDraft({
        productOrService: lead.productOrService || '',
        variantSpecs: lead.variantSpecs || '',
        budgetRange: lead.budgetRange || '',
        urgency: lead.urgency || '',
      });
    }
  }, [lead, isEditingIntent]);

  useEffect(() => {
    if (!id) return undefined;

    let isActive = true;
    const sendHeartbeat = async () => {
      if (!isActive) return;
      try {
        await leadsAPI.postViewing(id);
      } catch (err) {
        // Heartbeat errors shouldn't block lead viewing.
      }
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 15000);

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [id]);

  const updateStatusMutation = useMutation({
    mutationFn: (status) => leadsAPI.update(id, { status }),
    onSuccess: (_res, status) => {
      queryClient.setQueryData(['lead', id], (old) => (old ? { ...old, status } : old));
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  const handleStatusChange = async (newStatus) => {
    try {
      await updateStatusMutation.mutateAsync(newStatus);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const updateIdentityMutation = useMutation({
    mutationFn: (payload) => leadsAPI.update(id, payload),
    onSuccess: (_, payload) => {
      queryClient.setQueryData(['lead', id], (old) => (old ? { ...old, ...payload } : old));
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setIsEditingIdentity(false);
      setIdentityError('');
    },
  });

  const handleSaveIdentity = async () => {
    setIdentityError('');
    setSavingIdentity(true);
    try {
      const payload = {
        email: identityDraft.email?.trim() || null,
        companyName: identityDraft.companyName?.trim() || null,
        source: identityDraft.source?.trim() || null,
        referrerName: identityDraft.referrerName?.trim() || null,
      };
      await updateIdentityMutation.mutateAsync(payload);
    } catch (err) {
      const raw = err?.response?.data?.error || err?.message || 'Failed to update';
      const looksLikeSchemaError =
        typeof raw === 'string' &&
        (raw.toLowerCase().includes('column') || raw.toLowerCase().includes('schema') || raw.includes('2026-02-08'));
      setIdentityError(
        looksLikeSchemaError
          ? 'Database needs an update. Run database/migrations/2026-02-08_lead-identity-source.sql in Supabase SQL Editor, then restart the backend.'
          : raw
      );
    } finally {
      setSavingIdentity(false);
    }
  };

  const updateIntentMutation = useMutation({
    mutationFn: (payload) => leadsAPI.update(id, payload),
    onSuccess: (_, payload) => {
      queryClient.setQueryData(['lead', id], (old) => (old ? { ...old, ...payload } : old));
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setIsEditingIntent(false);
      setIntentError('');
    },
  });

  const handleSaveIntent = async () => {
    setIntentError('');
    setSavingIntent(true);
    try {
      const payload = {
        productOrService: intentDraft.productOrService?.trim() || null,
        variantSpecs: intentDraft.variantSpecs?.trim() || null,
        budgetRange: intentDraft.budgetRange?.trim() || null,
        urgency: intentDraft.urgency?.trim() || null,
      };
      await updateIntentMutation.mutateAsync(payload);
    } catch (err) {
      const raw = err?.response?.data?.error || err?.message || 'Failed to update';
      const looksLikeSchemaError =
        typeof raw === 'string' &&
        (raw.toLowerCase().includes('column') || raw.toLowerCase().includes('schema') || raw.includes('2026-02-10'));
      setIntentError(
        looksLikeSchemaError
          ? 'Database needs an update. Run database/migrations/2026-02-10_lead-intent-fields.sql in Supabase SQL Editor, then restart the backend.'
          : raw
      );
    } finally {
      setSavingIntent(false);
    }
  };

  const saveConversationLabelMutation = useMutation({
    mutationFn: (labelToSave) => leadsAPI.update(id, { conversationLabel: labelToSave }),
    onSuccess: (_res, labelToSave) => {
      const trimmed = labelToSave.trim();
      queryClient.setQueryData(['lead', id], (old) =>
        old ? { ...old, conversationLabel: trimmed || null } : old
      );
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setIsConversationLabelDirty(false);
      setConversationLabelDraft(labelToSave);
    },
  });

  const saveLastMessageSummaryMutation = useMutation({
    mutationFn: (summaryToSave) => leadsAPI.update(id, { lastMessageSummary: summaryToSave }),
    onSuccess: (_res, summaryToSave) => {
      const trimmed = summaryToSave.trim();
      queryClient.setQueryData(['lead', id], (old) =>
        old ? { ...old, lastMessageSummary: trimmed || null } : old
      );
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setIsLastMessageSummaryDirty(false);
      setLastMessageSummaryDraft(summaryToSave);
    },
  });

  const handleSaveConversationLabel = async (nextLabel) => {
    const labelToSave = typeof nextLabel === 'string' ? nextLabel : conversationLabelDraft;
    try {
      setWhatsAppContextError('');
      setSavingConversationLabel(true);
      await saveConversationLabelMutation.mutateAsync(labelToSave);
    } catch (err) {
      console.error('Failed to update conversation label:', err);
      const raw = err?.response?.data?.error || err?.message || 'Failed to update conversation tag';
      const looksLikeMissingColumn =
        typeof raw === 'string' &&
        raw.toLowerCase().includes('column') &&
        raw.toLowerCase().includes('does not exist');
      setWhatsAppContextError(
        looksLikeMissingColumn
          ? 'Database needs an update. Run `leadmarka-crm/database/migrations/2026-02-02_whatsapp-context.sql` in Supabase SQL Editor, then restart backend.'
          : raw
      );
      setConversationLabelDraft(lead?.conversationLabel || '');
    } finally {
      setSavingConversationLabel(false);
    }
  };

  const handleSaveLastMessageSummary = async (nextSummary) => {
    const summaryToSave = typeof nextSummary === 'string' ? nextSummary : lastMessageSummaryDraft;
    try {
      setLastMessageSummaryError('');
      setSavingLastMessageSummary(true);
      await saveLastMessageSummaryMutation.mutateAsync(summaryToSave);
    } catch (err) {
      console.error('Failed to update last message summary:', err);
      const raw = err?.response?.data?.error || err?.message || 'Failed to update last message summary';
      const looksLikeMissingColumn =
        typeof raw === 'string' &&
        raw.toLowerCase().includes('column') &&
        raw.toLowerCase().includes('does not exist');
      setLastMessageSummaryError(
        looksLikeMissingColumn
          ? 'Database needs an update. Run `leadmarka-crm/database/migrations/2026-02-10_lead-conversation-history.sql` in Supabase SQL Editor, then restart backend.'
          : raw
      );
      setLastMessageSummaryDraft(lead?.lastMessageSummary || '');
    } finally {
      setSavingLastMessageSummary(false);
    }
  };

  const markContactedMutation = useMutation({
    mutationFn: async () => {
      const { data } = await leadsAPI.markWhatsappContactNow(id);
      return data?.lastWhatsappContactAt || new Date().toISOString();
    },
    onSuccess: (lastWhatsappContactAt) => {
      queryClient.setQueryData(['lead', id], (old) =>
        old ? { ...old, lastWhatsappContactAt } : old
      );
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  const handleMarkContactedToday = async () => {
    try {
      setWhatsAppContextError('');
      setMarkingContacted(true);
      await markContactedMutation.mutateAsync();
    } catch (err) {
      console.error('Failed to mark contacted today:', err);
      const raw = err?.response?.data?.error || err?.message || 'Failed to mark contacted';
      const looksLikeMissingColumn =
        typeof raw === 'string' &&
        raw.toLowerCase().includes('column') &&
        raw.toLowerCase().includes('does not exist');
      setWhatsAppContextError(
        looksLikeMissingColumn
          ? 'Database needs an update. Run `leadmarka-crm/database/migrations/2026-02-02_whatsapp-context.sql` in Supabase SQL Editor, then restart backend.'
          : raw
      );
    } finally {
      setMarkingContacted(false);
    }
  };

  const addNoteMutation = useMutation({
    mutationFn: (content) => notesAPI.create({ leadId: id, content }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lead', id] }),
  });

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    
    try {
      setAddingNote(true);
      await addNoteMutation.mutateAsync(newNote);
      setNewNote('');
    } catch (err) {
      console.error('Failed to add note:', err);
    } finally {
      setAddingNote(false);
    }
  };

  const updateNoteMutation = useMutation({
    mutationFn: ({ noteId, content }) => notesAPI.update(noteId, content),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lead', id] }),
  });

  const handleUpdateNote = async (noteId, content) => {
    try {
      await updateNoteMutation.mutateAsync({ noteId, content });
      setEditingNote(null);
    } catch (err) {
      console.error('Failed to update note:', err);
    }
  };

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId) => notesAPI.delete(noteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lead', id] }),
  });

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Delete this note?')) return;
    
    try {
      await deleteNoteMutation.mutateAsync(noteId);
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  const addFollowUpMutation = useMutation({
    mutationFn: (payload) => followUpsAPI.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'today'] });
    },
  });

  const assignMutation = useMutation({
    mutationFn: (assignedUserId) => leadsAPI.assign(id, assignedUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
  });

  const { data: activityLog = [] } = useQuery({
    queryKey: ['activity', id],
    queryFn: async () => {
      const { data } = await activityAPI.getByLead(id);
      return data || [];
    },
    enabled: activeTab === 'activity',
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['workspace', 'members'],
    queryFn: async () => {
      const { data } = await workspaceAPI.getMembers();
      return data || [];
    },
    enabled: isOwner && teamInboxEnabled,
  });

  const handleAddFollowUp = async () => {
    if (!followUpData.date || !followUpData.time) return;

    try {
      setFollowUpError('');
      await addFollowUpMutation.mutateAsync({
        leadId: id,
        date: followUpData.date,
        time: followUpData.time,
        note: followUpData.note,
      });
      setShowAddFollowUp(false);
      setFollowUpData({ date: '', time: '', note: '' });
    } catch (err) {
      const data = err?.response?.data;
      const raw =
        data?.errors?.[0]?.msg ||
        data?.error ||
        err?.message ||
        'Failed to add follow-up';
      const looksLikeMissingColumn =
        typeof raw === 'string' &&
        (raw.toLowerCase().includes('notification_claimed_at') || (raw.toLowerCase().includes('column') && raw.toLowerCase().includes('schema cache')));
      setFollowUpError(
        looksLikeMissingColumn
          ? 'Database needs an update. Run leadmarka-crm/database/migrations/2026-02-04_follow-ups-notification-columns.sql in Supabase SQL Editor, then try again.'
          : raw
      );
      console.error('Failed to add follow-up:', raw, data || err);
    }
  };

  const deleteLeadMutation = useMutation({
    mutationFn: () => leadsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      navigate('/leads');
    },
  });

  const handleDeleteLead = async () => {
    if (!window.confirm('Are you sure you want to delete this lead? This cannot be undone.')) return;
    
    try {
      await deleteLeadMutation.mutateAsync();
    } catch (err) {
      console.error('Failed to delete lead:', err);
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="animate-pulse rounded-2xl overflow-hidden bg-white border border-gray-100">
          <div className="h-1.5 bg-gray-200" />
          <div className="p-5 space-y-4">
            <div className="h-8 w-48 bg-gray-200 rounded-lg" />
            <div className="h-5 w-36 bg-gray-100 rounded" />
            <div className="h-24 bg-gray-100 rounded-xl" />
          </div>
        </div>
        <div className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="p-4">
        <div className="rounded-2xl bg-red-50 border border-red-200 p-5 text-red-700 font-medium">
          {error || 'Lead not found'}
        </div>
      </div>
    );
  }

  const lastContactLabel = (() => {
    if (!lead.lastWhatsappContactAt) return 'Never';
    try {
      const date = parseISO(lead.lastWhatsappContactAt);
      if (isToday(date)) return 'Today';
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return '—';
    }
  })();

  const lastContactExact = (() => {
    if (!lead.lastWhatsappContactAt) return null;
    try {
      return format(parseISO(lead.lastWhatsappContactAt), 'MMM d, yyyy h:mm a');
    } catch {
      return null;
    }
  })();

  const otherViewers = (leadViewers || []).filter((viewer) => viewer.id !== user?.id);
  const viewerNames = otherViewers.map((viewer) => viewer.fullName || viewer.email || 'Team member');
  let viewerLabel = '';
  if (viewerNames.length === 1) {
    viewerLabel = viewerNames[0];
  } else if (viewerNames.length === 2) {
    viewerLabel = `${viewerNames[0]} and ${viewerNames[1]}`;
  } else if (viewerNames.length > 2) {
    viewerLabel = `${viewerNames[0]}, ${viewerNames[1]} and ${viewerNames.length - 2} others`;
  }

  return (
    <div className="p-4 space-y-5 min-h-screen">
      {/* Lead Header Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
        <div className="p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{lead.name}</h2>
              <a
                href={`tel:${lead.phoneNumber?.replace(/\s/g, '')}`}
                className="mt-1 inline-flex items-center gap-2 text-primary-600 font-medium hover:text-primary-700"
              >
                {lead.phoneNumber}
              </a>
              {(lead.email || lead.companyName || lead.source) && (
                <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 text-sm">
                  {lead.email && (
                    <span className="flex items-center gap-2 text-gray-600">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                        <Mail className="w-4 h-4" />
                      </span>
                      {lead.email}
                    </span>
                  )}
                  {lead.companyName && (
                    <span className="flex items-center gap-2 text-gray-600">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                        <Building2 className="w-4 h-4" />
                      </span>
                      {lead.companyName}
                    </span>
                  )}
                  {lead.source && (
                    <span className="flex items-center gap-2 text-gray-600">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 text-xs font-medium">
                        {SOURCE_OPTIONS.find((o) => o.value === lead.source)?.label || lead.source}
                        {lead.source === 'referral' && lead.referrerName && ` (${lead.referrerName})`}
                      </span>
                    </span>
                  )}
                </div>
              )}
              {viewerLabel && (
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                  Viewed by {viewerLabel}
                </p>
              )}
            </div>
            <select
              value={lead.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold border-0 cursor-pointer shadow-sm ${
                STATUS_OPTIONS.find(s => s.value === lead.status)?.className
              }`}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

        {/* Identity & Source (editable by owner only per RULES) */}
        {isOwner && (
          <div className="mb-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Identity & Source</span>
              {!isEditingIdentity ? (
                <button
                  type="button"
                  onClick={() => setIsEditingIdentity(true)}
                  className="text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
                >
                  Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingIdentity(false)}
                    className="text-sm text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveIdentity}
                    disabled={savingIdentity}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
                  >
                    {savingIdentity ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )}
            </div>
            {identityError && (
              <p className="text-sm text-red-600 mb-2">{identityError}</p>
            )}
            {isEditingIdentity ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Email</label>
                  <input
                    type="email"
                    value={identityDraft.email}
                    onChange={(e) => setIdentityDraft({ ...identityDraft, email: e.target.value })}
                    placeholder="Optional"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Company</label>
                  <input
                    type="text"
                    value={identityDraft.companyName}
                    onChange={(e) => setIdentityDraft({ ...identityDraft, companyName: e.target.value })}
                    placeholder="Optional"
                    maxLength={200}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Source</label>
                  <select
                    value={identityDraft.source}
                    onChange={(e) => setIdentityDraft({ ...identityDraft, source: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    {SOURCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                {identityDraft.source === 'referral' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-0.5">Referrer name</label>
                    <input
                      type="text"
                      value={identityDraft.referrerName}
                      onChange={(e) => setIdentityDraft({ ...identityDraft, referrerName: e.target.value })}
                      placeholder="Who referred?"
                      maxLength={120}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-600">
                {!lead.email && !lead.companyName && !lead.source && '—'}
                {(lead.email || lead.companyName || lead.source) && (
                  <span>
                    {lead.email && `${lead.email} · `}
                    {lead.companyName && `${lead.companyName} · `}
                    {lead.source && `${SOURCE_OPTIONS.find((o) => o.value === lead.source)?.label || lead.source}`}
                    {lead.source === 'referral' && lead.referrerName && ` (${lead.referrerName})`}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Intent (editable by owner only per RULES) */}
        {isOwner && (
          <div className="mb-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Intent</span>
              {!isEditingIntent ? (
                <button
                  type="button"
                  onClick={() => setIsEditingIntent(true)}
                  className="text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
                >
                  Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingIntent(false)}
                    className="text-sm text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveIntent}
                    disabled={savingIntent}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
                  >
                    {savingIntent ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )}
            </div>
            {intentError && (
              <p className="text-sm text-red-600 mb-2">{intentError}</p>
            )}
            {isEditingIntent ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Product or service</label>
                  <div className="relative">
                    <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={intentDraft.productOrService}
                      onChange={(e) => setIntentDraft({ ...intentDraft, productOrService: e.target.value })}
                      placeholder="Optional"
                      maxLength={200}
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Variant specs</label>
                  <input
                    type="text"
                    value={intentDraft.variantSpecs}
                    onChange={(e) => setIntentDraft({ ...intentDraft, variantSpecs: e.target.value })}
                    placeholder="Optional"
                    maxLength={300}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Budget range</label>
                  <div className="relative">
                    <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={intentDraft.budgetRange}
                      onChange={(e) => setIntentDraft({ ...intentDraft, budgetRange: e.target.value })}
                      placeholder="Optional"
                      maxLength={120}
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Urgency</label>
                  <div className="relative">
                    <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      value={intentDraft.urgency}
                      onChange={(e) => setIntentDraft({ ...intentDraft, urgency: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">Not set</option>
                      <option value="now">Now</option>
                      <option value="soon">Soon</option>
                      <option value="browsing">Just browsing</option>
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-600">
                {!lead.productOrService && !lead.variantSpecs && !lead.budgetRange && !lead.urgency && '—'}
                {(lead.productOrService || lead.variantSpecs || lead.budgetRange || lead.urgency) && (
                  <span>
                    {lead.productOrService && `${lead.productOrService} · `}
                    {lead.variantSpecs && `${lead.variantSpecs} · `}
                    {lead.budgetRange && `${lead.budgetRange} · `}
                    {lead.urgency && `${lead.urgency.charAt(0).toUpperCase()}${lead.urgency.slice(1)}`}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
              <UserPlus className="w-4 h-4" />
            </span>
            <span>
              Owner: <span className="font-semibold text-gray-900">{lead.assignedUser?.fullName || 'Unassigned'}</span>
            </span>
          </div>
          {teamInboxEnabled && !lead.assignedUserId && (
            <button
              onClick={() => assignMutation.mutate(user?.id)}
              disabled={!user?.id}
              className="w-full sm:w-auto px-4 py-2.5 border border-primary-200 rounded-xl text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Assign to me
            </button>
          )}
          {isOwner && (
            <select
              value={lead.assignedUserId || ''}
              onChange={(e) => assignMutation.mutate(e.target.value || null)}
              className="w-full sm:w-auto px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              <option value="">Unassigned</option>
              {teamMembers.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.fullName || member.email || member.userId}
                  {member.role === 'owner' ? ' (Owner)' : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex gap-3">
          <a
            href={lead.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 bg-whatsapp-500 text-white py-3.5 px-4 rounded-xl font-semibold hover:bg-whatsapp-600 active:bg-whatsapp-700 transition-all shadow-md hover:shadow-lg whatsapp-btn"
          >
            <MessageCircle className="w-5 h-5" />
            Chat on WhatsApp
          </a>
          <button
            onClick={handleDeleteLead}
            className="p-3.5 text-gray-500 hover:text-danger-600 hover:bg-red-50 rounded-xl transition-colors border border-gray-200 hover:border-red-200"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        {/* WhatsApp Context */}
        <div className="mt-5 pt-5 border-t border-gray-100 space-y-4">
          <div className="rounded-xl bg-primary-50/50 p-4 border border-primary-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
                  <Tag className="w-4 h-4" />
                </span>
                Conversation tag
              </div>
              {lead.conversationLabel && (
                <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-100 text-primary-700">
                  {lead.conversationLabel}
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                list="conversation-tag-suggestions"
                value={conversationLabelDraft}
                onChange={(e) => {
                  setConversationLabelDraft(e.target.value);
                  setIsConversationLabelDirty(true);
                }}
                maxLength={60}
                placeholder="e.g., Price enquiry"
                className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
              <button
                onClick={() => handleSaveConversationLabel(conversationLabelDraft)}
                disabled={savingConversationLabel || conversationLabelDraft === (lead.conversationLabel || '')}
                className="px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {savingConversationLabel ? 'Saving...' : 'Save'}
              </button>
            </div>

            <datalist id="conversation-tag-suggestions">
              {CONVERSATION_LABEL_SUGGESTIONS.map((opt) => (
                <option key={opt} value={opt} />
              ))}
            </datalist>

            <div className="flex flex-wrap gap-2 mt-3">
              {CONVERSATION_LABEL_SUGGESTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    setConversationLabelDraft(opt);
                    setIsConversationLabelDirty(true);
                    handleSaveConversationLabel(opt);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-gray-700 border border-gray-200 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 transition-colors"
                >
                  {opt}
                </button>
              ))}
              {(lead.conversationLabel || conversationLabelDraft) && (
                <button
                  onClick={() => {
                    setConversationLabelDraft('');
                    setIsConversationLabelDirty(true);
                    handleSaveConversationLabel('');
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-gray-50 p-4 border border-gray-100 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-whatsapp-500/10 text-whatsapp-600">
                <Clock className="w-4 h-4 shrink-0" />
              </span>
              Last WhatsApp contact
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900">
                  {lastContactLabel}
                </div>
                {lastContactExact && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {lastContactExact}
                  </div>
                )}
              </div>
              <button
                onClick={handleMarkContactedToday}
                disabled={markingContacted}
                className="shrink-0 w-full sm:w-auto px-4 py-2.5 bg-whatsapp-500 text-white rounded-xl text-sm font-medium hover:bg-whatsapp-600 disabled:opacity-50 shadow-sm"
              >
                {markingContacted ? 'Marking...' : 'Mark contacted today'}
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-gray-50 p-4 border border-gray-100 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
                <MessageCircle className="w-4 h-4 shrink-0" />
              </span>
              Last message summary
            </div>
            <textarea
              value={lastMessageSummaryDraft}
              onChange={(e) => {
                setLastMessageSummaryDraft(e.target.value);
                setIsLastMessageSummaryDirty(true);
              }}
              maxLength={500}
              rows={4}
              placeholder="Summarize the latest conversation (optional)"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
            />
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{lastMessageSummaryDraft.length}/500</span>
              <button
                onClick={() => handleSaveLastMessageSummary(lastMessageSummaryDraft)}
                disabled={
                  savingLastMessageSummary ||
                  lastMessageSummaryDraft === (lead.lastMessageSummary || '')
                }
                className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {savingLastMessageSummary ? 'Saving...' : 'Save'}
              </button>
            </div>
            {lastMessageSummaryError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {lastMessageSummaryError}
              </div>
            )}
          </div>

          {whatsAppContextError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              {whatsAppContextError}
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Active Follow-up Alert */}
      {lead.activeFollowUp && (
        <div className="rounded-2xl bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200/80 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <Clock className="w-5 h-5" />
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-amber-900">
                Follow-up scheduled
              </h3>
              <p className="text-sm text-amber-800 mt-1">
                {format(parseISO(lead.activeFollowUp.date), 'MMM d, yyyy')} at {lead.activeFollowUp.time}
              </p>
              {lead.activeFollowUp.note && (
                <p className="text-sm text-amber-700 mt-1">
                  {lead.activeFollowUp.note}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-2xl bg-gray-100 border border-gray-200/80">
        <button
          onClick={() => setActiveTab('notes')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'notes'
              ? 'bg-white text-primary-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Notes ({lead.notes?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('followups')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'followups'
              ? 'bg-white text-primary-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Follow-ups
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'activity'
              ? 'bg-white text-primary-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Activity
        </button>
      </div>

      {/* Notes Tab */}
      {activeTab === 'notes' && (
        <div className="space-y-4">
          {/* Add Note */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note..."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
              rows={3}
            />
            <div className="flex justify-end mt-3">
              <button
                onClick={handleAddNote}
                disabled={!newNote.trim() || addingNote}
                className="bg-primary-600 text-white py-2.5 px-5 rounded-xl text-sm font-medium hover:bg-primary-700 active:bg-primary-800 transition-colors disabled:opacity-50"
              >
                {addingNote ? 'Adding...' : 'Add Note'}
              </button>
            </div>
          </div>

          {/* Notes List */}
          {lead.notes?.length === 0 ? (
            <div className="text-center py-10 text-gray-500 rounded-2xl bg-gray-50 border border-gray-100">
              No notes yet. Add your first note above.
            </div>
          ) : (
            lead.notes?.map((note) => (
              <div key={note.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                {editingNote === note.id ? (
                  <div className="space-y-2">
                    <textarea
                      defaultValue={note.content}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
                      rows={3}
                      id={`note-edit-${note.id}`}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingNote(null)}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          const content = document.getElementById(`note-edit-${note.id}`).value;
                          handleUpdateNote(note.id, content);
                        }}
                        className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-gray-800 whitespace-pre-wrap">{note.content}</p>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                      <span className="text-xs text-gray-500">
                        {(note.createdBy?.fullName || note.createdBy?.businessName || 'Team member')}
                        {' · '}
                        {format(parseISO(note.createdAt), 'MMM d, yyyy h:mm a')}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setEditingNote(note.id)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="p-1.5 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Follow-ups Tab */}
      {activeTab === 'followups' && (
        <div className="space-y-3">
          {/* Add Follow-up Button */}
          {!showAddFollowUp && (
            <button
              onClick={() => setShowAddFollowUp(true)}
              className="w-full flex items-center justify-center gap-2 bg-white border-2 border-dashed border-gray-200 text-gray-500 py-4 rounded-2xl font-medium hover:border-primary-300 hover:bg-primary-50/50 hover:text-primary-600 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Schedule Follow-up
            </button>
          )}

          {/* Add Follow-up Form */}
          {showAddFollowUp && (
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <h3 className="font-medium text-gray-900 mb-3">Schedule Follow-up</h3>
              
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="min-w-0 flex flex-col">
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="followup-date">
                      Date *
                    </label>
                    <input
                      id="followup-date"
                      type="date"
                      value={followUpData.date}
                      onChange={(e) => setFollowUpData({ ...followUpData, date: e.target.value })}
                      className="w-full min-w-0 min-h-[48px] px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-base touch-manipulation bg-white"
                      required
                    />
                  </div>
                  <div className="min-w-0 flex flex-col">
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="followup-time">
                      Time *
                    </label>
                    <input
                      id="followup-time"
                      type="time"
                      value={followUpData.time}
                      onChange={(e) => setFollowUpData({ ...followUpData, time: e.target.value })}
                      className="w-full min-w-0 min-h-[48px] px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-base touch-manipulation bg-white"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Note (optional, max 140 chars)
                  </label>
                  <textarea
                    value={followUpData.note}
                    onChange={(e) => setFollowUpData({ ...followUpData, note: e.target.value })}
                    maxLength={140}
                    placeholder="What to discuss..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
                    rows={2}
                  />
                  <div className="text-right text-xs text-gray-500 mt-1">
                    {followUpData.note.length}/140
                  </div>
                </div>

                {followUpError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    {followUpError}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddFollowUp(false)}
                    className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddFollowUp}
                    disabled={!followUpData.date || !followUpData.time}
                    className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
                  >
                    Schedule
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Follow-ups List */}
          {lead.activeFollowUp && (
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
                  <Calendar className="w-5 h-5" />
                </span>
                <h3 className="font-semibold text-gray-900">Upcoming</h3>
              </div>
              <p className="text-gray-600">
                {format(parseISO(lead.activeFollowUp.date), 'MMMM d, yyyy')} at {lead.activeFollowUp.time}
              </p>
              {lead.activeFollowUp.note && (
                <p className="text-sm text-gray-500 mt-2 bg-gray-50 rounded p-2">
                  {lead.activeFollowUp.note}
                </p>
              )}
            </div>
          )}

          {!lead.activeFollowUp && !showAddFollowUp && (
            <div className="text-center py-8 text-gray-500">
              No follow-ups scheduled. Add one above.
            </div>
          )}
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="space-y-3">
          {activityLog.length === 0 ? (
            <div className="text-center py-10 text-gray-500 rounded-2xl bg-gray-50 border border-gray-100">
              No activity yet.
            </div>
          ) : (
            activityLog.map((entry) => (
              <div key={entry.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <div className="text-sm text-gray-700 font-medium">
                  {getActivityLabel(entry)}
                  {getActivityMeta(entry) && (
                    <span className="text-gray-500 font-normal"> · {getActivityMeta(entry)}</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {entry.user?.fullName || 'Someone'} • {format(parseISO(entry.createdAt), 'MMM d, yyyy h:mm a')}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default LeadDetail;
