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

/** Safe in-app path only (prevents open redirects). */
function getPostAuthRedirectUrl() {
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next');
  if (!next || typeof next !== 'string') return null;
  const trimmed = next.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null;
  const lower = trimmed.toLowerCase();
  if (lower.includes('javascript:') || lower.includes('data:')) return null;
  return trimmed;
}

function preserveNextOnAuthSwitchLinks() {
  const q = window.location.search;
  if (!q) return;
  const reg = document.getElementById('linkToRegister');
  const log = document.getElementById('linkToLogin');
  if (reg) reg.setAttribute('href', `/register${q}`);
  if (log) log.setAttribute('href', `/login${q}`);
}

function saveSession(token, user) {
  localStorage.setItem('tronex_token', token);
  localStorage.setItem('tronex_user', JSON.stringify(user || {}));
  // Also store token as a cookie so server-rendered pages (e.g. /payment/:id) can be protected.
  // Note: this is not HttpOnly (set from browser JS), but it's sufficient for simple gating.
  try {
    const maxAge = 60 * 60 * 24 * 7; // 7 days
    document.cookie = `tronex_token=${encodeURIComponent(token)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
  } catch (_) {}
}

async function registerFlow(e) {
  e.preventDefault();
  clearMsg();

  const btn = document.getElementById('btnRegister');
  if (btn) btn.disabled = true;

  try {
    const payload = {
      firstName: document.getElementById('firstName').value.trim(),
      lastName: document.getElementById('lastName').value.trim(),
      email: document.getElementById('email').value.trim(),
      mobileNumber: document.getElementById('mobileNumber').value.trim(),
      address: (document.getElementById('address').value || '').trim(),
      city: (document.getElementById('city').value || '').trim(),
      country: (document.getElementById('country').value || '').trim(),
      password: document.getElementById('password').value,
      passwordConfirm: document.getElementById('passwordConfirm').value
    };

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!data.success) {
      setMsg(data.message || 'Registration failed', 'error');
      return;
    }

    saveSession(data.token, data.user);
    setMsg('Registration successful. Redirecting…', 'success');
    setTimeout(() => {
      const dest = getPostAuthRedirectUrl() || '/my-profile';
      window.location.href = dest;
    }, 600);
  } catch (err) {
    setMsg(err.message || 'Registration failed', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function loginFlow(e) {
  e.preventDefault();
  clearMsg();

  const btn = document.getElementById('btnLogin');
  if (btn) btn.disabled = true;

  try {
    const loginForm = document.getElementById('loginForm');
    const payload = {
      email: document.getElementById('email').value.trim(),
      password: document.getElementById('password').value
    };

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!data.success) {
      setMsg(data.message || 'Login failed', 'error');
      return;
    }

    saveSession(data.token, data.user);
    if (loginForm) loginForm.reset();
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    if (emailInput) emailInput.value = '';
    if (passwordInput) passwordInput.value = '';
    setMsg('Login successful. Redirecting…', 'success');
    setTimeout(() => {
      const dest = getPostAuthRedirectUrl() || '/';
      window.location.href = dest;
    }, 500);
  } catch (err) {
    setMsg(err.message || 'Login failed', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  preserveNextOnAuthSwitchLinks();
  const page = window.__AUTH_PAGE__;
  if (page === 'register') {
    const form = document.getElementById('registerForm');
    if (form) form.addEventListener('submit', registerFlow);
  }
  if (page === 'login') {
    const form = document.getElementById('loginForm');
    if (form) {
      form.addEventListener('submit', loginFlow);
    }
  }
});

