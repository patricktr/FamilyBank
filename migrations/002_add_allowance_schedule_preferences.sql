-- Migration: Add allowance schedule preferences
-- Allows users to specify "Every Monday" or "1st of month" instead of just dates

-- Add schedule preference fields to allowance_config
ALTER TABLE allowance_config ADD COLUMN day_of_week INTEGER;
ALTER TABLE allowance_config ADD COLUMN day_of_month INTEGER;

-- day_of_week: 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday
--   Used for weekly and biweekly frequencies
--   NULL means no preference set

-- day_of_month: 1-31
--   Used for monthly frequency
--   NULL means no preference set
--   If day > days in month, uses last day of month (e.g., 31 in Feb becomes 28/29)

-- For existing allowance configs, infer preferences from next_payment_date
UPDATE allowance_config
SET day_of_week = (
    CASE CAST(strftime('%w', next_payment_date) AS INTEGER)
        WHEN 0 THEN 6  -- Sunday -> 6
        ELSE CAST(strftime('%w', next_payment_date) AS INTEGER) - 1  -- Mon-Sat -> 0-5
    END
)
WHERE frequency IN ('weekly', 'biweekly') AND day_of_week IS NULL;

UPDATE allowance_config
SET day_of_month = CAST(strftime('%d', next_payment_date) AS INTEGER)
WHERE frequency = 'monthly' AND day_of_month IS NULL;
