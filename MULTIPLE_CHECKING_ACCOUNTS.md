# Multiple Checking Accounts Feature

## Overview

Family Bank now supports multiple checking accounts per user with custom nicknames! This allows kids to organize their money into different categories like "Spend", "Donate", "Save for Bike", etc. Parents can also split allowances across multiple accounts automatically.

## Key Features

- ✅ **Multiple checking accounts** - Each kid can have up to 5 checking accounts (configurable)
- ✅ **Custom nicknames** - Name accounts like "Spend", "Donate", "Emergency Fund", etc.
- ✅ **Allowance splitting** - Automatically distribute allowance across multiple accounts with custom percentages
- ✅ **Default account** - Mark one account as the default for quick access
- ✅ **Permission controls** - Parents can control whether kids can create their own checking accounts

## Database Changes

### New Columns in `accounts` table:
- `nickname` (TEXT) - Custom name for the account (e.g., "Spend", "Donate")
- `is_default` (INTEGER) - Flag indicating if this is the default account (0 or 1)

### New `allowance_splits` table:
```sql
CREATE TABLE allowance_splits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    allowance_config_id INTEGER NOT NULL,
    account_id INTEGER NOT NULL,
    percentage REAL NOT NULL,
    FOREIGN KEY (allowance_config_id) REFERENCES allowance_config(id),
    FOREIGN KEY (account_id) REFERENCES accounts(id)
);
```

### New Settings:
- `kids_can_create_checking` (default: 'false') - Whether kids can create their own checking accounts
- `max_checking_accounts_per_kid` (default: '5') - Maximum number of checking accounts per kid

## API Endpoints

### 1. Create a New Checking Account

**Endpoint:** `POST /api/accounts/checking`

**Request Body:**
```json
{
  "nickname": "Spend",
  "user_id": 2  // Optional - only for parents creating accounts for kids
}
```

**Response:**
```json
{
  "success": true,
  "account_id": 5,
  "message": "Checking account \"Spend\" created successfully"
}
```

**Permission Rules:**
- Parents can always create checking accounts for any kid
- Kids can only create accounts for themselves (if enabled in settings)
- Maximum 5 checking accounts per user (configurable)
- Nicknames must be unique per user

---

### 2. Update Account Nickname

**Endpoint:** `PUT /api/accounts/{account_id}/nickname`

**Request Body:**
```json
{
  "nickname": "Emergency Fund"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Account nickname updated to \"Emergency Fund\""
}
```

---

### 3. Set Default Account

**Endpoint:** `POST /api/accounts/{account_id}/set-default`

**Response:**
```json
{
  "success": true,
  "message": "Default account updated"
}
```

**Note:** This will unset the default flag on all other accounts of the same type for this user.

---

### 4. Get Allowance Splits

**Endpoint:** `GET /api/admin/allowances/{config_id}/splits`

**Response:**
```json
[
  {
    "id": 1,
    "allowance_config_id": 1,
    "account_id": 1,
    "nickname": "Main",
    "percentage": 60.0,
    "balance": 45.00
  },
  {
    "id": 2,
    "allowance_config_id": 1,
    "account_id": 3,
    "nickname": "Spend",
    "percentage": 30.0,
    "balance": 22.50
  },
  {
    "id": 3,
    "allowance_config_id": 1,
    "account_id": 4,
    "nickname": "Donate",
    "percentage": 10.0,
    "balance": 7.50
  }
]
```

---

### 5. Update Allowance Splits

**Endpoint:** `PUT /api/admin/allowances/{config_id}/splits`

**Request Body:**
```json
{
  "splits": [
    {
      "account_id": 1,
      "percentage": 60.0
    },
    {
      "account_id": 3,
      "percentage": 30.0
    },
    {
      "account_id": 4,
      "percentage": 10.0
    }
  ]
}
```

**Validation Rules:**
- Percentages must add up to exactly 100%
- Each percentage must be between 0 and 100
- All accounts must be checking accounts belonging to the same user
- At least one split is required

