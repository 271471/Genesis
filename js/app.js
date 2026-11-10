const generateButton = document.getElementById('generateButton');
const scheduleOutput = document.getElementById('scheduleOutput');
const currentBedtimeInput = document.getElementById('currentBedtime');

// daily sleep report button
const showSleepReportButton = document.getElementById('showSleepReportButton');
const sleepReport = document.getElementById('sleepReport');

// schedule export
const exportScheduleButton = document.getElementById('exportScheduleButton');

let currentSchedule = [];
let currentShiftDirection = '';
let scheduleStartDate = '';



generateButton.addEventListener('click', generateSchedule); // schedule generate


function generateSchedule() {

    const currentBedtime = currentBedtimeInput.value;
    const targetBedtime = document.getElementById('targetBedtime').value;
    const sleepHours = Number(document.getElementById('sleepHours').value);
    const shiftDirection = document.getElementById('shiftDirection').value;

    try {
        if (!currentBedtime || !targetBedtime ||
            !document.getElementById('sleepHours').value) {
            throw new Error('Please complete all fields.');
        }

        const schedule = genSS(
            currentBedtime,
            targetBedtime,
            sleepHours,
            shiftDirection
        );

        displaySchedule(schedule, shiftDirection);

        currentSchedule = schedule;
        currentShiftDirection = shiftDirection;
        scheduleStartDate = getLocalDate();

        saveGeneratedSchedule(
            currentSchedule,
            scheduleStartDate,
            currentShiftDirection
        );

        // Show the daily report and export buttons after generating a schedule
        showSleepReportButton.hidden = false;
        exportScheduleButton.hidden = false;

        return true;

    } catch (error) {
        scheduleOutput.textContent = error.message;
        currentSchedule = [];
        exportScheduleButton.hidden = true;

        return false;
    }
}


function displaySchedule(schedule, shiftDirection) {

    scheduleOutput.replaceChildren();

    const table = document.createElement('table');

    const headers = [
        'Sleep Period',
        'Bedtime',
        'Wake Time',
        'Bedtime Day',
        'Wake Day',
        'Shift'
    ];

    const headerRow = document.createElement('tr');

    headers.forEach(function(header) {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });

    table.appendChild(headerRow);

    schedule.forEach(function(period) {

        const row = document.createElement('tr');

        const values = [
            period.day,
            period.bedtime,
            period.wakeTime,
            `Day +${period.bedtimeDayOffset}`,
            `Day +${period.wakeDayOffset}`,
            period.day === 0
                ? 'Starting schedule'
                : `${period.shiftMinutes} min ${shiftDirection}`
        ];

        values.forEach(function(value) {
            const cell = document.createElement('td');
            cell.textContent = value;
            row.appendChild(cell);
        });

        table.appendChild(row);
    });

    scheduleOutput.appendChild(table);
}




// Open daily sleep report when button is clicked
showSleepReportButton.addEventListener('click', function() {
    sleepReport.hidden = false;
});



const sleepDate = document.getElementById('sleepDate');
const actualBedtime = document.getElementById('actualBedtime');
const actualWakeTime = document.getElementById('actualWakeTime');
const sleepQuality = document.getElementById('sleepQuality');

// Sleep experience inputs
const sleptWell = document.getElementById('sleptWell');
const sleepProblem = document.getElementById('sleepProblem');
const sleepProblemSection = document.getElementById('sleepProblemSection');

// Sleep recommendations
const sleepRecommendations = document.getElementById('sleepRecommendations');
const recommendationOutput = document.getElementById('recommendationOutput');

const saveSleepReportButton =
    document.getElementById('saveSleepReportButton');

const sleepReportStatus =
    document.getElementById('sleepReportStatus');


