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
    // Preview-only mode: do not block viewing the invoice.
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
  // Preview-only mode: older result fields may not exist.
  const outInvoiceNumber = document.getElementById('outInvoiceNumber');
  const outStatus = document.getElementById('outStatus');
  const outSubtotal = document.getElementById('outSubtotal');
  const outTotal = document.getElementById('outTotal');

  if (outInvoiceNumber) outInvoiceNumber.textContent = invoice?.invoiceNumber || '—';
  if (outStatus) outStatus.textContent = invoice?.status || '—';
  if (outSubtotal) outSubtotal.textContent = invoice ? money(invoice.subtotal) : '—';
  if (outTotal) outTotal.textContent = invoice ? money(invoice.totalCost) : '—';

  const btnPdf = document.getElementById('btnDownloadPdf');
  if (btnPdf) btnPdf.disabled = !invoice;

  renderInvoicePreview(invoice);
}

function renderInvoicePreview(invoice) {
  const el = document.getElementById('invoicePreview');
  if (!el) return;
  if (!invoice) {
    el.innerHTML = '';
    return;
  }

  const car = invoice.carDetails || {};
  const bank = invoice.bankDetails || {};
  const mpesa = invoice.mpesaDetails || {};
  const customer = invoice.customerDetails || {};

  const toName =
    (customer && customer.legalName) ||
    ((customer && customer.firstName) || '') + ' ' + ((customer && customer.lastName) || '');

  const currency = 'KES';
  const items = invoice.invoiceItems || [];

  const rows = items.map((it, idx) => {
    const desc = it.description || '';
    const cost = Number(it.cost || 0);
    const cls = idx % 2 === 0 ? 'alt' : '';
    return `
      <div class="trx-tr ${cls}">
        <div class="trx-desc">${escapeHtml(desc)}</div>
        <div class="trx-right">${currency} ${money(cost)}</div>
        <div class="trx-right"></div>
        <div class="trx-right"></div>
      </div>
    `;
  }).join('');

  const itemizedTotal = invoice.subtotal || 0;
  const totalCosts = invoice.totalCost || 0;

  el.innerHTML = `
    <div class="trx-invoice">
      <div class="trx-letterhead">
        <div class="trx-letterhead-left">
          <div class="trx-company">TRONEX CAR IMPORTERS LTD</div>
          <div class="trx-sub">Invoice</div>
          <div class="trx-muted">Mombasa, Kenya</div>
        </div>
        <div class="trx-letterhead-right">
          <div class="trx-muted">Mobile: __________________</div>
          <div class="trx-muted">Email: ___________________</div>
          <div class="trx-muted">Web: _____________________</div>
        </div>
      </div>

      <div class="trx-title">PROFORMA INVOICE</div>

      <div class="trx-meta">
        <div class="trx-meta-row">
          <div><strong>Customer ID:</strong> ${escapeHtml(customer.customerId || '__________________')}</div>
          <div><strong>Stock ID:</strong> <span>${escapeHtml(car.internalStockNumber || 'N/A')}</span></div>
        </div>
        <div class="trx-meta-row">
          <div><strong>Invoice No:</strong> ${escapeHtml(invoice.invoiceNumber || '__________________')}</div>
          <div><strong>Date Issued:</strong> ${escapeHtml(new Date(invoice.dateIssued || Date.now()).toLocaleDateString())}</div>
          <div><strong>Expiry Date:</strong> ${escapeHtml(invoice.expiryDate ? new Date(invoice.expiryDate).toLocaleDateString() : '__________________')}</div>
        </div>
        <div class="trx-meta-row">
          <div><strong>To:</strong> ${escapeHtml(toName.trim() || '__________________')}</div>
          <div><strong>Mobile No:</strong> ${escapeHtml(customer.mobileNumber || '__________________')}</div>
          <div><strong>Email:</strong> ${escapeHtml(customer.email || '__________________')}</div>
        </div>
      </div>

      <div class="trx-table">
        <div class="trx-thead">
          <div>Description</div>
          <div class="trx-right">Cost</div>
          <div class="trx-right">Itemized Total</div>
          <div class="trx-right">Total Cost</div>
        </div>

        ${rows}

        <div class="trx-tr sum">
          <div class="trx-desc"><strong>Itemized Total</strong></div>
          <div></div>
          <div class="trx-right"><strong>${currency} ${money(itemizedTotal)}</strong></div>
          <div></div>
        </div>

        <div class="trx-tr total">
          <div class="trx-desc"><strong>TOTAL COSTS (All Costs Inclusive)</strong></div>
          <div></div>
          <div></div>
          <div class="trx-right"><strong>${currency} ${money(totalCosts)}</strong></div>
        </div>
      </div>

      <div class="trx-paygrid">
        <div class="trx-box">
          <div class="trx-box-title">BANK DETAILS</div>
          <div class="trx-kv"><span>Bank</span><strong>${escapeHtml(bank.bankName || '—')}</strong></div>
          <div class="trx-kv"><span>Account Name</span><strong>${escapeHtml(bank.accountName || '—')}</strong></div>
          <div class="trx-kv"><span>Branch Code</span><strong>${escapeHtml(bank.branchCode || '—')}</strong></div>
          <div class="trx-kv"><span>Branch</span><strong>${escapeHtml(bank.branch || '—')}</strong></div>
          <div class="trx-kv"><span>Account Number</span><strong>${escapeHtml(bank.accountNumber || '—')}</strong></div>
          <div class="trx-kv"><span>Swift Code</span><strong>${escapeHtml(bank.swiftCode || '—')}</strong></div>
        </div>

        <div class="trx-box">
          <div class="trx-box-title">M-PESA DETAILS</div>
          <div class="trx-kv"><span>Paybill No</span><strong>${escapeHtml(mpesa.paybillNumber || '—')}</strong></div>
          <div class="trx-kv"><span>Account Name</span><strong>${escapeHtml(mpesa.accountName || '—')}</strong></div>
          <div class="trx-stamp-wrap">
            <img src="/images/tronex-stamp.svg" alt="Tronex Stamp" class="trx-stamp" />
          </div>
          <div class="trx-sign">
            <span>Customer Signature:</span>
            <div class="trx-line"></div>
          </div>
        </div>
      </div>

      <div class="trx-vehicle">
        <div class="trx-vehicle-title">VEHICLE DETAILS</div>
        <div class="trx-vehicle-grid">
          <div class="trx-vehicle-img">
            <img
              src="${escapeHtml(
                car.mainImage || ((car.images && car.images[0]) ? car.images[0] : '/images/placeholder-car.svg')
              )}"
              alt="${escapeHtml(car.make || '')} ${escapeHtml(car.model || '')}"
              onerror="this.src='/images/placeholder-car.svg'"
            />
          </div>
          <div class="trx-vehicle-specs">
            <div class="trx-spec-row"><span>Stock ID</span><strong>${escapeHtml(car.internalStockNumber || 'N/A')}</strong></div>
            <div class="trx-spec-row"><span>Year</span><strong>${escapeHtml(car.year || 'N/A')}</strong></div>
            <div class="trx-spec-row"><span>Make</span><strong>${escapeHtml(car.make || 'N/A')}</strong></div>
            <div class="trx-spec-row"><span>Model</span><strong>${escapeHtml(car.model || 'N/A')}</strong></div>
            <div class="trx-spec-row"><span>Body Type</span><strong>${escapeHtml(car.bodyType || 'N/A')}</strong></div>
            <div class="trx-spec-row"><span>Seats</span><strong>${escapeHtml(car.seats || 'N/A')}</strong></div>
            <div class="trx-spec-row"><span>Doors</span><strong>${escapeHtml(car.doors || 'N/A')}</strong></div>
            <div class="trx-spec-row"><span>Drive Type</span><strong>${escapeHtml(car.drive || 'N/A')}</strong></div>
            <div class="trx-spec-row"><span>Transmission</span><strong>${escapeHtml(car.transmission || 'N/A')}</strong></div>
            <div class="trx-spec-row"><span>Fuel Type</span><strong>${escapeHtml(car.fuel || 'N/A')}</strong></div>
            <div class="trx-spec-row"><span>Engine Capacity</span><strong>${escapeHtml(car.engineCapacity || 'N/A')}</strong></div>
            <div class="trx-spec-row"><span>Mileage</span><strong>${escapeHtml(
              (car.mileage !== undefined && car.mileage !== null) ? Number(car.mileage).toLocaleString() : 'N/A'
            )}</strong></div>
            <div class="trx-spec-row"><span>Registration</span><strong>${escapeHtml(car.registration || 'N/A')}</strong></div>
          </div>
        </div>
      </div>
    </div>
  `;
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
  const claimClause = document.getElementById('claimClause');
  if (claimClause) claimClause.value = '';
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

async function loadInvoiceFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const invoiceId = params.get('invoiceId');
  const invoiceNumber = params.get('invoiceNumber');
  const idOrNumber = invoiceId || invoiceNumber;
  if (!idOrNumber) return;

  const token = getToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const res = await fetch(`/api/invoices/${encodeURIComponent(idOrNumber)}`, { headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.success === false) {
    throw new Error(data.message || `Failed to load invoice (${res.status})`);
  }

  lastInvoice = data.data;
  updateOutput(lastInvoice);
  setMsg(`Loaded invoice: ${lastInvoice.invoiceNumber || lastInvoice._id}`, 'success');
}

function wireEvents() {
  const btnAddItem = document.getElementById('btnAddItem');
  if (btnAddItem) btnAddItem.addEventListener('click', addItem);

  const btnCreateInvoice = document.getElementById('btnCreateInvoice');
  if (btnCreateInvoice) btnCreateInvoice.addEventListener('click', createInvoice);

  const btnClear = document.getElementById('btnClear');
  if (btnClear) btnClear.addEventListener('click', clearAll);

  const btnDownloadPdf = document.getElementById('btnDownloadPdf');
  if (btnDownloadPdf) btnDownloadPdf.addEventListener('click', downloadPdf);

  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      localStorage.removeItem('tronex_token');
      localStorage.removeItem('tronex_user');
      setMsg('Logged out. Please login again.', 'success');
    });
  }

  const itemsBody = document.getElementById('itemsBody');
  if (itemsBody) {
    itemsBody.addEventListener('input', (e) => {
      const t = e.target;
      const idx = Number(t.getAttribute('data-idx'));
      const field = t.getAttribute('data-field');
      if (!Number.isFinite(idx) || !field) return;
      items[idx][field] = field === 'cost' ? Number(t.value) : t.value;
    });

    itemsBody.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.action === 'remove') {
        const idx = Number(btn.dataset.idx);
        items.splice(idx, 1);
        renderItems();
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  wireEvents();
  try {
    // Preview-only mode: load invoice preview even if token is missing.
    await loadInvoiceFromQuery();
  } catch (err) {
    setMsg(err.message || 'Failed to load cars', 'error');
  }
});

