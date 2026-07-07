import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiZap, FiSend, FiAlertTriangle, FiTag, FiTrendingUp,
  FiMessageSquare, FiBarChart2, FiChevronRight, FiLock,
} from 'react-icons/fi';
import { StaggerContainer, StaggerItem } from '../../components/common/Animate';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import api from '../../services/api';

// ─── Navigation tag parser ─────────────────────────────────────────────────
function parseNavTags(text) {
  const navRegex = /\[NAV:([^\|]+)\|([^\]]+)\]/g;
  const navItems = [];
  let match;
  while ((match = navRegex.exec(text)) !== null) {
    navItems.push({ path: match[1], label: match[2] });
  }
  const cleanText = text.replace(/\[NAV:[^\]]+\]/g, '').trim();
  return { cleanText, navItems };
}

// ─── Chat Message ──────────────────────────────────────────────────────────
function ChatMessage({ message, navigate }) {
  const isUser = message.role === 'user';
  const { cleanText, navItems } = isUser ? { cleanText: message.content, navItems: [] } : parseNavTags(message.content);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ display: 'flex', gap: 12, marginBottom: 20, flexDirection: isUser ? 'row-reverse' : 'row' }}
    >
      {/* Avatar */}
      <div style={{
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
        background: isUser ? 'var(--tech-blue)' : 'linear-gradient(135deg, #1A3560, #2E75B6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, color: isUser ? '#fff' : '#C9A227',
      }}>
        {isUser ? 'U' : 'N'}
      </div>

      {/* Bubble */}
      <div style={{ maxWidth: '78%' }}>
        <div style={{
          padding: '12px 16px', borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
          background: isUser ? 'var(--tech-blue)' : '#fff',
          color: isUser ? '#fff' : 'var(--text-primary)',
          border: isUser ? 'none' : '1px solid var(--border)',
          fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          {cleanText}
        </div>

        {/* Navigation buttons */}
        {navItems.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {navItems.map((nav, i) => (
              <motion.button key={i} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => navigate(nav.path)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 20,
                  background: 'linear-gradient(135deg, #1A3560, #2E75B6)',
                  color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                }}>
                {nav.label} <FiChevronRight size={12} />
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Anomaly Detection Panel ───────────────────────────────────────────────
function AnomalyPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const { showToast, ToastComponent } = useToast();
  const severityColors = {
    high: { bg: '#FEE2E2', text: '#DC2626', border: '#FECACA', label: '🔴 High' },
    medium: { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A', label: '🟡 Medium' },
    low: { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0', label: '🟢 Low' },
  };

  const run = async () => {
    setLoading(true); setResult(null);
    try {
      const { data } = await api.post('/ai/anomaly-detection');
      if (data.success) setResult(data.data);
    } catch (err) { showToast(err.response?.data?.message || 'Failed', 'error'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
      {ToastComponent}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiAlertTriangle size={18} color="#DC2626" />
          </div>
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Anomaly Detection</h4>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Scan last 90 days for suspicious patterns</p>
          </div>
        </div>
        <motion.button onClick={run} disabled={loading}
          whileHover={{ scale: loading ? 1 : 1.02 }} whileTap={{ scale: loading ? 1 : 0.97 }}
          style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', background: loading ? '#ccc' : '#DC2626', color: '#fff', fontSize: 12, fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading ? 'Scanning...' : '🔍 Run Scan'}
        </motion.button>
      </div>
      <div style={{ padding: '16px 20px' }}>
        {!result && !loading && <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>Click "Run Scan" to analyse your transactions.</p>}
        {loading && (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              style={{ width: 32, height: 32, border: '3px solid #FEE2E2', borderTopColor: '#DC2626', borderRadius: '50%', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Analysing {result?.transactionsAnalysed || ''} transactions...</p>
          </div>
        )}
        {result && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <div style={{ padding: '10px 14px', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', textAlign: 'center', flex: 1 }}>
                <p style={{ fontSize: 18, fontWeight: 700 }}>{result.transactionsAnalysed}</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Analysed</p>
              </div>
              <div style={{ padding: '10px 14px', background: result.anomalies.length > 0 ? '#FEF3C7' : '#D1FAE5', borderRadius: 'var(--radius-sm)', textAlign: 'center', flex: 1 }}>
                <p style={{ fontSize: 18, fontWeight: 700, color: result.anomalies.length > 0 ? 'var(--warning)' : 'var(--success)' }}>{result.anomalies.length}</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Issues Found</p>
              </div>
            </div>
            {result.summary && <p style={{ fontSize: 13, color: 'var(--deep-navy)', background: '#EBF5FF', padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: 12, lineHeight: 1.5 }}>{result.summary}</p>}
            {result.anomalies.map((a, i) => {
              const sc = severityColors[a.severity] || severityColors.low;
              return (
                <div key={i} style={{ padding: '10px 14px', background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: 'var(--radius-sm)', marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: sc.text }}>{sc.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.type}</span>
                    {a.entry && <span style={{ fontSize: 11, fontFamily: 'monospace', color: sc.text }}>{a.entry}</span>}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 4 }}>{a.description}</p>
                  {a.recommendation && <p style={{ fontSize: 11, color: sc.text, fontWeight: 500 }}>💡 {a.recommendation}</p>}
                </div>
              );
            })}
            {result.anomalies.length === 0 && <p style={{ fontSize: 13, color: 'var(--success)', textAlign: 'center' }}>✅ No anomalies detected.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Categorisation Panel ──────────────────────────────────────────────────
function CategorisePanel({ onNavigate }) {
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const { showToast, ToastComponent } = useToast();

  const run = async () => {
    if (!desc.trim()) { showToast('Enter a description', 'error'); return; }
    setLoading(true); setResult(null);
    try {
      const { data } = await api.post('/ai/categorise', { description: desc });
      if (data.success) setResult(data.data);
    } catch (err) { showToast(err.response?.data?.message || 'Failed', 'error'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
      {ToastComponent}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FiTag size={18} color="#2563EB" />
        </div>
        <div>
          <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Smart Categorisation</h4>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>AI suggests debit/credit accounts from description</p>
        </div>
      </div>
      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()}
            placeholder="e.g. Paid Vodafone internet bill..."
            style={{ flex: 1, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, outline: 'none' }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--tech-blue)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--border)')} />
          <motion.button onClick={run} disabled={loading} whileHover={{ scale: loading ? 1 : 1.02 }} whileTap={{ scale: loading ? 1 : 0.97 }}
            style={{ padding: '10px 16px', borderRadius: 'var(--radius-sm)', background: loading ? '#ccc' : 'var(--tech-blue)', color: '#fff', fontSize: 12, fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
            {loading ? '...' : '🤖 Suggest'}
          </motion.button>
        </div>

        {result && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'center', marginBottom: 12 }}>
              <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: '#D1FAE5', border: '1px solid #A7F3D0' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#065F46', marginBottom: 4 }}>DEBIT (DR)</p>
                <p style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace' }}>{result.debitAccount?.code}</p>
                <p style={{ fontSize: 12 }}>{result.debitAccount?.name}</p>
                <p style={{ fontSize: 10, color: '#065F46' }}>{Math.round((result.debitAccount?.confidence || 0) * 100)}% confident</p>
              </div>
              <FiChevronRight size={20} color="var(--text-muted)" />
              <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: '#FEE2E2', border: '1px solid #FECACA' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#991B1B', marginBottom: 4 }}>CREDIT (CR)</p>
                <p style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace' }}>{result.creditAccount?.code}</p>
                <p style={{ fontSize: 12 }}>{result.creditAccount?.name}</p>
                <p style={{ fontSize: 10, color: '#991B1B' }}>{Math.round((result.creditAccount?.confidence || 0) * 100)}% confident</p>
              </div>
            </div>
            {result.explanation && <p style={{ fontSize: 12, color: 'var(--deep-navy)', background: '#EBF5FF', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}><strong>Reasoning:</strong> {result.explanation}</p>}
            <motion.button onClick={() => onNavigate('/journals/new')} whileHover={{ x: 3 }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--tech-blue)', fontWeight: 500, border: 'none', background: 'none', cursor: 'pointer', padding: 0, marginTop: 10 }}>
              Use these accounts in a new journal entry <FiChevronRight size={12} />
            </motion.button>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ─── Report Generator Panel ─────────────────────────────────────────────────
function ReportPanel() {
  const [reportType, setReportType] = useState('profit_loss');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const { showToast, ToastComponent } = useToast();

  const run = async () => {
    setLoading(true); setResult(null);
    try {
      const { data } = await api.post('/ai/generate-report', { reportType });
      if (data.success) setResult(data.data);
    } catch (err) { showToast(err.response?.data?.message || 'Failed', 'error'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
      {ToastComponent}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiBarChart2 size={18} color="#16A34A" />
          </div>
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>AI Report Analysis</h4>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Generate AI-powered insights on your financials</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={reportType} onChange={(e) => setReportType(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, background: '#fff' }}>
            <option value="profit_loss">Profit & Loss</option>
            <option value="balance_sheet">Balance Sheet</option>
            <option value="cash_position">Cash Position</option>
          </select>
          <motion.button onClick={run} disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.02 }} whileTap={{ scale: loading ? 1 : 0.97 }}
            style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: loading ? '#ccc' : '#16A34A', color: '#fff', fontSize: 12, fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Generating...' : '📊 Analyse'}
          </motion.button>
        </div>
      </div>
      <div style={{ padding: '16px 20px' }}>
        {!result && !loading && <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>Select a report type and click Analyse for AI-powered financial insights.</p>}
        {loading && (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              style={{ width: 32, height: 32, border: '3px solid #D1FAE5', borderTopColor: '#16A34A', borderRadius: '50%', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Generating AI analysis...</p>
          </div>
        )}
        {result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h5 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: 'var(--deep-navy)' }}>📊 AI Analysis: {result.reportName}</h5>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', background: '#F8FAFF', padding: 16, borderRadius: 'var(--radius-sm)', border: '1px solid #E2E8F0' }}>
              {result.analysis}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ─── Main AI Page ──────────────────────────────────────────────────────────
export default function AIPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast, ToastComponent } = useToast();

  const [activeTab, setActiveTab] = useState('chat');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hello ${user?.firstName || 'there'}! 👋 I'm the **Nexusora Account Assistant.\n\nI can help you with:\n• Navigating this system ("take me to invoices")\n• Accounting questions (IFRS, Ghana tax, double-entry)\n• Understanding your reports and transactions\n• AI-powered anomaly detection and forecasting (Premium)\n\nWhat would you like to do today?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || chatLoading) return;

    const userMsg = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setChatLoading(true);

    try {
      const { data } = await api.post('/ai/chat', {
        messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
      });

      if (data.success) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.data.response }]);
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Connection error. Please try again.';
      setMessages((prev) => [...prev, { role: 'assistant', content: `⚠️ ${errMsg}` }]);
    } finally { setChatLoading(false); }
  };

  const tabs = [
    { key: 'chat', label: 'Chat', icon: '💬' },
    { key: 'tools', label: 'AI Tools', icon: '🔧' },
  ];

  const quickPrompts = [
    'Take me to the reports section',
    'How do I record a purchase?',
    'What is the current cash balance?',
    'Explain double-entry accounting',
    'Navigate to journal entries',
    'How is PAYE calculated in Ghana?',
  ];

  return (
    <div style={{ height: 'calc(100vh - var(--topbar-height) - 64px)', display: 'flex', flexDirection: 'column' }}>
      {ToastComponent}

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: 'linear-gradient(135deg, #1A3560, #2E75B6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FiZap size={22} color="#C9A227" />
        </div>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
            Nexusora Account Assistant
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}></p>
        </div>
        <div style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 20, background: '#D1FAE5', fontSize: 11, fontWeight: 600, color: '#065F46' }}>
          ● Online
        </div>
      </motion.div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            padding: '10px 18px', fontSize: 13, fontWeight: activeTab === t.key ? 600 : 400,
            color: activeTab === t.key ? 'var(--deep-navy)' : 'var(--text-muted)',
            borderBottom: activeTab === t.key ? '2px solid var(--nexusora-gold)' : '2px solid transparent',
            background: 'transparent', marginBottom: -1, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Chat Tab */}
      {activeTab === 'chat' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '8px 4px', minHeight: 0,
            scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent',
          }}>
            {messages.map((msg, i) => (
              <ChatMessage key={i} message={msg} navigate={navigate} />
            ))}
            {chatLoading && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, #1A3560, #2E75B6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#C9A227', flexShrink: 0 }}>N</div>
                <div style={{ padding: '12px 16px', borderRadius: '4px 16px 16px 16px', background: '#fff', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[0, 1, 2].map((i) => (
                      <motion.div key={i} animate={{ scale: [0.6, 1, 0.6], opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                        style={{ width: 8, height: 8, borderRadius: '50%', background: '#C9A227' }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          {messages.length <= 1 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {quickPrompts.map((p, i) => (
                <motion.button key={i} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => { setInput(p); }}
                  style={{
                    padding: '6px 14px', borderRadius: 20, border: '1px solid var(--border)',
                    background: '#fff', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer',
                  }}>{p}</motion.button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ display: 'flex', gap: 10, padding: '12px 0 0', borderTop: '1px solid var(--border)' }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Ask anything — accounting, navigation, reports, Ghana tax..."
              disabled={chatLoading}
              style={{
                flex: 1, padding: '12px 16px',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                fontSize: 14, outline: 'none', resize: 'none',
                background: chatLoading ? '#F9FAFB' : '#fff',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--tech-blue)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
            />
            <motion.button onClick={sendMessage} disabled={chatLoading || !input.trim()}
              whileHover={{ scale: chatLoading || !input.trim() ? 1 : 1.05 }}
              whileTap={{ scale: chatLoading || !input.trim() ? 1 : 0.95 }}
              style={{
                width: 46, height: 46, borderRadius: 'var(--radius-md)',
                background: chatLoading || !input.trim() ? '#E5E7EB' : 'linear-gradient(135deg, #1A3560, #2E75B6)',
                color: chatLoading || !input.trim() ? '#9CA3AF' : '#fff',
                border: 'none', cursor: chatLoading || !input.trim() ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
              <FiSend size={18} />
            </motion.button>
          </div>
        </div>
      )}

      {/* Tools Tab */}
      {activeTab === 'tools' && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20, minHeight: 0 }}>
          <div style={{ padding: '10px 16px', background: 'linear-gradient(135deg, #1A3560, #2E75B6)', borderRadius: 'var(--radius-md)', fontSize: 13, color: '#fff' }}>
            ✨ <strong>Premium AI Tools</strong> — Requires Professional or Enterprise plan. Chat is available on all plans.
          </div>
          <AnomalyPanel />
          <CategorisePanel onNavigate={navigate} />
          <ReportPanel />
        </div>
      )}
    </div>
  );
}