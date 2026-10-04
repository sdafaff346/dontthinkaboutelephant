// 코끼리를 생각하지마 (Don't Think of an Elephant) - hierarchical + structured long-term memory for SillyTavern.
// Episodes -> chapters -> saga timeline, a structured ledger (characters, relations,
// threads, facts, items, canon divergences), importance-based compaction, and
// keyword recall from an archive of compacted details.

const MODULE = 'long_memory';
const META_KEY = 'long_memory';
const CHAR_FIELD = 'long_memory_frame';
const PROMPT_KEY_MAIN = 'long_memory_main';
const PROMPT_KEY_ANCHOR = 'long_memory_anchor';
const PROMPT_KEY_RECALL = 'long_memory_recall';
const LOG_PREFIX = '[코끼리를 생각하지마]';
const APP_NAME = '코끼리를 생각하지마';
const ELEPHANT_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 14 64 40" aria-hidden="true" focusable="false"><ellipse cx="12" cy="31" rx="11" ry="13" fill="#9AA4B9"/><ellipse cx="52" cy="31" rx="11" ry="13" fill="#9AA4B9"/><ellipse cx="12.5" cy="31.5" rx="6.5" ry="8.5" fill="#F7C5CF"/><ellipse cx="51.5" cy="31.5" rx="6.5" ry="8.5" fill="#F7C5CF"/><ellipse cx="32" cy="33" rx="18" ry="17" fill="#B4BCCD"/><path d="M32 41 Q31.6 47 35.5 48.2 Q38.6 48.8 39 46" stroke="#939DB3" stroke-width="7.5" fill="none" stroke-linecap="round"/><ellipse cx="25.5" cy="33.5" rx="2.1" ry="2.5" fill="#3D3A4B"/><ellipse cx="38.5" cy="33.5" rx="2.1" ry="2.5" fill="#3D3A4B"/></svg>';

// Verified against ST source: extension_prompt_types / extension_prompt_roles
const POSITIONS = { in_prompt: 0, in_chat: 1, before_prompt: 2 };
const ROLES = { system: 0, user: 1, assistant: 2 };

const LANGUAGES = {
    chat: { label: '채팅 언어 따라가기', instruction: 'Write in the same language the story transcript is mostly written in.' },
    en: { label: 'English (토큰 절약)', instruction: 'Write in English.' },
    ko: { label: '한국어', instruction: 'Write in Korean (한국어).' },
    ja: { label: '日本語', instruction: 'Write in Japanese (日本語).' },
    zh: { label: '中文', instruction: 'Write in Simplified Chinese (简体中文).' },
};

const DETAIL = {
    concise: 'Aim for roughly 80-150 words, scaled to how much actually happens.',
    standard: 'Aim for roughly 150-300 words, scaled to how much actually happens.',
    detailed: 'Aim for roughly 300-600 words, scaled to how much actually happens. Err on the side of keeping concrete details.',
};

const CATEGORIES = {
    character: '인물',
    relation: '관계',
    thread: '진행 중인 일/약속',
    fact: '사실/세계관/비밀',
    item: '중요 물건',
    divergence: '원작과 달라진 점',
};

const CATEGORY_EN = {
    character: 'Character',
    relation: 'Relationship',
    thread: 'Thread',
    fact: 'Fact',
    item: 'Item',
    divergence: 'Canon divergence',
};

const EMBED_SOURCES = {
    inherit: 'ST 벡터 저장소 설정 따르기',
    transformers: 'Local (Transformers, 무료)',
    ollama: 'Ollama',
    llamacpp: 'llama.cpp',
    vllm: 'vLLM',
    openai: 'OpenAI',
    palm: 'Google AI Studio (Gemini)',
    vertexai: 'Google Vertex AI',
    openrouter: 'OpenRouter',
    mistral: 'Mistral',
    cohere: 'Cohere',
    togetherai: 'TogetherAI',
    nomicai: 'Nomic AI',
    electronhub: 'Electron Hub',
    chutes: 'Chutes',
    nanogpt: 'NanoGPT',
    siliconflow: 'SiliconFlow',
    workers_ai: 'Cloudflare Workers AI',
    extras: 'Extras',
};

const FRAME_MODES = {
    original: '오리지널 (원작 없음)',
    canon: '원작 유지 (원작 설정·성격·관계 그대로)',
    au: 'AU (성격·관계는 원작, 배경은 바꿈)',
    free: '자유 2차 창작 (원작은 참고만, 이야기 설정이 우선)',
};

const defaultSettings = Object.freeze({
    enabled: true,
    profileId: '',
    includePreset: true,
    systemAsUser: false,
    language: 'chat',
    detail: 'detailed',
    keepRecent: 20,
    batchMessages: 40,
    batchTokens: 24000,
    maxOutputTokens: 4096,
    retries: 2,
    stripHtml: true,
    hideSummarized: true,
    memoryBudget: 12000,
    autoCompact: true,
    protectRecent: 4,
    maxEpisodes: 12,
    chapterSize: 5,
    maxChapters: 8,
    sagaMaxWords: 1500,
    staleAfter: 400,
    archiveMax: 1000,
    injectPosition: 'in_prompt',
    injectDepth: 6,
    injectRole: 'system',
    anchorEnabled: true,
    anchorDepth: 3,
    recallEnabled: true,
    recallScan: 4,
    recallTopK: 6,
    recallTokenBudget: 1500,
    recallDepth: 2,
    eventsEnabled: true,
    eventMax: 5000,
    vectorEnabled: true,
    embedSource: 'inherit',
    embedModel: '',
    embedApiUrl: '',
    vectorThreshold: 20,
    queryTimeoutMs: 8000,
    indexRawMessages: true,
    rawChunkMessages: 2,
    rawChunkChars: 1500,
    relevanceWeight: 70,
    importanceWeight: 20,
    recencyWeight: 10,
    remindAt: 80,
    maxUndo: 10,
    extraRules: '',
    uiSettingsOpen: false,
});

// ---------------------------------------------------------------- settings

function ctx() {
    return SillyTavern.getContext();
}

function getSettings() {
    const { extensionSettings } = ctx();
    if (!extensionSettings[MODULE]) {
        extensionSettings[MODULE] = structuredClone(defaultSettings);
    }
    for (const key of Object.keys(defaultSettings)) {
        if (!Object.hasOwn(extensionSettings[MODULE], key)) {
            extensionSettings[MODULE][key] = defaultSettings[key];
        }
    }
    return extensionSettings[MODULE];
}

// ---------------------------------------------------------------- memory model

function emptyFrame() {
    return { mode: 'original', work: '', characters: '', au: '', notes: '' };
}

function emptyMemory() {
    return {
        version: 1,
        cursor: -1,
        saga: { text: '', coversTo: -1 },
        timeline: [],
        archive: [],
        ledger: { scene: { time: '', place: '', present: '', mood: '' }, entries: [] },
        frame: emptyFrame(),
        events: [],
        hiddenRanges: [],
        history: [],
    };
}

function hasChat() {
    return !!ctx().getCurrentChatId?.();
}

function getMemory(create = true) {
    if (!hasChat()) return null;
    const { chatMetadata } = ctx();
    if (!chatMetadata) return null;
    let memory = chatMetadata[META_KEY];
    if (!memory) {
        if (!create) return null;
        memory = emptyMemory();
        chatMetadata[META_KEY] = memory;
    }
    const base = emptyMemory();
    for (const key of Object.keys(base)) {
        if (!Object.hasOwn(memory, key)) memory[key] = base[key];
    }
    memory.frame = { ...emptyFrame(), ...memory.frame };
    memory.ledger.scene = { ...base.ledger.scene, ...memory.ledger.scene };
    if (!Array.isArray(memory.ledger.entries)) memory.ledger.entries = [];
    return memory;
}

function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function clampInt(value, min, max, fallback) {
    const n = parseInt(value, 10);
    if (Number.isNaN(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function esc(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Rough token estimate (CJK/Hangul ~1 token per char, Latin ~3.5 chars per token)
function estTokens(str) {
    if (!str) return 0;
    let cjk = 0;
    for (const ch of str) {
        const c = ch.codePointAt(0);
        if ((c >= 0x3000 && c <= 0x9fff) || (c >= 0xac00 && c <= 0xd7af) || (c >= 0xf900 && c <= 0xfaff)) cjk++;
    }
    return Math.ceil(cjk * 1.1 + (str.length - cjk) / 3.5);
}

async function countTokens(str) {
    try {
        const { getTokenCountAsync } = ctx();
        if (typeof getTokenCountAsync === 'function') return await getTokenCountAsync(str);
    } catch (err) {
        console.debug(LOG_PREFIX, 'token count fallback', err);
    }
    return estTokens(str);
}

// ---------------------------------------------------------------- hidden ranges

function addRange(ranges, from, to) {
    const all = [...ranges, [from, to]].sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const [a, b] of all) {
        const last = merged[merged.length - 1];
        if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b);
        else merged.push([a, b]);
    }
    return merged;
}

function rangesToList(ranges) {
    const out = [];
    for (const [a, b] of ranges || []) for (let i = a; i <= b; i++) out.push(i);
    return out;
}

function listToRanges(list) {
    let ranges = [];
    for (const i of [...list].sort((a, b) => a - b)) ranges = addRange(ranges, i, i);
    return ranges;
}

function setHidden(indices, hide) {
    const { chat } = ctx();
    for (const i of indices) {
        const msg = chat[i];
        if (!msg) continue;
        msg.is_system = hide;
        const block = document.querySelector(`#chat .mes[mesid="${i}"]`);
        if (block) block.setAttribute('is_system', String(hide));
    }
}

// ---------------------------------------------------------------- text helpers

function stripMessage(text) {
    let t = String(text ?? '');
    t = t.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '');
    if (getSettings().stripHtml) {
        t = t.replace(/<(style|script)[\s\S]*?<\/\1>/gi, '');
        t = t.replace(/<!--[\s\S]*?-->/g, '');
        t = t.replace(/<\/?[a-zA-Z][^>]*>/g, '');
    }
    return t.replace(/\n{3,}/g, '\n\n').trim();
}

function isSummarizable(msg) {
    if (!msg) return false;
    if (!msg.is_system) return true;
    return msg.extra?.type === 'narrator';
}

function messageLine(msg, index) {
    const { name1, name2 } = ctx();
    const name = msg.name || (msg.is_user ? name1 : name2);
    return `[#${index}] ${name}: ${stripMessage(msg.mes)}`;
}

// Removes reasoning blocks and code fences that different providers add.
function cleanOutput(text) {
    let t = String(text ?? '');
    t = t.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '');
    t = t.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
    const lastClose = t.lastIndexOf('</think>');
    if (lastClose !== -1) t = t.slice(lastClose + '</think>'.length);
    t = t.replace(/^```[a-zA-Z]*\s*$/gm, '');
    return t.trim();
}

function extractTag(text, tag) {
    const closed = text.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'));
    if (closed) return closed[1].trim();
    const open = text.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*)$`, 'i'));
    if (open) return open[1].replace(/<\/?[a-z_]+>\s*$/i, '').trim();
    return null;
}

function extractAllTags(text, tag) {
    const out = [];
    const re = new RegExp(`<${tag}\\s+id\\s*=\\s*"([^"]+)"\\s*>([\\s\\S]*?)</${tag}>`, 'gi');
    let m;
    while ((m = re.exec(text)) !== null) out.push({ id: m[1].trim(), text: m[2].trim() });
    return out;
}

// Parses "title: / importance: / keywords: / summary:" blocks.
function parseNodeBlock(block) {
    if (!block) return null;
    const get = (key) => {
        const m = block.match(new RegExp(`^\\s*\\**${key}\\**\\s*[:：]\\s*(.*)$`, 'im'));
        return m ? m[1].trim() : '';
    };
    const summaryMatch = block.match(/^\s*\**summary\**\s*[:：]\s*([\s\S]*)$/im);
    let summary = summaryMatch ? summaryMatch[1].trim() : '';
    if (!summary) {
        summary = block
            .split('\n')
            .filter(line => !/^\s*\**(title|importance|keywords)\**\s*[:：]/i.test(line))
            .join('\n')
            .trim();
    }
    if (!summary) return null;
    const keywords = get('keywords')
        .split(/[,，、;]/)
        .map(k => k.trim())
        .filter(k => k.length >= 2)
        .slice(0, 16);
    return {
        title: get('title').slice(0, 120) || summary.slice(0, 40),
        importance: clampInt(get('importance').replace(/[^0-9]/g, ''), 1, 5, 3),
        keywords,
        text: summary,
    };
}

