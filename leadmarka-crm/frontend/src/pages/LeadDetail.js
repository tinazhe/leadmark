import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MessageCircle, Calendar, Plus, Trash2, Edit2, Check, X, Clock, Tag } from 'lucide-react';
import { format, parseISO, formatDistanceToNow, isToday } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { leadsAPI, notesAPI, followUpsAPI } from '../services/api';

const STATUS_OPTIONS = [
  { value: 'new', label: 'New', className: 'bg-gray-100 text-gray-800' },
  { value: 'interested', label: 'Interested', className: 'bg-blue-100 text-blue-800' },
  { value: 'follow-up', label: 'Follow-up', className: 'bg-yellow-100 text-yellow-800' },
  { value: 'won', label: 'Won', className: 'bg-green-100 text-green-800' },
  { value: 'lost', label: 'Lost', className: 'bg-red-100 text-red-800' },
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

const LeadDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('notes');

  const [conversationLabelDraft, setConversationLabelDraft] = useState('');
  const [isConversationLabelDirty, setIsConversationLabelDirty] = useState(false);
  const [savingConversationLabel, setSavingConversationLabel] = useState(false);
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

  const error = isError ? 'Failed to load lead' : null;

  useEffect(() => {
    // When switching leads, reset draft state.
    setIsConversationLabelDirty(false);
  }, [id]);

  useEffect(() => {
    if (isConversationLabelDirty) return;
    setConversationLabelDraft(lead?.conversationLabel || '');
  }, [lead?.conversationLabel, isConversationLabelDirty]);

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
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-200 rounded-lg"></div>
          <div className="h-48 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
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

  return (
    <div className="p-4 space-y-4">
      {/* Lead Header */}
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{lead.name}</h2>
            <p className="text-gray-600">{lead.phoneNumber}</p>
          </div>
          <select
            value={lead.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border-0 cursor-pointer ${
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

        <div className="flex gap-2">
          <a
            href={lead.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 bg-whatsapp-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-whatsapp-600 active:bg-whatsapp-700 transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            Chat on WhatsApp
          </a>
          <button
            onClick={handleDeleteLead}
            className="p-3 text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        {/* WhatsApp Context */}
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Tag className="w-4 h-4 text-gray-500" />
                Conversation tag
              </div>
              {lead.conversationLabel && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary-50 text-primary-700 border border-primary-200">
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
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
              <button
                onClick={() => handleSaveConversationLabel(conversationLabelDraft)}
                disabled={savingConversationLabel || conversationLabelDraft === (lead.conversationLabel || '')}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {savingConversationLabel ? 'Saving...' : 'Save'}
              </button>
            </div>

            <datalist id="conversation-tag-suggestions">
              {CONVERSATION_LABEL_SUGGESTIONS.map((opt) => (
                <option key={opt} value={opt} />
              ))}
            </datalist>

            <div className="flex flex-wrap gap-2 mt-2">
              {CONVERSATION_LABEL_SUGGESTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    setConversationLabelDraft(opt);
                    setIsConversationLabelDirty(true);
                    handleSaveConversationLabel(opt);
                  }}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
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
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Clock className="w-4 h-4 text-gray-500 shrink-0" />
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
                className="shrink-0 w-full sm:w-auto px-4 py-2.5 bg-whatsapp-500 text-white rounded-lg text-sm font-medium hover:bg-whatsapp-600 disabled:opacity-50"
              >
                {markingContacted ? 'Marking...' : 'Mark contacted today'}
              </button>
            </div>
          </div>

          {whatsAppContextError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {whatsAppContextError}
            </div>
          )}
        </div>
      </div>

      {/* Active Follow-up Alert */}
      {lead.activeFollowUp && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-yellow-900">
                Follow-up scheduled
              </h3>
              <p className="text-sm text-yellow-700 mt-1">
                {format(parseISO(lead.activeFollowUp.date), 'MMM d, yyyy')} at {lead.activeFollowUp.time}
              </p>
              {lead.activeFollowUp.note && (
                <p className="text-sm text-yellow-600 mt-1">
                  {lead.activeFollowUp.note}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('notes')}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'notes'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Notes ({lead.notes?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('followups')}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'followups'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Follow-ups
        </button>
      </div>

      {/* Notes Tab */}
      {activeTab === 'notes' && (
        <div className="space-y-3">
          {/* Add Note */}
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
              rows={3}
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleAddNote}
                disabled={!newNote.trim() || addingNote}
                className="bg-primary-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-primary-700 active:bg-primary-800 transition-colors disabled:opacity-50"
              >
                {addingNote ? 'Adding...' : 'Add Note'}
              </button>
            </div>
          </div>

          {/* Notes List */}
          {lead.notes?.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No notes yet. Add your first note above.
            </div>
          ) : (
            lead.notes?.map((note) => (
              <div key={note.id} className="bg-white rounded-lg p-4 border border-gray-200">
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
              className="w-full flex items-center justify-center gap-2 bg-white border-2 border-dashed border-gray-300 text-gray-600 py-3 rounded-lg font-medium hover:border-primary-500 hover:text-primary-600 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Schedule Follow-up
            </button>
          )}

          {/* Add Follow-up Form */}
          {showAddFollowUp && (
            <div className="bg-white rounded-lg p-4 border border-gray-200">
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
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-5 h-5 text-primary-600" />
                <h3 className="font-medium text-gray-900">Upcoming</h3>
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
    </div>
  );
};

export default LeadDetail;
