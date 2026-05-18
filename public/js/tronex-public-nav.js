(function () {
    'use strict';

    function updateAuthNav() {
        var token = localStorage.getItem('tronex_token');
        var elRegister = document.getElementById('authNavRegister');
        var elLogin = document.getElementById('authNavLogin');
        var elProfile = document.getElementById('authNavProfile');
        var elLogout = document.getElementById('authNavLogout');

        if (!elRegister || !elLogin || !elProfile || !elLogout) {
            return;
        }

        if (token) {
            elRegister.style.display = 'none';
            elLogin.style.display = 'none';
            elProfile.style.display = 'list-item';
            elLogout.style.display = 'list-item';
        } else {
            elRegister.style.display = 'list-item';
            elLogin.style.display = 'list-item';
            elProfile.style.display = 'none';
            elLogout.style.display = 'none';
        }

        var logoutLink = elLogout.querySelector('a');
        if (logoutLink) {
            logoutLink.onclick = function () {
                localStorage.removeItem('tronex_token');
                localStorage.removeItem('tronex_user');
                try {
                    document.cookie = 'tronex_token=; Max-Age=0; Path=/; SameSite=Lax';
                } catch (_) {}
                updateAuthNav();
                window.location.href = typeof tronexUrl === 'function' ? tronexUrl('/') : '/';
            };
        }
    }

    function setupMobileMenu() {
        var root = document.querySelector('.tronex-public-nav');
        if (!root) {
            return;
        }
        var hamburger = root.querySelector('.hamburger');
        var navMenu = root.querySelector('.nav-menu');
        if (!hamburger || !navMenu) {
            return;
        }

        hamburger.addEventListener('click', function () {
            navMenu.classList.toggle('active');
            hamburger.classList.toggle('active');
        });

        root.querySelectorAll('.nav-link').forEach(function (link) {
            link.addEventListener('click', function () {
                navMenu.classList.remove('active');
                hamburger.classList.remove('active');
            });
        });

        document.addEventListener('click', function (e) {
            if (!e.target.closest('.tronex-public-nav')) {
                navMenu.classList.remove('active');
                hamburger.classList.remove('active');
            }
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        updateAuthNav();
        setupMobileMenu();
    });
})();
