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

// Add new YouTube URLs here as retreat recordings become available.
const RECORDINGS = {
  "2026-07-08": {
    "Guided Meditation": "https://youtu.be/IdJzO_a-i0w",
    Talk: "https://youtu.be/2b4Hsy8h2rk",
    "Q&A": "https://youtu.be/2s76op3f6R8",
    Poetry: "https://youtu.be/9WjLV4QVSG0",
  },
  "2026-07-09": {
    "Guided Meditation": "https://youtu.be/o_SpSquIuuM",
    Talk: "https://youtu.be/kMOeiAyKqTo",
    "Q&A": "https://youtu.be/Gan46Py8TlU",
    Poetry: "https://youtu.be/eAL5vdTgRB0",
  },
};
const RECORDED_SESSION_NAMES = new Set([
  "Guided Meditation",
  "Talk",
  "Q&A",
  "Poetry",
]);

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
  retreatDateRange: document.querySelector("#retreat-date-range"),
  statusLabel: document.querySelector("#status-label"),
  currentTitle: document.querySelector("#current-title"),
  currentWindow: document.querySelector("#current-window"),
  nextTitle: document.querySelector("#next-title"),
  nextWindow: document.querySelector("#next-window"),
  countdown: document.querySelector("#countdown"),
  countdownNote: document.querySelector("#countdown-note"),
  scheduleTitle: document.querySelector("#schedule-title"),
  sourceNote: document.querySelector("#source-note"),
  scheduleTabs: document.querySelector("#schedule-tabs"),
  scheduleList: document.querySelector("#schedule-list"),
};

const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const events = buildEvents();
let observedSourceDate = null;
let selectedRetreatDate = null;
let followsCurrentRetreatDay = true;
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
        isRecordedSession: RECORDED_SESSION_NAMES.has(name),
        recordingUrl: RECORDINGS[retreatDay.date]?.[name] || null,
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

function formatTime(date) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: localTimeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatTimeWithZone(date) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: localTimeZone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function formatDateHeading(date) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: localTimeZone,
    weekday: "long",
  }).format(date);
}

function formatDateSubheading(date) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: localTimeZone,
    month: "long",
    day: "numeric",
  }).format(date);
}

function formatTabDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: localTimeZone,
    weekday: "short",
    month: "short",
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

function getCalendarDateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "long",
    day: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: values.year,
    month: values.month,
    monthNumber: Number(new Intl.DateTimeFormat("en-US", {
      timeZone,
      month: "numeric",
    }).format(date)),
    day: values.day,
  };
}

function formatLocalizedDateRange(start, end, timeZone = localTimeZone) {
  const first = getCalendarDateParts(start, timeZone);
  const last = getCalendarDateParts(end, timeZone);

  if (first.year === last.year && first.monthNumber === last.monthNumber) {
    if (first.day === last.day) return `${first.month} ${first.day}, ${first.year}`;
    return `${first.month} ${first.day}\u2013${last.day}, ${first.year}`;
  }

  if (first.year === last.year) {
    return `${first.month} ${first.day}\u2013${last.month} ${last.day}, ${first.year}`;
  }

  return `${first.month} ${first.day}, ${first.year}\u2013${last.month} ${last.day}, ${last.year}`;
}

function renderLocalizedDateRange() {
  elements.retreatDateRange.textContent = formatLocalizedDateRange(
    events[0].start,
    events[events.length - 1].start
  );
}

function getDefaultRetreatDate(now = new Date()) {
  const sourceDate = formatDateKeyInZone(now, SOURCE_TIME_ZONE);
  const firstDate = RETREAT_DATES[0].date;
  const finalDate = RETREAT_DATES[RETREAT_DATES.length - 1].date;

  if (sourceDate <= firstDate) return firstDate;
  if (sourceDate >= finalDate) return finalDate;
  return RETREAT_DATES.some((retreatDay) => retreatDay.date === sourceDate)
    ? sourceDate
    : firstDate;
}

function positionScheduleTabIndicator(dayPosition) {
  const indicator = elements.scheduleTabs.querySelector(".day-tab-selection");
  const tabs = Array.from(elements.scheduleTabs.querySelectorAll("[role=tab]"));
  if (!indicator || tabs.length === 0 || !Number.isFinite(dayPosition)) return;

  const boundedPosition = Math.min(tabs.length - 1, Math.max(0, dayPosition));
  const firstIndex = Math.floor(boundedPosition);
  const finalIndex = Math.ceil(boundedPosition);
  const progress = boundedPosition - firstIndex;
  const firstTab = tabs[firstIndex];
  const finalTab = tabs[finalIndex];
  const left = firstTab.offsetLeft + ((finalTab.offsetLeft - firstTab.offsetLeft) * progress);
  const top = firstTab.offsetTop + ((finalTab.offsetTop - firstTab.offsetTop) * progress);
  const width = firstTab.offsetWidth + ((finalTab.offsetWidth - firstTab.offsetWidth) * progress);
  const height = firstTab.offsetHeight + ((finalTab.offsetHeight - firstTab.offsetHeight) * progress);

  indicator.style.width = `${width}px`;
  indicator.style.height = `${height}px`;
  indicator.style.transform = `translate3d(${left}px, ${top}px, 0)`;
}

