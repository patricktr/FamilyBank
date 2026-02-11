/**
 * Multiple Checking Accounts UI Extension
 * Adds UI for creating and managing multiple checking accounts with nicknames
 */

// ── Manage Accounts View (Parent) ────────────────────────────────

async function renderManageAccounts() {
    const main = document.getElementById('main-content');
    const accounts = await API.getAccounts();
    const users = await API.getUsers();

    // Group accounts by user
    const accountsByUser = {};
    for (const account of accounts) {
        if (!accountsByUser[account.user_id]) {
            accountsByUser[account.user_id] = [];
        }
        accountsByUser[account.user_id].push(account);
    }

    let html = `
        <div class="page-header">
            <h1 class="page-title">💳 Manage Accounts</h1>
            <p class="page-subtitle">Create and manage checking accounts for your kids</p>
        </div>
    `;

    // Show accounts for each kid
    const kids = users.filter(u => u.role === 'kid');
    for (const kid of kids) {
        const userAccounts = accountsByUser[kid.id] || [];
        const checkingAccounts = userAccounts.filter(a => a.account_type === 'checking');
        const canAddMore = checkingAccounts.length < 5;

        html += `
            <div class="card" style="margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <div>
                        <h3 style="margin: 0; font-size: 1.2rem;">${kid.display_name}</h3>
                        <p style="margin: 0.25rem 0 0 0; color: #64748b; font-size: 0.9rem;">
                            ${checkingAccounts.length} checking account${checkingAccounts.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                    ${canAddMore ? `
                        <button class="btn btn-primary btn-sm" onclick="showCreateAccountModal(${kid.id}, '${kid.display_name}')">
                            + Add Account
                        </button>
                    ` : `
                        <span style="color: #64748b; font-size: 0.9rem;">Max accounts reached (5)</span>
                    `}
                </div>

                ${checkingAccounts.length > 0 ? `
                    <div class="accounts-list">
                        ${checkingAccounts.map(acc => `
                            <div class="account-item" style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: #f8fafc; border-radius: 8px; margin-bottom: 0.5rem;">
                                <div style="flex: 1;">
                                    <div style="font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">
                                        ${acc.nickname || 'Unnamed'}
                                        ${acc.is_default ? '<span style="background: #22c55e; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">DEFAULT</span>' : ''}
                                    </div>
                                    <div style="color: #64748b; font-size: 0.9rem; margin-top: 0.25rem;">
                                        Balance: ${$(acc.balance)}
                                    </div>
                                </div>
                                <div style="display: flex; gap: 0.5rem;">
                                    <button class="btn btn-sm" onclick="showRenameAccountModal(${acc.id}, '${acc.nickname}', '${kid.display_name}')" title="Rename">
                                        ✏️
                                    </button>
                                    ${!acc.is_default ? `
                                        <button class="btn btn-sm" onclick="setDefaultAccount(${acc.id}, '${kid.display_name}')" title="Set as default">
                                            ⭐
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div style="text-align: center; color: #94a3b8; padding: 1rem;">
                        No checking accounts yet
                    </div>
                `}
            </div>
        `;
    }

    if (kids.length === 0) {
        html += `
            <div class="empty-state">
                <div class="empty-icon">👨‍👧‍👦</div>
                <div class="empty-text">No kids added yet</div>
                <p>Add family members first to create accounts for them</p>
            </div>
        `;
    }

    main.innerHTML = html;
}

// ── Create Account Modal ──────────────────────────────────────────

function showCreateAccountModal(userId, userName) {
    const bodyHTML = `
        <form id="create-account-form">
            <div class="form-group">
                <label>Account Nickname</label>
                <input type="text" id="account-nickname" placeholder="e.g., Spend, Donate, Save" required maxlength="30">
                <small style="color: #64748b;">This helps organize money into categories</small>
            </div>

            <div style="margin-top: 1rem; padding: 1rem; background: #f1f5f9; border-radius: 8px;">
                <p style="margin: 0; font-size: 0.9rem; color: #475569;">
                    <strong>💡 Ideas for account names:</strong><br>
                    • Spend (for everyday purchases)<br>
                    • Donate (for charity)<br>
                    • Save (for long-term goals)<br>
                    • Emergency (emergency fund)
                </p>
            </div>

            <div class="modal-actions" style="margin-top: 1.5rem;">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Create Account</button>
            </div>
        </form>
    `;

    showModal(`Create Checking Account for ${userName}`, bodyHTML);

    document.getElementById('create-account-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nickname = document.getElementById('account-nickname').value.trim();

        try {
            const result = await fetch('/api/accounts/checking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nickname, user_id: userId })
            });

            const data = await result.json();

            if (result.ok) {
                toast(data.message);
                closeModal();
                renderManageAccounts(); // Refresh the view
            } else {
                toast(data.error || 'Failed to create account', 'error');
            }
        } catch (e) {
            toast('Network error', 'error');
        }
    });
}

