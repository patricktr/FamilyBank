"""Main Flask application for Family Bank."""

import os
import functools
from datetime import datetime, timedelta
from flask import (
    Flask, request, jsonify, session, render_template,
    redirect, url_for, g
)
from werkzeug.security import generate_password_hash, check_password_hash
from app.models import get_db, init_db, seed_demo_data, run_migrations


def create_app():
    app = Flask(__name__)
    app.secret_key = os.environ.get('SECRET_KEY', 'family-bank-dev-key-change-in-production')
    app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=30)

    # Initialize DB on first request
    with app.app_context():
        init_db()
        run_migrations()
        seed_demo_data()

    @app.teardown_appcontext
    def close_db(exception):
        db = g.pop('db', None)
        if db is not None:
            db.close()

    def get_database():
        if 'db' not in g:
            g.db = get_db()
        return g.db

    # ── Auth Decorators ──────────────────────────────────────────────

    def login_required(f):
        @functools.wraps(f)
        def decorated(*args, **kwargs):
            if 'user_id' not in session:
                if request.is_json or request.path.startswith('/api/'):
                    return jsonify({'error': 'Not authenticated'}), 401
                return redirect(url_for('login_page'))
            return f(*args, **kwargs)
        return decorated

    def parent_required(f):
        @functools.wraps(f)
        def decorated(*args, **kwargs):
            if 'user_id' not in session:
                return jsonify({'error': 'Not authenticated'}), 401
            db = get_database()
            user = db.execute('SELECT role FROM users WHERE id = ?', (session['user_id'],)).fetchone()
            if not user or user['role'] != 'parent':
                return jsonify({'error': 'Parent access required'}), 403
            return f(*args, **kwargs)
        return decorated

    def get_setting(key):
        db = get_database()
        row = db.execute('SELECT value FROM settings WHERE key = ?', (key,)).fetchone()
        return row['value'] if row else None

    # ── Page Routes ──────────────────────────────────────────────────

    @app.route('/')
    def index():
        if 'user_id' in session:
            return redirect(url_for('dashboard_page'))
        return redirect(url_for('login_page'))

    @app.route('/login')
    def login_page():
        return render_template('login.html')

    @app.route('/dashboard')
    @login_required
    def dashboard_page():
        return render_template('dashboard.html')

    # ── Auth API ─────────────────────────────────────────────────────

    @app.route('/api/auth/login', methods=['POST'])
    def api_login():
        data = request.get_json()
        username = data.get('username', '').strip().lower()
        password = data.get('password', '')

        db = get_database()
        user = db.execute(
            'SELECT * FROM users WHERE username = ?', (username,)
        ).fetchone()

        if not user or not check_password_hash(user['password_hash'], password):
            return jsonify({'error': 'Invalid username or password'}), 401

        session.permanent = True
        session['user_id'] = user['id']
        session['username'] = user['username']
        session['role'] = user['role']

        return jsonify({
            'id': user['id'],
            'username': user['username'],
            'display_name': user['display_name'],
            'role': user['role'],
            'avatar_color': user['avatar_color']
        })

    @app.route('/api/auth/logout', methods=['POST'])
    def api_logout():
        session.clear()
        return jsonify({'success': True})

    @app.route('/api/auth/me')
    @login_required
    def api_me():
        db = get_database()
        user = db.execute(
            'SELECT id, username, display_name, role, avatar_color FROM users WHERE id = ?',
            (session['user_id'],)
        ).fetchone()
        if not user:
            session.clear()
            return jsonify({'error': 'User not found'}), 401
        return jsonify(dict(user))

    @app.route('/api/auth/change-password', methods=['POST'])
    @login_required
    def api_change_password():
        data = request.get_json()
        current = data.get('current_password', '')
        new = data.get('new_password', '')

        if len(new) < 4:
            return jsonify({'error': 'Password must be at least 4 characters'}), 400

        db = get_database()
        user = db.execute('SELECT password_hash FROM users WHERE id = ?', (session['user_id'],)).fetchone()

        if not check_password_hash(user['password_hash'], current):
            return jsonify({'error': 'Current password is incorrect'}), 401

        db.execute(
            'UPDATE users SET password_hash = ? WHERE id = ?',
            (generate_password_hash(new), session['user_id'])
        )
        db.commit()
        return jsonify({'success': True})

    # ── Accounts API ─────────────────────────────────────────────────

    @app.route('/api/accounts')
    @login_required
    def api_accounts():
        db = get_database()
        user = db.execute('SELECT role FROM users WHERE id = ?', (session['user_id'],)).fetchone()

        if user['role'] == 'parent':
            # Parents see all accounts
            accounts = db.execute('''
                SELECT a.*, u.display_name as owner_name, u.username as owner_username
                FROM accounts a JOIN users u ON a.user_id = u.id
                ORDER BY u.role DESC, u.display_name, a.account_type
            ''').fetchall()
        else:
            # Kids see only their own
            accounts = db.execute('''
                SELECT a.*, u.display_name as owner_name, u.username as owner_username
                FROM accounts a JOIN users u ON a.user_id = u.id
                WHERE a.user_id = ?
                ORDER BY a.account_type
            ''', (session['user_id'],)).fetchall()

        return jsonify([dict(a) for a in accounts])

    @app.route('/api/accounts/checking', methods=['POST'])
    @login_required
    def api_create_checking_account():
        """Create a new checking account with nickname."""
        data = request.get_json()
        target_user_id = data.get('user_id')  # For parents creating accounts for kids
        nickname = data.get('nickname', '').strip()

        if not nickname:
            return jsonify({'error': 'Nickname is required'}), 400

        db = get_database()
        user = db.execute('SELECT role FROM users WHERE id = ?', (session['user_id'],)).fetchone()

        # Determine which user the account is for
        if user['role'] == 'parent' and target_user_id:
            # Parent creating account for a kid
            creating_for_user_id = target_user_id
        else:
            # Kid creating for themselves (need permission check)
            creating_for_user_id = session['user_id']

            # Check if kids can create checking accounts
            kids_can_create = get_setting('kids_can_create_checking') == 'true'
            if user['role'] != 'parent' and not kids_can_create:
                return jsonify({'error': 'You do not have permission to create checking accounts'}), 403

        # Check limit on checking accounts
        max_accounts = int(get_setting('max_checking_accounts_per_kid') or 5)
        current_count = db.execute(
            "SELECT COUNT(*) as count FROM accounts WHERE user_id = ? AND account_type = 'checking'",
            (creating_for_user_id,)
        ).fetchone()['count']

        if current_count >= max_accounts:
            return jsonify({'error': f'Maximum of {max_accounts} checking accounts allowed'}), 400

        # Check if nickname is already used by this user
        existing = db.execute(
            "SELECT id FROM accounts WHERE user_id = ? AND nickname = ? AND account_type = 'checking'",
            (creating_for_user_id, nickname)
        ).fetchone()

        if existing:
            return jsonify({'error': 'A checking account with this nickname already exists'}), 409

        # Create the checking account
        is_first = current_count == 0
        db.execute(
            'INSERT INTO accounts (user_id, account_type, nickname, is_default, balance) VALUES (?, ?, ?, ?, ?)',
            (creating_for_user_id, 'checking', nickname, 1 if is_first else 0, 0.00)
        )
        account_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]

        db.commit()
        return jsonify({
            'success': True,
            'account_id': account_id,
            'message': f'Checking account "{nickname}" created successfully'
        })

    @app.route('/api/accounts/<int:account_id>/nickname', methods=['PUT'])
    @login_required
    def api_update_account_nickname(account_id):
        """Update account nickname."""
        data = request.get_json()
        nickname = data.get('nickname', '').strip()

        if not nickname:
            return jsonify({'error': 'Nickname is required'}), 400

        db = get_database()
        account = db.execute('SELECT * FROM accounts WHERE id = ?', (account_id,)).fetchone()

        if not account:
            return jsonify({'error': 'Account not found'}), 404

        user = db.execute('SELECT role FROM users WHERE id = ?', (session['user_id'],)).fetchone()

        # Check permission
        if user['role'] != 'parent' and account['user_id'] != session['user_id']:
            return jsonify({'error': 'Access denied'}), 403

        # Check if nickname is already used
        existing = db.execute(
            "SELECT id FROM accounts WHERE user_id = ? AND nickname = ? AND account_type = ? AND id != ?",
            (account['user_id'], nickname, account['account_type'], account_id)
        ).fetchone()

        if existing:
            return jsonify({'error': 'This nickname is already used for another account'}), 409

        db.execute('UPDATE accounts SET nickname = ? WHERE id = ?', (nickname, account_id))
        db.commit()

        return jsonify({'success': True, 'message': f'Account nickname updated to "{nickname}"'})

    @app.route('/api/accounts/<int:account_id>/set-default', methods=['POST'])
    @login_required
    def api_set_default_account(account_id):
        """Set an account as the default for its type."""
        db = get_database()
        account = db.execute('SELECT * FROM accounts WHERE id = ?', (account_id,)).fetchone()

        if not account:
            return jsonify({'error': 'Account not found'}), 404

        user = db.execute('SELECT role FROM users WHERE id = ?', (session['user_id'],)).fetchone()

        # Check permission
        if user['role'] != 'parent' and account['user_id'] != session['user_id']:
            return jsonify({'error': 'Access denied'}), 403

        # Unset other defaults of same type for this user
        db.execute(
            'UPDATE accounts SET is_default = 0 WHERE user_id = ? AND account_type = ?',
            (account['user_id'], account['account_type'])
        )

        # Set this one as default
        db.execute('UPDATE accounts SET is_default = 1 WHERE id = ?', (account_id,))
        db.commit()

        return jsonify({'success': True, 'message': 'Default account updated'})

    @app.route('/api/accounts/<int:account_id>/transactions')
    @login_required
    def api_account_transactions(account_id):
        db = get_database()
        user = db.execute('SELECT role FROM users WHERE id = ?', (session['user_id'],)).fetchone()

        # Verify access
        account = db.execute('SELECT * FROM accounts WHERE id = ?', (account_id,)).fetchone()
        if not account:
            return jsonify({'error': 'Account not found'}), 404
        if user['role'] != 'parent' and account['user_id'] != session['user_id']:
            return jsonify({'error': 'Access denied'}), 403

        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)

        transactions = db.execute('''
            SELECT t.*,
                fa.account_type as from_account_type,
                fu.display_name as from_user_name,
                ta.account_type as to_account_type,
                tu.display_name as to_user_name,
                ru.display_name as reviewer_name
            FROM transactions t
            LEFT JOIN accounts fa ON t.from_account_id = fa.id
            LEFT JOIN users fu ON fa.user_id = fu.id
            LEFT JOIN accounts ta ON t.to_account_id = ta.id
            LEFT JOIN users tu ON ta.user_id = tu.id
            LEFT JOIN users ru ON t.reviewed_by = ru.id
            WHERE t.from_account_id = ? OR t.to_account_id = ?
            ORDER BY t.created_at DESC
            LIMIT ? OFFSET ?
        ''', (account_id, account_id, limit, offset)).fetchall()

        return jsonify([dict(t) for t in transactions])

    # ── Transaction API ──────────────────────────────────────────────

    @app.route('/api/transactions/deposit', methods=['POST'])
    @parent_required
    def api_deposit():
        """Parent deposits money into a kid's account."""
        data = request.get_json()
        to_account_id = data.get('to_account_id')
        amount = data.get('amount', 0)
        category = data.get('category', 'General')
        description = data.get('description', '')

        if not to_account_id or amount <= 0:
            return jsonify({'error': 'Invalid deposit'}), 400

        db = get_database()
        to_account = db.execute('SELECT * FROM accounts WHERE id = ?', (to_account_id,)).fetchone()
        if not to_account:
            return jsonify({'error': 'Account not found'}), 404

        # Get parent vault
        vault = db.execute(
            "SELECT * FROM accounts WHERE user_id = ? AND account_type = 'parent_vault'",
            (session['user_id'],)
        ).fetchone()

        if not vault:
            return jsonify({'error': 'Parent vault not found'}), 500

        # Create transaction
        db.execute('''
            INSERT INTO transactions (from_account_id, to_account_id, amount, transaction_type, category, description, status)
            VALUES (?, ?, ?, 'parent_deposit', ?, ?, 'completed')
        ''', (vault['id'], to_account_id, amount, category, description))

        # Update balance
        db.execute(
            'UPDATE accounts SET balance = balance + ? WHERE id = ?',
            (amount, to_account_id)
        )

        db.commit()
        return jsonify({'success': True, 'message': f'${amount:.2f} deposited successfully'})

    @app.route('/api/transactions/withdraw', methods=['POST'])
    @login_required
    def api_withdraw():
        """Kid requests a withdrawal (may require approval)."""
        data = request.get_json()
        from_account_id = data.get('from_account_id')
        amount = data.get('amount', 0)
        category = data.get('category', 'General')
        description = data.get('description', '')

        if not from_account_id or amount <= 0:
            return jsonify({'error': 'Invalid withdrawal'}), 400

        db = get_database()
        account = db.execute('SELECT * FROM accounts WHERE id = ?', (from_account_id,)).fetchone()
        if not account:
            return jsonify({'error': 'Account not found'}), 404

        user = db.execute('SELECT role FROM users WHERE id = ?', (session['user_id'],)).fetchone()

        # Verify ownership (kids can only withdraw from own accounts)
        if user['role'] != 'parent' and account['user_id'] != session['user_id']:
            return jsonify({'error': 'Access denied'}), 403

        if account['balance'] < amount:
            return jsonify({'error': 'Insufficient funds'}), 400

        # Check if approval is required
        approval_required = get_setting('withdrawal_approval_required') == 'true'
        max_no_approval = float(get_setting('max_withdrawal_without_approval') or 0)

        # Parents never need approval
        if user['role'] == 'parent':
            needs_approval = False
        else:
            needs_approval = approval_required and amount > max_no_approval

        status = 'pending' if needs_approval else 'completed'

        db.execute('''
            INSERT INTO transactions (from_account_id, amount, transaction_type, category, description, status)
            VALUES (?, ?, 'withdrawal', ?, ?, ?)
        ''', (from_account_id, amount, category, description, status))

        if not needs_approval:
            db.execute(
                'UPDATE accounts SET balance = balance - ? WHERE id = ?',
                (amount, from_account_id)
            )

        db.commit()

        if needs_approval:
            return jsonify({
                'success': True,
                'message': f'Withdrawal of ${amount:.2f} submitted for parent approval',
                'status': 'pending'
            })
        return jsonify({
            'success': True,
            'message': f'${amount:.2f} withdrawn successfully',
            'status': 'completed'
        })

    @app.route('/api/transactions/transfer', methods=['POST'])
    @login_required
    def api_transfer():
        """Transfer between own accounts (checking <-> savings)."""
        data = request.get_json()
        from_account_id = data.get('from_account_id')
        to_account_id = data.get('to_account_id')
        amount = data.get('amount', 0)
        description = data.get('description', 'Transfer')

        if not from_account_id or not to_account_id or amount <= 0:
            return jsonify({'error': 'Invalid transfer'}), 400

        if from_account_id == to_account_id:
            return jsonify({'error': 'Cannot transfer to same account'}), 400

        db = get_database()
        from_acct = db.execute('SELECT * FROM accounts WHERE id = ?', (from_account_id,)).fetchone()
        to_acct = db.execute('SELECT * FROM accounts WHERE id = ?', (to_account_id,)).fetchone()

        if not from_acct or not to_acct:
            return jsonify({'error': 'Account not found'}), 404

        user = db.execute('SELECT role FROM users WHERE id = ?', (session['user_id'],)).fetchone()

        # Kids can only transfer between their own accounts
        if user['role'] != 'parent':
            if from_acct['user_id'] != session['user_id'] or to_acct['user_id'] != session['user_id']:
                return jsonify({'error': 'You can only transfer between your own accounts'}), 403

        if from_acct['account_type'] != 'parent_vault' and from_acct['balance'] < amount:
            return jsonify({'error': 'Insufficient funds'}), 400

        db.execute('''
            INSERT INTO transactions (from_account_id, to_account_id, amount, transaction_type, category, description, status)
            VALUES (?, ?, ?, 'transfer', 'Transfer', ?, 'completed')
        ''', (from_account_id, to_account_id, amount, description))

        if from_acct['account_type'] != 'parent_vault':
            db.execute('UPDATE accounts SET balance = balance - ? WHERE id = ?', (amount, from_account_id))
        db.execute('UPDATE accounts SET balance = balance + ? WHERE id = ?', (amount, to_account_id))

        db.commit()
        return jsonify({'success': True, 'message': f'${amount:.2f} transferred successfully'})

    # ── Approval API ─────────────────────────────────────────────────

    @app.route('/api/transactions/pending')
    @parent_required
    def api_pending_transactions():
        db = get_database()
        pending = db.execute('''
            SELECT t.*, a.account_type, u.display_name as requester_name
            FROM transactions t
            JOIN accounts a ON t.from_account_id = a.id
            JOIN users u ON a.user_id = u.id
            WHERE t.status = 'pending'
            ORDER BY t.created_at DESC
        ''').fetchall()
        return jsonify([dict(p) for p in pending])

    @app.route('/api/transactions/<int:txn_id>/approve', methods=['POST'])
    @parent_required
    def api_approve(txn_id):
        db = get_database()
        txn = db.execute('SELECT * FROM transactions WHERE id = ? AND status = ?', (txn_id, 'pending')).fetchone()
        if not txn:
            return jsonify({'error': 'Transaction not found or already processed'}), 404

        account = db.execute('SELECT * FROM accounts WHERE id = ?', (txn['from_account_id'],)).fetchone()
        if account['balance'] < txn['amount']:
            return jsonify({'error': 'Insufficient funds in account'}), 400

        db.execute('''
            UPDATE transactions SET status = 'approved', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (session['user_id'], txn_id))

        db.execute('UPDATE accounts SET balance = balance - ? WHERE id = ?',
                   (txn['amount'], txn['from_account_id']))

        db.commit()
        return jsonify({'success': True, 'message': 'Withdrawal approved'})

    @app.route('/api/transactions/<int:txn_id>/reject', methods=['POST'])
    @parent_required
    def api_reject(txn_id):
        db = get_database()
        data = request.get_json() or {}
        reason = data.get('reason', '')

        txn = db.execute('SELECT * FROM transactions WHERE id = ? AND status = ?', (txn_id, 'pending')).fetchone()
        if not txn:
            return jsonify({'error': 'Transaction not found or already processed'}), 404

        db.execute('''
            UPDATE transactions SET status = 'rejected', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP,
            description = CASE WHEN ? != '' THEN description || ' [Rejected: ' || ? || ']' ELSE description END
            WHERE id = ?
        ''', (session['user_id'], reason, reason, txn_id))

        db.commit()
        return jsonify({'success': True, 'message': 'Withdrawal rejected'})

    # ── Admin API (Parents) ──────────────────────────────────────────

    @app.route('/api/admin/users')
    @parent_required
    def api_list_users():
        db = get_database()
        users = db.execute('''
            SELECT id, username, display_name, role, avatar_color, created_at
            FROM users ORDER BY role DESC, display_name
        ''').fetchall()
        return jsonify([dict(u) for u in users])

    @app.route('/api/admin/users', methods=['POST'])
    @parent_required
    def api_create_user():
        data = request.get_json()
        username = data.get('username', '').strip().lower()
        display_name = data.get('display_name', '').strip()
        password = data.get('password', '')
        role = data.get('role', 'kid')
        avatar_color = data.get('avatar_color', '#6366f1')

        if not username or not display_name or not password:
            return jsonify({'error': 'All fields are required'}), 400
        if len(password) < 4:
            return jsonify({'error': 'Password must be at least 4 characters'}), 400
        if role not in ('parent', 'kid'):
            return jsonify({'error': 'Invalid role'}), 400

        db = get_database()
        existing = db.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone()
        if existing:
            return jsonify({'error': 'Username already taken'}), 409

        db.execute(
            'INSERT INTO users (username, display_name, password_hash, role, avatar_color) VALUES (?, ?, ?, ?, ?)',
            (username, display_name, generate_password_hash(password), role, avatar_color)
        )
        user_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]

        if role == 'kid':
            # Create checking and savings accounts with default nicknames
            db.execute(
                'INSERT INTO accounts (user_id, account_type, nickname, is_default, balance) VALUES (?, ?, ?, ?, ?)',
                (user_id, 'checking', 'Main', 1, 0.00)
            )
            checking_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]

            db.execute(
                'INSERT INTO accounts (user_id, account_type, nickname, is_default, balance) VALUES (?, ?, ?, ?, ?)',
                (user_id, 'savings', 'Savings', 1, 0.00)
            )
            savings_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]

            # Create default allowance config
            from datetime import date
            next_monday = date.today() + timedelta(days=(7 - date.today().weekday()))
            db.execute(
                'INSERT INTO allowance_config (user_id, amount, frequency, next_payment_date, active) VALUES (?, ?, ?, ?, ?)',
                (user_id, 0.00, 'weekly', next_monday.isoformat(), 0)
            )
            allowance_config_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]

            # Create default allowance split (100% to main checking account)
            db.execute(
                'INSERT INTO allowance_splits (allowance_config_id, account_id, percentage) VALUES (?, ?, ?)',
                (allowance_config_id, checking_id, 100.0)
            )

            # Create interest config for savings account
            db.execute(
                'INSERT INTO interest_config (account_id, annual_rate, compound_frequency, active) VALUES (?, ?, ?, ?)',
                (savings_id, 5.0, 'monthly', 0)
            )
        elif role == 'parent':
            db.execute(
                'INSERT INTO accounts (user_id, account_type, nickname, is_default, balance) VALUES (?, ?, ?, ?, ?)',
                (user_id, 'parent_vault', 'Vault', 1, 999999999.00)
            )

        db.commit()
        return jsonify({'success': True, 'user_id': user_id, 'message': f'User {display_name} created'})

    @app.route('/api/admin/users/<int:user_id>', methods=['PUT'])
    @parent_required
    def api_update_user(user_id):
        data = request.get_json()
        db = get_database()

        user = db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
        if not user:
            return jsonify({'error': 'User not found'}), 404

        display_name = data.get('display_name', user['display_name'])
        avatar_color = data.get('avatar_color', user['avatar_color'])

        db.execute(
            'UPDATE users SET display_name = ?, avatar_color = ? WHERE id = ?',
            (display_name, avatar_color, user_id)
        )

        # Reset password if provided
        new_password = data.get('new_password')
        if new_password and len(new_password) >= 4:
            db.execute(
                'UPDATE users SET password_hash = ? WHERE id = ?',
                (generate_password_hash(new_password), user_id)
            )

        db.commit()
        return jsonify({'success': True})

    # ── Allowance Config API ─────────────────────────────────────────

    @app.route('/api/admin/allowances')
    @parent_required
    def api_list_allowances():
        db = get_database()
        configs = db.execute('''
            SELECT ac.*, u.display_name, u.username
            FROM allowance_config ac
            JOIN users u ON ac.user_id = u.id
            ORDER BY u.display_name
        ''').fetchall()
        return jsonify([dict(c) for c in configs])

    @app.route('/api/admin/allowances/<int:config_id>', methods=['PUT'])
    @parent_required
    def api_update_allowance(config_id):
        data = request.get_json()
        db = get_database()

        config = db.execute('SELECT * FROM allowance_config WHERE id = ?', (config_id,)).fetchone()
        if not config:
            return jsonify({'error': 'Config not found'}), 404

        amount = data.get('amount', config['amount'])
        frequency = data.get('frequency', config['frequency'])
        target = data.get('target_account_type', config['target_account_type'])
        active = data.get('active', config['active'])
        next_date = data.get('next_payment_date', config['next_payment_date'])

        db.execute('''
            UPDATE allowance_config
            SET amount = ?, frequency = ?, target_account_type = ?, active = ?, next_payment_date = ?
            WHERE id = ?
        ''', (amount, frequency, target, active, next_date, config_id))

        db.commit()
        return jsonify({'success': True})

    @app.route('/api/admin/allowances/<int:config_id>/splits')
    @parent_required
    def api_get_allowance_splits(config_id):
        """Get allowance split configuration for a user's allowance."""
        db = get_database()

        config = db.execute('SELECT * FROM allowance_config WHERE id = ?', (config_id,)).fetchone()
        if not config:
            return jsonify({'error': 'Config not found'}), 404

        splits = db.execute('''
            SELECT s.*, a.nickname, a.account_type, a.balance
            FROM allowance_splits s
            JOIN accounts a ON s.account_id = a.id
            WHERE s.allowance_config_id = ?
            ORDER BY a.account_type, s.percentage DESC
        ''', (config_id,)).fetchall()

        return jsonify([dict(s) for s in splits])

    @app.route('/api/admin/allowances/<int:config_id>/splits', methods=['PUT'])
    @parent_required
    def api_update_allowance_splits(config_id):
        """Update allowance splits across multiple checking accounts."""
        data = request.get_json()
        splits = data.get('splits', [])  # List of {account_id, percentage}

        if not splits:
            return jsonify({'error': 'At least one split is required'}), 400

        # Validate percentages add up to 100
        total_percentage = sum(s.get('percentage', 0) for s in splits)
        if abs(total_percentage - 100.0) > 0.01:  # Allow small floating point errors
            return jsonify({'error': f'Percentages must add up to 100% (currently {total_percentage}%)'}), 400

        # Validate each percentage is between 0 and 100
        for split in splits:
            if split.get('percentage', 0) < 0 or split.get('percentage', 0) > 100:
                return jsonify({'error': 'Each percentage must be between 0 and 100'}), 400

        db = get_database()

        config = db.execute('SELECT * FROM allowance_config WHERE id = ?', (config_id,)).fetchone()
        if not config:
            return jsonify({'error': 'Config not found'}), 404

        # Verify all accounts belong to the user and are checking or savings accounts
        for split in splits:
            account = db.execute(
                'SELECT * FROM accounts WHERE id = ? AND user_id = ? AND account_type IN (?, ?)',
                (split['account_id'], config['user_id'], 'checking', 'savings')
            ).fetchone()
            if not account:
                return jsonify({'error': f'Invalid account {split["account_id"]} - must be a checking or savings account for this user'}), 400

        # Delete existing splits
        db.execute('DELETE FROM allowance_splits WHERE allowance_config_id = ?', (config_id,))

        # Insert new splits
        for split in splits:
            db.execute(
                'INSERT INTO allowance_splits (allowance_config_id, account_id, percentage) VALUES (?, ?, ?)',
                (config_id, split['account_id'], split['percentage'])
            )

        db.commit()
        return jsonify({'success': True, 'message': 'Allowance splits updated successfully'})

    # ── Interest Config API ──────────────────────────────────────────

    @app.route('/api/admin/interest')
    @parent_required
    def api_list_interest():
        db = get_database()
        configs = db.execute('''
            SELECT ic.*, a.account_type, u.display_name, u.username
            FROM interest_config ic
            JOIN accounts a ON ic.account_id = a.id
            JOIN users u ON a.user_id = u.id
            ORDER BY u.display_name
        ''').fetchall()
        return jsonify([dict(c) for c in configs])

    @app.route('/api/admin/interest/<int:config_id>', methods=['PUT'])
    @parent_required
    def api_update_interest(config_id):
        data = request.get_json()
        db = get_database()

        config = db.execute('SELECT * FROM interest_config WHERE id = ?', (config_id,)).fetchone()
        if not config:
            return jsonify({'error': 'Config not found'}), 404

        rate = data.get('annual_rate', config['annual_rate'])
        freq = data.get('compound_frequency', config['compound_frequency'])
        active = data.get('active', config['active'])

        db.execute('''
            UPDATE interest_config SET annual_rate = ?, compound_frequency = ?, active = ?
            WHERE id = ?
        ''', (rate, freq, active, config_id))

        db.commit()
        return jsonify({'success': True})

    # ── Settings API ─────────────────────────────────────────────────

    @app.route('/api/admin/settings')
    @parent_required
    def api_get_settings():
        db = get_database()
        settings = db.execute('SELECT key, value FROM settings').fetchall()
        return jsonify({s['key']: s['value'] for s in settings})

    @app.route('/api/admin/settings', methods=['PUT'])
    @parent_required
    def api_update_settings():
        data = request.get_json()
        db = get_database()
        for key, value in data.items():
            db.execute(
                'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
                (key, str(value))
            )
        db.commit()
        return jsonify({'success': True})

    # ── Categories API ───────────────────────────────────────────────

    @app.route('/api/categories')
    @login_required
    def api_categories():
        db = get_database()
        categories = db.execute('SELECT * FROM categories ORDER BY name').fetchall()
        return jsonify([dict(c) for c in categories])

    # ── Dashboard Stats API ──────────────────────────────────────────

    @app.route('/api/dashboard')
    @login_required
    def api_dashboard():
        db = get_database()
        user = db.execute('SELECT * FROM users WHERE id = ?', (session['user_id'],)).fetchone()

        if user['role'] == 'parent':
            # Get all kid accounts with recent activity
            kids = db.execute("SELECT * FROM users WHERE role = 'kid' ORDER BY display_name").fetchall()
            kid_data = []
            for kid in kids:
                accounts = db.execute(
                    'SELECT * FROM accounts WHERE user_id = ?', (kid['id'],)
                ).fetchall()
                kid_data.append({
                    'user': dict(kid),
                    'accounts': [dict(a) for a in accounts]
                })

            pending_count = db.execute(
                "SELECT COUNT(*) as count FROM transactions WHERE status = 'pending'"
            ).fetchone()['count']

            return jsonify({
                'role': 'parent',
                'kids': kid_data,
                'pending_approvals': pending_count
            })
        else:
            # Kid dashboard
            accounts = db.execute(
                'SELECT * FROM accounts WHERE user_id = ?', (session['user_id'],)
            ).fetchall()

            recent = db.execute('''
                SELECT t.*, fa.account_type as from_type, ta.account_type as to_type
                FROM transactions t
                LEFT JOIN accounts fa ON t.from_account_id = fa.id
                LEFT JOIN accounts ta ON t.to_account_id = ta.id
                WHERE fa.user_id = ? OR ta.user_id = ?
                ORDER BY t.created_at DESC LIMIT 10
            ''', (session['user_id'], session['user_id'])).fetchall()

            pending = db.execute('''
                SELECT COUNT(*) as count FROM transactions t
                JOIN accounts a ON t.from_account_id = a.id
                WHERE a.user_id = ? AND t.status = 'pending'
            ''', (session['user_id'],)).fetchone()['count']

            return jsonify({
                'role': 'kid',
                'accounts': [dict(a) for a in accounts],
                'recent_transactions': [dict(t) for t in recent],
                'pending_withdrawals': pending
            })

    return app
