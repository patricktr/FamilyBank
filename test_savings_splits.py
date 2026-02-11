#!/usr/bin/env python3
"""Test script for allowance splits with savings accounts."""

import os
import sys
sys.path.insert(0, '/sessions/busy-hopeful-edison/mnt/FamilyBank')

os.environ['DATABASE_PATH'] = '/sessions/busy-hopeful-edison/test_savings_splits.db'

from app.models import get_db, init_db, run_migrations
from datetime import date, timedelta

def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)

def test_savings_splits():
    """Test allowance splits including savings accounts."""
    # Initialize database
    init_db()
    run_migrations()

    db = get_db()

    print_section("Setup: Create test user with checking and savings")

    # Create test kid
    from werkzeug.security import generate_password_hash
    db.execute(
        'INSERT INTO users (username, display_name, password_hash, role, avatar_color) VALUES (?, ?, ?, ?, ?)',
        ('testkid', 'Test Kid', generate_password_hash('test123'), 'kid', '#22c55e')
    )
    kid_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]

    # Create checking accounts
    db.execute(
        'INSERT INTO accounts (user_id, account_type, nickname, is_default, balance) VALUES (?, ?, ?, ?, ?)',
        (kid_id, 'checking', 'Spend', 1, 0.00)
    )
    spend_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]

    db.execute(
        'INSERT INTO accounts (user_id, account_type, nickname, is_default, balance) VALUES (?, ?, ?, ?, ?)',
        (kid_id, 'checking', 'Donate', 0, 0.00)
    )
    donate_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]

    # Create savings account
    db.execute(
        'INSERT INTO accounts (user_id, account_type, nickname, is_default, balance) VALUES (?, ?, ?, ?, ?)',
        (kid_id, 'savings', 'Savings', 1, 0.00)
    )
    savings_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]

    print(f"✅ Created kid user with ID: {kid_id}")
    print(f"   - Spend (checking): {spend_id}")
    print(f"   - Donate (checking): {donate_id}")
    print(f"   - Savings (savings): {savings_id}")

    print_section("Setup: Create allowance config with splits")

    # Create allowance config
    next_monday = date.today()
    db.execute(
        'INSERT INTO allowance_config (user_id, amount, frequency, next_payment_date, active) VALUES (?, ?, ?, ?, ?)',
        (kid_id, 10.00, 'weekly', next_monday.isoformat(), 1)
    )
    config_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]

    # Create splits: 50% Spend, 30% Savings, 20% Donate
    db.execute(
        'INSERT INTO allowance_splits (allowance_config_id, account_id, percentage) VALUES (?, ?, ?)',
        (config_id, spend_id, 50.0)
    )
    db.execute(
        'INSERT INTO allowance_splits (allowance_config_id, account_id, percentage) VALUES (?, ?, ?)',
        (config_id, savings_id, 30.0)
    )
    db.execute(
        'INSERT INTO allowance_splits (allowance_config_id, account_id, percentage) VALUES (?, ?, ?)',
        (config_id, donate_id, 20.0)
    )

    db.commit()

    print(f"✅ Created allowance config with splits:")
    print(f"   - Spend (checking): 50% = $5.00")
    print(f"   - Savings (savings): 30% = $3.00")
    print(f"   - Donate (checking): 20% = $2.00")

    print_section("Run allowance job")

    from app.jobs import process_allowances
    count = process_allowances()
    print(f"✅ Processed {count} allowance payment(s)")

    print_section("Verify balances")

    accounts = db.execute(
        'SELECT * FROM accounts WHERE user_id = ? ORDER BY account_type, nickname',
        (kid_id,)
    ).fetchall()

    total = 0.0
    for acc in accounts:
        print(f"   - {acc['nickname']:15s} ({acc['account_type']:8s}): ${acc['balance']:.2f}")
        total += acc['balance']

    print(f"   {'Total':>15s}            : ${total:.2f}")

    # Verify expected amounts
    spend_balance = db.execute('SELECT balance FROM accounts WHERE id = ?', (spend_id,)).fetchone()[0]
    savings_balance = db.execute('SELECT balance FROM accounts WHERE id = ?', (savings_id,)).fetchone()[0]
    donate_balance = db.execute('SELECT balance FROM accounts WHERE id = ?', (donate_id,)).fetchone()[0]

    assert abs(spend_balance - 5.00) < 0.01, f"Expected $5.00 in Spend, got ${spend_balance}"
    assert abs(savings_balance - 3.00) < 0.01, f"Expected $3.00 in Savings, got ${savings_balance}"
    assert abs(donate_balance - 2.00) < 0.01, f"Expected $2.00 in Donate, got ${donate_balance}"
    assert abs(total - 10.00) < 0.01, f"Expected total $10.00, got ${total}"

    print("\n✅ All balance checks passed!")

    print_section("Verify transactions")

    transactions = db.execute('''
        SELECT t.*, a.nickname, a.account_type
        FROM transactions t
        JOIN accounts a ON t.to_account_id = a.id
        WHERE a.user_id = ?
        ORDER BY t.created_at
    ''', (kid_id,)).fetchall()

    print(f"Created {len(transactions)} transaction(s):")
    for txn in transactions:
        print(f"   - ${txn['amount']:.2f} → {txn['nickname']} ({txn['account_type']}) | {txn['description']}")

    assert len(transactions) == 3, f"Expected 3 transactions, got {len(transactions)}"

    print_section("Test Complete")
    print("✅ Allowance splitting with savings accounts works perfectly!")
    print()
    print("Summary:")
    print("  - Allowance split across checking AND savings accounts")
    print("  - Correct amounts distributed to each account")
    print("  - Separate transactions created for each split")
    print("  - Savings account can now receive allowance automatically!")
    print()
    print("💡 Benefit: Kids can automatically save part of their allowance,")
    print("   and if interest is enabled on savings, it will compound!")

    db.close()

if __name__ == '__main__':
    test_savings_splits()