// ── Rename Account Modal ──────────────────────────────────────────

function showRenameAccountModal(accountId, currentNickname, userName) {
    const bodyHTML = `
        <form id="rename-account-form">
            <div class="form-group">
                <label>New Nickname</label>
                <input type="text" id="new-nickname" value="${currentNickname}" required maxlength="30">
            </div>

            <div class="modal-actions" style="margin-top: 1.5rem;">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Update</button>
            </div>
        </form>
    `;

    showModal(`Rename Account`, bodyHTML);

    document.getElementById('rename-account-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nickname = document.getElementById('new-nickname').value.trim();

        try {
            const result = await fetch(`/api/accounts/${accountId}/nickname`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nickname })
            });

            const data = await result.json();

            if (result.ok) {
                toast(data.message);
                closeModal();
                renderManageAccounts(); // Refresh the view
            } else {
                toast(data.error || 'Failed to rename account', 'error');
            }
        } catch (e) {
            toast('Network error', 'error');
        }
    });
}

// ── Set Default Account ───────────────────────────────────────────

async function setDefaultAccount(accountId, userName) {
    try {
        const result = await fetch(`/api/accounts/${accountId}/set-default`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await result.json();

        if (result.ok) {
            toast(`Default account updated for ${userName}`);
            renderManageAccounts(); // Refresh the view
        } else {
            toast(data.error || 'Failed to set default', 'error');
        }
    } catch (e) {
        toast('Network error', 'error');
    }
}

// ── Kid Account Creation (if enabled) ─────────────────────────────

async function renderKidManageAccounts() {
    const main = document.getElementById('main-content');
    const accounts = await API.getAccounts();

    // Use settings from currentUser (set during login)
    const canCreate = currentUser.kidsCanManageAccounts || false;
    const checkingAccounts = accounts.filter(a => a.account_type === 'checking');
    const maxAccounts = currentUser.maxCheckingAccounts || 5;
    const canAddMore = checkingAccounts.length < maxAccounts;

    let html = `
        <div class="page-header">
            <h1 class="page-title">💳 My Accounts</h1>
            <p class="page-subtitle">Manage your checking accounts</p>
        </div>
    `;

    if (canCreate && canAddMore) {
        html += `
            <div class="card" style="max-width: 500px; margin-bottom: 1.5rem;">
                <button class="btn btn-primary btn-full" onclick="showCreateOwnAccountModal()">
                    + Create New Checking Account
                </button>
                <p style="margin-top: 0.5rem; color: #64748b; font-size: 0.9rem; text-align: center;">
                    ${checkingAccounts.length} of ${maxAccounts} accounts used
                </p>
            </div>
        `;
    } else if (!canCreate) {
        html += `
            <div class="card" style="max-width: 500px; margin-bottom: 1.5rem; background: #fef3c7; border-left: 4px solid #f59e0b;">
                <p style="margin: 0; color: #92400e;">
                    ℹ️ Ask your parent to create additional checking accounts for you
                </p>
            </div>
        `;
    } else if (!canAddMore) {
        html += `
            <div class="card" style="max-width: 500px; margin-bottom: 1.5rem;">
                <p style="margin: 0; color: #64748b;">
                    You've reached the maximum of ${maxAccounts} checking accounts
                </p>
            </div>
        `;
    }

    // Show current accounts
    html += `<div class="card" style="max-width: 500px;">`;
    html += `<h3 style="margin-top: 0;">Your Checking Accounts</h3>`;

    if (checkingAccounts.length > 0) {
        for (const acc of checkingAccounts) {
            html += `
                <div style="padding: 1rem; background: #f8fafc; border-radius: 8px; margin-bottom: 0.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 600;">
                                ${acc.nickname || 'Unnamed'}
                                ${acc.is_default ? '<span style="background: #22c55e; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; margin-left: 0.5rem;">DEFAULT</span>' : ''}
                            </div>
                            <div style="color: #64748b; margin-top: 0.25rem;">
                                ${$(acc.balance)}
                            </div>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-ghost btn-sm" onclick="showRenameOwnAccountModal(${acc.id}, '${acc.nickname}')">Rename</button>
                            ${!acc.is_default ? `<button class="btn btn-ghost btn-sm" style="color: #ef4444;" onclick="confirmDeleteOwnAccount(${acc.id}, '${acc.nickname}', ${acc.balance})">Delete</button>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }
    } else {
        html += `<p style="color: #94a3b8; text-align: center;">No checking accounts yet</p>`;
    }
    html += `</div>`;

    main.innerHTML = html;
}

function showCreateOwnAccountModal() {
    const bodyHTML = `
        <form id="create-own-account-form">
            <div class="form-group">
                <label>Account Nickname</label>
                <input type="text" id="own-account-nickname" placeholder="e.g., Spend, Donate, Save" required maxlength="30">
            </div>

            <div class="modal-actions" style="margin-top: 1.5rem;">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Create</button>
            </div>
        </form>
    `;

    showModal('Create Checking Account', bodyHTML);

    document.getElementById('create-own-account-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nickname = document.getElementById('own-account-nickname').value.trim();

        try {
            const result = await fetch('/api/accounts/checking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nickname })
            });

            const data = await result.json();

            if (result.ok) {
                toast(data.message);
                closeModal();
                renderKidManageAccounts(); // Refresh the view
            } else {
                toast(data.error || 'Failed to create account', 'error');
            }
        } catch (e) {
            toast('Network error', 'error');
        }
    });
}

