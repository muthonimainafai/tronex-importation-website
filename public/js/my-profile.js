function setMsg(text, type) {
  const el = document.getElementById('msg');
  if (!el) return;
  el.className = `mp-msg ${type}`;
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
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(s) {
  return (s ?? '').toString().replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fileLabel(url) {
  if (!url) return 'Not uploaded';
  const name = url.split('/').pop() || 'file';
  return name.length > 28 ? `${name.slice(0, 25)}…` : name;
}

const SLOT_PATHS = {
  'payment-first': ['uploads', 'paymentSlips', 'first'],
  'payment-second': ['uploads', 'paymentSlips', 'second'],
  'payment-third': ['uploads', 'paymentSlips', 'third'],
  'consignee-id-front': ['uploads', 'consigneeDocs', 'nationalIdFront'],
  'consignee-id-back': ['uploads', 'consigneeDocs', 'nationalIdBack'],
  'consignee-coi': ['uploads', 'consigneeDocs', 'certificateOfIncorporation'],
  'consignee-business-reg': ['uploads', 'consigneeDocs', 'businessRegistration'],
  'consignee-passport': ['uploads', 'consigneeDocs', 'passport'],
  'consignee-alien': ['uploads', 'consigneeDocs', 'alienId'],
  'consignee-military-front': ['uploads', 'consigneeDocs', 'militaryFront'],
  'consignee-military-back': ['uploads', 'consigneeDocs', 'militaryBack'],
  'consignee-diplomat': ['uploads', 'consigneeDocs', 'diplomatId'],
  'pin-personal': ['uploads', 'pinDocs', 'personalPin'],
  'pin-company': ['uploads', 'pinDocs', 'companyPin'],
  'pin-business': ['uploads', 'pinDocs', 'businessNamePin'],
  'pin-non-resident': ['uploads', 'pinDocs', 'nonResidentPin'],
  'other-1': ['uploads', 'otherUploads', 'slot1'],
  'other-2': ['uploads', 'otherUploads', 'slot2'],
  logbook: ['uploads', 'logbookCopyUrl'],
  'inquiry-attach': ['profile', 'inquiryAttachmentUrl']
};

function getNested(obj, keys) {
  return keys.reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

function setSlotStatuses(u) {
  Object.keys(SLOT_PATHS).forEach((slot) => {
    const url = getNested(u, SLOT_PATHS[slot]);
    const els = document.querySelectorAll(`[data-slot-status="${slot}"]`);
    els.forEach((el) => {
      el.textContent = url ? `✓ ${fileLabel(url)}` : 'Not uploaded';
    });
  });
}

function renderAccountDetails(rows) {
  const tbody = document.getElementById('accountRows');
  if (!tbody) return;
  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="padding:20px;text-align:center;color:#64748b">No account records yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(r.carStockNo || '')}</td>
        <td class="num">${fmtMoney(r.priceSoldKsh)}</td>
        <td>${escapeHtml(fmtDate(r.receiveDate))}</td>
        <td class="num">${fmtMoney(r.firstPayment)}</td>
        <td class="num">${fmtMoney(r.secondPayment)}</td>
        <td class="num">${fmtMoney(r.thirdPayment)}</td>
        <td class="num">${fmtMoney(r.discountApplied)}</td>
        <td class="num"><strong>${fmtMoney(r.balance)}</strong></td>
      </tr>
    `
    )
    .join('');
}

function setPassportUi(url) {
  const status = document.getElementById('passportStatus');
  const img = document.getElementById('passportPreview');
  const ph = document.getElementById('photoPlaceholder');
  if (status) status.textContent = url ? 'Document on file.' : 'No passport uploaded yet.';
  if (!img || !ph) return;

  const showPlaceholder = (html) => {
    img.style.display = 'none';
    ph.style.display = 'block';
    ph.innerHTML = html || 'Photo<br><small>from passport</small>';
  };

  if (!url) {
    showPlaceholder('Photo<br><small>from passport</small>');
    return;
  }

  // Explicit PDF handling.
  if (/\.pdf($|\?)/i.test(url)) {
    showPlaceholder('PDF<br><small>on file</small>');
    return;
  }

  // Try to render as image regardless of extension.
  const cacheBustedUrl = url.includes('?') ? `${url}&v=${Date.now()}` : `${url}?v=${Date.now()}`;
  img.onload = () => {
    ph.style.display = 'none';
    img.style.display = 'block';
    ph.innerHTML = 'Photo<br><small>from passport</small>';
  };
  img.onerror = () => {
    showPlaceholder('Document<br><small>on file</small>');
  };
  img.src = cacheBustedUrl;
}

function setLegacyStatus(id, url, yes, no) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = url ? yes : no;
}

async function uploadSlot(slot, file) {
  const token = getToken();
  const fd = new FormData();
  fd.append('slot', slot);
  fd.append('file', file);
  const res = await fetch('/api/profile/upload-slot', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.message || `Upload failed (${res.status})`);
  return data;
}

async function uploadFile(endpoint, file, fieldName) {
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

async function uploadMultiple(endpoint, files, fieldName) {
  const token = getToken();
  const fd = new FormData();
  Array.from(files).forEach((f) => fd.append(fieldName, f));
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.message || `Upload failed (${res.status})`);
  return data;
}

async function loadProfile() {
  const me = await api('/api/auth/me', { method: 'GET' });
  const u = me.user || {};

  document.getElementById('companyName').value = u.profile?.companyName || '';
  document.getElementById('legalName').value = u.profile?.legalName || '';
  document.getElementById('idNumber').value = u.profile?.idNumber || '';
  document.getElementById('postalAddress').value = u.profile?.postalAddress || '';
  document.getElementById('deliveryDetails').value = u.profile?.deliveryDetails || '';
  document.getElementById('secondaryMobile').value = u.profile?.secondaryMobile || '';
  document.getElementById('displayUsername').value = u.profile?.displayUsername || '';
  document.getElementById('country').value = u.country || '';
  document.getElementById('mobileNumber').value = u.mobileNumber || '';
  document.getElementById('email').value = u.email || '';
  document.getElementById('firstName').value = u.firstName || '';
  document.getElementById('lastName').value = u.lastName || '';

  const rep = u.profile?.representative || {};
  document.getElementById('repName').value = rep.name || '';
  document.getElementById('repIdNo').value = rep.idNo || '';
  document.getElementById('repMobile').value = rep.mobile || '';
  document.getElementById('repCity').value = rep.cityTown || '';

  document.getElementById('inquiryMessage').value = u.profile?.inquiryMessage || '';

  setPassportUi(u.profile?.passportUrl);
  setLegacyStatus('consigneeStatus', u.uploads?.consigneeDocUrl, 'Uploaded.', 'Not uploaded.');
  setLegacyStatus('pinStatus', u.uploads?.pinDocUrl, 'Uploaded.', 'Not uploaded.');

  setSlotStatuses(u);

  const slips = u.uploads?.bankSlips || [];
  const st = document.getElementById('bankSlipsStatus');
  const list = document.getElementById('bankSlipsList');
  if (st) st.textContent = slips.length ? `${slips.length} additional file(s) on record.` : 'No additional slips yet.';
  if (list) {
    list.innerHTML = slips.map((s) => `<li>${escapeHtml(fileLabel(s.url))}</li>`).join('');
  }

  renderAccountDetails(u.accountDetails || []);
}

async function saveProfile(e) {
  e.preventDefault();
  clearMsg();

  try {
    const passportFile = document.getElementById('passportFile').files?.[0];
    if (passportFile) await uploadFile('/api/profile/upload/passport', passportFile, 'passport');

    const consigneeDoc = document.getElementById('consigneeDoc').files?.[0];
    if (consigneeDoc) await uploadFile('/api/profile/upload/consignee', consigneeDoc, 'consignee');

    const pinDoc = document.getElementById('pinDoc').files?.[0];
    if (pinDoc) await uploadFile('/api/profile/upload/pin', pinDoc, 'pin');

    const extra = document.getElementById('bankSlipsExtra').files;
    if (extra && extra.length) await uploadMultiple('/api/profile/upload/bank-slips', extra, 'slips');

    const payload = {
      firstName: document.getElementById('firstName').value.trim(),
      lastName: document.getElementById('lastName').value.trim(),
      country: document.getElementById('country').value.trim(),
      mobileNumber: document.getElementById('mobileNumber').value.trim(),
      email: document.getElementById('email').value.trim(),
      profile: {
        companyName: document.getElementById('companyName').value.trim(),
        legalName: document.getElementById('legalName').value.trim(),
        idNumber: document.getElementById('idNumber').value.trim(),
        postalAddress: document.getElementById('postalAddress').value.trim(),
        deliveryDetails: document.getElementById('deliveryDetails').value.trim(),
        secondaryMobile: document.getElementById('secondaryMobile').value.trim(),
        displayUsername: document.getElementById('displayUsername').value.trim(),
        inquiryMessage: document.getElementById('inquiryMessage').value.trim(),
        representative: {
          name: document.getElementById('repName').value.trim(),
          idNo: document.getElementById('repIdNo').value.trim(),
          mobile: document.getElementById('repMobile').value.trim(),
          cityTown: document.getElementById('repCity').value.trim()
        }
      },
      newPassword: document.getElementById('newPassword').value
    };

    await api('/api/auth/update-profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    setMsg('Profile saved successfully.', 'success');
    document.getElementById('newPassword').value = '';
    document.getElementById('passportFile').value = '';
    document.getElementById('bankSlipsExtra').value = '';
    document.getElementById('consigneeDoc').value = '';
    document.getElementById('pinDoc').value = '';
    document.querySelectorAll('input[data-slot]').forEach((inp) => {
      inp.value = '';
    });
    await loadProfile();
  } catch (err) {
    setMsg(err.message || 'Failed to save profile', 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.mp-edit[data-focus]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-focus');
      const el = document.getElementById(id);
      if (el) {
        el.focus();
        el.select?.();
      }
    });
  });

  document.querySelectorAll('input[data-slot]').forEach((input) => {
    input.addEventListener('change', async () => {
      const slot = input.getAttribute('data-slot');
      const file = input.files?.[0];
      if (!slot || !file) return;
      clearMsg();
      try {
        await uploadSlot(slot, file);
        setMsg(`Uploaded (${slot}).`, 'success');
        await loadProfile();
      } catch (err) {
        setMsg(err.message || 'Upload failed', 'error');
      }
      input.value = '';
    });
  });

  const passportInput = document.getElementById('passportFile');
  if (passportInput) {
    passportInput.addEventListener('change', () => {
      const file = passportInput.files?.[0];
      if (!file) return;
      const status = document.getElementById('passportStatus');
      const img = document.getElementById('passportPreview');
      const ph = document.getElementById('photoPlaceholder');
      if (status) status.textContent = 'Selected. Click "Save profile & updates" to upload.';
      if (img && ph && file.type.startsWith('image/')) {
        img.src = URL.createObjectURL(file);
        img.style.display = 'block';
        ph.style.display = 'none';
      }
    });
  }

  const form = document.getElementById('profileForm');
  if (form) form.addEventListener('submit', saveProfile);

  (async () => {
    try {
      await loadProfile();
    } catch (err) {
      setMsg(err.message || 'Failed to load profile', 'error');
    }
  })();
});
