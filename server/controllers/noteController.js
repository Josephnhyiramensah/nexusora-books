const { getModel } = require('../utils/getModel');
const { logAudit } = require('../middleware/auditMiddleware');

const getNotes = async (req, res) => {
  try {
    const Note = getModel(req.tenantDb, 'Note');
    const { type } = req.query;
    let filter = {};

    if (type === 'personal') {
      filter = { type: 'personal', createdBy: req.user._id };
    } else if (type === 'company') {
      filter = {
        type: 'company',
        $or: [
          { visibleToRoles: { $size: 0 } },
          { visibleToRoles: { $exists: false } },
          { visibleToRoles: req.user.role },
        ],
      };
    } else if (type === 'announcement') {
      filter = { type: 'announcement' };
    } else {
      // All notes user can see
      filter = {
        $or: [
          { type: 'personal', createdBy: req.user._id },
          { type: 'company', $or: [{ visibleToRoles: { $size: 0 } }, { visibleToRoles: { $exists: false } }, { visibleToRoles: req.user.role }] },
          { type: 'announcement' },
        ],
      };
    }

    const notes = await Note.find(filter)
      .populate('createdBy', 'firstName lastName')
      .populate('comments.user', 'firstName lastName')
      .sort({ isPinned: -1, createdAt: -1 })
      .lean();

    res.json({ success: true, data: notes, count: notes.length });
  } catch (error) {
    console.error('[Notes] List error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch notes.' });
  }
};

const getNote = async (req, res) => {
  try {
    const Note = getModel(req.tenantDb, 'Note');
    const note = await Note.findById(req.params.id)
      .populate('createdBy', 'firstName lastName')
      .populate('comments.user', 'firstName lastName');
    if (!note) return res.status(404).json({ success: false, message: 'Note not found.' });

    // Mark as read for announcements
    if (note.type === 'announcement') {
      const alreadyRead = note.readBy.some((r) => r.user.toString() === req.user._id.toString());
      if (!alreadyRead) {
        note.readBy.push({ user: req.user._id, readAt: new Date() });
        await note.save();
      }
    }

    res.json({ success: true, data: note });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch note.' });
  }
};

const createNote = async (req, res) => {
  try {
    const Note = getModel(req.tenantDb, 'Note');
    const { title, content, type, tags, visibleToRoles, scheduledDate } = req.body;

    if (!title || !content) return res.status(400).json({ success: false, message: 'Title and content required.' });

    // Only admin can create announcements
    if (type === 'announcement' && !['super_admin', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only admins can create announcements.' });
    }

    const note = await Note.create({
      title, content, type: type || 'personal',
      tags: tags || [], visibleToRoles: visibleToRoles || [],
      scheduledDate, createdBy: req.user._id,
    });

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'create', module: 'notes',
      entityId: note._id, entityType: 'Note',
      description: `Created ${type || 'personal'} note: ${title}`,
    }, req);

    res.status(201).json({ success: true, message: 'Note created.', data: note });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create note.' });
  }
};

const updateNote = async (req, res) => {
  try {
    const Note = getModel(req.tenantDb, 'Note');
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ success: false, message: 'Note not found.' });

    // Only creator or admin can edit
    if (note.createdBy.toString() !== req.user._id.toString() && !['super_admin', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorised to edit this note.' });
    }

    const fields = ['title', 'content', 'tags', 'visibleToRoles', 'scheduledDate'];
    fields.forEach((f) => { if (req.body[f] !== undefined) note[f] = req.body[f]; });
    await note.save();

    res.json({ success: true, message: 'Note updated.', data: note });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update note.' });
  }
};

const deleteNote = async (req, res) => {
  try {
    const Note = getModel(req.tenantDb, 'Note');
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ success: false, message: 'Note not found.' });

    if (note.createdBy.toString() !== req.user._id.toString() && !['super_admin', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorised.' });
    }

    await Note.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Note deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete note.' });
  }
};

const pinNote = async (req, res) => {
  try {
    const Note = getModel(req.tenantDb, 'Note');
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ success: false, message: 'Note not found.' });

    note.isPinned = !note.isPinned;
    await note.save();

    res.json({ success: true, message: note.isPinned ? 'Note pinned.' : 'Note unpinned.', data: note });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to pin note.' });
  }
};

const addComment = async (req, res) => {
  try {
    const Note = getModel(req.tenantDb, 'Note');
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ success: false, message: 'Note not found.' });

    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'Comment text required.' });

    note.comments.push({ user: req.user._id, text });
    await note.save();

    const updated = await Note.findById(note._id).populate('comments.user', 'firstName lastName');
    res.json({ success: true, message: 'Comment added.', data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add comment.' });
  }
};

module.exports = { getNotes, getNote, createNote, updateNote, deleteNote, pinNote, addComment };