function showRenameOwnAccountModal(accountId, currentNickname) {
    const bodyHTML = `
        <form id="rename-own-account-form">
            <div class="form-group">
                <label>New Nickname</label>
                <input type="text" id="rename-nickname" value="${currentNickname}" required maxlength="30">
            </div>

            <div class="modal-actions" style="margin-top: 1.5rem;">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Save</button>
            </div>
        </form>
    `;

    showModal('Rename Account', bodyHTML);

    document.getElementById('rename-own-account-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nickname = document.getElementById('rename-nickname').value.trim();

        try {
            const result = await fetch(`/api/accounts/${accountId}/nickname`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nickname })
            });

            const data = await result.json();

            if (result.ok) {
                toast(data.message);
                closeModal();
                renderKidManageAccounts();
            } else {
                toast(data.error || 'Failed to rename account', 'error');
            }
        } catch (e) {
            toast('Network error', 'error');
        }
    });
}

function confirmDeleteOwnAccount(accountId, nickname, balance) {
    if (balance > 0) {
        showModal('Cannot Delete Account', `
            <div style="padding: 1rem 0;">
                <p style="color: #ef4444; font-weight: 600; margin-bottom: 1rem;">⚠️ Account has a balance!</p>
                <p style="margin-bottom: 1rem;">
                    You cannot delete the <strong>${nickname}</strong> account because it has a balance of <strong>${$(balance)}</strong>.
                </p>
                <p style="color: #64748b;">
                    Please transfer the money to another account first, or withdraw it.
                </p>
            </div>
            <div class="modal-actions" style="margin-top: 1.5rem;">
                <button class="btn btn-primary" onclick="closeModal()">OK</button>
            </div>
        `);
        return;
    }

    showModal(`Delete ${nickname}?`, `
        <div style="padding: 1rem 0;">
            <p style="margin-bottom: 1rem;">
                Are you sure you want to delete the <strong>${nickname}</strong> account?
            </p>
            <p style="color: #64748b; font-size: 0.9rem;">
                This will permanently delete the account and its transaction history.
            </p>
            <p style="color: #ef4444; font-weight: 600; margin-top: 1rem;">⚠️ This action cannot be undone!</p>
        </div>
        <div class="modal-actions" style="margin-top: 1.5rem;">
            <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" style="background: #ef4444;" onclick="deleteOwnAccount(${accountId}, '${nickname}')">Delete ${nickname}</button>
        </div>
    `);
}

async function deleteOwnAccount(accountId, nickname) {
    try {
        const result = await fetch(`/api/accounts/${accountId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await result.json();

        if (result.ok) {
            toast(data.message || `${nickname} deleted`);
            closeModal();
            renderKidManageAccounts();
        } else {
            toast(data.error || 'Failed to delete account', 'error');
        }
    } catch (e) {
        toast('Network error', 'error');
    }
}
