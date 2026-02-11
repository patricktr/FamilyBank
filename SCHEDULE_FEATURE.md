# Allowance Schedule Configuration

## ✅ Feature Complete!

I've added the ability to configure specific days for allowance payments. Now you can set:
- **Weekly**: Which day of the week (Monday, Tuesday, etc.)
- **Biweekly**: Which day of the week (every other week)
- **Monthly**: Which day of the month (1st, 15th, 31st, etc.)

## 📁 Files Modified

### Database:
- **migrations/002_add_allowance_schedule_preferences.sql** (created)
  - Adds `day_of_week` column (0=Monday, 6=Sunday)
  - Adds `day_of_month` column (1-31)
  - Infers preferences from existing allowance dates

### Backend:
- **app/models.py** - Added migration runner for migration 002
- **app/main.py** - Updated API endpoint to accept schedule preferences
- **app/jobs.py** - Updated to calculate next payment date using preferences

### Frontend:
- **app/static/js/allowance-schedule-ui.js** (created)
  - User-friendly dropdowns for selecting days
  - Real-time preview of next payment date
  - Helper functions for calculating dates
- **app/static/js/allowance-splits-ui.js** - Integrated schedule selector
- **app/templates/dashboard.html** - Added script tag

## 🎯 How It Works

### For Users (Parents):
1. Go to **Allowances** in the sidebar
2. Click **⚙️ Settings** for any kid's allowance
3. Select the **Frequency** (weekly, biweekly, or monthly)
4. Choose the specific day:
   - **Weekly/Biweekly**: Select day of week (Monday-Sunday)
   - **Monthly**: Select day of month (1st-31st)
5. See a preview: "Next payment: Monday, Feb 16, 2026"
6. Click **Save Changes**

### Examples:

#### Weekly Allowance on Monday
- **Settings**: Frequency = Weekly, Day = Monday
- **Behavior**: Payment every Monday
- **Example**: Feb 16 → Feb 23 → Mar 2 → Mar 9...

#### Biweekly Allowance on Friday
- **Settings**: Frequency = Biweekly, Day = Friday
- **Behavior**: Payment every other Friday
- **Example**: Feb 13 → Feb 27 → Mar 13 → Mar 27...

#### Monthly Allowance on 15th
- **Settings**: Frequency = Monthly, Day = 15
- **Behavior**: Payment on the 15th of each month
- **Example**: Feb 15 → Mar 15 → Apr 15 → May 15...

#### Monthly Allowance on 31st
- **Settings**: Frequency = Monthly, Day = 31
- **Behavior**: Payment on the 31st (or last day of month)
- **Example**: Jan 31 → Feb 28 → Mar 31 → Apr 30... (handles months with fewer days)

## 🔧 Technical Details

### Schedule Preference Storage:
```sql
-- allowance_config table
day_of_week INTEGER   -- 0-6 for Mon-Sun (NULL if not set)
day_of_month INTEGER  -- 1-31 (NULL if not set)
```

### Date Calculation Logic:

**Weekly**: Find next occurrence of target day after payment date
```python
# If payment was Monday Feb 2, next payment is Monday Feb 9
next_date = _get_next_day_of_week(current_date + timedelta(days=1), day_of_week)
```

**Biweekly**: Find target day 2 weeks out
```python
# If payment was Monday Feb 2, next payment is Monday Feb 16
next_date = _get_next_day_of_week(current_date + timedelta(weeks=2), day_of_week)
```

**Monthly**: Find target day in next month
```python
# If payment was on 15th, next payment is 15th of next month
next_date = _get_next_day_of_month(current_date, day_of_month)
```

### Edge Cases Handled:
✓ Month-end dates (31st in February → Feb 28/29)
✓ Year rollovers (Dec 15 → Jan 15)
✓ Already on target day (biweekly)
✓ Target day in same week (weekly advances to next week)

## 🚀 Deployment Instructions

### Quick Update:
```bash
# SSH into Synology
ssh your-user@synology-ip

# Navigate to FamilyBank
cd /path/to/family-bank

# Pull latest changes
git pull origin main

# Restart containers
docker compose down
docker compose up -d

# Watch logs for migration
docker compose logs -f
```

Look for: `✅ Applied migration 002: Add allowance schedule preferences`

### Verify It's Working:
1. Log in as a parent
2. Go to **Allowances**
3. Click **⚙️ Settings** for any allowance
4. You should see a dropdown for selecting days
5. Change the day and save
6. The preview should update: "Next payment: [Date]"

## 📊 Testing

Run the test suite to verify schedule calculations:
```bash
python3 test_schedule_logic.py
```

Expected output:
```
✅ Weekly schedule tests passed!
✅ Monthly schedule tests passed!
✅ Biweekly schedule tests passed!
🎉 All tests passed!
```

## 💡 Usage Tips

1. **Initial Setup**: When creating a new allowance, the next payment date defaults to the next occurrence of Monday. You can change this to any day you prefer.

2. **Changing Days**: If you change the day after setting up an allowance, the next payment date will be recalculated based on the new preference.

3. **Monthly Edge Cases**: If you set the 31st and the current month only has 30 days, the payment will occur on the 30th.

4. **Biweekly Precision**: Biweekly payments will always be exactly 2 weeks apart on the same day of the week.

## 🐛 Troubleshooting

### Schedule selector not showing:
1. Clear browser cache (Ctrl+Shift+R / Cmd+Shift+R)
2. Check browser console for errors (F12)
3. Verify `/static/js/allowance-schedule-ui.js` exists

### Dates not calculating correctly:
1. Check that migration 002 ran successfully
2. Verify `day_of_week` and `day_of_month` columns exist in database
3. Run test script to verify helper functions

### Next payment date not updating:
1. Ensure allowance is marked as **active**
2. Check that the current `next_payment_date` has passed
3. Run the job manually: `docker exec family-bank python -c "from app.jobs import run_all_jobs; run_all_jobs()"`

## 📸 UI Preview

### Edit Allowance Modal:
```
Edit Allowance - Alice
────────────────────────

Amount: [10.00]

Frequency: [Weekly ▼]

Day of Week: [Monday ▼]

Next payment: Monday, Feb 16, 2026

☑ Active (enable automatic payments)

[Cancel] [Save Changes]
```

### Monthly Example:
```
Edit Allowance - Bob
────────────────────────

Amount: [25.00]

Frequency: [Monthly ▼]

Day of Month: [15 ▼]

Next payment: Saturday, Mar 15, 2026

☑ Active (enable automatic payments)

[Cancel] [Save Changes]
```

## 🎓 Teaching Opportunity

This feature enables teaching kids about:
- **Regularity**: Allowances come on consistent, predictable days
- **Calendar Skills**: Understanding weekly vs monthly cycles
- **Planning**: Knowing when money arrives helps with budgeting
- **Expectations**: Clear schedules set proper expectations

## 🌟 What's Next?

The schedule configuration feature is complete and tested! Your kids' allowances will now be distributed on the specific days you configure.

Try it out:
1. Set Alice's allowance to "Weekly on Monday"
2. Set Bob's allowance to "Monthly on the 15th"
3. Wait for the next scheduled run (daily at 9 AM)
4. Check that payments happen on the configured days!

---

**Feature Status**: ✅ Complete and Tested
**Migration**: 002
**Files Added**: 2
**Files Modified**: 5
**Test Coverage**: ✅ All tests passing
