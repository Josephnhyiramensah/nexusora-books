import { useState, useEffect } from 'react';
import { FiPlus, FiBookmark, FiTrash2, FiMessageSquare, FiSearch } from 'react-icons/fi';
import noteService from '../../services/noteService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import Modal from '../../components/common/Modal';

function NoteForm({ note, onSave, onCancel, userRole }) {
  const [form, setForm] = useState({
    title: note?.title || '', content: note?.content || '',
    type: note?.type || 'personal', tags: note?.tags?.join(', ') || '',
  });
  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...form, tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean) });
  };
  const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none' };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Title *</label>
        <input style={inputStyle} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="Note title..." />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Type</label>
          <select style={inputStyle} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="personal">Personal</option>
            <option value="company">Company</option>
            {['super_admin', 'admin'].includes(userRole) && <option value="announcement">Announcement</option>}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Tags (comma separated)</label>
          <input style={inputStyle} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="finance, urgent, todo" />
        </div>
      </div>
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Content *</label>
        <textarea style={{ ...inputStyle, minHeight: 160, resize: 'vertical' }} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} required placeholder="Write your note..." />
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={{ padding: '10px 22px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 14, color: 'var(--text-secondary)', background: '#fff' }}>Cancel</button>
        <button type="submit" style={{ padding: '10px 22px', borderRadius: 'var(--radius-sm)', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', fontSize: 14, fontWeight: 600 }}>{note ? 'Update' : 'Create'} Note</button>
      </div>
    </form>
  );
}

export default function NotesPage() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [commentingOn, setCommentingOn] = useState(null);
  const { user } = useAuth();
  const { showToast, ToastComponent } = useToast();

  const fetchNotes = async () => {
    try { setLoading(true); const r = await noteService.getAll(activeTab || undefined); if (r.success) setNotes(r.data); }
    catch { showToast('Failed to fetch notes', 'error'); } finally { setLoading(false); }
  };

  useEffect(() => { fetchNotes(); }, [activeTab]);

  const handleSave = async (data) => {
    try {
      if (editing) { await noteService.update(editing._id, data); showToast('Note updated'); }
      else { await noteService.create(data); showToast('Note created'); }
      setModalOpen(false); setEditing(null); fetchNotes();
    } catch (err) { showToast(err.response?.data?.message || 'Failed', 'error'); }
  };

  const handlePin = async (id) => {
    try { await noteService.pin(id); fetchNotes(); } catch { showToast('Failed', 'error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this note?')) return;
    try { await noteService.delete(id); showToast('Note deleted'); fetchNotes(); } catch { showToast('Failed', 'error'); }
  };

  const handleComment = async (noteId) => {
    if (!commentText.trim()) return;
    try { await noteService.addComment(noteId, commentText); setCommentText(''); setCommentingOn(null); fetchNotes(); }
    catch { showToast('Failed', 'error'); }
  };

  const tabs = [
    { key: '', label: 'All Notes' },
    { key: 'personal', label: 'Personal' },
    { key: 'company', label: 'Company' },
    { key: 'announcement', label: 'Announcements' },
  ];

  const typeColors = { personal: '#2563EB', company: '#16A34A', announcement: '#DC2626' };

  const filtered = notes.filter((n) =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.content.toLowerCase().includes(search.toLowerCase()) ||
    (n.tags || []).some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      {ToastComponent}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>Notes</h1>
        <button onClick={() => { setEditing(null); setModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 600 }}>
          <FiPlus size={16} /> New Note
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            padding: '10px 20px', fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400,
            color: activeTab === tab.key ? 'var(--deep-navy)' : 'var(--text-muted)',
            borderBottom: activeTab === tab.key ? '2px solid var(--nexusora-gold)' : '2px solid transparent',
            background: 'transparent', marginBottom: -1,
          }}>{tab.label}</button>
        ))}
      </div>

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 14px', marginBottom: 20, maxWidth: 360 }}>
        <FiSearch size={15} color="var(--text-muted)" />
        <input type="text" placeholder="Search notes..." value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, width: '100%' }} />
      </div>

      {/* Notes Grid */}
      {loading ? <p style={{ color: 'var(--text-muted)', padding: 20 }}>Loading...</p> :
      filtered.length === 0 ? <p style={{ color: 'var(--text-muted)', padding: 20 }}>No notes found.</p> :
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {filtered.map((note) => (
          <div key={note._id} style={{
            background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
            borderLeft: `4px solid ${typeColors[note.type] || '#6B7280'}`,
            padding: 20, position: 'relative',
          }}>
            {note.isPinned && <FiBookmark size={14} style={{ position: 'absolute', top: 12, right: 12, color: 'var(--nexusora-gold)' }} />}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: `${typeColors[note.type]}15`, color: typeColors[note.type], textTransform: 'capitalize' }}>{note.type}</span>
              {(note.tags || []).map((tag, i) => (
                <span key={i} style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, background: 'var(--bg-app)', color: 'var(--text-muted)' }}>#{tag}</span>
              ))}
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>{note.title}</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, maxHeight: 80, overflow: 'hidden' }}>{note.content}</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {note.createdBy?.firstName} {note.createdBy?.lastName} • {new Date(note.createdAt).toLocaleDateString('en-GB')}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => handlePin(note._id)} title="Pin" style={{ padding: 4, color: note.isPinned ? 'var(--nexusora-gold)' : 'var(--text-muted)' }}><FiBookmark size={14} /></button>
                <button onClick={() => { setCommentingOn(commentingOn === note._id ? null : note._id); }} title="Comment" style={{ padding: 4, color: 'var(--text-muted)' }}><FiMessageSquare size={14} /> <span style={{ fontSize: 10 }}>{note.comments?.length || 0}</span></button>
                <button onClick={() => { setEditing(note); setModalOpen(true); }} title="Edit" style={{ padding: 4, color: 'var(--tech-blue)', fontSize: 12 }}>Edit</button>
                <button onClick={() => handleDelete(note._id)} title="Delete" style={{ padding: 4, color: 'var(--danger)' }}><FiTrash2 size={13} /></button>
              </div>
            </div>

            {/* Comments */}
            {commentingOn === note._id && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                {note.comments?.map((c, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, padding: '6px 10px', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)' }}>
                    <strong>{c.user?.firstName}</strong>: {c.text}
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Add comment..."
                    style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, outline: 'none' }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleComment(note._id); }} />
                  <button onClick={() => handleComment(note._id)} style={{ padding: '8px 14px', background: 'var(--tech-blue)', color: '#fff', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600 }}>Send</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>}

      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} title={editing ? 'Edit Note' : 'New Note'} width={640}>
        <NoteForm note={editing} onSave={handleSave} onCancel={() => { setModalOpen(false); setEditing(null); }} userRole={user?.role} />
      </Modal>
    </div>
  );
}