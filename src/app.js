const events = window.AX_EVENTS || [];
const state = {
  day: "",
  query: "",
  tags: new Set(),
  marked: new Set(loadMarkedIds()),
  markOnly: false,
  dialogEventId: "",
  room: "",
};

const tagLabels = [
  ["live", "Live表演"],
  ["jp_va", "声优"],
  ["premiere", "首映/先行"],
  ["game", "游戏"],
  ["weak", "弱关联"],
];

const colorPriority = ["live", "jp_va", "premiere", "game", "weak"];
const allRoomsValue = "__all__";
const japaneseGuestNames = new Map([
  ["Acky Bright", "アッキー・ブライト"],
  ["Aoi Ichikawa", "市川蒼"],
  ["Anna Nagase", "永瀬アンナ"],
  ["Ayako Kawasumi", "川澄綾子"],
  ["Daiki Yamashita", "山下大輝"],
  ["Daisuke Hirose", "広瀬大介"],
  ["Gakuto Kajiwara", "梶原岳人"],
  ["Kamome Shirahama", "白浜鴎"],
  ["Kana Ueda", "植田佳奈"],
  ["Kensho Ono", "小野賢章"],
  ["Kikunosuke Toya", "戸谷菊之介"],
  ["Koki Uchiyama", "内山昂輝"],
  ["Machico", "マチコ"],
  ["Makoto Furukawa", "古川慎"],
  ["Masakazu Morita", "森田成一"],
  ["Masaya Fukunishi", "福西勝也"],
  ["Megumi Toyoguchi", "豊口めぐみ"],
  ["Miho Okasaki", "岡咲美保"],
  ["Naoko Yamada", "山田尚子"],
  ["Natsuki Hanae", "花江夏樹"],
  ["Norihiro Naganuma", "長沼範裕"],
  ["Rena Motomura", "本村玲奈"],
  ["Rie Takahashi", "高橋李依"],
  ["Saori Hayami", "早見沙織"],
  ["Sayumi Suzushiro", "鈴代紗弓"],
  ["Setsu Ito", "伊藤節生"],
  ["Tadatoshi Fujimaki", "藤巻忠俊"],
  ["Takahiro Sakurai", "櫻井孝宏"],
  ["Takushi Koide", "小出卓史"],
  ["Yoshino Aoyama", "青山吉能"],
  ["Yuki Shin", "新祐樹"],
  ["Yume Miyamoto", "宮本侑芽"],
  ["Yuriyan Retriever", "ゆりやんレトリィバァ"],
  ["Yuu Hayashi", "林勇"],
  ["Yuzuru Tachikawa", "立川譲"],
  ["Atsushi Nigorikawa", "濁川敦"],
  ["Fumihiko Suganuma", "菅沼芙実彦"],
  ["Aoi Yuki", "悠木碧"],
  ["Takeo Otsuka", "大塚剛央"],
  ["Aya Yamane", "山根綺"],
  ["Tatsuki Fujimoto", "藤本タツキ"],
  ["Yugo Kanno", "菅野祐悟"],
  ["Moriyasu Taniguchi", "谷口守泰"],
  ["Ryosuke Takahashi", "高橋良輔"],
  ["Toru Yoshida", "吉田徹"],
  ["Keiichiro Saito", "斎藤圭一郎"],
  ["Yuichiro Fukushi", "福士裕一郎"],
  ["Tatsuya Ishihara", "石原立也"],
  ["Mitsuhisa Ishikawa", "石川光久"],
  ["George Wada", "和田丈嗣"],
  ["Kenji Kamiyama", "神山健治"],
  ["Tetsuro Araki", "荒木哲郎"],
  ["Shunsuke Tada", "多田俊介"],
  ["Hiromu Arakawa", "荒川弘"],
  ["Gege Akutami", "芥見下々"],
  ["Nobuo Uematsu", "植松伸夫"],
  ["Yoko Kanno", "菅野よう子"],
  ["Yoko Takahashi", "高橋洋子"],
  ["Mamoru Hosoda", "細田守"],
  ["Masaaki Yuasa", "湯浅政明"],
  ["Takanori Aki", "安藝貴範"],
]);

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
const roomSwitcher = document.querySelector("#roomSwitcher");
const summary = document.querySelector("#summary");
const timeline = document.querySelector("#timeline");
const dialog = document.querySelector("#eventDialog");
const dialogBody = document.querySelector("#dialogBody");
const closeDialog = document.querySelector("#closeDialog");
const markedStorageKey = "ax2026-marked-events";

