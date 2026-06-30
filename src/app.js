const events = window.AX_EVENTS || [];
const state = {
  day: "",
  query: "",
  tags: new Set(),
};

const tagLabels = [
  ["live", "Live表演"],
  ["jp_va", "声优"],
  ["premiere", "首映/先行"],
  ["game", "游戏"],
  ["weak", "弱关联"],
];

const colorPriority = ["live", "jp_va", "premiere", "game", "weak"];

const venueOrder = [
  "Crypto.com Arena",
  "Peacock Theater",
  "The Novo",
  "Petree Hall",
  "JW Diamond",
  "JW Platinum",
  "404AB",
  "403AB",
  "408AB",
  "409AB",
  "411",
  "406AB",
  "402A",
  "511ABC",
  "515 AB",
  "Concourse Hall E",
  "AX Crossing",
  "AX Dance",
  "Lounge 21",
  "Beer Garden at Peacock Place",
  "Little Tokyo",
];

const venueRank = new Map(venueOrder.map((room, index) => [room, index]));

const dayTabs = document.querySelector("#dayTabs");
const tagFilters = document.querySelector("#tagFilters");
const searchInput = document.querySelector("#searchInput");
const summary = document.querySelector("#summary");
const timeline = document.querySelector("#timeline");
const dialog = document.querySelector("#eventDialog");
const dialogBody = document.querySelector("#dialogBody");
const closeDialog = document.querySelector("#closeDialog");

const days = [...new Set(events.map((event) => event.date))];
state.day = days[0] || "";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function eventMatches(event) {
  const query = state.query.trim().toLowerCase();
  const text = `${event.title} ${event.room} ${event.description} ${event.clearing}`.toLowerCase();
  const hasQuery = !query || text.includes(query);
  const hasTags = !state.tags.size || [...state.tags].every((tag) => event.tags.some((item) => item.id === tag));
  return event.date === state.day && hasQuery && hasTags;
}