function parseJsonLenient(str) {
    if (!str) return null;
    let s = str.replace(/```[a-zA-Z]*/g, '').trim();
    const start = s.search(/[[{]/);
    const end = Math.max(s.lastIndexOf(']'), s.lastIndexOf('}'));
    if (start === -1 || end === -1) return null;
    s = s.slice(start, end + 1);
    const attempts = [
        s,
        s.replace(/,\s*([\]}])/g, '$1'),
        s.replace(/[“”]/g, '"').replace(/[‘’]/g, '\'').replace(/,\s*([\]}])/g, '$1'),
    ];
    for (const attempt of attempts) {
        try {
            const parsed = JSON.parse(attempt);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            // try next variant
        }
    }
    // Last resort: parse one object per line
    const ops = [];
    for (const line of s.split('\n')) {
        const m = line.match(/\{.*\}/);
        if (!m) continue;
        try {
            ops.push(JSON.parse(m[0].replace(/,\s*}/g, '}')));
        } catch {
            // skip broken line
        }
    }
    return ops.length ? ops : null;
}

// ---------------------------------------------------------------- prompt rendering

function frameText(frame) {
    const f = { ...emptyFrame(), ...frame };
    const work = f.work.trim() || 'the original work';
    const parts = [];
    switch (f.mode) {
        case 'canon':
            parts.push(`This is fanfiction based on "${work}". Stay faithful to the original work: canon personalities, speech styles, relationships, world rules and backstory remain valid unless this story has explicitly changed them (see canon divergences).`);
            break;
        case 'au':
            parts.push(`This is an alternate-universe (AU) fanfiction based on "${work}". Characters keep their canon core personalities, speech styles and essential relationships, but the setting is replaced by the AU described below. Canon events and world details that conflict with the AU do not apply.`);
            if (f.au.trim()) parts.push(`AU setting:\n${f.au.trim()}`);
            break;
        case 'free':
            parts.push(`This is a free-form derivative work inspired by "${work}". Canon is only loose inspiration: anything established in this story overrides canon. Do not pull in canon events, characters or facts unless this story has introduced them.`);
            if (f.au.trim()) parts.push(`Setting:\n${f.au.trim()}`);
            break;
        default:
            if (f.au.trim()) parts.push(`Setting:\n${f.au.trim()}`);
            break;
    }
    if (f.characters.trim()) parts.push(`Character notes (written by the user):\n${f.characters.trim()}`);
    if (f.notes.trim()) parts.push(`Additional notes (written by the user):\n${f.notes.trim()}`);
    return parts.join('\n\n');
}

function ledgerText(ledger, { includeClosed = false } = {}) {
    const lines = [];
    const sc = ledger.scene || {};
    const sceneBits = [
        sc.time && `Time: ${sc.time}`,
        sc.place && `Place: ${sc.place}`,
        sc.present && `Present: ${sc.present}`,
        sc.mood && `Mood: ${sc.mood}`,
    ].filter(Boolean);
    if (sceneBits.length) lines.push(`[Current situation]\n${sceneBits.join(' | ')}`);
    const labels = {
        character: 'Characters',
        relation: 'Relationships',
        thread: 'Open threads, goals & promises',
        fact: 'Established facts, world rules & secrets',
        item: 'Important items',
        divergence: 'Canon divergences (this story overrides canon here)',
    };
    for (const cat of Object.keys(labels)) {
        const entries = ledger.entries
            .filter(e => e.cat === cat && (includeClosed || e.status !== 'closed'))
            .sort((a, b) => (b.pinned - a.pinned) || (b.importance - a.importance));
        if (!entries.length) continue;
        lines.push(`[${labels[cat]}]\n${entries.map(e => `- ${e.key}: ${e.value}${e.status === 'closed' ? ' (resolved)' : ''}`).join('\n')}`);
    }
    return lines.join('\n\n');
}

function timelineText(memory, { lastN = null } = {}) {
    const nodes = lastN ? memory.timeline.slice(-lastN) : memory.timeline;
    return nodes
        .map(n => `### ${n.tier === 'chapter' ? 'Chapter' : 'Episode'}: ${n.title} (messages #${n.from}-#${n.to})\n${n.text}`)
        .join('\n\n');
}

function buildMemoryText(memory) {
    if (!memory) return '';
    const sections = [];
    const frame = frameText(memory.frame);
    if (frame) sections.push(`[Story frame]\n${frame}`);
    if (memory.saga.text.trim()) sections.push(`[The story so far]\n${memory.saga.text.trim()}`);
    if (memory.timeline.length) sections.push(`[Timeline, oldest to newest]\n${timelineText(memory)}`);
    const ledger = ledgerText(memory.ledger);
    if (ledger) sections.push(ledger);
    if (!sections.length) return '';
    const covered = memory.cursor >= 0 ? `messages #0-#${memory.cursor}` : 'earlier messages';
    return [
        '<story_memory>',
        `This is the authoritative record of the earlier part of this story (${covered}), compressed because the original messages are no longer shown. Treat everything here as established canon of this story: keep names, facts, relationships, injuries, promises and open threads consistent with it. Older events are condensed; the most recent messages continue directly after the last timeline entry. Use it silently; do not repeat or summarize it in replies.`,
        '',
        sections.join('\n\n'),
        '</story_memory>',
    ].join('\n');
}

function buildAnchorText(memory) {
    if (!memory) return '';
    const sc = memory.ledger.scene || {};
    const bits = [];
    const scene = [sc.time, sc.place, sc.present].filter(Boolean).join(' | ');
    if (scene) bits.push(`Now: ${scene}`);
    const threads = memory.ledger.entries
        .filter(e => e.cat === 'thread' && e.status !== 'closed')
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 6)
        .map(e => e.key);
    if (threads.length) bits.push(`Open threads: ${threads.join('; ')}`);
    const divergences = memory.ledger.entries.filter(e => e.cat === 'divergence').slice(0, 4).map(e => e.key);
    if (divergences.length) bits.push(`Story overrides canon on: ${divergences.join('; ')}`);
    if (!bits.length && !memory.timeline.length && !memory.saga.text) return '';
    return `[Continuity check: stay consistent with <story_memory>. ${bits.join(' / ')}]`;
}

// ---------------------------------------------------------------- archive

function archiveNode(memory, node, kind = 'timeline') {
    if (!node?.text) return;
    if (memory.archive.some(a => a.id === node.id)) return;
    memory.archive.push({
        id: node.id,
        kind,
        title: node.title,
        text: node.text,
        keywords: node.keywords || [],
        importance: node.importance || 3,
        from: node.from,
        to: node.to,
    });
    const max = getSettings().archiveMax;
    if (memory.archive.length > max) {
        memory.archive.sort((a, b) => (a.importance - b.importance) || ((a.from ?? 0) - (b.from ?? 0)));
        memory.archive.splice(0, memory.archive.length - max);
        memory.archive.sort((a, b) => (a.from ?? 0) - (b.from ?? 0));
    }
}

// ---------------------------------------------------------------- recall corpus
// Retrieval units: extracted events, archived (compacted) notes and the original
// text of summarized messages. Each unit has a stable numeric hash.

function hashString(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0) || 1;
}

function eventEmbedText(e) {
    const bits = [e.text];
    if (e.characters?.length) bits.push(`Characters: ${e.characters.join(', ')}`);
    if (e.place) bits.push(`Place: ${e.place}`);
    if (e.items?.length) bits.push(`Items: ${e.items.join(', ')}`);
    if (e.keywords?.length) bits.push(`Keywords: ${e.keywords.join(', ')}`);
    return bits.join(' | ');
}

function buildCorpus(memory) {
    const s = getSettings();
    const items = [];
    for (const e of memory.events || []) {
        const text = eventEmbedText(e);
        items.push({ hash: hashString(`ev|${e.id}|${text}`), kind: 'event', text, display: e.text, importance: e.importance || 3, from: e.from, to: e.to });
    }
    for (const a of memory.archive || []) {
        const text = `${a.title}: ${a.text}${a.keywords?.length ? ` | Keywords: ${a.keywords.join(', ')}` : ''}`;
        items.push({ hash: hashString(`ar|${a.id}|${text}`), kind: 'archive', text, display: `${a.title}: ${a.text}`, importance: a.importance || 3, from: a.from, to: a.to });
    }
    if (s.indexRawMessages && memory.cursor >= 0) {
        const { chat } = ctx();
        const hidden = new Set(rangesToList(memory.hiddenRanges));
        let group = [];
        const flush = () => {
            if (!group.length) return;
            const text = group.map(g => g.line).join('\n').slice(0, s.rawChunkChars);
            items.push({ hash: hashString(`raw|${group[0].i}|${text}`), kind: 'raw', text, display: text, importance: 3, from: group[0].i, to: group[group.length - 1].i });
            group = [];
        };
        for (let i = 0; i <= Math.min(memory.cursor, chat.length - 1); i++) {
            const msg = chat[i];
            if (!msg || !(hidden.has(i) || isSummarizable(msg))) continue;
            const line = messageLine(msg, i);
            if (line.length < 8) continue;
            group.push({ i, line });
            if (group.length >= s.rawChunkMessages) flush();
        }
        flush();
    }
    return items;
}

// ---------------------------------------------------------------- BM25 (keyword side of hybrid search)

const STOPWORDS = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'her', 'was', 'one', 'our', 'out', 'his', 'him', 'she', 'they', 'them', 'this', 'that', 'with', 'have', 'from', 'what', 'when', 'were', 'will', 'your', 'into', 'then', 'than', 'just', 'like', 'there', 'their', 'about', 'would', 'could', 'should']);
const CJK_RE = /[぀-ヿ㐀-鿿가-힯豈-﫿]/;

function tokenize(text) {
    const tokens = [];
    const words = String(text || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
    for (const word of words) {
        if (CJK_RE.test(word)) {
            // Character bigrams make Korean particles and unspaced Japanese/Chinese searchable.
            if (word.length <= 2) tokens.push(word);
            for (let i = 0; i < word.length - 1; i++) tokens.push(word.slice(i, i + 2));
        } else if (word.length >= 2 && !STOPWORDS.has(word)) {
            tokens.push(word);
        }
    }
    return tokens;
}

const tokenCache = new Map();

function docTokens(item) {
    let cached = tokenCache.get(item.hash);
    if (!cached) {
        const tokens = tokenize(item.text);
        const tf = new Map();
        for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
        cached = { tf, length: tokens.length };
        tokenCache.set(item.hash, cached);
        if (tokenCache.size > 20000) tokenCache.clear();
    }
    return cached;
}

function bm25Search(corpus, query, limit) {
    const queryTokens = [...new Set(tokenize(query))];
    if (!queryTokens.length || !corpus.length) return [];
    const docs = corpus.map(item => ({ item, ...docTokens(item) }));
    const avg = docs.reduce((sum, d) => sum + d.length, 0) / docs.length || 1;
    const df = new Map();
    for (const t of queryTokens) df.set(t, docs.filter(d => d.tf.has(t)).length);
    const k1 = 1.2;
    const b = 0.75;
    const n = docs.length;
    const scored = [];
    for (const d of docs) {
        let score = 0;
        for (const t of queryTokens) {
            const f = d.tf.get(t);
            if (!f) continue;
            const idf = Math.log(1 + (n - df.get(t) + 0.5) / (df.get(t) + 0.5));
            score += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.length / avg));
        }
        if (score > 0) scored.push({ item: d.item, score });
    }
    return scored.sort((a, b2) => b2.score - a.score).slice(0, limit).map(x => x.item);
}

// ---------------------------------------------------------------- vector store (ST /api/vector)

const UNSUPPORTED_EMBED = new Set(['webllm', 'koboldcpp']);

function collectionId() {
    return `longmem_${hashString(String(ctx().getCurrentChatId()))}`;
}

function vectorBody(extra = {}) {
    const s = getSettings();
    const c = ctx();
    const vs = c.extensionSettings.vectors || {};
    const source = s.embedSource === 'inherit' ? (vs.source || 'transformers') : s.embedSource;
    if (UNSUPPORTED_EMBED.has(source)) throw new Error(`${source} 임베딩은 지원하지 않습니다. 다른 임베딩 소스를 선택해 주세요.`);
    const override = s.embedModel.trim();
    const body = { ...extra, source };
    const modelKeys = {
        openai: 'openai_model',
        togetherai: 'togetherai_model',
        electronhub: 'electronhub_model',
        openrouter: 'openrouter_model',
        cohere: 'cohere_model',
        ollama: 'ollama_model',
        vllm: 'vllm_model',
        palm: 'google_model',
        vertexai: 'google_model',
        chutes: 'chutes_model',
        nanogpt: 'nanogpt_model',
        siliconflow: 'siliconflow_model',
        workers_ai: 'workers_ai_model',
    };
    if (modelKeys[source]) body.model = override || vs[modelKeys[source]] || undefined;
    if (['ollama', 'llamacpp', 'vllm'].includes(source)) {
        body.apiUrl = s.embedApiUrl.trim()
            || (vs.use_alt_endpoint ? vs.alt_endpoint_url : c.textCompletionSettings?.server_urls?.[source]);
        if (source === 'ollama') body.keep = !!vs.ollama_keep;
    }
    const oai = c.chatCompletionSettings || {};
    if (source === 'palm') body.api = 'makersuite';
    if (source === 'vertexai') {
        body.api = 'vertexai';
        body.vertexai_auth_mode = oai.vertexai_auth_mode;
        body.vertexai_region = oai.vertexai_region;
        body.vertexai_express_project_id = oai.vertexai_express_project_id;
    }
    if (source === 'siliconflow') body.siliconflow_endpoint = oai.siliconflow_endpoint;
    if (source === 'workers_ai') {
        body.model = body.model || '@cf/baai/bge-m3';
        body.workers_ai_account_id = oai.workers_ai_account_id;
    }
    if (source === 'extras') {
        body.extrasUrl = c.extensionSettings.apiUrl;
        body.extrasKey = c.extensionSettings.apiKey;
    }
    return body;
}

async function vectorRequest(path, body, signal = null) {
    const response = await fetch(`/api/vector/${path}`, {
        method: 'POST',
        headers: ctx().getRequestHeaders(),
        body: JSON.stringify(body),
        signal,
    });
    if (!response.ok) throw new Error(`벡터 요청 실패 (${path}, HTTP ${response.status})`);
    if (path === 'list' || path === 'query') return response.json();
    return null;
}

let syncing = false;
const syncState = { chatId: null, indexed: 0, total: 0, error: '' };

async function syncVectors({ notify = false } = {}) {
    const s = getSettings();
    if (!s.vectorEnabled || !s.recallEnabled || syncing || !hasChat()) return;
    const memory = getMemory(false);
    if (!memory) return;
    const chatId = ctx().getCurrentChatId();
    syncing = true;
    try {
        const corpus = buildCorpus(memory);
        const id = collectionId();
        const saved = new Set((await vectorRequest('list', vectorBody({ collectionId: id }))).map(Number));
        const wanted = new Set(corpus.map(x => x.hash));
        const toInsert = corpus.filter(x => !saved.has(x.hash));
        const toDelete = [...saved].filter(h => !wanted.has(h));
        for (let i = 0; i < toInsert.length; i += 50) {
            if (!stillSameChat(chatId)) return;
            setProgress(`벡터 색인 중 ${Math.min(i + 50, toInsert.length)}/${toInsert.length}`);
            const items = toInsert.slice(i, i + 50).map(x => ({ hash: x.hash, text: x.text, index: x.from ?? 0 }));
            await vectorRequest('insert', vectorBody({ collectionId: id, items }));
        }
        if (toDelete.length) await vectorRequest('delete', vectorBody({ collectionId: id, hashes: toDelete }));
        Object.assign(syncState, { chatId, indexed: corpus.length, total: corpus.length, error: '' });
        if (notify) toastr.success(`벡터 색인 완료: ${corpus.length}개 (새로 ${toInsert.length}개)`);
    } catch (err) {
        console.error(LOG_PREFIX, 'vector sync failed', err);
        Object.assign(syncState, { chatId, error: String(err?.message || err) });
        if (notify) toastr.error(`벡터 색인 실패: ${err?.message || err}`);
    } finally {
        syncing = false;
        if (!busy) setProgress('');
        updateStatus();
    }
}

