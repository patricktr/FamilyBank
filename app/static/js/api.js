/**
 * Family Bank - API Client
 */

const API = {
    async request(url, options = {}) {
        const defaults = {
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin'
        };
        const config = { ...defaults, ...options };
        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        const res = await fetch(url, config);
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Something went wrong');
        }
        return data;
    },

    // Auth
    me() { return this.request('/api/auth/me'); },
    logout() { return this.request('/api/auth/logout', { method: 'POST' }); },
    changePassword(current, newPass) {
        return this.request('/api/auth/change-password', {
            method: 'POST',
            body: { current_password: current, new_password: newPass }
        });
    },

    // Accounts
    getAccounts() { return this.request('/api/accounts'); },
    getTransactions(accountId, limit = 50) {
        return this.request(`/api/accounts/${accountId}/transactions?limit=${limit}`);
    },

    // Transactions
    deposit(toAccountId, amount, category, description) {
        return this.request('/api/transactions/deposit', {
            method: 'POST',
            body: { to_account_id: toAccountId, amount, category, description }
        });
    },
    withdraw(fromAccountId, amount, category, description) {
        return this.request('/api/transactions/withdraw', {
            method: 'POST',
            body: { from_account_id: fromAccountId, amount, category, description }
        });
    },
    transfer(fromAccountId, toAccountId, amount, description) {
        return this.request('/api/transactions/transfer', {
            method: 'POST',
            body: { from_account_id: fromAccountId, to_account_id: toAccountId, amount, description }
        });
    },

    // Approvals
    getPending() { return this.request('/api/transactions/pending'); },
    approve(txnId) { return this.request(`/api/transactions/${txnId}/approve`, { method: 'POST' }); },
    reject(txnId, reason) {
        return this.request(`/api/transactions/${txnId}/reject`, {
            method: 'POST', body: { reason }
        });
    },

    // Admin
    getUsers() { return this.request('/api/admin/users'); },
    createUser(data) { return this.request('/api/admin/users', { method: 'POST', body: data }); },
    updateUser(userId, data) {
        return this.request(`/api/admin/users/${userId}`, { method: 'PUT', body: data });
    },
    deleteUser(userId) {
        return this.request(`/api/admin/users/${userId}`, { method: 'DELETE' });
    },

    // Allowances
    getAllowances() { return this.request('/api/admin/allowances'); },
    updateAllowance(id, data) {
        return this.request(`/api/admin/allowances/${id}`, { method: 'PUT', body: data });
    },

    // Interest
    getInterest() { return this.request('/api/admin/interest'); },
    updateInterest(id, data) {
        return this.request(`/api/admin/interest/${id}`, { method: 'PUT', body: data });
    },

    // Settings
    getSettings() { return this.request('/api/admin/settings'); },
    updateSettings(data) {
        return this.request('/api/admin/settings', { method: 'PUT', body: data });
    },

    // Categories
    getCategories() { return this.request('/api/categories'); },

    // Dashboard
    getDashboard() { return this.request('/api/dashboard'); },
};
