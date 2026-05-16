/**
 * Adds show/hide toggle to all password inputs on the page.
 */
(function () {
    function usesFontAwesome() {
        return Boolean(document.querySelector('link[href*="font-awesome"]'));
    }

    function setButtonContent(btn, visible) {
        if (usesFontAwesome()) {
            btn.innerHTML = visible
                ? '<i class="fa-regular fa-eye-slash" aria-hidden="true"></i>'
                : '<i class="fa-regular fa-eye" aria-hidden="true"></i>';
            return;
        }
        btn.innerHTML = visible
            ? '<span class="pw-toggle-label">Hide</span>'
            : '<span class="pw-toggle-label">Show</span>';
    }

    function enhance(input) {
        if (!(input instanceof HTMLInputElement)) return;
        if (input.type !== 'password') return;
        if (input.dataset.passwordToggle === 'off') return;
        if (input.closest('.password-field')) return;

        const wrap = document.createElement('div');
        wrap.className = 'password-field';

        const parent = input.parentNode;
        if (!parent) return;

        parent.insertBefore(wrap, input);
        wrap.appendChild(input);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'password-toggle-btn';
        btn.setAttribute('aria-label', 'Show password');
        btn.setAttribute('aria-pressed', 'false');
        setButtonContent(btn, false);

        btn.addEventListener('click', function () {
            const showing = input.type === 'password';
            input.type = showing ? 'text' : 'password';
            btn.setAttribute('aria-pressed', showing ? 'true' : 'false');
            btn.setAttribute('aria-label', showing ? 'Hide password' : 'Show password');
            setButtonContent(btn, showing);
        });

        wrap.appendChild(btn);
    }

    function init() {
        document.querySelectorAll('input[type="password"]').forEach(enhance);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
