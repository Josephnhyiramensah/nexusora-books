import { useState, useEffect, useRef } from 'react';
import { FiPlus, FiCheck, FiEdit2, FiArrowLeft, FiDownload, FiPrinter, FiEye } from 'react-icons/fi';
import { useToast } from '../../hooks/useToast';
import { useTenant } from '../../context/TenantContext';
import Modal from '../../components/common/Modal';
import ResponsiveTable from '../../components/common/ResponsiveTable';
import { ReportHeader, printReport } from '../reports/ReportShared';
import { exportPayrollExcel } from './payrollExcel';
import api from '../../services/api';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const n2 = (v) => Number(v || 0).toFixed(2);

const EMPTY_EMPLOYEE = {
  firstName: '', lastName: '', email: '', phone: '', position: '', department: '',
  basicSalary: '', ssnitNumber: '', taxId: '',
  pfMode: 'none', pfValue: '', loanBalance: '', loanDeduct: '',
};

export default function PayrollPage() {
  const [tab, setTab] = useState('employees');
  const [employees, setEmployees] = useState([]);
  const [runs, setRuns] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_EMPLOYEE);
  const [saving, setSaving] = useState(false);
  const { showToast, ToastComponent } = useToast();
  const { companyName, settings } = useTenant();
  const sheetRef = useRef(null);

  const fetchEmployees = async () => {
    try { const { data } = await api.get('/payroll/employees'); if (data.success) setEmployees(data.data); } catch {}
  };
  const fetchRuns = async () => {
    try { const { data } = await api.get('/payroll/runs'); if (data.success) setRuns(data.data); } catch {}
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchEmployees(), fetchRuns()]).finally(() => setLoading(false));
  }, []);

  const openEmployee = (emp) => {
    setEditing(emp || null);
    setForm(emp ? {
      firstName: emp.firstName || '', lastName: emp.lastName || '', email: emp.email || '',
      phone: emp.phone || '', position: emp.position || '', department: emp.department || '',
      basicSalary: emp.basicSalary ?? '', ssnitNumber: emp.ssnitNumber || '', taxId: emp.taxId || '',
      pfMode: emp.providentFund?.mode || 'none',
      pfValue: emp.providentFund?.value ?? '',
      loanBalance: emp.loan?.balance ?? '',
      loanDeduct: emp.loan?.deductPerMonth ?? '',
    } : EMPTY_EMPLOYEE);
    setModalOpen(true);
  };

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // Built explicitly rather than from FormData: the provident fund and loan are
  // NESTED objects, and Object.fromEntries(new FormData(...)) produces a flat
  // map, so those fields would silently never reach the server.
  const handleSaveEmployee = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      firstName: form.firstName, lastName: form.lastName, email: form.email,
      phone: form.phone, position: form.position, department: form.department,
      basicSalary: Number(form.basicSalary || 0),
      ssnitNumber: form.ssnitNumber, taxId: form.taxId,
      providentFund: { mode: form.pfMode, value: Number(form.pfValue || 0) },
      loan: { balance: Number(form.loanBalance || 0), deductPerMonth: Number(form.loanDeduct || 0) },
    };
    try {
      if (editing) { await api.put(`/payroll/employees/${editing._id}`, payload); showToast('Employee updated'); }
      else { await api.post('/payroll/employees', payload); showToast('Employee created'); }
      setModalOpen(false); setEditing(null); fetchEmployees();
    } catch (err) { showToast(err.response?.data?.message || 'Failed to save employee', 'error'); }
    finally { setSaving(false); }
  };

  const handleRunPayroll = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    try {
      const { data } = await api.post('/payroll/run', fd);
      if (data.success) { showToast(data.message); setRunModalOpen(false); fetchRuns(); setTab('runs'); }
    } catch (err) { showToast(err.response?.data?.message || 'Failed to run payroll', 'error'); }
  };

  const handleApprove = async (id) => {
    if (!window.confirm('Approve this payroll? This posts journal entries and updates account balances.')) return;
    try {
      const { data } = await api.post(`/payroll/runs/${id}/approve`);
      if (data.success) { showToast(data.message); fetchRuns(); fetchEmployees(); if (detail?._id === id) openRun(id); }
    } catch (err) { showToast(err.response?.data?.message || 'Failed to approve', 'error'); }
  };

  const openRun = async (id) => {
    try {
      const { data } = await api.get(`/payroll/runs/${id}`);
      if (data.success) setDetail(data.data);
    } catch { showToast('Could not load the payroll sheet', 'error'); }
  };

  const periodLabel = (r) => r ? `${MONTHS[(r.period?.month || 1) - 1]} ${r.period?.year}` : '';

  const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 };
  const th = (align = 'left') => ({ padding: '11px 12px', textAlign: align, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' });
  const td = (align = 'left') => ({ padding: '10px 12px', textAlign: align, whiteSpace: 'nowrap', fontFamily: align === 'right' ? 'monospace' : 'inherit' });

  // ─── Payroll sheet (single run) ─────────────────────────────────────────────
  if (detail) {
    const e = detail.entries || [];
    const sumDbt = (detail.totalEmployeeSsnit || 0) + (detail.totalProvidentFund || 0);
    return (
      <div>
        {ToastComponent}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <button onClick={() => setDetail(null)} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <FiArrowLeft size={16} /> Back to payroll runs
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => exportPayrollExcel({ companyName, run: detail, periodLabel: periodLabel(detail) })}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: '#fff', fontSize: 13, fontWeight: 600, color: 'var(--finance-green, #1A6B3C)', cursor: 'pointer' }}>
              <FiDownload size={14} /> Export Excel
            </button>
            <button onClick={() => printReport(sheetRef.current, `Payroll ${detail.payrollNumber}`)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: '#fff', fontSize: 13, fontWeight: 600, color: 'var(--deep-navy)', cursor: 'pointer' }}>
              <FiPrinter size={14} /> Print / PDF
            </button>
          </div>
        </div>

        <div ref={sheetRef} style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: '28px 24px' }}>
          <ReportHeader
            title="Staff Payroll Sheet"
            subtitle={`${periodLabel(detail)}  ·  ${detail.payrollNumber}`}
            companyName={companyName}
            settings={settings}
          />

          <ResponsiveTable minWidth={1080}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: 'var(--bg-app)', borderBottom: '2px solid var(--deep-navy)' }}>
                  <th style={th()}>No</th>
                  <th style={th()}>Name of Employee</th>
                  <th style={th('right')}>Basic Salary</th>
                  <th style={th('right')}>SSNIT 5.5%</th>
                  <th style={th('right')}>Prov. Fund</th>
                  <th style={th('right')}>Deduction b/Tax</th>
                  <th style={th('right')}>Taxable Income</th>
                  <th style={th('right')}>PAYE</th>
                  <th style={th('right')}>Loan</th>
                  <th style={th('right')}>Total Deduction</th>
                  <th style={th('right')}>Net Income</th>
                </tr>
              </thead>
              <tbody>
                {e.length === 0 ? (
                  <tr><td colSpan={11} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No entries in this run.</td></tr>
                ) : e.map((x, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                    <td style={td()}>{i + 1}</td>
                    <td style={{ ...td(), fontWeight: 500 }}>
                      {x.employeeName || [x.employee?.firstName, x.employee?.lastName].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td style={td('right')}>{n2(x.grossPay)}</td>
                    <td style={td('right')}>{n2(x.employeeSsnit)}</td>
                    <td style={td('right')}>{n2(x.providentFund)}</td>
                    <td style={td('right')}>{n2(x.deductionBeforeTax)}</td>
                    <td style={td('right')}>{n2(x.taxableIncome)}</td>
                    <td style={td('right')}>{n2(x.paye)}</td>
                    <td style={td('right')}>{n2(x.loanDeduction)}</td>
                    <td style={td('right')}>{n2(x.totalDeduction)}</td>
                    <td style={{ ...td('right'), fontWeight: 700, color: 'var(--deep-navy)' }}>{n2(x.netPay)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--deep-navy)', fontWeight: 700, color: 'var(--deep-navy)' }}>
                  <td style={td()} />
                  <td style={td()}>TOTALS</td>
                  <td style={td('right')}>{n2(detail.totalGross)}</td>
                  <td style={td('right')}>{n2(detail.totalEmployeeSsnit)}</td>
                  <td style={td('right')}>{n2(detail.totalProvidentFund)}</td>
                  <td style={td('right')}>{n2(sumDbt)}</td>
                  <td style={td('right')}>{n2((detail.totalGross || 0) - sumDbt)}</td>
                  <td style={td('right')}>{n2(detail.totalPaye)}</td>
                  <td style={td('right')}>{n2(detail.totalLoanDeduction)}</td>
                  <td style={td('right')}>{n2(detail.totalDeduction)}</td>
                  <td style={td('right')}>{n2(detail.totalNet)}</td>
                </tr>
              </tfoot>
            </table>
          </ResponsiveTable>

          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 16, fontStyle: 'italic' }}>
            All figures in GHS. Computed using {detail.payeBandsLabel || 'the PAYE bands stored with this run'}.
            SSNIT: 5.5% employee, 13% employer (employer contribution GHS {n2(detail.totalEmployerSsnit)}, not deducted from staff).
          </p>
        </div>
      </div>
    );
  }

  // ─── List views ─────────────────────────────────────────────────────────────
  return (
    <div>
      {ToastComponent}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>Payroll</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => openEmployee(null)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'var(--tech-blue)', color: '#fff', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}><FiPlus size={14} /> Employee</button>
          <button onClick={() => setRunModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}><FiPlus size={14} /> Run Payroll</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {['employees', 'runs'].map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '10px 20px', fontSize: 13, fontWeight: tab === t ? 600 : 400, color: tab === t ? 'var(--deep-navy)' : 'var(--text-muted)', borderBottom: tab === t ? '2px solid var(--nexusora-gold)' : '2px solid transparent', background: 'transparent', border: 'none', cursor: 'pointer', marginBottom: -1 }}>
            {t === 'runs' ? 'Payroll Runs' : 'Employees'}
          </button>
        ))}
      </div>

      {tab === 'employees' && (
        <div style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <ResponsiveTable minWidth={900}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border)' }}>
                <th style={th()}>ID</th>
                <th style={th()}>Name</th>
                <th style={th()}>Position</th>
                <th style={th('right')}>Basic Salary</th>
                <th style={th('right')}>Prov. Fund</th>
                <th style={th('right')}>Loan Balance</th>
                <th style={th('right')}>Monthly Recovery</th>
                <th style={th('center')}>Actions</th>
              </tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</td></tr> :
                employees.length === 0 ? <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No employees. Add one to get started.</td></tr> :
                employees.map((emp, i) => {
                  const pf = emp.providentFund || {};
                  const pfLabel = pf.mode === 'fixed' ? n2(pf.value)
                    : pf.mode === 'percent' ? `${pf.value}% (${n2((emp.basicSalary || 0) * (pf.value || 0) / 100)})`
                    : '—';
                  return (
                    <tr key={emp._id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                      <td style={{ ...td(), fontFamily: 'monospace', fontWeight: 600 }}>{emp.employeeId}</td>
                      <td style={{ ...td(), fontWeight: 500 }}>{emp.firstName} {emp.lastName}</td>
                      <td style={td()}>{emp.position || '—'}</td>
                      <td style={td('right')}>{n2(emp.basicSalary)}</td>
                      <td style={td('right')}>{pfLabel}</td>
                      <td style={{ ...td('right'), color: (emp.loan?.balance || 0) > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{(emp.loan?.balance || 0) > 0 ? n2(emp.loan.balance) : '—'}</td>
                      <td style={td('right')}>{(emp.loan?.deductPerMonth || 0) > 0 ? n2(emp.loan.deductPerMonth) : '—'}</td>
                      <td style={{ ...td('center') }}><button onClick={() => openEmployee(emp)} style={{ padding: '5px 10px', color: 'var(--tech-blue)', background: 'none', border: 'none', cursor: 'pointer' }}><FiEdit2 size={14} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ResponsiveTable>
        </div>
      )}

      {tab === 'runs' && (
        <div style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <ResponsiveTable minWidth={900}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border)' }}>
                <th style={th()}>Payroll #</th>
                <th style={th()}>Period</th>
                <th style={th('right')}>Gross</th>
                <th style={th('right')}>PAYE</th>
                <th style={th('right')}>SSNIT</th>
                <th style={th('right')}>Net</th>
                <th style={th('center')}>Status</th>
                <th style={th('center')}>Actions</th>
              </tr></thead>
              <tbody>
                {runs.length === 0 ? <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No payroll runs yet.</td></tr> :
                runs.map((r, i) => (
                  <tr key={r._id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                    <td style={{ ...td(), fontFamily: 'monospace', fontWeight: 600 }}>{r.payrollNumber}</td>
                    <td style={td()}>{periodLabel(r)}</td>
                    <td style={td('right')}>{n2(r.totalGross)}</td>
                    <td style={td('right')}>{n2(r.totalPaye)}</td>
                    <td style={td('right')}>{n2(r.totalEmployeeSsnit)}</td>
                    <td style={{ ...td('right'), fontWeight: 600 }}>{n2(r.totalNet)}</td>
                    <td style={td('center')}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, textTransform: 'capitalize', background: r.status === 'approved' ? '#D1FAE5' : '#FEF3C7', color: r.status === 'approved' ? '#065F46' : '#92400E' }}>{r.status}</span>
                    </td>
                    <td style={td('center')}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button onClick={() => openRun(r._id)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 'var(--radius-sm)', color: 'var(--tech-blue)', fontSize: 11, fontWeight: 600, border: '1px solid var(--tech-blue)', background: '#fff', cursor: 'pointer' }}><FiEye size={12} /> View</button>
                        {r.status === 'draft' && <button onClick={() => handleApprove(r._id)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 'var(--radius-sm)', color: 'var(--success)', fontSize: 11, fontWeight: 600, border: '1px solid var(--success)', background: '#fff', cursor: 'pointer' }}><FiCheck size={12} /> Approve</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTable>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} title={editing ? 'Edit Employee' : 'New Employee'} width={680}>
        <form onSubmit={handleSaveEmployee}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div><label style={labelStyle}>First Name *</label><input style={inputStyle} value={form.firstName} onChange={(ev) => set('firstName', ev.target.value)} required /></div>
            <div><label style={labelStyle}>Last Name *</label><input style={inputStyle} value={form.lastName} onChange={(ev) => set('lastName', ev.target.value)} required /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div><label style={labelStyle}>Email</label><input type="email" style={inputStyle} value={form.email} onChange={(ev) => set('email', ev.target.value)} /></div>
            <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={form.phone} onChange={(ev) => set('phone', ev.target.value)} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div><label style={labelStyle}>Position</label><input style={inputStyle} value={form.position} onChange={(ev) => set('position', ev.target.value)} /></div>
            <div><label style={labelStyle}>Department</label><input style={inputStyle} value={form.department} onChange={(ev) => set('department', ev.target.value)} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div><label style={labelStyle}>Basic Salary (GHS) *</label><input type="number" step="0.01" style={inputStyle} value={form.basicSalary} onChange={(ev) => set('basicSalary', ev.target.value)} required /></div>
            <div><label style={labelStyle}>SSNIT Number</label><input style={inputStyle} value={form.ssnitNumber} onChange={(ev) => set('ssnitNumber', ev.target.value)} /></div>
            <div><label style={labelStyle}>Tax ID (TIN)</label><input style={inputStyle} value={form.taxId} onChange={(ev) => set('taxId', ev.target.value)} /></div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18, marginBottom: 18 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--deep-navy)', marginBottom: 4 }}>Provident Fund</h4>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Deducted before tax, alongside SSNIT.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={labelStyle}>Type</label>
                <select style={inputStyle} value={form.pfMode} onChange={(ev) => set('pfMode', ev.target.value)}>
                  <option value="none">None</option>
                  <option value="fixed">Fixed amount (GHS)</option>
                  <option value="percent">Percentage of basic</option>
                </select>
              </div>
              {form.pfMode !== 'none' && (
                <div>
                  <label style={labelStyle}>{form.pfMode === 'percent' ? 'Percentage (%)' : 'Amount (GHS)'}</label>
                  <input type="number" step="0.01" style={inputStyle} value={form.pfValue} onChange={(ev) => set('pfValue', ev.target.value)} />
                </div>
              )}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18, marginBottom: 22 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--deep-navy)', marginBottom: 4 }}>Staff Loan</h4>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Deducted after tax. Recovery stops automatically when the balance reaches zero.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div><label style={labelStyle}>Outstanding Balance (GHS)</label><input type="number" step="0.01" style={inputStyle} value={form.loanBalance} onChange={(ev) => set('loanBalance', ev.target.value)} /></div>
              <div><label style={labelStyle}>Monthly Deduction (GHS)</label><input type="number" step="0.01" style={inputStyle} value={form.loanDeduct} onChange={(ev) => set('loanDeduct', ev.target.value)} /></div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => { setModalOpen(false); setEditing(null); }} style={{ padding: '10px 22px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 14, color: 'var(--text-secondary)', background: '#fff', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '10px 22px', borderRadius: 'var(--radius-sm)', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={runModalOpen} onClose={() => setRunModalOpen(false)} title="Run Payroll" width={420}>
        <form onSubmit={handleRunPayroll}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div><label style={labelStyle}>Month *</label><select name="month" style={inputStyle} defaultValue={new Date().getMonth() + 1}>{MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>
            <div><label style={labelStyle}>Year *</label><input name="year" type="number" style={inputStyle} defaultValue={new Date().getFullYear()} required /></div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
            Calculates SSNIT, provident fund, PAYE and loan recovery for all {employees.length} active employees.
            The run is saved as a draft — nothing is posted to the accounts until you approve it.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setRunModalOpen(false)} style={{ padding: '10px 22px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 14, color: 'var(--text-secondary)', background: '#fff', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" style={{ padding: '10px 22px', borderRadius: 'var(--radius-sm)', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}>Calculate Payroll</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
