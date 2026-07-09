const SOURCE_TIME_ZONE = "America/Los_Angeles";
const DISPLAY_TONE_STORAGE_KEY = "retreat-display-tone-v2";
const SECONDS_VISIBILITY_STORAGE_KEY = "retreat-seconds-visibility-v2";
const RETREAT_DATES = [
  { date: "2026-07-08", template: "full" },
  { date: "2026-07-09", template: "full" },
  { date: "2026-07-10", template: "full" },
  { date: "2026-07-11", template: "full" },
  { date: "2026-07-12", template: "sunday" },
];

const FULL_DAY = [
  ["08:00", "Guided Meditation"],
  ["08:40", "Break"],
  ["08:50", "Meditation"],
  ["09:30", "Break"],
  ["09:40", "Meditation"],
  ["10:20", "Break"],
  ["10:30", "Talk"],
  ["11:30", "Lunch / Free Time"],
  ["14:00", "Meditation"],
  ["14:40", "Break"],
  ["14:50", "Q&A"],
  ["16:20", "Dinner Break"],
  ["18:00", "Meditation"],
  ["18:40", "Break"],
  ["19:00", "Poetry"],
  ["19:40", "Break"],
  ["19:50", "Meditation"],
  ["20:20", "Break"],
  ["20:30", "Meditation"],
  ["21:00", "Close"],
];

const SUNDAY = [
  ["08:00", "Guided Meditation"],
  ["08:40", "Break"],
  ["08:50", "Meditation"],
  ["09:30", "Break"],
  ["09:40", "Meditation"],
  ["10:20", "Break"],
];

const SCHEDULE_PERIODS = [
  { id: "morning", label: "Morning" },
  { id: "afternoon", label: "Afternoon" },
  { id: "evening", label: "Evening" },
];

const elements = {
  statusLabel: document.querySelector("#status-label"),
  localClock: document.querySelector("#local-clock"),
  currentTitle: document.querySelector("#current-title"),
  currentWindow: document.querySelector("#current-window"),
  nextTitle: document.querySelector("#next-title"),
  nextWindow: document.querySelector("#next-window"),
  countdown: document.querySelector("#countdown"),
  countdownNote: document.querySelector("#countdown-note"),
  scheduleDay: document.querySelector("#schedule-day"),
  sourceNote: document.querySelector("#source-note"),
  scheduleList: document.querySelector("#schedule-list"),
};

const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local time";
const events = buildEvents();
let renderedSourceDate = null;
let showCountdownSeconds = false;

function storePreference(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (_) {
    // The controls still work when storage is unavailable.
  }
}

function setDisplayTone(tone, persist = false) {
  const resolvedTone = tone === "dim" ? "dim" : "bright";
  document.documentElement.dataset.displayTone = resolvedTone;
  document.body.dataset.displayTone = resolvedTone;

  document.querySelectorAll(".display-tone-control [data-display-tone]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.displayTone === resolvedTone));
  });

  if (persist) {
    storePreference(DISPLAY_TONE_STORAGE_KEY, resolvedTone);
  }
}

setDisplayTone(document.documentElement.dataset.displayTone);
document.querySelectorAll(".display-tone-control [data-display-tone]").forEach((button) => {
  button.addEventListener("click", () => setDisplayTone(button.dataset.displayTone, true));
});

function setSecondsVisibility(visibility, persist = false, updateClocks = true) {
  showCountdownSeconds = visibility !== "hide";
  const resolvedVisibility = showCountdownSeconds ? "show" : "hide";
  document.documentElement.dataset.secondsVisibility = resolvedVisibility;

  document.querySelectorAll(".seconds-control [data-seconds-visibility]").forEach((button) => {
    const isSelected = button.dataset.secondsVisibility === resolvedVisibility;
    button.setAttribute("aria-pressed", String(isSelected));
  });

  if (persist) {
    storePreference(SECONDS_VISIBILITY_STORAGE_KEY, resolvedVisibility);
  }

  if (updateClocks) {
    renderStatus();
  }
}

setSecondsVisibility(document.documentElement.dataset.secondsVisibility, false, false);
document.querySelectorAll(".seconds-control [data-seconds-visibility]").forEach((button) => {
  button.addEventListener("click", () => setSecondsVisibility(button.dataset.secondsVisibility, true));
});

function buildEvents() {
  return RETREAT_DATES.flatMap((retreatDay) => {
    const daySchedule = retreatDay.template === "sunday" ? SUNDAY : FULL_DAY;

    return daySchedule.map(([time, name]) => {
      const [hour, minute] = time.split(":").map(Number);
      const [year, month, day] = retreatDay.date.split("-").map(Number);

      return {
        sourceDate: retreatDay.date,
        sourceTime: time,
        name,
        start: zonedTimeToDate({ year, month, day, hour, minute }, SOURCE_TIME_ZONE),
      };
    });
  }).sort((a, b) => a.start - b.start);
}

