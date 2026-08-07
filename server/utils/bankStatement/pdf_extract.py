#!/usr/bin/env python3
"""
pdf_extract.py — turn a column-aligned bank-statement PDF into the same grid
our tabular reader produces, so the existing mapper / balance-gate / auto-apply
pipeline works unchanged.

Reads a PDF from a path (argv[1]) or from stdin (bytes). Emits JSON on stdout:
  { ok, grid, columns, previewRows, meta, warnings, sheetCount, totalRows }
On failure emits { ok: false, code, message } and exits 0 (Node reads the code).

Strategy: cluster words into rows by y, detect the header row by known tokens,
derive column x-boundaries from the header word positions, then assign every
word on every page to a column by its left edge. No per-bank hardcoding — the
columns come from whatever header the statement uses.
"""
import sys, json, io, re

HEADER_TOKENS = ['date', 'description', 'balance', 'debit', 'credit', 'amount',
                 'reference', 'narration', 'particulars', 'withdrawal', 'deposit',
                 'value', 'booking', 'transaction']
ROW_TOL = 3.0  # words within this many points of vertical position = same row


def cluster_rows(words):
    rows = {}
    for w in words:
        key = None
        for k in rows:
            if abs(k - w['top']) <= ROW_TOL:
                key = k
                break
        rows.setdefault(w['top'] if key is None else key, []).append(w)
    return [sorted(rows[k], key=lambda x: x['x0']) for k in sorted(rows)]


def looks_like_header(row):
    joined = ' '.join(w['text'].lower() for w in row)
    hits = sum(1 for t in HEADER_TOKENS if t in joined)
    return hits >= 3


def header_boundaries(row):
    """Column start x from header words: split header words into groups where a
    horizontal gap > 18pt begins a new column. Returns list of left boundaries."""
    starts = []
    prev_x1 = None
    for w in row:
        if prev_x1 is None or (w['x0'] - prev_x1) > 18:
            starts.append(w['x0'])
        prev_x1 = w['x1']
    # boundaries: midpoint between consecutive starts; first col starts at -inf
    bounds = []
    for i, s in enumerate(starts):
        left = 0 if i == 0 else (starts[i - 1] + s) / 2.0
        bounds.append(left)
    bounds.append(float('inf'))
    return bounds  # len = ncols + 1


def assign(row, bounds):
    ncols = len(bounds) - 1
    cells = [''] * ncols
    for w in row:
        cx = w['x0']
        for i in range(ncols):
            if bounds[i] <= cx < bounds[i + 1]:
                cells[i] = (cells[i] + ' ' + w['text']).strip() if cells[i] else w['text']
                break
    return cells


def harvest_meta(text):
    meta = {}
    m = re.search(r'Account\s*:\s*([0-9]+)', text)
    if m:
        meta['account'] = m.group(1)
    m = re.search(r'Currency\s*:\s*([A-Z]{3})', text)
    if m:
        meta['currency'] = m.group(1)
    m = re.search(r'Account\s*:\s*[0-9]+\s+([A-Z][A-Z \-&]+)', text)
    if m:
        meta['accountHolder'] = m.group(1).strip()
    return meta