function renderScheduleTabs(currentSourceDate, updateIndicator = true) {
  let tabs = Array.from(elements.scheduleTabs.querySelectorAll("[role=tab]"));

  if (tabs.length !== RETREAT_DATES.length) {
    elements.scheduleTabs.innerHTML = `
      <span class="day-tab-selection" aria-hidden="true"></span>
      ${RETREAT_DATES.map((retreatDay, index) => {
        const firstEvent = events.find((event) => event.sourceDate === retreatDay.date);

        return `
          <button
            id="schedule-tab-${index + 1}"
            class="day-tab"
            type="button"
            role="tab"
            aria-controls="schedule-list"
            data-source-date="${retreatDay.date}"
          >
            <span class="day-tab-name">Day ${index + 1}</span>
            <span class="day-tab-date">${formatTabDate(firstEvent.start)}</span>
          </button>
        `;
      }).join("")}
    `;

    tabs = Array.from(elements.scheduleTabs.querySelectorAll("[role=tab]"));

    const selectTab = (tab, focusTab = false) => {
      selectRetreatDay(tab.dataset.sourceDate, { animate: true, focusTab });
    };

    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => selectTab(tab, true));
      tab.addEventListener("keydown", (event) => {
        let nextIndex = null;

        if (event.key === "Home") {
          nextIndex = 0;
        } else if (event.key === "End") {
          nextIndex = tabs.length - 1;
        }

        if (nextIndex === null) return;
        event.preventDefault();
        selectTab(tabs[nextIndex], true);
      });
    });
  }

  tabs.forEach((tab, index) => {
    const retreatDay = RETREAT_DATES[index];
    const isSelected = retreatDay.date === selectedRetreatDate;
    const isCurrent = retreatDay.date === currentSourceDate;

    tab.classList.toggle("is-current", isCurrent);
    tab.setAttribute("aria-selected", String(isSelected));
    tab.setAttribute("tabindex", isSelected ? "0" : "-1");
    if (isCurrent) {
      tab.setAttribute("aria-current", "date");
    } else {
      tab.removeAttribute("aria-current");
    }
  });

  if (updateIndicator) {
    positionScheduleTabIndicator(getSelectedRetreatDayIndex());
  }
}

function getSelectedRetreatDayIndex() {
  return RETREAT_DATES.findIndex((retreatDay) => retreatDay.date === selectedRetreatDate);
}

function getScheduleTrack() {
  return elements.scheduleList.querySelector(".schedule-track");
}

function setScheduleTrackPosition(dayIndex, { animate = true } = {}) {
  const track = getScheduleTrack();
  if (!track || dayIndex < 0) return;

  const panelWidth = track.getBoundingClientRect().width;
  if (!panelWidth) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  elements.scheduleList.scrollTo({
    left: dayIndex * panelWidth,
    behavior: animate && !reduceMotion ? "smooth" : "auto",
  });

  if (!animate || reduceMotion) {
    positionScheduleTabIndicator(dayIndex);
  }
}

function updateScheduleSelection(
  now = new Date(),
  animate = false,
  moveTrack = true,
  updateIndicator = false
) {
  const currentSourceDate = formatDateKeyInZone(now, SOURCE_TIME_ZONE);
  const selectedDayIndex = getSelectedRetreatDayIndex();
  const selectedEvents = events.filter((event) => event.sourceDate === selectedRetreatDate);

  if (selectedDayIndex < 0 || selectedEvents.length === 0) return;

  renderScheduleTabs(currentSourceDate, updateIndicator);
  elements.scheduleList.setAttribute("aria-labelledby", `schedule-tab-${selectedDayIndex + 1}`);
  elements.scheduleTitle.textContent = "Retreat schedule";
  elements.sourceNote.innerHTML = `Times shown in <strong>${localTimeZone}</strong>.`;

  elements.scheduleList.querySelectorAll(".schedule-day-panel").forEach((panel, index) => {
    const isSelected = index === selectedDayIndex;
    panel.setAttribute("aria-hidden", String(!isSelected));
    panel.toggleAttribute("inert", !isSelected);
  });

  if (moveTrack) setScheduleTrackPosition(selectedDayIndex, { animate });
  updateScheduleHighlights(findStatus(now), now);
}

