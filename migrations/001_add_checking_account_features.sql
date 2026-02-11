-- Migration: Add support for multiple checking accounts with nicknames
-- This migration adds:
-- 1. nickname field to accounts table
-- 2. is_default field to mark the default checking account
-- 3. allowance_splits table for distributing allowance across multiple accounts
-- 4. setting for allowing kids to create checking accounts

-- Add nickname and is_default columns to accounts table
ALTER TABLE accounts ADD COLUMN nickname TEXT;
ALTER TABLE accounts ADD COLUMN is_default INTEGER DEFAULT 0;

-- Create allowance_splits table to support splitting allowance across multiple accounts
CREATE TABLE IF NOT EXISTS allowance_splits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    allowance_config_id INTEGER NOT NULL,
    account_id INTEGER NOT NULL,
    percentage REAL NOT NULL DEFAULT 100.0 CHECK(percentage >= 0 AND percentage <= 100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (allowance_config_id) REFERENCES allowance_config(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    UNIQUE(allowance_config_id, account_id)
);

-- Add new settings
INSERT OR IGNORE INTO settings (key, value) VALUES ('kids_can_create_checking', 'false');
INSERT OR IGNORE INTO settings (key, value) VALUES ('max_checking_accounts_per_kid', '5');

-- Mark existing checking accounts as default
UPDATE accounts SET is_default = 1 WHERE account_type = 'checking';

-- Set default nicknames for existing accounts
UPDATE accounts SET nickname = 'Main' WHERE account_type = 'checking' AND nickname IS NULL;
UPDATE accounts SET nickname = 'Savings' WHERE account_type = 'savings' AND nickname IS NULL;
UPDATE accounts SET nickname = 'Vault' WHERE account_type = 'parent_vault' AND nickname IS NULL;

-- Create default allowance splits for existing configurations
-- This will create a 100% split to the default checking account for each user
INSERT INTO allowance_splits (allowance_config_id, account_id, percentage)
SELECT
    ac.id,
    a.id,
    100.0
FROM allowance_config ac
JOIN accounts a ON a.user_id = ac.user_id
    AND a.account_type = ac.target_account_type
    AND a.is_default = 1
WHERE NOT EXISTS (
    SELECT 1 FROM allowance_splits WHERE allowance_config_id = ac.id
);
