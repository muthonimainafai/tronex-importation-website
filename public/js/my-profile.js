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

async function api(url, options = {}) {
  const token = getToken();
  const headers = Object.assign({}, options.headers || {}, token ? { Authorization: `Bearer ${token}` } : {});
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

function fmtMoney(n) {
  const num = Number(n || 0);
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString();
}

function renderAccountDetails(rows) {
  const tbody = document.getElementById('accountRows');
  if (!tbody) return;
  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="muted">No account records yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map(r => `
      <tr>
        <td>${escapeHtml(r.carStockNo || '')}</td>
        <td>${fmtMoney(r.priceSoldKsh)}</td>
        <td>${escapeHtml(fmtDate(r.receiveDate))}</td>
        <td>${fmtMoney(r.firstPayment)}</td>
        <td>${fmtMoney(r.secondPayment)}</td>
        <td>${fmtMoney(r.thirdPayment)}</td>
        <td>${fmtMoney(r.discountApplied)}</td>
        <td>${fmtMoney(r.balance)}</td>
      </tr>
    `)
    .join('');
}

function escapeHtml(s) {
  return (s ?? '').toString().replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function setPassportStatus(url) {
  const el = document.getElementById('passportStatus');
  if (!el) return;
  el.textContent = url ? 'Passport uploaded.' : 'No passport uploaded yet.';
}

function setConsigneeStatus(url) {
  const el = document.getElementById('consigneeStatus');
  if (!el) return;
  el.textContent = url ? 'Uploaded.' : 'Not uploaded.';
}

function setPinStatus(url) {
  const el = document.getElementById('pinStatus');
  if (!el) return;
  el.textContent = url ? 'Uploaded.' : 'Not uploaded.';
}

function setBankSlips(slips) {
  const status = document.getElementById('bankSlipsStatus');
  const list = document.getElementById('bankSlipsList');
  if (status) status.textContent = (slips?.length ? `${slips.length} slip(s) uploaded.` : 'No slips uploaded yet.');
  if (!list) return;
  list.innerHTML = (slips || []).map(s => `<li>${escapeHtml(s.url.split('/').pop())}</li>`).join('');
}

async function loadProfile() {
  const me = await api('/api/auth/me', { method: 'GET' });
  const u = me.user || {};

  document.getElementById('companyName').value = u.profile?.companyName || '';
  document.getElementById('legalName').value = u.profile?.legalName || '';
  document.getElementById('idNumber').value = u.profile?.idNumber || '';
  document.getElementById('postalAddress').value = u.profile?.postalAddress || '';
  document.getElementById('deliveryDetails').value = u.profile?.deliveryDetails || '';

  // These already exist on user
  document.getElementById('country').value = u.country || '';
  document.getElementById('mobileNumber').value = u.mobileNumber || '';
  document.getElementById('email').value = u.email || '';

  setPassportStatus(u.profile?.passportUrl);
  setConsigneeStatus(u.uploads?.consigneeDocUrl);
  setPinStatus(u.uploads?.pinDocUrl);
  setBankSlips(u.uploads?.bankSlips || []);

  renderAccountDetails(u.accountDetails || []);
}

async function uploadFile(endpoint, file, fieldName = 'file') {
  const token = getToken();
  const fd = new FormData();
  fd.append(fieldName, file);
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.message || `Upload failed (${res.status})`);
  return data;
}

async function uploadMultiple(endpoint, files, fieldName = 'files') {
  const token = getToken();
  const fd = new FormData();
  Array.from(files).forEach(f => fd.append(fieldName, f));
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.message || `Upload failed (${res.status})`);
  return data;
}

async function saveProfile(e) {
  e.preventDefault();
  clearMsg();

  try {
    // Passport upload if selected
    const passportFile = document.getElementById('passportFile').files?.[0];
    if (passportFile) {
      await uploadFile('/api/profile/upload/passport', passportFile, 'passport');
    }

    const consigneeDoc = document.getElementById('consigneeDoc').files?.[0];
    if (consigneeDoc) {
      await uploadFile('/api/profile/upload/consignee', consigneeDoc, 'consignee');
    }

    const pinDoc = document.getElementById('pinDoc').files?.[0];
    if (pinDoc) {
      await uploadFile('/api/profile/upload/pin', pinDoc, 'pin');
    }

    const slips = document.getElementById('bankSlips').files;
    if (slips && slips.length) {
      await uploadMultiple('/api/profile/upload/bank-slips', slips, 'slips');
    }

    const payload = {
      country: document.getElementById('country').value.trim(),
      mobileNumber: document.getElementById('mobileNumber').value.trim(),
      email: document.getElementById('email').value.trim(),
      profile: {
        companyName: document.getElementById('companyName').value.trim(),
        legalName: document.getElementById('legalName').value.trim(),
        idNumber: document.getElementById('idNumber').value.trim(),
        postalAddress: document.getElementById('postalAddress').value.trim(),
        deliveryDetails: document.getElementById('deliveryDetails').value.trim()
      },
      newPassword: document.getElementById('newPassword').value
    };

    await api('/api/auth/update-profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setMsg('Profile saved successfully.', 'success');
    document.getElementById('newPassword').value = '';
    document.getElementById('passportFile').value = '';
    document.getElementById('bankSlips').value = '';
    document.getElementById('consigneeDoc').value = '';
    document.getElementById('pinDoc').value = '';
    await loadProfile();
  } catch (err) {
    setMsg(err.message || 'Failed to save profile', 'error');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('profileForm');
  if (form) form.addEventListener('submit', saveProfile);
  try {
    await loadProfile();
  } catch (err) {
    setMsg(err.message || 'Failed to load profile', 'error');
  }
});