async function purgeVectors() {
    try {
        await vectorRequest('purge', { collectionId: collectionId() });
    } catch (err) {
        console.warn(LOG_PREFIX, 'vector purge failed', err);
    }
}

async function denseSearch(query, limit) {
    const s = getSettings();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), s.queryTimeoutMs);
    try {
        const result = await vectorRequest('query', vectorBody({
            collectionId: collectionId(),
            searchText: query,
            topK: limit,
            threshold: s.vectorThreshold / 100,
        }), controller.signal);
        return (result?.metadata || []).map(m => Number(m.hash));
    } finally {
        clearTimeout(timer);
    }
}

// ---------------------------------------------------------------- hybrid recall

function recallQuery(recentChat) {
    const s = getSettings();
    const msgs = (recentChat || []).filter(m => m && !m.is_system).slice(-s.recallScan);
    // Newest message last and repeated, so it weighs most.
    const lines = msgs.map(m => stripMessage(m.mes));
    if (lines.length) lines.push(lines[lines.length - 1]);
    return lines.join('\n').slice(-3000);
}

async function hybridRecall(memory, query, { useDense = true } = {}) {
    const s = getSettings();
    const corpus = buildCorpus(memory);
    if (!corpus.length || !query.trim()) return { results: [], dense: false };
    const pool = Math.max(s.recallTopK * 4, 20);
    const byHash = new Map(corpus.map(x => [x.hash, x]));
    const lists = [];
    let dense = false;
    if (useDense && s.vectorEnabled) {
        try {
            const hashes = await denseSearch(query, pool);
            const items = hashes.map(h => byHash.get(h)).filter(Boolean);
            if (items.length) lists.push(items);
            dense = true;
        } catch (err) {
            console.warn(LOG_PREFIX, 'dense search skipped', err);
        }
    }
    lists.push(bm25Search(corpus, query, pool));

    // Reciprocal rank fusion, then rerank by relevance, importance and recency.
    const fused = new Map();
    for (const list of lists) {
        list.forEach((item, rank) => {
            const entry = fused.get(item.hash) || { item, rrf: 0 };
            entry.rrf += 1 / (60 + rank + 1);
            fused.set(item.hash, entry);
        });
    }
    const maxRrf = Math.max(...[...fused.values()].map(x => x.rrf), 1e-9);
    const wRel = s.relevanceWeight;
    const wImp = s.importanceWeight;
    const wRec = s.recencyWeight;
    const wSum = (wRel + wImp + wRec) || 1;
    const cursor = Math.max(memory.cursor, 1);
    const ranked = [...fused.values()].map(({ item, rrf }) => {
        const relevance = rrf / maxRrf;
        const importance = ((item.importance || 3) - 1) / 4;
        const recency = Math.min(1, Math.max(0, (item.to ?? 0) / cursor));
        return { item, score: (wRel * relevance + wImp * importance + wRec * recency) / wSum, relevance };
    }).sort((a, b) => b.score - a.score);

    const picked = [];
    let tokens = 0;
    const usedRaw = [];
    for (const r of ranked) {
        if (picked.length >= s.recallTopK) break;
        if (r.item.kind === 'raw' && usedRaw.some(([a, b]) => r.item.from <= b + 1 && r.item.to >= a - 1)) continue;
        const cost = estTokens(r.item.display);
        if (picked.length && tokens + cost > s.recallTokenBudget) continue;
        picked.push(r);
        tokens += cost;
        if (r.item.kind === 'raw') usedRaw.push([r.item.from, r.item.to]);
    }
    picked.sort((a, b) => (a.item.from ?? 0) - (b.item.from ?? 0));
    return { results: picked, dense };
}

function recallText(results) {
    if (!results.length) return '';
    const label = { event: 'event', archive: 'earlier note', raw: 'original dialogue' };
    const lines = results.map(({ item }) => {
        const where = item.from === item.to || item.to === undefined ? `#${item.from}` : `#${item.from}-#${item.to}`;
        return `- [${label[item.kind]}, around message ${where}] ${item.display.replace(/\n+/g, ' / ')}`;
    });
    return [
        '<recalled_memories>',
        'Moments from earlier in this story that may be relevant right now. They already happened; use them for continuity only where they fit, and do not mention this list.',
        ...lines,
        '</recalled_memories>',
    ].join('\n');
}

// ---------------------------------------------------------------- injection

function refreshInjection() {
    const s = getSettings();
    const { setExtensionPrompt } = ctx();
    const memory = s.enabled ? getMemory(false) : null;
    if (!memory) {
        setExtensionPrompt(PROMPT_KEY_MAIN, '', POSITIONS.in_prompt, 0);
        setExtensionPrompt(PROMPT_KEY_ANCHOR, '', POSITIONS.in_chat, 0);
        setExtensionPrompt(PROMPT_KEY_RECALL, '', POSITIONS.in_chat, 0);
        return;
    }
    const text = buildMemoryText(memory);
    const position = POSITIONS[s.injectPosition] ?? POSITIONS.in_prompt;
    setExtensionPrompt(PROMPT_KEY_MAIN, text, position, s.injectDepth, false, ROLES[s.injectRole] ?? ROLES.system);
    const anchor = s.anchorEnabled && text ? buildAnchorText(memory) : '';
    setExtensionPrompt(PROMPT_KEY_ANCHOR, anchor, POSITIONS.in_chat, s.anchorDepth, false, ROLES.system);
}

let lastRecall = [];

async function refreshRecall(recentChat) {
    const s = getSettings();
    const { setExtensionPrompt } = ctx();
    const memory = s.enabled && s.recallEnabled ? getMemory(false) : null;
    let text = '';
    if (memory) {
        const { results } = await hybridRecall(memory, recallQuery(recentChat));
        lastRecall = results;
        text = recallText(results);
    }
    setExtensionPrompt(PROMPT_KEY_RECALL, text, POSITIONS.in_chat, s.recallDepth, false, ROLES.system);
}

globalThis.longMemoryInterceptor = async function (chat, _contextSize, _abort, type) {
    if (type === 'quiet') return;
    try {
        refreshInjection();
        await refreshRecall(chat);
    } catch (err) {
        console.error(LOG_PREFIX, 'interceptor failed', err);
    }
};

// ---------------------------------------------------------------- LLM access

let busy = false;
let abortController = null;

async function callModel(systemText, userText) {
    const s = getSettings();
    const c = ctx();
    const messages = s.systemAsUser
        ? [{ role: 'user', content: `${systemText}\n\n${userText}` }]
        : [{ role: 'system', content: systemText }, { role: 'user', content: userText }];
    let lastError = null;
    for (let attempt = 0; attempt <= s.retries; attempt++) {
        if (abortController?.signal.aborted) throw new Error('aborted');
        try {
            let raw;
            if (s.profileId) {
                if (!c.ConnectionManagerRequestService) throw new Error('Connection Manager를 사용할 수 없습니다.');
                const result = await c.ConnectionManagerRequestService.sendRequest(
                    s.profileId,
                    messages,
                    s.maxOutputTokens,
                    { stream: false, signal: abortController?.signal ?? null, extractData: true, includePreset: s.includePreset },
                );
                raw = typeof result === 'string' ? result : (result?.content ?? '');
            } else {
                raw = await c.generateRaw({
                    systemPrompt: s.systemAsUser ? '' : systemText,
                    prompt: s.systemAsUser ? `${systemText}\n\n${userText}` : userText,
                    responseLength: s.maxOutputTokens,
                });
            }
            const cleaned = cleanOutput(raw);
            if (!cleaned) throw new Error('빈 응답');
            return cleaned;
        } catch (err) {
            lastError = err;
            if (abortController?.signal.aborted) throw new Error('aborted');
            console.warn(LOG_PREFIX, `request failed (attempt ${attempt + 1})`, err);
            if (attempt < s.retries) await sleep(1500 * (attempt + 1));
        }
    }
    throw lastError ?? new Error('request failed');
}

function languageRule() {
    const lang = LANGUAGES[getSettings().language] ?? LANGUAGES.chat;
    return `${lang.instruction} Keep proper nouns (names, places, titles) in their original spelling.`;
}

function baseArchivistRules() {
    const { name1 } = ctx();
    return [
        `You are the continuity archivist for a long-running interactive story. "${name1}" is the user's character; everyone else is played by the AI.`,
        'Your memory notes are the only thing that will survive after the original messages are removed, so a future writer must be able to continue the story with perfect continuity from them.',
        '',
        'Rules:',
        '- Record only what the transcript actually shows or states. Do not invent, guess or add commentary. Summarize all story content neutrally as plain narrative facts.',
        '- Be concrete: names, places, dates and times, numbers, objects, injuries and physical states, decisions and their reasons, promises and deadlines, secrets and exactly who knows them, emotional turning points, and changes in relationships.',
        '- Keep cause and effect, and keep unresolved questions unresolved.',
        '- When a character believes something false, record both the belief and the truth, labelled.',
        '- Quote exact words only for vows, names, codewords or lines likely to be referenced later, and keep quotes short.',
        '- Third person, past tense, chronological order.',
        `- Language: ${languageRule()}`,
    ].join('\n');
}

function extraRules() {
    const extra = getSettings().extraRules.trim();
    return extra ? `\n\nAdditional rules from the user:\n${extra}` : '';
}

// ---------------------------------------------------------------- summarize a batch

const EVENTS_FORMAT = `
<events>
[JSON array of the distinct meaningful events in this transcript; can be empty]
</events>

Each event is one retrievable memory: {"text":"<1-3 sentences: what happened, including cause and result>","characters":["..."],"place":"...","items":["..."],"keywords":["..."],"importance":<1-5>}
Extract as many events as actually happened (zero for pure small talk, several for eventful scenes). Make each event self-contained: name the characters instead of using pronouns, so it is understandable on its own months later.
`;

function summarySystemPrompt() {
    const s = getSettings();
    return `${baseArchivistRules()}
- Length: ${DETAIL[s.detail] ?? DETAIL.standard}

Reply with exactly these two blocks and nothing else:

<episode>
title: <short title, at most 10 words>
importance: <1-5. 5 = story-defining (confession, death, betrayal, major reveal, lasting vow); 3 = meaningful development; 1 = filler or small talk>
keywords: <5-12 comma-separated recall cues: names, places, objects, unique terms>
summary:
<the summary>
</episode>

<ledger>
[JSON array of update operations]
</ledger>
${s.eventsEnabled ? EVENTS_FORMAT : ''}
The ledger is a structured fact sheet (shown as <current_ledger>). Operations:
{"op":"set","cat":"<category>","key":"<entity or short label>","value":"<concise current fact>","importance":<1-5>}
  Creates or replaces the entry with this cat + key. Write the complete updated value, merging old and new information.
{"op":"close","cat":"thread","key":"<key>"}  Marks a thread or promise as resolved.
{"op":"delete","cat":"<category>","key":"<key>"}  Removes an entry that is no longer true or relevant.
{"op":"scene","time":"...","place":"...","present":"...","mood":"..."}  The situation at the END of this transcript.

Categories:
- character: appearance, personality, abilities, role and current condition of each character (including the user's character)
- relation: how one character feels about or relates to another; key format "A -> B"
- thread: open plot threads, goals, plans, promises, debts, deadlines, pending questions
- fact: world rules, established facts, secrets and who knows them
- item: significant objects, who holds them, why they matter
- divergence: only for fanfiction; where this story departs from the original work's canon
Reuse existing keys exactly when updating. Only emit operations for things that are new or changed. If nothing changed, output [].${extraRules()}`;
}

function summaryUserPrompt(memory, batch) {
    const parts = [];
    const frame = frameText(memory.frame);
    if (frame) parts.push(`<story_frame>\n${frame}\n</story_frame>`);
    const before = [];
    if (memory.saga.text.trim()) before.push(memory.saga.text.trim());
    const recent = timelineText(memory, { lastN: 2 });
    if (recent) before.push(recent);
    if (before.length) parts.push(`<story_so_far>\n${before.join('\n\n')}\n</story_so_far>`);
    const ledger = ledgerText(memory.ledger, { includeClosed: false });
    parts.push(`<current_ledger>\n${ledger || '(empty)'}\n</current_ledger>`);
    parts.push(`<transcript messages="#${batch.from}-#${batch.to}">\n${batch.lines.join('\n\n')}\n</transcript>`);
    parts.push(`Write the <episode>, <ledger>${getSettings().eventsEnabled ? ' and <events>' : ''} blocks for this transcript now.`);
    return parts.join('\n\n');
}

function applyLedgerOps(memory, ops, atIndex) {
    if (!Array.isArray(ops)) return 0;
    let applied = 0;
    const entries = memory.ledger.entries;
    const find = (cat, key) => entries.find(e => e.cat === cat && e.key.toLowerCase() === String(key).toLowerCase());
    for (const op of ops) {
        if (!op || typeof op !== 'object') continue;
        const kind = String(op.op || '').toLowerCase();
        if (kind === 'scene') {
            for (const field of ['time', 'place', 'present', 'mood']) {
                if (typeof op[field] === 'string' && op[field].trim()) memory.ledger.scene[field] = op[field].trim();
            }
            applied++;
            continue;
        }
        const cat = String(op.cat || '').toLowerCase();
        const key = String(op.key || '').trim();
        if (!CATEGORIES[cat] || !key) continue;
        const existing = find(cat, key);
        if (kind === 'set') {
            const value = String(op.value ?? '').trim();
            if (!value) continue;
            if (existing) {
                existing.value = value;
                existing.importance = clampInt(op.importance, 1, 5, existing.importance);
                existing.updatedAt = atIndex;
                existing.status = 'open';
            } else {
                entries.push({
                    id: newId(),
                    cat,
                    key,
                    value,
                    importance: clampInt(op.importance, 1, 5, 3),
                    pinned: false,
                    status: 'open',
                    updatedAt: atIndex,
                });
            }
            applied++;
        } else if (kind === 'close' && existing) {
            existing.status = 'closed';
            existing.updatedAt = atIndex;
            applied++;
        } else if (kind === 'delete' && existing && !existing.pinned) {
            archiveNode(memory, { id: existing.id, title: `${CATEGORY_EN[cat]}: ${existing.key}`, text: existing.value, keywords: [existing.key], importance: existing.importance, from: existing.updatedAt, to: existing.updatedAt }, 'ledger');
            entries.splice(entries.indexOf(existing), 1);
            applied++;
        }
    }
    return applied;
}

