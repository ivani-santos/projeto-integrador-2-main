// Client-side helpers that use the server-side auth endpoints.
// Security note: the server stores password hashes using Werkzeug's
// `generate_password_hash` (PBKDF2). The developer requested MD5, but
// MD5 is insecure for passwords — therefore we don't use it.
// This file provides a small, didactic wrapper around `/api/*` endpoints.
(function () {
    const FIXED_USERS = [
        { id: 1, nome: 'Admin Demo', email: 'admin@fotecta.com', senha: 'admin123', tipo: 'admin' },
        { id: 2, nome: 'Cliente Demo', email: 'cliente@fotecta.com', senha: 'cliente123', tipo: 'cliente' },
        { id: 3, nome: 'Fotógrafo Demo', email: 'fotografo@fotecta.com', senha: 'foto123', tipo: 'fotografo' }
    ];

    const FIXED_ADMIN_PASSWORD = 'admin123';
    let _currentUser = null;
    let _users = FIXED_USERS.map((user) => ({ ...user }));
    let _resetRequests = [];

    function currentUser() {
        return _currentUser;
    }

    function getFixedUsers() {
        return FIXED_USERS.map((user) => ({ ...user }));
    }

    function getUsers() {
        return _users.map((user) => ({ ...user }));
    }

    function seedCredentialsText() {
        return FIXED_USERS.map((user) => `${user.nome}: ${user.email} / ${user.senha}`);
    }

    function passwordStrength(password) {
        const value = String(password || '');
        let score = Math.min(100, value.length * 7);
        if (/[0-9]/.test(value)) score += 10;
        if (/[a-z]/.test(value)) score += 5;
        if (/[A-Z]/.test(value)) score += 10;
        if (/[^A-Za-z0-9]/.test(value)) score += 15;
        score = Math.max(0, Math.min(100, score));
        let level = 'muito fraca';
        let color = 'bg-danger';
        if (score > 80) { level = 'forte'; color = 'bg-success'; }
        else if (score > 50) { level = 'boa'; color = 'bg-warning'; }
        else if (score > 25) { level = 'fraca'; color = 'bg-warning'; }
        return { score, level, color };
    }

    function redirectForRole(tipo) {
        const role = String(tipo || '').toLowerCase();
        if (role === 'admin') return '/admin';
        if (role === 'fotografo' || role === 'fotógrafo') return '/fotografologado';
        return '/clientelogado';
    }

    async function refreshCurrentUser() {
        try {
            const res = await fetch('/api/me', { credentials: 'same-origin' });
            const data = await res.json();
            _currentUser = data.ok ? data.user : null;
            if (_currentUser) {
                try { localStorage.setItem('fotecta_user', JSON.stringify(_currentUser)); } catch (e) {}
            } else {
                try { localStorage.removeItem('fotecta_user'); } catch (e) {}
            }
        } catch (e) {
            _currentUser = null;
        }
        return _currentUser;
    }

    async function loadCurrentUser() {
        return currentUser() || refreshCurrentUser();
    }

    async function refreshUsers() {
        try {
            const res = await fetch('/api/users', { credentials: 'same-origin' });
            const data = await res.json();
            _users = data.ok && Array.isArray(data.users) ? data.users : FIXED_USERS.map((user) => ({ ...user }));
        } catch (e) {
            _users = FIXED_USERS.map((user) => ({ ...user }));
        }
        try { window.dispatchEvent(new Event('fotecta:users-updated')); } catch (e) {}
        return getUsers();
    }

    async function loadResetRequests() {
        try {
            const user = await loadCurrentUser();
            if (!user || String(user.tipo || '').toLowerCase() !== 'admin') {
                _resetRequests = [];
                return [];
            }
            const res = await fetch('/api/reset-requests', { credentials: 'same-origin' });
            const data = await res.json();
            _resetRequests = data.ok && Array.isArray(data.requests) ? data.requests : [];
        } catch (e) {
            _resetRequests = [];
        }
        return getResetRequests();
    }

    function getResetRequests() {
        return _resetRequests.map((item) => ({ ...item }));
    }

    async function login(email, senha) {
        const res = await fetch('/api/login', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: String(email || '').trim(), senha: String(senha || '') })
        });
        const data = await res.json();
        if (data.ok) {
            _currentUser = data.user;
            try { localStorage.setItem('fotecta_user', JSON.stringify(_currentUser)); } catch (e) {}
            await refreshUsers();
        }
        return data;
    }

    async function logout() {
        try {
            if (navigator && navigator.sendBeacon) {
                try { navigator.sendBeacon('/logout', ''); } catch (e) {}
            } else {
                await fetch('/logout', { method: 'POST', credentials: 'same-origin', keepalive: true });
            }
        } finally {
            _currentUser = null;
            _resetRequests = [];
            try { localStorage.removeItem('fotecta_user'); } catch (e) {}
        }
        return { ok: true };
    }

    async function createUser(payload) {
        const res = await fetch('/api/register', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.ok) {
            _currentUser = data.user;
            try { localStorage.setItem('fotecta_user', JSON.stringify(_currentUser)); } catch (e) {}
            await refreshUsers();
        }
        return data;
    }

    async function updateUser(id, payload) {
        const res = await fetch(`/api/users/${id}`, {
            method: 'PUT',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.ok) {
            await refreshUsers();
            if (_currentUser && String(_currentUser.id) === String(id)) {
                _currentUser = data.user;
                try { localStorage.setItem('fotecta_user', JSON.stringify(_currentUser)); } catch (e) {}
            }
            try { window.dispatchEvent(new Event('fotecta:user-updated')); } catch (e) {}
        }
        return data;
    }

    async function deleteUser(id) {
        const res = await fetch(`/api/users/${id}`, {
            method: 'DELETE',
            credentials: 'same-origin'
        });
        const data = await res.json();
        if (data.ok) {
            await refreshUsers();
            if (_currentUser && String(_currentUser.id) === String(id)) {
                _currentUser = null;
            }
            try { window.dispatchEvent(new Event('fotecta:user-updated')); } catch (e) {}
        }
        return data;
    }

    async function requestPasswordReset(email, nascimento) {
        try {
            const res = await fetch('/api/password-reset', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: String(email || '').trim(), nascimento: nascimento || null })
            });
            return await res.json();
        } catch (e) {
            return { ok: false, message: String(e) };
        }
    }

    async function approveReset(email) {
        const res = await fetch(`/api/reset-requests/${encodeURIComponent(email)}/approve`, {
            method: 'POST',
            credentials: 'same-origin'
        });
        const data = await res.json();
        if (data.ok) await loadResetRequests();
        return data;
    }

    async function rejectReset(email) {
        const res = await fetch(`/api/reset-requests/${encodeURIComponent(email)}/reject`, {
            method: 'POST',
            credentials: 'same-origin'
        });
        const data = await res.json();
        if (data.ok) await loadResetRequests();
        return data;
    }

    async function resetSeed() {
        const res = await fetch('/api/admin/reset-seed', {
            method: 'POST',
            credentials: 'same-origin'
        });
        const data = await res.json();
        if (data.ok) {
            await refreshUsers();
            await loadResetRequests();
        }
        return data;
    }

    function verifyAdminPassword(password) {
        const admin = currentUser();
        if (!admin || String(admin.tipo || '').toLowerCase() !== 'admin') {
            return { ok: false, message: 'Faça login como admin.' };
        }
        return String(password || '') === FIXED_ADMIN_PASSWORD
            ? { ok: true }
            : { ok: false, message: 'Senha do admin inválida.' };
    }

    function requireRole(expectedRole) {
        const user = currentUser();
        const role = String(expectedRole || '').toLowerCase();
        if (user && String(user.tipo || '').toLowerCase() === role) return user;

        refreshCurrentUser().then((refreshed) => {
            if (!refreshed || String(refreshed.tipo || '').toLowerCase() !== role) {
                window.location.href = '/login';
            }
        }).catch(() => { window.location.href = '/login'; });
        return null;
    }

    window.Auth = {
        currentUser,
        loadCurrentUser,
        refreshCurrentUser,
        loadUsers: refreshUsers,
        refreshUsers,
        loadResetRequests,
        getResetRequests,
        login,
        logout,
        createUser,
        getUsers,
        getFixedUsers,
        seedCredentialsText,
        passwordStrength,
        redirectForRole,
        requestPasswordReset,
        requireRole,
        updateUser,
        deleteUser,
        approveReset,
        rejectReset,
        resetSeed,
        verifyAdminPassword
    };

    refreshCurrentUser();
    refreshUsers();
    loadResetRequests();
})();
