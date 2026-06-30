const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "schedule-2026.html");
const outDir = path.join(root, "data");
const outPath = path.join(outDir, "events.js");
const workTitlesPath = path.join(outDir, "work-titles.json");
const overridesPath = path.join(outDir, "event-overrides.json");
const auditPath = path.join(outDir, "tag-audit.json");

const html = fs.readFileSync(sourcePath, "utf8");
const knownWorks = JSON.parse(fs.readFileSync(workTitlesPath, "utf8"))
  .map((title) => title.trim())
  .filter(Boolean)
  .sort((a, b) => b.length - a.length);
const eventOverrides = fs.existsSync(overridesPath)
  ? JSON.parse(fs.readFileSync(overridesPath, "utf8"))
  : {};
const eventMarker = '<div class="event"><div class="inner-item">';
const eventChunks = html.split(eventMarker).slice(1);

function decodeEntities(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "-")
    .replace(/&hellip;/g, "...");
}

function stripTags(value) {
  return decodeEntities(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchText(chunk, regex) {
  const match = chunk.match(regex);
  return match ? stripTags(match[1]) : "";
}

function normalizeRoom(room) {
  if (room === "Main Events (Crypto.com Arena)") return "Crypto.com Arena";
  return room;
}

function toMinutes(time) {
  const normalized = time.replace(/\u202f/g, " ").trim();
  const match = normalized.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();
  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function normalizeEventMinutes(start, end) {
  let startMinutes = toMinutes(start);
  let endMinutes = toMinutes(end);
  if (startMinutes == null || endMinutes == null) {
    return { startMinutes, endMinutes, durationMinutes: null };
  }

  if (startMinutes < 5 * 60) {
    startMinutes += 24 * 60;
    endMinutes += 24 * 60;
  }

  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }

  return {
    startMinutes,
    endMinutes,
    durationMinutes: endMinutes - startMinutes,
  };
}

function clearingStatus(text) {
  const lower = text.toLowerCase();
  const priorClear = lower.includes("will be cleared prior");
  const afterClear = lower.includes("will be cleared for the next panel") || lower.includes("will be cleared after");
  if (priorClear && afterClear) return "入场前/结束后清场";
  if (priorClear) return "入场前清场";
  if (afterClear) return "结束后清场";
  return "";
}

const weakWorkTitles = new Set([
  "MAG MAG",
  "Twisted Wonderland",
]);

const gameWorkTitles = new Set([
  "Doki Doki Literature Club",
  "Fate/Grand Order",
  "FGO",
  "HATSUNE MIKU",
  "Kingdom Hearts",
  "Last Cloudia",
  "Love and Deepspace",
  "NEEDY GIRL OVERDOSE",
  "Solo Leveling: Karma",
  "Teamfight Tactics",
  "Warframe",
  "Wuthering Waves",
  "Zenless Zone Zero",
  "Grand Summoners",
  "Blue Archive",
  "Chaos Zero Nightmare",
]);

function hasAnyWork(workTitles, titleSet) {
  return workTitles.some((title) => titleSet.has(title));
}

function hasOnlyWeakWorks(workTitles) {
  return workTitles.length > 0 && workTitles.every((title) => weakWorkTitles.has(title));
}

function pushTag(tags, id, label) {
  if (!tags.some((tag) => tag.id === id)) {
    tags.push({ id, label });
  }
}

const tagRules = [
  { id: "jp_va", label: "声优", test: /(japanese voice|japanese voices|seiyu|seiyuu|声优|声優|Makoto Furukawa|Daiki Yamashita|Gakuto Kajiwara|Yuki Shin|Yuu Hayashi|Masaya Fukunishi|Miho Okasaki|Megumi Toyoguchi|Aya Yamane|Kikunosuke Toya|Kensho Ono|Yume Miyamoto|Anna Nagase|Aoi Ichikawa|Daisuke Hirose|Machico|Rena Motomura|Rie Takahashi|Saori Hayami|Masakazu Morita|Junya Enoki|Takahiro Sakurai|Kana Ueda|Ayako Kawasumi|Hana Hishikawa|Haruki Ishiya|Shion Wakayama|Yoshino Aoyama|Setsu Ito|KAngel)/i },
  { id: "premiere", label: "首映/先行", test: /\b(world premiere|u\.s\. premiere|us premiere|north american premiere|premiere screening|early screening|early screenings|first look|preview|screening|exclusive premiere footage|exclusive footage|ep(?:isode)?\s*1\b)\b/i },
];
const tagLabelById = new Map([
  ["live", "Live表演"],
  ["jp_va", "声优"],
  ["premiere", "首映/先行"],
  ["game", "游戏"],
  ["weak", "弱关联"],
]);

const liveTitlePattern = /\b(?:concert|special live|live at|live performance|performance|dj set|opening performance|halftime performance|taiko performance)\b/i;
const liveDescriptionPattern = /\b(?:perform live|live performance|dj set|on stage|takes the stage|opening performance|halftime performance)\b/i;
const liveNegativePattern = /\b(?:panel|workshop|guide|introduction|101|tutorial|learn|basics|industry talk|talk|random play dance|rpd)\b/i;
const weakSignalPattern = /\b(?:live-action|filmmaker|director(?:ial)? debut|comedian|comedy segment|travel|tourism|career|publishing career|business|fashion show|fashion|beauty|plushie|charity auction|feedback panel|little tokyo|japanese american|japanese masks?|festival traditions?|traditional culture|sukeban|pro-wrestling|wrestling league|world championship fight)\b/i;

const workTitleAliases = [
  { canonical: "Echoes of Aincrad", pattern: /\bEchoes\s+(?:of|from)\s+Aincrad\b/i },
  { canonical: "Unanswered//butterfly", pattern: /\bUnanswered\/\/butterfly\b/i },
];

function inferWorkTitles(title) {
  const cleaned = title.replace(/\s*\[[^\]]+\]\s*/g, " ").replace(/\s+/g, " ").trim();
  const lower = cleaned.toLowerCase();
  const spans = [];

  for (const work of knownWorks) {
    const start = lower.indexOf(work.toLowerCase());
    if (start === -1) continue;
    const end = start + work.length;
    if (spans.some((span) => start < span.end && end > span.start)) continue;
    spans.push({ start, end, title: cleaned.slice(start, end) });
  }

  for (const { canonical, pattern } of workTitleAliases) {
    if (spans.some((span) => span.title.toLowerCase() === canonical.toLowerCase())) continue;
    const match = cleaned.match(pattern);
    if (!match || match.index == null) continue;
    const start = match.index;
    const end = start + match[0].length;
    if (spans.some((span) => start < span.end && end > span.start)) continue;
    spans.push({ start, end, title: cleaned.slice(start, end) });
  }

  return spans
    .sort((a, b) => a.start - b.start)
    .map((span) => span.title);
}

function inferTags(title, description, workTitles) {
  const text = `${title} ${description}`;
  const textWithoutEventBrand = text.replace(/\bAnime Expo\b/gi, "");
  const tags = tagRules
    .filter((rule) => rule.id === "premiere" ? rule.test.test(title) : rule.test.test(text))
    .map(({ id, label }) => ({ id, label }));

  const liveSignal = (liveTitlePattern.test(title) || liveDescriptionPattern.test(description))
    && !liveNegativePattern.test(title);
  if (liveSignal) {
    pushTag(tags, "live", "Live表演");
  }

  const gameSignal = hasAnyWork(workTitles, gameWorkTitles)
    || /\b(?:video game|visual novel|gacha|rhythm game|game developer|game publisher|gaming industry|steam|nintendo|playstation|xbox|esports)\b/i.test(text);
  if (gameSignal && !hasOnlyWeakWorks(workTitles)) {
    pushTag(tags, "game", "游戏");
  }

  const weakSignal = hasAnyWork(workTitles, weakWorkTitles) || weakSignalPattern.test(text);
  const strongAnimeSignal = !hasOnlyWeakWorks(workTitles)
    && (workTitles.length > 0
      || /\b(?:anime|manga|light novel|j-pop|j-rock|vtuber|crunchyroll|aniplex|kodansha|viz|yen press|shonen|shounen|isekai|dub|voice actor|voice of|japanese voice|favorite character|cosplayer|fandom)\b/i.test(textWithoutEventBrand));
  if (weakSignal && !strongAnimeSignal) {
    pushTag(tags, "weak", "弱关联");
  }
  return tags;
}

function applyOverrides(event) {
  const override = eventOverrides[event.title];
  if (!override) return event;

  const next = { ...event };
  if (Array.isArray(override.workTitles)) {
    next.workTitles = [...override.workTitles];
    next.workTitle = next.workTitles[0] || "";
  }

  let tags = [...next.tags];
  if (Array.isArray(override.setTags)) {
    tags = override.setTags
      .map((id) => ({ id, label: tagLabelById.get(id) || id }));
  }
  if (Array.isArray(override.removeTags)) {
    const remove = new Set(override.removeTags);
    tags = tags.filter((tag) => !remove.has(tag.id));
  }
  if (Array.isArray(override.addTags)) {
    for (const id of override.addTags) {
      pushTag(tags, id, tagLabelById.get(id) || id);
    }
  }
  next.tags = tags;
  return next;
}

const events = eventChunks.map((chunk, index) => {
  const date = matchText(chunk, /<div class="date">([\s\S]*?)<\/div>/i);
  const title = matchText(chunk, /<div class="name-ticket">([\s\S]*?)<div class="timebar">/i);
  const room = normalizeRoom(matchText(chunk, /Panel Room:\s*<span class="bold">([\s\S]*?)<\/span>/i));
  const start = matchText(chunk, /<div class="start">START:\s*<span class="bold">([\s\S]*?)<\/span>/i);
  const end = matchText(chunk, /<div class="end">END:\s*<span class="bold">([\s\S]*?)<\/span>/i);
  const description = matchText(chunk, /<div class="desc"><span class="bold">Panel Description:\s*<\/span>([\s\S]*?)<\/div><\/div><\/div>/i);
  const fullText = `${title} ${description}`;
  const minutes = normalizeEventMinutes(start, end);
  const workTitles = inferWorkTitles(title);
  const event = {
    id: `ax26-${index + 1}`,
    date,
    title,
    room,
    start,
    end,
    startMinutes: minutes.startMinutes,
    endMinutes: minutes.endMinutes,
    durationMinutes: minutes.durationMinutes,
    startDayOffset: Math.floor((minutes.startMinutes || 0) / (24 * 60)),
    endDayOffset: Math.floor((minutes.endMinutes || 0) / (24 * 60)),
    description,
    clearing: clearingStatus(fullText),
    workTitle: workTitles[0] || "",
    workTitles,
    tags: inferTags(title, description, workTitles),
  };
  return applyOverrides(event);
}).filter((event) => event.date && event.title && event.room && event.start && event.end);

const englishVaPattern = /\b(?:english voice|english dub|english va|bang zoom|bangzoom)\b/i;
const knownJapaneseVaPattern = /\b(?:japanese voice|seiyu|seiyuu|japanese va|Rie Takahashi|Saori Hayami|Masakazu Morita|Junya Enoki|Takahiro Sakurai|Kana Ueda|Ayako Kawasumi|Daiki Yamashita|Gakuto Kajiwara|Makoto Furukawa|Yuki Shin|Yuu Hayashi|Masaya Fukunishi|Miho Okasaki|Megumi Toyoguchi|Aya Yamane|Kikunosuke Toya|Kensho Ono|Yume Miyamoto|Anna Nagase|Aoi Ichikawa|Daisuke Hirose|Machico|Rena Motomura|Hana Hishikawa|Haruki Ishiya|Shion Wakayama|Yoshino Aoyama|KAngel)\b/i;

const nonWorkTitlePatterns = [
  /^(?:Maid Cafe|Kodansha House|SodaPop|Asian Standard Time|Echoheart|BLOW Brass|Bluemoon Sanitizer|Candy Bomber|Catbus Collective|StarCrusaders|GUY JEANS|Mariachi Eclipse|S4X|Nikkei Choral Ensemble|Studio Phoebe|Aimai Mirai|None Like Joshua|NecroBarkley|WLL|Welksie|Khaimera|NINJ3FF3C7|Jase Cloud|Neujack|DJMACHINEGOD|ChromeSyndicate|Faith in The Glitch|Ham Sandwich|Black Crystal|Ginger Root|DJ KZA|DJ Okami|Dolly Ave|Flipboitamidles|Atara Ara|cosmosy|pinponpanpon|himi♡chuu|V!CE|MEIRLIN|Drew Jackson|JooHee|Kazuki Tokaji|Katie Shesko|Allie Violin|FirahFabe|Hamu Cotton|Awai)\b/,
  /^(?:Sukeban World Championship Fight at Anime Expo|Idol Summer Escape|J-POP SOUND CAPSULE|AMV Finals|AMV Awards|2026 Masquerade|Welcome Ceremony|Closing Ceremony|Charity Auction at Anime Expo 2026|Anime Expo 2026 Feedback Panel|Anime Expo Fashion Show|Anime Pins - Collectors, Trade, & Swap|Anime Jeopardy|Anime IQ LIVE|New Game\+|Guess That Anime Intro|Guess that Anime|GO-GO Jojo|Demon Slayer Trivia|DEBATE TIME! HOT SHOUNEN TAKES|Hater's Dojo|Hear Me Out Weeb Edition|Performative Mc Panel|You Laugh You Leave|Ship It Or Skip It|Can We Fix Them|Could you really survive dating|Texas Waifu Wars|Lobotomy Kaisen|Yaoi & Bara Tropes|Kinky Side to Anime|Visual Novels: Interactive Literature|Savage Fight Scenes|Horror\/Thriller\/Dark Anime|FAKKU Industry Panel|FAKKU MEME50|MangaGamer|BL Bingo|Boys Love and Fujoshi|For the love of Josei manga|JAST|Your Indie Visual Novel|OceanVeil|Sports Anime Festival|Resistance, Resilience|Representations of History|Games, Sports, and Gender|Black Fandom and Anime|Elves, Robots, and the Invisible Man|Dystopia, Geography, and Museums|Physics of Anime|Eating Orcs, Rooming with Cats|A Psychiatrist on Anime Culture|Masters of Anime|Breaking Into Anime|How to Become a Manga Professional|Turning Fandom into a Career|From Japan to the US|Manga Licensing with DENPA|The Best Manga for Classrooms|Collaborating with Indie Manga Creators|Manga 101|Making Manga with VIZ Originals|Decoding Success|Make Your Debut as an Author|Stay on Top of the Latest Anime News|Anime News Network Recommends|Anime Trending Industry Panel|Delicious in Data|Where to go in Japan|All About Cosplay in Tokyo|Walt's Footsteps|Four Decades Of Robotech|Bushiroad Panel at Anime Expo 2026|WayForward Anime Game Developer Panel|Aksys Games Panel|AnimEigo Industry Panel|Yen Press Industry Panel|Square Enix Manga & Books Industry Panel|Dark Horse Manga|Seven Seas Industry Panel|Omoi Manga Industry Panel|J-Novel Club|Ink Pop|What's New From Inklore|Explore Your Passions|BL Comics Label|True Digital Ownership|Min-Max Mayhem|Stories Made to Last|Unveiling Kodansha's Latest Manga|Kodansha House|Crunchyroll Showcase|Aniplex of America Industry Panel|Production I.G x WIT STUDIO|Studio TRIGGER Panel 2026|CloverWorks Industry Panel|Amuse Creative Studio|Yoshitaka Amano|Bright Horizons|Special Creator Session|Cosplay Senpai Roundtable|Cosplay Judge Roundtable|Build Book Boot Camp|Cosplay Summer Camp!|Cosplay Spelling Bee|Cosplay Crash Course|Ins and Outs of International Cosplay Competitions|Let's Make A Cosplay Pattern!|Gundam Cosplay 101|Shoemaking For Cosplay|Wig Styling|Capturing Cosplay Magic|From Cosplay to Curtain Call|I Was Transported To An Anime Convention|Cosplay Court|Make your first helmet wig|Getting Started With Machine Embroidery|Design Your Own Stoneware Piece|Naginata an Anime Polearm Workshop|J-Pop Dance Workshop|Let's Dance! ParaPara101|Dokibird|S4X|Bluemoon Sanitizer|FRAN|Peachmilky|RinRin Doll|Sasara Sekine|You'll Melt More!|Snuffy|Zentreya|Chibidoki|Dooby3D|Sayu Sincro|Kizuna AI|JAPAN MUSIC VOCALOID)\b/,
];

function isNonWorkTitleEvent(title) {
  return nonWorkTitlePatterns.some((pattern) => pattern.test(title));
}

const audit = {
  missingVoiceTagCandidates: events
    .filter((event) => {
      if (event.tags.some((tag) => tag.id === "jp_va")) return false;
      const text = `${event.title} ${event.description}`;
      if (englishVaPattern.test(text)) return false;
      if (knownJapaneseVaPattern.test(text)) return true;
      return /(voice of|special guests?.*\(|cast and creator|featuring .*?\(|with cast|voice actors?)/i.test(text);
    })
    .map((event) => ({ title: event.title, description: event.description })),
  missingWorkTitleCandidates: events
    .filter((event) => {
      if (event.workTitles.length > 0) return false;
      if (isNonWorkTitleEvent(event.title)) return false;
      return /\b(?:anime|manga|game|voice actor|voice of|seiyu|seiyuu|vtuber|idol|screening|premiere|crunchyroll|aniplex|toho|kodansha|viz|yen press|novel|cosplay|fandom)\b/i.test(`${event.title} ${event.description}`);
    })
    .map((event) => ({ title: event.title, description: event.description })),
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  outPath,
  `window.AX_EVENTS = ${JSON.stringify(events, null, 2)};\n`,
  "utf8",
);
fs.writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

const days = [...new Set(events.map((event) => event.date))];
const rooms = [...new Set(events.map((event) => event.room))];
console.log(`Wrote ${events.length} events across ${days.length} days and ${rooms.length} rooms to ${path.relative(root, outPath)}`);