function planBatches(start, end) {
    const s = getSettings();
    const { chat } = ctx();
    const batches = [];
    let current = null;
    for (let i = start; i <= end; i++) {
        const msg = chat[i];
        if (!isSummarizable(msg)) continue;
        const line = messageLine(msg, i);
        const tokens = estTokens(line);
        if (current && (current.lines.length >= s.batchMessages || current.tokens + tokens > s.batchTokens)) {
            batches.push(current);
            current = null;
        }
        if (!current) current = { from: i, to: i, lines: [], indices: [], tokens: 0 };
        current.lines.push(line);
        current.indices.push(i);
        current.tokens += tokens;
        current.to = i;
    }
    if (current) batches.push(current);
    // Each batch covers up to the start of the next one so skipped messages count as processed.
    for (let b = 0; b < batches.length; b++) {
        batches[b].from = b === 0 ? start : batches[b - 1].to + 1;
        batches[b].to = b < batches.length - 1 ? batches[b + 1].from - 1 : end;
    }
    return batches;
}

function toList(value) {
    if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean).slice(0, 12);
    if (typeof value === 'string') return value.split(/[,，、]/).map(v => v.trim()).filter(Boolean).slice(0, 12);
    return [];
}

function parseEvents(block) {
    if (!block || !getSettings().eventsEnabled) return [];
    const parsed = parseJsonLenient(block) || [];
    return parsed
        .filter(e => e && typeof e === 'object' && String(e.text || '').trim())
        .slice(0, 40)
        .map(e => ({
            text: String(e.text).trim(),
            characters: toList(e.characters),
            place: String(e.place || '').trim(),
            items: toList(e.items),
            keywords: toList(e.keywords),
            importance: clampInt(e.importance, 1, 5, 3),
        }));
}

function addEvents(memory, events, batch, episodeId) {
    for (const e of events) {
        memory.events.push({ id: newId(), from: batch.from, to: batch.to, episodeId, ...e });
    }
    const max = getSettings().eventMax;
    if (memory.events.length > max) {
        const ranked = [...memory.events].sort((a, b) => (a.importance - b.importance) || (a.from - b.from));
        const drop = new Set(ranked.slice(0, memory.events.length - max).map(e => e.id));
        memory.events = memory.events.filter(e => !drop.has(e.id));
    }
}

function snapshot(memory) {
    const { history, archive, ...rest } = memory;
    return JSON.stringify(rest);
}

function pushHistory(memory, label) {
    const max = getSettings().maxUndo;
    if (max <= 0) return;
    memory.history.push({ label, at: Date.now(), snap: snapshot(memory) });
    while (memory.history.length > max) memory.history.shift();
}

async function summarizeBatch(memory, batch) {
    const system = summarySystemPrompt();
    const user = summaryUserPrompt(memory, batch);
    let node = null;
    let ops = null;
    let events = [];
    for (let attempt = 0; attempt < 2 && !node; attempt++) {
        const reminder = attempt > 0 ? '\n\nIMPORTANT: your previous reply could not be parsed. Output only the <episode> block and the <ledger> block in the exact format described.' : '';
        const out = await callModel(system, user + reminder);
        node = parseNodeBlock(extractTag(out, 'episode'));
        if (!node && attempt > 0) {
            // Fall back to treating the whole reply as the summary text.
            const fallback = out.replace(/<ledger>[\s\S]*?(<\/ledger>|$)/i, '').trim();
            if (fallback) node = { title: `#${batch.from}-#${batch.to}`, importance: 3, keywords: [], text: fallback };
        }
        ops = parseJsonLenient(extractTag(out, 'ledger') || '');
        events = parseEvents(extractTag(out, 'events'));
    }
    if (!node) throw new Error('요약 응답을 해석하지 못했습니다.');
    return { node, ops, events };
}

// ---------------------------------------------------------------- compress command

function unsummarizedRange() {
    const s = getSettings();
    const { chat } = ctx();
    const memory = getMemory(false);
    const cursor = memory ? memory.cursor : -1;
    const start = cursor + 1;
    const end = chat.length - 1 - s.keepRecent;
    return { start, end, count: Math.max(0, end - start + 1) };
}

function stillSameChat(chatId) {
    return ctx().getCurrentChatId() === chatId;
}

async function runCompress({ all = false } = {}) {
    if (busy) return toastr.warning('이미 작업 중입니다.');
    if (!hasChat()) return toastr.warning('채팅을 먼저 열어주세요.');
    const s = getSettings();
    const { start, end, count } = unsummarizedRange();
    if (count <= 0) return toastr.info(`압축할 메시지가 없습니다. (최근 ${s.keepRecent}개는 원본 유지)`);

    let batches = planBatches(start, end);
    if (!batches.length) return toastr.info('요약할 내용이 없습니다.');
    if (!all) batches = batches.slice(0, 1);
    if (batches.length > 1) {
        const ok = await ctx().Popup.show.confirm(
            '전체 압축',
            `메시지 #${start}~#${end}를 ${batches.length}번에 나눠 요약합니다. API를 ${batches.length}회 이상 호출해요. 진행할까요?`,
        );
        if (!ok) return;
    }

    const chatId = ctx().getCurrentChatId();
    busy = true;
    abortController = new AbortController();
    setBusyUI(true);
    let done = 0;
    try {
        for (const batch of batches) {
            if (abortController.signal.aborted || !stillSameChat(chatId)) break;
            setProgress(`요약 중 ${done + 1}/${batches.length} (#${batch.from}~#${batch.to})`);
            const memory = getMemory(true);
            const { node, ops, events } = await summarizeBatch(memory, batch);
            if (!stillSameChat(chatId)) break;
            pushHistory(memory, `압축 #${batch.from}-#${batch.to}`);
            const episodeId = newId();
            addEvents(memory, events, batch, episodeId);
            memory.timeline.push({
                id: episodeId,
                tier: 'episode',
                from: batch.from,
                to: batch.to,
                title: node.title,
                text: node.text,
                importance: node.importance,
                keywords: node.keywords,
                pinned: false,
                condensed: 0,
            });
            applyLedgerOps(memory, ops, batch.to);
            memory.cursor = batch.to;
            if (s.hideSummarized) {
                const toHide = batch.indices.filter(i => !ctx().chat[i]?.is_system);
                setHidden(toHide, true);
                for (const i of toHide) memory.hiddenRanges = addRange(memory.hiddenRanges, i, i);
                await ctx().saveChat();
            }
            await ctx().saveMetadata();
            done++;
            refreshInjection();
            updateStatus();
            if (s.autoCompact) await compactInternal(chatId, { force: false });
        }
        if (done) toastr.success(`${done}개 구간을 기억에 저장했습니다.`);
        if (done && stillSameChat(chatId)) syncAfter();
    } catch (err) {
        if (String(err?.message) === 'aborted') toastr.info(`중지했습니다. (${done}개 구간 완료)`);
        else {
            console.error(LOG_PREFIX, err);
            toastr.error(`압축 실패: ${err?.message || err}${err?.cause ? ` (${err.cause.message || err.cause})` : ''}`);
        }
    } finally {
        busy = false;
        abortController = null;
        setBusyUI(false);
        setProgress('');
        refreshInjection();
        updateStatus();
    }
}

// ---------------------------------------------------------------- compaction

function compactSystemPrompt(task) {
    return `${baseArchivistRules()}

${task}${extraRules()}`;
}

async function stepCondense(memory) {
    const s = getSettings();
    const episodes = memory.timeline.filter(n => n.tier === 'episode');
    const protectedIds = new Set(episodes.slice(-s.protectRecent).map(n => n.id));
    const candidates = memory.timeline
        .filter(n => !n.pinned && !protectedIds.has(n.id) && (n.condensed || 0) < 2 && n.importance <= 3 && estTokens(n.text) > 60)
        .sort((a, b) => (a.importance - b.importance) || (a.from - b.from))
        .slice(0, 8);
    if (!candidates.length) return false;
    const task = `Task: condense each memory note below to about 40% of its length (at least one full sentence). These are the less important parts of the story. Keep only details with lasting consequences: who, what changed, promises, secrets, injuries, items, relationship shifts. Drop atmosphere and repetition.

Reply with one block per note, using the same id, and nothing else:
<note id="ID">condensed text</note>`;
    const user = candidates
        .map(n => `<note id="${n.id}" importance="${n.importance}" messages="#${n.from}-#${n.to}">\n${n.text}\n</note>`)
        .join('\n\n');
    const out = await callModel(compactSystemPrompt(task), user);
    const results = extractAllTags(out, 'note');
    let changed = 0;
    for (const { id, text } of results) {
        const node = memory.timeline.find(n => n.id === id);
        if (!node || !text || text.length >= node.text.length) continue;
        if (!node.condensed) archiveNode(memory, node);
        node.text = text;
        node.condensed = (node.condensed || 0) + 1;
        changed++;
    }
    if (!changed) {
        // Prevent retrying the same notes forever when the model refuses to shorten them.
        for (const n of candidates) n.condensed = 2;
    }
    return true;
}

async function stepChapter(memory, force) {
    const s = getSettings();
    const episodes = memory.timeline.filter(n => n.tier === 'episode');
    if (!force && episodes.length <= s.maxEpisodes) return false;
    const protectedIds = new Set(episodes.slice(-s.protectRecent).map(n => n.id));
    let run = [];
    for (const node of memory.timeline) {
        const usable = node.tier === 'episode' && !node.pinned && !protectedIds.has(node.id);
        if (usable) {
            run.push(node);
            if (run.length >= s.chapterSize) break;
        } else if (run.length >= 2) {
            break;
        } else {
            run = [];
        }
    }
    if (run.length < 2) return false;
    const task = `Task: merge the consecutive episodes below into one chapter summary. Keep every detail from importance 4-5 episodes, keep the essentials of the rest, keep chronological order and cause and effect. Aim for about half of their combined length.

Reply with exactly this block and nothing else:
<chapter>
title: <short title, at most 10 words>
keywords: <5-15 comma-separated recall cues>
summary:
<the chapter summary>
</chapter>`;
    const user = run
        .map(n => `<episode importance="${n.importance}" messages="#${n.from}-#${n.to}" title="${esc(n.title)}">\n${n.text}\n</episode>`)
        .join('\n\n');
    const out = await callModel(compactSystemPrompt(task), user);
    const parsed = parseNodeBlock(extractTag(out, 'chapter'));
    if (!parsed) throw new Error('챕터 병합 응답을 해석하지 못했습니다.');
    for (const n of run) archiveNode(memory, n);
    const chapter = {
        id: newId(),
        tier: 'chapter',
        from: run[0].from,
        to: run[run.length - 1].to,
        title: parsed.title,
        text: parsed.text,
        importance: Math.max(...run.map(n => n.importance)),
        keywords: [...new Set([...parsed.keywords, ...run.flatMap(n => n.keywords || [])])].slice(0, 24),
        pinned: false,
        condensed: 0,
    };
    const firstIdx = memory.timeline.indexOf(run[0]);
    memory.timeline.splice(firstIdx, run.length, chapter);
    return true;
}

async function stepSaga(memory, force) {
    const s = getSettings();
    const chapters = memory.timeline.filter(n => n.tier === 'chapter');
    if (!force && chapters.length <= s.maxChapters) return false;
    const run = [];
    for (const node of memory.timeline) {
        if (node.tier === 'chapter' && !node.pinned && run.length < 3) run.push(node);
        else break;
    }
    if (!run.length) return false;
    const task = `Task: update "the story so far" by folding in the chapters below, which come right after it in time. Keep the result under ${s.sagaMaxWords} words. When space is tight, compress the oldest and least important material first, but never drop: who the characters are to each other, major turning points, lasting promises and secrets, deaths, and anything still unresolved.

Reply with exactly this block and nothing else:
<saga>
<the updated story so far>
</saga>`;
    const user = [
        `<story_so_far>\n${memory.saga.text.trim() || '(empty)'}\n</story_so_far>`,
        ...run.map(n => `<chapter messages="#${n.from}-#${n.to}" title="${esc(n.title)}">\n${n.text}\n</chapter>`),
    ].join('\n\n');
    const out = await callModel(compactSystemPrompt(task), user);
    const saga = extractTag(out, 'saga');
    if (!saga) throw new Error('전체 줄거리 갱신 응답을 해석하지 못했습니다.');
    for (const n of run) archiveNode(memory, n);
    memory.saga = { text: saga, coversTo: run[run.length - 1].to };
    memory.timeline.splice(0, run.length);
    return true;
}

function pruneLedger(memory) {
    const s = getSettings();
    const before = memory.ledger.entries.length;
    memory.ledger.entries = memory.ledger.entries.filter(e => {
        if (e.pinned) return true;
        const stale = memory.cursor - (e.updatedAt ?? memory.cursor) > s.staleAfter;
        const drop = (e.status === 'closed' && e.importance <= 2) || (e.importance <= 1 && stale);
        if (drop) {
            archiveNode(memory, { id: e.id, title: `${CATEGORY_EN[e.cat] || e.cat}: ${e.key}`, text: e.value, keywords: [e.key], importance: e.importance, from: e.updatedAt, to: e.updatedAt }, 'ledger');
        }
        return !drop;
    });
    return memory.ledger.entries.length < before;
}

