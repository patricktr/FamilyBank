# 🏦 Family Bank

A miniature banking app for teaching kids about money management. Give your kids real checking and savings accounts, automatic allowances, interest on savings, and parent-controlled approvals — all self-hosted on your home network.

## Features

- **Checking & Savings Accounts** — Each kid gets both, with real balances
- **Deposits & Withdrawals** — Parents deposit, kids request withdrawals (with optional approval)
- **Transfers** — Kids can move money between their own checking and savings
- **Automatic Allowance** — Configurable per kid (weekly, biweekly, or monthly)
- **Interest on Savings** — Configurable annual rate with daily/weekly/monthly compounding
- **Parent Approval Flow** — Optionally require approval for withdrawals (configurable threshold)
- **Transaction History** — Full audit trail with categories
- **Multi-User** — Separate logins for parents and kids
- **Mobile-Friendly** — Responsive design works on phones and tablets
- **Self-Hosted** — Runs on a Raspberry Pi, Synology NAS, or any Docker host

## Quick Start (Docker)

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/family-bank.git
cd family-bank

# Start with Docker Compose
docker compose up -d

# Visit http://localhost:5000
# Default login: admin / changeme
```

## Quick Start (Without Docker)

```bash
# Clone and setup
git clone https://github.com/YOUR_USERNAME/family-bank.git
cd family-bank

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run
python run.py

# Visit http://localhost:5000
# Default login: admin / changeme
```

## First-Time Setup

1. Log in with the default parent account: **admin** / **changeme**
2. **Change your password** immediately (Settings → Change Password)
3. **Add your kids** (Family Members → Add Member)
4. **Configure allowances** (Allowances → set amount and frequency per kid)
5. **Configure interest** (Interest Rates → enable and set rate for savings accounts)
6. **Deposit initial funds** (Deposit Money → select a kid's account)

## Deploying on Synology NAS

1. Open **Container Manager** (install from Package Center if needed)
2. Go to **Project** → **Create**
3. Set a project name (e.g., `family-bank`)
4. Upload the code or set the path to your cloned repo
5. Use the included `docker-compose.yml`
6. Click **Build & Start**
7. Access at `http://YOUR_NAS_IP:5000`

## Deploying on Raspberry Pi

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Clone and run
git clone https://github.com/YOUR_USERNAME/family-bank.git
cd family-bank
docker compose up -d
```

## Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | `change-this...` | Session encryption key (change this!) |
| `DATABASE_PATH` | `family_bank.db` | Path to SQLite database |
| `PORT` | `5000` | Port to run on |
| `FLASK_DEBUG` | `false` | Enable debug mode |

## How It Works

### For Kids
- Log in to see checking and savings balances
- Request withdrawals (parents hand over the cash in real life)
- Transfer between checking and savings
- See full transaction history

### For Parents
- See all kids' accounts at a glance
- Deposit money into any kid's account
- Approve or reject withdrawal requests
- Configure per-kid allowance (amount, frequency, target account)
- Configure interest rates on savings accounts
- Manage family members and settings

### Automatic Jobs
A background scheduler runs hourly to:
- Process due allowance payments
- Apply interest to savings accounts

## Tech Stack

- **Backend:** Python / Flask
- **Database:** SQLite (single file, zero config)
- **Frontend:** Vanilla HTML/CSS/JS (no build step)
- **Deployment:** Docker / Docker Compose
- **Fonts:** Fredoka (display) + DM Sans (body)

## Project Structure

```
family-bank/
├── app/
│   ├── __init__.py
│   ├── main.py          # Flask app with all API routes
│   ├── models.py         # Database schema and initialization
│   ├── jobs.py           # Scheduled allowance and interest jobs
│   ├── static/
│   │   ├── css/style.css # All styles
│   │   └── js/
│   │       ├── api.js    # API client
│   │       └── app.js    # Frontend application
│   └── templates/
│       ├── login.html    # Login page
│       └── dashboard.html # Main app shell
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
├── run.py                # Entry point
└── README.md
```

## License

MIT — Do whatever you want with it. Teach those kids about money! 💰