function minuteLabel(minutes) {
  const dayOffset = Math.floor(minutes / (24 * 60));
  const minuteOfDay = minutes % (24 * 60);
  const hour24 = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  const suffix = dayOffset > 0 ? ` +${dayOffset}d` : "";
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}${suffix}`;
}

function eventTimeLabel(time, dayOffset) {
  return `${time}${dayOffset > 0 ? ` +${dayOffset}d` : ""}`;
}

function highlightWorkTitles(title, workTitles = []) {
  const matches = [];
  const lower = title.toLowerCase();
  for (const workTitle of workTitles) {
    const start = lower.indexOf(workTitle.toLowerCase());
    if (start === -1) continue;
    const end = start + workTitle.length;
    if (matches.some((match) => start < match.end && end > match.start)) continue;
    matches.push({ start, end });
  }

  if (!matches.length) return escapeHtml(title);

  matches.sort((a, b) => a.start - b.start);
  let cursor = 0;
  let html = "";
  for (const match of matches) {
    html += escapeHtml(title.slice(cursor, match.start));
    html += `<span class="work">${escapeHtml(title.slice(match.start, match.end))}</span>`;
    cursor = match.end;
  }
  html += escapeHtml(title.slice(cursor));
  return html;
}

function renderControls() {
  dayTabs.innerHTML = days.map((day) => (
    `<button class="${day === state.day ? "active" : ""}" data-day="${escapeHtml(day)}">${escapeHtml(day.replace(", 2026", ""))}</button>`
  )).join("");

  tagFilters.innerHTML = tagLabels.map(([id, label]) => (
    `<button class="${state.tags.has(id) ? "active" : ""}" data-tag="${id}">${label}</button>`
  )).join("");
}

function renderSummary(dayEvents, filteredEvents, rooms) {
  const clearingCount = filteredEvents.filter((event) => event.clearing).length;
  summary.innerHTML = [
    `${state.day}`,
    `${filteredEvents.length} / ${dayEvents.length} 个活动`,
    `${rooms.length} 个地点`,
    `${clearingCount} 个活动含清场说明`,
    `数据来源：AX 官网缓存`,
  ].map((item) => `<span>${escapeHtml(item)}</span>`).join("");
}

function eventBadges(event) {
  const badges = [];
  if (event.clearing) {
    badges.push(`<span class="badge clearing">${escapeHtml(event.clearing)}</span>`);
  }
  for (const tag of event.tags) badges.push(`<span class="badge">${escapeHtml(tag.label)}</span>`);
  return badges.join("");
}

function eventColorClass(event) {
  const tagIds = new Set(event.tags.map((tag) => tag.id));
  const primary = colorPriority.find((id) => tagIds.has(id));
  return primary ? `tone-${primary}` : "tone-default";
}

function compareRooms(a, b) {
  const rankA = venueRank.has(a) ? venueRank.get(a) : Number.MAX_SAFE_INTEGER;
  const rankB = venueRank.has(b) ? venueRank.get(b) : Number.MAX_SAFE_INTEGER;
  return rankA - rankB || a.localeCompare(b);
}

function renderTimeline() {
  renderControls();
  const dayEvents = events.filter((event) => event.date === state.day);
  const filteredEvents = events.filter(eventMatches);
  const rooms = [...new Set(dayEvents.map((event) => event.room))].sort(compareRooms);
  const visibleRooms = rooms.filter((room) => filteredEvents.some((event) => event.room === room));
  const columns = visibleRooms.length ? visibleRooms : rooms;
  const startMinute = Math.min(...dayEvents.map((event) => event.startMinutes).filter(Number.isFinite));
  const endMinute = Math.max(...dayEvents.map((event) => event.endMinutes).filter(Number.isFinite));
  const timelineStart = Math.floor(startMinute / 60) * 60;
  const timelineEnd = Math.ceil(endMinute / 60) * 60;
  const hourHeight = 112;
  const totalHeight = ((timelineEnd - timelineStart) / 60) * hourHeight;

  timeline.style.setProperty("--room-count", columns.length);
  timeline.style.setProperty("--timeline-height", `${totalHeight}px`);

  const headers = [
    `<div class="corner">时间</div>`,
    ...columns.map((room) => `<div class="room-header">${escapeHtml(room)}</div>`),
  ];

  const labels = [];
  for (let minute = timelineStart; minute <= timelineEnd; minute += 60) {
    const top = ((minute - timelineStart) / 60) * hourHeight;
    labels.push(`<div class="time-label" style="top:${top}px">${minuteLabel(minute)}</div>`);
  }

  const lanes = columns.map((room, index) => {
    const cards = filteredEvents
      .filter((event) => event.room === room)
      .map((event) => {
        const top = ((event.startMinutes - timelineStart) / 60) * hourHeight;
        const height = Math.max(42, (event.durationMinutes / 60) * hourHeight - 3);
        const classTags = eventColorClass(event);
        const timeText = `${eventTimeLabel(event.start, event.startDayOffset)} - ${eventTimeLabel(event.end, event.endDayOffset)}`;
        return `
          <button class="event-card ${classTags}" data-id="${event.id}" style="top:${top}px;height:${height}px">
            <div class="event-time">${escapeHtml(timeText)}</div>
            <div class="event-title">${highlightWorkTitles(event.title, event.workTitles || (event.workTitle ? [event.workTitle] : []))}</div>
            <div class="badges">${eventBadges(event)}</div>
          </button>`;
      }).join("");
    return `<div class="lane" style="grid-column:${index + 2}">${cards}</div>`;
  });

  timeline.innerHTML = [...headers, `<div class="time-axis">${labels.join("")}</div>`, ...lanes].join("");
  renderSummary(dayEvents, filteredEvents, columns);
}

function showEvent(id) {
  const event = events.find((item) => item.id === id);
  if (!event) return;
  dialogBody.innerHTML = `
    <h2 class="dialog-title">${highlightWorkTitles(event.title, event.workTitles || (event.workTitle ? [event.workTitle] : []))}</h2>
    <div class="dialog-meta">
      <span class="badge">${escapeHtml(event.date)}</span>
      <span class="badge">${escapeHtml(eventTimeLabel(event.start, event.startDayOffset))} - ${escapeHtml(eventTimeLabel(event.end, event.endDayOffset))}</span>
      <span class="badge">${escapeHtml(event.room)}</span>
      ${eventBadges(event)}
    </div>
    <p class="dialog-description">${escapeHtml(event.description)}</p>
  `;
  dialog.showModal();
}

dayTabs.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-day]");
  if (!button) return;
  state.day = button.dataset.day;
  renderTimeline();
});

tagFilters.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-tag]");
  if (!button) return;
  const tag = button.dataset.tag;
  if (state.tags.has(tag)) state.tags.delete(tag);
  else state.tags.add(tag);
  renderTimeline();
});

searchInput.addEventListener("input", () => {
  state.query = searchInput.value;
  renderTimeline();
});

timeline.addEventListener("click", (event) => {
  const button = event.target.closest(".event-card");
  if (!button) return;
  showEvent(button.dataset.id);
});

closeDialog.addEventListener("click", () => dialog.close());
renderTimeline();