async function compactInternal(chatId, { force }) {
    const s = getSettings();
    let didAnything = false;
    for (let iteration = 0; iteration < 20; iteration++) {
        if (abortController?.signal.aborted || !stillSameChat(chatId)) break;
        const memory = getMemory(true);
        const overBudget = estTokens(buildMemoryText(memory)) > s.memoryBudget;
        const forceThisRound = force && iteration === 0;
        let step = null;
        const structural = memory.timeline.filter(n => n.tier === 'episode').length > s.maxEpisodes
            || memory.timeline.filter(n => n.tier === 'chapter').length > s.maxChapters;
        if (!structural && !overBudget && !forceThisRound) break;

        setProgress('덜 중요한 기억 정리 중...');
        pushHistory(memory, '기억 정리');
        if (pruneLedger(memory) && !structural) step = 'prune';
        if (!step && await stepChapter(memory, false)) step = 'chapter';
        if (!step && await stepSaga(memory, false)) step = 'saga';
        if (!step && (overBudget || forceThisRound) && await stepCondense(memory)) step = 'condense';
        if (!step && (overBudget || forceThisRound) && await stepChapter(memory, true)) step = 'chapter';
        if (!step && (overBudget || forceThisRound) && await stepSaga(memory, true)) step = 'saga';
        if (!step) {
            memory.history.pop();
            break;
        }
        if (!stillSameChat(chatId)) break;
        didAnything = true;
        await ctx().saveMetadata();
        refreshInjection();
        updateStatus();
    }
    return didAnything;
}

async function runCompact() {
    if (busy) return toastr.warning('이미 작업 중입니다.');
    const memory = getMemory(false);
    if (!memory || (!memory.timeline.length && !memory.ledger.entries.length)) return toastr.info('정리할 기억이 없습니다.');
    const chatId = ctx().getCurrentChatId();
    busy = true;
    abortController = new AbortController();
    setBusyUI(true);
    try {
        const did = await compactInternal(chatId, { force: true });
        if (did) syncAfter();
        toastr[did ? 'success' : 'info'](did ? '덜 중요한 기억을 압축했습니다.' : '더 압축할 기억이 없습니다.');
    } catch (err) {
        if (String(err?.message) === 'aborted') toastr.info('중지했습니다.');
        else {
            console.error(LOG_PREFIX, err);
            toastr.error(`정리 실패: ${err?.message || err}`);
        }
    } finally {
        busy = false;
        abortController = null;
        setBusyUI(false);
        setProgress('');
        refreshInjection();
        updateStatus();
    }
}

// ---------------------------------------------------------------- undo / reset

async function runUndo() {
    if (busy) return toastr.warning('작업 중에는 되돌릴 수 없습니다.');
    const memory = getMemory(false);
    const last = memory?.history?.pop();
    if (!last) return toastr.info('되돌릴 작업이 없습니다.');
    const previous = JSON.parse(last.snap);
    const prevHidden = new Set(rangesToList(previous.hiddenRanges));
    const toUnhide = rangesToList(memory.hiddenRanges).filter(i => !prevHidden.has(i));
    setHidden(toUnhide, false);
    for (const key of Object.keys(previous)) memory[key] = previous[key];
    if (toUnhide.length) await ctx().saveChat();
    await ctx().saveMetadata();
    refreshInjection();
    updateStatus();
    toastr.success(`되돌림: ${last.label}`);
    syncAfter();
}

async function runReset() {
    if (busy) return toastr.warning('작업 중입니다.');
    const memory = getMemory(false);
    if (!memory) return toastr.info('기억이 없습니다.');
    const ok = await ctx().Popup.show.confirm('기억 초기화', '이 채팅의 모든 요약을 지우고 숨긴 원본 메시지를 다시 보이게 합니다. 작품/캐릭터 설정은 유지돼요.');
    if (!ok) return;
    const unhide = rangesToList(memory.hiddenRanges);
    setHidden(unhide, false);
    const frame = memory.frame;
    const fresh = emptyMemory();
    fresh.frame = frame;
    ctx().chatMetadata[META_KEY] = fresh;
    await purgeVectors();
    if (unhide.length) await ctx().saveChat();
    await ctx().saveMetadata();
    refreshInjection();
    updateStatus();
    toastr.success('초기화했습니다.');
}

function syncAfter() {
    // Runs in the background once the current job has released the busy flag.
    setTimeout(() => syncVectors(), 0);
}

function runStop() {
    if (abortController) {
        abortController.abort();
        toastr.info('중지 요청을 보냈습니다.');
    }
}

// ---------------------------------------------------------------- settings panel

function profileOptions(selected) {
    const profiles = ctx().extensionSettings.connectionManager?.profiles ?? [];
    const opts = [`<option value="">현재 연결 사용</option>`];
    for (const p of [...profiles].sort((a, b) => String(a.name).localeCompare(String(b.name)))) {
        opts.push(`<option value="${esc(p.id)}" ${p.id === selected ? 'selected' : ''}>${esc(p.name)}</option>`);
    }
    return opts.join('');
}

function selectOptions(map, selected, useLabelKey = true) {
    return Object.entries(map)
        .map(([value, label]) => `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(useLabelKey && typeof label === 'object' ? label.label : label)}</option>`)
        .join('');
}

const UNITS = {
    keepRecent: '개', batchMessages: '개', batchTokens: '토큰', maxOutputTokens: '토큰', retries: '회',
    remindAt: '개', memoryBudget: '토큰', protectRecent: '개', maxEpisodes: '개', chapterSize: '개',
    maxChapters: '개', sagaMaxWords: '단어', staleAfter: '메시지', archiveMax: '개', maxUndo: '회',
    recallTopK: '개', recallTokenBudget: '토큰', recallScan: '개', vectorThreshold: '%', rawChunkMessages: '개',
    rawChunkChars: '자', eventMax: '개', queryTimeoutMs: 'ms',
};

function numberRow(key, label, min, max, hint = '') {
    const unit = UNITS[key];
    return `
<div class="lm-field">
  <div class="lm-field-text"><span class="lm-field-label">${label}</span>${hint ? `<span class="lm-hint">${hint}</span>` : ''}</div>
  <span class="lm-num-wrap"><input type="number" class="text_pole lm-num" data-lm-setting="${key}" min="${min}" max="${max}" step="1" aria-label="${esc(label)}">${unit ? `<span class="lm-unit">${unit}</span>` : ''}</span>
</div>`;
}

function checkRow(key, label, hint = '') {
    return `
<label class="lm-field lm-field-toggle">
  <div class="lm-field-text"><span class="lm-field-label">${label}</span>${hint ? `<span class="lm-hint">${hint}</span>` : ''}</div>
  <span class="lm-switch"><input type="checkbox" data-lm-setting="${key}" aria-label="${esc(label)}"><span class="lm-switch-track" aria-hidden="true"></span></span>
</label>`;
}

function selectRow(key, label, map, selected, hint = '', id = '') {
    const attr = id ? `id="${id}"` : `data-lm-setting="${key}"`;
    return `
<div class="lm-field">
  <div class="lm-field-text"><span class="lm-field-label">${label}</span>${hint ? `<span class="lm-hint">${hint}</span>` : ''}</div>
  <select class="text_pole lm-select" ${attr} aria-label="${esc(label)}">${map}</select>
</div>`;
}

function textRow(key, label, hint = '', placeholder = '') {
    return `
<div class="lm-field lm-field-stack">
  <div class="lm-field-text"><span class="lm-field-label">${label}</span>${hint ? `<span class="lm-hint">${hint}</span>` : ''}</div>
  <input class="text_pole" data-lm-setting="${key}" placeholder="${esc(placeholder)}" aria-label="${esc(label)}">
</div>`;
}

// Picks the day (sand) or night (dusk) palette from the brightness of the ST theme text.
function applyThemeMode(el) {
    if (!el) return;
    let night = true;
    try {
        const m = getComputedStyle(document.body).color.match(/\d+(\.\d+)?/g);
        if (m) {
            const [r, g, b] = m.map(Number);
            night = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.5;
        }
    } catch {
        // keep night as a safe default
    }
    el.dataset.lmMode = night ? 'night' : 'day';
}

function spineSegments(memory, total, keepRecent) {
    const segments = [];
    if (memory?.saga.text && memory.saga.coversTo >= 0) {
        segments.push({ kind: 'saga', from: 0, to: memory.saga.coversTo, label: '지금까지의 이야기' });
    }
    for (const node of memory?.timeline || []) {
        segments.push({ kind: node.tier, from: node.from, to: node.to, label: node.title });
    }
    const cursor = memory?.cursor ?? -1;
    const recentStart = Math.max(cursor + 1, total - keepRecent);
    if (recentStart > cursor + 1) segments.push({ kind: 'pending', from: cursor + 1, to: recentStart - 1, label: '아직 요약 안 됨' });
    if (total > recentStart) segments.push({ kind: 'recent', from: recentStart, to: total - 1, label: '최근 원본 (그대로 전달)' });
    segments.sort((a, b) => a.from - b.from);
    return segments;
}

let impGroupSeq = 0;

function impControl(value) {
    const name = `lm_imp_${++impGroupSeq}`;
    const options = [1, 2, 3, 4, 5]
        .map(v => `<label title="중요도 ${v}"><input type="radio" name="${name}" value="${v}" ${v === value ? 'checked' : ''}><span>${v}</span></label>`)
        .join('');
    return `<div class="lm-imp" role="radiogroup" aria-label="중요도">${options}</div>`;
}

function readImp(row) {
    return clampInt(row.querySelector('.lm-imp input:checked')?.value, 1, 5, 3);
}

function iconToggle(cls, icon, title, checked) {
    return `<label class="lm-icon-toggle" title="${title}"><input type="checkbox" class="${cls}" ${checked ? 'checked' : ''} aria-label="${title}"><i class="fa-solid ${icon}"></i></label>`;
}

function deleteButton() {
    return '<button type="button" class="lm-icon-btn lm-del" title="삭제 (다시 누르면 취소)" aria-label="삭제"><i class="fa-solid fa-trash-can"></i></button>';
}

function ledgerGroups(memory) {
    return Object.entries(CATEGORIES).map(([cat, label]) => {
        const entries = memory.ledger.entries.filter(e => e.cat === cat);
        return `
<div class="lm-group" data-cat="${cat}">
  <div class="lm-group-head">
    <i class="lm-cat-dot lm-cat-${cat}" aria-hidden="true"></i>
    <span class="lm-group-name">${label}</span>
    <span class="lm-count">${entries.length}</span>
    <span class="lm-spacer"></span>
    <button type="button" class="lm-icon-btn lm-add-entry" data-cat="${cat}" title="${label} 항목 추가"><i class="fa-solid fa-plus"></i></button>
  </div>
  <div class="lm-group-list">${entries.map(entryRow).join('')}</div>
</div>`;
    }).join('');
}

