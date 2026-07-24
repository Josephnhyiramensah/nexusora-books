import { useState, useEffect, useRef } from 'react';
import { FiPlus, FiCheck, FiEdit2, FiArrowLeft, FiDownload, FiPrinter, FiEye, FiTrash2, FiX } from 'react-icons/fi';
import { useToast } from '../../hooks/useToast';
import { useTenant } from '../../context/TenantContext';
import Modal from '../../components/common/Modal';
import ResponsiveTable from '../../components/common/ResponsiveTable';
import { ReportHeader, printReport } from '../reports/ReportShared';
import { exportCasualSheetExcel, exportCasualSlipExcel } from './casualExcel';
import api from '../../services/api';

const n2 = (v) => Number(v || 0).toFixed(2);
const today = () => new Date().toISOString().split('T')[0];
const EMPTY_LINE = { worker: '', workerName: '', rate: '', days: '', note: '' };

export default function CasualWorkersPage() {
  const [tab, setTab] = useState('sheets');
  const [workers, setWorkers] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  const [workerModal, setWorkerModal] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null);
  const [wForm, setWForm] = useState({ name: '', phone: '', idNumber: '', defaultRate: '', notes: '' });

  const [sheetModal, setSheetModal] = useState(false);
  const [sForm, setSForm] = useState({ title: '', periodLabel: '', date: today() });
  const [lines, setLines] = useState([{ ...EMPTY_LINE }]);
  const [saving, setSaving] = useState(false);

  const { showToast, ToastComponent } = useToast();
  const { companyName, settings } = useTenant();
  const sheetRef = useRef(null);

  const fetchWorkers = async () => {
    try { const { data } = await api.get('/payroll/casual/workers'); if (data.success) setWorkers(data.data); } catch {}
  };
  const fetchSheets = async () => {
    try { const { data } = await api.get('/payroll/casual/sheets'); if (data.success) setSheets(data.data); } catch {}
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchWorkers(), fetchSheets()]).finally(() => setLoading(false));
  }, []);

  // ─── Workers ───────────────────────────────────────────────────────────────
  const openWorker = (w) => {
    setEditingWorker(w || null);
    setWForm(w ? {
      name: w.name || '', phone: w.phone || '', idNumber: w.idNumber || '',
      defaultRate: w.defaultRate ?? '', notes: w.notes || '',
    } : { name: '', phone: '', idNumber: '', defaultRate: '', notes: '' });
    setWorkerModal(true);
  };

  const saveWorker = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...wForm, defaultRate: Number(wForm.defaultRate || 0) };
    try {
      if (editingWorker) { await api.put(`/payroll/casual/workers/${editingWorker._id}`, payload); showToast('Worker updated'); }
      else { await api.post('/payroll/casual/workers', payload); showToast('Worker added'); }
      setWorkerModal(false); setEditingWorker(null); fetchWorkers();
    } catch (err) { showToast(err.response?.data?.message || 'Failed to save worker', 'error'); }
    finally { setSaving(false); }
  };

  // ─── Sheet builder ─────────────────────────────────────────────────────────
  const setLine = (i, k, v) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));

  // Choosing a registered worker fills the name and their default rate, but the
  // rate stays editable — a day's work is not always paid at the usual rate.
  const pickWorker = (i, id) => {
    const w = workers.find((x) => x._id === id);
    setLines((prev) => prev.map((l, idx) => (idx === i
      ? { ...l, worker: id, workerName: w ? w.name : l.workerName, rate: w && w.defaultRate ? w.defaultRate : l.rate }
      : l)));
  };

  const addLine = () => setLines((prev) => [...prev, { ...EMPTY_LINE }]);
  const removeLine = (i) => setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));

  const lineAmount = (l) => Number(l.rate || 0) * Number(l.days || 0);
  const draftTotal = lines.reduce((s, l) => s + lineAmount(l), 0);

  const openSheetModal = () => {
    setSForm({ title: '', periodLabel: '', date: today() });
    setLines([{ ...EMPTY_LINE }]);
    setSheetModal(true);
  };

  const saveSheet = async (e) => {
    e.preventDefault();
    const valid = lines.filter((l) => l.workerName && Number(l.days) > 0);
    if (valid.length === 0) { showToast('Add at least one worker with days worked', 'error'); return; }
    setSaving(true);
    try {
      const { data } = await api.post('/payroll/casual/sheets', {
        ...sForm,
        lines: valid.map((l) => ({
          worker: l.worker || undefined,
          workerName: l.workerName,
          rate: Number(l.rate || 0),
          days: Number(l.days || 0),
          note: l.note || '',
        })),
      });
      if (data.success) { showToast(data.message); setSheetModal(false); fetchSheets(); }
    } catch (err) { showToast(err.response?.data?.message || 'Failed to create sheet', 'error'); }
    finally { setSaving(false); }
  };

  const openSheet = async (id) => {
    try {
      const { data } = await api.get(`/payroll/casual/sheets/${id}`);
      if (data.success) setDetail(data.data);
    } catch { showToast('Could not load the sheet', 'error'); }
  };

  const approveSheet = async (id) => {
    if (!window.confirm('Approve this sheet? It posts a journal entry (DR Casual Wages, CR Cash) and updates balances.')) return;
    try {
      const { data } = await api.post(`/payroll/casual/sheets/${id}/approve`);
      if (data.success) { showToast(data.message); fetchSheets(); if (detail?._id === id) openSheet(id); }
    } catch (err) { showToast(err.response?.data?.message || 'Failed to approve', 'error'); }
  };

  const deleteSheet = async (id) => {
    if (!window.confirm('Delete this draft sheet? This cannot be undone.')) return;
    try {
      const { data } = await api.delete(`/payroll/casual/sheets/${id}`);
      if (data.success) { showToast(data.message); fetchSheets(); setDetail(null); }
    } catch (err) { showToast(err.response?.data?.message || 'Failed to delete', 'error'); }
  };

  const dateLabel = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

  const inputStyle = { width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13.5, outline: 'none', boxSizing: 'border-box' };
  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 };
  const th = (align = 'left') => ({ padding: '11px 12px', textAlign: align, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' });
  const td = (align = 'left') => ({ padding: '10px 12px', textAlign: align, whiteSpace: 'nowrap', fontFamily: align === 'right' ? 'monospace' : 'inherit' });
  const btn = (color, bg = '#fff') => ({ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 15px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: bg, fontSize: 12.5, fontWeight: 600, color, cursor: 'pointer' });

  // ─── Single sheet view (printable) ─────────────────────────────────────────
  if (detail) {
    const dl = detail.lines || [];
    return (
      <div>
        {ToastComponent}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <button onClick={() => setDetail(null)} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <FiArrowLeft size={16} /> Back to payment sheets
          </button>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => exportCasualSheetExcel({ companyName, sheet: detail })} style={btn('var(--finance-green, #1A6B3C)')}>
              <FiDownload size={14} /> Export Excel
            </button>
            <button onClick={() => printReport(sheetRef.current, `Casual Payment ${detail.sheetNumber}`)} style={btn('var(--deep-navy)')}>
              <FiPrinter size={14} /> Print / PDF
            </button>
            {detail.status === 'draft' && (
              <>
                <button onClick={() => approveSheet(detail._id)} style={btn('var(--success)')}><FiCheck size={14} /> Approve</button>
                <button onClick={() => deleteSheet(detail._id)} style={btn('var(--danger)')}><FiTrash2 size={14} /> Delete</button>
              </>
            )}
          </div>
        </div>

        <div ref={sheetRef} style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: '28px 24px' }}>
          <ReportHeader
            title="Casual Worker Payment Sheet"
            subtitle={[detail.title, detail.periodLabel, dateLabel(detail.date), detail.sheetNumber].filter(Boolean).join('  ·  ')}
            companyName={companyName}
            settings={settings}
          />

          <ResponsiveTable minWidth={760}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg-app)', borderBottom: '2px solid var(--deep-navy)' }}>
                  <th style={th()}>No</th>
                  <th style={th()}>Name of Worker</th>
                  <th style={th('right')}>Rate</th>
                  <th style={th('right')}>No. of Days</th>
                  <th style={th('right')}>Amount</th>
                  <th style={{ ...th('center'), minWidth: 170 }}>Signature</th>
                </tr>
              </thead>
              <tbody>
                {dl.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No lines on this sheet.</td></tr>
                ) : dl.map((l, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? '#fff' : '#FAFBFC', height: 42 }}>
                    <td style={td()}>{i + 1}</td>
                    <td style={{ ...td(), fontWeight: 500 }}>{l.workerName}</td>
                    <td style={td('right')}>{n2(l.rate)}</td>
                    <td style={td('right')}>{l.days}</td>
                    <td style={{ ...td('right'), fontWeight: 700, color: 'var(--deep-navy)' }}>{n2(l.amount)}</td>
                    <td style={{ ...td('center'), borderBottom: '1px solid var(--border)' }} />
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--deep-navy)', fontWeight: 700, color: 'var(--deep-navy)' }}>
                  <td style={td()} />
                  <td style={td()}>TOTAL</td>
                  <td style={td('right')} />
                  <td style={td('right')} />
                  <td style={td('right')}>{n2(detail.totalAmount)}</td>
                  <td style={td('center')} />
                </tr>
              </tfoot>
            </table>
          </ResponsiveTable>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 44, fontSize: 12, color: 'var(--text-muted)' }}>
            <span>Prepared by: ..................................</span>
            <span>Approved by: ..................................</span>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 18, fontStyle: 'italic' }}>
            All figures in GHS. Casual workers are paid per day worked — no SSNIT or PAYE is deducted.
          </p>
        </div>

        {dl.length > 0 && (
          <div style={{ marginTop: 20, background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: '18px 22px' }}>
            <h4 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--deep-navy)', marginBottom: 4 }}>Individual Payment Slips</h4>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>Download a single worker's slip for their own record.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {dl.map((l, i) => (
                <button key={i} onClick={() => exportCasualSlipExcel({ companyName, sheet: detail, line: l, index: i })}
                  style={{ ...btn('var(--tech-blue)'), padding: '7px 13px', fontSize: 12 }}>
                  <FiDownload size={12} /> {l.workerName}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── List views ────────────────────────────────────────────────────────────
  return (
    <div>
      {ToastComponent}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>Casual Workers</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Day workers paid per day worked — no SSNIT or PAYE.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => openWorker(null)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'var(--tech-blue)', color: '#fff', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}><FiPlus size={14} /> Worker</button>
          <button onClick={openSheetModal} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}><FiPlus size={14} /> Payment Sheet</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {[['sheets', 'Payment Sheets'], ['workers', 'Worker Register']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: '10px 20px', fontSize: 13, fontWeight: tab === k ? 600 : 400, color: tab === k ? 'var(--deep-navy)' : 'var(--text-muted)', borderBottom: tab === k ? '2px solid var(--nexusora-gold)' : '2px solid transparent', background: 'transparent', border: 'none', cursor: 'pointer', marginBottom: -1 }}>{label}</button>
        ))}
      </div>

      {tab === 'sheets' && (
        <div style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <ResponsiveTable minWidth={820}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border)' }}>
                <th style={th()}>Sheet #</th>
                <th style={th()}>Title</th>
                <th style={th()}>Period</th>
                <th style={th()}>Date</th>
                <th style={th('right')}>Workers</th>
                <th style={th('right')}>Total</th>
                <th style={th('center')}>Status</th>
                <th style={th('center')}>Actions</th>
              </tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</td></tr> :
                sheets.length === 0 ? <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No payment sheets yet. Create one to get started.</td></tr> :
                sheets.map((s, i) => (
                  <tr key={s._id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                    <td style={{ ...td(), fontFamily: 'monospace', fontWeight: 600 }}>{s.sheetNumber}</td>
                    <td style={td()}>{s.title || '—'}</td>
                    <td style={td()}>{s.periodLabel || '—'}</td>
                    <td style={td()}>{dateLabel(s.date)}</td>
                    <td style={td('right')}>{(s.lines || []).length}</td>
                    <td style={{ ...td('right'), fontWeight: 600 }}>{n2(s.totalAmount)}</td>
                    <td style={td('center')}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, textTransform: 'capitalize', background: s.status === 'approved' ? '#D1FAE5' : '#FEF3C7', color: s.status === 'approved' ? '#065F46' : '#92400E' }}>{s.status}</span>
                    </td>
                    <td style={td('center')}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button onClick={() => openSheet(s._id)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 'var(--radius-sm)', color: 'var(--tech-blue)', fontSize: 11, fontWeight: 600, border: '1px solid var(--tech-blue)', background: '#fff', cursor: 'pointer' }}><FiEye size={12} /> View</button>
                        {s.status === 'draft' && <button onClick={() => approveSheet(s._id)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 'var(--radius-sm)', color: 'var(--success)', fontSize: 11, fontWeight: 600, border: '1px solid var(--success)', background: '#fff', cursor: 'pointer' }}><FiCheck size={12} /> Approve</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTable>
        </div>
      )}

      {tab === 'workers' && (
        <div style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <ResponsiveTable minWidth={720}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border)' }}>
                <th style={th()}>ID</th>
                <th style={th()}>Name</th>
                <th style={th()}>Phone</th>
                <th style={th()}>ID Number</th>
                <th style={th('right')}>Default Rate</th>
                <th style={th('center')}>Status</th>
                <th style={th('center')}>Actions</th>
              </tr></thead>
              <tbody>
                {workers.length === 0 ? <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No casual workers registered. You can also type a name directly on a payment sheet.</td></tr> :
                workers.map((w, i) => (
                  <tr key={w._id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                    <td style={{ ...td(), fontFamily: 'monospace', fontWeight: 600 }}>{w.workerId}</td>
                    <td style={{ ...td(), fontWeight: 500 }}>{w.name}</td>
                    <td style={td()}>{w.phone || '—'}</td>
                    <td style={td()}>{w.idNumber || '—'}</td>
                    <td style={td('right')}>{w.defaultRate ? n2(w.defaultRate) : '—'}</td>
                    <td style={td('center')}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: w.isActive ? '#D1FAE5' : '#F3F4F6', color: w.isActive ? '#065F46' : '#6B7280' }}>{w.isActive ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td style={td('center')}><button onClick={() => openWorker(w)} style={{ padding: '5px 10px', color: 'var(--tech-blue)', background: 'none', border: 'none', cursor: 'pointer' }}><FiEdit2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTable>
        </div>
      )}

      <Modal isOpen={workerModal} onClose={() => { setWorkerModal(false); setEditingWorker(null); }} title={editingWorker ? 'Edit Casual Worker' : 'New Casual Worker'} width={560}>
        <form onSubmit={saveWorker}>
          <div style={{ marginBottom: 16 }}><label style={labelStyle}>Full Name *</label><input style={inputStyle} value={wForm.name} onChange={(e) => setWForm((p) => ({ ...p, name: e.target.value }))} required /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={wForm.phone} onChange={(e) => setWForm((p) => ({ ...p, phone: e.target.value }))} /></div>
            <div><label style={labelStyle}>ID / Ghana Card No.</label><input style={inputStyle} value={wForm.idNumber} onChange={(e) => setWForm((p) => ({ ...p, idNumber: e.target.value }))} /></div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Default Daily Rate (GHS)</label>
            <input type="number" step="0.01" style={inputStyle} value={wForm.defaultRate} onChange={(e) => setWForm((p) => ({ ...p, defaultRate: e.target.value }))} />
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 5 }}>Pre-fills the rate on payment sheets. Still editable per sheet.</p>
          </div>
          <div style={{ marginBottom: 22 }}><label style={labelStyle}>Notes</label><input style={inputStyle} value={wForm.notes} onChange={(e) => setWForm((p) => ({ ...p, notes: e.target.value }))} /></div>
          {editingWorker && (
            <div style={{ marginBottom: 22 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={editingWorker.isActive !== false} onChange={(e) => setEditingWorker((p) => ({ ...p, isActive: e.target.checked }))} />
                Active
              </label>
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => { setWorkerModal(false); setEditingWorker(null); }} style={{ padding: '10px 22px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 14, color: 'var(--text-secondary)', background: '#fff', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '10px 22px', borderRadius: 'var(--radius-sm)', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}>{saving ? 'Saving...' : editingWorker ? 'Update' : 'Add Worker'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={sheetModal} onClose={() => setSheetModal(false)} title="New Casual Payment Sheet" width={900}>
        <form onSubmit={saveSheet}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div><label style={labelStyle}>Title</label><input style={inputStyle} placeholder="e.g. Site clearing" value={sForm.title} onChange={(e) => setSForm((p) => ({ ...p, title: e.target.value }))} /></div>
            <div><label style={labelStyle}>Period</label><input style={inputStyle} placeholder="e.g. Week 3, July 2026" value={sForm.periodLabel} onChange={(e) => setSForm((p) => ({ ...p, periodLabel: e.target.value }))} /></div>
            <div><label style={labelStyle}>Date *</label><input type="date" style={inputStyle} value={sForm.date} onChange={(e) => setSForm((p) => ({ ...p, date: e.target.value }))} required /></div>
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.4fr 0.8fr 0.7fr 0.9fr 40px', gap: 8, padding: '10px 12px', background: 'var(--bg-app)', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              <span>Registered Worker</span><span>Name on Sheet *</span><span>Rate</span><span>Days *</span><span style={{ textAlign: 'right' }}>Amount</span><span />
            </div>
            {lines.map((l, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.4fr 0.8fr 0.7fr 0.9fr 40px', gap: 8, padding: '8px 12px', alignItems: 'center', borderTop: '1px solid var(--border)' }}>
                <select style={inputStyle} value={l.worker} onChange={(e) => pickWorker(i, e.target.value)}>
                  <option value="">— type name —</option>
                  {workers.filter((w) => w.isActive !== false).map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
                </select>
                <input style={inputStyle} value={l.workerName} onChange={(e) => setLine(i, 'workerName', e.target.value)} placeholder="Worker name" />
                <input type="number" step="0.01" style={inputStyle} value={l.rate} onChange={(e) => setLine(i, 'rate', e.target.value)} />
                <input type="number" step="0.5" style={inputStyle} value={l.days} onChange={(e) => setLine(i, 'days', e.target.value)} />
                <span style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, fontSize: 13, color: 'var(--deep-navy)' }}>{n2(lineAmount(l))}</span>
                <button type="button" onClick={() => removeLine(i)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><FiX size={15} /></button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
            <button type="button" onClick={addLine} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border)', background: '#fff', fontSize: 13, fontWeight: 600, color: 'var(--tech-blue)', cursor: 'pointer' }}><FiPlus size={13} /> Add Worker</button>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--deep-navy)' }}>Total: GHS {n2(draftTotal)}</div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setSheetModal(false)} style={{ padding: '10px 22px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 14, color: 'var(--text-secondary)', background: '#fff', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '10px 22px', borderRadius: 'var(--radius-sm)', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}>{saving ? 'Saving...' : 'Create Sheet'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
