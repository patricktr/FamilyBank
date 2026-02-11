/**
 * Allowance Splits UI Extension
 * Adds UI for managing allowance distribution across multiple checking accounts
 */

// ── Enhanced Allowances View with Splits ──────────────────────────

async function renderAllowancesWithSplits() {
    const main = document.getElementById('main-content');
    const allowances = await API.getAllowances();
    const accounts = await API.getAccounts();

    let html = `
        <div class="page-header">
            <h1 class="page-title">📅 Allowances</h1>
            <p class="page-subtitle">Configure automatic allowance payments and splits</p>
        </div>
    `;

    if (allowances.length === 0) {
        html += `
            <div class="empty-state">
                <div class="empty-icon">📅</div>
                <div class="empty-text">No allowances configured</div>
                <p>Add kids first to set up their allowances</p>
            </div>
        `;
    } else {
        for (const config of allowances) {
            const isActive = config.active === 1;
            const userAccounts = accounts.filter(a => a.user_id === config.user_id && a.account_type === 'checking');

            html += `
                <div class="card" style="margin-bottom: 1.5rem;">
                    <div class="card-row">
                        <div class="card-col">
                            <div class="card-label">${config.display_name}</div>
                            <div class="card-value">${$(config.amount)} ${config.frequency}</div>
                            <div class="card-detail">Next: ${config.next_payment_date || 'Not scheduled'}</div>
                        </div>
                        <div class="card-col card-col-auto">
                            <button class="btn btn-sm" onclick="showAllowanceSplitsModal(${config.id}, '${config.display_name}', ${config.user_id})">
                                💰 Manage Splits
                            </button>
                            <button class="btn btn-sm" onclick="showEditAllowanceModal(${config.id}, '${config.display_name}', ${config.amount}, '${config.frequency}', ${config.active})">
                                ⚙️ Settings
                            </button>
                        </div>
                    </div>

                    <!-- Show current splits -->
                    <div id="splits-preview-${config.id}" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e2e8f0;">
                        <div style="font-size: 0.9rem; color: #64748b; margin-bottom: 0.5rem;">
                            <strong>Distribution:</strong>
                        </div>
                        <div id="splits-content-${config.id}">
                            <div style="color: #94a3b8; font-size: 0.9rem;">Loading...</div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    main.innerHTML = html;

    // Load splits for each allowance
    for (const config of allowances) {
        loadSplitsPreview(config.id);
    }
}

async function loadSplitsPreview(configId) {
    try {
        const response = await fetch(`/api/admin/allowances/${configId}/splits`);
        const splits = await response.json();

        const container = document.getElementById(`splits-content-${configId}`);
        if (!container) return;

        if (splits.length === 0) {
            container.innerHTML = `<div style="color: #94a3b8; font-size: 0.9rem;">No splits configured - using default account</div>`;
            return;
        }

        let html = '<div style="display: flex; flex-direction: column; gap: 0.5rem;">';
        for (const split of splits) {
            const accountIcon = split.account_type === 'savings' ? '🏦' : '💳';
            const barColor = split.account_type === 'savings' ? '#10b981' : '#3b82f6';
            html += `
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem;">
                    <span>${accountIcon} ${split.nickname || 'Unnamed'}</span>
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <div style="flex: 0 0 100px; background: #e2e8f0; border-radius: 8px; height: 8px; position: relative;">
                            <div style="background: ${barColor}; height: 100%; width: ${split.percentage}%; border-radius: 8px;"></div>
                        </div>
                        <strong style="min-width: 50px; text-align: right;">${split.percentage}%</strong>
                    </div>
                </div>
            `;
        }
        html += '</div>';

        container.innerHTML = html;
    } catch (e) {
        const container = document.getElementById(`splits-content-${configId}`);
        if (container) {
            container.innerHTML = `<div style="color: #ef4444; font-size: 0.9rem;">Error loading splits</div>`;
        }
    }
}

// ── Allowance Splits Modal ────────────────────────────────────────

async function showAllowanceSplitsModal(configId, userName, userId) {
    // Fetch current splits and all accounts
    const [splitsResponse, accountsResponse] = await Promise.all([
        fetch(`/api/admin/allowances/${configId}/splits`),
        fetch('/api/accounts')
    ]);

    const splits = await splitsResponse.json();
    const allAccounts = await accountsResponse.json();
    const userAccounts = allAccounts.filter(a =>
        a.user_id === userId && (a.account_type === 'checking' || a.account_type === 'savings')
    );

    if (userAccounts.length === 0) {
        toast('No checking or savings accounts found for this user', 'error');
        return;
    }

    // Create a map of current splits
    const currentSplits = {};
    for (const split of splits) {
        currentSplits[split.account_id] = split.percentage;
    }

    // Group accounts by type
    const checkingAccounts = userAccounts.filter(a => a.account_type === 'checking');
    const savingsAccounts = userAccounts.filter(a => a.account_type === 'savings');

    let bodyHTML = `
        <form id="splits-form">
            <p style="margin-bottom: 1rem; color: #64748b;">
                Distribute <strong>${userName}'s</strong> allowance across checking and savings accounts. Percentages must add up to 100%.
            </p>

            <div id="splits-inputs">
    `;

    // Add checking accounts section
    if (checkingAccounts.length > 0) {
        bodyHTML += `<div style="margin-bottom: 1rem;"><strong style="color: #475569; font-size: 0.9rem;">💳 Checking Accounts</strong></div>`;
    }

    for (let i = 0; i < checkingAccounts.length; i++) {
        const account = checkingAccounts[i];
        const currentPercentage = currentSplits[account.id] || 0;

        bodyHTML += `
            <div class="form-group" style="display: flex; gap: 0.5rem; align-items: center;">
                <label style="flex: 1; margin: 0;">
                    ${account.nickname || 'Unnamed'}
                    ${account.is_default ? '<span style="background: #22c55e; color: white; padding: 2px 6px; border-radius: 8px; font-size: 0.7rem;">DEFAULT</span>' : ''}
                </label>
                <div style="display: flex; align-items: center; gap: 0.25rem;">
                    <input
                        type="number"
                        class="split-input"
                        data-account-id="${account.id}"
                        min="0"
                        max="100"
                        step="0.1"
                        value="${currentPercentage}"
                        style="width: 80px; text-align: right;"
                        oninput="updateSplitsTotal()"
                    >
                    <span>%</span>
                </div>
            </div>
        `;
    }

    // Add savings accounts section
    if (savingsAccounts.length > 0) {
        bodyHTML += `<div style="margin: 1.5rem 0 1rem 0;"><strong style="color: #475569; font-size: 0.9rem;">🏦 Savings Accounts</strong></div>`;
    }

    for (let i = 0; i < savingsAccounts.length; i++) {
        const account = savingsAccounts[i];
        const currentPercentage = currentSplits[account.id] || 0;

        bodyHTML += `
            <div class="form-group" style="display: flex; gap: 0.5rem; align-items: center;">
                <label style="flex: 1; margin: 0;">
                    ${account.nickname || 'Unnamed'}
                    ${account.is_default ? '<span style="background: #10b981; color: white; padding: 2px 6px; border-radius: 8px; font-size: 0.7rem;">SAVINGS</span>' : ''}
                </label>
                <div style="display: flex; align-items: center; gap: 0.25rem;">
                    <input
                        type="number"
                        class="split-input"
                        data-account-id="${account.id}"
                        min="0"
                        max="100"
                        step="0.1"
                        value="${currentPercentage}"
                        style="width: 80px; text-align: right;"
                        oninput="updateSplitsTotal()"
                    >
                    <span>%</span>
                </div>
            </div>
        `;
    }

    bodyHTML += `
            </div>

            <div style="margin-top: 1rem; padding: 0.75rem; background: #f1f5f9; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                <strong>Total:</strong>
                <strong id="splits-total" style="font-size: 1.2rem;">0%</strong>
            </div>

            <div id="splits-error" style="display: none; margin-top: 0.5rem; color: #ef4444; font-size: 0.9rem; text-align: center;">
                ⚠️ Total must equal 100%
            </div>

            <div class="modal-actions" style="margin-top: 1.5rem;">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary" id="save-splits-btn">Save Splits</button>
            </div>
        </form>

        <script>
            // Initialize total
            setTimeout(() => updateSplitsTotal(), 0);
        </script>
    `;

    showModal(`💰 Allowance Splits - ${userName}`, bodyHTML);

    // Handle form submission
    document.getElementById('splits-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const inputs = document.querySelectorAll('.split-input');
        const splits = [];
        let total = 0;

        for (const input of inputs) {
            const percentage = parseFloat(input.value) || 0;
            if (percentage > 0) {
                splits.push({
                    account_id: parseInt(input.dataset.accountId),
                    percentage: percentage
                });
                total += percentage;
            }
        }

        // Validate total
        if (Math.abs(total - 100) > 0.01) {
            document.getElementById('splits-error').style.display = 'block';
            return;
        }

        if (splits.length === 0) {
            toast('At least one account must have a percentage > 0', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/admin/allowances/${configId}/splits`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ splits })
            });

            const data = await response.json();

            if (response.ok) {
                toast(data.message);
                closeModal();
                renderAllowancesWithSplits(); // Refresh
            } else {
                toast(data.error || 'Failed to update splits', 'error');
            }
        } catch (e) {
            toast('Network error', 'error');
        }
    });
}

