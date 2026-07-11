const SOURCE_TIME_ZONE = "America/Los_Angeles";
const DISPLAY_TONE_STORAGE_KEY = "retreat-display-tone-v2";
const SECONDS_VISIBILITY_STORAGE_KEY = "retreat-seconds-visibility-v2";
const SCHEDULE_SELECTION_STORAGE_KEY = "retreat-schedule-selection-v1";
const RECORDING_PROGRESS_STORAGE_KEY = "retreat-recording-progress-v1";
const RECORDINGS_CACHE_STORAGE_KEY = "retreat-recordings-cache-v1";
const RECORDINGS_DOCUMENT_EXPORT_URL = "https://docs.google.com/document/d/1rkIvPc6x3rBdop8l-StP5VZ-79uowX2yZBSSRTDqC5E/export?format=txt";
const RECORDINGS_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const RECORDINGS_REFRESH_WINDOW_MS = 60 * 1000;
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
const RECORDING_DOCUMENT_SECTIONS = new Map([
  ["guided meditations", "Guided Meditation"],
  ["talks", "Talk"],
  ["q&a", "Q&A"],
  ["poetry", "Poetry"],
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
  scheduleViewport: document.querySelector("#schedule-viewport"),
  scheduleList: document.querySelector("#schedule-list"),
  schedulePrevious: document.querySelector("#schedule-previous"),
  scheduleNext: document.querySelector("#schedule-next"),
  recordingDialog: document.querySelector("#recording-dialog"),
  recordingDialogTitle: document.querySelector("#recording-dialog-title"),
  recordingDialogClose: document.querySelector("#recording-dialog-close"),
  recordingPlayerMount: document.querySelector("#recording-player-mount"),
  mapFormLink: document.querySelector(".map-form-link"),
  mapFormDialog: document.querySelector("#map-form-dialog"),
  mapFormDialogClose: document.querySelector("#map-form-dialog-close"),
  fullscreenToggle: document.querySelector("#fullscreen-toggle"),
  displayToneControl: document.querySelector(".display-tone-control"),
  displayToneIconToggle: document.querySelector("#display-tone-icon-toggle"),
};

const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
loadCachedRecordings();
const events = buildEvents();
let observedSourceDate = null;
let selectedRetreatDate = null;
let showCountdownSeconds = false;
let recordingsRefreshTimer = null;
let recordingsRefreshPromise = null;

function isLocalViewingMode(locationObject = window.location) {
  const hostname = locationObject.hostname.toLowerCase();
  return locationObject.protocol === "file:"
    || hostname === ""
    || hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "::1"
    || hostname === "[::1]";
}

function initializeFullscreenToggle() {
  const toggle = elements.fullscreenToggle;
  const root = document.documentElement;
  const isSupported = typeof root.requestFullscreen === "function"
    && typeof document.exitFullscreen === "function";

  if (!toggle || !isLocalViewingMode() || !isSupported) return;

  const syncFullscreenToggle = () => {
    const isFullscreen = document.fullscreenElement === root;
    toggle.querySelector(".fullscreen-toggle-text").textContent = isFullscreen
      ? "Exit full screen"
      : "Full screen";
    toggle.querySelector(".fullscreen-icon-enter").hidden = isFullscreen;
    toggle.querySelector(".fullscreen-icon-exit").hidden = !isFullscreen;
    const actionLabel = isFullscreen ? "Exit full screen" : "Enter full screen";
    toggle.dataset.tooltip = actionLabel;
    toggle.setAttribute("aria-label", actionLabel);
    toggle.setAttribute("aria-pressed", String(isFullscreen));
  };

  toggle.hidden = false;
  syncFullscreenToggle();

  toggle.addEventListener("click", async () => {
    toggle.disabled = true;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await root.requestFullscreen();
      }
    } catch (_) {
      toggle.hidden = true;
    } finally {
      toggle.disabled = false;
      syncFullscreenToggle();
    }
  });

  document.addEventListener("fullscreenchange", syncFullscreenToggle);
}