function settingsHtml() {
    const s = getSettings();
    return `
<div id="lm_settings" class="extension_settings lm-root">
  <div class="inline-drawer">
    <div class="inline-drawer-toggle inline-drawer-header">
      <b>🐘 코끼리를 생각하지마</b>
      <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
    </div>
    <div class="inline-drawer-content">
      <div class="lm-head">
        <div class="lm-mascot">${ELEPHANT_SVG}</div>
        <div class="lm-head-title">
          <span class="lm-head-name">코끼리를 생각하지마</span>
          <span class="lm-head-sub">코끼리는 잊지 않아요. 지난 이야기를 압축해 계속 기억합니다</span>
        </div>
        <label class="lm-switch lm-switch-lg" title="기억을 AI 프롬프트에 넣기">
          <input type="checkbox" data-lm-setting="enabled" aria-label="기억 사용">
          <span class="lm-switch-track" aria-hidden="true"></span>
        </label>
      </div>

      <div id="lm_status" class="lm-status" aria-live="polite"></div>

      <div class="lm-actions">
        <button type="button" class="menu_button lm-btn lm-btn-primary" id="lm_btn_compress" title="미요약 메시지에서 한 구간을 요약합니다">
          <i class="fa-solid fa-feather-pointed"></i><span>압축</span><span class="lm-badge" id="lm_badge" hidden></span>
        </button>
        <button type="button" class="menu_button lm-btn" id="lm_btn_all" title="남은 미요약 메시지를 처음부터 전부 요약합니다">
          <i class="fa-solid fa-layer-group"></i><span>전체 압축</span>
        </button>
        <button type="button" class="menu_button lm-btn lm-btn-stop" id="lm_btn_stop" title="진행 중인 작업을 멈춥니다">
          <i class="fa-solid fa-stop"></i><span>중지</span>
        </button>
      </div>
      <div class="lm-actions lm-actions-sub">
        <button type="button" class="menu_button lm-btn lm-btn-quiet" id="lm_btn_manager"><i class="fa-solid fa-book-open"></i><span>기억장</span></button>
        <button type="button" class="menu_button lm-btn lm-btn-quiet" id="lm_btn_compact" title="덜 중요한 기억부터 줄이고 오래된 것을 합칩니다"><i class="fa-solid fa-wand-magic-sparkles"></i><span>정리</span></button>
        <button type="button" class="menu_button lm-btn lm-btn-quiet" id="lm_btn_undo"><i class="fa-solid fa-rotate-left"></i><span>되돌리기</span></button>
      </div>
      <div id="lm_progress" class="lm-progress" aria-live="polite"></div>

      <details class="lm-fold" id="lm_fold">
        <summary class="lm-fold-head"><i class="fa-solid fa-sliders"></i><span>설정</span><i class="fa-solid fa-chevron-down lm-fold-chev"></i></summary>
      <div class="lm-tabs lm-tabs-pill" role="tablist">
        <button type="button" class="lm-tab active" data-lm-tab="summary" role="tab"><i class="fa-solid fa-feather"></i><span>요약</span></button>
        <button type="button" class="lm-tab" data-lm-tab="range" role="tab"><i class="fa-solid fa-ruler-horizontal"></i><span>범위</span></button>
        <button type="button" class="lm-tab" data-lm-tab="tidy" role="tab"><i class="fa-solid fa-broom"></i><span>정리</span></button>
        <button type="button" class="lm-tab" data-lm-tab="recall" role="tab"><i class="fa-solid fa-lightbulb"></i><span>회상</span></button>
        <button type="button" class="lm-tab" data-lm-tab="inject" role="tab"><i class="fa-solid fa-puzzle-piece"></i><span>주입</span></button>
      </div>
      <div class="lm-panes">

      <section class="lm-pane active" data-lm-pane="summary" role="tabpanel">
        ${selectRow('', '요약 모델', profileOptions(s.profileId), s.profileId, 'Connection Manager에 저장한 프로필. 비우면 지금 쓰는 API', 'lm_profile')}
        ${selectRow('language', '요약 언어', selectOptions(LANGUAGES, s.language), s.language, 'English가 토큰을 가장 적게 씁니다')}
        ${selectRow('detail', '상세도', selectOptions({ concise: '간결', standard: '보통', detailed: '상세' }, s.detail), s.detail, '상세할수록 오래 기억하지만 토큰이 늘어요')}
        ${numberRow('maxOutputTokens', '응답 최대 토큰', 256, 131072, '요약 한 번에 받을 최대 길이')}
        ${numberRow('retries', '재시도 횟수', 0, 10, '요청이 실패하면 다시 시도')}
        ${checkRow('includePreset', '프로필의 샘플링 설정 사용')}
        ${checkRow('systemAsUser', '지시를 유저 메시지로 보내기', 'system 역할을 받지 않는 모델일 때만 켜세요')}
        <div class="lm-field lm-field-stack">
          <div class="lm-field-text"><span class="lm-field-label">추가 요약 규칙</span><span class="lm-hint">요약 AI에게 덧붙일 지시. 영어로 쓰면 가장 정확해요</span></div>
          <textarea class="text_pole lm-textarea" data-lm-setting="extraRules" rows="3" placeholder="Always track the in-story date."></textarea>
        </div>
        <div class="lm-pane-foot"><button type="button" class="lm-link-btn lm-reset-pane"><i class="fa-solid fa-rotate"></i>이 탭 기본값으로</button></div>
      </section>

      <section class="lm-pane" data-lm-pane="range" role="tabpanel">
        ${numberRow('keepRecent', '최근 원본 유지', 0, 5000, '이만큼의 최근 메시지는 요약하지 않고 그대로 둡니다')}
        ${numberRow('batchMessages', '한 구간 최대 메시지', 1, 5000, '압축 한 번에 묶을 메시지 수')}
        ${numberRow('batchTokens', '한 구간 최대 토큰', 1000, 2000000, '요약 모델의 컨텍스트 안에서 크게 잡으면 호출이 줄어요')}
        ${checkRow('hideSummarized', '요약한 원본은 AI에게서 숨기기', '채팅창에는 흐리게 남고, 되돌리기로 복구됩니다')}
        ${checkRow('stripHtml', 'HTML과 상태창 태그 빼고 요약')}
        ${numberRow('remindAt', '압축 알림 기준', 0, 100000, '미요약이 이만큼 쌓이면 알려줍니다. 0이면 끔')}
        <div class="lm-pane-foot"><button type="button" class="lm-link-btn lm-reset-pane"><i class="fa-solid fa-rotate"></i>이 탭 기본값으로</button></div>
      </section>

      <section class="lm-pane" data-lm-pane="tidy" role="tabpanel">
        ${numberRow('memoryBudget', '기억 예산 (토큰)', 500, 2000000, '넘으면 덜 중요한 기억부터 압축합니다')}
        ${checkRow('autoCompact', '압축 후 예산을 넘으면 자동 정리')}
        ${numberRow('protectRecent', '최신 에피소드 보호', 0, 1000, '가장 최근 에피소드는 줄이지 않아요')}
        ${numberRow('maxEpisodes', '에피소드 최대 개수', 2, 10000, '넘으면 오래된 것부터 챕터로 합칩니다')}
        ${numberRow('chapterSize', '챕터당 에피소드', 2, 100)}
        ${numberRow('maxChapters', '챕터 최대 개수', 1, 10000, '넘으면 지금까지의 이야기로 합칩니다')}
        ${numberRow('sagaMaxWords', '지금까지의 이야기 최대 단어', 200, 100000)}
        ${numberRow('staleAfter', '오래된 사소한 기록 정리', 10, 1000000, '중요도 1인 기록이 이 메시지 수만큼 갱신되지 않으면 보관함으로')}
        ${numberRow('archiveMax', '보관함 최대 항목', 0, 100000)}
        ${numberRow('maxUndo', '되돌리기 기록', 0, 50)}
        <div class="lm-pane-foot"><button type="button" class="lm-link-btn lm-reset-pane"><i class="fa-solid fa-rotate"></i>이 탭 기본값으로</button></div>
      </section>

      <section class="lm-pane" data-lm-pane="recall" role="tabpanel">
        ${checkRow('recallEnabled', '회상 사용', '응답 직전에 지금 장면과 관련된 과거를 찾아 넣습니다')}
        ${checkRow('eventsEnabled', '요약할 때 사건도 따로 추출', '누가, 어디서, 무엇을, 왜 — 검색의 기본 단위가 됩니다')}
        ${checkRow('vectorEnabled', '의미 검색 사용', '끄면 키워드 검색만 합니다')}
        ${checkRow('indexRawMessages', '요약된 원본 대사도 검색', '정확한 대사를 그대로 떠올릴 수 있어요')}
        ${selectRow('embedSource', '임베딩 소스', selectOptions(EMBED_SOURCES, s.embedSource), s.embedSource, 'API 키는 ST에 저장된 것을 씁니다')}
        ${textRow('embedModel', '임베딩 모델', '비우면 ST 벡터 저장소 설정의 모델', '예: bge-m3')}
        ${textRow('embedApiUrl', '임베딩 서버 주소', 'Ollama, llama.cpp, vLLM만 해당. 비우면 ST 설정', 'http://127.0.0.1:11434')}
        <div class="lm-actions lm-actions-inline">
          <button type="button" class="menu_button lm-btn lm-btn-quiet" id="lm_btn_reindex"><i class="fa-solid fa-database"></i><span>색인 맞추기</span></button>
          <button type="button" class="menu_button lm-btn lm-btn-quiet" id="lm_btn_search"><i class="fa-solid fa-magnifying-glass"></i><span>검색 테스트</span></button>
        </div>
        <details class="lm-more">
          <summary>세부 조정</summary>
          ${numberRow('recallTopK', '한 번에 회상할 항목', 0, 100)}
          ${numberRow('recallTokenBudget', '회상 토큰 상한', 100, 200000)}
          ${numberRow('recallScan', '검색에 쓸 최근 메시지', 1, 50)}
          ${numberRow('vectorThreshold', '유사도 하한 (%)', 0, 100, '높이면 확실히 비슷한 것만 가져와요')}
          ${numberRow('relevanceWeight', '정렬 가중치: 관련도', 0, 100)}
          ${numberRow('importanceWeight', '정렬 가중치: 중요도', 0, 100)}
          ${numberRow('recencyWeight', '정렬 가중치: 최근성', 0, 100)}
          ${numberRow('rawChunkMessages', '원본 묶음 크기', 1, 20, '원본 대사를 몇 메시지씩 묶어 검색할지')}
          ${numberRow('rawChunkChars', '원본 묶음 최대 글자', 200, 20000)}
          ${numberRow('eventMax', '사건 최대 보관', 10, 1000000)}
          ${numberRow('queryTimeoutMs', '검색 시간 제한 (ms)', 500, 120000, '넘으면 키워드 검색 결과만 씁니다')}
        </details>
        <div class="lm-pane-foot"><button type="button" class="lm-link-btn lm-reset-pane"><i class="fa-solid fa-rotate"></i>이 탭 기본값으로</button></div>
      </section>

      <section class="lm-pane" data-lm-pane="inject" role="tabpanel">
        ${selectRow('injectPosition', '기억 넣을 위치', selectOptions({ in_prompt: '캐릭터 설정 뒤', before_prompt: '프롬프트 맨 앞', in_chat: '채팅 안 (깊이 지정)' }, s.injectPosition), s.injectPosition, '대부분 캐릭터 설정 뒤가 가장 안정적이에요')}
        ${numberRow('injectDepth', '채팅 안 깊이', 0, 10000, '위치가 채팅 안일 때만 사용')}
        ${selectRow('injectRole', '역할', selectOptions({ system: 'system', user: 'user', assistant: 'assistant' }, s.injectRole), s.injectRole)}
        ${checkRow('anchorEnabled', '현재 상태 리마인더', '최근 대화 근처에 짧게 넣어 긴 채팅에서도 흐름을 놓치지 않게 합니다')}
        ${numberRow('anchorDepth', '리마인더 깊이', 0, 10000)}
        ${numberRow('recallDepth', '회상 넣을 깊이', 0, 10000, '0이면 마지막 메시지 바로 뒤')}
        <div class="lm-pane-foot"><button type="button" class="lm-link-btn lm-reset-pane"><i class="fa-solid fa-rotate"></i>이 탭 기본값으로</button></div>
      </section>
      </div>
      </details>
    </div>
  </div>
</div>`;
}

function bindSettings(root) {
    const s = getSettings();
    const { saveSettingsDebounced } = ctx();
    root.querySelectorAll('[data-lm-setting]').forEach(el => {
        const key = el.dataset.lmSetting;
        if (el.type === 'checkbox') el.checked = !!s[key];
        else el.value = s[key];
        el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input', () => {
            if (el.type === 'checkbox') s[key] = el.checked;
            else if (el.type === 'number') {
                const min = Number(el.min);
                const max = Number(el.max);
                s[key] = clampInt(el.value, min, max, defaultSettings[key]);
            } else s[key] = el.value;
            saveSettingsDebounced();
            refreshInjection();
            updateStatus();
        });
        if (el.type === 'number') {
            el.addEventListener('blur', () => { el.value = s[key]; });
        }
    });
    const fold = root.querySelector('#lm_fold');
    fold.open = !!s.uiSettingsOpen;
    fold.addEventListener('toggle', () => {
        s.uiSettingsOpen = fold.open;
        saveSettingsDebounced();
    });
    root.querySelectorAll('.lm-reset-pane').forEach(btn => {
        btn.addEventListener('click', async () => {
            const pane = btn.closest('.lm-pane');
            const ok = await ctx().Popup.show.confirm('기본값으로 되돌리기', '이 탭의 설정을 처음 값으로 되돌릴까요?');
            if (!ok) return;
            pane.querySelectorAll('[data-lm-setting]').forEach(el => {
                const key = el.dataset.lmSetting;
                s[key] = defaultSettings[key];
                if (el.type === 'checkbox') el.checked = !!s[key];
                else el.value = s[key];
            });
            saveSettingsDebounced();
            refreshInjection();
            updateStatus();
            toastr.success('이 탭을 기본값으로 되돌렸어요.');
        });
    });
    root.querySelectorAll('.lm-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const name = tab.dataset.lmTab;
            root.querySelectorAll('.lm-tab').forEach(t => t.classList.toggle('active', t === tab));
            root.querySelectorAll('.lm-pane').forEach(p => p.classList.toggle('active', p.dataset.lmPane === name));
        });
    });
    const profile = root.querySelector('#lm_profile');
    profile.addEventListener('focus', () => {
        profile.innerHTML = profileOptions(s.profileId);
    });
    profile.addEventListener('change', () => {
        s.profileId = profile.value;
        saveSettingsDebounced();
    });
    root.querySelector('#lm_btn_compress').addEventListener('click', () => runCompress({ all: false }));
    root.querySelector('#lm_btn_all').addEventListener('click', () => runCompress({ all: true }));
    root.querySelector('#lm_btn_compact').addEventListener('click', () => runCompact());
    root.querySelector('#lm_btn_manager').addEventListener('click', () => openManager());
    root.querySelector('#lm_btn_undo').addEventListener('click', () => runUndo());
    root.querySelector('#lm_btn_stop').addEventListener('click', () => runStop());
    root.querySelector('#lm_btn_reindex').addEventListener('click', () => syncVectors({ notify: true }));
    root.querySelector('#lm_btn_search').addEventListener('click', () => openSearchTest());
}

function setBusyUI(isBusy) {
    const root = document.getElementById('lm_settings');
    if (!root) return;
    root.classList.toggle('lm-busy', isBusy);
    root.querySelectorAll('.lm-btn').forEach(btn => {
        if (btn.id === 'lm_btn_stop' || btn.id === 'lm_btn_manager' || btn.id === 'lm_btn_search') return;
        btn.disabled = isBusy;
        btn.classList.toggle('lm-disabled', isBusy);
    });
}

function setProgress(text) {
    const el = document.getElementById('lm_progress');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('active', !!text);
}

let remindedFor = null;

function vectorStatusText() {
    const s = getSettings();
    if (!s.recallEnabled) return '회상 꺼짐';
    if (!s.vectorEnabled) return '키워드 검색만 사용';
    if (syncing) return '색인 맞추는 중';
    if (syncState.chatId !== ctx().getCurrentChatId()) return '색인 확인 전';
    if (syncState.error) return `<span class="lm-warn" title="${esc(syncState.error)}">벡터 오류, 키워드 검색으로 대체 중</span>`;
    return `벡터 색인 ${syncState.indexed.toLocaleString()}개`;
}