function updateSplitsTotal() {
    const inputs = document.querySelectorAll('.split-input');
    let total = 0;

    for (const input of inputs) {
        total += parseFloat(input.value) || 0;
    }

    const totalEl = document.getElementById('splits-total');
    const errorEl = document.getElementById('splits-error');
    const saveBtn = document.getElementById('save-splits-btn');

    if (totalEl) {
        totalEl.textContent = total.toFixed(1) + '%';

        const isValid = Math.abs(total - 100) < 0.01;
        totalEl.style.color = isValid ? '#22c55e' : '#ef4444';

        if (errorEl) {
            errorEl.style.display = isValid ? 'none' : 'block';
        }

        if (saveBtn) {
            saveBtn.disabled = !isValid;
        }
    }
}

// ── Edit Allowance Modal (original functionality) ─────────────────

function showEditAllowanceModal(configId, userName, amount, frequency, active) {
    const bodyHTML = `
        <form id="edit-allowance-form">
            <div class="form-group">
                <label>Amount</label>
                <div class="amount-input-wrapper">
                    <input type="number" id="allowance-amount" step="0.01" min="0" value="${amount}" required>
                </div>
            </div>

            <div class="form-group">
                <label>Frequency</label>
                <select id="allowance-frequency">
                    <option value="weekly" ${frequency === 'weekly' ? 'selected' : ''}>Weekly</option>
                    <option value="biweekly" ${frequency === 'biweekly' ? 'selected' : ''}>Biweekly</option>
                    <option value="monthly" ${frequency === 'monthly' ? 'selected' : ''}>Monthly</option>
                </select>
            </div>

            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <input type="checkbox" id="allowance-active" ${active ? 'checked' : ''}>
                    <span>Active (enable automatic payments)</span>
                </label>
            </div>

            <div class="modal-actions" style="margin-top: 1.5rem;">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Save Changes</button>
            </div>
        </form>
    `;

    showModal(`Edit Allowance - ${userName}`, bodyHTML);

    document.getElementById('edit-allowance-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const data = {
            amount: parseFloat(document.getElementById('allowance-amount').value),
            frequency: document.getElementById('allowance-frequency').value,
            active: document.getElementById('allowance-active').checked ? 1 : 0
        };

        try {
            const response = await fetch(`/api/admin/allowances/${configId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                toast('Allowance updated successfully');
                closeModal();
                renderAllowancesWithSplits(); // Refresh
            } else {
                const result = await response.json();
                toast(result.error || 'Failed to update allowance', 'error');
            }
        } catch (e) {
            toast('Network error', 'error');
        }
    });
}
