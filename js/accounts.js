const GENESIS_ACCOUNTS_KEY = "genesis_accounts";
const GENESIS_ADMIN_KEY = "genesis_admin_pin";
const GENESIS_SESSION_KEY = "genesis_active_account";
const GENESIS_MAX_ASTRONAUTS = 15;

function getGenesisAccounts() {
    try {
        const value = JSON.parse(localStorage.getItem(GENESIS_ACCOUNTS_KEY) || "[]");
        return Array.isArray(value) ? value.filter(account =>
            account && typeof account.id === "string" &&
            typeof account.username === "string" && typeof account.pin === "string"
        ) : [];
    } catch (error) {
        return [];
    }
}

function getActiveAccountId() {
    return sessionStorage.getItem(GENESIS_SESSION_KEY);
}

function getActiveGenesisAccount() {
    const id = getActiveAccountId();
    return getGenesisAccounts().find(account => account.id === id) || null;
}

function saveGenesisAccounts(accounts) {
    localStorage.setItem(GENESIS_ACCOUNTS_KEY, JSON.stringify(accounts));
}

function addPinVisibilityToggle(input) {
    if (!input || input.dataset.visibilityToggleAdded === "true") return;

    input.dataset.visibilityToggleAdded = "true";

    const wrapper = document.createElement("div");
    wrapper.className = "pin-input-wrapper";
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.gap = "8px";
    wrapper.style.width = "100%";

    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    input.style.flex = "1";
    input.style.minWidth = "0";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "pin-visibility-toggle";
    toggle.textContent = "Show";
    toggle.setAttribute("aria-label", "Show PIN");
    toggle.style.flexShrink = "0";

    toggle.addEventListener("click", () => {
        const showing = input.type === "password";
        input.type = showing ? "text" : "password";
        toggle.textContent = showing ? "Hide" : "Show";
        toggle.setAttribute("aria-label", showing ? "Hide PIN" : "Show PIN");
    });

    wrapper.appendChild(toggle);
}

function showLoginScreen(screenId) {
    document.querySelectorAll(".login-screen").forEach(screen => screen.hidden = true);
    const screen = document.getElementById(screenId);
    if (screen) screen.hidden = false;
}

function showAuthError(id, message) {
    const target = document.getElementById(id);
    if (target) target.textContent = message;
}

