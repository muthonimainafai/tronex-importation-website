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

    const res = await fetch(`/api/cars/${encodeURIComponent(carId)}/invoice/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({})
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      const m = data.message || `Failed to generate invoice (${res.status})`;
      if (msgEl) msgEl.textContent = m;
      return;
    }

    if (msgEl) msgEl.textContent = 'Invoice generated and emailed successfully.';
  } catch (err) {
    console.error('❌ [Generate invoice error]:', err);
    if (msgEl) msgEl.textContent = 'Error generating invoice. Please try again.';
  } finally {
    if (btn) btn.disabled = false;
  }
}