function updateStatus() {
    const el = document.getElementById('lm_status');
    if (!el) return;
    if (!hasChat()) {
        el.innerHTML = '<div class="lm-empty">채팅을 열면 코끼리가 이 채팅에서 기억한 것들을 보여줄게요.</div>';
        const badge = document.getElementById('lm_badge');
        if (badge) badge.hidden = true;
        return;
    }
    const s = getSettings();
    const memory = getMemory(false);
    const { count } = unsummarizedRange();
    const total = ctx().chat.length;
    const tokens = memory ? estTokens(buildMemoryText(memory)) : 0;
    const episodes = memory?.timeline.filter(n => n.tier === 'episode').length ?? 0;
    const chapters = memory?.timeline.filter(n => n.tier === 'chapter').length ?? 0;
    const recent = Math.min(total, s.keepRecent);
    const over = tokens > s.memoryBudget;
    const pct = Math.min(100, Math.round((tokens / Math.max(1, s.memoryBudget)) * 100));
    const segments = spineSegments(memory, total, s.keepRecent);
    const spine = segments.length
        ? segments.map(seg => `<span class="lm-seg lm-seg-${seg.kind}" style="flex-grow:${seg.to - seg.from + 1}" title="${esc(seg.label)} (#${seg.from}~#${seg.to})"></span>`).join('')
        : '<span class="lm-seg lm-seg-empty" style="flex-grow:1"></span>';
    const cursor = memory?.cursor ?? -1;
    const walkerPct = total > 0 ? Math.min(100, Math.max(0, ((cursor + 1) / total) * 100)) : 0;
    applyThemeMode(document.getElementById('lm_settings'));
    const legend = [
        memory?.saga.text ? { kind: 'saga', text: '지금까지의 이야기' } : null,
        chapters ? { kind: 'chapter', text: `챕터 ${chapters}` } : null,
        episodes ? { kind: 'episode', text: `에피소드 ${episodes}` } : null,
        count ? { kind: 'pending', text: `미요약 ${count.toLocaleString()}` } : null,
        recent ? { kind: 'recent', text: `최근 원본 ${recent}` } : null,
    ].filter(Boolean).map(l => `<span class="lm-legend-item"><i class="lm-swatch lm-seg-${l.kind}"></i>${l.text}</span>`).join('');

    el.innerHTML = `
      <div class="lm-spine-wrap">
        ${cursor >= 0 ? `<div class="lm-walker" style="left:${walkerPct}%" title="#${cursor}까지 기억함">${ELEPHANT_SVG}</div>` : ''}
        <div class="lm-spine" role="img" aria-label="메시지 ${total}개 중 #${cursor}까지 기억됨">${spine}</div>
      </div>
      <div class="lm-spine-scale">
        <span>#0</span>
        <span class="lm-spine-cursor">${cursor >= 0 ? `#${cursor}까지 기억함` : '아직 기억 없음'}</span>
        <span>#${Math.max(0, total - 1)}</span>
      </div>
      <div class="lm-legend">${legend || '<span class="lm-hint">대화가 쌓이면 압축을 눌러 코끼리에게 첫 기억을 만들어 주세요.</span>'}</div>
      <div class="lm-meter-row">
        <span class="lm-meter-label">기억 크기</span>
        <div class="lm-meter ${over ? 'over' : ''}" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>
        <span class="lm-meter-value ${over ? 'lm-warn' : ''}">${tokens.toLocaleString()} / ${s.memoryBudget.toLocaleString()}</span>
      </div>
      <div class="lm-facts">
        <span>사건 ${(memory?.events?.length ?? 0).toLocaleString()}개</span>
        <span>기록 ${memory?.ledger.entries.length ?? 0}개</span>
        <span>보관 ${memory?.archive.length ?? 0}개</span>
        <span>${vectorStatusText()}</span>
      </div>`;
    const badge = document.getElementById('lm_badge');
    if (badge) {
        badge.hidden = count <= 0;
        badge.textContent = count > 999 ? '999+' : String(count);
        badge.title = `미요약 ${count}개`;
    }
    const chatId = ctx().getCurrentChatId();
    if (s.remindAt > 0 && count >= s.remindAt && remindedFor !== chatId && !busy) {
        remindedFor = chatId;
        toastr.info(`미요약 메시지가 ${count}개 쌓였어요. 패널에서 압축을 눌러 코끼리에게 기억시켜 주세요.`, APP_NAME);
    }
}

// ---------------------------------------------------------------- search test

async function runSearch(query) {
    const memory = getMemory(false);
    if (!memory) return { results: [], dense: false };
    return hybridRecall(memory, query);
}

async function openSearchTest() {
    if (!hasChat()) return toastr.warning('채팅을 먼저 열어주세요.');
    const c = ctx();
    const query = await c.Popup.show.input('검색 테스트', '떠올리고 싶은 장면을 적어보세요. 예: 그때 받은 반지', '');
    if (!query) return;
    const { results, dense } = await runSearch(String(query));
    const kind = { event: '사건', archive: '보관', raw: '원본 대사' };
    const body = results.length
        ? results.map(({ item, score }) => `
<article class="lm-result">
  <header><span class="lm-chip lm-chip-${item.kind}">${kind[item.kind]}</span><span class="lm-range">#${item.from}~#${item.to}</span><span class="lm-score" title="정렬 점수">${Math.round(score * 100)}</span></header>
  <p>${esc(item.display)}</p>
</article>`).join('')
        : '<div class="lm-empty">코끼리가 떠올린 장면이 없어요. 다른 단어로 찾거나, 압축을 먼저 해보세요.</div>';
    const html = `<div class="lm-root lm-manager"><div class="lm-manager-head"><h3>“${esc(query)}” 검색 결과</h3><span class="lm-hint">${dense ? '의미 + 키워드 검색' : '키워드 검색만 사용됨'}</span></div><div class="lm-results">${body}</div></div>`;
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    applyThemeMode(wrap.firstElementChild);
    await c.callGenericPopup(wrap, c.POPUP_TYPE.TEXT, '', { wide: true, allowVerticalScrolling: true, leftAlign: true });
}

// ---------------------------------------------------------------- manager popup

function nodeCard(node) {
    return `
<div class="lm-node lm-node-${node.tier}" data-node-id="${esc(node.id)}">
  <div class="lm-node-dot" aria-hidden="true"></div>
  <div class="lm-node-body">
    <div class="lm-node-meta">
      <span class="lm-chip lm-chip-${node.tier}">${node.tier === 'chapter' ? '챕터' : '에피소드'}</span>
      <span class="lm-range">#${node.from}~#${node.to}</span>
      ${node.condensed ? `<span class="lm-range">${node.condensed}회 압축됨</span>` : ''}
      <span class="lm-spacer"></span>
      ${impControl(node.importance)}
      ${iconToggle('lm-pin', 'fa-thumbtack', '고정 (자동 압축에서 제외)', node.pinned)}
      ${deleteButton()}
    </div>
    <input class="text_pole lm-title" value="${esc(node.title)}" aria-label="제목">
    <textarea class="text_pole lm-text" rows="4" aria-label="내용">${esc(node.text)}</textarea>
    <input class="text_pole lm-kw" value="${esc((node.keywords || []).join(', '))}" placeholder="회상 키워드, 쉼표로 구분" aria-label="회상 키워드">
  </div>
</div>`;
}

function entryRow(entry) {
    return `
<div class="lm-entry" data-entry-id="${esc(entry.id)}">
  <div class="lm-entry-top">
    <input class="text_pole lm-key" value="${esc(entry.key)}" placeholder="이름 또는 항목" aria-label="항목">
    <select class="text_pole lm-cat" aria-label="분류">${selectOptions(CATEGORIES, entry.cat)}</select>
    ${impControl(entry.importance)}
    ${iconToggle('lm-closed', 'fa-check', '해결됨', entry.status === 'closed')}
    ${iconToggle('lm-pin', 'fa-thumbtack', '고정', entry.pinned)}
    ${deleteButton()}
  </div>
  <textarea class="text_pole lm-val" rows="2" placeholder="내용" aria-label="내용">${esc(entry.value)}</textarea>
</div>`;
}

function eventRow(e) {
    const who = [e.characters?.join(', '), e.place].filter(Boolean);
    return `
<div class="lm-event" data-event-id="${esc(e.id)}">
  <div class="lm-entry-top">
    <span class="lm-range">#${e.from}~#${e.to}</span>
    ${who.map(w => `<span class="lm-tag">${esc(w)}</span>`).join('')}
    <span class="lm-spacer"></span>
    ${impControl(e.importance)}
    ${deleteButton()}
  </div>
  <textarea class="text_pole lm-text" rows="2" aria-label="사건 내용">${esc(e.text)}</textarea>
</div>`;
}

function managerHtml(memory) {
    const f = memory.frame;
    const sc = memory.ledger.scene;
    const archive = memory.archive.slice(-100).reverse()
        .map(a => `
<article class="lm-result">
  <header><span class="lm-chip lm-chip-archive">${a.kind === 'ledger' ? '기록' : '요약'}</span><span class="lm-range">#${a.from ?? '?'}~#${a.to ?? '?'}</span></header>
  <p><b>${esc(a.title)}</b><br>${esc(a.text)}</p>
</article>`).join('');
    const frameModes = Object.entries(FRAME_MODES).map(([value, label]) => {
        const [name, desc] = label.split(' (');
        return `<label class="lm-mode"><input type="radio" name="lm_f_mode" value="${value}" ${value === f.mode ? 'checked' : ''}><span class="lm-mode-name">${esc(name)}</span><span class="lm-mode-desc">${esc((desc || '').replace(/\)$/, ''))}</span></label>`;
    }).join('');
    return `
<div class="lm-root lm-manager">
  <div class="lm-manager-head">
    <h3><span class="lm-mascot lm-mascot-sm">${ELEPHANT_SVG}</span>코끼리의 기억장</h3>
    <div class="lm-manager-tools">
      <button type="button" class="menu_button lm-btn lm-btn-quiet" id="lm_export"><i class="fa-solid fa-file-export"></i><span>내보내기</span></button>
      <button type="button" class="menu_button lm-btn lm-btn-quiet" id="lm_import"><i class="fa-solid fa-file-import"></i><span>가져오기</span></button>
      <button type="button" class="menu_button lm-btn lm-btn-danger" id="lm_reset"><i class="fa-solid fa-eraser"></i><span>초기화</span></button>
      <input type="file" id="lm_import_file" accept=".json,application/json" hidden>
    </div>
  </div>

  <div class="lm-tabs lm-tabs-pill lm-tabs-sticky" role="tablist">
    <button type="button" class="lm-tab active" data-lm-tab="frame" role="tab"><i class="fa-solid fa-masks-theater"></i><span>작품 설정</span></button>
    <button type="button" class="lm-tab" data-lm-tab="timeline" role="tab"><i class="fa-solid fa-timeline"></i><span>타임라인</span><span class="lm-count">${memory.timeline.length}</span></button>
    <button type="button" class="lm-tab" data-lm-tab="ledger" role="tab"><i class="fa-solid fa-address-book"></i><span>기록부</span><span class="lm-count">${memory.ledger.entries.length}</span></button>
    <button type="button" class="lm-tab" data-lm-tab="events" role="tab"><i class="fa-solid fa-bolt"></i><span>사건</span><span class="lm-count">${memory.events.length}</span></button>
    <button type="button" class="lm-tab" data-lm-tab="archive" role="tab"><i class="fa-solid fa-box-archive"></i><span>보관함</span><span class="lm-count">${memory.archive.length}</span></button>
  </div>

  <section class="lm-pane active" data-lm-pane="frame" role="tabpanel">
    <div class="lm-field-text lm-pane-intro"><span class="lm-hint">여기 적은 내용은 요약할 때와 대화할 때 모두 AI에게 전달됩니다.</span></div>
    <div class="lm-modes" role="radiogroup" aria-label="작품 유형">${frameModes}</div>
    <div class="lm-field lm-field-stack">
      <div class="lm-field-text"><span class="lm-field-label">원작 제목</span></div>
      <input class="text_pole" id="lm_f_work" value="${esc(f.work)}" placeholder="2차 창작일 때 원작 이름">
    </div>
    <div class="lm-field lm-field-stack">
      <div class="lm-field-text"><span class="lm-field-label">캐릭터 소개</span><span class="lm-hint">누가 어떤 캐릭터인지, 이 이야기에서의 관계까지</span></div>
      <textarea class="text_pole" id="lm_f_characters" rows="5" placeholder="예: 레온: 원작 주인공. 무뚝뚝하지만 동료를 아낌. 이 이야기에서는 유저의 소꿉친구.">${esc(f.characters)}</textarea>
    </div>
    <div class="lm-field lm-field-stack">
      <div class="lm-field-text"><span class="lm-field-label">배경 · AU 설정</span><span class="lm-hint">AU나 자유 2차 창작일 때 바뀐 세계관</span></div>
      <textarea class="text_pole" id="lm_f_au" rows="3" placeholder="예: 현대 대학가, 마법은 존재하지 않음">${esc(f.au)}</textarea>
    </div>
    <div class="lm-field lm-field-stack">
      <div class="lm-field-text"><span class="lm-field-label">기타 메모</span></div>
      <textarea class="text_pole" id="lm_f_notes" rows="2">${esc(f.notes)}</textarea>
    </div>
    <button type="button" class="menu_button lm-btn lm-btn-quiet" id="lm_f_save_char" title="이 캐릭터로 새 채팅을 열 때 자동으로 불러옵니다"><i class="fa-solid fa-user-pen"></i><span>이 캐릭터의 기본값으로 저장</span></button>
  </section>

  <section class="lm-pane" data-lm-pane="timeline" role="tabpanel">
    <div class="lm-saga">
      <div class="lm-field-text"><span class="lm-field-label">지금까지의 이야기</span><span class="lm-hint">오래된 챕터가 합쳐지면 여기에 쌓입니다</span></div>
      <textarea class="text_pole" id="lm_saga" rows="6" placeholder="아직 비어 있어요.">${esc(memory.saga.text)}</textarea>
    </div>
    <div id="lm_timeline" class="lm-timeline">${memory.timeline.map(nodeCard).join('') || '<div class="lm-empty">아직 코끼리가 기억한 이야기가 없어요. 패널에서 압축을 누르면 여기에 차곡차곡 쌓여요.</div>'}</div>
  </section>

  <section class="lm-pane" data-lm-pane="ledger" role="tabpanel">
    <div class="lm-scene">
      <div class="lm-field lm-field-stack"><div class="lm-field-text"><span class="lm-field-label">시간</span></div><input class="text_pole" id="lm_s_time" value="${esc(sc.time)}"></div>
      <div class="lm-field lm-field-stack"><div class="lm-field-text"><span class="lm-field-label">장소</span></div><input class="text_pole" id="lm_s_place" value="${esc(sc.place)}"></div>
      <div class="lm-field lm-field-stack"><div class="lm-field-text"><span class="lm-field-label">함께 있는 인물</span></div><input class="text_pole" id="lm_s_present" value="${esc(sc.present)}"></div>
      <div class="lm-field lm-field-stack"><div class="lm-field-text"><span class="lm-field-label">분위기</span></div><input class="text_pole" id="lm_s_mood" value="${esc(sc.mood)}"></div>
    </div>
    <div id="lm_entries">${ledgerGroups(memory)}</div>
  </section>

  <section class="lm-pane" data-lm-pane="events" role="tabpanel">
    <input class="text_pole lm-filter" id="lm_event_filter" placeholder="사건 찾기: 이름, 장소, 물건…" aria-label="사건 찾기">
    <div class="lm-hint lm-pane-intro">회상 검색에 쓰이는 개별 사건입니다. 최근 ${Math.min(memory.events.length, 300)}개를 보여줘요.</div>
    <div id="lm_events" class="lm-list">${memory.events.slice(-300).reverse().map(eventRow).join('') || '<div class="lm-empty">아직 사건이 없어요. 회상 탭에서 사건 추출을 켜고 압축하면 생깁니다.</div>'}</div>
  </section>

  <section class="lm-pane" data-lm-pane="archive" role="tabpanel">
    <div class="lm-hint lm-pane-intro">압축하면서 줄어든 옛 요약입니다. 회상 검색에 쓰이며, 최근 100개를 보여줘요.</div>
    <div class="lm-results">${archive || '<div class="lm-empty">비어 있어요.</div>'}</div>
  </section>
