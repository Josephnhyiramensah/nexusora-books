// client/src/modules/vouchers/VoucherAttachments.jsx
// Reusable attachments panel for a voucher: upload scanned source documents
// (image or PDF), list them, view/download, and remove. Used on the voucher
// view/edit page. Files go to Cloudinary via /upload/document, then link to the
// voucher via /vouchers/:id/attachments.
import { useState, useRef } from 'react';
import { FiPaperclip, FiUploadCloud, FiTrash2, FiFile, FiImage, FiExternalLink } from 'react-icons/fi';
import api from '../../services/api';

export default function VoucherAttachments({ voucherId, subdomain, attachments = [], onChange, showToast }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const pick = () => fileRef.current?.click();

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { showToast?.('File must be under 10MB', 'error'); if (fileRef.current) fileRef.current.value=''; return; }
    setUploading(true);
    try {
      // read as base64
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      // 1. upload to Cloudinary
      const up = await api.post('/upload/document', { fileData: base64, subdomain, filename: file.name });
      if (!up.data.success) throw new Error(up.data.message || 'Upload failed');
      // 2. link to the voucher
      const link = await api.post(`/vouchers/${voucherId}/attachments`, {
        url: up.data.url, publicId: up.data.publicId, filename: up.data.filename, resourceType: up.data.resourceType,
      });
      if (link.data.success) { onChange?.(link.data.data); showToast?.('Document attached', 'success'); }
      else throw new Error(link.data.message || 'Attach failed');
    } catch (err) {
      showToast?.(err.response?.data?.message || err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = async (attId) => {
    if (!window.confirm('Remove this document?')) return;
    try {
      const { data } = await api.delete(`/vouchers/${voucherId}/attachments/${attId}`);
      if (data.success) { onChange?.(data.data); showToast?.('Document removed', 'success'); }
      else showToast?.(data.message || 'Failed', 'error');
    } catch (err) { showToast?.(err.response?.data?.message || 'Failed to remove', 'error'); }
  };

  const isImage = (a) => a.resourceType === 'image' || /\.(png|jpe?g|gif|webp)$/i.test(a.filename || '');
  const card = { background: 'var(--surface, #fff)', border: '1px solid var(--border, #E5E7EB)', borderRadius: 12, padding: 20 };
  const label = { fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #012158)', margin: 0, display: 'inline-flex', alignItems: 'center', gap: 8 };

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={label}><FiPaperclip size={16} /> Source Documents</h3>
        <button onClick={pick} disabled={uploading}
          style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border, #D1D5DB)', background: 'transparent', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <FiUploadCloud size={15} /> {uploading ? 'Uploading…' : 'Attach'}
        </button>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={onFile} style={{ display: 'none' }} />
      </div>

      {(!attachments || attachments.length === 0) ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted, #9CA3AF)', margin: 0 }}>No documents attached. Attach a scanned receipt, payment voucher, or contract for auditing.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {attachments.map((a) => (
            <div key={a._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--border, #F0F0F0)', borderRadius: 8 }}>
              {isImage(a) ? <FiImage size={18} style={{ color: '#2563EB', flexShrink: 0 }} /> : <FiFile size={18} style={{ color: '#DC2626', flexShrink: 0 }} />}
              <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.filename || 'document'}</span>
              <a href={a.url} target="_blank" rel="noopener noreferrer" title="View / download"
                style={{ color: 'var(--text-secondary, #6B7280)', display: 'inline-flex', padding: 4 }}><FiExternalLink size={15} /></a>
              <button onClick={() => remove(a._id)} title="Remove" style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', padding: 4 }}><FiTrash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
