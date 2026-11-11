// getElementByID returns an HTML element that matches the given ID.
// const = it doesnt change
// ${variable} is the same thing as "text here " + variable + "."
const generateButton = document.getElementById('generateButton');
const resetButton = document.getElementById('resetButton');
const scheduleOutput = document.getElementById('scheduleOutput');
const fatigueOutput = document.getElementById('fatigueOutput');
const currentBedtimeInput = document.getElementById('currentBedtime');


const showSleepReportButton = document.getElementById('showSleepReportButton');
const sleepReport = document.getElementById('sleepReport');


const exportScheduleButton = document.getElementById('exportScheduleButton'); 


let currentSchedule = []; //empty array
let currentShiftDirection = ''; //empty string
let scheduleStartDate = '';



generateButton.addEventListener('click', generateSchedule); // schedule generate
resetButton.addEventListener('click', function() { // resets websites
    localStorage.clear();
    location.reload();
});

function calculateFatigueScore(schedule, requiredSleepHours) {

    if (!Array.isArray(schedule) || schedule.length === 0) {
        throw new Error('A schedule is required to calculate fatigue.');
    }

    const scheduledSleepHours = calculateSleepDuration(
        schedule[0].bedtime,
        schedule[0].wakeTime
    );

    // sleep duration (max 40)
    const sleepDeficit = Math.max(
        0,
        requiredSleepHours - scheduledSleepHours
    );

    const durationRisk = Math.min(40, sleepDeficit * 10);

    // schedule sift risk (max 30)
    const largestShift = Math.max(
        0,
        ...schedule.map(period => Number(period.shiftMinutes) || 0)
    );

    const shiftRisk = Math.min(30, (largestShift / 120) * 30);

    // looks at three most recent logs
    const recentReports = getSleepLogs()
        .filter(log => log && typeof log.date === 'string')
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 3);

    // poor sleep quality risk (max 15)
    const poorSleepCount = recentReports.filter(log =>
        log.quality === 'poor' || log.sleptWell === 'no'
    ).length;

    const poorSleepRisk = recentReports.length > 0
        ? (poorSleepCount / recentReports.length) * 15
        : 0;

    // sleep deficit risk (max 15)
    let totalSleepDeficit = 0;
    let validHistoryCount = 0;

    recentReports.forEach(function(log) {

        const requiredHours = Number(log.requiredSleepHours);

        if (
            Number.isFinite(Number(log.duration)) &&
            Number.isFinite(requiredHours) &&
            requiredHours > 0
        ) {
            totalSleepDeficit += Math.max(
                0,
                requiredHours - Number(log.duration)
            );

            validHistoryCount++;
        }
    });

    const averageSleepDeficit = validHistoryCount > 0
        ? totalSleepDeficit / validHistoryCount
        : 0;

    const historyRisk = validHistoryCount > 0
        ? Math.min(15, (averageSleepDeficit / requiredSleepHours) * 15)
        : 0;

    // combines risk factors
    const score = Math.round(
        durationRisk +
        shiftRisk +
        poorSleepRisk +
        historyRisk
    );

    const reasons = [];

    if (sleepDeficit > 0) {
        reasons.push(
            `Scheduled sleep is ${sleepDeficit.toFixed(2)} hours below the required duration.`
        );
    }

    if (largestShift > 0) {
        reasons.push(
            `The largest schedule adjustment is ${largestShift} minutes.`
        );
    }

    if (poorSleepCount > 0) {
        reasons.push(
            `${poorSleepCount} of ${recentReports.length} recent reports recorded poor sleep quality.`
        );
    }

    if (averageSleepDeficit > 0) {
        reasons.push(
            `Recent reports averaged ${averageSleepDeficit.toFixed(2)} hours below required sleep.`
        );
    }

    if (recentReports.length === 0) {
        reasons.push(
            'No previous sleep reports were available for personalization.'
        );
    }

    if (reasons.length === 0) {
        reasons.push(
            'No significant risk factors were identified by the current scoring model.'
        );
    }

    return {
        score: score,
        reasons: reasons
    };
}

