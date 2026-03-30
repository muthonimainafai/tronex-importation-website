function formatMoneyAmount(n) {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getSelectedEarlyDiscount() {
  const checked = document.querySelector('.early-pay-check:checked');
  if (!checked) return 0;
  const amt = Number(checked.dataset.amount);
  return Number.isFinite(amt) ? amt : 0;
}

function updatePaymentTotals() {
  const root = document.getElementById('paymentPageRoot');
  if (!root) return;

  const base = Number(root.dataset.baseTotal || 0);
  const currency = root.dataset.currency || 'KES';
  const early = getSelectedEarlyDiscount();
  const finalTotal = Math.max(0, base - early);

  const heroTotal = document.getElementById('payDisplayTotal');
  const vehTotal = document.getElementById('payVehicleTotal');
  if (heroTotal) heroTotal.textContent = formatMoneyAmount(finalTotal);
  if (vehTotal) vehTotal.textContent = formatMoneyAmount(finalTotal);

  const note = document.getElementById('payEarlyHeroNote');
  if (note) {
    if (early > 0) note.removeAttribute('hidden');
    else note.setAttribute('hidden', '');
  }
}

function wireEarlyPaymentChecks() {
  document.querySelectorAll('.early-pay-check').forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.checked) {
        document.querySelectorAll('.early-pay-check').forEach((o) => {
          if (o !== cb) o.checked = false;
        });
      }
      updatePaymentTotals();
    });
  });
}

async function generateInvoiceToEmail(carId) {
  const btn = document.querySelector('.btn-generate-invoice');
  const msgEl = document.getElementById('generateInvoiceMsg');

  if (msgEl) msgEl.textContent = '';
  if (btn) btn.disabled = true;

  try {
    const token = localStorage.getItem('tronex_token');
    if (!token) {
      if (msgEl) msgEl.textContent = 'Please login to generate the invoice.';
      window.location.href = '/login?next=' + encodeURIComponent(`/payment-details/${encodeURIComponent(carId)}`);
      return;
    }

    const earlyPaymentDiscount = getSelectedEarlyDiscount();

    const res = await fetch(`/api/cars/${encodeURIComponent(carId)}/invoice/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ earlyPaymentDiscount })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      const m = data.message || `Failed to generate invoice (${res.status})`;
      if (msgEl) msgEl.textContent = m;
      return;
    }

    if (msgEl) msgEl.textContent = 'Pro-forma invoice generated and emailed successfully.';
  } catch (err) {
    console.error('❌ [Generate invoice error]:', err);
    if (msgEl) msgEl.textContent = 'Error generating invoice. Please try again.';
  } finally {
    if (btn) btn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  wireEarlyPaymentChecks();
  updatePaymentTotals();
});
