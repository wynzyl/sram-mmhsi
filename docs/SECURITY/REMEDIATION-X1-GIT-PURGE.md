# X-1: Git History Purge Remediation

## Issue

A database dump file `srams_backup.sql` was committed to git history (commit `77c4a08`), containing:
- Personally Identifiable Information (PII)
- Medical history data
- Password hashes
- Other sensitive data

## Remediation Steps

### Prerequisites

1. Install `git-filter-repo`:
   ```bash
   pip install git-filter-repo
   ```

2. Ensure all collaborators have pushed their changes
3. Back up the repository before proceeding

### Step 1: Purge the File from History

```bash
# Navigate to repository root
cd E:\Projects\SRAMS\SRAMS-MMHSI

# Create a backup
git clone --mirror . ../SRAMS-MMHSI-backup

# Remove the file from all history
git filter-repo --path srams_backup.sql --invert-paths
```

### Step 2: Force Push to Remote

```bash
# Force push all branches
git push origin --force --all

# Force push all tags
git push origin --force --tags
```

### Step 3: Notify Collaborators

All collaborators must:
1. Delete their local clone
2. Re-clone the repository fresh

```bash
# Delete local clone
rm -rf SRAMS-MMHSI

# Fresh clone
git clone <repository-url>
```

### Step 4: Rotate Compromised Credentials

Since the backup may have contained sensitive data:

1. **Rotate AUTH_SECRET:**
   - Generate new secret: `openssl rand -base64 32`
   - Update in `.env.local` and any deployment secrets
   - This invalidates all active sessions (users must re-login)

2. **Rotate Database Credentials:**
   - Change PostgreSQL password
   - Update DATABASE_URL in all environments

3. **Force Password Reset for Admin Accounts:**
   - Set `forcePasswordChange: true` for all seeded/admin users
   - Or regenerate password hashes with new passwords

### Step 5: Verify Remediation

```bash
# Verify file is removed from history
git log --all --full-history -- srams_backup.sql

# Should return no results
```

### Step 6: Document Incident

Add entry to CHANGELOG.md:

```markdown
## [Security] - YYYY-MM-DD

### Fixed
- Removed database dump from git history (security incident X-1)
- Updated .gitignore to prevent future accidental commits of SQL files
```

## Prevention

The `.gitignore` has been updated to prevent future accidental commits:

```gitignore
# Database dumps and backups (SECURITY: prevent accidental commits)
*.sql
*backup*.sql
*.dump
*.bak
!drizzle/*.sql
```

## Status

- [x] .gitignore updated
- [ ] File purged from history (requires manual execution)
- [ ] Remote force-pushed
- [ ] Collaborators notified
- [ ] AUTH_SECRET rotated
- [ ] Database credentials rotated
- [ ] Admin passwords reset
- [ ] Incident documented in CHANGELOG
