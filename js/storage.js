
const STORAGE_KEY = "genesis_sleep_logs";
const SCHEDULE_KEY = "genesis_generated_schedule";

function getSleepLogs() {
    try {
        const logs = localStorage.getItem(STORAGE_KEY);
        const parsedLogs = logs ? JSON.parse(logs) : [];

        if (!Array.isArray(parsedLogs)) {
            return [];
        }

        return parsedLogs.filter(log =>
            log &&
            typeof log === "object" &&
            typeof log.date === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(log.date)
        );
    } catch (error) {
        console.error("Could not read sleep logs:", error);
        return [];
    }
}

function saveSleepLog(report) {
    try {
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

        return true;
    } catch (error) {
        console.error("Could not save sleep report:", error);
        throw new Error("Could not save your sleep report. Check device storage.");
    }
}

function getSleepLog(date) {
    return getSleepLogs().find(log => log.date === date) || null;
}

function deleteSleepLog(date) {
    try {
        const logs = getSleepLogs().filter(
            log => log.date !== date
        );

        localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));

        return true;
    } catch (error) {
        console.error("Could not delete sleep report:", error);
        throw new Error("Could not delete the sleep report.");
    }
}
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
}

function calculateSleepDuration(bedtime, wakeTime) {
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
    try {
        if (!Array.isArray(schedule) || schedule.length === 0) {
            throw new Error("Invalid schedule.");
        }

        const savedSchedule = {
            schedule: schedule,
            startDate: startDate,
            shiftDirection: shiftDirection,
            requiredSleepHours: requiredSleepHours,
            missionPriority: missionPriority
        };

        localStorage.setItem(SCHEDULE_KEY, JSON.stringify(savedSchedule));

        return true;
    } catch (error) {
        console.error("Could not save generated schedule:", error);
        throw new Error("Could not save the generated schedule. Check device storage.");
    }
}

function getGeneratedSchedule() {
    try {
        const savedSchedule = localStorage.getItem(SCHEDULE_KEY);

        if (!savedSchedule) {
            return null;
        }

        const parsedSchedule = JSON.parse(savedSchedule);

        if (
            !parsedSchedule ||
            typeof parsedSchedule !== "object" ||
            !Array.isArray(parsedSchedule.schedule) ||
            parsedSchedule.schedule.length === 0 ||
            typeof parsedSchedule.startDate !== "string" ||
            !["earlier", "later"].includes(parsedSchedule.shiftDirection)
        ) {
            return null;
        }

        return parsedSchedule;

    } catch (error) {
        console.error("Could not read generated schedule:", error);
        return null;
    }
}

function calculateRecentSleepDebt(logs) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);

    let sleepDebtHours = 0;

    logs.forEach(function(log) {
        if (!log || typeof log.date !== "string") {
            return;
        }

        const dateParts = log.date.split("-").map(Number);

        const validDate =
            dateParts.length === 3 &&
            dateParts[0] > 0 &&
            dateParts[1] >= 1 &&
            dateParts[1] <= 12 &&
            dateParts[2] >= 1 &&
            dateParts[2] <= 31 &&
            new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]))
                .toISOString().startsWith(log.date);
        
        if (!validDate) {
            return;
        }
        
        const logDate = new Date(log.date + "T00:00:00");

        if (
            Number.isNaN(logDate.getTime()) ||
            logDate < sevenDaysAgo ||
            logDate > today
        ) {
            return;
        }

        const requiredHours = Number(log.requiredSleepHours);
        const actualHours = Number(log.duration);

        const napMinutes = Number(log.napDuration);
        const napHours =
            Number.isFinite(napMinutes) &&
            napMinutes >= 0 &&
            napMinutes <= 90
                ? napMinutes / 60
                : 0;

        if (
            Number.isFinite(requiredHours) &&
            requiredHours > 0 &&
            requiredHours <= 24 &&
            Number.isFinite(actualHours) &&
            actualHours >= 0 &&
            actualHours < 24
        ) {
            sleepDebtHours += Math.max(
                0,
                requiredHours - (actualHours + napHours)
            );
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

    const sleepDebt = calculateRecentSleepDebt(logs);

    return {
        totalReports: logs.length,
        sleepDebt: sleepDebt,
        poorSleepReports: poorSleepReports.length,
        onScheduleCount: onScheduleCount,
        scheduleReportCount: scheduleReportCount,
        adherenceRate: scheduleReportCount > 0
            ? onScheduleCount / scheduleReportCount
            : null,
        reports: logs
    };
}
