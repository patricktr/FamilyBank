/**
 * Family Bank - Main Application
 */

let currentUser = null;
let currentView = 'dashboard';
let allAccounts = [];
let categories = [];

// ── Init ──────────────────────────────────────────────────────

async function init() {
    try {
        currentUser = await API.me();
        categories = await API.getCategories();

        // kidsCanManageAccounts is now included in currentUser from API.me() for kids

        setupSidebar();
        setupMobile();
        setupLogout();
        navigateTo('dashboard');
    } catch (e) {
        window.location.href = '/login';
    }
}

// ── Navigation ────────────────────────────────────────────────

function setupSidebar() {
    const nav = document.getElementById('sidebar-nav');
    const avatar = document.getElementById('user-avatar');
    const mobileAvatar = document.getElementById('mobile-avatar');
    const initial = currentUser.display_name.charAt(0).toUpperCase();
    const color = currentUser.avatar_color || '#6366f1';

    avatar.textContent = initial;
    avatar.style.background = color;
    mobileAvatar.textContent = initial;
    mobileAvatar.style.background = color;

    document.getElementById('user-name').textContent = currentUser.display_name;
    document.getElementById('user-role').textContent = currentUser.role === 'parent' ? '👑 Parent' : '⭐ Kid';

    let navHTML = '';

    if (currentUser.role === 'parent') {
        navHTML = `
            <div class="nav-item active" data-view="dashboard">
                <span class="nav-icon">📊</span> Dashboard
            </div>
            <div class="nav-item" data-view="approvals">
                <span class="nav-icon">✅</span> Approvals
                <span class="nav-badge" id="pending-badge" style="display:none">0</span>
            </div>
            <div class="nav-section-title">Manage</div>
            <div class="nav-item" data-view="deposit">
                <span class="nav-icon">💵</span> Deposit Money
            </div>
            <div class="nav-item" data-view="users">
                <span class="nav-icon">👨‍👧‍👦</span> Family Members
            </div>
            <div class="nav-item" data-view="manage-accounts">
                <span class="nav-icon">💳</span> Manage Accounts
            </div>
            <div class="nav-item" data-view="allowances">
                <span class="nav-icon">📅</span> Allowances
            </div>
            <div class="nav-item" data-view="interest">
                <span class="nav-icon">📈</span> Interest Rates
            </div>
            <div class="nav-item" data-view="settings">
                <span class="nav-icon">⚙️</span> Settings
            </div>
        `;
    } else {
        navHTML = `
            <div class="nav-item active" data-view="dashboard">
                <span class="nav-icon">🏠</span> My Accounts
            </div>
            ${currentUser.kidsCanManageAccounts ? `
            <div class="nav-item" data-view="my-accounts">
                <span class="nav-icon">💳</span> Manage Accounts
            </div>
            ` : ''}
            <div class="nav-item" data-view="withdraw">
                <span class="nav-icon">💸</span> Withdraw
            </div>
            <div class="nav-item" data-view="kid-transfer">
                <span class="nav-icon">🔄</span> Transfer
            </div>
            <div class="nav-item" data-view="history">
                <span class="nav-icon">📜</span> History
            </div>
        `;
    }

    nav.innerHTML = navHTML;

    nav.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            nav.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            navigateTo(item.dataset.view);
            closeMobileSidebar();
        });
    });
}

function navigateTo(view) {
    currentView = view;
    const main = document.getElementById('main-content');
    main.innerHTML = '<div class="loading-screen"><div class="spinner"></div></div>';

    const views = {
        'dashboard': currentUser.role === 'parent' ? renderParentDashboard : renderKidDashboard,
        'approvals': renderApprovals,
        'deposit': renderDeposit,
        'users': renderUsers,
        'manage-accounts': renderManageAccounts,
        'allowances': renderAllowancesWithSplits,
        'interest': renderInterest,
        'settings': renderSettings,
        'withdraw': renderWithdraw,
        'kid-transfer': renderKidTransfer,
        'my-accounts': renderKidManageAccounts,
        'history': renderHistory,
    };

    const renderer = views[view];
    if (renderer) renderer();
}

// ── Mobile ────────────────────────────────────────────────────

function setupMobile() {
    document.getElementById('hamburger').addEventListener('click', () => {
        document.getElementById('sidebar').classList.add('open');
        document.getElementById('sidebar-overlay').classList.add('active');
    });

    document.getElementById('sidebar-overlay').addEventListener('click', closeMobileSidebar);
}

function closeMobileSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');
}

function setupLogout() {
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await API.logout();
        window.location.href = '/login';
    });
}

// ── Helpers ───────────────────────────────────────────────────

