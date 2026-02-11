/**
 * Updates to app.js for Multiple Checking Accounts Support
 *
 * INSTRUCTIONS:
 * 1. Add these functions to app.js
 * 2. Update the navigation setup
 * 3. Update account displays to show nicknames
 */

// ═══════════════════════════════════════════════════════════════
// ADD TO NAVIGATION SETUP (in setupSidebar function)
// ═══════════════════════════════════════════════════════════════

// FOR PARENTS - Add this after "Family Members" nav item:
/*
    <div class="nav-item" data-view="manage-accounts">
        <span class="nav-icon">💳</span> Manage Accounts
    </div>
*/

// FOR KIDS - Add this after "My Accounts" nav item:
/*
    <div class="nav-item" data-view="my-accounts">
        <span class="nav-icon">💳</span> My Accounts
    </div>
*/

// ═══════════════════════════════════════════════════════════════
// ADD TO navigateTo VIEWS OBJECT
// ═══════════════════════════════════════════════════════════════

/*
const views = {
    'dashboard': currentUser.role === 'parent' ? renderParentDashboard : renderKidDashboard,
    'approvals': renderApprovals,
    'deposit': renderDeposit,
    'users': renderUsers,
    'manage-accounts': renderManageAccounts,  // ADD THIS
    'allowances': renderAllowancesWithSplits,  // UPDATE THIS
    'interest': renderInterest,
    'settings': renderSettings,
    'withdraw': renderWithdraw,
    'kid-transfer': renderKidTransfer,
    'my-accounts': renderKidManageAccounts,  // ADD THIS
    'history': renderHistory,
};
*/

// ═══════════════════════════════════════════════════════════════
// UPDATE ACCOUNT DISPLAY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

// Helper function to format account name with nickname
function formatAccountName(account) {
    const nickname = account.nickname || account.account_type;
    const defaultBadge = account.is_default ? ' ⭐' : '';
    return `${nickname}${defaultBadge}`;
}

// ═══════════════════════════════════════════════════════════════
// UPDATE renderDeposit FUNCTION - Replace the account select options
// ═══════════════════════════════════════════════════════════════

/*
// REPLACE THIS LINE:
${kidAccounts.map(a => `<option value="${a.id}">${a.owner_name} — ${a.account_type} (${$(a.balance)})</option>`).join('')}

// WITH THIS:
${kidAccounts.map(a => `<option value="${a.id}">${a.owner_name} — ${formatAccountName(a)} (${$(a.balance)})</option>`).join('')}
*/

// ═══════════════════════════════════════════════════════════════
// UPDATE renderWithdraw FUNCTION - Replace the account select options
// ═══════════════════════════════════════════════════════════════

/*
// REPLACE THIS LINE:
${accounts.map(a => `<option value="${a.id}">${a.account_type} (${$(a.balance)})</option>`).join('')}

// WITH THIS:
${accounts.map(a => `<option value="${a.id}">${formatAccountName(a)} (${$(a.balance)})</option>`).join('')}
*/

// ═══════════════════════════════════════════════════════════════
// UPDATE renderKidTransfer FUNCTION - Replace both select options
// ═══════════════════════════════════════════════════════════════

/*
// REPLACE THE FROM AND TO SELECT OPTIONS WITH:
${accounts.map(a => `<option value="${a.id}">${formatAccountName(a)} (${$(a.balance)})</option>`).join('')}
*/

// ═══════════════════════════════════════════════════════════════
// UPDATE renderKidDashboard FUNCTION - Account cards display
// ═══════════════════════════════════════════════════════════════

/*
// FIND the account cards rendering and UPDATE to show nicknames:
for (const account of accounts) {
    const typeName = formatAccountName(account);
    const typeIcon = account.account_type === 'checking' ? '💳' : '🏦';

    html += `
        <div class="account-card" onclick="showAccountDetails(${account.id})">
            <div class="account-icon">${typeIcon}</div>
            <div class="account-info">
                <div class="account-name">${typeName}</div>
                <div class="account-balance">${$(account.balance)}</div>
            </div>
        </div>
    `;
}
*/

// ═══════════════════════════════════════════════════════════════
// UPDATE renderParentDashboard FUNCTION - Show nicknames for kids' accounts
// ═══════════════════════════════════════════════════════════════

/*
// FIND where kid accounts are displayed and ADD nickname support:
for (const acc of kid.accounts) {
    html += `
        <div class="kid-account" onclick="showAccountDetails(${acc.id})">
            <div class="kid-account-type">${formatAccountName(acc)}</div>
            <div class="kid-account-balance">${$(acc.balance)}</div>
        </div>
    `;
}
*/