function selectRetreatDay(sourceDate, {
  animate = true,
  focusTab = false,
  moveTrack = true,
  updateIndicator = false,
} = {}) {
  const nextDayIndex = RETREAT_DATES.findIndex((retreatDay) => retreatDay.date === sourceDate);
  if (nextDayIndex < 0) return;

  const selectionChanged = sourceDate !== selectedRetreatDate;
  selectedRetreatDate = sourceDate;
  followsCurrentRetreatDay = selectedRetreatDate === getDefaultRetreatDate();
  updateScheduleSelection(
    new Date(),
    animate && selectionChanged,
    moveTrack,
    updateIndicator
  );

  const selectedTab = elements.scheduleTabs.querySelector(
    `[data-source-date="${selectedRetreatDate}"]`
  );

  if (focusTab) selectedTab?.focus();

  if (selectionChanged && elements.scheduleTabs.scrollWidth > elements.scheduleTabs.clientWidth) {
    const tabsBounds = elements.scheduleTabs.getBoundingClientRect();
    const selectedBounds = selectedTab?.getBoundingClientRect();

    if (selectedBounds) {
      const leftOverflow = selectedBounds.left - tabsBounds.left - 8;
      const rightOverflow = selectedBounds.right - tabsBounds.right + 8;
      const scrollDelta = leftOverflow < 0 ? leftOverflow : Math.max(0, rightOverflow);

      elements.scheduleTabs.scrollBy({
        left: scrollDelta,
        behavior: animate ? "smooth" : "auto",
      });
    }
  }
}