function $(amount) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function timeAgo(dateStr) {
    const date = new Date(dateStr + (dateStr.includes('Z') ? '' : 'Z'));
    const now = new Date();
    const diffMs = now - date;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function txnIcon(type) {
    const icons = {
        deposit: '💵', withdrawal: '💸', transfer: '🔄',
        allowance: '📅', interest: '📈', parent_deposit: '🏦'
    };
    return icons[type] || '💰';
}

function categorySelect(selected = 'General') {
    return categories.map(c =>
        `<option value="${c.name}" ${c.name === selected ? 'selected' : ''}>${c.icon} ${c.name}</option>`
    ).join('');
}

function formatAccountName(account) {
    const nickname = account.nickname || account.account_type;
    const defaultBadge = account.is_default ? ' ⭐' : '';
    return `${nickname}${defaultBadge}`;
}

function toast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type] || ''}</span> ${message}`;
    container.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 4000);
}

function showModal(title, bodyHTML) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    document.getElementById('modal-backdrop').style.display = 'flex';

    document.getElementById('modal-close').onclick = closeModal;
    document.getElementById('modal-backdrop').onclick = (e) => {
        if (e.target === document.getElementById('modal-backdrop')) closeModal();
    };
}

function closeModal() {
    document.getElementById('modal-backdrop').style.display = 'none';
}

// ── Parent Dashboard ──────────────────────────────────────────

async function renderParentDashboard() {
    const main = document.getElementById('main-content');
    try {
        const [dashboard, accounts] = await Promise.all([
            API.getDashboard(),
            API.getAccounts()
        ]);
        allAccounts = accounts;

        // Update pending badge
        const badge = document.getElementById('pending-badge');
        if (badge) {
            if (dashboard.pending_approvals > 0) {
                badge.textContent = dashboard.pending_approvals;
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }

        let html = `
            <div class="page-header">
                <h1 class="page-title">Dashboard</h1>
                <p class="page-subtitle">Overview of all family accounts</p>
            </div>
        `;

        if (dashboard.pending_approvals > 0) {
            html += `
                <div class="card mb-6" style="border: 2px solid var(--yellow); background: var(--yellow-bg);">
                    <div class="flex-between">
                        <div>
                            <strong>⚠️ ${dashboard.pending_approvals} pending approval${dashboard.pending_approvals > 1 ? 's' : ''}</strong>
                            <div class="text-secondary" style="font-size:13px;margin-top:2px;">Withdrawal requests waiting for review</div>
                        </div>
                        <button class="btn btn-primary btn-sm" onclick="document.querySelector('[data-view=approvals]').click()">Review</button>
                    </div>
                </div>
            `;
        }

        if (dashboard.kids.length === 0) {
            html += `
                <div class="empty-state">
                    <div class="empty-icon">👨‍👧‍👦</div>
                    <div class="empty-text">No kids added yet. Add family members to get started!</div>
                    <button class="btn btn-primary" onclick="document.querySelector('[data-view=users]').click()">Add a Kid</button>
                </div>
            `;
        } else {
            for (const kid of dashboard.kids) {
                html += `
                    <div class="kid-section">
                        <div class="kid-header">
                            <div class="kid-avatar" style="background:${kid.user.avatar_color || '#6366f1'}">${kid.user.display_name.charAt(0)}</div>
                            <h2 class="kid-name">${kid.user.display_name}</h2>
                        </div>
                        <div class="accounts-grid">
                `;

                for (const acct of kid.accounts) {
                    html += `
                        <div class="account-card ${acct.account_type}" onclick="showAccountDetail(${acct.id}, '${kid.user.display_name}', '${acct.account_type}')">
                            <div class="account-type-label">
                                ${acct.account_type === 'checking' ? '💳' : '🐷'} ${acct.nickname || acct.account_type}
                            </div>
                            <div class="account-balance">${$(acct.balance)}</div>
                        </div>
                    `;
                }
                html += '</div></div>';
            }
        }

        main.innerHTML = html;
    } catch (e) {
        main.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><div class="empty-text">${e.message}</div></div>`;
    }
}

// ── Kid Dashboard ─────────────────────────────────────────────