function storePreference(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (_) {
    // The controls still work when storage is unavailable.
  }
}

function mergeRecordingUrls(recordings) {
  if (!recordings || typeof recordings !== "object" || Array.isArray(recordings)) return false;

  let hasUpdates = false;

  Object.entries(recordings).forEach(([sourceDate, sessions]) => {
    const isRetreatDate = RETREAT_DATES.some((retreatDay) => retreatDay.date === sourceDate);
    if (!isRetreatDate || !sessions || typeof sessions !== "object" || Array.isArray(sessions)) return;

    Object.entries(sessions).forEach(([sessionName, recordingUrl]) => {
      if (!RECORDED_SESSION_NAMES.has(sessionName)
        || typeof recordingUrl !== "string"
        || !getYouTubeVideoId(recordingUrl)
        || RECORDINGS[sourceDate]?.[sessionName] === recordingUrl) return;

      RECORDINGS[sourceDate] ||= {};
      RECORDINGS[sourceDate][sessionName] = recordingUrl;
      hasUpdates = true;
    });
  });

  return hasUpdates;
}

function loadCachedRecordings() {
  try {
    mergeRecordingUrls(JSON.parse(localStorage.getItem(RECORDINGS_CACHE_STORAGE_KEY)));
  } catch (_) {
    // Coded recording links remain the fallback if cached data is unavailable.
  }
}

function getStoredScheduleSelection(sourceDate) {
  try {
    const storedSelection = JSON.parse(localStorage.getItem(SCHEDULE_SELECTION_STORAGE_KEY));
    const isRetreatDate = RETREAT_DATES.some(
      (retreatDay) => retreatDay.date === storedSelection?.retreatDate
    );

    if (storedSelection?.sourceDate === sourceDate && isRetreatDate) {
      return storedSelection.retreatDate;
    }
  } catch (_) {
    // The current retreat day remains the fallback when storage is unavailable.
  }

  return null;
}

function storeScheduleSelection(retreatDate, sourceDate = formatDateKeyInZone(
  new Date(),
  SOURCE_TIME_ZONE
)) {
  storePreference(SCHEDULE_SELECTION_STORAGE_KEY, JSON.stringify({
    retreatDate,
    sourceDate,
  }));
}

function setDisplayTone(tone, persist = false) {
  const resolvedTone = tone === "dim" ? "dim" : "bright";
  document.documentElement.dataset.displayTone = resolvedTone;
  document.body.dataset.displayTone = resolvedTone;

  document.querySelectorAll(".display-tone-control [data-display-tone]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.displayTone === resolvedTone));
  });

  if (elements.displayToneIconToggle) {
    const nextTone = resolvedTone === "bright" ? "dim" : "bright";
    const actionLabel = `Switch to ${nextTone === "dim" ? "Dim" : "Bright"}`;
    elements.displayToneIconToggle.dataset.toneAction = nextTone;
    elements.displayToneIconToggle.dataset.tooltip = actionLabel;
    elements.displayToneIconToggle.setAttribute("aria-label", actionLabel);
    elements.displayToneIconToggle.setAttribute("aria-pressed", String(resolvedTone === "dim"));
  }

  if (persist) {
    storePreference(DISPLAY_TONE_STORAGE_KEY, resolvedTone);
  }
}

setDisplayTone(document.documentElement.dataset.displayTone);
document.querySelectorAll(".display-tone-control [data-display-tone]").forEach((button) => {
  button.addEventListener("click", () => setDisplayTone(button.dataset.displayTone, true));
});

function initializeLocalToneControl() {
  if (!isLocalViewingMode()
    || !elements.displayToneControl
    || !elements.displayToneIconToggle) return;

  elements.displayToneControl.hidden = true;
  elements.displayToneIconToggle.hidden = false;
  elements.displayToneIconToggle.addEventListener("click", () => {
    const nextTone = document.body.dataset.displayTone === "dim" ? "bright" : "dim";
    setDisplayTone(nextTone, true);
  });
}

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

