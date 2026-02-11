# Quick Setup Guide

## 🚀 First Time Setup

### 1. Copy Environment Template

```bash
cp .env.example .env
```

### 2. Generate a Secure Secret Key

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Copy the output - it should look like: `a1b2c3d4e5f6...` (64 characters)

### 3. Edit .env File

```bash
nano .env  # or use your preferred editor
```

Replace the `SECRET_KEY` value with your generated key:

```env
SECRET_KEY=your-newly-generated-secret-key-here
```

### 4. Start the Application

**With Docker:**
```bash
docker compose up -d
```

**Without Docker:**
```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run
python3 run.py
```

### 5. First Login

1. Visit http://localhost:5000
2. Login with default credentials:
   - Username: `admin`
   - Password: `changeme`
3. **Immediately change the password!**
   - Click Settings or your avatar
   - Change Password
   - Use a strong password (12+ characters)

## 🔒 Security Checklist

Before sharing with your family:

- [ ] Created `.env` file with unique SECRET_KEY
- [ ] Changed admin password from default
- [ ] Verified `.env` is in `.gitignore` (it is!)
- [ ] Database file permissions are restrictive
- [ ] Only accessible on home network (no port forwarding)

## 🐳 Docker-Specific Setup

### Verify Environment Variables

Check that Docker is reading your `.env`:

```bash
docker compose config
```

Should show your SECRET_KEY (truncated for security).

### Troubleshooting

**"SECRET_KEY must be set" error:**
```bash
# Make sure .env exists in the same directory as docker-compose.yml
ls -la .env

# If not, copy from example:
cp .env.example .env
nano .env  # Add your secret key
```

**Changes not taking effect:**
```bash
# Recreate containers to pick up new environment variables:
docker compose down
docker compose up -d
```

## 🔄 Updating on Synology

When you pull updates:

```bash
# SSH into Synology
ssh user@synology-ip
cd /path/to/family-bank

# Pull updates
git pull origin main

# Restart (picks up any changes)
docker compose down
docker compose up -d

# Check logs
docker compose logs -f
```

## 📝 Development vs Production

### Development (.env)
```env
SECRET_KEY=dev-key-here
DATABASE_PATH=family_bank.db
FLASK_DEBUG=false  # Keep false even in dev
```

### Production (.env on Synology)
```env
SECRET_KEY=completely-different-production-key-here
DATABASE_PATH=/data/family_bank.db
PORT=5000
FLASK_DEBUG=false  # NEVER true in production!
```

**Important:** Use a **different** SECRET_KEY for each environment!

## 🎓 What Each File Does

| File | Purpose | Commit to Git? |
|------|---------|---------------|
| `.env` | Your actual secrets | ❌ NO - gitignored |
| `.env.example` | Template showing what's needed | ✅ YES |
| `.gitignore` | Tells git what to ignore | ✅ YES |
| `docker-compose.yml` | Docker configuration | ✅ YES |
| `SECURITY.md` | Security best practices | ✅ YES |

## 🆘 Common Issues

### "ModuleNotFoundError: No module named 'dotenv'"

The app doesn't require python-dotenv - it uses environment variables directly.

For Docker: Variables come from docker-compose.yml (which reads .env)
For local: Set environment variables manually or use:

```bash
export $(cat .env | xargs) && python3 run.py
```

### "Permission denied" on .env

```bash
chmod 600 .env  # Owner read/write only
```

### Database locked error

```bash
# Stop all instances
docker compose down
# Or for local:
pkill -f "python.*run.py"

# Restart
docker compose up -d
```

### Can't access from other devices on network

Make sure you're using `0.0.0.0:5000` not `localhost:5000` in run.py:

```python
app.run(host='0.0.0.0', port=5000)  # Accessible from network
# NOT:
app.run(host='localhost', port=5000)  # Only local machine
```

## 🎉 You're All Set!

Your Family Bank is now secure and ready to use:

- ✅ Secrets are not in git
- ✅ Unique SECRET_KEY for session security
- ✅ Admin password changed from default
- ✅ Database and secrets properly protected

Next steps:
1. Add your kids as family members
2. Set up their allowances
3. Create multiple checking accounts with nicknames!
4. Start teaching financial literacy! 💰

Read [SECURITY.md](SECURITY.md) for more security best practices.