**Response:**
```json
{
  "success": true,
  "message": "Allowance splits updated successfully"
}
```

## Usage Examples

### Example 1: Create Multiple Checking Accounts

```python
# Parent creates checking accounts for their kid
response1 = requests.post('/api/accounts/checking', json={
    'nickname': 'Spend',
    'user_id': 2  # Kid's user ID
})

response2 = requests.post('/api/accounts/checking', json={
    'nickname': 'Donate',
    'user_id': 2
})

response3 = requests.post('/api/accounts/checking', json={
    'nickname': 'Save',
    'user_id': 2
})
```

### Example 2: Configure Allowance Splits

```python
# Split $10 weekly allowance: 60% Spend, 30% Save, 10% Donate
response = requests.put('/api/admin/allowances/1/splits', json={
    'splits': [
        {'account_id': 3, 'percentage': 60.0},  # Spend account
        {'account_id': 5, 'percentage': 30.0},  # Save account
        {'account_id': 4, 'percentage': 10.0}   # Donate account
    ]
})

# Next allowance payment will distribute:
# - $6.00 to Spend
# - $3.00 to Save
# - $1.00 to Donate
```

### Example 3: Enable Kids to Create Their Own Accounts

```python
# Update settings to allow kids to create checking accounts
response = requests.put('/api/admin/settings', json={
    'kids_can_create_checking': 'true'
})

# Now kids can create their own checking accounts
response = requests.post('/api/accounts/checking', json={
    'nickname': 'My Secret Stash'
})
```

## Migration

The migration is automatically applied when the app starts. It will:

1. Add `nickname` and `is_default` columns to existing accounts
2. Create the `allowance_splits` table
3. Set default nicknames for existing accounts:
   - Checking accounts → "Main"
   - Savings accounts → "Savings"
   - Parent vaults → "Vault"
4. Mark existing accounts as default
5. Create default allowance splits (100% to existing checking account)

## Backward Compatibility

The feature is fully backward compatible:

- Existing accounts get default nicknames automatically
- Existing allowance configurations get a 100% split to the main checking account
- The allowance job falls back to old behavior if no splits are defined
- All existing API endpoints continue to work as before

## Settings Configuration

### Enable Kids to Create Checking Accounts

```sql
UPDATE settings SET value = 'true' WHERE key = 'kids_can_create_checking';
```

### Change Maximum Accounts Limit

```sql
UPDATE settings SET value = '10' WHERE key = 'max_checking_accounts_per_kid';
```

## Testing

A comprehensive test script is available at `/test_multiple_checking.py` which tests:

- ✅ Creating multiple checking accounts with nicknames
- ✅ Configuring allowance splits with custom percentages
- ✅ Running the allowance job and verifying correct distribution
- ✅ Account limit enforcement
- ✅ Balance tracking across multiple accounts

Run the test:
```bash
python3 test_multiple_checking.py
```

## Implementation Details

### Allowance Distribution Logic

When processing allowances, the system:

1. Finds all active allowance configurations due for payment
2. Retrieves the allowance splits for each configuration
3. Calculates the amount for each split based on percentage
4. Creates separate transactions for each split
5. Updates balances for all affected accounts
6. The last split gets any rounding remainder to ensure the total matches exactly

### Example:
- Total allowance: $10.00
- Splits: 60% Main, 30% Spend, 10% Donate
- Distributed as: $6.00 (Main) + $3.00 (Spend) + $1.00 (Donate) = $10.00

### Transaction Descriptions

When allowance is split across multiple accounts, each transaction includes:
- The split nickname
- The percentage
- Example: "Weekly allowance - Feb 11, 2026 (Spend: 30.0%)"

When there's only one account (100% split), the description is simple:
- Example: "Weekly allowance - Feb 11, 2026"

## Future Enhancements

Possible future additions:
- Transfer limits between specific accounts
- Account-specific spending goals
- Visual charts showing balance distribution
- Auto-transfer rules (e.g., "Save 10% of all deposits to Savings")
- Account categories/colors for better organization
