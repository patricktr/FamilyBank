# Security Best Practices

## 🔐 Secret Management

### Quick Start

1. **Copy the example environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Generate a secure secret key:**
   ```bash
   python3 -c "import secrets; print(secrets.token_hex(32))"
   ```

3. **Update `.env` with your generated key:**
   ```bash
   # Edit .env and replace the SECRET_KEY value
   nano .env
   ```

4. **Never commit `.env` to git:**
   - ✅ Already in `.gitignore`
   - ❌ Never run `git add .env`
   - ❌ Never share your `.env` file

## 🚨 Important Security Notes

### Change Default Password Immediately

The app creates a default admin account:
- Username: `admin`
- Password: `changeme`

**⚠️ Change this immediately after first login!**

1. Log in as admin
2. Click Settings or your avatar
3. Change Password
4. Use a strong password (12+ characters)

### Secret Key

The `SECRET_KEY` is used for:
- Session encryption
- Cookie signing
- CSRF protection

**Requirements:**
- Minimum 32 characters
- Use random, cryptographically secure value
- Different for each deployment (dev, staging, production)
- Keep it secret - never share or commit to git

### Database Security

The SQLite database (`family_bank.db`) contains:
- User passwords (hashed with werkzeug)
- Account balances
- Transaction history

**Protect it by:**
- ✅ Setting proper file permissions (600 or 640)
- ✅ Regular backups
- ✅ Not committing to git (already in `.gitignore`)
- ✅ Keeping it on encrypted storage if possible

## 🐳 Docker Deployment

### Using .env with Docker Compose

Your `docker-compose.yml` can read from `.env`:

```yaml
services:
  app:
    environment:
      - SECRET_KEY=${SECRET_KEY}
      - DATABASE_PATH=${DATABASE_PATH}
      - PORT=${PORT}
```

Docker Compose automatically loads `.env` in the same directory.

### Production Deployment

For production (Synology, VPS, etc.):

1. **Create `.env` on the server:**
   ```bash
   # SSH into server
   ssh user@synology-ip
   cd /path/to/family-bank

   # Copy example and edit
   cp .env.example .env
   nano .env
   ```

2. **Generate a unique secret key** (different from dev):
   ```bash
   python3 -c "import secrets; print(secrets.token_hex(32))"
   ```

3. **Set restrictive permissions:**
   ```bash
   chmod 600 .env
   ```

4. **Restart containers:**
   ```bash
   docker compose down
   docker compose up -d
   ```

## 📋 Security Checklist

Before going to production:

- [ ] Changed default admin password
- [ ] Generated unique SECRET_KEY (not the example one)
- [ ] `.env` file has proper permissions (600)
- [ ] Database file has proper permissions (640 or 600)
- [ ] Using HTTPS (if exposing outside home network)
- [ ] Firewall configured (if exposing outside home network)
- [ ] Regular backups enabled
- [ ] `.env` is in `.gitignore`
- [ ] No secrets in `docker-compose.yml` (use .env instead)

## 🌐 Network Security

### Home Network Only (Recommended)

**Safest option:**
- Only accessible from your home WiFi
- No port forwarding on router
- No HTTPS needed
- Minimal attack surface

### Outside Access (Advanced)

If you need access outside your home:

**Option 1: VPN (Recommended)**
- Use WireGuard or your router's VPN
- Access home network securely
- No need to expose Family Bank directly

**Option 2: Reverse Proxy with HTTPS**
- Use Nginx or Traefik
- Get SSL certificate (Let's Encrypt)
- Set up authentication
- **Not recommended unless you know what you're doing**

## 🔄 Regular Maintenance

### Backup Strategy

1. **Automated backups:**
   ```bash
   # Add to crontab for daily backups
   0 2 * * * cp /path/to/family_bank.db /path/to/backups/family_bank_$(date +\%Y\%m\%d).db
   ```

2. **Git backups** (if using the built-in Git versioning):
   - Already automated via the app
   - Check `.git` directory has backups
   - Can rollback using Git features

3. **Off-site backups:**
   - Copy database to cloud storage (encrypted)
   - Or to external drive

### Security Updates

1. **Keep Docker images updated:**
   ```bash
   docker compose pull
   docker compose up -d
   ```

2. **Keep Python dependencies updated:**
   ```bash
   pip install --upgrade -r requirements.txt
   ```

3. **Monitor for updates:**
   ```bash
   git pull origin main
   ```

## ❌ What NOT to Do

1. **Never commit secrets to git:**
   - ❌ Don't add `.env` to git
   - ❌ Don't put secrets in `docker-compose.yml`
   - ❌ Don't put secrets in code files
   - ✅ Use `.env` and `.gitignore`

2. **Never share your database file:**
   - Contains hashed passwords
   - Contains financial data
   - Keep it private!

3. **Never use the default SECRET_KEY in production:**
   - The example key is public knowledge
   - Anyone can decode your sessions with it
   - Always generate a unique one

4. **Never disable password hashing:**
   - Passwords are hashed with werkzeug
   - Don't modify the auth code
   - Don't store plain passwords

## 🔍 Checking Your Setup

### Verify secrets aren't in git:

```bash
# This should return nothing:
git grep -i "SECRET_KEY.*=" -- '*.yml' '*.yaml' '*.py'

# .env should be ignored:
git check-ignore .env
# Should output: .env
```

### Verify file permissions:

```bash
# .env should be 600 (owner read/write only)
ls -l .env
# Should show: -rw-------

# Database should be 600 or 640
ls -l family_bank.db
# Should show: -rw------- or -rw-r-----
```

### Verify SECRET_KEY is loaded:

```bash
# Run Python and check:
python3 -c "
import os
from dotenv import load_dotenv
load_dotenv()
print('SECRET_KEY loaded:', bool(os.getenv('SECRET_KEY')))
print('Is default?', os.getenv('SECRET_KEY') == 'family-bank-dev-key-change-in-production')
"
```

If "Is default?" shows `True`, **generate a new secret key!**

## 📞 Reporting Security Issues

If you find a security vulnerability:

1. **Don't open a public GitHub issue**
2. Create a private security advisory instead
3. Or email the maintainer directly
4. Provide details about the vulnerability
5. Wait for a fix before disclosing publicly

## 📚 Further Reading

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [Flask Security Considerations](https://flask.palletsprojects.com/en/latest/security/)
- [Python-dotenv Documentation](https://github.com/theskumar/python-dotenv)