function getTimeZoneOffset(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );

  return asUtc - date.getTime();
}

function zonedTimeToDate(parts, timeZone) {
  const utcGuess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute
  );
  const firstOffset = getTimeZoneOffset(new Date(utcGuess), timeZone);
  const refinedGuess = utcGuess - firstOffset;
  const secondOffset = getTimeZoneOffset(new Date(refinedGuess), timeZone);

  return new Date(utcGuess - secondOffset);
}

function findStatus(now) {
  const firstEvent = events[0];
  const nextIndex = events.findIndex((event) => event.start > now);

  if (now < firstEvent.start) {
    return { current: null, next: firstEvent, phase: "before" };
  }

  if (nextIndex === -1) {
    return { current: getFinalCurrent(now), next: null, phase: "after" };
  }

  const current = events[nextIndex - 1];

  if (current.name === "Close") {
    return {
      current: {
        name: "Closed for the evening",
        start: current.start,
        end: events[nextIndex].start,
      },
      next: events[nextIndex],
      phase: "between",
    };
  }

  return {
    current: { ...current, end: events[nextIndex].start },
    next: events[nextIndex],
    phase: "during",
  };
}

function getFinalCurrent(now) {
  const finalEvent = events[events.length - 1];
  const inferredBreakEnd = new Date(finalEvent.start.getTime() + 20 * 60 * 1000);

  if (now < inferredBreakEnd) {
    return { ...finalEvent, end: inferredBreakEnd };
  }

  return { name: "Retreat complete", start: inferredBreakEnd, end: null };
}