function getLocalDate() { //this will change later, but I would need to make a separate mission clock and I could not for the life of me figure it out.

    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

sleepDate.value = getLocalDate();


// Use the most recent sleep report as the next starting bedtime
function loadLatestSleepReport() {

    const logs = getSleepLogs();

    if (logs.length === 0) {
        return;
    }

    logs.sort(function(a, b) {
        return b.date.localeCompare(a.date);
    });

    if (logs[0].bedtime) {
        currentBedtimeInput.value = logs[0].bedtime;
    }
}

loadLatestSleepReport();


// Restore the generated schedule so reports can still be compared after reopening Genesis
function restoreGeneratedSchedule() {

    const savedSchedule = getGeneratedSchedule();

    if (
        !savedSchedule ||
        !Array.isArray(savedSchedule.schedule) ||
        !savedSchedule.startDate
    ) {
        return;
    }

    currentSchedule = savedSchedule.schedule;
    scheduleStartDate = savedSchedule.startDate;
    currentShiftDirection = savedSchedule.shiftDirection || '';

    displaySchedule(currentSchedule, currentShiftDirection);

    showSleepReportButton.hidden = false;
    exportScheduleButton.hidden = false;
}

restoreGeneratedSchedule();


function validateTime(time) { //validates 24 hour format

    return /^([01]?\d|2[0-3]):[0-5]\d$/.test(time); //do not remember this look up regex (regular expression).
}


// Show the reason question only when the user reports poor sleep
sleptWell.addEventListener('change', function() {

    sleepProblemSection.hidden = sleptWell.value !== 'no';

    if (sleptWell.value !== 'no') {
        sleepProblem.value = '';
    }

});


// Generate recommendations and feedback based on the sleep report and saved history
function getCongratulatoryMessage(report) {

    const fullScheduleMessages = [
        'Good work staying on schedule!',
        'Great consistency. You met your bedtime and wake-time targets.',
        'Well done! You kept your sleep schedule on track.',
        'Another successful sleep period. Keep up the consistency.',
        'You followed your planned sleep schedule. Good work!'
    ];

    const bedtimeMessages = [
        'Good work meeting your planned bedtime!',
        'You went to bed on time. Keep building that consistency.',
        'Well done! You met your bedtime target.',
        'You stayed on track with your planned bedtime.'
    ];

    const messages = report.wakeTimeOnSchedule
        ? fullScheduleMessages
        : bedtimeMessages;

    return messages[Math.floor(Math.random() * messages.length)];
}


function getDateDifference(startDate, endDate) {

    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);

    return Math.round((end - start) / 86400000);
}


function getScheduledPeriodForDate(date) {

    if (!scheduleStartDate || currentSchedule.length === 0) {
        return null;
    }

    const dayNumber = getDateDifference(scheduleStartDate, date);

    if (dayNumber < 0) {
        return null;
    }

    return currentSchedule.find(
        period => period.day === dayNumber
    ) || null;
}


function getClockDifference(timeOne, timeTwo) {

    const [hourOne, minuteOne] = timeOne.split(':').map(Number);
    const [hourTwo, minuteTwo] = timeTwo.split(':').map(Number);

    const minutesOne = hourOne * 60 + minuteOne;
    const minutesTwo = hourTwo * 60 + minuteTwo;

    const difference = Math.abs(minutesOne - minutesTwo);

    return Math.min(difference, 1440 - difference);
}


function displaySleepRecommendations(reason, report, summary) {

    recommendationOutput.replaceChildren();

    const recommendations = [];

    if (report.bedtimeOnSchedule === true) {
        const congratulations = document.createElement('p');
        congratulations.textContent = getCongratulatoryMessage(report);
        congratulations.style.fontWeight = 'bold';
        recommendationOutput.appendChild(congratulations);
    }

    if (report.onSchedule === false && report.bedtimeOnSchedule !== true) {
        recommendations.push(
            'Your sleep times were outside the schedule tolerance. Review the planned times and try to return to the schedule during the next sleep period.'
        );
    }

    if (reason === 'trouble-falling-asleep') {

        recommendations.push(
            'Try a quiet, relaxing routine before the next sleep period.'
        );

        recommendations.push(
            'Subtle background music may help create a calmer environment.'
        );

        recommendations.push(
            'Avoid stimulating activities close to the planned bedtime.'
        );

    } else if (reason === 'waking-during-night') {

        recommendations.push(
            'Review possible interruptions in the sleep environment.'
        );

        recommendations.push(
            'Keep the sleep environment quiet and comfortable.'
        );

        recommendations.push(
            'Record repeated interruptions so the sleep schedule can be reviewed.'
        );

    } else if (reason === 'woke-too-early') {

        recommendations.push(
            'Review whether the current sleep schedule allows enough rest.'
        );

        recommendations.push(
            'Check for environmental interruptions that may have affected sleep.'
        );

        recommendations.push(
            'Keep the next sleep period consistent with the planned schedule when possible.'
        );

    } else if (reason === 'too-alert') {

        recommendations.push(
            'Consider light exercise or a short walk during the active part of the day.'
        );

        recommendations.push(
            'Stretching or yoga may help reduce restlessness.'
        );

        recommendations.push(
            'Avoid strenuous exercise close to the next sleep period.'
        );

    } else if (reason === 'still-tired') {

        recommendations.push(
            'Review your sleep duration and recent sleep reports.'
        );

        recommendations.push(
            'Consider a short, planned rest period if the mission schedule allows it.'
        );

        recommendations.push(
            'If mission medical protocols permit, scheduled caffeine such as coffee may temporarily support alertness.'
        );

        recommendations.push(
            'Avoid caffeine close to the next planned sleep period.'
        );

    } else if (reason === 'other') {

        recommendations.push(
            'Record the issue and review whether it affects future sleep periods.'
        );

        recommendations.push(
            'If the problem continues, request assistance from mission medical personnel.'
        );

    }

    if (report.sleptWell === 'no' || report.quality === 'poor') {
        recommendations.push(
            'If sleep difficulties continue, contact the appropriate mission medical personnel.'
        );
    }

    // Review every saved report, not just a fixed number of recent days
    if (summary.scheduleReportCount >= 3) {

        const adherencePercent = Math.round(summary.adherenceRate * 100);

        if (summary.adherenceRate >= 0.8) {
            recommendations.push(
                `You followed your planned schedule in ${summary.onScheduleCount} of ${summary.scheduleReportCount} recorded sleep periods (${adherencePercent}%). Your consistency is strong.`
            );
        } else if (summary.adherenceRate < 0.5) {
            recommendations.push(
                `Your reports show that schedule timing has been difficult: ${summary.onScheduleCount} of ${summary.scheduleReportCount} recorded sleep periods were within the target. Review whether the current schedule is realistic.`
            );
        } else {
            recommendations.push(
                `You followed the planned timing in ${summary.onScheduleCount} of ${summary.scheduleReportCount} recorded sleep periods. Continue working toward more consistent timing.`
            );
        }
    }

    if (summary.totalReports >= 3) {

        const poorSleepPercent =
            Math.round((summary.poorSleepCount / summary.totalReports) * 100);

        if (poorSleepPercent >= 40) {
            recommendations.push(
                `Your saved reports show sleep difficulties in ${summary.poorSleepCount} of ${summary.totalReports} reports (${poorSleepPercent}%). Consider reviewing the schedule with mission medical personnel.`
            );
        } else if (summary.poorSleepCount === 0) {
            recommendations.push(
                'Your saved reports show no recorded poor-sleep periods. Keep monitoring your sleep quality.'
            );
        }
    }

    if (recommendations.length === 0 &&
        report.onSchedule !== true &&
        summary.totalReports < 3) {
        recommendations.push(
            'Continue recording your sleep reports so Genesis can identify patterns over time.'
        );
    }

    if (recommendations.length > 0) {

        const list = document.createElement('ul');

        recommendations.forEach(function(recommendation) {

            const item = document.createElement('li');
            item.textContent = recommendation;
            list.appendChild(item);

        });

        recommendationOutput.appendChild(list);
    }

    sleepRecommendations.hidden =
        recommendationOutput.childElementCount === 0;
}


