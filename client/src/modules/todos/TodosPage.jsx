import { useState, useEffect } from 'react';
import { FiPlus, FiCheck, FiCircle, FiTrash2, FiClock, FiAlertCircle } from 'react-icons/fi';
import todoService from '../../services/todoService';
import { useToast } from '../../hooks/useToast';
import Modal from '../../components/common/Modal';

const priorityColors = { high: { bg: '#FEE2E2', text: '#DC2626', border: '#FECACA' }, medium: { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' }, low: { bg: '#D1FAE5', text: '#16A34A', border: '#A7F3D0' } };

function TodoForm({ todo, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: todo?.title || '', description: todo?.description || '',
    priority: todo?.priority || 'medium', dueDate: todo?.dueDate ? new Date(todo.dueDate).toISOString().split('T')[0] : '',
  });
  const handleSubmit = (e) => { e.preventDefault(); onSave(form); };
  const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none' };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Task Title *</label>
        <input style={inputStyle} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="What needs to be done?" />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Description</label>
        <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Additional details..." />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Priority</label>
          <select style={inputStyle} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Due Date</label>
          <input type="date" style={inputStyle} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={{ padding: '10px 22px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 14, color: 'var(--text-secondary)', background: '#fff' }}>Cancel</button>
        <button type="submit" style={{ padding: '10px 22px', borderRadius: 'var(--radius-sm)', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', fontSize: 14, fontWeight: 600 }}>{todo ? 'Update' : 'Create'} Task</button>
      </div>
    </form>
  );
}

export default function TodosPage() {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const { showToast, ToastComponent } = useToast();

  const fetchTodos = async () => {
    try { setLoading(true); const r = await todoService.getAll({ status: filterStatus, priority: filterPriority }); if (r.success) setTodos(r.data); }
    catch { showToast('Failed to fetch tasks', 'error'); } finally { setLoading(false); }
  };

  useEffect(() => { fetchTodos(); }, [filterStatus, filterPriority]);

  const handleSave = async (data) => {
    try {
      if (editing) { await todoService.update(editing._id, data); showToast('Task updated'); }
      else { await todoService.create(data); showToast('Task created'); }
      setModalOpen(false); setEditing(null); fetchTodos();
    } catch (err) { showToast(err.response?.data?.message || 'Failed', 'error'); }
  };

  const handleToggle = async (id) => {
    try { const r = await todoService.complete(id); if (r.success) { showToast(r.message); fetchTodos(); } }
    catch { showToast('Failed', 'error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this task?')) return;
    try { await todoService.delete(id); showToast('Task deleted'); fetchTodos(); } catch { showToast('Failed', 'error'); }
  };

  const isOverdue = (dueDate, status) => {
    if (status === 'completed' || !dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const pending = todos.filter((t) => t.status !== 'completed');
  const completed = todos.filter((t) => t.status === 'completed');

  return (
    <div>
      {ToastComponent}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>To-Do List</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{pending.length} pending, {completed.length} completed</p>
        </div>
        <button onClick={() => { setEditing(null); setModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 600 }}>
          <FiPlus size={16} /> New Task
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: '9px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, background: '#fff' }}>
          <option value="">All statuses</option><option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="completed">Completed</option>
        </select>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} style={{ padding: '9px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, background: '#fff' }}>
          <option value="">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
        </select>
      </div>

      {loading ? <p style={{ color: 'var(--text-muted)', padding: 20 }}>Loading...</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {todos.length === 0 && <p style={{ color: 'var(--text-muted)', padding: 20 }}>No tasks found.</p>}
          {todos.map((todo) => {
            const pc = priorityColors[todo.priority];
            const overdue = isOverdue(todo.dueDate, todo.status);
            return (
              <div key={todo._id} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
                background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                borderLeft: `4px solid ${pc.text}`,
                opacity: todo.status === 'completed' ? 0.6 : 1,
              }}>
                {/* Toggle */}
                <button onClick={() => handleToggle(todo._id)} style={{ padding: 4, color: todo.status === 'completed' ? 'var(--success)' : 'var(--border)', flexShrink: 0 }}>
                  {todo.status === 'completed' ? <FiCheck size={20} /> : <FiCircle size={20} />}
                </button>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', textDecoration: todo.status === 'completed' ? 'line-through' : 'none' }}>{todo.title}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: pc.bg, color: pc.text, border: `1px solid ${pc.border}`, textTransform: 'capitalize' }}>{todo.priority}</span>
                    {overdue && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--danger)', fontWeight: 600 }}><FiAlertCircle size={12} /> Overdue</span>}
                  </div>
                  {todo.description && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{todo.description}</p>}
                  <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                    {todo.dueDate && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FiClock size={11} /> {new Date(todo.dueDate).toLocaleDateString('en-GB')}</span>}
                    {todo.assignedTo && <span>Assigned to: {todo.assignedTo.firstName} {todo.assignedTo.lastName}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => { setEditing(todo); setModalOpen(true); }} style={{ padding: '4px 8px', color: 'var(--tech-blue)', fontSize: 12 }}>Edit</button>
                  <button onClick={() => handleDelete(todo._id)} style={{ padding: 4, color: 'var(--danger)' }}><FiTrash2 size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} title={editing ? 'Edit Task' : 'New Task'}>
        <TodoForm todo={editing} onSave={handleSave} onCancel={() => { setModalOpen(false); setEditing(null); }} />
      </Modal>
    </div>
  );
}