function parseRecordingDocument(documentText) {
  const parsedRecordings = {};
  let sessionName = null;

  documentText.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    const sectionName = RECORDING_DOCUMENT_SECTIONS.get(line.toLowerCase());

    if (sectionName) {
      sessionName = sectionName;
      return;
    }

    if (!sessionName) return;

    const dayRecording = line.match(
      /^Day\s+(\d+)\b.*?(https?:\/\/(?:www\.)?(?:youtu\.be|youtube\.com)\/\S+)/i
    );
    if (!dayRecording) return;

    const dayIndex = Number(dayRecording[1]) - 1;
    const retreatDay = RETREAT_DATES[dayIndex];
    const recordingUrl = dayRecording[2].replace(/[),.;\]]+$/, "");
    if (!retreatDay || !getYouTubeVideoId(recordingUrl)) return;

    parsedRecordings[retreatDay.date] ||= {};
    parsedRecordings[retreatDay.date][sessionName] = recordingUrl;
  });

  return parsedRecordings;
}

function applyRecordingDocument(recordings) {
  const hasUpdates = mergeRecordingUrls(recordings);
  if (!hasUpdates) return;

  storePreference(RECORDINGS_CACHE_STORAGE_KEY, JSON.stringify(RECORDINGS));
  events.forEach((event) => {
    event.recordingUrl = RECORDINGS[event.sourceDate]?.[event.name] || null;
  });
  renderSchedule(new Date());
}

