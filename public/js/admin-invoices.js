function setMsg(text, type) {
  const el = document.getElementById('msg');
  if (!el) return;
  el.className = `msg ${type}`;
  el.textContent = text;
  el.style.display = 'block';
}

function clearMsg() {
  const el = document.getElementById('msg');
  if (!el) return;
  el.style.display = 'none';
}

function getToken() {
  return localStorage.getItem('tronex_token');
}

function requireTokenOrShowLogin() {
  const token = getToken();
  const btnLogin = document.getElementById('btnGoLogin');
  if (!token) {
    if (btnLogin) {
      btnLogin.style.display = 'inline-flex';
      btnLogin.onclick = () => {
        window.location.href = '/login?next=' + encodeURIComponent('/admin-invoices');
      };
    }
    setMsg('You are not logged in. Please login to create invoices.', 'error');
    return false;
  }
  if (btnLogin) btnLogin.style.display = 'none';
  return true;
}

async function api(url, options = {}) {
  const token = getToken();
  const headers = Object.assign(
    { 'Content-Type': 'application/json' },
    options.headers || {},
    token ? { Authorization: `Bearer ${token}` } : {}
  );
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const msg = data.message || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.data = data;
    err.status = res.status;
    throw err;
  }
  return data;
}

let cars = [];
let items = [];
let lastInvoice = null;

function money(n) {
  const num = Number(n || 0);
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderCars() {
  const sel = document.getElementById('carSelect');
  if (!sel) return;
  sel.innerHTML = cars
    .map(c => {
      const label = `${c.internalStockNumber || 'N/A'} • ${c.make} ${c.model} (${c.year})`;
      return `<option value="${c._id}">${label}</option>`;
    })
    .join('');
}

function renderItems() {
  const tbody = document.getElementById('itemsBody');
  if (!tbody) return;
  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="muted">No items yet. Click “Add item”.</td></tr>`;
    return;
  }

  tbody.innerHTML = items
    .map((it, idx) => {
      const desc = it.description || '';
      const cost = it.cost ?? '';
      return `
        <tr>
          <td>
            <input data-idx="${idx}" data-field="description" value="${escapeHtml(desc)}" style="width:100%" />
          </td>
          <td>
            <input data-idx="${idx}" data-field="cost" type="number" step="0.01" value="${escapeHtml(String(cost))}" style="width:100%" />
          </td>
          <td>
            <button class="btn btn-danger" type="button" data-action="remove" data-idx="${idx}"><i class="fa-solid fa-trash"></i> Remove</button>
          </td>
        </tr>
      `;
    })
    .join('');
}

function escapeHtml(s) {
  return (s ?? '').toString().replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function updateOutput(invoice) {
  document.getElementById('outInvoiceNumber').textContent = invoice?.invoiceNumber || '—';
  document.getElementById('outStatus').textContent = invoice?.status || '—';
  document.getElementById('outSubtotal').textContent = invoice ? money(invoice.subtotal) : '—';
  document.getElementById('outTotal').textContent = invoice ? money(invoice.totalCost) : '—';

  const btnPdf = document.getElementById('btnDownloadPdf');
  if (btnPdf) btnPdf.disabled = !invoice;
}

async function loadCars() {
  const result = await api('/api/cars', { method: 'GET', headers: {} });
  cars = result.data || [];
  renderCars();
}

function addItem() {
  items.push({ description: '', cost: 0 });
  renderItems();
}

function clearAll() {
  items = [];
  lastInvoice = null;
  renderItems();
  clearMsg();
  updateOutput(null);
  document.getElementById('claimClause').value = '';
}

async function createInvoice() {
  if (!requireTokenOrShowLogin()) return;
  clearMsg();

  const carId = document.getElementById('carSelect').value;
  const expiryDate = document.getElementById('expiryDate').value;
  if (!expiryDate) {
    setMsg('Please select an expiry date.', 'error');
    return;
  }

  const payload = {
    carId,
    expiryDate,
    invoiceItems: items
      .map(i => ({ description: (i.description || '').trim(), cost: Number(i.cost || 0) }))
      .filter(i => i.description.length > 0),
    bankDetails: {
      bankName: document.getElementById('bankName').value.trim(),
      accountName: document.getElementById('accountName').value.trim(),
      accountNumber: document.getElementById('accountNumber').value.trim(),
      swiftCode: document.getElementById('swiftCode').value.trim()
    },
    mpesaDetails: {
      paybillNumber: document.getElementById('paybillNumber').value.trim(),
      accountName: document.getElementById('mpesaAccountName').value.trim()
    },
    claimClause: document.getElementById('claimClause').value.trim() || undefined
  };

  try {
    const result = await api('/api/admin/invoices', { method: 'POST', body: JSON.stringify(payload) });
    lastInvoice = result.data;
    setMsg(`Invoice created: ${lastInvoice.invoiceNumber}`, 'success');
    updateOutput(lastInvoice);
  } catch (err) {
    setMsg(err.message, 'error');
  }
}

async function downloadPdf() {
  if (!requireTokenOrShowLogin()) return;
  if (!lastInvoice) return;

  const token = getToken();
  const idOrNumber = lastInvoice.invoiceNumber || lastInvoice._id;

  const res = await fetch(`/api/invoices/${encodeURIComponent(idOrNumber)}/pdf`, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  if (!res.ok) {
    const text = await res.text();
    setMsg(text || `Failed to download PDF (${res.status})`, 'error');
    return;
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${idOrNumber}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function wireEvents() {
  document.getElementById('btnAddItem').addEventListener('click', addItem);
  document.getElementById('btnCreateInvoice').addEventListener('click', createInvoice);
  document.getElementById('btnClear').addEventListener('click', clearAll);
  document.getElementById('btnDownloadPdf').addEventListener('click', downloadPdf);

  const btnLogout = document.getElementById('btnLogout');
  btnLogout.addEventListener('click', () => {
    localStorage.removeItem('tronex_token');
    localStorage.removeItem('tronex_user');
    setMsg('Logged out. Please login again.', 'success');
    requireTokenOrShowLogin();
  });

  document.getElementById('itemsBody').addEventListener('input', (e) => {
    const t = e.target;
    const idx = Number(t.getAttribute('data-idx'));
    const field = t.getAttribute('data-field');
    if (!Number.isFinite(idx) || !field) return;
    items[idx][field] = field === 'cost' ? Number(t.value) : t.value;
  });

  document.getElementById('itemsBody').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.action === 'remove') {
      const idx = Number(btn.dataset.idx);
      items.splice(idx, 1);
      renderItems();
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  wireEvents();
  renderItems();
  requireTokenOrShowLogin();
  try {
    await loadCars();
  } catch (err) {
    setMsg(err.message || 'Failed to load cars', 'error');
  }
});