const days = [...new Set(events.map((event) => event.date))];
state.day = days[0] || "";

function loadMarkedIds() {
  try {
    const saved = window.localStorage.getItem("ax2026-marked-events");
    const ids = JSON.parse(saved || "[]");
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

function saveMarkedIds() {
  try {
    window.localStorage.setItem(markedStorageKey, JSON.stringify([...state.marked]));
  } catch {
    // Ignore storage failures and keep the UI usable.
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isCompactLayout() {
  return window.innerWidth <= 900;
}

function eventMatches(event) {
  const query = state.query.trim().toLowerCase();
  const text = `${event.title} ${event.room} ${event.description} ${event.clearing}`.toLowerCase();
  const hasQuery = !query || text.includes(query);
  const hasTags = !state.tags.size || [...state.tags].every((tag) => event.tags.some((item) => item.id === tag));
  const hasMark = !state.markOnly || state.marked.has(event.id);
  return event.date === state.day && hasQuery && hasTags && hasMark;
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

function annotateJapaneseGuestNames(text) {
  const matches = [];
  for (const [name, japanese] of japaneseGuestNames) {
    let start = text.indexOf(name);
    while (start !== -1) {
      const end = start + name.length;
      if (!matches.some((match) => start < match.end && end > match.start)) {
        matches.push({ start, end, japanese });
      }
      start = text.indexOf(name, end);
    }
  }

  if (!matches.length) return escapeHtml(text);

  matches.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  let cursor = 0;
  let html = "";
  for (const match of matches) {
    html += escapeHtml(text.slice(cursor, match.start));
    html += `<span class="guest-name">${escapeHtml(text.slice(match.start, match.end))}<span class="name-jp">（${escapeHtml(match.japanese)}）</span></span>`;
    cursor = match.end;
  }
  html += escapeHtml(text.slice(cursor));
  return html;
}

function isMarked(eventId) {
  return state.marked.has(eventId);
}

function markButton(eventId, compact = false) {
  const marked = isMarked(eventId);
  const label = marked ? "取消标记" : "标记活动";
  const icon = marked ? "&#9733;" : "&#9734;";
  const text = compact ? "" : `<span>${marked ? "已标记" : "标记"}</span>`;
  return `<button class="mark-toggle${marked ? " marked" : ""}${compact ? " compact" : ""}" type="button" data-mark-toggle="${eventId}" aria-label="${label}" title="${label}">${icon}${text}</button>`;
}

function toggleMarked(eventId) {
  if (state.marked.has(eventId)) state.marked.delete(eventId);
  else state.marked.add(eventId);
  saveMarkedIds();
}

function renderControls() {
  dayTabs.innerHTML = days.map((day) => (
    `<button class="${day === state.day ? "active" : ""}" data-day="${escapeHtml(day)}">${escapeHtml(day.replace(", 2026", ""))}</button>`
  )).join("");

  tagFilters.innerHTML = [
    `<button class="${state.markOnly ? "active" : ""}" data-filter="marked">已标记</button>`,
    ...tagLabels.map(([id, label]) => (
    `<button class="${state.tags.has(id) ? "active" : ""}" data-tag="${id}">${label}</button>`
    )),
  ].join("");
}

function renderRoomSwitcher(rooms, selectedRoom) {
  if (!roomSwitcher || !isCompactLayout() || !rooms.length) {
    if (roomSwitcher) {
      roomSwitcher.hidden = true;
      roomSwitcher.innerHTML = "";
    }
    return;
  }

  roomSwitcher.hidden = false;
  const options = [
    [allRoomsValue, "全部地点"],
    ...rooms.map((room) => [room, room]),
  ];
  roomSwitcher.innerHTML = `
    <button type="button" class="room-nav" data-room-shift="-1" aria-label="上一个地点">←</button>
    <label class="room-picker">
      <span>地点</span>
      <select id="roomSelect">
        ${options.map(([value, label]) => `<option value="${escapeHtml(value)}"${value === selectedRoom ? " selected" : ""}>${escapeHtml(label)}</option>`).join("")}
      </select>
    </label>
    <button type="button" class="room-nav" data-room-shift="1" aria-label="下一个地点">→</button>
  `;
}

function renderSummary(dayEvents, filteredEvents, rooms) {
  const clearingCount = filteredEvents.filter((event) => event.clearing).length;
  const markedCount = dayEvents.filter((event) => state.marked.has(event.id)).length;
  summary.innerHTML = [
    `${state.day}`,
    `${filteredEvents.length} / ${dayEvents.length} 个活动`,
    `${rooms.length} 个地点`,
    `${clearingCount} 个活动含清场说明`,
    `${markedCount} 个已标记`,
    `数据来源：AX 官网缓存`,
  ].map((item) => `<span>${escapeHtml(item)}</span>`).join("");
}

function eventTags(event) {
  return new Set(event.tags.map((tag) => tag.id));
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
  const tagIds = eventTags(event);
  const primary = colorPriority.find((id) => tagIds.has(id));
  return primary ? `tone-${primary}` : "tone-default";
}

function compareRooms(a, b) {
  const rankA = venueRank.has(a) ? venueRank.get(a) : Number.MAX_SAFE_INTEGER;
  const rankB = venueRank.has(b) ? venueRank.get(b) : Number.MAX_SAFE_INTEGER;
  return rankA - rankB || a.localeCompare(b);
}

function renderCompactAgenda(dayEvents, filteredEvents, rooms) {
  timeline.classList.add("agenda-mode");
  timeline.style.removeProperty("--room-count");
  timeline.style.removeProperty("--timeline-height");
  const sortedEvents = [...filteredEvents]
    .filter((event) => Number.isFinite(event.startMinutes) && Number.isFinite(event.endMinutes))
    .sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes || compareRooms(a.room, b.room));
  const conflictCounts = new Map(sortedEvents.map((event) => [
    event.id,
    sortedEvents.filter((other) => other.id !== event.id && other.startMinutes < event.endMinutes && other.endMinutes > event.startMinutes).length,
  ]));
  const groups = [];
  for (const event of sortedEvents) {
    const group = groups[groups.length - 1];
    if (!group || group.startMinutes !== event.startMinutes) {
      groups.push({ startMinutes: event.startMinutes, events: [event] });
    } else {
      group.events.push(event);
    }
  }

  timeline.innerHTML = groups.map((group) => {
    const simultaneous = group.events.length > 1;
    const groupLabel = minuteLabel(group.startMinutes);
    const cards = group.events.map((event) => {
      const classTags = eventColorClass(event);
      const timeText = `${eventTimeLabel(event.start, event.startDayOffset)} - ${eventTimeLabel(event.end, event.endDayOffset)}`;
      const conflictCount = conflictCounts.get(event.id) || 0;
      return `
        <div class="agenda-card ${classTags}" data-id="${event.id}" role="button" tabindex="0" aria-label="${escapeHtml(timeText)} ${escapeHtml(event.room)} ${escapeHtml(event.title)}">
          ${markButton(event.id, true)}
          <div class="agenda-card-meta">
            <span>${escapeHtml(timeText)}</span>
            <button type="button" class="agenda-meta-button agenda-room" data-room-context="${escapeHtml(event.id)}" aria-label="查看 ${escapeHtml(event.room)} 前后活动">⌖ ${escapeHtml(event.room)}</button>
            ${conflictCount ? `<button type="button" class="agenda-meta-button agenda-conflict" data-conflict-context="${escapeHtml(event.id)}" aria-label="查看 ${conflictCount} 个冲突活动">冲突 ${conflictCount}</button>` : ""}
          </div>
          <div class="event-title">${highlightWorkTitles(event.title, event.workTitles || (event.workTitle ? [event.workTitle] : []))}</div>
          <div class="badges">${eventBadges(event)}</div>
        </div>`;
    }).join("");
    return `
      <section class="agenda-group${simultaneous ? " has-conflict" : ""}">
        <div class="agenda-group-header">
          <span>${escapeHtml(groupLabel)}</span>
          ${simultaneous ? `<strong>${group.events.length} 个同时开始</strong>` : ""}
        </div>
        <div class="agenda-group-events">${cards}</div>
      </section>`;
  }).join("") || `<div class="empty-state">没有符合条件的活动</div>`;
  renderSummary(dayEvents, filteredEvents, rooms);
}

function renderTimeline() {
  renderControls();
  timeline.classList.remove("agenda-mode");
  const dayEvents = events.filter((event) => event.date === state.day);
  const filteredEvents = events.filter(eventMatches);
  const rooms = [...new Set(dayEvents.map((event) => event.room))].sort(compareRooms);
  const visibleRooms = rooms.filter((room) => filteredEvents.some((event) => event.room === room));
  const switcherRooms = visibleRooms.length ? visibleRooms : rooms;
  if (isCompactLayout()) {
    if (!state.room || (state.room !== allRoomsValue && !switcherRooms.includes(state.room))) {
      state.room = allRoomsValue;
    }
  }
  renderRoomSwitcher(switcherRooms, state.room);
  if (isCompactLayout() && state.room === allRoomsValue) {
    renderCompactAgenda(dayEvents, filteredEvents, switcherRooms);
    return;
  }
  const columns = isCompactLayout() ? (state.room ? [state.room] : []) : (visibleRooms.length ? visibleRooms : rooms);
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
          <div class="event-card ${classTags}" data-id="${event.id}" role="button" tabindex="0" aria-label="${escapeHtml(timeText)} ${escapeHtml(event.title)}" style="top:${top}px;height:${height}px">
            ${markButton(event.id, true)}
            <div class="event-time">${escapeHtml(timeText)}</div>
            <div class="event-title">${highlightWorkTitles(event.title, event.workTitles || (event.workTitle ? [event.workTitle] : []))}</div>
            <div class="badges">${eventBadges(event)}</div>
          </div>`;
      }).join("");
    return `<div class="lane" style="grid-column:${index + 2}">${cards}</div>`;
  });

  timeline.innerHTML = [...headers, `<div class="time-axis">${labels.join("")}</div>`, ...lanes].join("");
  renderSummary(dayEvents, filteredEvents, columns);
}

function showEvent(id) {
  const event = events.find((item) => item.id === id);
  if (!event) return;
  state.dialogEventId = id;
  dialogBody.innerHTML = `
    <div class="dialog-heading">
      <h2 class="dialog-title">${highlightWorkTitles(event.title, event.workTitles || (event.workTitle ? [event.workTitle] : []))}</h2>
      ${markButton(event.id)}
    </div>
    <div class="dialog-meta">
      <span class="badge">${escapeHtml(event.date)}</span>
      <span class="badge">${escapeHtml(eventTimeLabel(event.start, event.startDayOffset))} - ${escapeHtml(eventTimeLabel(event.end, event.endDayOffset))}</span>
      <span class="badge">${escapeHtml(event.room)}</span>
      ${eventBadges(event)}
    </div>
    <p class="dialog-description">${annotateJapaneseGuestNames(event.description)}</p>
  `;
  dialog.showModal();
}

function miniEventButton(event) {
  const timeText = `${eventTimeLabel(event.start, event.startDayOffset)} - ${eventTimeLabel(event.end, event.endDayOffset)}`;
  return `
    <button type="button" class="mini-event ${eventColorClass(event)}" data-open-event="${escapeHtml(event.id)}">
      <span class="mini-time">${escapeHtml(timeText)}</span>
      <span class="mini-room">${escapeHtml(event.room)}</span>
      <span class="mini-title">${highlightWorkTitles(event.title, event.workTitles || (event.workTitle ? [event.workTitle] : []))}</span>
      <span class="mini-badges">${eventBadges(event)}</span>
    </button>`;
}

function showRoomContext(id) {
  const event = events.find((item) => item.id === id);
  if (!event) return;
  const sameRoom = events
    .filter((item) => item.date === event.date && item.room === event.room)
    .sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes);
  const index = sameRoom.findIndex((item) => item.id === id);
  const nearby = sameRoom.slice(Math.max(0, index - 2), index + 3);
  dialogBody.innerHTML = `
    <div class="dialog-heading">
      <h2 class="dialog-title">${escapeHtml(event.room)}</h2>
      <button type="button" class="context-back" data-open-event="${escapeHtml(event.id)}">返回活动</button>
    </div>
    <div class="dialog-meta">
      <span class="badge">${escapeHtml(event.date)}</span>
      <span class="badge">${escapeHtml(eventTimeLabel(event.start, event.startDayOffset))} 附近</span>
    </div>
    <div class="context-list">
      ${nearby.map((item) => `<div class="${item.id === event.id ? "current-context" : ""}">${miniEventButton(item)}</div>`).join("")}
    </div>
  `;
  dialog.showModal();
}

function showConflictContext(id) {
  const event = events.find((item) => item.id === id);
  if (!event) return;
  const visibleEvents = events.filter(eventMatches);
  const conflicts = visibleEvents
    .filter((item) => item.id !== event.id
      && item.startMinutes < event.endMinutes
      && item.endMinutes > event.startMinutes)
    .sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes || compareRooms(a.room, b.room));
  const timeText = `${eventTimeLabel(event.start, event.startDayOffset)} - ${eventTimeLabel(event.end, event.endDayOffset)}`;
  dialogBody.innerHTML = `
    <div class="dialog-heading">
      <h2 class="dialog-title">冲突活动</h2>
      <button type="button" class="context-back" data-open-event="${escapeHtml(event.id)}">返回活动</button>
    </div>
    <div class="dialog-meta">
      <span class="badge">${escapeHtml(timeText)}</span>
      <span class="badge">${escapeHtml(event.room)}</span>
      <span class="badge">${conflicts.length} 个冲突</span>
    </div>
    <div class="context-anchor">${miniEventButton(event)}</div>
    <div class="context-list">
      ${conflicts.map(miniEventButton).join("") || `<div class="empty-state">没有重叠活动</div>`}
    </div>
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
  const filterButton = event.target.closest("button[data-filter]");
  if (filterButton) {
    state.markOnly = !state.markOnly;
    renderTimeline();
    return;
  }
  const button = event.target.closest("button[data-tag]");
  if (!button) return;
  const tag = button.dataset.tag;
  if (state.tags.has(tag)) state.tags.delete(tag);
  else state.tags.add(tag);
  renderTimeline();
});

if (roomSwitcher) {
roomSwitcher.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-room-shift]");
  if (!button) return;
  const dayEvents = events.filter((item) => item.date === state.day);
  const filteredEvents = events.filter(eventMatches);
  const rooms = [...new Set(dayEvents.map((item) => item.room))].sort(compareRooms);
  const switcherRooms = rooms.filter((room) => filteredEvents.some((item) => item.room === room));
  const usableRooms = [allRoomsValue, ...(switcherRooms.length ? switcherRooms : rooms)];
  if (!usableRooms.length) return;
  const index = Math.max(0, usableRooms.indexOf(state.room));
  const delta = Number(button.dataset.roomShift) || 0;
  const nextIndex = (index + delta + usableRooms.length) % usableRooms.length;
  state.room = usableRooms[nextIndex];
  renderTimeline();
});

roomSwitcher.addEventListener("change", (event) => {
  const select = event.target.closest("#roomSelect");
  if (!select) return;
  state.room = select.value;
  renderTimeline();
});
}