// Save nightly sleep report
saveSleepReportButton.addEventListener('click', function() { // trys report

    try {

        const date = sleepDate.value;
        const bedtime = actualBedtime.value.trim();
        const wakeTime = actualWakeTime.value.trim();
        const quality = sleepQuality.value;
        const sleptWellAnswer = sleptWell.value;
        const problem = sleepProblem.value;

        if (!date || !bedtime || !wakeTime || !quality || !sleptWellAnswer) {
            throw new Error('Please complete all required fields.');
        }

        if (sleptWellAnswer === 'no' && !problem) {
            throw new Error('Please select why you did not sleep well.');
        }

        if (!validateTime(bedtime) || !validateTime(wakeTime)) {
            throw new Error('Enter valid times using HH:MM format.');
        }

        if (bedtime === wakeTime) {
            throw new Error('Bedtime and wake time cannot be identical.');
        }

        if (!['poor', 'okay', 'great'].includes(quality)) {
            throw new Error('Please select a valid sleep quality.');
        }

        if (!['yes', 'no'].includes(sleptWellAnswer)) {
            throw new Error('Please select whether you slept well.');
        }

        const duration = calculateSleepDuration(bedtime, wakeTime);

        if (duration <= 0 || duration >= 24) {
            throw new Error('Invalid sleep duration.');
        }

        const requiredSleepHoursInput =
            Number(document.getElementById('sleepHours').value);

        const requiredSleepHours =
            Number.isFinite(requiredSleepHoursInput) &&
            requiredSleepHoursInput > 0 &&
            requiredSleepHoursInput <= 24
                ? requiredSleepHoursInput
                : null;

        const plannedPeriod = getScheduledPeriodForDate(date);
        const adherenceToleranceMinutes = 15;

        let plannedBedtime = null;
        let plannedWakeTime = null;
        let bedtimeOnSchedule = null;
        let wakeTimeOnSchedule = null;
        let onSchedule = null;

        if (plannedPeriod) {
            plannedBedtime = plannedPeriod.bedtime;
            plannedWakeTime = plannedPeriod.wakeTime;

            bedtimeOnSchedule =
                getClockDifference(bedtime, plannedBedtime) <=
                adherenceToleranceMinutes;

            wakeTimeOnSchedule =
                getClockDifference(wakeTime, plannedWakeTime) <=
                adherenceToleranceMinutes;

            onSchedule = bedtimeOnSchedule && wakeTimeOnSchedule;
        }

        const report = {
            date: date,
            bedtime: bedtime,
            wakeTime: wakeTime,
            duration: duration,
            quality: quality,
            sleptWell: sleptWellAnswer,
            sleepProblem: sleptWellAnswer === 'no' ? problem : '',
            requiredSleepHours: requiredSleepHours,
            plannedBedtime: plannedBedtime,
            plannedWakeTime: plannedWakeTime,
            adherenceToleranceMinutes: adherenceToleranceMinutes,
            bedtimeOnSchedule: bedtimeOnSchedule,
            wakeTimeOnSchedule: wakeTimeOnSchedule,
            onSchedule: onSchedule,
            loggedAt: new Date().toISOString()
        };

        saveSleepLog(report);

        // Update the starting bedtime using the actual report
        currentBedtimeInput.value = bedtime;

        // Regenerate the schedule using the updated bedtime
        const scheduleUpdated = generateSchedule();

        // Display confirmation
        if (scheduleUpdated) {
            const adherenceMessage = report.onSchedule === null
                ? ' No matching scheduled period was available for comparison.'
                : report.onSchedule
                    ? ' You met the planned bedtime and wake-time targets.'
                    : report.bedtimeOnSchedule
                        ? ' You met your planned bedtime, but not your wake-time target.'
                        : ' Your actual bedtime was outside the 15-minute schedule tolerance.';

            sleepReportStatus.textContent =
                `Report saved. Actual sleep: ${duration.toFixed(2)} hours. Schedule updated using your reported bedtime.${adherenceMessage}`;
        } else {
            sleepReportStatus.textContent =
                `Report saved. Actual sleep: ${duration.toFixed(2)} hours. Your starting bedtime was updated, but the schedule could not be regenerated.`;
        }

        // Display feedback using the complete saved sleep history
        const feedbackSummary = getSleepFeedbackSummary(requiredSleepHours);

        displaySleepRecommendations(
            sleptWellAnswer === 'no' ? problem : '',
            report,
            feedbackSummary
        );

        // Clear report fields for the next entry
        actualBedtime.value = '';
        actualWakeTime.value = '';
        sleepQuality.value = '';
        sleptWell.value = '';
        sleepProblem.value = '';
        sleepProblemSection.hidden = true;

    } catch (error) {

        sleepReportStatus.textContent = error.message;

    }

});