async function refreshRecordingsFromDocument() {
  if (recordingsRefreshPromise) return recordingsRefreshPromise;

  recordingsRefreshPromise = (async () => {
    const response = await fetch(RECORDINGS_DOCUMENT_EXPORT_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Recording document request failed: ${response.status}`);

    applyRecordingDocument(parseRecordingDocument(await response.text()));
  })();

  try {
    await recordingsRefreshPromise;
  } catch (_) {
    // Coded recording links remain available until the next scheduled check.
  } finally {
    recordingsRefreshPromise = null;
  }
}

function getNextRecordingsRefreshBoundary(now) {
  const currentBoundary = Math.floor(now / RECORDINGS_REFRESH_INTERVAL_MS)
    * RECORDINGS_REFRESH_INTERVAL_MS;

  return now < currentBoundary + RECORDINGS_REFRESH_WINDOW_MS
    ? currentBoundary
    : currentBoundary + RECORDINGS_REFRESH_INTERVAL_MS;
}

function scheduleNextRecordingsRefresh(skipCurrentWindow = false) {
  clearTimeout(recordingsRefreshTimer);
  recordingsRefreshTimer = null;
  if (document.visibilityState === "hidden") return;

  const now = Date.now();
  const currentBoundary = Math.floor(now / RECORDINGS_REFRESH_INTERVAL_MS)
    * RECORDINGS_REFRESH_INTERVAL_MS;
  const isInsideCurrentWindow = now < currentBoundary + RECORDINGS_REFRESH_WINDOW_MS;
  const boundary = skipCurrentWindow && isInsideCurrentWindow
    ? currentBoundary + RECORDINGS_REFRESH_INTERVAL_MS
    : getNextRecordingsRefreshBoundary(now);
  const windowEnd = boundary + RECORDINGS_REFRESH_WINDOW_MS;
  const availableWindowStart = Math.max(now, boundary);
  const refreshAt = availableWindowStart
    + Math.random() * Math.max(0, windowEnd - availableWindowStart);

  recordingsRefreshTimer = setTimeout(async () => {
    const firedAt = Date.now();
    if (document.visibilityState === "visible"
      && firedAt >= boundary
      && firedAt < windowEnd) {
      await refreshRecordingsFromDocument();
    }

    scheduleNextRecordingsRefresh(true);
  }, Math.max(0, refreshAt - now));
}

async function initializeRecordingsRefresh() {
  document.addEventListener("visibilitychange", () => scheduleNextRecordingsRefresh());
  await refreshRecordingsFromDocument();
  scheduleNextRecordingsRefresh(true);
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
      tab.addEventListener("click", (event) => {
        selectTab(tab, false);
        if (event.detail > 0) tab.blur();
      });
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
  elements.scheduleViewport.scrollTo({
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

  elements.schedulePrevious.disabled = selectedDayIndex === 0;
  elements.scheduleNext.disabled = selectedDayIndex === RETREAT_DATES.length - 1;

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
  storeScheduleSelection(selectedRetreatDate);
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

function getYouTubeVideoId(url) {
  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.hostname === "youtu.be") {
      return parsedUrl.pathname.split("/").filter(Boolean)[0] || null;
    }

    if (parsedUrl.hostname === "youtube.com" || parsedUrl.hostname.endsWith(".youtube.com")) {
      if (parsedUrl.pathname === "/watch") return parsedUrl.searchParams.get("v");

      const [format, videoId] = parsedUrl.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(format)) return videoId || null;
    }
  } catch (_) {
    // The original recording link remains available when a URL cannot be embedded.
  }

  return null;
}

let youtubeIframeApiPromise = null;

function loadYouTubeIframeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeIframeApiPromise) return youtubeIframeApiPromise;

  youtubeIframeApiPromise = new Promise((resolve, reject) => {
    const previousReadyHandler = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReadyHandler?.();
      resolve(window.YT);
    };

    let script = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!script) {
      script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.append(script);
    }

    script.addEventListener("error", () => {
      youtubeIframeApiPromise = null;
      reject(new Error("YouTube IFrame API failed to load"));
    }, { once: true });
  });

  return youtubeIframeApiPromise;
}

function getRecordingProgress() {
  try {
    const progress = JSON.parse(localStorage.getItem(RECORDING_PROGRESS_STORAGE_KEY));
    return progress && typeof progress === "object" ? progress : {};
  } catch (_) {
    return {};
  }
}

function getRecordingResumeTime(videoId) {
  const progress = getRecordingProgress();
  const entry = progress[videoId];
  const seconds = Number(entry?.seconds);
  const duration = Number(entry?.duration);
  const shouldStartCompletedReplay = entry?.completed === true
    && (entry.restartOnNextOpen === true
      || (entry.restartOnNextOpen === undefined
        && Number.isFinite(duration)
        && duration > 0
        && seconds >= duration - 1));

  if (shouldStartCompletedReplay) {
    progress[videoId] = {
      ...entry,
      seconds: 0,
      restartOnNextOpen: false,
      updatedAt: Date.now(),
    };
    storePreference(RECORDING_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
    updateRecordingProgressDisplays(videoId);
    return 0;
  }

  return Number.isFinite(seconds) && seconds >= 5 ? seconds : 0;
}

function formatPlaybackTime(seconds) {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainingSeconds = wholeSeconds % 60;

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
    : `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function updateRecordingProgressDisplays(videoId = null) {
  const progress = getRecordingProgress();

  document.querySelectorAll(".session-row[data-recording-video-id]").forEach((row) => {
    const rowVideoId = row.dataset.recordingVideoId;
    if (videoId && rowVideoId !== videoId) return;

    const entry = progress[rowVideoId];
    const seconds = Number(entry?.seconds);
    const duration = Number(entry?.duration);
    const isComplete = entry?.completed === true;
    const hasProgress = Number.isFinite(seconds) && seconds >= 5;
    const percentage = hasProgress && Number.isFinite(duration) && duration > 0
      ? Math.min(100, Math.max(0, (seconds / duration) * 100))
      : 0;
    const resumeLabel = row.querySelector(".session-recording-resume");

    row.classList.toggle("has-recording-progress", percentage > 0);
    row.classList.toggle("is-recording-complete", isComplete);
    if (percentage > 0) {
      row.style.setProperty("--recording-progress", `${percentage}%`);
    } else {
      row.style.removeProperty("--recording-progress");
    }

    if (resumeLabel) {
      resumeLabel.hidden = !hasProgress && !isComplete;
      resumeLabel.classList.toggle("is-complete", isComplete);
      resumeLabel.textContent = isComplete
        ? "✓"
        : hasProgress
          ? `Resume from ${formatPlaybackTime(seconds)}`
          : "";
      if (isComplete) {
        resumeLabel.setAttribute("aria-label", "Complete");
      } else {
        resumeLabel.removeAttribute("aria-label");
      }
    }
  });
}

function clearRecordingProgress(videoId) {
  const progress = getRecordingProgress();
  delete progress[videoId];
  storePreference(RECORDING_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  updateRecordingProgressDisplays(videoId);
}

function storeRecordingProgress(videoId, seconds, duration) {
  if (!videoId || !Number.isFinite(seconds) || seconds < 5) return;

  const progress = getRecordingProgress();
  const isComplete = progress[videoId]?.completed === true;

  const completionWindow = Number.isFinite(duration) && duration > 0
    ? Math.min(30, duration * 0.05)
    : 0;

  if (!isComplete && completionWindow && duration - seconds <= completionWindow) {
    clearRecordingProgress(videoId);
    return;
  }

  progress[videoId] = {
    seconds: Math.floor(seconds),
    duration: Number.isFinite(duration) ? Math.floor(duration) : 0,
    completed: isComplete,
    restartOnNextOpen: false,
    updatedAt: Date.now(),
  };
  storePreference(RECORDING_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  updateRecordingProgressDisplays(videoId);
}

function storeRecordingCompletion(videoId, duration) {
  if (!videoId) return;

  const progress = getRecordingProgress();
  const completedDuration = Number.isFinite(duration) && duration > 0
    ? Math.floor(duration)
    : Number(progress[videoId]?.duration) || 0;

  progress[videoId] = {
    seconds: completedDuration,
    duration: completedDuration,
    completed: true,
    restartOnNextOpen: true,
    updatedAt: Date.now(),
  };
  storePreference(RECORDING_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  updateRecordingProgressDisplays(videoId);
}

function createRecordingPlayerFrame(videoId, title, resumeTime) {
  const frame = document.createElement("iframe");
  const parameters = new URLSearchParams({
    autoplay: "1",
    enablejsapi: "1",
    playsinline: "1",
    rel: "0",
  });

  if (resumeTime >= 5) parameters.set("start", String(Math.floor(resumeTime)));
  if (window.location.origin && window.location.origin !== "null") {
    parameters.set("origin", window.location.origin);
  }

  frame.id = "recording-player-frame";
  frame.title = `${title} recording`;
  frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${parameters}`;
  frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen";
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  frame.allowFullscreen = true;
  elements.recordingPlayerMount.replaceChildren(frame);
  return frame;
}

function initializeRecordingDialog() {
  let trigger = null;
  let restoreTriggerFocus = false;
  let playerFocusGuard = null;
  let closeTimer = null;
  let progressTimer = null;
  let player = null;
  let playerFrame = null;
  let activeVideoId = null;
  let playerSession = 0;

  const stopProgressTimer = () => {
    clearInterval(progressTimer);
    progressTimer = null;
  };

  const saveProgress = () => {
    if (!player || !activeVideoId) return;

    try {
      storeRecordingProgress(
        activeVideoId,
        player.getCurrentTime(),
        player.getDuration()
      );
    } catch (_) {
      // A plain embed still works if the player API is not ready.
    }
  };

  const startProgressTimer = () => {
    stopProgressTimer();
    progressTimer = setInterval(saveProgress, 5000);
  };

  const closeDialog = () => {
    if (!elements.recordingDialog.open
      || elements.recordingDialog.classList.contains("is-closing")) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      elements.recordingDialog.close();
      return;
    }

    elements.recordingDialog.classList.add("is-closing");
    closeTimer = setTimeout(() => elements.recordingDialog.close(), 260);
  };

  elements.scheduleList.addEventListener("click", (event) => {
    const row = event.target.closest(".session-row[data-recording-video-id]");
    const link = row?.querySelector(".session-recording-link");
    if (!link || typeof elements.recordingDialog.showModal !== "function") return;

    const videoId = getYouTubeVideoId(link.href);
    if (!videoId) return;

    event.preventDefault();
    trigger = event.target.closest(".session-recording-link, .session-recording-resume") || link;
    restoreTriggerFocus = event.detail === 0;
    activeVideoId = videoId;
    const currentPlayerSession = ++playerSession;

    const sessionName = link.textContent.trim();
    const sourceDate = link.closest(".schedule-day-panel")?.dataset.sourceDate;
    const dayIndex = RETREAT_DATES.findIndex((retreatDay) => retreatDay.date === sourceDate);
    const recordingTitle = dayIndex >= 0
      ? `Day ${dayIndex + 1}: ${sessionName}`
      : sessionName;

    elements.recordingDialogTitle.textContent = recordingTitle;
    const resumeTime = getRecordingResumeTime(videoId);
    playerFrame = createRecordingPlayerFrame(videoId, recordingTitle, resumeTime);
    document.body.classList.add("has-open-recording");
    elements.recordingDialog.showModal();
    elements.recordingDialog.focus({ preventScroll: true });
    clearInterval(playerFocusGuard);
    playerFocusGuard = setInterval(() => {
      if (document.fullscreenElement) return;
      if (document.activeElement === playerFrame) {
        elements.recordingDialog.focus({ preventScroll: true });
      }
    }, 30);

    loadYouTubeIframeApi().then(() => {
      if (currentPlayerSession !== playerSession
        || !elements.recordingDialog.open
        || !playerFrame?.isConnected) return;

      player = new window.YT.Player(playerFrame, {
        events: {
          onReady: (playerEvent) => {
            if (resumeTime >= 5) playerEvent.target.seekTo(resumeTime, true);
          },
          onStateChange: (playerEvent) => {
            if (playerEvent.data === window.YT.PlayerState.PLAYING) {
              startProgressTimer();
              return;
            }

            stopProgressTimer();
            if (playerEvent.data === window.YT.PlayerState.ENDED) {
              storeRecordingCompletion(activeVideoId, playerEvent.target.getDuration());
            } else {
              saveProgress();
            }
          },
        },
      });
    }).catch(() => {
      // Playback remains available without progress tracking if the API fails.
    });
  });

  window.addEventListener("keydown", (event) => {
    if (!elements.recordingDialog.open) return;

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      event.stopImmediatePropagation();

      try {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          const direction = event.key === "ArrowRight" ? 1 : -1;
          const duration = player?.getDuration() || 0;
          const requestedTime = (player?.getCurrentTime() || 0) + direction * 5;
          const targetTime = Math.max(0, duration > 0
            ? Math.min(duration, requestedTime)
            : requestedTime);
          player?.seekTo(targetTime, true);
        } else {
          const direction = event.key === "ArrowUp" ? 1 : -1;
          const targetVolume = Math.min(100, Math.max(0, (player?.getVolume() || 0) + direction * 5));
          player?.setVolume(targetVolume);
          if (direction > 0) player?.unMute();
        }
      } catch (_) {
        // The page remains still if the YouTube player is not ready yet.
      }

      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeDialog();
    }
  }, { capture: true });
  elements.recordingDialogClose.form.addEventListener("submit", (event) => {
    event.preventDefault();
    closeDialog();
  });
  elements.recordingDialog.addEventListener("click", (event) => {
    if (event.target === elements.recordingDialog) closeDialog();
  });
  elements.recordingDialog.addEventListener("close", () => {
    saveProgress();
    stopProgressTimer();
    playerSession += 1;
    clearTimeout(closeTimer);
    closeTimer = null;
    elements.recordingDialog.classList.remove("is-closing");
    clearInterval(playerFocusGuard);
    playerFocusGuard = null;
    player?.destroy();
    player = null;
    playerFrame = null;
    activeVideoId = null;
    elements.recordingPlayerMount.replaceChildren();
    document.body.classList.remove("has-open-recording");
    if (restoreTriggerFocus) {
      trigger?.focus();
    } else {
      trigger?.blur();
    }
    trigger = null;
    restoreTriggerFocus = false;
  });

  window.addEventListener("pagehide", saveProgress);
}

function initializeMapFormDialog() {
  let restoreTriggerFocus = false;
  let closeTimer = null;

  const closeDialog = () => {
    if (!elements.mapFormDialog.open
      || elements.mapFormDialog.classList.contains("is-closing")) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      elements.mapFormDialog.close();
      return;
    }

    elements.mapFormDialog.classList.add("is-closing");
    closeTimer = setTimeout(() => elements.mapFormDialog.close(), 260);
  };

  elements.mapFormLink.addEventListener("click", (event) => {
    if (typeof elements.mapFormDialog.showModal !== "function") return;

    event.preventDefault();
    restoreTriggerFocus = event.detail === 0;
    document.body.classList.add("has-open-map-form");
    elements.mapFormDialog.showModal();
    elements.mapFormDialog.focus({ preventScroll: true });
  });

  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !elements.mapFormDialog.open) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeDialog();
  }, { capture: true });

  elements.mapFormDialogClose.form.addEventListener("submit", (event) => {
    event.preventDefault();
    closeDialog();
  });
  elements.mapFormDialog.addEventListener("click", (event) => {
    if (event.target === elements.mapFormDialog) closeDialog();
  });
  elements.mapFormDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDialog();
  });
  elements.mapFormDialog.addEventListener("close", () => {
    clearTimeout(closeTimer);
    closeTimer = null;
    elements.mapFormDialog.classList.remove("is-closing");
    document.body.classList.remove("has-open-map-form");
    if (restoreTriggerFocus) {
      elements.mapFormLink.focus();
    } else {
      elements.mapFormLink.blur();
    }
    restoreTriggerFocus = false;
  });
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
      Math.max(0, Math.round(elements.scheduleViewport.scrollLeft / panelWidth))
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

  elements.scheduleViewport.addEventListener("scroll", () => {
    const panelWidth = getScheduleTrack()?.getBoundingClientRect().width || 0;
    if (panelWidth) {
      positionScheduleTabIndicator(elements.scheduleViewport.scrollLeft / panelWidth);
    }

    clearTimeout(scrollEndTimer);
    scrollEndTimer = setTimeout(syncSelectionToScroll, 100);
  }, { passive: true });

  elements.scheduleViewport.addEventListener("scrollend", syncSelectionToScroll);

  const stepSchedule = (direction) => {
    const currentDayIndex = getSelectedRetreatDayIndex();
    const nextDayIndex = Math.min(
      RETREAT_DATES.length - 1,
      Math.max(0, currentDayIndex + direction)
    );

    if (nextDayIndex === currentDayIndex) return;
    selectRetreatDay(RETREAT_DATES[nextDayIndex].date, { animate: true });
  };

  elements.schedulePrevious.addEventListener("click", (event) => {
    stepSchedule(-1);
    if (event.detail > 0) event.currentTarget.blur();
  });
  elements.scheduleNext.addEventListener("click", (event) => {
    stepSchedule(1);
    if (event.detail > 0) event.currentTarget.blur();
  });

  elements.scheduleList.addEventListener("dragstart", (event) => {
    if (event.target.closest("a")) event.preventDefault();
  });

  const resizeObserver = new ResizeObserver(() => {
    const panelWidth = getScheduleTrack()?.getBoundingClientRect().width || 0;
    if (!panelWidth || Math.abs(panelWidth - lastPanelWidth) < 0.5) return;

    lastPanelWidth = panelWidth;
    setScheduleTrackPosition(getSelectedRetreatDayIndex(), { animate: false });
  });
  resizeObserver.observe(elements.scheduleViewport);

  let verticalPageTarget = null;
  let verticalPageResetTimer = null;

  const clearVerticalPageTarget = () => {
    verticalPageTarget = null;
    clearTimeout(verticalPageResetTimer);
  };

  window.addEventListener("scrollend", clearVerticalPageTarget);

  window.addEventListener("keydown", (event) => {
    if (elements.recordingDialog.open || elements.mapFormDialog.open) return;
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;

    const eventTarget = event.target instanceof Element ? event.target : null;
    if (eventTarget?.closest("input, select, textarea, [contenteditable]")) return;

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();

      const pageIds = ["timer", "schedule", "community-map"];
      const viewportCenter = window.innerHeight / 2;
      const currentPageIndex = pageIds.reduce((closestIndex, pageId, index) => {
        const bounds = document.querySelector(`#${pageId}`)?.getBoundingClientRect();
        if (!bounds) return closestIndex;

        const pageCenterDistance = Math.abs(bounds.top + bounds.height / 2 - viewportCenter);
        const closestBounds = document.querySelector(`#${pageIds[closestIndex]}`)
          ?.getBoundingClientRect();
        const closestDistance = closestBounds
          ? Math.abs(closestBounds.top + closestBounds.height / 2 - viewportCenter)
          : Number.POSITIVE_INFINITY;

        return pageCenterDistance < closestDistance ? index : closestIndex;
      }, 0);
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const targetPageIndex = Math.min(
        pageIds.length - 1,
        Math.max(0, currentPageIndex + direction)
      );
      const targetId = pageIds[targetPageIndex];
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

    const requestedDayIndex = /^\d$/.test(event.key) ? Number(event.key) - 1 : -1;
    const isDayShortcut = requestedDayIndex >= 0
      && requestedDayIndex < RETREAT_DATES.length;
    const isHorizontalArrow = event.key === "ArrowLeft" || event.key === "ArrowRight";
    if (!isDayShortcut && !isHorizontalArrow) return;

    const focusedTab = eventTarget?.closest('[role="tab"]');

    const scheduleBounds = document.querySelector("#schedule").getBoundingClientRect();
    const visibleScheduleHeight = Math.max(
      0,
      Math.min(window.innerHeight, scheduleBounds.bottom) - Math.max(0, scheduleBounds.top)
    );

    if (visibleScheduleHeight < window.innerHeight * 0.5) return;

    if (isDayShortcut) {
      event.preventDefault();
      selectRetreatDay(RETREAT_DATES[requestedDayIndex].date, { animate: true });
      return;
    }

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
      focusTab: Boolean(focusedTab),
    });
  }, { capture: true });
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
    const isInitialRender = observedSourceDate === null;
    observedSourceDate = sourceDate;
    selectedRetreatDate = isInitialRender
      ? getStoredScheduleSelection(sourceDate) || getDefaultRetreatDate(now)
      : getDefaultRetreatDate(now);
    storeScheduleSelection(selectedRetreatDate, sourceDate);
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
    const rows = period.events.map((event) => {
      const recordingVideoId = event.recordingUrl
        ? getYouTubeVideoId(event.recordingUrl)
        : null;
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
      const recordingResume = recordingVideoId
        ? `<a
            class="session-recording-resume"
            href="${event.recordingUrl}"
            target="_blank"
            rel="noopener noreferrer"
            hidden
          ></a>`
        : "";
      const recordingData = recordingVideoId
        ? ` data-recording-video-id="${recordingVideoId}"`
        : "";

      return `<div class="session-row" data-start="${event.start.toISOString()}"${recordingData}>
        <time class="session-time" datetime="${event.start.toISOString()}">${formatTime(event.start)}</time>
        ${recordedMarker}
        <div class="session-detail">
          ${sessionName}
          <span class="session-state" aria-hidden="true"></span>
          <span class="session-row-countdown" aria-hidden="true" hidden></span>
          ${recordingResume}
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

  updateRecordingProgressDisplays();
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
initializeRecordingDialog();
initializeMapFormDialog();
initializeFullscreenToggle();
initializeLocalToneControl();
renderStatus();
initializeRecordingsRefresh();
setInterval(renderStatus, 1000);