def main():
    try:
        import pdfplumber
    except Exception:
        print(json.dumps({'ok': False, 'code': 'NO_PDF_ENGINE',
                          'message': 'PDF engine (pdfplumber) not installed on server.'}))
        return

    try:
        if len(sys.argv) > 1 and sys.argv[1] != '-':
            src = sys.argv[1]
        else:
            src = io.BytesIO(sys.stdin.buffer.read())
        pdf = pdfplumber.open(src)
    except Exception as e:
        print(json.dumps({'ok': False, 'code': 'EMPTY_OR_SCAN',
                          'message': 'Could not open PDF: ' + str(e)}))
        return

    pages = pdf.pages
    if not pages:
        print(json.dumps({'ok': False, 'code': 'EMPTY_OR_SCAN', 'message': 'Empty PDF.'}))
        return

    all_text = []
    bounds = None
    header_cells = None
    grid = []
    warnings = []

    for pi, page in enumerate(pages):
        txt = page.extract_text() or ''
        all_text.append(txt)
        words = page.extract_words(use_text_flow=False, keep_blank_chars=False)
        if not words:
            continue
        rows = cluster_rows(words)
        for row in rows:
            if bounds is None:
                if looks_like_header(row):
                    bounds = header_boundaries(row)
                    header_cells = assign(row, bounds)
                    grid.append(header_cells)
                continue
            # skip repeated header rows on later pages
            if looks_like_header(row):
                continue
            joined = ' '.join(w['text'] for w in row).strip()
            if re.match(r'^Page\s+\d+\s+of\s+\d+', joined, re.I):
                continue
            cells = assign(row, bounds)
            if not any(c.strip() for c in cells):
                continue
            grid.append(cells)

    if bounds is None:
        print(json.dumps({'ok': False, 'code': 'EMPTY_OR_SCAN',
                          'message': 'No table header found in this PDF (it may be scanned or not a statement).'}))
        return

    ncols = len(header_cells)

    # Normalize the "Balance at Period Start/End" anchor rows, which the PDF wraps
    # across cells/rows. Rewrite to a canonical description + keep the balance
    # value, and drop the stray wrap fragment that follows ('tart' / 'nd').
    num_re = re.compile(r'^-?[\d,]+\.\d{2}$')
    def find_amount(cells):
        for c in reversed(cells):
            if num_re.match(c.strip().replace(' ', '')):
                return c.strip().replace(' ', '')
        return ''
    cleaned = [grid[0]]
    i = 1
    while i < len(grid):
        row = grid[i]
        full = ' '.join(row).lower()
        if 'balance at period' in full or re.search(r'balance at period\s*[se]', full):
            is_end = bool(re.search(r'period\s*e', full)) or 'end' in full
            label = 'Balance at Period End' if is_end else 'Balance at Period Start'
            amt = find_amount(row)
            newrow = [''] * ncols
            newrow[2] = label
            newrow[ncols - 1] = amt
            cleaned.append(newrow)
            # drop an immediately-following pure wrap fragment (short, no numbers)
            if i + 1 < len(grid):
                nxt = grid[i + 1]
                nonempty = [c for c in nxt if c.strip()]
                if len(nonempty) == 1 and len(nonempty[0]) <= 4 and not any(ch.isdigit() for ch in nonempty[0]):
                    i += 1
            i += 1
            continue
        cleaned.append(row)
        i += 1
    grid = cleaned

    # Fold continuation rows (counterparty name + narration that the PDF wraps
    # onto the lines below a transaction) into a dedicated Counterparty column,
    # so Description stays the transaction type and the counterparty is its own
    # field. A "carrier" row starts a transaction (has a booking date or a
    # monetary amount); anything else is a continuation of the row above.
    def is_carrier(r):
        if r and r[0].strip():
            return True
        for c in r:
            if num_re.match(c.strip().replace(' ', '')):
                return True
        return False

    folded = [grid[0] + ['Counterparty']]
    current = None
    for r in grid[1:]:
        if is_carrier(r):
            row = list(r) + ['']
            folded.append(row)
            current = row
        elif current is not None:
            frag = ' '.join(c.strip() for c in r if c.strip())
            if frag:
                cp = len(current) - 1
                current[cp] = (current[cp] + ' ' + frag).strip() if current[cp] else frag
    grid = folded
    header_cells = grid[0]
    ncols = len(header_cells)

    columns = []
    for ci in range(ncols):
        samples = []
        for r in grid[1:]:
            v = r[ci].strip() if ci < len(r) else ''
            if v:
                samples.append(v)
            if len(samples) >= 3:
                break
        columns.append({'index': ci, 'header': header_cells[ci], 'samples': samples})

    out = {
        'ok': True,
        'sheetName': 'PDF',
        'sheetCount': len(pages),
        'headerRowIndex': 0,
        'totalRows': len(grid),
        'columns': columns,
        'previewRows': grid[1:6],
        'grid': grid,
        'meta': harvest_meta('\n'.join(all_text)),
        'warnings': warnings,
    }
    print(json.dumps(out))


if __name__ == '__main__':
    main()
