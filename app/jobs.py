"""Scheduled jobs for allowance payments and interest calculation."""

from datetime import datetime, timedelta, date
from app.models import get_db


def process_allowances():
    """Process due allowance payments with support for multiple account splits."""
    db = get_db()
    today = date.today().isoformat()

    # Get all due allowance configs
    due_configs = db.execute('''
        SELECT ac.*, u.display_name
        FROM allowance_config ac
        JOIN users u ON ac.user_id = u.id
        WHERE ac.active = 1 AND ac.amount > 0 AND ac.next_payment_date <= ?
    ''', (today,)).fetchall()

    count = 0
    for config in due_configs:
        # Get allowance splits for this config
        splits = db.execute('''
            SELECT s.*, a.nickname
            FROM allowance_splits s
            JOIN accounts a ON s.account_id = a.id
            WHERE s.allowance_config_id = ?
        ''', (config['id'],)).fetchall()

        if not splits:
            # Fallback: if no splits defined, use the old behavior (target_account_type)
            account = db.execute(
                'SELECT id FROM accounts WHERE user_id = ? AND account_type = ? AND is_default = 1',
                (config['user_id'], config['target_account_type'])
            ).fetchone()

            if account:
                splits = [{'account_id': account['id'], 'percentage': 100.0, 'nickname': 'Main'}]
            else:
                print(f"⚠️  No account found for allowance config {config['id']}, skipping")
                continue

        # Distribute allowance across splits
        total_distributed = 0.0
        description_base = f"{config['frequency'].capitalize()} allowance - {date.today().strftime('%b %d, %Y')}"

        for i, split in enumerate(splits):
            # Calculate amount for this split
            if i == len(splits) - 1:
                # Last split gets remainder to handle rounding
                split_amount = config['amount'] - total_distributed
            else:
                split_amount = round(config['amount'] * (split['percentage'] / 100.0), 2)
                total_distributed += split_amount

            if split_amount > 0:
                # Create allowance transaction
                description = f"{description_base}"
                if len(splits) > 1:
                    description += f" ({split['nickname']}: {split['percentage']}%)"

                db.execute('''
                    INSERT INTO transactions (to_account_id, amount, transaction_type, category, description, status)
                    VALUES (?, ?, 'allowance', 'Allowance', ?, 'completed')
                ''', (split['account_id'], split_amount, description))

                # Update balance
                db.execute(
                    'UPDATE accounts SET balance = balance + ? WHERE id = ?',
                    (split_amount, split['account_id'])
                )

        # Calculate next payment date
        current_date = date.fromisoformat(config['next_payment_date'])
        if config['frequency'] == 'weekly':
            next_date = current_date + timedelta(weeks=1)
        elif config['frequency'] == 'biweekly':
            next_date = current_date + timedelta(weeks=2)
        elif config['frequency'] == 'monthly':
            # Advance by one month
            month = current_date.month + 1
            year = current_date.year
            if month > 12:
                month = 1
                year += 1
            next_date = current_date.replace(year=year, month=month)

        db.execute(
            'UPDATE allowance_config SET next_payment_date = ? WHERE id = ?',
            (next_date.isoformat(), config['id'])
        )
        count += 1

    db.commit()
    db.close()
    return count


def process_interest():
    """Process interest payments on savings accounts."""
    db = get_db()
    now = datetime.now()

    active_configs = db.execute('''
        SELECT ic.*, a.balance, a.account_type, u.display_name
        FROM interest_config ic
        JOIN accounts a ON ic.account_id = a.id
        JOIN users u ON a.user_id = u.id
        WHERE ic.active = 1 AND a.balance > 0
    ''').fetchall()

    count = 0
    for config in active_configs:
        should_apply = False
        if config['last_applied'] is None:
            should_apply = True
        else:
            last = datetime.fromisoformat(config['last_applied'])
            if config['compound_frequency'] == 'daily':
                should_apply = (now - last).days >= 1
            elif config['compound_frequency'] == 'weekly':
                should_apply = (now - last).days >= 7
            elif config['compound_frequency'] == 'monthly':
                should_apply = (now - last).days >= 28

        if should_apply and config['balance'] > 0:
            # Calculate interest
            annual_rate = config['annual_rate'] / 100
            if config['compound_frequency'] == 'daily':
                period_rate = annual_rate / 365
            elif config['compound_frequency'] == 'weekly':
                period_rate = annual_rate / 52
            elif config['compound_frequency'] == 'monthly':
                period_rate = annual_rate / 12

            interest_amount = round(config['balance'] * period_rate, 2)

            if interest_amount > 0:
                db.execute('''
                    INSERT INTO transactions (to_account_id, amount, transaction_type, category, description, status)
                    VALUES (?, ?, 'interest', 'Interest', ?, 'completed')
                ''', (config['account_id'], interest_amount,
                      f"Interest payment ({config['annual_rate']}% annual rate)"))

                db.execute(
                    'UPDATE accounts SET balance = balance + ? WHERE id = ?',
                    (interest_amount, config['account_id'])
                )

            db.execute(
                'UPDATE interest_config SET last_applied = ? WHERE id = ?',
                (now.isoformat(), config['id'])
            )
            count += 1

    db.commit()
    db.close()
    return count


def run_all_jobs():
    """Run all scheduled jobs."""
    allowances = process_allowances()
    interest = process_interest()
    print(f"[{datetime.now().isoformat()}] Jobs complete: {allowances} allowances, {interest} interest payments")
    return allowances, interest
