const express = require('express');
const { body, validationResult } = require('express-validator');
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');
const { workspaceMiddleware } = require('../middleware/workspace');
const { subscriptionMiddleware } = require('../middleware/subscription');
const { logActivity } = require('../utils/activity');
const { fetchProfilesByIds } = require('../utils/workspace');

const router = express.Router();

// Get all notes for a lead
router.get('/lead/:leadId', authMiddleware, workspaceMiddleware, subscriptionMiddleware, async (req, res) => {
  try {
    const { leadId } = req.params;
    const ownerId = req.workspaceOwnerId;

    // Verify lead belongs to user
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id')
      .eq('id', leadId)
      .eq('user_id', ownerId)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const { data: notes, error } = await supabase
      .from('notes')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const noteUserIds = Array.from(new Set(
      (notes || []).map((note) => note.user_id).filter(Boolean)
    ));
    const noteProfiles = await fetchProfilesByIds(noteUserIds);
    const noteProfileById = new Map(
      noteProfiles.map((profile) => [profile.id, profile])
    );

    res.json(notes.map((note) => {
      const profile = noteProfileById.get(note.user_id) || null;
      return {
        id: note.id,
        leadId: note.lead_id,
        content: note.content,
        createdAt: note.created_at,
        updatedAt: note.updated_at,
        createdBy: profile ? {
          id: profile.id,
          fullName: profile.full_name,
          businessName: profile.business_name,
        } : null,
      };
    }));
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single note
router.get('/:id', authMiddleware, workspaceMiddleware, subscriptionMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const ownerId = req.workspaceOwnerId;

    const { data: note, error } = await supabase
      .from('notes')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id')
      .eq('id', note.lead_id)
      .eq('user_id', ownerId)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const profiles = await fetchProfilesByIds(note.user_id ? [note.user_id] : []);
    const profile = profiles[0] || null;

    res.json({
      id: note.id,
      leadId: note.lead_id,
      content: note.content,
      createdAt: note.created_at,
      updatedAt: note.updated_at,
      createdBy: profile ? {
        id: profile.id,
        fullName: profile.full_name,
        businessName: profile.business_name,
      } : null,
    });
  } catch (error) {
    console.error('Get note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create note
router.post('/', authMiddleware, workspaceMiddleware, subscriptionMiddleware, [
  body('leadId').notEmpty().withMessage('Lead ID is required'),
  body('content').trim().notEmpty().withMessage('Content is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { leadId, content } = req.body;
    const userId = req.userId;
    const ownerId = req.workspaceOwnerId;

    // Verify lead belongs to user
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, name')
      .eq('id', leadId)
      .eq('user_id', ownerId)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const { data: note, error } = await supabase
      .from('notes')
      .insert([{
        lead_id: leadId,
        user_id: userId,
        content,
      }])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    await logActivity({
      leadId,
      userId,
      action: 'note_added',
    });

    res.status(201).json({
      id: note.id,
      leadId: note.lead_id,
      leadName: lead.name,
      content: note.content,
      createdAt: note.created_at,
      updatedAt: note.updated_at,
    });
  } catch (error) {
    console.error('Create note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update note
router.put('/:id', authMiddleware, workspaceMiddleware, subscriptionMiddleware, [
  body('content').trim().notEmpty().withMessage('Content is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { content } = req.body;
    const userId = req.userId;
    const ownerId = req.workspaceOwnerId;

    const { data: existingNote, error: existingError } = await supabase
      .from('notes')
      .select('id, lead_id, user_id')
      .eq('id', id)
      .single();

    if (existingError || !existingNote) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id')
      .eq('id', existingNote.lead_id)
      .eq('user_id', ownerId)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const { data: note, error } = await supabase
      .from('notes')
      .update({ content })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.json({
      id: note.id,
      leadId: note.lead_id,
      content: note.content,
      createdAt: note.created_at,
      updatedAt: note.updated_at,
    });

    await logActivity({
      leadId: note.lead_id,
      userId,
      action: 'note_edited',
    });
  } catch (error) {
    console.error('Update note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete note
router.delete('/:id', authMiddleware, workspaceMiddleware, subscriptionMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const ownerId = req.workspaceOwnerId;

    const { data: existingNote, error: existingError } = await supabase
      .from('notes')
      .select('id, lead_id, user_id')
      .eq('id', id)
      .single();

    if (existingError || !existingNote) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id')
      .eq('id', existingNote.lead_id)
      .eq('user_id', ownerId)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