function normalizedNamePart(value) {
    return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function accountFirstName(account) {
    return account.firstName || String(account.fullName || "").trim().split(/\s+/)[0] || "";
}

function accountLastName(account) {
    if (account.lastName) return account.lastName;
    const parts = String(account.fullName || "").trim().split(/\s+/);
    return parts.length > 1 ? parts.slice(1).join(" ") : "";
}

function resetAstronautPin(account, firstName, lastName, dateOfBirth, newPin, confirmPin, errorElement) {
    const showError = message => {
        if (errorElement) {
            errorElement.style.color = "";
            errorElement.textContent = message;
        }
    };

    if (!firstName.trim() || !lastName.trim() || !dateOfBirth) {
        return showError("Enter the first name, last name, and date of birth from account creation.");
    }

    if (
        normalizedNamePart(firstName) !== normalizedNamePart(accountFirstName(account)) ||
        normalizedNamePart(lastName) !== normalizedNamePart(accountLastName(account)) ||
        dateOfBirth !== account.dateOfBirth
    ) {
        return showError("The first name, last name, or date of birth does not match this account.");
    }

    newPin = String(newPin).trim();
    confirmPin = String(confirmPin).trim();

    if (!/^\d{4,8}$/.test(newPin)) {
        return showError("New PIN must contain 4 to 8 digits.");
    }

    if (newPin !== confirmPin) {
        return showError("The new PINs do not match.");
    }

    try {
        const accounts = getGenesisAccounts();
        const accountToUpdate = accounts.find(item => item.id === account.id);

        if (!accountToUpdate) {
            return showError("Account could not be found.");
        }

        accountToUpdate.pin = newPin;
        saveGenesisAccounts(accounts);

        const savedAccount = getGenesisAccounts().find(item => item.id === account.id);

        if (!savedAccount || savedAccount.pin !== newPin) {
            return showError("PIN reset could not be verified. Please try again.");
        }

        if (errorElement) {
            errorElement.style.color = "green";
            errorElement.textContent = "PIN successfully reset. You can now sign in with your new PIN.";
        }

        return true;
    } catch (saveError) {
        return showError("Unable to save the new PIN. Please try again.");
    }
}

function createLoginPinResetForm(account, row) {
    const form = document.createElement("div");
    form.className = "login-pin-reset";

    const firstName = document.createElement("input");
    firstName.type = "text";
    firstName.placeholder = "First name from account creation";
    firstName.autocomplete = "given-name";

    const lastName = document.createElement("input");
    lastName.type = "text";
    lastName.placeholder = "Last name from account creation";
    lastName.autocomplete = "family-name";

    const dob = document.createElement("input");
    dob.type = "date";
    dob.setAttribute("aria-label", "Date of birth");

    const newPin = document.createElement("input");
    newPin.type = "password";
    newPin.inputMode = "numeric";
    newPin.maxLength = 8;
    newPin.placeholder = "New PIN (4 to 8 digits)";

    const confirmPin = document.createElement("input");
    confirmPin.type = "password";
    confirmPin.inputMode = "numeric";
    confirmPin.maxLength = 8;
    confirmPin.placeholder = "Confirm new PIN";

    const error = document.createElement("small");
    error.className = "field-error";

    const submit = document.createElement("button");
    submit.type = "button";
    submit.textContent = "Confirm PIN Reset";

    submit.addEventListener("click", () => {
        submit.disabled = true;

        const success = resetAstronautPin(
            account,
            firstName.value,
            lastName.value,
            dob.value,
            newPin.value.trim(),
            confirmPin.value.trim(),
            error
        );

        if (!success) {
            submit.disabled = false;
        }
    });

    form.append(firstName, lastName, dob, newPin, confirmPin, submit, error);

    addPinVisibilityToggle(newPin);
    addPinVisibilityToggle(confirmPin);

    row.appendChild(form);
}

function enterAstronaut(account) {
    sessionStorage.setItem(GENESIS_SESSION_KEY, account.id);

    document.getElementById("loginArea").hidden = true;
    document.getElementById("astronautApp").hidden = false;
    document.getElementById("adminApp").hidden = true;
    document.getElementById("activeAstronautName").textContent = account.username;
    document.getElementById("astronautWorkspace").hidden = false;
    document.getElementById("astronautPinResetPanel").hidden = true;
    document.getElementById("astronautRecoverySetup").hidden = true;

    currentSchedule = [];
    currentShiftDirection = "";
    scheduleStartDate = "";

    document.getElementById("scheduleOutput").textContent = "Your schedule will appear here.";
    document.getElementById("fatigueOutput").replaceChildren();
    document.getElementById("scheduleError").textContent = "";
    document.getElementById("exportScheduleButton").hidden = true;
    document.getElementById("showSleepReportButton").hidden = true;
    document.getElementById("sleepReportStatus").textContent = "";
    document.getElementById("sleepReportFieldError").textContent = "";
    document.getElementById("recommendationOutput").replaceChildren();
    document.getElementById("sleepRecommendations").hidden = true;

    document.getElementById("currentBedtime").value = "";
    document.getElementById("targetBedtime").value = "";
    document.getElementById("sleepHours").value = "";
    document.getElementById("missionPriority").value = "routine";
    document.getElementById("shiftDirection").value = "later";

    if (!account.fullName || !account.dateOfBirth) {
        document.getElementById("astronautWorkspace").hidden = true;
        document.getElementById("astronautRecoverySetup").hidden = false;

        document.getElementById("existingAstronautFirstName").value = accountFirstName(account);
        document.getElementById("existingAstronautLastName").value = accountLastName(account);
        document.getElementById("existingAstronautDob").value = account.dateOfBirth || "";

        showAuthError("existingRecoveryError", "Complete these details to enable PIN recovery.");
    }

    showAstronautTask("scheduler");

    if (typeof loadLatestSleepReport === "function") {
        loadLatestSleepReport();
    }

    const saved = typeof getGeneratedSchedule === "function" ? getGeneratedSchedule() : null;

    if (saved) {
        currentSchedule = saved.schedule;
        currentShiftDirection = saved.shiftDirection;
        scheduleStartDate = saved.startDate;

        document.getElementById("sleepHours").value = saved.requiredSleepHours;
        document.getElementById("missionPriority").value = saved.missionPriority;
        document.getElementById("currentBedtime").value = saved.schedule[0].bedtime;
        document.getElementById("targetBedtime").value = saved.schedule[saved.schedule.length - 1].bedtime;
        document.getElementById("shiftDirection").value = saved.shiftDirection;

        displaySchedule(currentSchedule, currentShiftDirection);
        displayFatigueScore(currentSchedule, Number(saved.requiredSleepHours));

        document.getElementById("exportScheduleButton").hidden = false;
        document.getElementById("showSleepReportButton").hidden = false;
        document.getElementById("results").hidden = false;
    }
}

function enterAdmin() {
    document.getElementById("adminPin").value = "";
    document.getElementById("adminResetPin").value = "";
    document.getElementById("adminResetStatus").textContent = "";

    document.getElementById("loginArea").hidden = true;
    document.getElementById("astronautApp").hidden = true;
    document.getElementById("adminApp").hidden = false;

    renderAdminAccounts();

    if (typeof renderAdminEvents === "function") {
        renderAdminEvents();
    }
}

function showAstronautTask(taskId) {
    document.querySelectorAll(".astronaut-task").forEach(task => task.hidden = true);

    const task = document.getElementById(taskId);
    if (task) task.hidden = false;

    if (taskId === "scheduler") {
        document.getElementById("results").hidden = false;
    }

    document.querySelectorAll("[data-task]").forEach(button => {
        button.classList.toggle("active-task", button.dataset.task === taskId);
    });
}

function logoutGenesis() {
    if (!confirm("Are you sure you want to log out?")) {
        return;
    }

    const adminPinField = document.getElementById("adminPin");
    const adminResetPinField = document.getElementById("adminResetPin");

    if (adminPinField) adminPinField.value = "";
    if (adminResetPinField) adminResetPinField.value = "";

    const adminStatus = document.getElementById("adminResetStatus");
    if (adminStatus) adminStatus.textContent = "";

    sessionStorage.removeItem(GENESIS_SESSION_KEY);

    document.getElementById("astronautApp").hidden = true;
    document.getElementById("adminApp").hidden = true;
    document.getElementById("loginArea").hidden = false;

    showLoginScreen("roleChooser");

    document.getElementById("astronautWorkspace").hidden = true;
}

function renderAstronautAccounts() {
    const list = document.getElementById("astronautAccountList");
    const accounts = getGenesisAccounts();

    list.replaceChildren();

    if (accounts.length === 0) {
        list.textContent = "No astronaut accounts have been created.";
        return;
    }

    accounts.forEach(account => {
        const row = document.createElement("div");
        row.className = "account-row";

        const name = document.createElement("span");
        name.textContent = account.username;

        const pinInput = document.createElement("input");
        pinInput.type = "password";
        pinInput.inputMode = "numeric";
        pinInput.maxLength = 8;
        pinInput.placeholder = "Enter PIN";
        pinInput.setAttribute("aria-label", `PIN for ${account.username}`);

        const loginError = document.createElement("small");
        loginError.className = "field-error";

        const login = document.createElement("button");
        login.type = "button";
        login.textContent = "Sign In";

        login.addEventListener("click", () => {
            const latestAccount = getGenesisAccounts().find(
                item => item.id === account.id
            );

            if (!latestAccount) {
                loginError.textContent = "Account could not be found.";
                return;
            }

            if (pinInput.value.trim() !== latestAccount.pin) {
                loginError.textContent = "Incorrect PIN.";
                return;
            }

            loginError.textContent = "";
            enterAstronaut(latestAccount);
        });

        const resetButton = document.createElement("button");
        resetButton.type = "button";
        resetButton.textContent = "Reset PIN";

        resetButton.addEventListener("click", () => {
            const existing = row.querySelector(".login-pin-reset");

            if (existing) {
                existing.remove();
            } else {
                createLoginPinResetForm(account, row);
            }
        });

        row.append(name, pinInput, login, resetButton, loginError);

        addPinVisibilityToggle(pinInput);

        list.appendChild(row);
    });
}

function renderAdminAccounts() {
    const list = document.getElementById("adminAccountList");

    list.replaceChildren();

    const accounts = getGenesisAccounts();

    if (accounts.length === 0) {
        list.textContent = "No astronaut accounts exist yet.";
        return;
    }

    accounts.forEach(account => {
        const card = document.createElement("section");
        card.className = "admin-account-card";

        const title = document.createElement("h3");
        title.textContent = account.username;

        let logs = [];
        let saved = null;

        try {
            logs = JSON.parse(localStorage.getItem(`genesis_sleep_logs_${account.id}`) || "[]");
            saved = JSON.parse(localStorage.getItem(`genesis_generated_schedule_${account.id}`) || "null");
        } catch (error) {
            logs = [];
            saved = null;
        }

        const summary = document.createElement("p");
        summary.textContent = `Sleep reports: ${Array.isArray(logs) ? logs.length : 0} | Schedule: ${saved && Array.isArray(saved.schedule) ? "Generated" : "Not generated"}`;

        card.append(title, summary);

        const specialistButton = document.createElement("button");
        specialistButton.type = "button";
        specialistButton.textContent = "Open Specialist Review";

        specialistButton.addEventListener("click", () => {
            const previousAccountId = getActiveAccountId();

            sessionStorage.setItem(GENESIS_SESSION_KEY, account.id);

            document.getElementById("adminAccountList").hidden = true;
            document.getElementById("adminSpecialistPanel").hidden = false;
            document.getElementById("adminSpecialistTitle").textContent = `Specialist Review: ${account.username}`;

            if (typeof displaySpecialistReview === "function") {
                displaySpecialistReview();
            }

            if (previousAccountId) {
                sessionStorage.setItem(GENESIS_SESSION_KEY, previousAccountId);
            } else {
                sessionStorage.removeItem(GENESIS_SESSION_KEY);
            }
        });

        card.appendChild(specialistButton);

        if (saved && Array.isArray(saved.schedule)) {
            const details = document.createElement("details");

            const summaryLabel = document.createElement("summary");
            summaryLabel.textContent = "View schedule";

            const table = document.createElement("table");
            const header = document.createElement("tr");

            ["Period", "Bedtime", "Wake time"].forEach(label => {
                const th = document.createElement("th");
                th.textContent = label;
                header.appendChild(th);
            });

            table.appendChild(header);

            saved.schedule.forEach(period => {
                const row = document.createElement("tr");

                [period.day, period.bedtime, period.wakeTime].forEach(value => {
                    const td = document.createElement("td");
                    td.textContent = value;
                    row.appendChild(td);
                });

                table.appendChild(row);
            });

            details.append(summaryLabel, table);
            card.appendChild(details);
        }

        if (Array.isArray(logs) && logs.length) {
            const details = document.createElement("details");

            const summaryLabel = document.createElement("summary");
            summaryLabel.textContent = "View sleep reports";

            const reportList = document.createElement("ul");

            logs.slice().sort((a, b) => b.date.localeCompare(a.date)).forEach(log => {
                const item = document.createElement("li");
                item.textContent = `${log.date}: ${log.duration} hours, ${log.quality} quality`;
                reportList.appendChild(item);
            });

            details.append(summaryLabel, reportList);
            card.appendChild(details);
        }

        list.appendChild(card);
    });
}

function initializeGenesisAccounts() {
    document.querySelectorAll('input[type="password"]').forEach(input => {
        addPinVisibilityToggle(input);
    });

    document.getElementById("chooseAstronautView").addEventListener("click", () => {
        document.getElementById("adminPin").value = "";
        document.getElementById("adminResetPin").value = "";

        showLoginScreen("astronautLoginScreen");
        renderAstronautAccounts();
    });

    document.getElementById("chooseAdminView").addEventListener("click", () => {
        document.getElementById("adminPin").value = "";

        const storedPin = localStorage.getItem(GENESIS_ADMIN_KEY);

        if (!storedPin) {
            showLoginScreen("adminSetupScreen");
        } else {
            showLoginScreen("adminLoginScreen");
        }
    });

    document.querySelectorAll("[data-back-login]").forEach(button =>
        button.addEventListener("click", () => {
            document.getElementById("adminPin").value = "";
            document.getElementById("newAdminPin").value = "";
            showLoginScreen("roleChooser");
        })
    );

    document.getElementById("openCreateAstronaut").addEventListener("click", () => {
        showAuthError("createAstronautError", "");

        document.getElementById("newAstronautName").value = "";
        document.getElementById("newAstronautFirstName").value = "";
        document.getElementById("newAstronautLastName").value = "";
        document.getElementById("newAstronautDob").value = "";
        document.getElementById("newAstronautPin").value = "";

        showLoginScreen("createAstronautScreen");
    });

    document.getElementById("createAstronautButton").addEventListener("click", () => {
        const username = document.getElementById("newAstronautName").value.trim();
        const firstName = document.getElementById("newAstronautFirstName").value.trim();
        const lastName = document.getElementById("newAstronautLastName").value.trim();
        const dateOfBirth = document.getElementById("newAstronautDob").value;
        const pin = document.getElementById("newAstronautPin").value.trim();

        const accounts = getGenesisAccounts();

        if (!username) return showAuthError("createAstronautError", "Enter a username.");
        if (!firstName) return showAuthError("createAstronautError", "Enter the astronaut's first name.");
        if (!lastName) return showAuthError("createAstronautError", "Enter the astronaut's last name.");
        if (!dateOfBirth) return showAuthError("createAstronautError", "Enter the astronaut's date of birth.");

        if (dateOfBirth > new Date().toISOString().slice(0, 10)) {
            return showAuthError("createAstronautError", "Date of birth cannot be in the future.");
        }

        if (!/^\d{4,8}$/.test(pin)) {
            return showAuthError("createAstronautError", "PIN must contain 4 to 8 digits.");
        }

        if (accounts.length >= GENESIS_MAX_ASTRONAUTS) {
            return showAuthError("createAstronautError", "The 15 astronaut account limit has been reached.");
        }

        if (accounts.some(account => account.username.toLowerCase() === username.toLowerCase())) {
            return showAuthError("createAstronautError", "That username is already in use.");
        }

        const account = {
            id: `astronaut_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            username,
            firstName,
            lastName,
            fullName: `${firstName} ${lastName}`,
            dateOfBirth,
            pin,
            createdAt: new Date().toISOString()
        };

        accounts.push(account);
        saveGenesisAccounts(accounts);

        enterAstronaut(account);
    });

    document.getElementById("saveExistingRecoveryDetails").addEventListener("click", () => {
        const account = getActiveGenesisAccount();

        const firstName = document.getElementById("existingAstronautFirstName").value.trim();
        const lastName = document.getElementById("existingAstronautLastName").value.trim();
        const dateOfBirth = document.getElementById("existingAstronautDob").value;

        if (!account) {
            return showAuthError("existingRecoveryError", "No astronaut account is signed in.");
        }

        if (!firstName) {
            return showAuthError("existingRecoveryError", "Enter the astronaut's first name.");
        }

        if (!lastName) {
            return showAuthError("existingRecoveryError", "Enter the astronaut's last name.");
        }

        if (!dateOfBirth) {
            return showAuthError("existingRecoveryError", "Enter the astronaut's date of birth.");
        }

        if (dateOfBirth > new Date().toISOString().slice(0, 10)) {
            return showAuthError("existingRecoveryError", "Date of birth cannot be in the future.");
        }

        const accounts = getGenesisAccounts();
        const accountToUpdate = accounts.find(item => item.id === account.id);

        if (!accountToUpdate) {
            return showAuthError("existingRecoveryError", "Account could not be found.");
        }

        accountToUpdate.firstName = firstName;
        accountToUpdate.lastName = lastName;
        accountToUpdate.fullName = `${firstName} ${lastName}`;
        accountToUpdate.dateOfBirth = dateOfBirth;

        saveGenesisAccounts(accounts);

        document.getElementById("astronautRecoverySetup").hidden = true;
        document.getElementById("astronautWorkspace").hidden = false;

        showAstronautTask("scheduler");
    });

    document.getElementById("createAdminButton").addEventListener("click", () => {
        const pin = document.getElementById("newAdminPin").value.trim();

        if (!/^\d{4,8}$/.test(pin)) {
            return showAuthError("adminSetupError", "PIN must contain 4 to 8 digits.");
        }

        localStorage.setItem(GENESIS_ADMIN_KEY, pin);

        document.getElementById("newAdminPin").value = "";

        showLoginScreen("adminLoginScreen");
        showAuthError("adminLoginError", "Admin PIN created. Sign in to continue.");
    });

    document.getElementById("adminLoginButton").addEventListener("click", () => {
        const pin = document.getElementById("adminPin").value.trim();

        if (pin !== localStorage.getItem(GENESIS_ADMIN_KEY)) {
            return showAuthError("adminLoginError", "Incorrect admin PIN.");
        }

        showAuthError("adminLoginError", "");
        enterAdmin();
    });

    document.getElementById("openAstronautPinReset").addEventListener("click", () => {
        document.querySelectorAll(".astronaut-task").forEach(task => task.hidden = true);

        document.getElementById("astronautPinResetPanel").hidden = false;
        document.getElementById("resetAstronautPinButton").disabled = false;

        [
            "resetAstronautFirstName",
            "resetAstronautLastName",
            "resetAstronautDob",
            "resetAstronautNewPin",
            "resetAstronautConfirmPin"
        ].forEach(id => document.getElementById(id).value = "");

        showAuthError("astronautPinResetError", "");
        document.getElementById("astronautPinResetError").style.color = "";
    });

    document.getElementById("cancelAstronautPinReset").addEventListener("click", () => {
        document.getElementById("astronautPinResetPanel").hidden = true;
        showAstronautTask("scheduler");
    });

    document.getElementById("resetAstronautPinButton").addEventListener("click", () => {
        const account = getActiveGenesisAccount();
        const button = document.getElementById("resetAstronautPinButton");

        if (!account) {
            return showAuthError("astronautPinResetError", "No astronaut account is currently signed in.");
        }

        button.disabled = true;

        const success = resetAstronautPin(
            account,
            document.getElementById("resetAstronautFirstName").value,
            document.getElementById("resetAstronautLastName").value,
            document.getElementById("resetAstronautDob").value,
            document.getElementById("resetAstronautNewPin").value.trim(),
            document.getElementById("resetAstronautConfirmPin").value.trim(),
            document.getElementById("astronautPinResetError")
        );

        if (!success) {
            button.disabled = false;
        }
    });

    document.getElementById("closeAdminSpecialist").addEventListener("click", () => {
        document.getElementById("adminSpecialistPanel").hidden = true;
        document.getElementById("adminAccountList").hidden = false;
    });

    document.getElementById("astronautLogoutButton").addEventListener("click", logoutGenesis);
    document.getElementById("adminLogoutButton").addEventListener("click", logoutGenesis);

    document.getElementById("adminResetButton").addEventListener("click", () => {
        const pin = document.getElementById("adminResetPin").value.trim();
        const status = document.getElementById("adminResetStatus");

        if (pin !== localStorage.getItem(GENESIS_ADMIN_KEY)) {
            status.textContent = "Incorrect PIN. Nothing was erased.";
            return;
        }

        if (!confirm("This will permanently erase all astronaut accounts, PINs, schedules, reports, and events on this device. Continue?")) {
            return;
        }

        Object.keys(localStorage)
            .filter(key => key.startsWith("genesis_"))
            .forEach(key => localStorage.removeItem(key));

        sessionStorage.removeItem(GENESIS_SESSION_KEY);
        location.reload();
    });

    document.querySelectorAll("[data-task]").forEach(button =>
        button.addEventListener("click", () => {
            showAstronautTask(button.dataset.task);

            if (
                button.dataset.task === "astronautEvents" &&
                typeof renderAstronautEvents === "function"
            ) {
                renderAstronautEvents();
            }
        })
    );

    document.getElementById("saveAstronautEvent").addEventListener("click", saveAstronautEvent);
    document.getElementById("saveAdminEvent").addEventListener("click", saveAdminEvent);
}

// Initialize account buttons after the page and its elements have loaded.
window.addEventListener("load", initializeGenesisAccounts);