searchInput.addEventListener("input", () => {
  state.query = searchInput.value;
  renderTimeline();
});

timeline.addEventListener("click", (event) => {
  const mark = event.target.closest(".mark-toggle");
  if (mark) {
    toggleMarked(mark.dataset.markToggle);
    renderTimeline();
    return;
  }
  const roomContext = event.target.closest("[data-room-context]");
  if (roomContext) {
    showRoomContext(roomContext.dataset.roomContext);
    return;
  }
  const conflictContext = event.target.closest("[data-conflict-context]");
  if (conflictContext) {
    showConflictContext(conflictContext.dataset.conflictContext);
    return;
  }
  const button = event.target.closest(".event-card, .agenda-card");
  if (!button) return;
  showEvent(button.dataset.id);
});

timeline.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest(".event-card, .agenda-card");
  if (!card) return;
  event.preventDefault();
  showEvent(card.dataset.id);
});

dialogBody.addEventListener("click", (event) => {
  const mark = event.target.closest(".mark-toggle");
  if (mark) {
    toggleMarked(mark.dataset.markToggle);
    renderTimeline();
    showEvent(mark.dataset.markToggle);
    return;
  }
  const openEvent = event.target.closest("[data-open-event]");
  if (!openEvent) return;
  showEvent(openEvent.dataset.openEvent);
});

closeDialog.addEventListener("click", () => {
  state.dialogEventId = "";
  dialog.close();
});
dialog.addEventListener("close", () => {
  state.dialogEventId = "";
});
window.addEventListener("resize", () => {
  renderTimeline();
});
renderTimeline();
