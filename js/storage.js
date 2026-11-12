const STORAGE_KEY = "genesis_sleep_logs";
const SCHEDULE_KEY = "genesis_generated_schedule";

function getSleepLogs() {
    try {
        const logs = localStorage.getItem(STORAGE_KEY);
        const parsedLogs = logs ? JSON.parse(logs) : [];

        return Array.isArray(parsedLogs) ? parsedLogs : [];
    } catch (error) {
        console.error("Could not read sleep logs:", error);
        return [];
    }
}

function saveSleepLog(report) {
    const logs = getSleepLogs();

    const existingIndex = logs.findIndex(
        log => log.date === report.date
    );

    if (existingIndex !== -1) {
        logs[existingIndex] = report;
    } else {
        logs.push(report);
    }

    logs.sort((a, b) => a.date.localeCompare(b.date));

    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
}

function getSleepLog(date) { // gets report
    return getSleepLogs().find(log => log.date === date) || null;
}

function deleteSleepLog(date) { // delete report
    const logs = getSleepLogs().filter(
        log => log.date !== date
    );

    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
}

function calculateSleepDuration(bedtime, wakeTime) { // calc
    const timePattern = /^([01]?\d|2[0-3]):[0-5]\d$/;

    if (
        typeof bedtime !== "string" ||
        typeof wakeTime !== "string" ||
        !timePattern.test(bedtime) ||
        !timePattern.test(wakeTime)
    ) {
        throw new Error("Invalid time. Use HH:MM format.");
    }

    const [bedHour, bedMinute] = bedtime.split(":").map(Number);
    const [wakeHour, wakeMinute] = wakeTime.split(":").map(Number);

    let bedtimeMinutes = bedHour * 60 + bedMinute;
    let wakeMinutes = wakeHour * 60 + wakeMinute;

    if (wakeMinutes <= bedtimeMinutes) {
        wakeMinutes += 1440;
    }

    return (wakeMinutes - bedtimeMinutes) / 60;
}

function saveGeneratedSchedule(schedule, startDate, shiftDirection, requiredSleepHours, missionPriority) {
    const savedSchedule = {
        schedule: schedule,
        startDate: startDate,
        shiftDirection: shiftDirection,
        requiredSleepHours: requiredSleepHours,
        missionPriority: missionPriority
    };

    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(savedSchedule));
}

function getGeneratedSchedule() {
    try {
        const savedSchedule = localStorage.getItem(SCHEDULE_KEY);
        return savedSchedule ? JSON.parse(savedSchedule) : null;
    } catch (error) {
        console.error("Could not read generated schedule:", error);
        return null;
    }
}

// estimates recent sleep debt using the last 7 calendar days of reports
// adds up hours missed compared with the astronaut's recorded sleep need
function calculateRecentSleepDebt(logs) {

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);

    let sleepDebtHours = 0;

    logs.forEach(function(log) {

        if (!log || typeof log.date !== 'string') {
            return;
        }

        const logDate = new Date(log.date + 'T00:00:00');

        if (
            Number.isNaN(logDate.getTime()) ||
            logDate < sevenDaysAgo ||
            logDate > today
        ) {
            return;
        }

        const requiredHours = Number(log.requiredSleepHours);
        const actualHours = Number(log.duration);

        if (
            Number.isFinite(requiredHours) &&
            requiredHours > 0 &&
            requiredHours <= 24 &&
            Number.isFinite(actualHours) &&
            actualHours >= 0 &&
            actualHours < 24
        ) {
            sleepDebtHours += Math.max(0, requiredHours - actualHours);
        }
    });

    return Number(sleepDebtHours.toFixed(2));
}

function getSleepFeedbackSummary(requiredSleepHours) {
    const logs = getSleepLogs()
        .filter(log => log && typeof log.date === "string")
        .sort((a, b) => a.date.localeCompare(b.date));

    const reportsWithSchedule = logs.filter(
        log => typeof log.onSchedule === "boolean"
    );

    const poorSleepReports = logs.filter(log => {
        const sleptPoorly =
            log.sleptWell === "no" || log.quality === "poor";

        const requiredHours =
            Number.isFinite(Number(log.requiredSleepHours)) &&
            Number(log.requiredSleepHours) > 0
                ? Number(log.requiredSleepHours)
                : requiredSleepHours;

        const sleptTooLittle =
            Number.isFinite(requiredHours) &&
            requiredHours > 0 &&
            Number.isFinite(Number(log.duration)) &&
            Number(log.duration) < requiredHours;

        return sleptPoorly || sleptTooLittle;
    });

    const onScheduleCount = reportsWithSchedule.filter(
        log => log.onSchedule
    ).length;

    const scheduleReportCount = reportsWithSchedule.length;

    // calculates  sleep debt from the last 7 reports.
    const recentReports = logs.slice(-7);
    
    let sleepDebt = 0;
    
    recentReports.forEach(log => {
        const requiredHours = Number(log.requiredSleepHours);
        const actualHours = Number(log.duration);
    
        if (
            Number.isFinite(requiredHours) &&
            requiredHours > 0 &&
            Number.isFinite(actualHours) &&
            actualHours >= 0
        ) {
            sleepDebt += Math.max(0, requiredHours - actualHours);
        }
    });

    return {
        totalReports: logs.length,
        sleepDebt: Number(sleepDebt.toFixed(2)),
        poorSleepCount: poorSleepReports.length,
        onScheduleCount: onScheduleCount,
        scheduleReportCount: scheduleReportCount,
        adherenceRate: scheduleReportCount > 0
            ? onScheduleCount / scheduleReportCount
            : null,
        reports: logs
    };
}