function formatClock(date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function formatTime(date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatTimeWithZone(date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function formatDateHeading(date) {
  return new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(date);
}

function formatDateSubheading(date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
  }).format(date);
}

function formatDateKeyInZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatLocalDateKey(date) {
  return formatDateKeyInZone(date, localTimeZone);
}

function formatSourceDay(date) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: SOURCE_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

function getSchedulePeriod(event) {
  if (event.sourceTime < "14:00") return "morning";
  if (event.sourceTime < "18:00") return "afternoon";
  return "evening";
}

function formatWindow(start, end) {
  if (!start) return "";
  if (!end) return `Since ${formatTimeWithZone(start)}`;
  return `${formatTime(start)}–${formatTimeWithZone(end)}`;
}

function getDurationDisplay(milliseconds, includeSeconds = showCountdownSeconds) {
  const remainingMilliseconds = Math.max(0, milliseconds);

  if (!includeSeconds) {
    if (remainingMilliseconds > 0 && remainingMilliseconds < 60000) {
      return {
        text: "<1 min",
        value: "<1",
        unit: "min",
        accessibleText: "less than 1 minute",
      };
    }

    const totalMinutes = Math.ceil(remainingMilliseconds / 60000);

    return {
      text: `${totalMinutes} min`,
      value: String(totalMinutes),
      unit: "min",
      accessibleText: `${totalMinutes} ${totalMinutes === 1 ? "minute" : "minutes"}`,
    };
  }

  const totalSeconds = Math.floor(remainingMilliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { text: hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}` };
}

function formatDuration(milliseconds, includeSeconds = showCountdownSeconds) {
  return getDurationDisplay(milliseconds, includeSeconds).text;
}

function renderDuration(element, milliseconds, includeSeconds = showCountdownSeconds) {
  const display = getDurationDisplay(milliseconds, includeSeconds);

  if (display.unit) {
    const unit = document.createElement("span");
    unit.className = "duration-unit";
    unit.textContent = display.unit;
    element.replaceChildren(document.createTextNode(`${display.value} `), unit);
  } else {
    element.textContent = display.text;
  }

  if (element.getAttribute("aria-hidden") === "true") {
    element.removeAttribute("aria-label");
  } else {
    element.setAttribute("aria-label", display.accessibleText || display.text);
  }
}

function renderStatus() {
  const now = new Date();
  const status = findStatus(now);
  const sourceDate = formatDateKeyInZone(now, SOURCE_TIME_ZONE);

  if (sourceDate !== renderedSourceDate) {
    renderSchedule(now);
  }

  elements.localClock.textContent = formatClock(now);
  elements.localClock.dateTime = now.toISOString();

  if (!status.current) {
    elements.statusLabel.textContent = "Begins soon";
    elements.currentTitle.textContent = "The retreat has not started";
    elements.currentWindow.textContent = "";
  } else {
    elements.statusLabel.textContent = status.phase === "after" ? "Retreat status" : "Happening now";
    elements.currentTitle.textContent = status.current.name;
    elements.currentWindow.textContent = formatWindow(status.current.start, status.current.end);
  }

  if (!status.next) {
    elements.nextTitle.textContent = "the end of the retreat";
    elements.nextWindow.textContent = "";
    renderDuration(elements.countdown, 0);
    elements.countdownNote.hidden = true;
  } else {
    elements.nextTitle.textContent = status.next.name;
    elements.nextWindow.textContent = formatTimeWithZone(status.next.start);
    renderDuration(elements.countdown, status.next.start.getTime() - now.getTime());
    elements.countdownNote.hidden = false;
  }

  updateScheduleHighlights(status, now);
}

function renderSchedule(now = new Date()) {
  const sourceDate = formatDateKeyInZone(now, SOURCE_TIME_ZONE);
  const todayEvents = events.filter((event) => event.sourceDate === sourceDate);

  renderedSourceDate = sourceDate;
  elements.scheduleDay.textContent = formatSourceDay(now);

  if (todayEvents.length === 0) {
    elements.scheduleList.innerHTML = '<p class="empty-schedule">There are no retreat sessions scheduled today.</p>';
    return;
  }

  const periods = SCHEDULE_PERIODS.map((period) => ({
    ...period,
    events: todayEvents.filter((event) => getSchedulePeriod(event) === period.id),
  })).filter((period) => period.events.length > 0);

  const renderPeriod = (period) => {
    let previousLocalDate = null;
    const rows = period.events.map((event) => {
      const localDate = formatLocalDateKey(event.start);
      const dateMarker = localDate === previousLocalDate ? "" : `
        <p class="local-date-marker">${formatDateHeading(event.start)} <span>${formatDateSubheading(event.start)}</span></p>
      `;
      previousLocalDate = localDate;

      return `${dateMarker}
      <div class="session-row" data-start="${event.start.toISOString()}">
        <time class="session-time" datetime="${event.start.toISOString()}">${formatTime(event.start)}</time>
        <div class="session-detail">
          <div class="session-name">${event.name}</div>
          <span class="session-state" aria-hidden="true"></span>
          <span class="session-row-countdown" aria-hidden="true" hidden></span>
        </div>
      </div>
      `;
    }).join("");

    return `
      <section class="schedule-period schedule-period-${period.id}" aria-labelledby="${period.id}-schedule-title">
        <h3 id="${period.id}-schedule-title" class="period-title">${period.label}</h3>
        <div class="session-list">${rows}</div>
      </section>
    `;
  };

  const leftPeriods = periods.filter((period) => period.id !== "evening");
  const rightPeriods = periods.filter((period) => period.id === "evening");
  const oneColumnClass = rightPeriods.length === 0 ? " schedule-columns-single" : "";

  elements.scheduleList.innerHTML = `
    <div class="schedule-columns${oneColumnClass}">
      <div class="schedule-column">${leftPeriods.map(renderPeriod).join("")}</div>
      ${rightPeriods.length > 0
        ? `<div class="schedule-column">${rightPeriods.map(renderPeriod).join("")}</div>`
        : ""}
    </div>
  `;
}

function getRemainingProgress(start, end, now) {
  const startTime = start?.getTime();
  const endTime = end?.getTime();
  const nowTime = now?.getTime();

  if (![startTime, endTime, nowTime].every(Number.isFinite) || endTime <= startTime) {
    return 0;
  }

  return Math.min(1, Math.max(0, (endTime - nowTime) / (endTime - startTime)));
}

function updateScheduleHighlights(status, now = new Date()) {
  document.querySelectorAll(".session-row").forEach((row) => {
    row.classList.remove("is-active", "is-next");
    row.style.removeProperty("--session-progress");
    const stateLabel = row.querySelector(".session-state");
    const rowCountdown = row.querySelector(".session-row-countdown");
    const rowStart = row.dataset.start;
    const currentStart = status.current?.start?.toISOString();
    const nextStart = status.next?.start?.toISOString();

    if (rowStart === currentStart && status.current?.name !== "Closed for the evening") {
      const remainingProgress = getRemainingProgress(status.current.start, status.current.end, now);
      row.classList.add("is-active");
      row.style.setProperty("--session-progress", `${remainingProgress * 100}%`);
      stateLabel.textContent = "Now";
      if (status.current.end) {
        renderDuration(rowCountdown, status.current.end.getTime() - now.getTime());
        rowCountdown.hidden = false;
      }
    } else if (rowStart === nextStart) {
      row.classList.add("is-next");
      stateLabel.textContent = "Next";
      rowCountdown.textContent = "";
      rowCountdown.hidden = true;
    } else {
      stateLabel.textContent = "";
      rowCountdown.textContent = "";
      rowCountdown.hidden = true;
    }
  });
}

elements.sourceNote.innerHTML = `Times shown in <strong>${localTimeZone}</strong>.`;

renderStatus();
setInterval(renderStatus, 1000);