</div>`;
}

function collectManager(root, memory) {
    const out = structuredClone(memory);
    out.frame = {
        mode: root.querySelector('input[name="lm_f_mode"]:checked')?.value || 'original',
        work: root.querySelector('#lm_f_work').value,
        characters: root.querySelector('#lm_f_characters').value,
        au: root.querySelector('#lm_f_au').value,
        notes: root.querySelector('#lm_f_notes').value,
    };
    out.saga.text = root.querySelector('#lm_saga').value;
    const byId = new Map(memory.timeline.map(n => [n.id, n]));
    out.timeline = [...root.querySelectorAll('#lm_timeline .lm-node')]
        .filter(card => !card.classList.contains('lm-deleted'))
        .map(card => {
            const original = byId.get(card.dataset.nodeId);
            return {
                ...original,
                title: card.querySelector('.lm-title').value.trim() || original.title,
                importance: readImp(card),
                pinned: card.querySelector('.lm-pin').checked,
                text: card.querySelector('.lm-text').value.trim(),
                keywords: card.querySelector('.lm-kw').value.split(/[,，、]/).map(k => k.trim()).filter(k => k.length >= 2),
            };
        })
        .filter(n => n.text);
    out.ledger.scene = {
        time: root.querySelector('#lm_s_time').value.trim(),
        place: root.querySelector('#lm_s_place').value.trim(),
        present: root.querySelector('#lm_s_present').value.trim(),
        mood: root.querySelector('#lm_s_mood').value.trim(),
    };
    const entriesById = new Map(memory.ledger.entries.map(e => [e.id, e]));
    out.ledger.entries = [...root.querySelectorAll('#lm_entries .lm-entry')]
        .filter(row => !row.classList.contains('lm-deleted'))
        .map(row => {
            const original = entriesById.get(row.dataset.entryId) || { updatedAt: memory.cursor };
            return {
                ...original,
                id: row.dataset.entryId,
                cat: row.querySelector('.lm-cat').value,
                key: row.querySelector('.lm-key').value.trim(),
                value: row.querySelector('.lm-val').value.trim(),
                importance: readImp(row),
                status: row.querySelector('.lm-closed').checked ? 'closed' : 'open',
                pinned: row.querySelector('.lm-pin').checked,
            };
        })
        .filter(e => e.key && e.value);
    const shown = new Map();
    root.querySelectorAll('#lm_events .lm-event').forEach(row => shown.set(row.dataset.eventId, row));
    out.events = memory.events
        .map(e => {
            const row = shown.get(e.id);
            if (!row) return e;
            if (row.classList.contains('lm-deleted')) return null;
            return { ...e, text: row.querySelector('.lm-text').value.trim(), importance: readImp(row) };
        })
        .filter(e => e && e.text);
    return out;
}

async function openManager() {
    if (!hasChat()) return toastr.warning('채팅을 먼저 열어주세요.');
    if (busy) return toastr.warning('작업이 끝난 뒤에 열어주세요.');
    const c = ctx();
    const chatId = c.getCurrentChatId();
    const memory = getMemory(true);
    const root = document.createElement('div');
    root.innerHTML = managerHtml(memory);
    applyThemeMode(root.firstElementChild);

    root.addEventListener('click', (event) => {
        const del = event.target.closest('.lm-del');
        if (del) {
            const item = del.closest('.lm-node, .lm-entry, .lm-event');
            item?.classList.toggle('lm-deleted');
            return;
        }
        const add = event.target.closest('.lm-add-entry');
        if (add) {
            const cat = add.dataset.cat;
            const entry = { id: newId(), cat, key: '', value: '', importance: 3, pinned: false, status: 'open' };
            const list = root.querySelector(`.lm-group[data-cat="${cat}"] .lm-group-list`);
            list?.insertAdjacentHTML('beforeend', entryRow(entry));
            list?.lastElementChild?.querySelector('.lm-key')?.focus();
            return;
        }
        const tab = event.target.closest('.lm-tab');
        if (tab) {
            const name = tab.dataset.lmTab;
            root.querySelectorAll('.lm-tab').forEach(t => t.classList.toggle('active', t === tab));
            root.querySelectorAll('.lm-pane').forEach(pane => pane.classList.toggle('active', pane.dataset.lmPane === name));
        }
    });
    const filter = root.querySelector('#lm_event_filter');
    filter.addEventListener('input', () => {
        const q = filter.value.trim().toLowerCase();
        root.querySelectorAll('#lm_events .lm-event').forEach(row => {
            const text = (row.querySelector('.lm-text').value + ' ' + row.querySelector('.lm-entry-top').textContent).toLowerCase();
            row.hidden = !!q && !text.includes(q);
        });
    });
    root.querySelector('#lm_f_save_char').addEventListener('click', async () => {
        const { characterId, writeExtensionField } = ctx();
        if (characterId === undefined || characterId === null) return toastr.warning('그룹 채팅이거나 캐릭터가 선택되지 않았습니다.');
        const frame = collectManager(root, memory).frame;
        await writeExtensionField(characterId, CHAR_FIELD, frame);
        toastr.success('이 캐릭터의 기본 설정으로 저장했습니다.');
    });
    root.querySelector('#lm_export').addEventListener('click', () => {
        const data = collectManager(root, memory);
        delete data.history;
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `long-memory-${String(ctx().getCurrentChatId()).replace(/[^\w-]+/g, '_')}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    });
    const fileInput = root.querySelector('#lm_import_file');
    root.querySelector('#lm_import').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        try {
            const data = JSON.parse(await file.text());
            if (!data || !Array.isArray(data.timeline) || !data.ledger) throw new Error('코끼리를 생각하지마 기억 파일이 아닙니다.');
            const ok = await c.Popup.show.confirm('가져오기', '현재 기억을 파일 내용으로 바꿉니다. (숨김 상태는 바뀌지 않아요)');
            if (!ok) return;
            const current = getMemory(true);
            pushHistory(current, '가져오기');
            const keepHidden = current.hiddenRanges;
            const history = current.history;
            Object.assign(current, emptyMemory(), data, { hiddenRanges: keepHidden, history });
            await ctx().saveMetadata();
            refreshInjection();
            updateStatus();
            toastr.success('가져왔습니다. 관리자를 다시 열면 반영된 내용이 보여요.');
            syncAfter();
        } catch (err) {
            toastr.error(`가져오기 실패: ${err.message}`);
        }
    });
    root.querySelector('#lm_reset').addEventListener('click', () => runReset());

    const popup = new c.Popup(root, c.POPUP_TYPE.CONFIRM, '', {
        okButton: '저장',
        cancelButton: '닫기',
        wide: true,
        large: true,
        allowVerticalScrolling: true,
        leftAlign: true,
    });
    const result = await popup.show();
    if (result !== c.POPUP_RESULT.AFFIRMATIVE) return;
    if (!stillSameChat(chatId)) return toastr.warning('채팅이 바뀌어서 저장하지 않았습니다.');
    const current = getMemory(true);
    if (current !== memory) return toastr.warning('기억이 바뀌어서 저장하지 않았습니다. 다시 열어주세요.');
    const edited = collectManager(root, memory);
    pushHistory(current, '직접 편집');
    for (const key of ['frame', 'saga', 'timeline', 'ledger', 'events']) current[key] = edited[key];
    await ctx().saveMetadata();
    refreshInjection();
    updateStatus();
    toastr.success('기억을 저장했습니다.');
    syncAfter();
}

// ---------------------------------------------------------------- slash commands

function registerCommands() {
    const { SlashCommandParser, SlashCommand, SlashCommandNamedArgument, SlashCommandArgument, ARGUMENT_TYPE } = ctx();
    if (!SlashCommandParser || !SlashCommand) return;
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lm-compress',
        callback: async (args) => {
            await runCompress({ all: String(args.all) === 'true' });
            return '';
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'all',
                description: 'summarize every remaining message in several passes',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'false',
                enumList: ['true', 'false'],
            }),
        ],
        helpString: '<div>코끼리를 생각하지마: 미요약 메시지를 요약해 기억에 저장합니다. <code>/lm-compress all=true</code> 로 남은 전부를 처리합니다.</div>',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lm-compact',
        callback: async () => {
            await runCompact();
            return '';
        },
        helpString: '<div>코끼리를 생각하지마: 덜 중요한 기억부터 압축하고 오래된 기억을 챕터·줄거리로 합칩니다.</div>',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lm-undo',
        callback: async () => {
            await runUndo();
            return '';
        },
        helpString: '<div>코끼리를 생각하지마: 마지막 기억 작업을 되돌립니다.</div>',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lm-manager',
        callback: async () => {
            await openManager();
            return '';
        },
        helpString: '<div>코끼리를 생각하지마: 코끼리의 기억장을 엽니다.</div>',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lm-stop',
        callback: () => {
            runStop();
            return '';
        },
        helpString: '<div>코끼리를 생각하지마: 진행 중인 요약/정리를 중지합니다.</div>',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lm-search',
        callback: async (_args, value) => {
            const { results } = await runSearch(String(value || ''));
            return recallText(results) || '(no results)';
        },
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'search text',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
            }),
        ],
        returns: 'recalled memories for the search text',
        helpString: '<div>코끼리를 생각하지마: 기억에서 관련 장면을 검색합니다. 예: <code>/lm-search 반지 | /echo</code></div>',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lm-reindex',
        callback: async () => {
            await syncVectors({ notify: true });
            return '';
        },
        helpString: '<div>코끼리를 생각하지마: 벡터 검색 색인을 현재 기억에 맞춥니다.</div>',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lm-show',
        callback: () => buildMemoryText(getMemory(false)) || '(no memory)',
        returns: 'the memory text that is injected into the prompt',
        helpString: '<div>코끼리를 생각하지마: 현재 주입되는 기억 텍스트를 반환합니다. 예: <code>/lm-show | /echo</code></div>',
    }));
}

// ---------------------------------------------------------------- wand menu

function addWandMenu() {
    const menu = document.getElementById('extensionsMenu');
    if (!menu || document.getElementById('lm_wand_compress')) return;
    const make = (id, icon, label, handler) => {
        const item = document.createElement('div');
        item.id = id;
        item.className = 'list-group-item flex-container flexGap5 interactable';
        item.tabIndex = 0;
        item.innerHTML = `<div class="fa-solid ${icon} extensionsMenuExtensionButton"></div><span>${label}</span>`;
        item.addEventListener('click', handler);
        menu.appendChild(item);
    };
    make('lm_wand_compress', 'fa-feather-pointed', '코끼리: 기억 압축', () => runCompress({ all: false }));
    make('lm_wand_manager', 'fa-book-open', '코끼리: 기억장 열기', () => openManager());
}

// ---------------------------------------------------------------- chat events

function onChatChanged() {
    if (busy) runStop();
    remindedFor = null;
    const c = ctx();
    if (hasChat() && !c.chatMetadata?.[META_KEY] && c.characterId !== undefined && c.characterId !== null) {
        const frame = c.characters?.[c.characterId]?.data?.extensions?.[CHAR_FIELD];
        if (frame && typeof frame === 'object') {
            const memory = getMemory(true);
            memory.frame = { ...emptyFrame(), ...frame };
            c.saveMetadataDebounced?.();
        }
    }
    ctx().setExtensionPrompt(PROMPT_KEY_RECALL, '', POSITIONS.in_chat, 0);
    lastRecall = [];
    refreshInjection();
    updateStatus();
    if (getMemory(false)) syncAfter();
}

async function onMessageDeleted() {
    const memory = getMemory(false);
    const length = ctx().chat.length;
    if (memory && memory.cursor >= length) {
        memory.cursor = length - 1;
        memory.hiddenRanges = listToRanges(rangesToList(memory.hiddenRanges).filter(i => i < length));
        await ctx().saveMetadata();
    }
    updateStatus();
}

// ---------------------------------------------------------------- init

(function init() {
    getSettings();
    const { eventSource, event_types } = ctx();
    eventSource.on(event_types.APP_READY, () => {
        const host = document.getElementById('extensions_settings2');
        if (host && !document.getElementById('lm_settings')) {
            host.insertAdjacentHTML('beforeend', settingsHtml());
            bindSettings(document.getElementById('lm_settings'));
            setBusyUI(false);
        }
        addWandMenu();
        registerCommands();
        onChatChanged();
    });
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    eventSource.on(event_types.MESSAGE_DELETED, onMessageDeleted);
    eventSource.on(event_types.MESSAGE_RECEIVED, updateStatus);
    eventSource.on(event_types.MESSAGE_SENT, updateStatus);
    console.log(LOG_PREFIX, 'loaded');
})();
