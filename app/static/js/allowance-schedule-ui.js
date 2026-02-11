/**
 * Allowance Schedule UI
 * Provides user-friendly schedule selection for allowances
 */

// Day of week names (0=Monday, 6=Sunday)
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Helper: Get next occurrence of a specific day of week
function getNextDayOfWeek(dayOfWeek) {
    const today = new Date();
    const currentDay = (today.getDay() + 6) % 7; // Convert to 0=Mon, 6=Sun
    let daysUntil = dayOfWeek - currentDay;
    if (daysUntil <= 0) daysUntil += 7; // Next week if today or past

    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + daysUntil);
    return nextDate.toISOString().split('T')[0];
}

// Helper: Get next occurrence of a specific day of month
function getNextDayOfMonth(dayOfMonth) {
    const today = new Date();
    let targetDate = new Date(today.getFullYear(), today.getMonth(), dayOfMonth);

    // If target day is today or past, move to next month
    if (targetDate <= today) {
        targetDate = new Date(today.getFullYear(), today.getMonth() + 1, dayOfMonth);
    }

    // Handle months with fewer days (e.g., Feb 30 -> Feb 28)
    const lastDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
    if (dayOfMonth > lastDayOfMonth) {
        targetDate.setDate(lastDayOfMonth);
    }

    return targetDate.toISOString().split('T')[0];
}

// Helper: Format schedule for display
function formatSchedule(frequency, dayOfWeek, dayOfMonth) {
    if (frequency === 'weekly' && dayOfWeek !== null && dayOfWeek !== undefined) {
        return `Every ${DAY_NAMES[dayOfWeek]}`;
    } else if (frequency === 'biweekly' && dayOfWeek !== null && dayOfWeek !== undefined) {
        return `Every other ${DAY_NAMES[dayOfWeek]}`;
    } else if (frequency === 'monthly' && dayOfMonth !== null && dayOfMonth !== undefined) {
        const suffix = getDaySuffix(dayOfMonth);
        return `${dayOfMonth}${suffix} of each month`;
    }
    return frequency.charAt(0).toUpperCase() + frequency.slice(1);
}

function getDaySuffix(day) {
    if (day >= 11 && day <= 13) return 'th';
    switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
}

// Render schedule selector HTML
function renderScheduleSelector(frequency, dayOfWeek, dayOfMonth) {
    let html = '';

    if (frequency === 'weekly' || frequency === 'biweekly') {
        html += `
            <div class="form-group">
                <label>Schedule Day</label>
                <select id="schedule-day-of-week">
        `;

        for (let i = 0; i < 7; i++) {
            const selected = dayOfWeek === i ? 'selected' : '';
            html += `<option value="${i}" ${selected}>${DAY_NAMES[i]}</option>`;
        }

        html += `
                </select>
                <small style="color: #64748b;">
                    ${frequency === 'weekly' ? 'Allowance will be paid every' : 'Allowance will be paid every other'} <span id="selected-day-name">${DAY_NAMES[dayOfWeek || 0]}</span>
                </small>
            </div>
        `;
    } else if (frequency === 'monthly') {
        html += `
            <div class="form-group">
                <label>Day of Month</label>
                <select id="schedule-day-of-month">
        `;

        for (let i = 1; i <= 31; i++) {
            const selected = dayOfMonth === i ? 'selected' : '';
            const suffix = getDaySuffix(i);
            html += `<option value="${i}" ${selected}>${i}${suffix}</option>`;
        }

        html += `
                </select>
                <small style="color: #64748b;">
                    Allowance will be paid on the <span id="selected-day-number">${dayOfMonth || 1}${getDaySuffix(dayOfMonth || 1)}</span> of each month
                </small>
            </div>
        `;
    }

    return html;
}

// Update schedule display when selection changes
function setupScheduleListeners() {
    const dayOfWeekSelect = document.getElementById('schedule-day-of-week');
    const dayOfMonthSelect = document.getElementById('schedule-day-of-month');

    if (dayOfWeekSelect) {
        dayOfWeekSelect.addEventListener('change', function() {
            const dayName = DAY_NAMES[this.value];
            const displayEl = document.getElementById('selected-day-name');
            if (displayEl) displayEl.textContent = dayName;

            // Update next payment date preview
            const nextDate = getNextDayOfWeek(parseInt(this.value));
            updateNextPaymentPreview(nextDate);
        });
    }

    if (dayOfMonthSelect) {
        dayOfMonthSelect.addEventListener('change', function() {
            const day = parseInt(this.value);
            const suffix = getDaySuffix(day);
            const displayEl = document.getElementById('selected-day-number');
            if (displayEl) displayEl.textContent = `${day}${suffix}`;

            // Update next payment date preview
            const nextDate = getNextDayOfMonth(day);
            updateNextPaymentPreview(nextDate);
        });
    }
}

function updateNextPaymentPreview(dateString) {
    const previewEl = document.getElementById('next-payment-preview');
    if (previewEl && dateString) {
        const date = new Date(dateString + 'T00:00:00');
        const formatted = date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        previewEl.innerHTML = `<strong>Next payment:</strong> ${formatted}`;
    }
}

// Get schedule values from form
function getScheduleValues() {
    const frequencySelect = document.getElementById('allowance-frequency');
    const dayOfWeekSelect = document.getElementById('schedule-day-of-week');
    const dayOfMonthSelect = document.getElementById('schedule-day-of-month');

    const frequency = frequencySelect ? frequencySelect.value : null;
    const dayOfWeek = dayOfWeekSelect ? parseInt(dayOfWeekSelect.value) : null;
    const dayOfMonth = dayOfMonthSelect ? parseInt(dayOfMonthSelect.value) : null;

    // Calculate next_payment_date based on schedule
    let nextPaymentDate = null;
    if (frequency === 'weekly' || frequency === 'biweekly') {
        if (dayOfWeek !== null) {
            nextPaymentDate = getNextDayOfWeek(dayOfWeek);
        }
    } else if (frequency === 'monthly') {
        if (dayOfMonth !== null) {
            nextPaymentDate = getNextDayOfMonth(dayOfMonth);
        }
    }

    return {
        frequency,
        day_of_week: (frequency === 'weekly' || frequency === 'biweekly') ? dayOfWeek : null,
        day_of_month: (frequency === 'monthly') ? dayOfMonth : null,
        next_payment_date: nextPaymentDate
    };
}
