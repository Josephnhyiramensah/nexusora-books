import { useState, useEffect } from 'react';
import { FiPlus, FiUsers, FiCheck, FiEdit2 } from 'react-icons/fi';
import { formatCurrency } from '../../utils/formatters';
import { useToast } from '../../hooks/useToast';
import Modal from '../../components/common/Modal';
import api from '../../services/api';
 import ResponsiveTable from '../../components/common/ResponsiveTable';

export default function PayrollPage() {
  const [tab, setTab] = useState('employees');
  const [employees, setEmployees] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const { showToast, ToastComponent } = useToast();

  const fetchEmployees = async () => { try { const { data } = await api.get('/payroll/employees'); if (data.success) setEmployees(data.data); } catch {} };
  const fetchRuns = async () => { try { const { data } = await api.get('/payroll/runs'); if (data.success) setRuns(data.data); } catch {} };

  useEffect(() => { setLoading(true); Promise.all([fetchEmployees(), fetchRuns()]).finally(() => setLoading(false)); }, []);

  const handleSaveEmployee = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    try {
      if (editing) { await api.put(`/payroll/employees/${editing._id}`, fd); showToast('Employee updated'); }
      else { await api.post('/payroll/employees', fd); showToast('Employee created'); }
      setModalOpen(false); setEditing(null); fetchEmployees();
    } catch (err) { showToast(err.response?.data?.message || 'Failed', 'error'); }
  };

  const handleRunPayroll = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    try { const { data } = await api.post('/payroll/run', fd); if (data.success) { showToast(data.message); setRunModalOpen(false); fetchRuns(); } }
    catch (err) { showToast(err.response?.data?.message || 'Failed', 'error'); }
  };

  const handleApprove = async (id) => {
    if (!window.confirm('Approve this payroll? This posts journal entries and updates account balances.')) return;
    try { const { data } = await api.post(`/payroll/runs/${id}/approve`); if (data.success) { showToast(data.message); fetchRuns(); } }
    catch (err) { showToast(err.response?.data?.message || 'Failed', 'error'); }
  };

  const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none' };
  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 };

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div>
      {ToastComponent}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>Payroll</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setEditing(null); setModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'var(--tech-blue)', color: '#fff', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600 }}><FiPlus size={14} /> Employee</button>
          <button onClick={() => setRunModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600 }}><FiPlus size={14} /> Run Payroll</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {['employees', 'runs'].map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '10px 20px', fontSize: 13, fontWeight: tab === t ? 600 : 400, color: tab === t ? 'var(--deep-navy)' : 'var(--text-muted)', borderBottom: tab === t ? '2px solid var(--nexusora-gold)' : '2px solid transparent', background: 'transparent', textTransform: 'capitalize', marginBottom: -1 }}>{t === 'runs' ? 'Payroll Runs' : 'Employees'}</button>
        ))}
      </div>

      {tab === 'employees' && (
       

<div style={{ background: '#fff', borderRadius: 'var(--radius-md)' }}>
  <ResponsiveTable minWidth={700}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>ID</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Name</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Position</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Department</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Basic Salary</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>Actions</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</td></tr> :
              employees.length === 0 ? <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No employees. Add one to get started.</td></tr> :
              employees.map((emp, i) => (
                <tr key={emp._id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                  <td style={{ padding: '11px 16px', fontFamily: 'monospace', fontWeight: 600 }}>{emp.employeeId}</td>
                  <td style={{ padding: '11px 16px', fontWeight: 500 }}>{emp.firstName} {emp.lastName}</td>
                  <td style={{ padding: '11px 16px' }}>{emp.position || '—'}</td>
                  <td style={{ padding: '11px 16px' }}>{emp.department || '—'}</td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(emp.basicSalary)}</td>
                  <td style={{ padding: '11px 16px', textAlign: 'center' }}><button onClick={() => { setEditing(emp); setModalOpen(true); }} style={{ padding: '5px 10px', color: 'var(--tech-blue)' }}><FiEdit2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
         </table>
  </ResponsiveTable>
</div>
      )}

      {tab === 'runs' && (
        <div style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Payroll #</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Period</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Gross</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>PAYE</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>SSNIT (Emp)</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Net</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>Actions</th>
            </tr></thead>
            <tbody>
              {runs.length === 0 ? <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No payroll runs yet.</td></tr> :
              runs.map((r, i) => (
                <tr key={r._id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                  <td style={{ padding: '11px 16px', fontFamily: 'monospace', fontWeight: 600 }}>{r.payrollNumber}</td>
                  <td style={{ padding: '11px 16px' }}>{months[(r.period?.month || 1) - 1]} {r.period?.year}</td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(r.totalGross)}</td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(r.totalPaye)}</td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(r.totalEmployeeSsnit)}</td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{formatCurrency(r.totalNet)}</td>
                  <td style={{ padding: '11px 16px', textAlign: 'center' }}><span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, textTransform: 'capitalize', background: r.status === 'approved' ? '#D1FAE5' : '#FEF3C7', color: r.status === 'approved' ? '#065F46' : '#92400E' }}>{r.status}</span></td>
                  <td style={{ padding: '11px 16px', textAlign: 'center' }}>{r.status === 'draft' && <button onClick={() => handleApprove(r._id)} style={{ padding: '4px 10px', borderRadius: 'var(--radius-sm)', color: 'var(--success)', fontSize: 11, fontWeight: 600, border: '1px solid var(--success)' }}><FiCheck size={12} /> Approve</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Employee Form Modal */}
      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} title={editing ? 'Edit Employee' : 'New Employee'} width={640}>
        <form onSubmit={handleSaveEmployee}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div><label style={labelStyle}>First Name *</label><input name="firstName" style={inputStyle} defaultValue={editing?.firstName || ''} required /></div>
            <div><label style={labelStyle}>Last Name *</label><input name="lastName" style={inputStyle} defaultValue={editing?.lastName || ''} required /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div><label style={labelStyle}>Email</label><input name="email" type="email" style={inputStyle} defaultValue={editing?.email || ''} /></div>
            <div><label style={labelStyle}>Phone</label><input name="phone" style={inputStyle} defaultValue={editing?.phone || ''} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div><label style={labelStyle}>Position</label><input name="position" style={inputStyle} defaultValue={editing?.position || ''} /></div>
            <div><label style={labelStyle}>Department</label><input name="department" style={inputStyle} defaultValue={editing?.department || ''} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div><label style={labelStyle}>Basic Salary (GHS) *</label><input name="basicSalary" type="number" step="0.01" style={inputStyle} defaultValue={editing?.basicSalary || ''} required /></div>
            <div><label style={labelStyle}>SSNIT Number</label><input name="ssnitNumber" style={inputStyle} defaultValue={editing?.ssnitNumber || ''} /></div>
            <div><label style={labelStyle}>Tax ID (TIN)</label><input name="taxId" style={inputStyle} defaultValue={editing?.taxId || ''} /></div>
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => { setModalOpen(false); setEditing(null); }} style={{ padding: '10px 22px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 14, color: 'var(--text-secondary)', background: '#fff' }}>Cancel</button>
            <button type="submit" style={{ padding: '10px 22px', borderRadius: 'var(--radius-sm)', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', fontSize: 14, fontWeight: 600 }}>{editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      {/* Run Payroll Modal */}
      <Modal isOpen={runModalOpen} onClose={() => setRunModalOpen(false)} title="Run Payroll" width={400}>
        <form onSubmit={handleRunPayroll}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div><label style={labelStyle}>Month *</label><select name="month" style={inputStyle} defaultValue={new Date().getMonth() + 1}>{months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>
            <div><label style={labelStyle}>Year *</label><input name="year" type="number" style={inputStyle} defaultValue={new Date().getFullYear()} required /></div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>This will calculate PAYE, SSNIT (5.5% employee, 13% employer), and net pay for all {employees.length} active employees.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setRunModalOpen(false)} style={{ padding: '10px 22px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 14, color: 'var(--text-secondary)', background: '#fff' }}>Cancel</button>
            <button type="submit" style={{ padding: '10px 22px', borderRadius: 'var(--radius-sm)', background: 'var(--nexusora-gold)', color: 'var(--deep-navy)', fontSize: 14, fontWeight: 600 }}>Calculate Payroll</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}