function initializeScheduleScrolling() {
  let scrollEndTimer = null;
  let lastPanelWidth = 0;

  const syncSelectionToScroll = () => {
    clearTimeout(scrollEndTimer);
    scrollEndTimer = null;

    const panelWidth = getScheduleTrack()?.getBoundingClientRect().width || 0;
    if (!panelWidth) return;

    const dayIndex = Math.min(
      RETREAT_DATES.length - 1,
      Math.max(0, Math.round(elements.scheduleList.scrollLeft / panelWidth))
    );

    if (dayIndex === getSelectedRetreatDayIndex()) {
      positionScheduleTabIndicator(dayIndex);
      return;
    }

    selectRetreatDay(RETREAT_DATES[dayIndex].date, {
      animate: false,
      moveTrack: false,
      updateIndicator: true,
    });
  };

  elements.scheduleList.addEventListener("scroll", () => {
    const panelWidth = getScheduleTrack()?.getBoundingClientRect().width || 0;
    if (panelWidth) {
      positionScheduleTabIndicator(elements.scheduleList.scrollLeft / panelWidth);
    }

    clearTimeout(scrollEndTimer);
    scrollEndTimer = setTimeout(syncSelectionToScroll, 100);
  }, { passive: true });

  elements.scheduleList.addEventListener("scrollend", syncSelectionToScroll);

  elements.scheduleList.addEventListener("dragstart", (event) => {
    if (event.target.closest("a")) event.preventDefault();
  });

  const resizeObserver = new ResizeObserver(() => {
    const panelWidth = getScheduleTrack()?.getBoundingClientRect().width || 0;
    if (!panelWidth || Math.abs(panelWidth - lastPanelWidth) < 0.5) return;

    lastPanelWidth = panelWidth;
    setScheduleTrackPosition(getSelectedRetreatDayIndex(), { animate: false });
  });
  resizeObserver.observe(elements.scheduleList);

  let verticalPageTarget = null;
  let verticalPageResetTimer = null;

  const clearVerticalPageTarget = () => {
    verticalPageTarget = null;
    clearTimeout(verticalPageResetTimer);
  };

  window.addEventListener("scrollend", clearVerticalPageTarget);

  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;

    const eventTarget = event.target instanceof Element ? event.target : null;
    if (eventTarget?.closest("input, select, textarea, [contenteditable]")) return;

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();

      const targetId = event.key === "ArrowUp" ? "timer" : "schedule";
      if (verticalPageTarget === targetId) return;

      verticalPageTarget = targetId;
      document.querySelector(`#${targetId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

      clearTimeout(verticalPageResetTimer);
      verticalPageResetTimer = setTimeout(clearVerticalPageTarget, 800);
      return;
    }

    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    const interactiveTarget = eventTarget?.closest("a, button");
    if (interactiveTarget && interactiveTarget.getAttribute("role") !== "tab") return;

    const scheduleBounds = document.querySelector("#schedule").getBoundingClientRect();
    const visibleScheduleHeight = Math.max(
      0,
      Math.min(window.innerHeight, scheduleBounds.bottom) - Math.max(0, scheduleBounds.top)
    );

    if (visibleScheduleHeight < window.innerHeight * 0.5) return;

    const currentDayIndex = getSelectedRetreatDayIndex();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextDayIndex = Math.min(
      RETREAT_DATES.length - 1,
      Math.max(0, currentDayIndex + direction)
    );

    event.preventDefault();

    if (nextDayIndex === currentDayIndex) {
      setScheduleTrackPosition(currentDayIndex, { animate: true });
      return;
    }

    selectRetreatDay(RETREAT_DATES[nextDayIndex].date, {
      animate: true,
      focusTab: interactiveTarget?.getAttribute("role") === "tab",
    });
  });
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

    if (totalMinutes > 180) {
      const hoursValue = String(Math.ceil(totalMinutes / 60));

      return {
        text: `${hoursValue} hr`,
        value: hoursValue,
        unit: "hr",
        accessibleText: `${hoursValue} hours`,
      };
    }

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

  if (sourceDate !== observedSourceDate) {
    observedSourceDate = sourceDate;
    if (followsCurrentRetreatDay || !selectedRetreatDate) {
      selectedRetreatDate = getDefaultRetreatDate(now);
    }
    renderSchedule(now);
  }

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

function renderRetreatDayPanel(retreatDay, dayIndex) {
  const dayEvents = events.filter((event) => event.sourceDate === retreatDay.date);
  const periods = SCHEDULE_PERIODS.map((period) => ({
    ...period,
    events: dayEvents.filter((event) => getSchedulePeriod(event) === period.id),
  })).filter((period) => period.events.length > 0);

  const renderPeriod = (period) => {
    let previousLocalDate = null;
    const rows = period.events.map((event) => {
      const localDate = formatLocalDateKey(event.start);
      const dateMarker = localDate === previousLocalDate ? "" : `
        <p class="local-date-marker">${formatDateHeading(event.start)} <span>${formatDateSubheading(event.start)}</span></p>
      `;
      previousLocalDate = localDate;
      const sessionName = event.recordingUrl
        ? `
          <a
            class="session-name session-recording-link"
            href="${event.recordingUrl}"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Watch the ${event.name} recording on YouTube"
          >
            <span>${event.name}</span>
          </a>
        `
        : `<div class="session-name">${event.name}</div>`;
      const recordedMarker = event.isRecordedSession && !event.recordingUrl
        ? '<span class="session-recorded-marker is-visible" role="img" aria-label="Recorded"></span>'
        : '<span class="session-recorded-marker" aria-hidden="true"></span>';

      return `${dateMarker}
      <div class="session-row" data-start="${event.start.toISOString()}">
        <time class="session-time" datetime="${event.start.toISOString()}">${formatTime(event.start)}</time>
        ${recordedMarker}
        <div class="session-detail">
          ${sessionName}
          <span class="session-state" aria-hidden="true"></span>
          <span class="session-row-countdown" aria-hidden="true" hidden></span>
        </div>
      </div>
      `;
    }).join("");

    return `
      <section
        class="schedule-period schedule-period-${period.id}"
        aria-labelledby="day-${dayIndex + 1}-${period.id}-schedule-title"
      >
        <h3 id="day-${dayIndex + 1}-${period.id}-schedule-title" class="period-title">${period.label}</h3>
        <div class="session-list">${rows}</div>
      </section>
    `;
  };

  const leftPeriods = periods.filter((period) => period.id !== "evening");
  const rightPeriods = periods.filter((period) => period.id === "evening");
  const oneColumnClass = rightPeriods.length === 0 ? " schedule-columns-single" : "";
  const hasPendingRecordingLinks = dayEvents.some(
    (event) => event.isRecordedSession && !event.recordingUrl
  );
  const recordingLegend = `
    <p class="recording-legend">
      <span class="session-recorded-marker is-visible" aria-hidden="true"></span>
      <span aria-hidden="true">=</span>
      <span>Recorded</span>
    </p>
  `;

  return `
    <section
      class="schedule-day-panel"
      data-source-date="${retreatDay.date}"
      aria-label="Day ${dayIndex + 1} schedule"
    >
      <div class="schedule-columns${oneColumnClass}">
        <div class="schedule-column">
          ${leftPeriods.map(renderPeriod).join("")}
          ${rightPeriods.length === 0 && hasPendingRecordingLinks ? recordingLegend : ""}
        </div>
        ${rightPeriods.length > 0
          ? `<div class="schedule-column">
              ${rightPeriods.map(renderPeriod).join("")}
              ${hasPendingRecordingLinks ? recordingLegend : ""}
            </div>`
          : ""}
      </div>
    </section>
  `;
}

function renderSchedule(now = new Date()) {
  selectedRetreatDate ||= getDefaultRetreatDate(now);
  renderLocalizedDateRange();

  elements.scheduleList.innerHTML = `
    <div class="schedule-track">
      ${RETREAT_DATES.map(renderRetreatDayPanel).join("")}
    </div>
  `;

  updateScheduleSelection(now, false, true, false);
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

initializeScheduleScrolling();
renderStatus();
setInterval(renderStatus, 1000);