function displayFatigueScore(schedule, requiredSleepHours) {

    const fatigueResult = calculateFatigueScore(
        schedule,
        requiredSleepHours
    );

    fatigueOutput.replaceChildren();

    const fatigueHeading = document.createElement('h3');
    fatigueHeading.textContent =
        `Estimated Fatigue Risk: ${fatigueResult.score}/100`;

    fatigueOutput.appendChild(fatigueHeading);

    const reasonsList = document.createElement('ul');

    fatigueResult.reasons.forEach(function(reason) {
        const item = document.createElement('li');
        item.textContent = reason;
        reasonsList.appendChild(item);
    });

    fatigueOutput.appendChild(reasonsList);
}

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

        if (
            !Number.isFinite(sleepHours) ||
            sleepHours < 0.1 ||
            sleepHours > 24
        ) {
            throw new Error('Required sleep must be between 0.1 and 24 hours.');
        }

        const schedule = genSS(
            currentBedtime,
            targetBedtime,
            sleepHours,
            shiftDirection
        );

        displaySchedule(schedule, shiftDirection);
        displayFatigueScore(schedule, sleepHours);

        currentSchedule = schedule;
        currentShiftDirection = shiftDirection;
        scheduleStartDate = getLocalDate();

        saveGeneratedSchedule(
            currentSchedule,
            scheduleStartDate,
            currentShiftDirection,
            sleepHours
        );

        // shows the daily report and export buttons after generating a schedule
        showSleepReportButton.hidden = false;
        exportScheduleButton.hidden = false;

        return true;

    } catch (error) {
        scheduleOutput.textContent = error.message;
        fatigueOutput.replaceChildren();
        currentSchedule = [];
        exportScheduleButton.hidden = true;

        return false;
    }
}