// 12-HOUR TO 24-HOUR CONVERTER

const convertTimeButton = document.getElementById('convertTimeButton');
const time24Output = document.getElementById('time24Output');

convertTimeButton.addEventListener('click', function() {

    const hourInput = document.getElementById('timeHour').value;
    const minuteInput = document.getElementById('timeMinute').value;

    const hour = Number(hourInput);
    const minute = Number(minuteInput);
    const period = document.getElementById('timePeriod').value;

    if (
        hourInput === '' || minuteInput === '' ||
        !Number.isInteger(hour) || hour < 1 || hour > 12 ||
        !Number.isInteger(minute) || minute < 0 || minute > 59
    ) {
        time24Output.textContent = 'Enter a valid hour and minute.';
        return;
    }

    let hour24 = hour;

    if (period === 'AM') {
        hour24 = hour % 12;
    } else {
        hour24 = (hour % 12) + 12;
    }

    const convertedTime =
        `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

    time24Output.textContent = `24-hour time: ${convertedTime}`;

});



// SCHEDULE TXT EXPORT

exportScheduleButton.addEventListener('click', function() {

    if (currentSchedule.length === 0) {
        return;
    }

    let text = 'GENESIS - LUNAR SLEEP SCHEDULE\n';
    text += '================================\n\n';

    text += `Generated: ${getLocalDate()}\n`;
    text += `Shift Direction: ${currentShiftDirection}\n\n`;

    currentSchedule.forEach(function(period) {

        text += `Sleep Period ${period.day}\n`;
        text += `Bedtime: ${period.bedtime}\n`;
        text += `Wake Time: ${period.wakeTime}\n`;
        text += `Bedtime Day: Day +${period.bedtimeDayOffset}\n`;
        text += `Wake Day: Day +${period.wakeDayOffset}\n`;

        if (period.day === 0) {
            text += 'Shift: Starting schedule\n';
        } else {
            text += `Shift: ${period.shiftMinutes} minutes ${currentShiftDirection}\n`;
        }

        text += '\n';
    });

    const file = new Blob([text], {
        type: 'text/plain;charset=utf-8'
    });

    const fileURL = URL.createObjectURL(file);

    const downloadLink = document.createElement('a');

    downloadLink.href = fileURL;
    downloadLink.download = `Genesis_Sleep_Schedule_${getLocalDate()}.txt`;

    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    setTimeout(function() {
        URL.revokeObjectURL(fileURL);
    }, 1000);

});
