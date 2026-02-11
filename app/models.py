"""Database models and initialization for Family Bank."""

import sqlite3
import os
from datetime import datetime
from werkzeug.security import generate_password_hash

DATABASE_PATH = os.environ.get('DATABASE_PATH', 'family_bank.db')


def get_db():
    """Get a database connection with row factory."""
    db = sqlite3.connect(DATABASE_PATH)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA foreign_keys=ON")
    return db


def run_migrations():
    """Run database migrations."""
    db = get_db()

    # Create migrations table if it doesn't exist
    db.execute('''
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Check current version
    current_version_row = db.execute(
        'SELECT MAX(version) as version FROM schema_migrations'
    ).fetchone()
    current_version = current_version_row['version'] if current_version_row['version'] else 0

    migrations_dir = os.path.join(os.path.dirname(__file__), '..', 'migrations')

    # Migration 1: Add checking account features
    if current_version < 1 and os.path.exists(os.path.join(migrations_dir, '001_add_checking_account_features.sql')):
        try:
            with open(os.path.join(migrations_dir, '001_add_checking_account_features.sql'), 'r') as f:
                migration_sql = f.read()
            db.executescript(migration_sql)
            db.execute('INSERT INTO schema_migrations (version) VALUES (?)', (1,))
            db.commit()
            print("✅ Applied migration 001: Add checking account features")
        except Exception as e:
            print(f"⚠️  Migration 001 failed (may already be applied): {e}")
            # Check if columns already exist
            cursor = db.execute("PRAGMA table_info(accounts)")
            columns = [row[1] for row in cursor.fetchall()]
            if 'nickname' in columns:
                db.execute('INSERT OR IGNORE INTO schema_migrations (version) VALUES (?)', (1,))
                db.commit()

    # Migration 2: Add allowance schedule preferences
    if current_version < 2 and os.path.exists(os.path.join(migrations_dir, '002_add_allowance_schedule_preferences.sql')):
        try:
            with open(os.path.join(migrations_dir, '002_add_allowance_schedule_preferences.sql'), 'r') as f:
                migration_sql = f.read()
            db.executescript(migration_sql)
            db.execute('INSERT INTO schema_migrations (version) VALUES (?)', (2,))
            db.commit()
            print("✅ Applied migration 002: Add allowance schedule preferences")
        except Exception as e:
            print(f"⚠️  Migration 002 failed (may already be applied): {e}")
            # Check if columns already exist
            cursor = db.execute("PRAGMA table_info(allowance_config)")
            columns = [row[1] for row in cursor.fetchall()]
            if 'day_of_week' in columns:
                db.execute('INSERT OR IGNORE INTO schema_migrations (version) VALUES (?)', (2,))
                db.commit()

    db.close()


def init_db():
    """Initialize the database schema."""
    db = get_db()
    db.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            display_name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('parent', 'kid')),
            avatar_color TEXT DEFAULT '#6366f1',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            account_type TEXT NOT NULL CHECK(account_type IN ('checking', 'savings', 'parent_vault')),
            nickname TEXT,
            is_default INTEGER DEFAULT 0,
            balance REAL DEFAULT 0.00,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_account_id INTEGER,
            to_account_id INTEGER,
            amount REAL NOT NULL,
            transaction_type TEXT NOT NULL CHECK(transaction_type IN (
                'deposit', 'withdrawal', 'transfer', 'allowance', 'interest', 'parent_deposit'
            )),
            category TEXT DEFAULT 'general',
            description TEXT,
            status TEXT DEFAULT 'completed' CHECK(status IN (
                'pending', 'approved', 'rejected', 'completed'
            )),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            reviewed_by INTEGER,
            reviewed_at TIMESTAMP,
            FOREIGN KEY (from_account_id) REFERENCES accounts(id),
            FOREIGN KEY (to_account_id) REFERENCES accounts(id),
            FOREIGN KEY (reviewed_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS allowance_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            amount REAL NOT NULL DEFAULT 0.00,
            frequency TEXT NOT NULL DEFAULT 'weekly' CHECK(frequency IN (
                'weekly', 'biweekly', 'monthly'
            )),
            target_account_type TEXT DEFAULT 'checking' CHECK(target_account_type IN (
                'checking', 'savings'
            )),
            next_payment_date TEXT,
            day_of_week INTEGER,
            day_of_month INTEGER,
            active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS interest_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            annual_rate REAL NOT NULL DEFAULT 5.0,
            compound_frequency TEXT DEFAULT 'monthly' CHECK(compound_frequency IN (
                'daily', 'weekly', 'monthly'
            )),
            last_applied TIMESTAMP,
            active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (account_id) REFERENCES accounts(id)
        );

        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            icon TEXT DEFAULT '💰',
            color TEXT DEFAULT '#6366f1'
        );

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
    ''')

    # Insert default settings
    defaults = [
        ('withdrawal_approval_required', 'true'),
        ('max_withdrawal_without_approval', '0'),
        ('bank_name', 'Family Bank'),
        ('currency_symbol', '$'),
        ('kids_can_create_checking', 'false'),
        ('max_checking_accounts_per_kid', '5'),
    ]
    for key, value in defaults:
        db.execute(
            'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
            (key, value)
        )

    # Insert default categories
    default_categories = [
        ('General', '💰', '#6366f1'),
        ('Toys & Games', '🎮', '#f59e0b'),
        ('Clothes', '👕', '#ec4899'),
        ('Food & Treats', '🍕', '#ef4444'),
        ('Savings Goal', '🎯', '#10b981'),
        ('Books', '📚', '#3b82f6'),
        ('Entertainment', '🎬', '#8b5cf6'),
        ('Gifts', '🎁', '#f97316'),
        ('Chores', '🧹', '#14b8a6'),
        ('Allowance', '📅', '#22c55e'),
        ('Interest', '📈', '#0ea5e9'),
        ('Other', '📦', '#64748b'),
    ]
    for name, icon, color in default_categories:
        db.execute(
            'INSERT OR IGNORE INTO categories (name, icon, color) VALUES (?, ?, ?)',
            (name, icon, color)
        )

    db.commit()
    db.close()


def seed_demo_data():
    """Seed the database with initial parent account if empty."""
    db = get_db()
    user_count = db.execute('SELECT COUNT(*) FROM users').fetchone()[0]
    if user_count == 0:
        # Create default parent account
        parent_hash = generate_password_hash('changeme')
        db.execute(
            'INSERT INTO users (username, display_name, password_hash, role, avatar_color) VALUES (?, ?, ?, ?, ?)',
            ('admin', 'Mom & Dad', parent_hash, 'parent', '#6366f1')
        )
        parent_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]

        # Create parent vault account (unlimited funds)
        db.execute(
            'INSERT INTO accounts (user_id, account_type, nickname, is_default, balance) VALUES (?, ?, ?, ?, ?)',
            (parent_id, 'parent_vault', 'Vault', 1, 999999999.00)
        )

        db.commit()
        print("✅ Default parent account created (username: admin, password: changeme)")
        print("⚠️  Please change the default password after first login!")

    db.close()