async function renderKidDashboard() {
    const main = document.getElementById('main-content');
    try {
        const [dashboard, accounts] = await Promise.all([
            API.getDashboard(),
            API.getAccounts()
        ]);
        allAccounts = accounts;

        let html = `
            <div class="page-header">
                <h1 class="page-title">My Accounts</h1>
                <p class="page-subtitle">Welcome back, ${currentUser.display_name}! 🎉</p>
            </div>
            <div class="accounts-grid">
        `;

        for (const acct of dashboard.accounts) {
            html += `
                <div class="account-card ${acct.account_type}" onclick="showAccountDetail(${acct.id}, '${currentUser.display_name}', '${acct.account_type}')">
                    <div class="account-type-label">
                        ${acct.account_type === 'checking' ? '💳' : '🐷'} ${acct.nickname || acct.account_type}
                    </div>
                    <div class="account-balance">${$(acct.balance)}</div>
                    <div class="account-owner">Tap to see transactions</div>
                </div>
            `;
        }
        html += '</div>';

        if (dashboard.pending_withdrawals > 0) {
            html += `
                <div class="card mb-6" style="border: 2px solid var(--yellow); background: var(--yellow-bg);">
                    <strong>⏳ ${dashboard.pending_withdrawals} withdrawal${dashboard.pending_withdrawals > 1 ? 's' : ''} pending parent approval</strong>
                </div>
            `;
        }

        // Quick actions
        html += `
            <div class="quick-actions">
                <button class="quick-action-btn" onclick="document.querySelector('[data-view=withdraw]').click()">
                    <span class="qa-icon">💸</span> Withdraw Cash
                </button>
                <button class="quick-action-btn" onclick="document.querySelector('[data-view=kid-transfer]').click()">
                    <span class="qa-icon">🔄</span> Transfer Between Accounts
                </button>
            </div>
        `;

        // Recent transactions
        if (dashboard.recent_transactions.length > 0) {
            html += `
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Recent Activity</h3>
                    </div>
                    <ul class="txn-list">
            `;
            for (const txn of dashboard.recent_transactions) {
                const isCredit = txn.to_account_id && allAccounts.some(a => a.id === txn.to_account_id && a.user_id === currentUser.id);
                html += renderTxnItem(txn, isCredit);
            }
            html += '</ul></div>';
        }

        main.innerHTML = html;
    } catch (e) {
        main.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><div class="empty-text">${e.message}</div></div>`;
    }
}

function renderTxnItem(txn, isCredit) {
    const amountClass = isCredit ? 'credit' : 'debit';
    const sign = isCredit ? '+' : '-';
    let desc = txn.description || txn.transaction_type;
    let statusHTML = '';
    if (txn.status === 'pending') statusHTML = '<span class="txn-status pending">Pending</span>';
    if (txn.status === 'rejected') statusHTML = '<span class="txn-status rejected">Rejected</span>';

    return `
        <li class="txn-item">
            <div class="txn-icon ${txn.transaction_type}">${txnIcon(txn.transaction_type)}</div>
            <div class="txn-details">
                <div class="txn-desc">${desc} ${statusHTML}</div>
                <div class="txn-meta">${txn.category || ''} · ${timeAgo(txn.created_at)}</div>
            </div>
            <div class="txn-amount ${amountClass}">${sign}${$(txn.amount)}</div>
        </li>
    `;
}

// ── Account Detail Modal ──────────────────────────────────────

async function showAccountDetail(accountId, ownerName, accountType) {
    const transactions = await API.getTransactions(accountId, 30);
    const account = allAccounts.find(a => a.id === accountId);

    let html = `
        <div style="text-align:center; margin-bottom:20px;">
            <div class="account-type-label" style="justify-content:center;">
                ${accountType === 'checking' ? '💳' : '🐷'} ${ownerName}'s ${accountType}
            </div>
            <div class="account-balance">${$(account?.balance || 0)}</div>
        </div>
    `;

    if (transactions.length === 0) {
        html += '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">No transactions yet</div></div>';
    } else {
        html += '<ul class="txn-list">';
        for (const txn of transactions) {
            const isCredit = txn.to_account_id === accountId;
            html += renderTxnItem(txn, isCredit);
        }
        html += '</ul>';
    }

    showModal('Account Details', html);
}

// ── Approvals ─────────────────────────────────────────────────

async function renderApprovals() {
    const main = document.getElementById('main-content');
    try {
        const pending = await API.getPending();

        let html = `
            <div class="page-header">
                <h1 class="page-title">Pending Approvals</h1>
                <p class="page-subtitle">Review withdrawal requests from your kids</p>
            </div>
        `;

        if (pending.length === 0) {
            html += `<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-text">No pending approvals</div></div>`;
        } else {
            for (const txn of pending) {
                html += `
                    <div class="approval-card" id="approval-${txn.id}">
                        <div class="approval-info">
                            <div class="approval-name">${txn.requester_name}</div>
                            <div class="approval-detail">${txn.description || 'Withdrawal'} · ${txn.category || 'General'} · from ${txn.account_type}</div>
                            <div class="approval-detail">${timeAgo(txn.created_at)}</div>
                        </div>
                        <div class="approval-amount">${$(txn.amount)}</div>
                        <div class="approval-actions">
                            <button class="btn btn-success btn-sm" onclick="handleApproval(${txn.id}, true)">✅ Approve</button>
                            <button class="btn btn-danger btn-sm" onclick="handleApproval(${txn.id}, false)">❌ Reject</button>
                        </div>
                    </div>
                `;
            }
        }
        main.innerHTML = html;
    } catch (e) {
        main.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><div class="empty-text">${e.message}</div></div>`;
    }
}

async function handleApproval(txnId, approve) {
    try {
        if (approve) {
            await API.approve(txnId);
            toast('Withdrawal approved! Time to hand over the cash 💵');
        } else {
            await API.reject(txnId, '');
            toast('Withdrawal rejected', 'info');
        }
        document.getElementById(`approval-${txnId}`)?.remove();
        // Update badge
        const badge = document.getElementById('pending-badge');
        if (badge) {
            const count = parseInt(badge.textContent || '0') - 1;
            if (count > 0) { badge.textContent = count; } else { badge.style.display = 'none'; }
        }
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ── Deposit ───────────────────────────────────────────────────

async function renderDeposit() {
    const main = document.getElementById('main-content');
    const accounts = await API.getAccounts();
    const kidAccounts = accounts.filter(a => a.account_type !== 'parent_vault');

    let html = `
        <div class="page-header">
            <h1 class="page-title">Deposit Money</h1>
            <p class="page-subtitle">Add funds to a kid's account</p>
        </div>
        <div class="card" style="max-width:500px;">
            <form id="deposit-form">
                <div class="form-group">
                    <label>Deposit To</label>
                    <select id="dep-account" required>
                        <option value="">Select an account...</option>
                        ${kidAccounts.map(a => `<option value="${a.id}">${a.owner_name} — ${a.nickname || a.account_type} (${$(a.balance)})</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Amount</label>
                    <div class="amount-input-wrapper">
                        <input type="number" id="dep-amount" step="0.01" min="0.01" placeholder="0.00" required>
                    </div>
                </div>
                <div class="form-group">
                    <label>Category</label>
                    <select id="dep-category">${categorySelect()}</select>
                </div>
                <div class="form-group">
                    <label>Note (optional)</label>
                    <input type="text" id="dep-desc" placeholder="e.g., Birthday money from Grandma">
                </div>
                <button type="submit" class="btn btn-success btn-full">💵 Deposit</button>
            </form>
        </div>
    `;
    main.innerHTML = html;

    document.getElementById('deposit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const result = await API.deposit(
                parseInt(document.getElementById('dep-account').value),
                parseFloat(document.getElementById('dep-amount').value),
                document.getElementById('dep-category').value,
                document.getElementById('dep-desc').value
            );
            toast(result.message);
            document.getElementById('deposit-form').reset();
        } catch (e) {
            toast(e.message, 'error');
        }
    });
}

