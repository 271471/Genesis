const GENESIS_EVENTS_KEY = "genesis_events";

function getGenesisEvents() {
    try {
        const events = JSON.parse(localStorage.getItem(GENESIS_EVENTS_KEY) || "[]");
        return Array.isArray(events) ? events.filter(event => event && typeof event.id === "string" &&
            typeof event.start === "string" && typeof event.end === "string") : [];
    } catch (error) { return []; }
}

function saveGenesisEvents(events) {
    localStorage.setItem(GENESIS_EVENTS_KEY, JSON.stringify(events));
}

function makeGenesisEvent(title, description, start, end, severity, affectedAccountIds, createdBy) {
    if (!title.trim()) throw new Error("Enter an event name.");
    if (!start || !end) throw new Error("Enter both the event start and end times.");
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || endDate <= startDate) {
        throw new Error("The event end must be later than its start.");
    }
    if (!["low", "moderate", "high"].includes(severity)) throw new Error("Select a valid impact level.");
    return {
        id: `event_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title: title.trim(), description: description.trim(), start: startDate.toISOString(), end: endDate.toISOString(),
        severity, affectedAccountIds: affectedAccountIds.slice(), createdBy, createdAt: new Date().toISOString()
    };
}

function eventAppliesToAccount(event, accountId) {
    return event.affectedAccountIds.includes("all") || event.affectedAccountIds.includes(accountId);
}

function renderEventList(container, events, allowDelete) {
    container.replaceChildren();
    if (!events.length) { container.textContent = "No events have been recorded."; return; }
    events.slice().sort((a, b) => a.start.localeCompare(b.start)).forEach(event => {
        const card = document.createElement("article");
        card.className = "event-card";
        const heading = document.createElement("h4"); heading.textContent = event.title;
        const details = document.createElement("p");
        details.textContent = `${new Date(event.start).toLocaleString()} to ${new Date(event.end).toLocaleString()} | ${event.severity.toUpperCase()} impact`;
        const description = document.createElement("p"); description.textContent = event.description || "No additional description.";
        const affected = document.createElement("p");
        affected.textContent = event.affectedAccountIds.includes("all") ? "Affected: Entire crew" : `Affected accounts: ${event.affectedAccountIds.length}`;
        card.append(heading, details, description, affected);
        if (allowDelete && (allowDelete === true || allowDelete(event))) {
            const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Delete Event";
            remove.addEventListener("click", () => {
                saveGenesisEvents(getGenesisEvents().filter(item => item.id !== event.id));
                if (typeof renderAdminEvents === "function") renderAdminEvents();
                if (typeof renderAstronautEvents === "function") renderAstronautEvents();
            });
            card.appendChild(remove);
        }
        container.appendChild(card);
    });
}

function renderAstronautEvents() {
    const accountId = getActiveAccountId();
    const events = getGenesisEvents().filter(event => eventAppliesToAccount(event, accountId));
    renderEventList(document.getElementById("astronautEventList"), events, event => event.createdBy === "astronaut");
}

function renderAdminEvents() {
    const target = document.getElementById("adminEventTarget");
    const selected = target.value;
    target.replaceChildren();
    const all = document.createElement("option"); all.value = "all"; all.textContent = "Entire crew"; target.appendChild(all);
    getGenesisAccounts().forEach(account => {
        const option = document.createElement("option"); option.value = account.id;
        option.textContent = `${account.username} (${[accountFirstName(account), accountLastName(account)].filter(Boolean).join(" ")})`;
        target.appendChild(option);
    });
    if ([...target.options].some(option => option.value === selected)) target.value = selected;
    renderEventList(document.getElementById("adminEventList"), getGenesisEvents(), true);
}

function saveAstronautEvent() {
    const error = document.getElementById("astronautEventError"); error.textContent = "";
    try {
        const accountId = getActiveAccountId();
        if (!accountId) throw new Error("Sign in before creating an event.");
        const event = makeGenesisEvent(
            document.getElementById("astronautEventTitle").value,
            document.getElementById("astronautEventDescription").value,
            document.getElementById("astronautEventStart").value,
            document.getElementById("astronautEventEnd").value,
            document.getElementById("astronautEventSeverity").value,
            [accountId], "astronaut"
        );
        saveGenesisEvents([...getGenesisEvents(), event]);
        ["astronautEventTitle", "astronautEventDescription", "astronautEventStart", "astronautEventEnd"].forEach(id => document.getElementById(id).value = "");
        renderAstronautEvents();
    } catch (exception) { error.textContent = exception.message; }
}

function saveAdminEvent() {
    const error = document.getElementById("adminEventError"); error.textContent = "";
    try {
        const selected = document.getElementById("adminEventTarget").value;
        const event = makeGenesisEvent(
            document.getElementById("adminEventTitle").value,
            document.getElementById("adminEventDescription").value,
            document.getElementById("adminEventStart").value,
            document.getElementById("adminEventEnd").value,
            document.getElementById("adminEventSeverity").value,
            selected === "all" ? ["all"] : [selected], "admin"
        );
        saveGenesisEvents([...getGenesisEvents(), event]);
        ["adminEventTitle", "adminEventDescription", "adminEventStart", "adminEventEnd"].forEach(id => document.getElementById(id).value = "");
        renderAdminEvents();
    } catch (exception) { error.textContent = exception.message; }
}

function adjustScheduleForEvents(schedule, startDate, requiredSleepHours, accountId) {
    const events = getGenesisEvents().filter(event => eventAppliesToAccount(event, accountId));
    if (!events.length) return { schedule, adjustments: [] };
    const adjusted = schedule.map(period => ({ ...period }));
    const adjustments = [];
    const durationMinutes = Math.round(requiredSleepHours * 60);

    adjusted.forEach(period => {
        const day = new Date(`${startDate}T00:00:00`);
        day.setDate(day.getDate() + period.day + (period.bedtimeDayOffset || 0));
        const [hours, minutes] = period.bedtime.split(":").map(Number);
        const sleepStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
        let sleepEnd = new Date(sleepStart.getTime() + durationMinutes * 60000);
        let changedBy = [];
        events.forEach(event => {
            const eventStart = new Date(event.start);
            const eventEnd = new Date(event.end);
            if (eventEnd <= sleepStart || eventStart >= sleepEnd) return;
            // A high-impact event makes that sleep window unavailable; protect the same sleep duration after it ends.
            if (event.severity === "high" || event.severity === "moderate") {
                const newStart = new Date(eventEnd);
                if (newStart > sleepStart) {
                    sleepStart.setTime(newStart.getTime());
                    sleepEnd = new Date(sleepStart.getTime() + durationMinutes * 60000);
                    changedBy.push(event.title);
                }
            } else {
                changedBy.push(`${event.title} (minor disruption to review)`);
            }
        });
        if (changedBy.length) {
            const oldBedtime = period.bedtime;
            const oldWakeTime = period.wakeTime;
            period.bedtime = `${String(sleepStart.getHours()).padStart(2,"0")}:${String(sleepStart.getMinutes()).padStart(2,"0")}`;
            period.wakeTime = `${String(sleepEnd.getHours()).padStart(2,"0")}:${String(sleepEnd.getMinutes()).padStart(2,"0")}`;
            period.eventAdjusted = true;
            period.eventNames = changedBy;
            period.sleepDate = `${sleepStart.getFullYear()}-${String(sleepStart.getMonth() + 1).padStart(2, "0")}-${String(sleepStart.getDate()).padStart(2, "0")}`;
            adjustments.push({ day: period.day, oldBedtime, oldWakeTime, bedtime: period.bedtime, wakeTime: period.wakeTime, events: changedBy });
        }
    });
    return { schedule: adjusted, adjustments };
}
