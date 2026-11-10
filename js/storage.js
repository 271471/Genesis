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

function saveGeneratedSchedule(schedule, startDate, shiftDirection) {
    const savedSchedule = {
        schedule: schedule,
        startDate: startDate,
        shiftDirection: shiftDirection
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

    return {
        totalReports: logs.length,
        poorSleepCount: poorSleepReports.length,
        onScheduleCount: onScheduleCount,
        scheduleReportCount: scheduleReportCount,
        adherenceRate: scheduleReportCount > 0
            ? onScheduleCount / scheduleReportCount
            : null,
        reports: logs
    };
}
