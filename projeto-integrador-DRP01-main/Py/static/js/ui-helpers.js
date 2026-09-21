(function () {
    // Escapa texto para evitar injeção de HTML em templates dinâmicos.
    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Evita chamadas em excesso (ex.: campo de busca digitando rápido).
    function debounce(fn, wait) {
        let timer = null;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), wait || 250);
        };
    }

    function formatDateBR(dateValue) {
        const raw = String(dateValue || '');
        if (!raw.includes('-')) return raw || '-';
        const [year, month, day] = raw.split('-');
        if (!year || !month || !day) return raw;
        return `${day}/${month}/${year}`;
    }

    function maskPassword(password) {
        const len = String(password || '').length;
        if (len <= 0) return '••••••';
        return '•'.repeat(Math.min(Math.max(len, 6), 12));
    }

    function renderStars(score) {
        const note = Number.isFinite(Number(score)) ? Number(score) : 5;
        const count = Math.min(Math.max(Math.round(note), 1), 5);
        return '⭐'.repeat(count);
    }

    function isFixedUserId(userId) {
        return ['u-admin', 'u-cliente', 'u-fotografo'].includes(String(userId || ''));
    }

    window.UIHelpers = {
        escapeHtml,
        debounce,
        formatDateBR,
        maskPassword,
        renderStars,
        isFixedUserId
    };
})();

// Tooltip + i18n helpers (concise, reusable)
(function () {
    function getI18n(locale) {
        const dict = (window.FotectaI18N && window.FotectaI18N.pt) ? window.FotectaI18N.pt : { favorite: 'Favoritar', unfavorite: 'Remover dos favoritos', cannot_favorite_self: 'Você não pode favoritar seu próprio perfil' };
        return dict;
    }

    function initTooltips(opts = {}) {
        const selector = '[data-bs-toggle="tooltip"]';
        const elements = Array.from(document.querySelectorAll(selector));
        elements.forEach(el => {
            // dispose existing
            try { const existing = bootstrap.Tooltip.getInstance(el); if (existing) existing.dispose(); } catch (e) {}
            const placement = (window.innerWidth <= 576) ? 'top' : (el.getAttribute('data-bs-placement') || opts.placement || 'left');
            const tip = new bootstrap.Tooltip(el, { container: 'body', trigger: 'hover focus', placement });
            // accessibility helper
            const msg = el.getAttribute('title') || '';
            const hid = 'tt-' + Math.random().toString(36).slice(2,8);
            const span = document.createElement('span'); span.id = hid; span.className = 'visually-hidden'; span.textContent = msg;
            if (el.parentNode) el.parentNode.insertBefore(span, el.nextSibling);
            el.setAttribute('aria-describedby', hid);
            // touch behavior
            let tmo = null;
            el.addEventListener('touchstart', (e) => { e.preventDefault(); tip.show(); if (tmo) clearTimeout(tmo); tmo = setTimeout(()=>{ try{ tip.hide(); }catch{}; tmo=null; }, opts.touchMs || 1500); }, { passive: false });
        });
        window.addEventListener('resize', () => setTimeout(() => initTooltips(opts), 200));
    }

    window.UIHelpers = Object.assign(window.UIHelpers || {}, { getI18n, initTooltips });
})();