// ── Withdraw (Kid) ────────────────────────────────────────────

async function renderWithdraw() {
    const main = document.getElementById('main-content');
    const accounts = await API.getAccounts();

    let html = `
        <div class="page-header">
            <h1 class="page-title">Withdraw Cash</h1>
            <p class="page-subtitle">Request cash from your account</p>
        </div>
        <div class="card" style="max-width:500px;">
            <form id="withdraw-form">
                <div class="form-group">
                    <label>From Account</label>
                    <select id="wth-account" required>
                        ${accounts.map(a => `<option value="${a.id}">${a.nickname || a.account_type} (${$(a.balance)})</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Amount</label>
                    <div class="amount-input-wrapper">
                        <input type="number" id="wth-amount" step="0.01" min="0.01" placeholder="0.00" required>
                    </div>
                </div>
                <div class="form-group">
                    <label>What's it for?</label>
                    <select id="wth-category">${categorySelect()}</select>
                </div>
                <div class="form-group">
                    <label>Note (optional)</label>
                    <input type="text" id="wth-desc" placeholder="e.g., New video game">
                </div>
                <button type="submit" class="btn btn-primary btn-full">💸 Withdraw</button>
            </form>
        </div>
    `;
    main.innerHTML = html;

    document.getElementById('withdraw-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const result = await API.withdraw(
                parseInt(document.getElementById('wth-account').value),
                parseFloat(document.getElementById('wth-amount').value),
                document.getElementById('wth-category').value,
                document.getElementById('wth-desc').value
            );
            toast(result.message, result.status === 'pending' ? 'info' : 'success');
            document.getElementById('withdraw-form').reset();
        } catch (e) {
            toast(e.message, 'error');
        }
    });
}

// ── Transfer (Kid) ────────────────────────────────────────────

async function renderKidTransfer() {
    const main = document.getElementById('main-content');
    const accounts = await API.getAccounts();

    let html = `
        <div class="page-header">
            <h1 class="page-title">Transfer</h1>
            <p class="page-subtitle">Move money between your checking and savings</p>
        </div>
        <div class="card" style="max-width:500px;">
            <form id="transfer-form">
                <div class="form-group">
                    <label>From</label>
                    <select id="xfr-from" required>
                        ${accounts.map(a => `<option value="${a.id}">${a.nickname || a.account_type} (${$(a.balance)})</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>To</label>
                    <select id="xfr-to" required>
                        ${accounts.map(a => `<option value="${a.id}">${a.nickname || a.account_type} (${$(a.balance)})</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Amount</label>
                    <div class="amount-input-wrapper">
                        <input type="number" id="xfr-amount" step="0.01" min="0.01" placeholder="0.00" required>
                    </div>
                </div>
                <button type="submit" class="btn btn-primary btn-full">🔄 Transfer</button>
            </form>
        </div>
    `;
    main.innerHTML = html;

    // Auto-select different accounts
    if (accounts.length >= 2) {
        document.getElementById('xfr-to').selectedIndex = 1;
    }

    document.getElementById('transfer-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const from = parseInt(document.getElementById('xfr-from').value);
        const to = parseInt(document.getElementById('xfr-to').value);
        if (from === to) { toast('Pick different accounts!', 'error'); return; }
        try {
            const result = await API.transfer(from, to, parseFloat(document.getElementById('xfr-amount').value), 'Transfer');
            toast(result.message);
            document.getElementById('transfer-form').reset();
        } catch (e) {
            toast(e.message, 'error');
        }
    });
}

// ── Transaction History (Kid) ─────────────────────────────────

async function renderHistory() {
    const main = document.getElementById('main-content');
    const accounts = await API.getAccounts();

    let html = `
        <div class="page-header">
            <h1 class="page-title">Transaction History</h1>
            <p class="page-subtitle">All your account activity</p>
        </div>
    `;

    for (const acct of accounts) {
        const transactions = await API.getTransactions(acct.id, 50);
        html += `
            <div class="card mb-6">
                <div class="card-header">
                    <h3 class="card-title">${acct.account_type === 'checking' ? '💳' : '🐷'} ${acct.nickname || acct.account_type} — ${$(acct.balance)}</h3>
                </div>
        `;

        if (transactions.length === 0) {
            html += '<div class="empty-state"><div class="empty-text">No transactions yet</div></div>';
        } else {
            html += '<ul class="txn-list">';
            for (const txn of transactions) {
                const isCredit = txn.to_account_id === acct.id;
                html += renderTxnItem(txn, isCredit);
            }
            html += '</ul>';
        }
        html += '</div>';
    }

    main.innerHTML = html;
}

// ── Users Management ──────────────────────────────────────────

async function renderUsers() {
    const main = document.getElementById('main-content');
    const users = await API.getUsers();

    let html = `
        <div class="page-header flex-between">
            <div>
                <h1 class="page-title">Family Members</h1>
                <p class="page-subtitle">Manage accounts and family members</p>
            </div>
            <div style="display:flex;gap:8px;">
                <button class="btn btn-ghost" onclick="renderAccountPermissions()">⚙️ Account Permissions</button>
                <button class="btn btn-primary" onclick="showAddUserModal()">+ Add Member</button>
            </div>
        </div>
    `;

    for (const user of users) {
        const isCurrentUser = user.id === currentUser.id;
        html += `
            <div class="config-card">
                <div class="config-header">
                    <div style="display:flex;align-items:center;gap:12px;">
                        <div class="avatar" style="background:${user.avatar_color || '#6366f1'}">${user.display_name.charAt(0)}</div>
                        <div>
                            <h4>${user.display_name}</h4>
                            <div class="text-secondary" style="font-size:12px;">@${user.username} · ${user.role === 'parent' ? '👑 Parent' : '⭐ Kid'}${isCurrentUser ? ' (You)' : ''}</div>
                        </div>
                    </div>
                    <div style="display:flex;gap:8px;">
                        <button class="btn btn-ghost btn-sm" onclick="showEditUserModal(${user.id}, '${user.display_name}', '${user.avatar_color || '#6366f1'}')">Edit</button>
                        ${!isCurrentUser ? `<button class="btn btn-ghost btn-sm" style="color:#ef4444;" onclick="confirmDeleteUser(${user.id}, '${user.display_name}')">Delete</button>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    main.innerHTML = html;
}

function showAddUserModal() {
    const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#f97316'];
    const colorOptions = colors.map(c =>
        `<label style="display:inline-block;width:32px;height:32px;border-radius:50%;background:${c};cursor:pointer;border:3px solid transparent;" class="color-opt" data-color="${c}">
            <input type="radio" name="color" value="${c}" style="display:none;">
        </label>`
    ).join('');

    showModal('Add Family Member', `
        <form id="add-user-form">
            <div class="form-group">
                <label>Display Name</label>
                <input type="text" id="new-name" placeholder="e.g., Emma" required>
            </div>
            <div class="form-group">
                <label>Username (for login)</label>
                <input type="text" id="new-username" placeholder="e.g., emma" required>
            </div>
            <div class="form-group">
                <label>Password</label>
                <input type="password" id="new-password" placeholder="At least 4 characters" required minlength="4">
            </div>
            <div class="form-group">
                <label>Role</label>
                <select id="new-role">
                    <option value="kid">⭐ Kid</option>
                    <option value="parent">👑 Parent</option>
                </select>
            </div>
            <div class="form-group">
                <label>Avatar Color</label>
                <div style="display:flex;gap:8px;flex-wrap:wrap;" id="color-picker">${colorOptions}</div>
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Create Account</button>
            </div>
        </form>
    `);

    let selectedColor = '#6366f1';
    document.querySelectorAll('.color-opt').forEach(el => {
        if (el.dataset.color === selectedColor) el.style.borderColor = '#1a1d2e';
        el.addEventListener('click', () => {
            document.querySelectorAll('.color-opt').forEach(e => e.style.borderColor = 'transparent');
            el.style.borderColor = '#1a1d2e';
            selectedColor = el.dataset.color;
        });
    });

    document.getElementById('add-user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await API.createUser({
                display_name: document.getElementById('new-name').value,
                username: document.getElementById('new-username').value,
                password: document.getElementById('new-password').value,
                role: document.getElementById('new-role').value,
                avatar_color: selectedColor
            });
            toast('Family member added! 🎉');
            closeModal();
            renderUsers();
        } catch (e) {
            toast(e.message, 'error');
        }
    });
}

function showEditUserModal(userId, name, color) {
    showModal(`Edit ${name}`, `
        <form id="edit-user-form">
            <div class="form-group">
                <label>Display Name</label>
                <input type="text" id="edit-name" value="${name}" required>
            </div>
            <div class="form-group">
                <label>New Password (leave blank to keep current)</label>
                <input type="password" id="edit-password" placeholder="Min 4 characters" minlength="4">
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Save Changes</button>
            </div>
        </form>
    `);

    document.getElementById('edit-user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const data = { display_name: document.getElementById('edit-name').value };
            const pw = document.getElementById('edit-password').value;
            if (pw) data.new_password = pw;
            await API.updateUser(userId, data);
            toast('Updated!');
            closeModal();
            renderUsers();
        } catch (e) {
            toast(e.message, 'error');
        }
    });
}

function confirmDeleteUser(userId, userName) {
    showModal(`Delete ${userName}?`, `
        <div style="padding:1rem 0;">
            <p style="margin-bottom:1rem;">Are you sure you want to delete <strong>${userName}</strong>?</p>
            <p style="color:#64748b;font-size:0.9rem;">This will permanently delete:</p>
            <ul style="margin:0.5rem 0;padding-left:1.5rem;color:#64748b;font-size:0.9rem;">
                <li>Their user account</li>
                <li>All their checking and savings accounts</li>
                <li>All their transaction history</li>
                <li>Their allowance configuration</li>
            </ul>
            <p style="color:#ef4444;font-weight:600;margin-top:1rem;">⚠️ This action cannot be undone!</p>
        </div>
        <div class="form-actions" style="margin-top:1.5rem;">
            <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" style="background:#ef4444;" onclick="deleteUser(${userId}, '${userName}')">Delete ${userName}</button>
        </div>
    `);
}

async function deleteUser(userId, userName) {
    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();
        if (response.ok) {
            toast(result.message || `${userName} deleted`);
            closeModal();
            renderUsers();
        } else {
            toast(result.error || 'Failed to delete user', 'error');
        }
    } catch (e) {
        toast('Network error', 'error');
    }
}

async function renderAccountPermissions() {
    const main = document.getElementById('main-content');
    const settings = await API.getSettings();

    const kidsCanCreate = settings.kids_can_create_checking === 'true';
    const maxAccounts = parseInt(settings.max_checking_accounts_per_kid || 5);

    let html = `
        <div class="page-header">
            <div>
                <h1 class="page-title">⚙️ Account Permissions</h1>
                <p class="page-subtitle">Configure checking account permissions and limits</p>
            </div>
        </div>

        <div class="card" style="max-width:600px;">
            <h3 class="card-title" style="margin-bottom:1.5rem;">Checking Account Management</h3>

            <form id="settings-form">
                <div class="form-group">
                    <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
                        <input type="checkbox" id="kids-can-create" ${kidsCanCreate ? 'checked' : ''}>
                        <span>Allow kids to create their own checking accounts</span>
                    </label>
                    <small style="color:#64748b;display:block;margin-top:0.5rem;">
                        When enabled, kids can create multiple checking accounts (e.g., "Spend", "Donate", "Save") from their dashboard.
                    </small>
                </div>

                <div class="form-group">
                    <label>Maximum checking accounts per kid</label>
                    <input type="number" id="max-accounts" min="1" max="20" value="${maxAccounts}" required>
                    <small style="color:#64748b;display:block;margin-top:0.5rem;">
                        Limit how many checking accounts each kid can have (recommended: 3-5)
                    </small>
                </div>

                <div style="margin-top:2rem;padding-top:2rem;border-top:1px solid #e2e8f0;">
                    <button type="submit" class="btn btn-primary">Save Settings</button>
                    <button type="button" class="btn btn-ghost" onclick="renderUsers()" style="margin-left:0.5rem;">Cancel</button>
                </div>
            </form>
        </div>
    `;

    main.innerHTML = html;

    document.getElementById('settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await API.updateSettings({
                kids_can_create_checking: document.getElementById('kids-can-create').checked ? 'true' : 'false',
                max_checking_accounts_per_kid: document.getElementById('max-accounts').value
            });
            toast('Settings saved! ✓');
            renderUsers();
        } catch (e) {
            toast(e.message, 'error');
        }
    });
}

// ── Allowances Config ─────────────────────────────────────────

async function renderAllowances() {
    const main = document.getElementById('main-content');
    const configs = await API.getAllowances();

    let html = `
        <div class="page-header">
            <h1 class="page-title">Allowance Settings</h1>
            <p class="page-subtitle">Configure automatic allowance for each kid</p>
        </div>
    `;

    if (configs.length === 0) {
        html += '<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-text">Add kids first to configure allowances</div></div>';
    } else {
        for (const config of configs) {
            html += `
                <div class="config-card" id="allowance-${config.id}">
                    <div class="config-header">
                        <h4>${config.display_name}</h4>
                        <button class="toggle ${config.active ? 'active' : ''}" onclick="toggleAllowance(${config.id}, ${config.active ? 0 : 1})"></button>
                    </div>
                    <div class="config-row">
                        <div class="config-field">
                            <label>Amount ($)</label>
                            <input type="number" value="${config.amount}" step="0.25" min="0" id="al-amt-${config.id}">
                        </div>
                        <div class="config-field">
                            <label>Frequency</label>
                            <select id="al-freq-${config.id}">
                                <option value="weekly" ${config.frequency === 'weekly' ? 'selected' : ''}>Weekly</option>
                                <option value="biweekly" ${config.frequency === 'biweekly' ? 'selected' : ''}>Every 2 Weeks</option>
                                <option value="monthly" ${config.frequency === 'monthly' ? 'selected' : ''}>Monthly</option>
                            </select>
                        </div>
                        <div class="config-field">
                            <label>Pay Into</label>
                            <select id="al-target-${config.id}">
                                <option value="checking" ${config.target_account_type === 'checking' ? 'selected' : ''}>Checking</option>
                                <option value="savings" ${config.target_account_type === 'savings' ? 'selected' : ''}>Savings</option>
                            </select>
                        </div>
                    </div>
                    <div class="config-row mt-4">
                        <div class="config-field">
                            <label>Next Payment</label>
                            <input type="date" value="${config.next_payment_date || ''}" id="al-date-${config.id}">
                        </div>
                        <div class="config-field" style="display:flex;align-items:flex-end;">
                            <button class="btn btn-primary btn-sm" onclick="saveAllowance(${config.id})">Save</button>
                        </div>
                    </div>
                </div>
            `;
        }
    }
    main.innerHTML = html;
}

async function toggleAllowance(id, active) {
    try {
        await API.updateAllowance(id, { active });
        toast(active ? 'Allowance enabled' : 'Allowance paused', 'info');
        renderAllowances();
    } catch (e) { toast(e.message, 'error'); }
}

async function saveAllowance(id) {
    try {
        await API.updateAllowance(id, {
            amount: parseFloat(document.getElementById(`al-amt-${id}`).value),
            frequency: document.getElementById(`al-freq-${id}`).value,
            target_account_type: document.getElementById(`al-target-${id}`).value,
            next_payment_date: document.getElementById(`al-date-${id}`).value,
        });
        toast('Allowance settings saved! ✅');
    } catch (e) { toast(e.message, 'error'); }
}

// ── Interest Config ───────────────────────────────────────────

async function renderInterest() {
    const main = document.getElementById('main-content');
    const configs = await API.getInterest();

    let html = `
        <div class="page-header">
            <h1 class="page-title">Interest Rates</h1>
            <p class="page-subtitle">Configure interest on savings accounts</p>
        </div>
    `;

    if (configs.length === 0) {
        html += '<div class="empty-state"><div class="empty-icon">📈</div><div class="empty-text">Add kids first to configure interest</div></div>';
    } else {
        for (const config of configs) {
            html += `
                <div class="config-card">
                    <div class="config-header">
                        <h4>${config.display_name} — ${config.account_type}</h4>
                        <button class="toggle ${config.active ? 'active' : ''}" onclick="toggleInterest(${config.id}, ${config.active ? 0 : 1})"></button>
                    </div>
                    <div class="config-row">
                        <div class="config-field">
                            <label>Annual Rate (%)</label>
                            <input type="number" value="${config.annual_rate}" step="0.5" min="0" id="int-rate-${config.id}">
                        </div>
                        <div class="config-field">
                            <label>Compound</label>
                            <select id="int-freq-${config.id}">
                                <option value="daily" ${config.compound_frequency === 'daily' ? 'selected' : ''}>Daily</option>
                                <option value="weekly" ${config.compound_frequency === 'weekly' ? 'selected' : ''}>Weekly</option>
                                <option value="monthly" ${config.compound_frequency === 'monthly' ? 'selected' : ''}>Monthly</option>
                            </select>
                        </div>
                        <div class="config-field" style="display:flex;align-items:flex-end;">
                            <button class="btn btn-primary btn-sm" onclick="saveInterest(${config.id})">Save</button>
                        </div>
                    </div>
                </div>
            `;
        }
    }
    main.innerHTML = html;
}

async function toggleInterest(id, active) {
    try {
        await API.updateInterest(id, { active });
        toast(active ? 'Interest enabled' : 'Interest paused', 'info');
        renderInterest();
    } catch (e) { toast(e.message, 'error'); }
}

async function saveInterest(id) {
    try {
        await API.updateInterest(id, {
            annual_rate: parseFloat(document.getElementById(`int-rate-${id}`).value),
            compound_frequency: document.getElementById(`int-freq-${id}`).value,
        });
        toast('Interest settings saved! ✅');
    } catch (e) { toast(e.message, 'error'); }
}

// ── Settings ──────────────────────────────────────────────────

async function renderSettings() {
    const main = document.getElementById('main-content');
    const settings = await API.getSettings();

    const approvalRequired = settings.withdrawal_approval_required === 'true';
    const maxNoApproval = settings.max_withdrawal_without_approval || '0';

    let html = `
        <div class="page-header">
            <h1 class="page-title">Bank Settings</h1>
            <p class="page-subtitle">Configure how Family Bank works</p>
        </div>
        <div class="card">
            <div class="settings-grid">
                <div class="setting-item">
                    <div>
                        <div class="setting-label">Require approval for withdrawals</div>
                        <div class="setting-desc">Kids must get parent approval before withdrawing cash</div>
                    </div>
                    <button class="toggle ${approvalRequired ? 'active' : ''}" id="toggle-approval"
                        onclick="this.classList.toggle('active')"></button>
                </div>
                <div class="setting-item">
                    <div>
                        <div class="setting-label">Auto-approve withdrawals up to</div>
                        <div class="setting-desc">Withdrawals at or below this amount skip approval (0 = all need approval)</div>
                    </div>
                    <div class="amount-input-wrapper" style="width:120px;">
                        <input type="number" id="max-no-approval" value="${maxNoApproval}" step="1" min="0" style="padding-left:28px;">
                    </div>
                </div>
                <div class="setting-item">
                    <div>
                        <div class="setting-label">Bank Name</div>
                        <div class="setting-desc">Customize the name shown on the login page</div>
                    </div>
                    <input type="text" id="bank-name" value="${settings.bank_name || 'Family Bank'}" style="width:180px;padding:8px 12px;border:2px solid #e2e8f0;border-radius:8px;">
                </div>
            </div>
            <div class="form-actions mt-6">
                <button class="btn btn-primary" onclick="saveSettings()">Save Settings</button>
            </div>
        </div>

        <div class="card mt-6">
            <div class="card-header">
                <h3 class="card-title">🔒 Change Your Password</h3>
            </div>
            <form id="password-form">
                <div class="form-group">
                    <label>Current Password</label>
                    <input type="password" id="current-pw" required>
                </div>
                <div class="form-group">
                    <label>New Password</label>
                    <input type="password" id="new-pw" required minlength="4">
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Change Password</button>
                </div>
            </form>
        </div>
    `;
    main.innerHTML = html;

    document.getElementById('password-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await API.changePassword(
                document.getElementById('current-pw').value,
                document.getElementById('new-pw').value
            );
            toast('Password changed!');
            document.getElementById('password-form').reset();
        } catch (e) {
            toast(e.message, 'error');
        }
    });
}

async function saveSettings() {
    try {
        await API.updateSettings({
            withdrawal_approval_required: document.getElementById('toggle-approval').classList.contains('active') ? 'true' : 'false',
            max_withdrawal_without_approval: document.getElementById('max-no-approval').value,
            bank_name: document.getElementById('bank-name').value,
        });
        toast('Settings saved! ✅');
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