function displaySchedule(schedule, shiftDirection) {

    scheduleOutput.replaceChildren();  // hilarious name, empties scheduleOutput

    const table = document.createElement('table');

    const headers = [ // table headers
        'Sleep Period',
        'Bedtime',
        'Wake Time',
        'Shift'
    ];

    const headerRow = document.createElement('tr');

    headers.forEach(function(header) {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });

    table.appendChild(headerRow);
    // executes a provided function once for each element in an array
    schedule.forEach(function(period) {

        const row = document.createElement('tr');

        const values = [
            period.day,
            period.bedtime,
            period.wakeTime,
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




// addEventListener  attaches an event to a certain function
showSleepReportButton.addEventListener('click', function() {
    sleepReport.hidden = false;
});



const sleepDate = document.getElementById('sleepDate');
const actualBedtime = document.getElementById('actualBedtime');
const actualWakeTime = document.getElementById('actualWakeTime');
const sleepQuality = document.getElementById('sleepQuality');

// sleep experience inputs
const sleepProblem = document.getElementById('sleepProblem');
const sleepProblemSection = document.getElementById('sleepProblemSection');

const sleepRecommendations = document.getElementById('sleepRecommendations');
const recommendationOutput = document.getElementById('recommendationOutput');

const saveSleepReportButton =
    document.getElementById('saveSleepReportButton');

const sleepReportStatus =
    document.getElementById('sleepReportStatus');


function getLocalDate() { // this will change later, but I would need to make a separate mission clock and I do not have enough time for that

    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

sleepDate.value = getLocalDate();


// uses the most recent sleep report as the next starting bedtime
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


// restore the generated schedule so reports can still be compared after reopening Genesis
function restoreGeneratedSchedule() {

    const savedSchedule = getGeneratedSchedule();

    if (
        !savedSchedule ||
        !Array.isArray(savedSchedule.schedule) ||
        savedSchedule.schedule.length === 0 ||
        typeof savedSchedule.startDate !== 'string' ||
        !['later', 'earlier'].includes(savedSchedule.shiftDirection)
    ) {
        scheduleOutput.textContent =
            'No valid saved schedule found. Please generate a new schedule.';
        fatigueOutput.replaceChildren();
        showSleepReportButton.hidden = true;
        exportScheduleButton.hidden = true;
        return;
    }

    try {
        const validSchedule = savedSchedule.schedule.every(function(period) {

            if (
                !period ||
                !Number.isInteger(period.day) ||
                typeof period.bedtime !== 'string' ||
                typeof period.wakeTime !== 'string' ||
                !Number.isFinite(period.shiftMinutes) ||
                period.shiftMinutes < 0 ||
                period.shiftMinutes > 120
            ) {
                return false;
            }

            timetomins(period.bedtime);
            timetomins(period.wakeTime);

            return true;
        });

        if (!validSchedule) {
            throw new Error('Invalid saved schedule.');
        }

        currentSchedule = savedSchedule.schedule;
        scheduleStartDate = savedSchedule.startDate;
        currentShiftDirection = savedSchedule.shiftDirection;

        displaySchedule(currentSchedule, currentShiftDirection);

        if (
            Number.isFinite(savedSchedule.requiredSleepHours) &&
            savedSchedule.requiredSleepHours >= 0.1 &&
            savedSchedule.requiredSleepHours <= 24
        ) {
            displayFatigueScore(
                currentSchedule,
                savedSchedule.requiredSleepHours
            );
        } else {
            fatigueOutput.replaceChildren();
        }

        showSleepReportButton.hidden = false;
        exportScheduleButton.hidden = false;

    } catch (error) {
        currentSchedule = [];
        scheduleOutput.textContent =
            'Saved schedule is incomplete or invalid. Please generate a new schedule.';
        fatigueOutput.replaceChildren();
        showSleepReportButton.hidden = true;
        exportScheduleButton.hidden = true;
    }
}

restoreGeneratedSchedule();


function validateTime(time) { //validates 24 hour format

    return /^([01]?\d|2[0-3]):[0-5]\d$/.test(time); //do not remember this look up regex (regular expression).
}


// ask users for the reason of bad sleep
sleepQuality.addEventListener('change', function() {

    sleepProblemSection.hidden = sleepQuality.value !== 'poor';

    if (sleepQuality.value !== 'poor') {
        sleepProblem.value = '';
    }

});


// generatews recommendations and feedback 
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

    const sleepDeficit =
    report.requiredSleepHours !== null &&
    report.duration < report.requiredSleepHours;


    // seeing if user needs a nap
    const needsNap =
        sleepDeficit ||
        report.quality === 'poor' ||
        reason === 'still-tired';
    
    if (needsNap) {
        recommendations.push(
            'Your sleep report suggests you might want a 20 minute nap somewhere in the day. Try not to nap before bedtime.'
        );
    }

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
        'If possible, get into bed earlier. Anticipate the time it would take you to sleep.'
    );

    recommendations.push(
        'Try playing soft music in the background while sleeping.'
    );

    recommendations.push(
        'Stay relaxed close to bedtime.'
    );

    recommendations.push(
        'If you continue having trouble falling asleep, consult the mission medical officer about whether an approved sleep aid, such as melatonin, is appropriate. Only use sleep aids according to mission medical protocols.'
    );

} else if (reason === 'waking-during-night') {

        recommendations.push(
            'Make sure there is not any non-emergency flashing lights or sounds that cause you to wake up.'
        );

        recommendations.push(
            'Make sure you are comfortable.'
        );

        recommendations.push(
            'Record repeated interruptions so the sleep schedule can be reviewed.'
        );
        recommendations.push(
            'If you suffer from night terrors or bad dreams, talk to a professional.'
        );

    } else if (reason === 'woke-too-early') {

        recommendations.push(
            'See if your current sleep schedule allows enough rest.'
        );

        recommendations.push(
            'Make sure you are sleeping in a quiet area.'
        );

        recommendations.push(
            'Keep the next sleep period consistent with the planned schedule when possible.'
        );

    } else if (reason === 'too-alert') {

    recommendations.push(
        'Try using the treadmill to simulate walking and release excess energy.'
    );

    recommendations.push(
        'Try doing some stretching and yoga.'
    );

    recommendations.push(
        'Try not to do strenuous activity near bedtime.'
    );

    recommendations.push(
        'Use bright light when you wake up to improve alertness.'
    );

    recommendations.push(
        'Stay away from bright lights close to bedtime.'
    );

} else if (reason === 'still-tired') {

        recommendations.push(
            'Look at your sleep duration and sleep reports; are you getting an ample amount of rest?'
        );

        recommendations.push(
            'Deep breaths will help calm your thoughts and wake you up.'
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
                'Try drinking coffee or a beverage with caffeine.'
            );
        if (report.plannedBedtime !== null) {

            const plannedBedtimeMinutes = timetomins(report.plannedBedtime);

            const cutoffMinutes = plannedBedtimeMinutes - (6 * 60);

            const cutoffTime = minstotime(cutoffMinutes);

            const previousDay = cutoffMinutes < 0;

            recommendations.push(
                `Avoid caffeine after ${cutoffTime} ${
                    previousDay ? 'on the previous day' : 'on the day of'
                } your planned bedtime (${report.plannedBedtime}).`
            );

        } else {

            recommendations.push(
                'A caffeine cutoff could not be calculated because no planned bedtime was available.'
            );

        }
    }

    // reviews every saved report
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


// saves nightly sleep report
saveSleepReportButton.addEventListener('click', function() { // trys report

    try {

        const date = sleepDate.value;
        const bedtime = actualBedtime.value.trim();
        const wakeTime = actualWakeTime.value.trim();
        const quality = sleepQuality.value;
        const sleptWellAnswer = quality === 'poor' ? 'no' : 'yes';
        const problem = sleepProblem.value;

        if (!date || !bedtime || !wakeTime || !quality) {
            throw new Error('Please complete all required fields.');
        }
        
        if (quality === 'poor' && !problem) {
            throw new Error('Please select why you slept poorly.');
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

        // updates the starting bedtime using the actual report
        currentBedtimeInput.value = bedtime;

        // regens the schedule using the updated bedtime
        const scheduleUpdated = generateSchedule();

        // displays confirmation
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

        // displays feedback using the complete saved sleep history
        const feedbackSummary = getSleepFeedbackSummary(requiredSleepHours);

        displaySleepRecommendations(
            quality === 'poor' ? problem : '',
            report,
            feedbackSummary
        );

        // clear report fields for the next entry
        actualBedtime.value = '';
        actualWakeTime.value = '';
        sleepQuality.value = '';
        sleepProblem.value = '';
        sleepProblemSection.hidden = true;

    } catch (error) {

        sleepReportStatus.textContent = error.message;

    }

});



// quick 12 - 24 hour time converter so other people can test it, not needed for presentation

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



// exports the schedule into a .txt file

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

        //wind-downs. exercise and caffeine cutoffs
        const bedtimeMinutes = timetomins(period.bedtime);

        const windDownTotal = bedtimeMinutes - 30;
        const windDownTime = minstotime((windDownTotal % 1440 + 1440) % 1440);
        const windDownDay = period.bedtimeDayOffset + Math.floor(windDownTotal / 1440);
        
        const exerciseTotal = bedtimeMinutes - 120;
        const exerciseTime = minstotime((exerciseTotal % 1440 + 1440) % 1440);
        const exerciseDay = period.bedtimeDayOffset + Math.floor(exerciseTotal / 1440);
        
        const caffeineTotal = bedtimeMinutes - (6 * 60);
        const caffeineTime = minstotime((caffeineTotal % 1440 + 1440) % 1440);
        const caffeineDay = period.bedtimeDayOffset + Math.floor(caffeineTotal / 1440);
        
        text += `Wind-down: ${windDownTime} (Day ${windDownDay >= 0 ? '+' : ''}${windDownDay})\n`;
        text += `Exercise cutoff: ${exerciseTime} (Day ${exerciseDay >= 0 ? '+' : ''}${exerciseDay})\n`;
        text += `Caffeine cutoff: ${caffeineTime} (Day ${caffeineDay >= 0 ? '+' : ''}${caffeineDay})\n`;

        
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
