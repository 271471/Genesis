function timetomins(time) {
  if (typeof time !== 'string' || !/^([01]?\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error('Invalid time. Use HH:MM format.');
  }
  let temp = time.split(':');
  let hours = Number(temp[0]);
  let mins = Number(temp[1]);
  return hours * 60 + mins;
}

function minstotime(mins) {
  mins = ((mins % 1440) + 1440) % 1440;
  let hours = Math.floor(mins / 60);
  let remMins = mins % 60;
  return `${hours.toString().padStart(2, '0')}:${remMins.toString().padStart(2, '0')}`;
}

function genSS(currentBedtime, targetBedtime, sleepHours, shiftDirection, maxShift = 120) { // fun fact this function name is the reason I came up with the name Genesis.If you couldn't tell, GenSS and Genesis sound very similar.
  let current = timetomins(currentBedtime);
  let target = timetomins(targetBedtime);

  if (typeof sleepHours !== 'number' || !Number.isFinite(sleepHours) || sleepHours <= 0 || sleepHours > 24) {
    throw new Error('Sleep duration must be between 0 and 24 hours.');
  }
  if (!Number.isInteger(maxShift) || maxShift < 1 || maxShift > 1440) {
    throw new Error('Maximum shift must be between 1 and 1440 minutes.');
  }
  if (shiftDirection !== 'later' && shiftDirection !== 'earlier') {
    throw new Error('Shift direction must be "later" or "earlier".');
  }

  let sleepDuration = sleepHours * 60;
  let schedule = [];
  let forward = (target - current + 1440) % 1440;
  let backward = (current - target + 1440) % 1440;
  let diff = shiftDirection === 'later' ? forward : backward;
  let days = Math.ceil(diff / maxShift);
  let remaining = diff;


  schedule.push({
    day: 0,
    bedtime: minstotime(current),
    wakeTime: minstotime(current + sleepDuration),
    bedtimeDayOffset: Math.floor(current / 1440),
    wakeDayOffset: Math.floor((current + sleepDuration) / 1440),
    shiftMinutes: 0,
    bedtimeAbsolute: current,
    wakeAbsolute: current + sleepDuration
  });

    let accumMinutes = current;

    for (let day = 1; day <= days; day++) {
      let shiftAmount = Math.min(maxShift, remaining);

      if (shiftDirection === 'later') {
        accumMinutes += shiftAmount;
      } else {
        accumMinutes -= shiftAmount;
      }

      remaining -= shiftAmount;

      let bedtime = minstotime(accumMinutes);
      let wakeTime = minstotime(accumMinutes + sleepDuration);

      let bedtimeAbsolute = day * 1440 + accumMinutes;
      let wakeAbsolute = bedtimeAbsolute + sleepDuration;

      schedule.push({
        day: day,
        bedtime: bedtime,
        wakeTime: wakeTime,
        bedtimeAbsolute: bedtimeAbsolute,
        wakeAbsolute: wakeAbsolute,
        bedtimeDayOffset: Math.floor(bedtimeAbsolute / 1440),
        wakeDayOffset: Math.floor(wakeAbsolute / 1440),
        shiftMinutes: shiftAmount
      });
    }

  return schedule;
}
