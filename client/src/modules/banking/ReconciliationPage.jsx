import { useState, useEffect, useRef } from 'react';
import { FiUpload, FiArrowLeft, FiArrowDownLeft, FiArrowUpRight, FiTrash2, FiLock, FiFileText, FiRefreshCw, FiCheck } from 'react-icons/fi';
import { useToast } from '../../hooks/useToast';
import { useTenant } from '../../context/TenantContext';
import ResponsiveTable from '../../components/common/ResponsiveTable';
import api from '../../services/api';

const PAID = ['starter', 'professional', 'enterprise', 'founding'];
const n2 = (v) => Number(v || 0).toFixed(2);
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

export default function ReconciliationPage() {
  const { plan } = useTenant();
  const { showToast, ToastComponent } = useToast();
  const [sessions, setSessions] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [importSource, setImportSource] = useState('momo');
  const fileRef = useRef(null);
  const [accounts, setAccounts] = useState([]);
  const [postingLine, setPostingLine] = useState(null);
  const [pickAccount, setPickAccount] = useState('');
  const [posting, setPosting] = useState(false);
  const [autoReview, setAutoReview] = useState(null);
  const [autoRunning, setAutoRunning] = useState(false);
  const [batchPosting, setBatchPosting] = useState(false);
  const [reconcileResult, setReconcileResult] = useState(null);
  const [reconciling, setReconciling] = useState(false);

  const isPaid = PAID.includes(plan);

  const fetchSessions = async () => {
    try { const { data } = await api.get('/reconciliation'); if (data.success) setSessions(data.data); }
    catch {} finally { setLoading(false); }
  };
  useEffect(() => { if (isPaid) fetchSessions(); else setLoading(false); }, [isPaid]);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { showToast('File must be under 8MB', 'error'); return; }
    setUploading(true);
    showToast('Reading and importing statement...');
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { data } = await api.post('/reconciliation/import', {
        fileBase64: base64,
        fileName: file.name,
        source: importSource,
      });
      if (data.success) {
        showToast(data.message);
        fetchSessions();
        if (data.data?._id) openSession(data.data._id);
      } else {
        showToast(data.message || 'Import failed', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not import statement', 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const openSession = async (id) => {
    try {
      const { data } = await api.get(`/reconciliation/${id}`);
      if (data.success) setDetail(data.data);
      const ac = await api.get('/accounts?isActive=true');
      if (ac.data.success) setAccounts(ac.data.data);
    } catch { showToast('Could not load session', 'error'); }
  };

  const submitPost = async () => {
    if (!pickAccount) { showToast('Choose an account', 'error'); return; }
    setPosting(true);
    try {
      const { data } = await api.post(`/reconciliation/${detail._id}/post-line`, { lineId: postingLine._id, categoryAccountId: pickAccount });
      if (data.success) { showToast(data.message); setPostingLine(null); setPickAccount(''); openSession(detail._id); }
      else showToast(data.message || 'Post failed', 'error');
    } catch (err) { showToast(err.response?.data?.message || 'Post failed', 'error'); }
    finally { setPosting(false); }
  };

  const runAutoMatch = async () => {
    setAutoRunning(true);
    try {
      const { data } = await api.post(`/reconciliation/${detail._id}/auto-match`);
      if (data.success) {
        // seed each suggestion with an editable chosen account
        const rows = (data.data.suggestions || []).map((sg) => {
          const line = detail.lines.find((l) => String(l._id) === String(sg.lineId));
          return {
            ...sg,
            line,
            chosen: sg.kind === 'suggest' && sg.suggestedAccount ? sg.suggestedAccount.accountId : '',
            include: true,
          };
        });
        setAutoReview({ rows, summary: data.data.summary });
        showToast('Found ' + rows.length + ' lines to review');
      } else showToast(data.message || 'Auto-match failed', 'error');
    } catch (err) { showToast(err.response?.data?.message || 'Auto-match failed', 'error'); }
    finally { setAutoRunning(false); }
  };

  const setReviewRow = (lineId, patch) => setAutoReview((prev) => ({
    ...prev,
    rows: prev.rows.map((r) => (String(r.lineId) === String(lineId) ? { ...r, ...patch } : r)),
  }));

  const submitBatch = async () => {
    const rows = autoReview.rows.filter((r) => r.include);
    const matches = rows.filter((r) => r.kind === 'match');
    const posts = rows.filter((r) => r.kind !== 'match' && r.chosen);
    const missing = rows.filter((r) => r.kind !== 'match' && !r.chosen);
    if (missing.length) { showToast(missing.length + ' selected line(s) have no account chosen', 'error'); return; }
    if (matches.length + posts.length === 0) { showToast('Nothing selected to post', 'error'); return; }
    setBatchPosting(true);
    try {
      // confirm matches first
      for (const m of matches) {
        await api.post(`/reconciliation/${detail._id}/confirm-match`, { lineId: m.lineId, entryId: m.entryId });
      }
      // then post the categorised ones as a batch
      if (posts.length) {
        const { data } = await api.post(`/reconciliation/${detail._id}/post-batch`, {
          items: posts.map((p) => ({ lineId: p.lineId, categoryAccountId: p.chosen })),
        });
        if (!data.success) throw new Error(data.message);
      }
      showToast('Reconciled ' + (matches.length + posts.length) + ' transactions');
      setAutoReview(null);
      openSession(detail._id);
    } catch (err) { showToast(err.response?.data?.message || err.message || 'Batch failed', 'error'); }
    finally { setBatchPosting(false); }
  };

  const checkReconcile = async (finalise = false) => {
    setReconciling(true);
    try {
      const { data } = await api.post(`/reconciliation/${detail._id}/reconcile`, { finalise });
      if (data.success) {
        setReconcileResult(data.data);
        if (data.data.finalised) { showToast('Session reconciled and closed'); openSession(detail._id); }
      } else showToast(data.message || 'Reconcile failed', 'error');
    } catch (err) { showToast(err.response?.data?.message || 'Reconcile failed', 'error'); }
    finally { setReconciling(false); }
  };

  const toggleIgnore = async (line) => {
    try {
      const { data } = await api.post(`/reconciliation/${detail._id}/ignore-line`, { lineId: line._id });
      if (data.success) openSession(detail._id);
    } catch (err) { showToast(err.response?.data?.message || 'Failed', 'error'); }
  };

  const deleteSession = async (id) => {
    if (!window.confirm('Delete this imported statement? This cannot be undone.')) return;
    try {
      const { data } = await api.delete(`/reconciliation/${id}`);
      if (data.success) { showToast('Deleted'); setDetail(null); fetchSessions(); }
    } catch (err) { showToast(err.response?.data?.message || 'Delete failed', 'error'); }
  };

  // ─── Paywall for trial ──────────────────────────────────────────────────────
  if (!isPaid) {
    return (
      <div style={{ maxWidth: 520, margin: '40px auto', textAlign: 'center', background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '48px 36px' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FEF3C7', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <FiLock size={26} color="#C9A227" />
        </div>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>Bank & MoMo Reconciliation</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
          Import your Mobile Money and bank statements, auto-match them against your books, and post the gaps to your ledger — all in one place. Available on the Starter plan and above.
        </p>
        <a href="/settings" style={{ display: 'inline-block', padding: '11px 24px', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Upgrade your plan</a>
      </div>
    );
  }

  // ─── Session detail ─────────────────────────────────────────────────────────
  if (detail) {
    const lines = detail.lines || [];
    return (
      <div>
        {ToastComponent}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <button onClick={() => setDetail(null)} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <FiArrowLeft size={16} /> Back to statements
          </button>
          <button onClick={runAutoMatch} disabled={autoRunning} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--tech-blue)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: autoRunning ? 'wait' : 'pointer', marginRight: 8 }}>
            <FiRefreshCw size={14} /> {autoRunning ? 'Matching...' : 'Auto-match'}
          </button>
          <button onClick={() => checkReconcile(false)} disabled={reconciling} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--deep-navy)', background: '#fff', color: 'var(--deep-navy)', fontSize: 12.5, fontWeight: 600, cursor: reconciling ? 'wait' : 'pointer', marginRight: 8 }}>
            <FiCheck size={14} /> {reconciling ? 'Checking...' : 'Reconcile'}
          </button>
          {detail.status === 'draft' && (
            <button onClick={() => deleteSession(detail._id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 15px', borderRadius: 'var(--radius-sm)', border: '1px solid #FECACA', background: '#fff', fontSize: 12.5, fontWeight: 600, color: 'var(--danger)', cursor: 'pointer' }}>
              <FiTrash2 size={14} /> Delete
            </button>
          )}
        </div>

        <div style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: '20px 22px', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 700, color: 'var(--deep-navy)' }}>{detail.sessionNumber} · {detail.source === 'momo' ? 'Mobile Money' : 'Bank'} Statement</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {detail.accountHolder} {detail.accountMsisdn ? `(${detail.accountMsisdn})` : ''} · {fmtDate(detail.periodStart)} – {fmtDate(detail.periodEnd)}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginTop: 16 }}>
            {[
              ['Transactions', lines.length, 'var(--deep-navy)'],
              ['Money In', 'GHS ' + n2(detail.totalIn), '#16A34A'],
              ['Money Out', 'GHS ' + n2(detail.totalOut), '#DC2626'],
              ['Fees + E-Levy', 'GHS ' + n2(detail.totalFees), '#D97706'],
              ['Closing Balance', 'GHS ' + n2(detail.closingBalance), 'var(--deep-navy)'],
            ].map(([label, val, color]) => (
              <div key={label} style={{ background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{label}</p>
                <p style={{ fontSize: 16, fontWeight: 700, color }}>{val}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <ResponsiveTable minWidth={860}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: 'var(--bg-app)', borderBottom: '2px solid var(--deep-navy)' }}>
                  <th style={{ padding: '11px 12px', textAlign: 'left' }}>Date</th>
                  <th style={{ padding: '11px 12px', textAlign: 'left' }}>Type</th>
                  <th style={{ padding: '11px 12px', textAlign: 'left' }}>Counterparty</th>
                  <th style={{ padding: '11px 12px', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '11px 12px', textAlign: 'right' }}>Fee</th>
                  <th style={{ padding: '11px 12px', textAlign: 'right' }}>Balance</th>
                  <th style={{ padding: '11px 12px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '11px 12px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                    <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>{fmtDateTime(l.date)}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        {l.direction === 'in'
                          ? <FiArrowDownLeft size={13} color="#16A34A" />
                          : <FiArrowUpRight size={13} color="#DC2626" />}
                        {l.type}
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px' }}>{l.counterparty || '—'}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: l.direction === 'in' ? '#16A34A' : '#DC2626' }}>
                      {l.direction === 'in' ? '+' : '−'}{n2(l.amount)}
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{l.fee ? n2(l.fee) : '—'}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{n2(l.balanceAfter)}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: l.matchStatus === 'matched' ? '#D1FAE5' : l.matchStatus === 'ignored' ? '#F1F5F9' : '#FEF3C7', color: l.matchStatus === 'matched' ? '#065F46' : l.matchStatus === 'ignored' ? '#94A3B8' : '#92400E' }}>
                        {l.matchStatus === 'matched' ? 'Posted' : l.matchStatus === 'ignored' ? 'Ignored' : 'Unmatched'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {l.matchStatus === 'matched' ? <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span> : (
                        <span style={{ display: 'inline-flex', gap: 6 }}>
                          <button onClick={() => { setPostingLine(l); setPickAccount(''); }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--tech-blue)', background: '#fff', color: 'var(--tech-blue)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Post</button>
                          <button onClick={() => toggleIgnore(l)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>{l.matchStatus === 'ignored' ? 'Unignore' : 'Ignore'}</button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTable>
        </div>

        {reconcileResult && (() => {
          const rr = reconcileResult;
          const tie = rr.statementConsistent;
          return (
          <div onClick={() => setReconcileResult(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: 16 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 'var(--radius-md)', width: 520, maxWidth: '96vw', padding: '26px 28px' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 19, fontWeight: 700, color: 'var(--deep-navy)', marginBottom: 4 }}>Reconciliation Check</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>{rr.sessionNumber}</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
                {[
                  ['Opening Balance', 'GHS ' + n2(rr.openingBalance)],
                  ['Closing Balance', 'GHS ' + n2(rr.closingBalance)],
                  ['Statement Movement', 'GHS ' + n2(rr.statementMovement)],
                  ['Parsed Movement', 'GHS ' + n2(rr.parsedMovement)],
                ].map(([l, v]) => (
                  <div key={l} style={{ background: 'var(--bg-app)', borderRadius: 8, padding: '10px 12px' }}>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>{l}</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--deep-navy)' }}>{v}</p>
                  </div>
                ))}
              </div>

              <div style={{ padding: '14px 16px', borderRadius: 8, background: tie ? '#D1FAE5' : '#FEE2E2', marginBottom: 16 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: tie ? '#065F46' : '#991B1B', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {tie ? <><FiCheck size={17} /> Statement balances tie — parse verified</> : <>Statement movement and parsed transactions differ by GHS {n2(Math.abs(rr.statementMovement - rr.parsedMovement))}</>}
                </p>
              </div>

              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18, lineHeight: 1.6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Posted / matched</span><strong>{rr.counts.matched}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Ignored</span><strong>{rr.counts.ignored}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: rr.counts.unmatched > 0 ? '#D97706' : 'inherit' }}><span>Still unmatched</span><strong>{rr.counts.unmatched}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}><span>MoMo Wallet ledger balance</span><strong>GHS {n2(rr.ledgerWalletBalance)}</strong></div>
              </div>

              {!rr.allHandled && (
                <p style={{ fontSize: 12, color: '#92400E', background: '#FEF3C7', padding: '10px 12px', borderRadius: 8, marginBottom: 16 }}>
                  {rr.counts.unmatched} transaction(s) still need posting or ignoring before this session can be finalised.
                </p>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setReconcileResult(null)} style={{ padding: '10px 20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: '#fff', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Close</button>
                {rr.allHandled && rr.status !== 'reconciled' && (
                  <button onClick={() => checkReconcile(true)} disabled={reconciling} style={{ padding: '10px 22px', borderRadius: 'var(--radius-sm)', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}>{reconciling ? 'Finalising...' : 'Finalise & Close'}</button>
                )}
              </div>
            </div>
          </div>
          );
        })()}

        {autoReview && (
          <div onClick={() => !batchPosting && setAutoReview(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 'var(--radius-md)', width: 720, maxWidth: '96vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 700, color: 'var(--deep-navy)' }}>Auto-match review</h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {autoReview.summary.matches} already recorded · {autoReview.summary.suggested} suggested · {autoReview.summary.manual} need a choice. Review and approve — nothing posts until you do.
                </p>
              </div>
              <div style={{ overflowY: 'auto', padding: '8px 0', flex: 1 }}>
                {autoReview.rows.length === 0 ? (
                  <p style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>No unmatched lines to review.</p>
                ) : autoReview.rows.map((r) => (
                  <div key={r.lineId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 24px', borderBottom: '1px solid #F1F5F9', opacity: r.include ? 1 : 0.5 }}>
                    <input type="checkbox" checked={r.include} onChange={(e) => setReviewRow(r.lineId, { include: e.target.checked })} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {r.line?.direction === 'in' ? '+' : '−'}GHS {n2(r.line?.amount)} · {r.line?.counterparty || r.line?.type}
                      </div>
                      <div style={{ fontSize: 11, color: r.kind === 'match' ? '#16A34A' : r.kind === 'suggest' ? '#D97706' : 'var(--text-muted)' }}>{r.note}</div>
                    </div>
                    {r.kind === 'match' ? (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', display: 'flex', alignItems: 'center', gap: 4 }}><FiCheck size={13} /> Match</span>
                    ) : (
                      <select value={r.chosen} onChange={(e) => setReviewRow(r.lineId, { chosen: e.target.value })} style={{ width: 220, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12.5 }}>
                        <option value="">— choose account —</option>
                        {accounts.filter((a) => a.code !== '1015' && a.code !== '6800').map((a) => <option key={a._id} value={a._id}>{a.code} — {a.name}</option>)}
                      </select>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setAutoReview(null)} disabled={batchPosting} style={{ padding: '10px 20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: '#fff', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
                <button onClick={submitBatch} disabled={batchPosting} style={{ padding: '10px 22px', borderRadius: 'var(--radius-sm)', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                  {batchPosting ? 'Posting...' : 'Post approved (' + autoReview.rows.filter((r) => r.include).length + ')'}
                </button>
              </div>
            </div>
          </div>
        )}

        {postingLine && (
          <div onClick={() => setPostingLine(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 'var(--radius-md)', padding: '24px 26px', width: 440, maxWidth: '92vw' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 17, fontWeight: 700, color: 'var(--deep-navy)', marginBottom: 6 }}>Post to Ledger</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>{postingLine.direction === 'in' ? 'Received' : 'Paid'} <strong>GHS {n2(postingLine.amount)}</strong>{postingLine.fee ? ' + GHS ' + n2(postingLine.fee) + ' fee' : ''} {postingLine.direction === 'in' ? 'from' : 'to'} {postingLine.counterparty || 'unknown'}</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>{postingLine.direction === 'in' ? 'Which income/source account?' : 'Which expense/category account?'} MoMo wallet and fees are handled automatically.</p>
              <select value={pickAccount} onChange={(e) => setPickAccount(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, marginBottom: 20 }}>
                <option value="">— select account —</option>
                {accounts.filter((a) => a.code !== '1015' && a.code !== '6800').map((a) => <option key={a._id} value={a._id}>{a.code} — {a.name}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setPostingLine(null)} style={{ padding: '9px 18px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: '#fff', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
                <button onClick={submitPost} disabled={posting} style={{ padding: '9px 18px', borderRadius: 'var(--radius-sm)', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}>{posting ? 'Posting...' : 'Post Entry'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── List + upload ──────────────────────────────────────────────────────────
  return (
    <div>
      {ToastComponent}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>Reconciliation</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Import MoMo or bank statements and reconcile them against your books.</p>
        </div>
        <div>
          <input ref={fileRef} type="file" id="stmt-upload" accept=".xls,.xlsx,.csv,.pdf" style={{ display: 'none' }} onChange={handleFile} />
          <label htmlFor="stmt-upload" onClick={() => setImportSource('momo')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600, cursor: uploading ? 'wait' : 'pointer', marginRight: 8 }}>
            <FiUpload size={15} /> {uploading && importSource === 'momo' ? 'Importing...' : 'Import MoMo'}
          </label>
          <label htmlFor="stmt-upload" onClick={() => setImportSource('bank')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'var(--deep-navy)', color: '#fff', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600, cursor: uploading ? 'wait' : 'pointer' }}>
            <FiUpload size={15} /> {uploading && importSource === 'bank' ? 'Importing...' : 'Import Bank'}
          </label>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
        {loading ? (
          <p style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</p>
        ) : sessions.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <FiFileText size={32} color="var(--text-muted)" style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>No statements imported yet</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Import a MoMo or bank statement (.xls, .xlsx or .csv) to get started.</p>
          </div>
        ) : (
          <ResponsiveTable minWidth={820}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '11px 12px', textAlign: 'left' }}>Statement</th>
                  <th style={{ padding: '11px 12px', textAlign: 'left' }}>Period</th>
                  <th style={{ padding: '11px 12px', textAlign: 'right' }}>In</th>
                  <th style={{ padding: '11px 12px', textAlign: 'right' }}>Out</th>
                  <th style={{ padding: '11px 12px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => (
                  <tr key={s._id} onClick={() => openSession(s._id)} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? '#fff' : '#FAFBFC', cursor: 'pointer' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, fontFamily: 'monospace' }}>{s.sessionNumber}
                      <span style={{ fontFamily: 'inherit', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>{s.source === 'momo' ? 'MoMo' : 'Bank'}</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>{fmtDate(s.periodStart)} – {fmtDate(s.periodEnd)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#16A34A' }}>{n2(s.totalIn)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#DC2626' }}>{n2(s.totalOut)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: s.status === 'reconciled' ? '#D1FAE5' : '#FEF3C7', color: s.status === 'reconciled' ? '#065F46' : '#92400E', textTransform: 'capitalize' }}>{s.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTable>
        )}
      </div>
    </div>
  );
}
