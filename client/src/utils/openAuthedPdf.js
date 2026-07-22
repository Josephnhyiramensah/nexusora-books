import { getSubdomain } from '../services/api';

/**
 * Open a server-generated PDF that sits behind authentication.
 * window.open() cannot attach the Authorization header, so we fetch the PDF
 * ourselves, wrap it in a blob URL and open that instead.
 */
export async function openAuthedPdf(path, filename) {
  const token = localStorage.getItem('accessToken');
  const res = await fetch(path, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Tenant-ID': getSubdomain() || '',
    },
  });

  if (!res.ok) {
    let msg = 'Could not generate the document.';
    try { const j = await res.json(); msg = j.message || msg; } catch { /* not JSON */ }
    throw new Error(msg);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    // Pop-up blocked — fall back to a direct download.
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'document.pdf';
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}