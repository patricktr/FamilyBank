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
    ''')

    # Insert default settings
    defaults = [
        ('withdrawal_approval_required', 'true'),
        ('max_withdrawal_without_approval', '0'),
        ('bank_name', 'Family Bank'),
        ('currency_symbol', '$'),
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
            'INSERT INTO accounts (user_id, account_type, balance) VALUES (?, ?, ?)',
            (parent_id, 'parent_vault', 999999999.00)
        )

        db.commit()
        print("✅ Default parent account created (username: admin, password: changeme)")
        print("⚠️  Please change the default password after first login!")

    db.close()
