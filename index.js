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
    note: '꼭 기억할 것',
    character: '인물',
    relation: '관계',
    thread: '진행 중인 일/약속',
    fact: '사실/세계관/비밀',
    item: '중요 물건',
    divergence: '원작과 달라진 점',
};

const CATEGORY_EN = {
    note: 'Must-remember note',
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
    previewBeforeSave: false,
    autoCompress: false,
    autoCompressAt: 40,
    autoForgetDeleted: true,
    checkContradictions: false,
    liveStateUpdate: false,
    queryExpansion: false,
    expansionTimeoutMs: 15000,
    autoBackupEvery: 10,
    backupKeep: 5,
    injectPreset: 'stable',
    loreEnabled: true,
    loreUseCharacter: true,
    loreUseChat: true,
    loreBooks: [],
    loreTokenBudget: 2000,
    wikiMaxPages: 40,
    wikiBatch: 6,
    qnaTopK: 10,
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
            extensionSettings[MODULE][key] = structuredClone(defaultSettings[key]);
        }
    }
    return extensionSettings[MODULE];
}

// ---------------------------------------------------------------- memory model

function emptyFrame() {
    return {
        mode: 'original', work: '', characters: '', au: '', notes: '',
        era: '', eraDetail: '', culture: '', cultureCustom: '', storyLanguage: '', nameStyle: '',
    };
}

// World settings: when and where the story takes place, separate from the language it is written in.
const ERAS = {
    '': '지정 안 함',
    modern: '현대',
    nearfuture: '근미래 · SF',
    recent: '근현대 (20세기)',
    historical_east: '동양 사극 · 역사',
    medieval: '중세 · 판타지',
    custom: '직접 입력',
};
const ERA_EN = {
    modern: 'the present day',
    nearfuture: 'the near future / science fiction',
    recent: 'the 20th century',
    historical_east: 'a historical East Asian setting',
    medieval: 'a medieval or fantasy setting',
};
const CULTURES = {
    '': '지정 안 함',
    korea: '한국',
    japan: '일본',
    china: '중국',
    taiwan_hk: '대만 · 홍콩',
    us: '미국 · 영어권',
    europe: '영국 · 유럽',
    fictional: '가상 세계',
    custom: '직접 입력',
};
const CULTURE_EN = {
    korea: 'Korean', japan: 'Japanese', china: 'Chinese', taiwan_hk: 'Taiwanese / Hong Kong',
    us: 'American / English-speaking', europe: 'British / European', fictional: 'the story\'s own fictional',
};
const STORY_LANGUAGES = { '': '채팅 언어 따라가기', ko: '한국어', ja: '日本語', en: 'English', zh: '中文' };
const STORY_LANGUAGE_EN = { ko: 'Korean', ja: 'Japanese', en: 'English', zh: 'Chinese' };
const NAME_STYLES = {
    '': '자동',
    localized: '채팅 언어 발음으로 (예: 사토 하루키)',
    original: '원래 문자 그대로 (예: 佐藤春樹)',
    romanized: '로마자로 (예: Sato Haruki)',
};

function worldText(f) {
    const parts = [];
    const era = f.era === 'custom' ? '' : ERA_EN[f.era];
    if (era || f.eraDetail.trim()) {
        parts.push(`Era and situation: ${[era, f.eraDetail.trim()].filter(Boolean).join('. ')}.`);
    }
    const culture = f.culture === 'custom' ? f.cultureCustom.trim() : CULTURE_EN[f.culture];
    const lang = STORY_LANGUAGE_EN[f.storyLanguage];
    if (culture) {
        parts.push(`The story world follows ${culture} culture and daily life: names and name order, honorifics and forms of address, schools, workplaces, money, food, holidays, customs and place names all fit that culture.`);
    }
    if (lang) {
        parts.push(`All narration and dialogue are written in ${lang}. This is only the writing language, not the characters' nationality or culture${culture ? `: characters speak the language of their ${culture} world in-story, and their speech is rendered naturally in ${lang}, keeping culture-specific address terms and honorifics where they sound natural` : ''}.`);
    }
    const names = {
        localized: `Write names as they are pronounced, in the ${lang || 'writing'} language's script.`,
        original: 'Write names in their original script.',
        romanized: 'Write names in romanized form.',
    }[f.nameStyle];
    if (names) parts.push(`${names} Keep each name's spelling consistent.`);
    return parts.join(' ');
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
        tagVersion: 1,
        opsSinceBackup: 0,
        wiki: { updatedAt: 0, pages: [] },
        qna: [],
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
    if (!Object.hasOwn(memory, 'tagVersion')) memory.tagVersion = 0;
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

// ---------------------------------------------------------------- message tags
// Every summarized message carries extra.lm_owner (the memory node covering it), so
// deletions and edits can be traced even after message indices shift.

const SAGA_OWNER = 'saga';

function rangeIndices(from, to) {
    const out = [];
    for (let i = from; i <= to; i++) out.push(i);
    return out;
}

function tagMessages(indices, ownerId) {
    const { chat } = ctx();
    for (const i of indices) {
        const msg = chat[i];
        if (!msg) continue;
        msg.extra = msg.extra || {};
        msg.extra.lm_owner = ownerId;
    }
}

function retagOwners(fromIds, toId) {
    const set = new Set(fromIds);
    for (const msg of ctx().chat) {
        if (msg?.extra?.lm_owner && set.has(msg.extra.lm_owner)) msg.extra.lm_owner = toId;
    }
}

function clearTags() {
    for (const msg of ctx().chat) {
        if (!msg?.extra) continue;
        delete msg.extra.lm_owner;
        delete msg.extra.lm_hidden;
    }
}

// Rebuilds tags from stored ranges (migration, undo, import).
function retagFromRanges(memory) {
    const { chat } = ctx();
    const last = chat.length - 1;
    for (const msg of chat) {
        if (msg?.extra) delete msg.extra.lm_owner;
    }
    if (memory.saga.text && memory.saga.coversTo >= 0) {
        tagMessages(rangeIndices(0, Math.min(memory.saga.coversTo, last)), SAGA_OWNER);
    }
    for (const node of memory.timeline) {
        if (node.from < 0) continue;
        const to = Math.min(node.to, last);
        tagMessages(rangeIndices(node.from, to), node.id);
        node.msgCount = Math.max(0, to - node.from + 1);
    }
    const hidden = new Set(rangesToList(memory.hiddenRanges));
    chat.forEach((msg, i) => {
        if (!msg) return;
        if (hidden.has(i)) {
            msg.extra = msg.extra || {};
            msg.extra.lm_hidden = true;
        } else if (msg.extra) {
            delete msg.extra.lm_hidden;
        }
    });
    memory.tagVersion = 1;
}

// After messages are deleted: drop memories whose messages are all gone, flag partly
// deleted ones for re-summarizing, and recompute ranges from the surviving tags.
async function reconcileAfterDeletion() {
    const memory = getMemory(false);
    if (!memory) return;
    const s = getSettings();
    const { chat } = ctx();
    const owned = new Map();
    const hidden = [];
    chat.forEach((msg, i) => {
        const owner = msg?.extra?.lm_owner;
        if (owner) {
            if (!owned.has(owner)) owned.set(owner, []);
            owned.get(owner).push(i);
        }
        if (msg?.extra?.lm_hidden && msg.is_system) hidden.push(i);
    });
    let removed = 0;
    let staled = 0;
    const removedIds = new Set();
    const keep = [];
    for (const node of memory.timeline) {
        if (node.from < 0) {
            keep.push(node);
            continue;
        }
        const list = owned.get(node.id);
        if (!list?.length) {
            if (s.autoForgetDeleted) {
                removed++;
                removedIds.add(node.id);
                continue;
            }
            if (!node.stale) staled++;
            node.stale = true;
            node.from = -2;
            node.to = -2;
            keep.push(node);
            continue;
        }
        if (node.msgCount && list.length < node.msgCount && !node.stale) {
            node.stale = true;
            staled++;
        }
        node.from = list[0];
        node.to = list[list.length - 1];
        node.msgCount = list.length;
        keep.push(node);
    }
    memory.timeline = keep;
    if (memory.saga.text && memory.saga.coversTo >= 0) {
        const sagaList = owned.get(SAGA_OWNER);
        if (sagaList?.length) {
            memory.saga.coversTo = sagaList[sagaList.length - 1];
        } else if (s.autoForgetDeleted) {
            memory.saga = { text: '', coversTo: -1 };
            removedIds.add(SAGA_OWNER);
            removed++;
        }
    }
    if (removedIds.size) {
        memory.events = memory.events.filter(e => !removedIds.has(e.episodeId));
        memory.archive = memory.archive.filter(a => !removedIds.has(a.ownerId));
    }
    const byId = new Map(memory.timeline.map(n => [n.id, n]));
    for (const e of memory.events) {
        const n = byId.get(e.episodeId);
        if (n && n.from >= 0) {
            e.from = n.from;
            e.to = n.to;
        }
    }
    let maxOwned = -1;
    for (const list of owned.values()) maxOwned = Math.max(maxOwned, list[list.length - 1]);
    memory.cursor = maxOwned >= 0 ? maxOwned : Math.min(memory.cursor, chat.length - 1, removed ? -1 : memory.cursor);
    memory.hiddenRanges = listToRanges(hidden);
    await ctx().saveMetadata();
    if (removed) toastr.info(`삭제된 메시지에 대한 기억 ${removed}개를 지웠어요.`, APP_NAME);
    if (staled) toastr.info(`메시지가 일부 지워진 기억 ${staled}개에 "다시 요약" 표시를 했어요.`, APP_NAME);
    refreshInjection();
    updateStatus();
    if (removed || staled) syncAfter();
}

function onMessageEdited(id) {
    const memory = getMemory(false);
    if (!memory) return;
    const owner = ctx().chat[Number(id)]?.extra?.lm_owner;
    if (!owner) return;
    const node = memory.timeline.find(n => n.id === owner);
    if (!node || node.stale) return;
    node.stale = true;
    ctx().saveMetadataDebounced?.();
    updateStatus();
    toastr.info('요약된 메시지가 바뀌었어요. 기억장에서 그 구간을 다시 요약할 수 있어요.', APP_NAME);
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
            .filter(line => !/^\s*\**(title|when|importance|keywords)\**\s*[:：]/i.test(line))
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
        when: get('when').replace(/^(unknown|none|n\/a|-)$/i, '').slice(0, 80),
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
    const world = worldText(f);
    if (world) parts.push(world);
    if (f.characters.trim()) parts.push(`Character notes (written by the user):\n${f.characters.trim()}`);
    if (f.notes.trim()) parts.push(`Additional notes (written by the user):\n${f.notes.trim()}`);
    return parts.join('\n\n');
}

// ---------------------------------------------------------------- lorebook reference
// Reads the character, chat and chosen lorebooks so summaries, checks, the wiki and
// answers use the right names and world facts. Only entries relevant to the text are sent.

const loreCache = { at: 0, key: '', entries: [] };

function loreBookNames() {
    const s = getSettings();
    const c = ctx();
    const names = new Set((s.loreBooks || []).filter(Boolean));
    if (s.loreUseCharacter && c.characterId !== undefined && c.characterId !== null) {
        const world = c.characters?.[c.characterId]?.data?.extensions?.world;
        if (world) names.add(world);
    }
    if (s.loreUseChat && c.chatMetadata?.world_info) names.add(c.chatMetadata.world_info);
    return [...names];
}

async function loreEntries() {
    const s = getSettings();
    if (!s.loreEnabled || typeof ctx().loadWorldInfo !== 'function') return [];
    const names = loreBookNames();
    const key = names.slice().sort().join('|');
    if (key === loreCache.key && Date.now() - loreCache.at < 60000) return loreCache.entries;
    const entries = [];
    for (const name of names) {
        try {
            const data = await ctx().loadWorldInfo(name);
            for (const e of Object.values(data?.entries || {})) {
                const content = String(e?.content || '').trim();
                if (!content || e.disable) continue;
                entries.push({
                    book: name,
                    title: String(e.comment || '').trim(),
                    keys: [...(e.key || []), ...(e.keysecondary || [])].map(k => String(k).trim()).filter(Boolean),
                    content,
                    constant: !!e.constant,
                });
            }
        } catch (err) {
            console.warn(LOG_PREFIX, `lorebook "${name}" could not be read`, err);
        }
    }
    Object.assign(loreCache, { at: Date.now(), key, entries });
    return entries;
}

function keyMatches(key, low, raw) {
    const m = key.match(/^\/(.+)\/([a-z]*)$/);
    if (m) {
        try {
            return new RegExp(m[1], m[2]).test(raw);
        } catch {
            return false;
        }
    }
    return key.length >= 2 && low.includes(key.toLowerCase());
}

async function loreFor(text, budget = getSettings().loreTokenBudget) {
    const entries = await loreEntries();
    if (!entries.length || budget <= 0) return '';
    const raw = String(text || '');
    const low = raw.toLowerCase();
    const scored = [];
    for (const e of entries) {
        const hits = e.keys.filter(k => keyMatches(k, low, raw)).length;
        if (!hits && !e.constant) continue;
        scored.push({ e, score: hits + (e.constant ? 0.5 : 0) });
    }
    scored.sort((a, b) => b.score - a.score);
    const out = [];
    let used = 0;
    for (const { e } of scored) {
        const line = `- ${e.title || e.keys[0] || 'entry'}: ${e.content.replace(/\s+/g, ' ')}`;
        const cost = estTokens(line);
        if (used + cost > budget) continue;
        out.push(line);
        used += cost;
    }
    return out.join('\n');
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
        note: 'Must-remember notes (pinned by the user)',
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
        lines.push(`[${labels[cat]}]\n${entries.map(e => {
            const extra = [];
            if (e.knownBy?.length) extra.push(`known only by: ${e.knownBy.join(', ')}`);
            if (e.due) extra.push(`due: ${e.due}`);
            if (e.status === 'closed') extra.push('resolved');
            return `- ${e.key}: ${e.value}${extra.length ? ` (${extra.join('; ')})` : ''}`;
        }).join('\n')}`);
    }
    return lines.join('\n\n');
}

function rangeLabel(from, to) {
    if (from === -1) return 'from an earlier chat';
    if (from < 0) return 'original messages deleted';
    return from === to ? `message #${from}` : `messages #${from}-#${to}`;
}

function timelineText(memory, { lastN = null } = {}) {
    const nodes = lastN ? memory.timeline.slice(-lastN) : memory.timeline;
    return nodes
        .map(n => `### ${n.tier === 'chapter' ? 'Chapter' : 'Episode'}: ${n.title} (${rangeLabel(n.from, n.to)}${n.when ? `; in-story: ${n.when}` : ''})\n${n.text}`)
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
        `This is the authoritative record of the earlier part of this story (${covered}), compressed because the original messages are no longer shown. Treat everything here as established canon of this story: keep names, facts, relationships, injuries, promises and open threads consistent with it. Older events are condensed; the most recent messages continue directly after the last timeline entry. Characters only know secrets they are listed as knowing. Use it silently; do not repeat or summarize it in replies.`,
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

function archiveNode(memory, node, kind = 'timeline', ownerId = null) {
    if (!node?.text) return;
    if (memory.archive.some(a => a.id === node.id)) return;
    memory.archive.push({
        id: node.id,
        ownerId,
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
        items.push({ hash: hashString(`ev|${e.id}|${text}`), kind: 'event', text, display: e.text, importance: e.importance || 3, from: e.from, to: e.to, when: e.when || '' });
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
        if (notify) reportError('벡터 색인 실패', err);
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

async function hybridRecall(memory, query, { useDense = true, topK = null, budget = null } = {}) {
    const s = getSettings();
    const maxItems = topK ?? s.recallTopK;
    const maxTokens = budget ?? s.recallTokenBudget;
    const corpus = buildCorpus(memory);
    const queries = (Array.isArray(query) ? query : [query]).map(q => String(q || '').trim()).filter(Boolean);
    if (!corpus.length || !queries.length) return { results: [], dense: false };
    const pool = Math.max(maxItems * 4, 20);
    const byHash = new Map(corpus.map(x => [x.hash, x]));
    const lists = [];
    let dense = false;
    for (const q of queries) {
        if (useDense && s.vectorEnabled) {
            try {
                const hashes = await denseSearch(q, pool);
                const items = hashes.map(h => byHash.get(h)).filter(Boolean);
                if (items.length) lists.push(items);
                dense = true;
            } catch (err) {
                console.warn(LOG_PREFIX, 'dense search skipped', err);
            }
        }
        lists.push(bm25Search(corpus, q, pool));
    }

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
        if (picked.length >= maxItems) break;
        if (r.item.kind === 'raw' && usedRaw.some(([a, b]) => r.item.from <= b + 1 && r.item.to >= a - 1)) continue;
        const cost = estTokens(r.item.display);
        if (picked.length && tokens + cost > maxTokens) continue;
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
        const where = rangeLabel(item.from ?? -2, item.to ?? item.from ?? -2);
        return `- [${label[item.kind]}, ${where}${item.when ? `, in-story ${item.when}` : ''}] ${item.display.replace(/\n+/g, ' / ')}`;
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

function withTimeout(promise, ms) {
    let timer;
    return Promise.race([
        promise.finally(() => clearTimeout(timer)),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), ms); }),
    ]);
}

// A small model rewrites the latest turn into concrete search queries so indirect
// references ("that time at the river") still find the right memories.
async function expandQueries(memory, recentChat) {
    const s = getSettings();
    if (!s.queryExpansion) return [];
    const msgs = (recentChat || []).filter(m => m && !m.is_system).slice(-3)
        .map(m => `${m.name || ''}: ${stripMessage(m.mes).slice(0, 1200)}`).join('\n\n');
    if (!msgs.trim()) return [];
    const terms = memory.ledger.entries.slice(0, 60).map(e => e.key).join(', ');
    const system = 'You help a memory system find earlier moments of a long story. Given the latest messages, write 2-4 short search queries (names, places, objects, earlier events) for the past moments needed to write the next reply well. Turn vague references such as "that time" or "what you promised" into concrete terms when the known terms allow it. Write the queries in the same language as the messages. Reply with only: <queries>one query per line</queries>';
    const user = `${terms ? `<known_terms>${terms}</known_terms>\n\n` : ''}<latest_messages>\n${msgs}\n</latest_messages>`;
    const out = await withTimeout(callModel(system, user, { retries: 0 }), s.expansionTimeoutMs);
    return (extractTag(out, 'queries') || '').split('\n')
        .map(q => q.replace(/^[-*\d.)\s]+/, '').trim())
        .filter(q => q.length >= 2)
        .slice(0, 4);
}

async function refreshRecall(recentChat) {
    const s = getSettings();
    const { setExtensionPrompt } = ctx();
    const memory = s.enabled && s.recallEnabled ? getMemory(false) : null;
    let text = '';
    if (memory) {
        const queries = [recallQuery(recentChat)];
        try {
            queries.push(...await expandQueries(memory, recentChat));
        } catch (err) {
            console.warn(LOG_PREFIX, 'query expansion skipped', err);
        }
        const { results } = await hybridRecall(memory, queries);
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

async function callModel(systemText, userText, { retries = null } = {}) {
    const s = getSettings();
    const c = ctx();
    const maxRetries = retries ?? s.retries;
    const messages = s.systemAsUser
        ? [{ role: 'user', content: `${systemText}\n\n${userText}` }]
        : [{ role: 'system', content: systemText }, { role: 'user', content: userText }];
    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
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
            if (attempt < maxRetries) await sleep(1500 * (attempt + 1));
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

// ---------------------------------------------------------------- error reporting
// ST wraps failed requests as "API request failed"; the real reason sits in err.cause.

function errorDetail(err) {
    const parts = [];
    let e = err;
    for (let depth = 0; e && depth < 6; depth++) {
        const msg = String(e?.message ?? e).trim();
        if (msg && !parts.includes(msg)) parts.push(msg);
        e = e?.cause;
    }
    return parts.join(' → ') || '알 수 없는 오류';
}

function errorHint(detail) {
    const d = detail.toLowerCase();
    if (d.includes('could not find profile')) return '선택한 연결 프로필을 찾지 못했어요. 설정 → 요약 탭에서 요약 모델을 다시 골라주세요.';
    if (d.includes('connection manager is not available')) return 'ST 확장 목록에서 Connection Manager를 켜주세요.';
    if (d.includes('not supported') || d.includes('has an api')) return '이 프로필의 API 종류는 쓸 수 없어요. Chat Completion이나 Text Completion 프로필을 골라주세요.';
    if (/\b(401|403)\b|unauthori|permission|api key|api_key|invalid.*key|forbidden|credential/.test(d)) return 'API 키가 없거나 맞지 않아요. API 연결 화면에서 이 프로필이 쓰는 소스의 키를 확인해주세요.';
    if (/\b429\b|quota|rate.?limit|resource.?exhausted|too many requests/.test(d)) return '사용량 한도에 걸렸어요. 잠시 뒤에 다시 하거나 다른 모델이나 키를 써주세요.';
    if (/safety|blocked|prohibited|content.?filter|moderation|policy/.test(d)) return '모델의 안전 필터가 이 내용을 막았어요. 요약 모델을 다른 모델로 바꿔보세요.';
    if (/context|too long|maximum.*token|token.*(limit|exceed)|length/.test(d)) return '보낸 내용이 모델 한도보다 길어요. 범위 탭의 "한 구간 최대 토큰"을 줄여보세요.';
    if (/\b404\b|not found|no such model|unknown model/.test(d)) return '모델이나 주소를 찾지 못했어요. 프로필에 저장된 모델 이름을 확인해주세요.';
    if (d.includes('빈 응답')) return '모델이 빈 답을 보냈어요. 생각(추론) 모델이라면 요약 탭의 "응답 최대 토큰"을 8000 이상으로 늘려보세요.';
    if (/response not ok|\b50[0-4]\b|overloaded|unavailable|internal/.test(d)) return 'API 쪽에서 오류를 돌려줬어요. 자세한 이유는 SillyTavern 서버 창(검은 콘솔 창)에 찍혀 있어요. 잠시 뒤 다시 하거나 다른 모델을 써보세요.';
    if (/failed to fetch|network|timeout|econn/.test(d)) return '연결이 끊겼어요. SillyTavern 서버가 켜져 있는지, 인터넷이 되는지 확인해주세요.';
    return '';
}

function reportError(title, err) {
    if (String(err?.message) === 'aborted') return;
    console.error(LOG_PREFIX, title, err);
    const detail = errorDetail(err);
    const hint = errorHint(detail);
    toastr.error(`${hint ? `${hint}<br><small>${esc(detail)}</small>` : esc(detail)}`, title, { timeOut: 15000, extendedTimeOut: 8000, escapeHtml: false });
}

async function testConnection() {
    const s = getSettings();
    const started = Date.now();
    setProgress('요약 모델에 연결해 보는 중…');
    try {
        const reply = await callModel('You are a connection test.', 'Reply with exactly: OK', { retries: 0 });
        const ms = Date.now() - started;
        toastr.success(`응답이 왔어요 (${(ms / 1000).toFixed(1)}초): "${esc(reply.slice(0, 40))}"`, `${s.profileId ? '연결 프로필' : '현재 연결'} 정상`, { escapeHtml: false });
    } catch (err) {
        reportError('요약 모델 연결 실패', err);
    } finally {
        if (!busy) setProgress('');
    }
}

// ---------------------------------------------------------------- summarize a batch

const EVENTS_FORMAT = `
<events>
[JSON array of the distinct meaningful events in this transcript; can be empty]
</events>

Each event is one retrievable memory: {"text":"<1-3 sentences: what happened, including cause and result>","when":"<in-story time if known>","characters":["..."],"place":"...","items":["..."],"keywords":["..."],"importance":<1-5>}
Extract as many events as actually happened (zero for pure small talk, several for eventful scenes). Make each event self-contained: name the characters instead of using pronouns, so it is understandable on its own months later.
`;

function summarySystemPrompt() {
    const s = getSettings();
    return `${baseArchivistRules()}
- Length: ${DETAIL[s.detail] ?? DETAIL.standard}

Reply with exactly these blocks and nothing else:

<episode>
title: <short title, at most 10 words>
when: <in-story date and time span of this transcript if it can be inferred (e.g. "Day 3, evening" or "Spring, year 2"); leave empty if unknown>
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
  Optional fields: "knownBy":["names"] for secrets and hidden facts (exactly who knows it; update it whenever someone learns the truth), "due":"<in-story deadline>" for threads with a deadline.
{"op":"close","cat":"thread","key":"<key>"}  Marks a thread or promise as resolved.
{"op":"delete","cat":"<category>","key":"<key>"}  Removes an entry that is no longer true or relevant.
{"op":"scene","time":"...","place":"...","present":"...","mood":"..."}  The situation at the END of this transcript.

Categories:
- character: appearance, personality, abilities, role and current condition of each character (including the user's character)
- relation: how one character feels about or relates to another; key format "A -> B"
- thread: open plot threads, goals, plans, promises, debts, deadlines, pending questions
- fact: world rules, established facts, secrets (always give knownBy for secrets)
- item: significant objects, who holds them, why they matter
- divergence: only for fanfiction; where this story departs from the original work's canon
Entries in the "note" category are pinned by the user: never change or delete them.
Reuse existing keys exactly when updating. Only emit operations for things that are new or changed. If nothing changed, output [].${extraRules()}`;
}

function summaryUserPrompt(memory, batch, lore = '') {
    const parts = [];
    const frame = frameText(memory.frame);
    if (frame) parts.push(`<story_frame>\n${frame}\n</story_frame>`);
    if (lore) parts.push(`<lorebook_reference>\nReference only: use it for correct names, terms and world facts. Do not summarize it as events.\n${lore}\n</lorebook_reference>`);
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
        if (!CATEGORIES[cat] || cat === 'note' || !key) continue;
        const existing = find(cat, key);
        const knownBy = Array.isArray(op.knownBy) ? toList(op.knownBy) : null;
        const due = typeof op.due === 'string' ? op.due.trim().slice(0, 80) : null;
        if (kind === 'set') {
            const value = String(op.value ?? '').trim();
            if (!value) continue;
            if (existing) {
                if (existing.pinned) continue;
                existing.value = value;
                existing.importance = clampInt(op.importance, 1, 5, existing.importance);
                existing.updatedAt = atIndex;
                existing.status = 'open';
                if (knownBy) existing.knownBy = knownBy;
                if (due !== null) existing.due = due;
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
                    knownBy: knownBy || [],
                    due: due || '',
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

function planBatches(start, end, { includeHidden = false } = {}) {
    const s = getSettings();
    const { chat } = ctx();
    const batches = [];
    let current = null;
    for (let i = start; i <= end; i++) {
        const msg = chat[i];
        if (!msg || !(isSummarizable(msg) || (includeHidden && String(msg.mes ?? '').trim()))) continue;
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
            when: String(e.when || '').trim().slice(0, 80),
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
    const user = summaryUserPrompt(memory, batch, await loreFor(batch.lines.join('\n')));
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

async function runCompress({ all = false, auto = false } = {}) {
    if (busy) return auto ? undefined : toastr.warning('이미 작업 중입니다.');
    if (!hasChat()) return auto ? undefined : toastr.warning('채팅을 먼저 열어주세요.');
    const s = getSettings();
    const { start, end, count } = unsummarizedRange();
    if (count <= 0) return auto ? undefined : toastr.info(`압축할 메시지가 없습니다. (최근 ${s.keepRecent}개는 원본 유지)`);

    let includeHidden = false;
    let batches = planBatches(start, end);
    if (!batches.length) {
        if (auto) return;
        const hiddenCount = ctx().chat.slice(start, end + 1).filter(m => m?.is_system && String(m.mes ?? '').trim()).length;
        if (!hiddenCount) return toastr.info('요약할 내용이 없습니다.');
        const ok = await ctx().Popup.show.confirm(
            '숨겨진 메시지만 있어요',
            `메시지 #${start}~#${end}가 모두 이미 숨김 상태라 요약할 게 없었어요. 다른 확장이나 /hide 명령으로 숨겨진 것 같아요. (이전 버전 st-long-memory 폴더가 남아 있다면 지워주세요.)\n\n숨겨진 메시지 ${hiddenCount}개도 포함해서 요약할까요?`,
        );
        if (!ok) return;
        includeHidden = true;
        batches = planBatches(start, end, { includeHidden: true });
        if (!batches.length) return toastr.info('요약할 내용이 없습니다.');
    }
    if (!all || auto) batches = batches.slice(0, 1);
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
            let summary = await summarizeBatch(memory, batch);
            if (s.previewBeforeSave && !auto) {
                let stop = false;
                for (;;) {
                    const choice = await previewEpisode(summary, batch);
                    if (choice.action === 'retry') {
                        setProgress(`다시 요약 중 (#${batch.from}~#${batch.to})`);
                        summary = await summarizeBatch(memory, batch);
                        continue;
                    }
                    if (choice.action === 'stop') stop = true;
                    else summary.node = choice.node;
                    break;
                }
                if (stop) break;
            }
            const { node, ops, events } = summary;
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
                when: node.when || '',
                text: node.text,
                importance: node.importance,
                keywords: node.keywords,
                pinned: false,
                condensed: 0,
                includeHidden,
            });
            applyLedgerOps(memory, ops, batch.to);
            memory.cursor = batch.to;
            tagMessages(rangeIndices(batch.from, batch.to), episodeId);
            memory.timeline[memory.timeline.length - 1].msgCount = batch.to - batch.from + 1;
            if (s.hideSummarized) {
                const toHide = batch.indices.filter(i => !ctx().chat[i]?.is_system);
                setHidden(toHide, true);
                for (const i of toHide) {
                    memory.hiddenRanges = addRange(memory.hiddenRanges, i, i);
                    ctx().chat[i].extra.lm_hidden = true;
                }
            }
            await ctx().saveChat();
            await ctx().saveMetadata();
            done++;
            refreshInjection();
            updateStatus();
            if (s.autoCompact) await compactInternal(chatId, { force: false });
        }
        if (done) toastr.success(auto ? `자동 압축: ${done}개 구간을 기억했어요.` : `${done}개 구간을 기억에 저장했습니다.`, auto ? APP_NAME : undefined);
        if (done) await maybeAutoBackup(done);
        if (done && stillSameChat(chatId)) syncAfter();
    } catch (err) {
        if (String(err?.message) === 'aborted') toastr.info(`중지했습니다. (${done}개 구간 완료)`);
        else {
            reportError('압축 실패', err);
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

// ---------------------------------------------------------------- preview before saving

const PREVIEW_RETRY = 1001;

async function previewEpisode(summary, batch) {
    const c = ctx();
    const { node, events, ops } = summary;
    const root = document.createElement('div');
    root.innerHTML = `
<div class="lm-root lm-manager lm-preview">
  <div class="lm-manager-head">
    <h3><span class="lm-mascot lm-mascot-sm">${ELEPHANT_SVG}</span>새 기억 확인</h3>
    <span class="lm-range">#${batch.from}~#${batch.to}</span>
  </div>
  <p class="lm-hint lm-pane-intro">저장하기 전에 고칠 곳이 있으면 고쳐주세요. 마음에 안 들면 다시 요약할 수 있어요.</p>
  <div class="lm-node-body">
    <div class="lm-node-meta"><span class="lm-chip lm-chip-episode">에피소드</span><span class="lm-spacer"></span>${impControl(node.importance)}</div>
    <input class="text_pole lm-title" value="${esc(node.title)}" aria-label="제목">
    <input class="text_pole lm-when" value="${esc(node.when || '')}" placeholder="작중 시간 (예: 3일째 저녁)" aria-label="작중 시간">
    <textarea class="text_pole lm-text" rows="9" aria-label="내용">${esc(node.text)}</textarea>
    <input class="text_pole lm-kw" value="${esc((node.keywords || []).join(', '))}" placeholder="회상 키워드" aria-label="회상 키워드">
  </div>
  <p class="lm-hint">함께 찾은 사건 ${events?.length || 0}개와 기록부 변경 ${ops?.length || 0}건도 같이 저장돼요.</p>
</div>`;
    applyThemeMode(root.firstElementChild);
    const popup = new c.Popup(root, c.POPUP_TYPE.CONFIRM, '', {
        okButton: '저장',
        cancelButton: '여기서 멈추기',
        wide: true,
        allowVerticalScrolling: true,
        leftAlign: true,
        customButtons: [{ text: '다시 요약', result: PREVIEW_RETRY, icon: 'fa-rotate' }],
    });
    const result = await popup.show();
    if (result === PREVIEW_RETRY) return { action: 'retry' };
    if (result !== c.POPUP_RESULT.AFFIRMATIVE) return { action: 'stop' };
    const body = root.querySelector('.lm-node-body');
    return {
        action: 'save',
        node: {
            ...node,
            title: body.querySelector('.lm-title').value.trim() || node.title,
            when: body.querySelector('.lm-when').value.trim(),
            text: body.querySelector('.lm-text').value.trim() || node.text,
            keywords: body.querySelector('.lm-kw').value.split(/[,，、]/).map(k => k.trim()).filter(k => k.length >= 2),
            importance: readImp(body),
        },
    };
}

// ---------------------------------------------------------------- re-summarize one memory

async function resummarizeNode(nodeId) {
    if (busy) return toastr.warning('이미 작업 중입니다.');
    const s = getSettings();
    const memory = getMemory(false);
    const node = memory?.timeline.find(n => n.id === nodeId);
    if (!node || node.from < 0) return toastr.warning('원본 메시지가 없어서 다시 요약할 수 없어요.');
    const { chat } = ctx();
    const indices = [];
    chat.forEach((m, i) => { if (m?.extra?.lm_owner === nodeId) indices.push(i); });
    const lines = indices.filter(i => chat[i]?.extra?.lm_hidden || isSummarizable(chat[i]) || (node.includeHidden && String(chat[i]?.mes ?? '').trim())).map(i => messageLine(chat[i], i));
    if (!lines.length) return toastr.warning('원본 메시지를 찾지 못했어요.');
    if (estTokens(lines.join('\n')) > s.batchTokens) {
        return toastr.warning('이 구간은 한 번에 다시 요약하기엔 길어요. 설정의 "한 구간 최대 토큰"을 늘려주세요.');
    }
    const batch = { from: indices[0], to: indices[indices.length - 1], lines, indices };
    const chatId = ctx().getCurrentChatId();
    busy = true;
    abortController = new AbortController();
    setBusyUI(true);
    setProgress(`다시 요약 중 (#${batch.from}~#${batch.to})`);
    try {
        const { node: fresh, ops, events } = await summarizeBatch(memory, batch);
        if (!stillSameChat(chatId)) return;
        pushHistory(memory, `다시 요약 #${batch.from}-#${batch.to}`);
        Object.assign(node, {
            title: fresh.title,
            when: fresh.when || node.when || '',
            text: fresh.text,
            keywords: fresh.keywords,
            importance: fresh.importance,
            stale: false,
            condensed: 0,
            from: batch.from,
            to: batch.to,
            msgCount: indices.length,
        });
        memory.events = memory.events.filter(e => e.episodeId !== nodeId);
        addEvents(memory, events, batch, nodeId);
        applyLedgerOps(memory, ops, batch.to);
        await ctx().saveMetadata();
        toastr.success('다시 요약했어요.');
        syncAfter();
    } catch (err) {
        if (String(err?.message) === 'aborted') toastr.info('중지했습니다.');
        else reportError('다시 요약 실패', err);
    } finally {
        busy = false;
        abortController = null;
        setBusyUI(false);
        setProgress('');
        refreshInjection();
        updateStatus();
    }
}

// ---------------------------------------------------------------- after each reply: contradiction check + live state

let turnBusy = false;
const CHECK_SWIPE = 1002;
const CHECK_CLEAR = 1003;

function afterTurnSystemPrompt(doCheck, doState) {
    const parts = ['You review one new reply of an ongoing interactive story against its established memory.', ''];
    parts.push('Reply with only these blocks:');
    if (doCheck) {
        parts.push(`
<issues>
[JSON array; [] if none]
</issues>
Each issue: {"quote":"<short quote from the new reply>","problem":"<what it contradicts and what the established fact is>"}
Report only real contradictions of established facts: dead or absent characters acting, wrong names, forgotten injuries, items in the wrong hands, characters knowing secrets they are not listed as knowing, broken promises with no explanation, wrong relationships or timeline. Do not report style, new information or plausible developments. Write each "problem" in Korean.`);
    }
    if (doState) {
        parts.push(`
<ledger>
[JSON array of updates caused by the new reply; [] if nothing changed]
</ledger>
Allowed operations: {"op":"scene","time":"...","place":"...","present":"...","mood":"..."}, {"op":"set","cat":"character|relation|thread|item","key":"...","value":"<complete updated fact>","importance":1-5}, {"op":"close","cat":"thread","key":"..."}. Reuse existing keys exactly. Keep it minimal. ${languageRule()}`);
    }
    return parts.join('\n');
}

async function afterTurn(messageId) {
    const s = getSettings();
    const doCheck = s.checkContradictions;
    const doState = s.liveStateUpdate;
    if (!s.enabled || (!doCheck && !doState) || turnBusy || !hasChat()) return;
    const memory = getMemory(false);
    if (!memory) return;
    const { chat } = ctx();
    const msg = chat[messageId];
    if (!msg || msg.is_user || msg.is_system) return;
    const chatId = ctx().getCurrentChatId();
    turnBusy = true;
    try {
        const recent = [];
        for (let i = Math.max(0, messageId - 6); i < messageId; i++) {
            if (chat[i] && !chat[i].is_system) recent.push(messageLine(chat[i], i));
        }
        const lore = await loreFor(`${recent.slice(-2).join('\n')}\n${messageLine(msg, messageId)}`, 1200);
        const user = [
            frameText(memory.frame) && `<story_frame>\n${frameText(memory.frame)}\n</story_frame>`,
            lore && `<lorebook_reference>\n${lore}\n</lorebook_reference>`,
            `<established_memory>\n${ledgerText(memory.ledger) || '(empty)'}\n\n${timelineText(memory, { lastN: 1 })}\n</established_memory>`,
            recent.length && `<recent_messages>\n${recent.slice(-4).join('\n\n')}\n</recent_messages>`,
            `<new_reply>\n${messageLine(msg, messageId)}\n</new_reply>`,
        ].filter(Boolean).join('\n\n');
        const out = await callModel(afterTurnSystemPrompt(doCheck, doState), user, { retries: 0 });
        if (!stillSameChat(chatId) || ctx().chat[messageId] !== msg) return;
        if (doCheck) {
            const issues = (parseJsonLenient(extractTag(out, 'issues') || '') || [])
                .filter(i => i && typeof i === 'object' && String(i.problem || '').trim())
                .slice(0, 6)
                .map(i => ({ quote: String(i.quote || '').slice(0, 200), problem: String(i.problem).slice(0, 400) }));
            msg.extra = msg.extra || {};
            msg.extra.lm_check = { issues, at: Date.now(), swipe: msg.swipe_id ?? 0 };
            decorateMessage(messageId);
            await ctx().saveChat();
            if (issues.length) toastr.warning(`기억과 다른 부분 ${issues.length}개를 찾았어요. 메시지 이름 옆 ⚠ 표시를 눌러 확인하세요.`, APP_NAME);
        }
        if (doState) {
            const ops = (parseJsonLenient(extractTag(out, 'ledger') || '') || []).filter(op => {
                const kind = String(op?.op || '').toLowerCase();
                if (kind === 'scene') return true;
                return ['set', 'close'].includes(kind) && ['character', 'relation', 'thread', 'item'].includes(String(op.cat || '').toLowerCase());
            });
            if (applyLedgerOps(memory, ops, messageId)) {
                await ctx().saveMetadata();
                refreshInjection();
                updateStatus();
            }
        }
    } catch (err) {
        console.warn(LOG_PREFIX, 'after-turn review failed', err);
    } finally {
        turnBusy = false;
    }
}

async function showCheckIssues(messageId) {
    const c = ctx();
    const msg = c.chat[messageId];
    const issues = msg?.extra?.lm_check?.issues || [];
    if (!issues.length) return;
    const isLast = messageId === c.chat.length - 1;
    const list = issues.map(i => `
<article class="lm-result lm-issue">
  ${i.quote ? `<p class="lm-quote">“${esc(i.quote)}”</p>` : ''}
  <p>${esc(i.problem)}</p>
</article>`).join('');
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div class="lm-root lm-manager"><div class="lm-manager-head"><h3><span class="lm-mascot lm-mascot-sm">${ELEPHANT_SVG}</span>기억과 다른 부분</h3></div><p class="lm-hint lm-pane-intro">코끼리가 기억과 맞지 않는다고 본 곳이에요. 맞지 않으면 새로 생성하거나, 괜찮으면 경고를 지우세요.</p><div class="lm-results">${list}</div></div>`;
    applyThemeMode(wrap.firstElementChild);
    const buttons = [{ text: '경고 지우기', result: CHECK_CLEAR, icon: 'fa-eraser' }];
    if (isLast) buttons.unshift({ text: '새로 생성', result: CHECK_SWIPE, icon: 'fa-rotate-right' });
    const result = await new c.Popup(wrap, c.POPUP_TYPE.TEXT, '', { okButton: '닫기', wide: true, allowVerticalScrolling: true, leftAlign: true, customButtons: buttons }).show();
    if (result === CHECK_SWIPE) {
        await c.executeSlashCommandsWithOptions('/swipes-swipe');
    } else if (result === CHECK_CLEAR) {
        delete msg.extra.lm_check;
        decorateMessage(messageId);
        await c.saveChat();
    }
}

// ---------------------------------------------------------------- message buttons

function decorateMessage(id) {
    const el = document.querySelector(`#chat .mes[mesid="${id}"]`);
    const msg = ctx().chat[id];
    if (!el || !msg) return;
    const extra = el.querySelector('.extraMesButtons');
    if (extra && !extra.querySelector('.lm-mes-pin')) {
        const view = document.createElement('div');
        view.className = 'mes_button lm-mes-view fa-solid fa-book-open';
        view.title = '코끼리: 이 메시지가 들어간 기억 보기';
        view.tabIndex = 0;
        const pin = document.createElement('div');
        pin.className = 'mes_button lm-mes-pin fa-solid fa-thumbtack';
        pin.title = '코끼리: 기억에 새기기';
        pin.tabIndex = 0;
        extra.prepend(pin);
        extra.prepend(view);
    }
    const view = el.querySelector('.lm-mes-view');
    if (view) view.style.display = msg.extra?.lm_owner && msg.extra.lm_owner !== SAGA_OWNER ? '' : 'none';
    const check = msg.extra?.lm_check;
    const show = !!check?.issues?.length && (check.swipe ?? 0) === (msg.swipe_id ?? 0);
    let badge = el.querySelector('.lm-check-badge');
    if (show && !badge) {
        badge = document.createElement('span');
        badge.className = 'lm-check-badge fa-solid fa-triangle-exclamation';
        badge.title = `코끼리: 기억과 다른 부분 ${check.issues.length}개`;
        badge.tabIndex = 0;
        el.querySelector('.name_text')?.after(badge);
    } else if (!show && badge) {
        badge.remove();
    }
}

function decorateAll() {
    document.querySelectorAll('#chat .mes[mesid]').forEach(el => decorateMessage(Number(el.getAttribute('mesid'))));
}

async function pinMessage(id) {
    if (!hasChat()) return;
    const c = ctx();
    const msg = c.chat[id];
    if (!msg) return;
    const value = await c.Popup.show.input('기억에 새기기', '코끼리가 꼭 기억할 내용으로 다듬어 주세요. 이 내용은 항상 AI에게 전달돼요.', stripMessage(msg.mes).slice(0, 500), { rows: 6 });
    const text = String(value ?? '').trim();
    if (!text) return;
    const memory = getMemory(true);
    pushHistory(memory, '기억에 새기기');
    memory.ledger.entries.push({ id: newId(), cat: 'note', key: `${msg.name || '메시지'} #${id}`, value: text, importance: 5, pinned: true, status: 'open', updatedAt: id, knownBy: [], due: '' });
    memory.events.push({ id: newId(), from: id, to: id, episodeId: null, text, characters: msg.name ? [msg.name] : [], place: '', items: [], keywords: [], when: '', importance: 5 });
    await c.saveMetadata();
    refreshInjection();
    updateStatus();
    syncAfter();
    toastr.success('"꼭 기억할 것"에 새겼어요.', APP_NAME);
}

function onDocumentClick(event) {
    const target = event.target.closest?.('.lm-mes-pin, .lm-mes-view, .lm-check-badge');
    if (!target) return;
    const id = Number(target.closest('.mes')?.getAttribute('mesid'));
    if (Number.isNaN(id)) return;
    event.stopPropagation();
    if (target.classList.contains('lm-mes-pin')) pinMessage(id);
    else if (target.classList.contains('lm-check-badge')) showCheckIssues(id);
    else openManager({ focusOwner: ctx().chat[id]?.extra?.lm_owner });
}

function onMessageReceived(id, type) {
    updateStatus();
    decorateMessage(Number(id));
    if (['quiet', 'impersonate', 'first_message'].includes(type)) return;
    maybeAutoCompress();
    setTimeout(() => afterTurn(Number(id)), 0);
}

// ---------------------------------------------------------------- storage helpers (backups, hand-off)

function store() {
    return SillyTavern.libs?.localforage || globalThis.localforage || null;
}

function downloadFile(name, content, type = 'application/json') {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function fileSafe(str) {
    return String(str || 'chat').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80);
}

function hasContent(memory) {
    return !!memory && (memory.timeline.length > 0 || memory.ledger.entries.length > 0 || !!memory.saga.text);
}

// Replaces the current memory with a stored copy and brings hidden flags in line.
async function restoreMemory(data, label) {
    const memory = getMemory(true);
    pushHistory(memory, label);
    const history = memory.history;
    const before = new Set(rangesToList(memory.hiddenRanges));
    const after = new Set(rangesToList(data.hiddenRanges || []));
    setHidden([...before].filter(i => !after.has(i)), false);
    setHidden([...after].filter(i => !before.has(i)), true);
    for (const key of Object.keys(memory)) delete memory[key];
    Object.assign(memory, emptyMemory(), structuredClone(data), { history });
    memory.frame = { ...emptyFrame(), ...memory.frame };
    retagFromRanges(memory);
    await ctx().saveChat();
    await ctx().saveMetadata();
    refreshInjection();
    updateStatus();
    syncAfter();
}

// ---------------------------------------------------------------- backups

function backupKey() {
    return `lm_backups_${hashString(String(ctx().getCurrentChatId()))}`;
}

async function saveBackup(label = '수동 백업') {
    const memory = getMemory(false);
    const lf = store();
    if (!memory || !lf) return false;
    const list = (await lf.getItem(backupKey())) || [];
    const { history, ...data } = memory;
    list.push({ at: Date.now(), label, data: structuredClone(data) });
    while (list.length > Math.max(1, getSettings().backupKeep)) list.shift();
    await lf.setItem(backupKey(), list);
    return true;
}

async function maybeAutoBackup(count) {
    const s = getSettings();
    const memory = getMemory(false);
    if (!s.autoBackupEvery || !memory) return;
    memory.opsSinceBackup = (memory.opsSinceBackup || 0) + count;
    if (memory.opsSinceBackup < s.autoBackupEvery) return;
    memory.opsSinceBackup = 0;
    try {
        await saveBackup('자동 백업');
    } catch (err) {
        console.warn(LOG_PREFIX, 'auto backup failed', err);
    }
}

async function openBackups() {
    const c = ctx();
    const lf = store();
    if (!lf) return toastr.error('이 브라우저에서는 백업 저장소를 쓸 수 없어요.');
    const list = (await lf.getItem(backupKey())) || [];
    const wrap = document.createElement('div');
    const rows = list.map((b, i) => `
<article class="lm-result lm-backup">
  <header><span class="lm-chip lm-chip-archive">${esc(b.label)}</span><span class="lm-range">${new Date(b.at).toLocaleString()}</span></header>
  <p class="lm-hint">타임라인 ${b.data.timeline?.length ?? 0}개, 기록 ${b.data.ledger?.entries?.length ?? 0}개, 사건 ${b.data.events?.length ?? 0}개, #${b.data.cursor}까지</p>
  <div class="lm-actions lm-actions-inline">
    <button type="button" class="menu_button lm-btn lm-btn-quiet" data-restore="${i}">${icon('backup')}<span>이 백업으로 되돌리기</span></button>
    <button type="button" class="menu_button lm-btn lm-btn-quiet" data-download="${i}">${icon('download')}<span>내려받기</span></button>
  </div>
</article>`).reverse().join('');
    wrap.innerHTML = `<div class="lm-root lm-manager"><div class="lm-manager-head"><h3><span class="lm-mascot lm-mascot-sm">${ELEPHANT_SVG}</span>백업</h3>
      <button type="button" class="menu_button lm-btn lm-btn-quiet" id="lm_backup_now">${icon('save')}<span>지금 백업</span></button></div>
      <p class="lm-hint lm-pane-intro">이 채팅의 기억을 브라우저에 최근 ${getSettings().backupKeep}개까지 보관해요. 압축을 ${getSettings().autoBackupEvery || '?'}번 할 때마다 자동으로 저장돼요.</p>
      <div class="lm-results">${rows || '<div class="lm-empty">아직 백업이 없어요. 지금 백업을 눌러 만들어 보세요.</div>'}</div></div>`;
    applyThemeMode(wrap.firstElementChild);
    const popup = new c.Popup(wrap, c.POPUP_TYPE.TEXT, '', { okButton: '닫기', wide: true, allowVerticalScrolling: true, leftAlign: true });
    wrap.addEventListener('click', async (event) => {
        const restore = event.target.closest('[data-restore]');
        const download = event.target.closest('[data-download]');
        if (event.target.closest('#lm_backup_now')) {
            if (await saveBackup('수동 백업')) toastr.success('백업했어요. 창을 다시 열면 목록에 보여요.');
        } else if (restore) {
            const item = list[Number(restore.dataset.restore)];
            if (!item || !await c.Popup.show.confirm('백업으로 되돌리기', `${new Date(item.at).toLocaleString()} 백업으로 기억을 바꿀까요? 되돌리기로 취소할 수 있어요.`)) return;
            await restoreMemory(item.data, '백업 복원');
            toastr.success('백업으로 되돌렸어요.');
            popup.completeCancelled();
        } else if (download) {
            const item = list[Number(download.dataset.download)];
            if (item) downloadFile(`elephant-backup-${fileSafe(c.getCurrentChatId())}-${item.at}.json`, JSON.stringify(item.data, null, 2));
        }
    });
    await popup.show();
}

// ---------------------------------------------------------------- carry memories into a new chat

function handoffKey() {
    const c = ctx();
    const id = c.groupId ? `g_${c.groupId}` : c.characters?.[c.characterId]?.avatar;
    return id ? `lm_handoff_${id}` : null;
}

function carryOver(memory) {
    const m = structuredClone(memory);
    const mark = (x) => { x.from = -1; x.to = -1; return x; };
    m.timeline.forEach(n => { mark(n); n.stale = false; n.msgCount = 0; });
    m.events.forEach(mark);
    m.archive.forEach(mark);
    m.saga.coversTo = -1;
    m.ledger.entries.forEach(e => { e.updatedAt = -1; });
    Object.assign(m, { cursor: -1, hiddenRanges: [], history: [], opsSinceBackup: 0, tagVersion: 1 });
    return m;
}

async function saveHandoff() {
    const key = handoffKey();
    const lf = store();
    const memory = getMemory(false);
    if (!key || !lf) return toastr.warning('캐릭터 채팅에서만 쓸 수 있어요.');
    if (!hasContent(memory)) return toastr.info('이어갈 기억이 아직 없어요.');
    await lf.setItem(key, { at: Date.now(), chatId: ctx().getCurrentChatId(), name: ctx().name2, memory: carryOver(memory), offered: [] });
    toastr.success('저장했어요. 이 캐릭터로 새 채팅을 열면 이어갈지 물어볼게요.', APP_NAME);
}

async function applyHandoff(data) {
    const c = ctx();
    const current = getMemory(true);
    if (hasContent(current) && !await c.Popup.show.confirm('이어가기', '이 채팅에 이미 기억이 있어요. 이어온 기억으로 바꿀까요?')) return false;
    await restoreMemory({ ...data.memory, cursor: -1, hiddenRanges: [] }, '이어가기');
    toastr.success('이전 채팅의 기억을 이어받았어요.', APP_NAME);
    return true;
}

async function loadHandoff() {
    const key = handoffKey();
    const lf = store();
    if (!key || !lf) return toastr.warning('캐릭터 채팅에서만 쓸 수 있어요.');
    const data = await lf.getItem(key);
    if (!data) return toastr.info('저장된 이어가기 기억이 없어요. 이전 채팅의 기억장에서 "새 채팅으로 이어가기"를 먼저 눌러주세요.');
    if (data.chatId === ctx().getCurrentChatId()) return toastr.info('기억을 저장한 바로 그 채팅이에요.');
    return applyHandoff(data);
}

async function offerHandoff() {
    try {
        if (!hasChat() || hasContent(getMemory(false)) || ctx().chat.length > 4) return;
        const key = handoffKey();
        const lf = store();
        if (!key || !lf) return;
        const data = await lf.getItem(key);
        const chatId = ctx().getCurrentChatId();
        if (!data || data.chatId === chatId || data.offered?.includes(chatId)) return;
        data.offered = [...(data.offered || []), chatId].slice(-50);
        await lf.setItem(key, data);
        const ok = await ctx().Popup.show.confirm('이어가기', `${data.name || '이 캐릭터'}와의 이전 채팅 기억이 있어요 (${new Date(data.at).toLocaleDateString()} 저장). 이 새 채팅으로 이어갈까요?`);
        if (ok && stillSameChat(chatId)) await applyHandoff(data);
    } catch (err) {
        console.warn(LOG_PREFIX, 'hand-off offer failed', err);
    }
}

// ---------------------------------------------------------------- export

const WI_DEFAULTS = Object.freeze({
    key: [], keysecondary: [], comment: '', content: '', constant: false, vectorized: false, selective: true,
    selectiveLogic: 0, addMemo: true, order: 100, position: 0, disable: false, ignoreBudget: false,
    excludeRecursion: false, preventRecursion: false, matchPersonaDescription: false, matchCharacterDescription: false,
    matchCharacterPersonality: false, matchCharacterDepthPrompt: false, matchScenario: false, matchCreatorNotes: false,
    delayUntilRecursion: 0, probability: 100, useProbability: true, depth: 4, outletName: '', group: '',
    groupOverride: false, groupWeight: 100, scanDepth: null, caseSensitive: null, matchWholeWords: null,
    useGroupScoring: null, automationId: '', role: 0, sticky: null, cooldown: null, delay: null,
    characterFilterNames: [], characterFilterTags: [], characterFilterExclude: false, triggers: [],
});

function buildWorldInfo(memory) {
    const entries = {};
    let uid = 0;
    const add = (fields) => {
        entries[uid] = { ...structuredClone(WI_DEFAULTS), uid, displayIndex: uid, ...fields };
        uid++;
    };
    const frame = frameText(memory.frame);
    if (frame) add({ comment: '코끼리: 작품 설정', content: frame, constant: true, order: 90 });
    if (memory.saga.text.trim()) add({ comment: '코끼리: 지금까지의 이야기', content: memory.saga.text.trim(), constant: true, order: 95 });
    for (const n of memory.timeline) {
        const keys = (n.keywords || []).slice(0, 10);
        add({ comment: `코끼리: ${n.title}`, key: keys, content: `${n.title}${n.when ? ` (${n.when})` : ''}: ${n.text}`, constant: keys.length === 0, order: 100 });
    }
    for (const e of memory.ledger.entries) {
        if (e.status === 'closed') continue;
        const known = e.knownBy?.length ? ` (known only by: ${e.knownBy.join(', ')})` : '';
        add({ comment: `코끼리 기록: ${CATEGORIES[e.cat] || e.cat} / ${e.key}`, key: [e.key], content: `${e.key}: ${e.value}${known}`, constant: e.cat === 'note', order: 100 });
    }
    return { entries };
}

function buildMarkdown(memory) {
    const out = [`# 코끼리의 기억장`, '', `채팅: ${ctx().getCurrentChatId()}`, `기억된 지점: #${memory.cursor}`, ''];
    const frame = frameText(memory.frame);
    if (frame) out.push('## 작품 설정', '', frame, '');
    if (memory.saga.text.trim()) out.push('## 지금까지의 이야기', '', memory.saga.text.trim(), '');
    if (memory.timeline.length) {
        out.push('## 타임라인', '');
        for (const n of memory.timeline) {
            const where = n.from === -1 ? '이전 채팅' : `#${n.from}~#${n.to}`;
            out.push(`### ${n.tier === 'chapter' ? '챕터' : '에피소드'}: ${n.title}`, '', `${where}${n.when ? `, 작중 ${n.when}` : ''}, 중요도 ${n.importance}`, '', n.text, '');
        }
    }
    const sc = memory.ledger.scene;
    out.push('## 기록부', '', `현재 상황: ${[sc.time, sc.place, sc.present, sc.mood].filter(Boolean).join(' / ') || '-'}`, '');
    for (const [cat, label] of Object.entries(CATEGORIES)) {
        const list = memory.ledger.entries.filter(e => e.cat === cat);
        if (!list.length) continue;
        out.push(`### ${label}`, '');
        for (const e of list) {
            const extra = [e.knownBy?.length && `아는 사람: ${e.knownBy.join(', ')}`, e.due && `기한: ${e.due}`, e.status === 'closed' && '해결됨'].filter(Boolean);
            out.push(`- **${e.key}**: ${e.value}${extra.length ? ` (${extra.join(', ')})` : ''}`);
        }
        out.push('');
    }
    if (memory.events.length) {
        out.push('## 사건', '');
        for (const e of memory.events) out.push(`- ${e.from === -1 ? '이전 채팅' : `#${e.from}~#${e.to}`}${e.when ? `, ${e.when}` : ''}: ${e.text}`);
        out.push('');
    }
    return out.join('\n');
}

async function openExportMenu(getData) {
    const c = ctx();
    const name = fileSafe(c.getCurrentChatId());
    const wrap = document.createElement('div');
    const option = (id, ic, title, desc) => `
<button type="button" class="lm-export-option" data-export="${id}">
  ${icon(ic)}<span class="lm-export-text"><b>${title}</b><span class="lm-hint">${desc}</span></span>
</button>`;
    wrap.innerHTML = `<div class="lm-root lm-manager"><div class="lm-manager-head"><h3><span class="lm-mascot lm-mascot-sm">${ELEPHANT_SVG}</span>내보내기</h3></div>
      <div class="lm-export-list">
        ${option('json', 'archive', '기억 백업 파일 (.json)', '그대로 다시 가져올 수 있는 전체 백업이에요.')}
        ${option('md', 'frame', '읽기용 문서 (.md)', '줄거리, 타임라인, 기록부, 사건을 사람이 읽기 좋게 정리해요.')}
        ${option('wi', 'wiki', '로어북 (월드인포 .json)', 'ST 월드인포에서 가져오기로 넣을 수 있는 형식이에요.')}
        ${option('settings', 'sliders', '확장 설정 (.json)', '이 확장의 설정만 저장해요. 다른 기기에서 가져오기로 똑같이 맞출 수 있어요.')}
      </div></div>`;
    applyThemeMode(wrap.firstElementChild);
    wrap.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-export]');
        if (!btn) return;
        const memory = getData();
        switch (btn.dataset.export) {
            case 'json': {
                const { history, ...data } = memory;
                downloadFile(`elephant-memory-${name}.json`, JSON.stringify(data, null, 2));
                break;
            }
            case 'md':
                downloadFile(`elephant-memory-${name}.md`, buildMarkdown(memory), 'text/markdown');
                break;
            case 'wi':
                downloadFile(`elephant-lorebook-${name}.json`, JSON.stringify(buildWorldInfo(memory), null, 2));
                break;
            case 'settings':
                downloadFile('elephant-settings.json', JSON.stringify({ type: 'dont-think-of-elephant-settings', version: 1, settings: getSettings() }, null, 2));
                break;
        }
    });
    await new c.Popup(wrap, c.POPUP_TYPE.TEXT, '', { okButton: '닫기', allowVerticalScrolling: true, leftAlign: true }).show();
}

function applyImportedSettings(data) {
    const s = getSettings();
    for (const key of Object.keys(defaultSettings)) {
        if (Object.hasOwn(data.settings || {}, key)) s[key] = data.settings[key];
    }
    ctx().saveSettingsDebounced();
    syncSettingInputs();
    refreshInjection();
    updateStatus();
}

// ---------------------------------------------------------------- injection presets

const INJECT_PRESETS = {
    stable: { label: '안정형 (추천)', desc: '기억은 캐릭터 설정 뒤에, 짧은 리마인더와 회상은 최근 대화 근처에 넣어요. 대부분의 모델에 잘 맞아요.', values: { injectPosition: 'in_prompt', injectRole: 'system', anchorEnabled: true, anchorDepth: 3, recallDepth: 2 } },
    recent: { label: '최근 강조형', desc: '긴 채팅에서 앞쪽 내용을 자주 놓칠 때. 기억 전체를 최근 대화 가까이에 넣어요.', values: { injectPosition: 'in_chat', injectDepth: 6, injectRole: 'system', anchorEnabled: true, anchorDepth: 2, recallDepth: 1 } },
    user: { label: '유저 메시지형', desc: 'system 지시를 약하게 따르는 모델용. 기억과 요약 지시를 유저 역할로 보내요.', values: { injectPosition: 'in_chat', injectDepth: 6, injectRole: 'user', anchorEnabled: true, anchorDepth: 2, recallDepth: 1, systemAsUser: true } },
    light: { label: '토큰 절약형', desc: '리마인더를 끄고 회상 양을 줄여서 토큰을 아껴요.', values: { injectPosition: 'in_prompt', injectRole: 'system', anchorEnabled: false, recallTopK: 3, recallTokenBudget: 800, recallDepth: 2 } },
};

function applyPreset(name) {
    const preset = INJECT_PRESETS[name];
    if (!preset) return;
    Object.assign(getSettings(), preset.values, { injectPreset: name });
    ctx().saveSettingsDebounced();
    syncSettingInputs();
    refreshInjection();
    toastr.success(`"${preset.label}" 프리셋을 적용했어요.`);
}

function syncSettingInputs() {
    const root = document.getElementById('lm_settings');
    if (!root) return;
    const s = getSettings();
    root.querySelectorAll('[data-lm-setting]').forEach(el => {
        const key = el.dataset.lmSetting;
        if (el.type === 'checkbox') el.checked = !!s[key];
        else el.value = s[key];
    });
    const desc = root.querySelector('#lm_preset_desc');
    if (desc) desc.textContent = INJECT_PRESETS[s.injectPreset]?.desc || '';
}

// ---------------------------------------------------------------- questions about the story

let askBusy = false;

async function askMemory(question) {
    const s = getSettings();
    const memory = getMemory(false);
    if (!memory || (!hasContent(memory) && !memory.events?.length)) {
        return { answer: '아직 코끼리가 기억한 이야기가 없어요. 먼저 압축해 주세요.', sources: [] };
    }
    const queries = [question];
    if (s.queryExpansion) {
        try {
            queries.push(...await expandQueries(memory, [{ mes: question, name: ctx().name1, is_system: false }]));
        } catch (err) {
            console.warn(LOG_PREFIX, 'query expansion skipped', err);
        }
    }
    const { results } = await hybridRecall(memory, queries, { topK: s.qnaTopK, budget: 3500 });
    const index = memory.timeline
        .map(n => `- ${n.title} (${rangeLabel(n.from, n.to)}${n.when ? `; in-story ${n.when}` : ''})`)
        .join('\n');
    const relevant = results.map(({ item }) => `- (${rangeLabel(item.from ?? -2, item.to ?? item.from ?? -2)}${item.when ? `; in-story ${item.when}` : ''}) ${item.display.replace(/\n+/g, ' / ')}`).join('\n');
    const lore = await loreFor(`${question}\n${relevant}`, 1000);
    const system = 'You answer the user\'s questions about an ongoing story using only the memory notes provided. Answer in Korean. Say when it happened (in-story time if known, and message numbers written like #123), what happened, and who was involved. If several moments fit, list them in order. If the notes do not contain the answer, say so plainly instead of guessing. Keep it short: 2-6 sentences unless the question asks for detail. Plain text only.';
    const user = [
        frameText(memory.frame) && `<story_frame>\n${frameText(memory.frame)}\n</story_frame>`,
        memory.saga.text.trim() && `<story_so_far>\n${memory.saga.text.trim()}\n</story_so_far>`,
        index && `<timeline_index>\n${index}\n</timeline_index>`,
        `<ledger>\n${ledgerText(memory.ledger, { includeClosed: true }) || '(empty)'}\n</ledger>`,
        relevant && `<relevant_memories>\n${relevant}\n</relevant_memories>`,
        lore && `<lorebook_reference>\n${lore}\n</lorebook_reference>`,
        `<question>\n${question}\n</question>`,
    ].filter(Boolean).join('\n\n');
    const answer = cleanOutput(await callModel(system, user, { retries: 1 }));
    const sources = results.map(({ item }) => ({ kind: item.kind, from: item.from, to: item.to, when: item.when || '', text: item.display.slice(0, 300) }));
    memory.qna = [...(memory.qna || []), { q: question, a: answer, at: Date.now(), sources }].slice(-30);
    ctx().saveMetadataDebounced?.();
    return { answer, sources };
}

function linkifyRefs(text) {
    return esc(text).replace(/#(\d+)/g, '<button type="button" class="lm-ref" data-jump="$1">#$1</button>');
}

function askAnswerHtml(entry) {
    const kind = { event: '사건', archive: '보관', raw: '원본 대사' };
    const sources = (entry.sources || []).slice(0, 8).map(src => `
<li><span class="lm-chip lm-chip-${src.kind}">${kind[src.kind] || src.kind}</span>${src.from >= 0 ? `<button type="button" class="lm-ref" data-jump="${src.from}">#${src.from}</button>` : '<span class="lm-range">이전 채팅</span>'}<span class="lm-src-text">${esc(src.text)}</span></li>`).join('');
    return `
<article class="lm-answer">
  <p class="lm-answer-q">${esc(entry.q)}</p>
  <p class="lm-answer-a">${linkifyRefs(entry.a)}</p>
  ${sources ? `<details class="lm-sources"><summary>찾아본 기억 ${entry.sources.length}개</summary><ul>${sources}</ul></details>` : ''}
</article>`;
}

function askPanelHtml(memory) {
    const history = (memory.qna || []).slice(-10).reverse().map(askAnswerHtml).join('');
    return `
<div class="lm-ask">
  <form class="lm-ask-row" id="lm_ask_form">
    <input class="text_pole" id="lm_ask_input" placeholder="예: 레온이랑 처음 만난 게 언제였지?" autocomplete="off" aria-label="질문">
    <button type="submit" class="menu_button lm-btn lm-btn-primary" id="lm_ask_btn">${icon('ask')}<span>묻기</span></button>
  </form>
  <p class="lm-hint">기억과 로어북을 찾아서 언제, 무슨 일이 있었는지 알려줘요. #번호를 누르면 그 메시지로 이동해요.</p>
  <div id="lm_ask_out">${history || '<div class="lm-empty">궁금한 걸 물어보세요. 코끼리가 기억을 뒤져볼게요.</div>'}</div>
</div>`;
}

function bindAskPanel(root, onJump) {
    const form = root.querySelector('#lm_ask_form');
    const input = root.querySelector('#lm_ask_input');
    const out = root.querySelector('#lm_ask_out');
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const question = input.value.trim();
        if (!question || askBusy) return;
        askBusy = true;
        const btn = root.querySelector('#lm_ask_btn');
        btn.disabled = true;
        const pending = document.createElement('div');
        pending.className = 'lm-answer lm-pending';
        pending.innerHTML = `<p class="lm-answer-q">${esc(question)}</p><p class="lm-hint">기억을 찾아보는 중…</p>`;
        out.querySelector('.lm-empty')?.remove();
        out.prepend(pending);
        try {
            const result = await askMemory(question);
            pending.outerHTML = askAnswerHtml({ q: question, a: result.answer, sources: result.sources });
            input.value = '';
        } catch (err) {
            const detail = errorDetail(err);
            const hint = errorHint(detail);
            pending.innerHTML = `<p class="lm-answer-q">${esc(question)}</p><p class="lm-warn">답을 만들지 못했어요. ${esc(hint)}</p><p class="lm-hint">${esc(detail)}</p>`;
        } finally {
            askBusy = false;
            btn.disabled = false;
        }
    });
    root.addEventListener('click', (event) => {
        const ref = event.target.closest('[data-jump]');
        if (ref) onJump(Number(ref.dataset.jump));
    });
}

async function jumpToMessage(id) {
    if (Number.isNaN(id) || id < 0) return;
    try {
        await ctx().executeSlashCommandsWithOptions(`/chat-jump ${id}`);
    } catch (err) {
        console.warn(LOG_PREFIX, 'jump failed', err);
    }
}

async function openAsk() {
    if (!hasChat()) return toastr.warning('채팅을 먼저 열어주세요.');
    const c = ctx();
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div class="lm-root lm-manager"><div class="lm-manager-head"><h3><span class="lm-mascot lm-mascot-sm">${ELEPHANT_SVG}</span>코끼리에게 묻기</h3></div>${askPanelHtml(getMemory(true))}</div>`;
    applyThemeMode(wrap.firstElementChild);
    const popup = new c.Popup(wrap, c.POPUP_TYPE.TEXT, '', { okButton: '닫기', wide: true, allowVerticalScrolling: true, leftAlign: true });
    bindAskPanel(wrap, async (id) => {
        await popup.completeCancelled();
        jumpToMessage(id);
    });
    const showing = popup.show();
    setTimeout(() => wrap.querySelector('#lm_ask_input')?.focus(), 60);
    await showing;
}

// ---------------------------------------------------------------- wiki

function collectEntities(memory) {
    const map = new Map();
    const add = (name, type, weight) => {
        const clean = String(name || '').trim();
        if (clean.length < 2 || clean.length > 40) return;
        const key = clean.toLowerCase();
        const cur = map.get(key) || { name: clean, type, score: 0 };
        cur.score += weight;
        if (cur.type === 'term' && type !== 'term') cur.type = type;
        map.set(key, cur);
    };
    for (const e of memory.ledger.entries) {
        if (e.cat === 'character') add(e.key, 'character', 6);
        else if (e.cat === 'item') add(e.key, 'item', 4);
        else if (e.cat === 'relation') e.key.split(/\s*(?:->|→|➡|<->|↔|\/|,)\s*/).forEach(n => add(n, 'character', 2));
        else if (e.cat === 'fact' && e.key.length <= 24) add(e.key, 'term', 1);
    }
    for (const ev of memory.events) {
        (ev.characters || []).forEach(n => add(n, 'character', 1));
        if (ev.place) add(ev.place, 'place', 1);
        (ev.items || []).forEach(n => add(n, 'item', 1));
    }
    if (memory.ledger.scene.place) add(memory.ledger.scene.place, 'place', 2);
    return [...map.values()].filter(e => e.score >= 2).sort((a, b) => b.score - a.score).slice(0, getSettings().wikiMaxPages);
}

function entityContext(memory, ent) {
    const low = ent.name.toLowerCase();
    const has = (text) => String(text || '').toLowerCase().includes(low);
    const ledger = memory.ledger.entries.filter(e => has(e.key) || has(e.value)).slice(0, 12)
        .map(e => `- [${CATEGORY_EN[e.cat] || e.cat}] ${e.key}: ${e.value}${e.knownBy?.length ? ` (known only by ${e.knownBy.join(', ')})` : ''}`);
    const events = memory.events.filter(e => has([e.text, ...(e.characters || []), e.place, ...(e.items || [])].join(' ')));
    const important = [...events].sort((a, b) => b.importance - a.importance).slice(0, 14);
    const chosen = events.filter(e => important.includes(e)).map(e => `- (${rangeLabel(e.from ?? -2, e.to ?? -2)}${e.when ? `; in-story ${e.when}` : ''}) ${e.text}`);
    const nodes = memory.timeline.filter(n => has(n.title) || has(n.text)).slice(0, 4).map(n => `- ${n.title}: ${n.text.slice(0, 300)}`);
    return [ledger.length && `Ledger:\n${ledger.join('\n')}`, chosen.length && `Events (oldest first):\n${chosen.join('\n')}`, nodes.length && `Timeline mentions:\n${nodes.join('\n')}`]
        .filter(Boolean).join('\n');
}

async function buildWiki() {
    if (busy) return toastr.warning('이미 작업 중입니다.');
    const memory = getMemory(false);
    if (!hasContent(memory)) return toastr.info('위키로 정리할 기억이 아직 없어요.');
    const entities = collectEntities(memory);
    if (!entities.length) return toastr.info('정리할 인물이나 장소를 찾지 못했어요.');
    const s = getSettings();
    const batches = [];
    for (let i = 0; i < entities.length; i += s.wikiBatch) batches.push(entities.slice(i, i + s.wikiBatch));
    const ok = await ctx().Popup.show.confirm('위키 만들기', `인물·장소·물건 ${entities.length}개를 ${batches.length}번에 나눠 정리해요. 요약 모델을 ${batches.length}번 호출해요. 진행할까요?`);
    if (!ok) return;
    const chatId = ctx().getCurrentChatId();
    busy = true;
    abortController = new AbortController();
    setBusyUI(true);
    let made = 0;
    try {
        const system = `You write a concise wiki about the characters, places, items and terms of an ongoing story, using only the notes given. ${languageRule()}
Reply with only a JSON array, one object per requested entry:
{"title":"<name>","type":"character|place|item|group|term","aliases":["..."],"summary":"<1-2 sentences>","details":"<short paragraphs or lines starting with '- ': profile, what happened with them, current state>","relations":["<other name>: <relation>"],"firstSeen":"<when first mentioned: message range or in-story time>","status":"<current status in one line>"}
Do not invent facts. Leave out an entry if the notes say nothing meaningful about it.`;
        for (let b = 0; b < batches.length; b++) {
            if (abortController.signal.aborted || !stillSameChat(chatId)) break;
            setProgress(`위키 정리 중 ${b + 1}/${batches.length}`);
            const batch = batches[b];
            const lore = await loreFor(batch.map(e => e.name).join('\n'), 1200);
            const user = [
                frameText(memory.frame) && `<story_frame>\n${frameText(memory.frame)}\n</story_frame>`,
                lore && `<lorebook_reference>\n${lore}\n</lorebook_reference>`,
                ...batch.map(e => `<entry name="${e.name.replace(/"/g, "'")}" type="${e.type}">\n${entityContext(memory, e) || '(no notes)'}\n</entry>`),
                `Write the wiki entries for: ${batch.map(e => e.name).join(', ')}.`,
            ].filter(Boolean).join('\n\n');
            const out = await callModel(system, user);
            const pages = (parseJsonLenient(out) || []).filter(p => p && typeof p === 'object' && String(p.title || '').trim() && String(p.summary || p.details || '').trim());
            if (!stillSameChat(chatId)) break;
            if (!memory.wiki) memory.wiki = { updatedAt: 0, pages: [] };
            for (const p of pages) {
                const title = String(p.title).trim().slice(0, 80);
                const page = {
                    id: newId(),
                    title,
                    type: ['character', 'place', 'item', 'group', 'term'].includes(p.type) ? p.type : 'term',
                    aliases: toList(p.aliases),
                    summary: String(p.summary || '').trim(),
                    details: String(p.details || '').trim(),
                    relations: toList(p.relations),
                    firstSeen: String(p.firstSeen || '').trim().slice(0, 80),
                    status: String(p.status || '').trim().slice(0, 200),
                    updatedAt: Date.now(),
                };
                const idx = memory.wiki.pages.findIndex(x => x.title.toLowerCase() === title.toLowerCase());
                if (idx >= 0) memory.wiki.pages[idx] = { ...page, id: memory.wiki.pages[idx].id };
                else memory.wiki.pages.push(page);
                made++;
            }
            memory.wiki.updatedAt = Date.now();
            await ctx().saveMetadata();
        }
        toastr.success(`위키 문서 ${made}개를 정리했어요.`, APP_NAME);
    } catch (err) {
        if (String(err?.message) === 'aborted') toastr.info(`중지했어요. (${made}개 정리됨)`);
        else reportError('위키 만들기 실패', err);
    } finally {
        busy = false;
        abortController = null;
        setBusyUI(false);
        setProgress('');
        updateStatus();
    }
}

const WIKI_TYPES = { character: '인물', place: '장소', item: '물건', group: '집단', term: '용어' };

function wikiPageHtml(p) {
    return `
<div class="lm-wiki-page lm-item" data-wiki-id="${esc(p.id)}">
  <div class="lm-wiki-head">
    <input type="checkbox" class="lm-sel" aria-label="선택">
    <span class="lm-chip lm-chip-wiki-${p.type}">${WIKI_TYPES[p.type] || p.type}</span>
    <span class="lm-wiki-title">${esc(p.title)}</span>
    <span class="lm-spacer"></span>
    ${deleteButton()}
  </div>
  <p class="lm-wiki-sum">${esc(p.summary)}</p>
  <details class="lm-wiki-more">
    <summary>자세히</summary>
    <div class="lm-wiki-body">
      ${p.aliases?.length ? `<p class="lm-hint">다른 이름: ${esc(p.aliases.join(', '))}</p>` : ''}
      ${p.status ? `<p><b>현재</b> ${esc(p.status)}</p>` : ''}
      ${p.details ? `<p class="lm-wiki-details">${esc(p.details)}</p>` : ''}
      ${p.relations?.length ? `<ul class="lm-wiki-rel">${p.relations.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
      ${p.firstSeen ? `<p class="lm-hint">처음 등장: ${esc(p.firstSeen)}</p>` : ''}
    </div>
  </details>
</div>`;
}

function wikiMarkdown(memory) {
    const out = ['# 코끼리 위키', ''];
    for (const [type, label] of Object.entries(WIKI_TYPES)) {
        const pages = (memory.wiki?.pages || []).filter(p => p.type === type);
        if (!pages.length) continue;
        out.push(`## ${label}`, '');
        for (const p of pages) {
            out.push(`### ${p.title}`, '');
            if (p.aliases?.length) out.push(`다른 이름: ${p.aliases.join(', ')}`, '');
            out.push(p.summary, '');
            if (p.status) out.push(`**현재**: ${p.status}`, '');
            if (p.details) out.push(p.details, '');
            if (p.relations?.length) out.push(...p.relations.map(r => `- ${r}`), '');
            if (p.firstSeen) out.push(`처음 등장: ${p.firstSeen}`, '');
        }
    }
    return out.join('\n');
}

function wikiHtml(memory) {
    const pages = memory.wiki?.pages || [];
    const toc = Object.entries(WIKI_TYPES).map(([type, label]) => {
        const list = pages.filter(p => p.type === type);
        return list.length ? `<h3>${label}</h3><ul>${list.map(p => `<li><a href="#p-${esc(p.id)}">${esc(p.title)}</a></li>`).join('')}</ul>` : '';
    }).join('');
    const body = pages.map(p => `
<section id="p-${esc(p.id)}"><h2>${esc(p.title)} <small>${WIKI_TYPES[p.type] || ''}</small></h2>
${p.aliases?.length ? `<p class="m">다른 이름: ${esc(p.aliases.join(', '))}</p>` : ''}
<p class="s">${esc(p.summary)}</p>
${p.status ? `<p><b>현재</b> ${esc(p.status)}</p>` : ''}
${p.details ? `<p class="d">${esc(p.details)}</p>` : ''}
${p.relations?.length ? `<ul>${p.relations.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
${p.firstSeen ? `<p class="m">처음 등장: ${esc(p.firstSeen)}</p>` : ''}</section>`).join('');
    return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>코끼리 위키</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>:root{--bg:#FAF8F4;--card:#fff;--ink:#22212A;--mute:#6E6A77;--line:#E7E1D6;--acc:#B9853A}@media(prefers-color-scheme:dark){:root{--bg:#18171C;--card:#211F27;--ink:#EDE9E2;--mute:#A39DAD;--line:#34313C;--acc:#D8A85A}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.7 'Pretendard Variable',Pretendard,system-ui,sans-serif;letter-spacing:-.01em}
.wrap{display:grid;grid-template-columns:240px 1fr;gap:32px;max-width:1080px;margin:0 auto;padding:40px 20px}nav{position:sticky;top:20px;align-self:start;font-size:14px}nav h3{font-size:12px;color:var(--mute);margin:18px 0 6px;font-weight:600}nav ul{list-style:none;margin:0;padding:0}nav a{color:var(--ink);text-decoration:none;display:block;padding:3px 0}nav a:hover{color:var(--acc)}
h1{font-size:28px;margin:0 0 24px;font-weight:700}section{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:22px 24px;margin-bottom:14px}section h2{margin:0 0 8px;font-size:20px}section h2 small{font-size:12px;color:var(--acc);font-weight:600;margin-left:6px}
.s{font-weight:500}.d{white-space:pre-wrap}.m{color:var(--mute);font-size:14px}@media(max-width:760px){.wrap{grid-template-columns:1fr}nav{position:static}}</style></head>
<body><div class="wrap"><nav><h1>코끼리 위키</h1>${toc}</nav><main>${body || '<p>비어 있어요.</p>'}</main></div></body></html>`;
}

// ---------------------------------------------------------------- automatic compression

function maybeAutoCompress() {
    const s = getSettings();
    if (!s.enabled || !s.autoCompress || busy || !hasChat()) return;
    if (unsummarizedRange().count < s.autoCompressAt) return;
    setTimeout(() => runCompress({ auto: true }), 400);
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
        if (!node.condensed) archiveNode(memory, node, 'timeline', node.id);
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
    const chapterId = newId();
    for (const n of run) archiveNode(memory, n, 'timeline', chapterId);
    const runIds = run.map(n => n.id);
    retagOwners(runIds, chapterId);
    for (const e of memory.events) if (runIds.includes(e.episodeId)) e.episodeId = chapterId;
    for (const a of memory.archive) if (runIds.includes(a.ownerId)) a.ownerId = chapterId;
    const chapter = {
        id: chapterId,
        tier: 'chapter',
        msgCount: run.reduce((sum, n) => sum + (n.msgCount || (n.to - n.from + 1)), 0),
        when: [run[0].when, run[run.length - 1].when].filter(Boolean).join(' ~ '),
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
    const runIds = run.map(n => n.id);
    for (const n of run) archiveNode(memory, n, 'timeline', SAGA_OWNER);
    retagOwners(runIds, SAGA_OWNER);
    for (const e of memory.events) if (runIds.includes(e.episodeId)) e.episodeId = SAGA_OWNER;
    for (const a of memory.archive) if (runIds.includes(a.ownerId)) a.ownerId = SAGA_OWNER;
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
        await ctx().saveChat();
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
            reportError('정리 실패', err);
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
    retagFromRanges(memory);
    await ctx().saveChat();
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
    clearTags();
    const frame = memory.frame;
    const fresh = emptyMemory();
    fresh.frame = frame;
    ctx().chatMetadata[META_KEY] = fresh;
    await purgeVectors();
    await ctx().saveChat();
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

// ---------------------------------------------------------------- icons
// Hand-drawn line icons (24px grid, 1.7 stroke) used across the extension UI.

const ICONS = {
    compress: '<path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="m14 10 6.5-6.5"/><path d="M3.5 20.5 10 14"/>',
    layers: '<path d="M12 3 2.5 8 12 13l9.5-5z"/><path d="m2.5 12.5 9.5 5 9.5-5"/><path d="m2.5 17 9.5 5 9.5-5"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2.5"/>',
    book: '<path d="M4 19.5V5a2 2 0 0 1 2-2h13v14H6.5A2.5 2.5 0 0 0 4 19.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H19v-5"/>',
    sparkle: '<path d="m12 3.5 1.9 5.1 5.1 1.9-5.1 1.9-1.9 5.1-1.9-5.1-5.1-1.9 5.1-1.9z"/><path d="m19 15.5.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    feather: '<path d="M20.2 3.8a6 6 0 0 0-8.5 0L5 10.5V19h8.5l6.7-6.7a6 6 0 0 0 0-8.5z"/><path d="M16 8 2.5 21.5"/><path d="M17.5 15H9"/>',
    ruler: '<rect x="2.5" y="7" width="19" height="10" rx="2"/><path d="M7 7v3M11 7v4M15 7v3M19 7v4"/>',
    bulb: '<path d="M9 18h6M10 21.5h4"/><path d="M12 2.5a6.5 6.5 0 0 0-4 11.6c.7.6 1 1.4 1 2.4h6c0-1 .3-1.8 1-2.4a6.5 6.5 0 0 0-4-11.6z"/>',
    shield: '<path d="M12 2.8 4.5 5.8v5.7c0 4.6 3.1 8.4 7.5 9.7 4.4-1.3 7.5-5.1 7.5-9.7V5.8z"/><path d="m9 12 2 2 4-4.5"/>',
    plug: '<path d="M9 3v5M15 3v5"/><path d="M6.5 8h11v3.5a5.5 5.5 0 0 1-11 0z"/><path d="M12 17v4"/>',
    db: '<ellipse cx="12" cy="5.5" rx="7.5" ry="2.8"/><path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13"/><path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20.5 20.5-4.8-4.8"/>',
    export: '<path d="M12 15V3.5"/><path d="m7.5 8 4.5-4.5L16.5 8"/><path d="M5 14v5.5h14V14"/>',
    import: '<path d="M12 3.5V15"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M5 14v5.5h14V14"/>',
    download: '<path d="M12 3.5V15"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M5 19.5h14"/>',
    backup: '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3.5 4v4.5H8"/><path d="M12 7.5V12l3 2"/>',
    handoff: '<path d="M4 12h15"/><path d="m13.5 6.5 5.5 5.5-5.5 5.5"/>',
    receive: '<path d="M20 12H5"/><path d="M10.5 6.5 5 12l5.5 5.5"/>',
    reset: '<path d="M20 20H8.5l-4.7-4.7a1.5 1.5 0 0 1 0-2.1l9.4-9.4a1.5 1.5 0 0 1 2.1 0l5 5a1.5 1.5 0 0 1 0 2.1L11 20"/><path d="m8.5 8.5 7 7"/>',
    trash: '<path d="M4 6.5h16"/><path d="M9.5 6.5V4h5v2.5"/><path d="m6.5 6.5.8 13.5h9.4l.8-13.5"/><path d="M10 10.5v6M14 10.5v6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    pin: '<path d="M9 3.5h6l-1 5 3.5 3.5v2h-11v-2L10 8.5z"/><path d="M12 14v6.5"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    frame: '<path d="M5 3.5h11.5L19 6v14.5H5z"/><path d="M8.5 9h7M8.5 13h7M8.5 17h4"/>',
    timeline: '<circle cx="6" cy="6" r="1.8"/><circle cx="6" cy="12" r="1.8"/><circle cx="6" cy="18" r="1.8"/><path d="M10.5 6H20M10.5 12H17M10.5 18H19"/>',
    ledger: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.2"/><path d="M5.8 16c.6-1.6 1.8-2.4 3.2-2.4s2.6.8 3.2 2.4"/><path d="M14.5 10h4M14.5 13.5h3"/>',
    events: '<path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z"/>',
    wiki: '<path d="M2.5 5h6A3.5 3.5 0 0 1 12 8.5V20a2.5 2.5 0 0 0-2.5-2.5h-7z"/><path d="M21.5 5h-6A3.5 3.5 0 0 0 12 8.5V20a2.5 2.5 0 0 1 2.5-2.5h7z"/>',
    ask: '<path d="M20.5 12a8.5 8.5 0 0 1-12.6 7.4l-4.4 1.1 1.1-4.4A8.5 8.5 0 1 1 20.5 12z"/><path d="M9.8 9.5a2.3 2.3 0 0 1 4.4.8c0 1.6-2.2 2-2.2 3.2"/><path d="M12 16.3v.2"/>',
    archive: '<rect x="3" y="3.5" width="18" height="4.5" rx="1"/><path d="M5 8v12.5h14V8"/><path d="M10 12h4"/>',
    userpen: '<circle cx="10" cy="7.5" r="4"/><path d="M3 20.5a7 7 0 0 1 10.5-6"/><path d="m17.5 13.5 3 3-5 5h-3v-3z"/>',
    range: '<rect x="3.5" y="4" width="5" height="5" rx="1"/><rect x="3.5" y="15" width="5" height="5" rx="1"/><path d="M12 6.5h8.5M12 17.5h8.5M6 10v4"/>',
    rotate: '<path d="M20 11.5A8 8 0 1 0 17.6 17"/><path d="M20.5 4.5v7h-7"/>',
    save: '<path d="M5 3.5h11.5L20 7v13.5H4V4.5a1 1 0 0 1 1-1z"/><path d="M8 3.5v5h7.5v-5"/><path d="M7.5 20.5v-6h9v6"/>',
    alert: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.3"/>',
};

function icon(name) {
    return `<svg class="lm-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;
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
    remindAt: '개', autoBackupEvery: '번', backupKeep: '개', expansionTimeoutMs: 'ms', memoryBudget: '토큰', protectRecent: '개', maxEpisodes: '개', chapterSize: '개',
    maxChapters: '개', sagaMaxWords: '단어', staleAfter: '메시지', archiveMax: '개', maxUndo: '회',
    recallTopK: '개', recallTokenBudget: '토큰', recallScan: '개', vectorThreshold: '%', rawChunkMessages: '개',
    rawChunkChars: '자', eventMax: '개', queryTimeoutMs: 'ms', loreTokenBudget: '토큰',
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
        if (node.from < 0) continue;
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

function iconToggle(cls, ic, title, checked) {
    const name = { 'fa-thumbtack': 'pin', 'fa-check': 'check' }[ic] || ic;
    return `<label class="lm-icon-toggle" title="${title}"><input type="checkbox" class="${cls}" ${checked ? 'checked' : ''} aria-label="${title}">${icon(name)}</label>`;
}

function bulkBar(scope, extra = '') {
    return `
<div class="lm-bulk" data-scope="${scope}">
  <label class="lm-bulk-all"><input type="checkbox" class="lm-sel-all" aria-label="전체 선택"><span>전체</span></label>
  <span class="lm-bulk-count">0개 선택</span>
  <span class="lm-spacer"></span>
  <button type="button" class="lm-chipbtn lm-range-mode" title="켜고 첫 항목과 끝 항목을 차례로 누르면 그 사이를 한 번에 선택해요. 컴퓨터에서는 Shift를 누른 채 눌러도 돼요">${icon('range')}<span>범위 선택</span></button>
  <button type="button" class="lm-chipbtn lm-chipbtn-danger lm-bulk-del" disabled>${icon('trash')}<span>선택 삭제</span></button>
  ${extra}
</div>`;
}

function selBox() {
    return '<input type="checkbox" class="lm-sel" aria-label="선택">';
}

function deleteButton() {
    return `<button type="button" class="lm-icon-btn lm-del" title="삭제 (다시 누르면 취소)" aria-label="삭제">${icon('trash')}</button>`;
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
    <button type="button" class="lm-icon-btn lm-add-entry" data-cat="${cat}" title="${label} 항목 추가">${icon('plus')}</button>
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
          ${icon('compress')}<span>압축</span><span class="lm-badge" id="lm_badge" hidden></span>
        </button>
        <button type="button" class="menu_button lm-btn" id="lm_btn_all" title="남은 미요약 메시지를 처음부터 전부 요약합니다">
          ${icon('layers')}<span>전체 압축</span>
        </button>
        <button type="button" class="menu_button lm-btn lm-btn-stop" id="lm_btn_stop" title="진행 중인 작업을 멈춥니다">
          ${icon('stop')}<span>중지</span>
        </button>
      </div>
      <div class="lm-actions lm-actions-sub">
        <button type="button" class="menu_button lm-btn lm-btn-quiet" id="lm_btn_manager">${icon('book')}<span>기억장</span></button>
        <button type="button" class="menu_button lm-btn lm-btn-quiet" id="lm_btn_compact" title="덜 중요한 기억부터 줄이고 오래된 것을 합칩니다">${icon('sparkle')}<span>정리</span></button>
        <button type="button" class="menu_button lm-btn lm-btn-quiet" id="lm_btn_undo">${icon('undo')}<span>되돌리기</span></button>
      </div>
      <label class="lm-auto-row" title="AI 답변이 끝날 때마다 확인해서, 미요약이 기준만큼 쌓이면 한 구간을 자동으로 압축해요">
        <span class="lm-switch"><input type="checkbox" data-lm-setting="autoCompress" aria-label="자동 압축"><span class="lm-switch-track" aria-hidden="true"></span></span>
        <span class="lm-auto-text"><b>자동 압축</b><span class="lm-hint">미요약이</span></span>
        <span class="lm-num-wrap"><input type="number" class="text_pole lm-num lm-num-sm" data-lm-setting="autoCompressAt" min="5" max="100000" step="1" aria-label="자동 압축 기준"><span class="lm-unit">개 쌓이면</span></span>
      </label>
      <div id="lm_progress" class="lm-progress" aria-live="polite"></div>

      <details class="lm-fold" id="lm_fold">
        <summary class="lm-fold-head">${icon('sliders')}<span>설정</span><span class="lm-fold-chev">${icon('chevron')}</span></summary>
      <div class="lm-tabs lm-tabs-pill" role="tablist">
        <button type="button" class="lm-tab active" data-lm-tab="summary" role="tab">${icon('feather')}<span>요약</span></button>
        <button type="button" class="lm-tab" data-lm-tab="range" role="tab">${icon('ruler')}<span>범위</span></button>
        <button type="button" class="lm-tab" data-lm-tab="tidy" role="tab">${icon('sparkle')}<span>정리</span></button>
        <button type="button" class="lm-tab" data-lm-tab="recall" role="tab">${icon('bulb')}<span>회상</span></button>
        <button type="button" class="lm-tab" data-lm-tab="check" role="tab">${icon('shield')}<span>검사</span></button>
        <button type="button" class="lm-tab" data-lm-tab="inject" role="tab">${icon('plug')}<span>주입</span></button>
      </div>
      <div class="lm-panes">

      <section class="lm-pane active" data-lm-pane="summary" role="tabpanel">
        ${selectRow('', '요약 모델', profileOptions(s.profileId), s.profileId, 'Connection Manager에 저장한 프로필. 비우면 지금 쓰는 API', 'lm_profile')}
        <div class="lm-preset-row lm-test-row"><span class="lm-hint">요약 모델이 제대로 응답하는지 짧게 확인해요.</span><button type="button" class="menu_button lm-btn lm-btn-quiet" id="lm_btn_test">${icon('plug')}<span>연결 테스트</span></button></div>
        ${selectRow('language', '요약 언어', selectOptions(LANGUAGES, s.language), s.language, 'English가 토큰을 가장 적게 씁니다')}
        ${selectRow('detail', '상세도', selectOptions({ concise: '간결', standard: '보통', detailed: '상세' }, s.detail), s.detail, '상세할수록 오래 기억하지만 토큰이 늘어요')}
        ${numberRow('maxOutputTokens', '응답 최대 토큰', 256, 131072, '요약 한 번에 받을 최대 길이')}
        ${numberRow('retries', '재시도 횟수', 0, 10, '요청이 실패하면 다시 시도')}
        ${checkRow('previewBeforeSave', '저장 전에 요약 미리보기', '압축할 때마다 결과를 보여주고, 고치거나 다시 요약할 수 있어요. 자동 압축에는 적용되지 않아요')}
        ${checkRow('includePreset', '프로필의 샘플링 설정 사용')}
        ${checkRow('systemAsUser', '지시를 유저 메시지로 보내기', 'system 역할을 받지 않는 모델일 때만 켜세요')}
        <div class="lm-subhead">로어북 참고</div>
        ${checkRow('loreEnabled', '로어북 참고하기', '요약, 모순 검사, 위키, 질문 답변에서 관련된 로어북 항목을 함께 참고해 이름과 설정을 정확하게 맞춰요')}
        ${checkRow('loreUseCharacter', '캐릭터 로어북 자동 포함')}
        ${checkRow('loreUseChat', '채팅 로어북 자동 포함')}
        <div class="lm-field lm-field-stack">
          <div class="lm-field-text"><span class="lm-field-label">추가로 참고할 로어북</span><span class="lm-hint">전역 로어북 등 함께 볼 것을 골라주세요</span></div>
          <div class="lm-lore-list" id="lm_lore_list"></div>
        </div>
        ${numberRow('loreTokenBudget', '로어북 참고 상한', 0, 100000, '한 번에 보낼 로어북 내용의 최대 크기')}
        <div class="lm-field lm-field-stack">
          <div class="lm-field-text"><span class="lm-field-label">추가 요약 규칙</span><span class="lm-hint">요약 AI에게 덧붙일 지시. 영어로 쓰면 가장 정확해요</span></div>
          <textarea class="text_pole lm-textarea" data-lm-setting="extraRules" rows="3" placeholder="Always track the in-story date."></textarea>
        </div>
        <div class="lm-pane-foot"><button type="button" class="lm-link-btn lm-reset-pane">${icon('rotate')}이 탭 기본값으로</button></div>
      </section>

      <section class="lm-pane" data-lm-pane="range" role="tabpanel">
        ${numberRow('keepRecent', '최근 원본 유지', 0, 5000, '이만큼의 최근 메시지는 요약하지 않고 그대로 둡니다')}
        ${numberRow('batchMessages', '한 구간 최대 메시지', 1, 5000, '압축 한 번에 묶을 메시지 수')}
        ${numberRow('batchTokens', '한 구간 최대 토큰', 1000, 2000000, '요약 모델의 컨텍스트 안에서 크게 잡으면 호출이 줄어요')}
        ${checkRow('hideSummarized', '요약한 원본은 AI에게서 숨기기', '채팅창에는 흐리게 남고, 되돌리기로 복구됩니다')}
        ${checkRow('autoForgetDeleted', '메시지를 지우면 그 기억도 지우기', '요약된 메시지를 모두 지우면 해당 기억을 자동으로 지워요. 일부만 지우면 "다시 요약" 표시를 해요')}
        ${checkRow('stripHtml', 'HTML과 상태창 태그 빼고 요약')}
        ${numberRow('remindAt', '압축 알림 기준', 0, 100000, '미요약이 이만큼 쌓이면 알려줍니다. 0이면 끔')}
        <div class="lm-pane-foot"><button type="button" class="lm-link-btn lm-reset-pane">${icon('rotate')}이 탭 기본값으로</button></div>
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
        ${numberRow('autoBackupEvery', '자동 백업 간격', 0, 1000, '압축을 이만큼 할 때마다 브라우저에 백업해요. 0이면 끔')}
        ${numberRow('backupKeep', '백업 보관 개수', 1, 50)}
        <div class="lm-pane-foot"><button type="button" class="lm-link-btn lm-reset-pane">${icon('rotate')}이 탭 기본값으로</button></div>
      </section>

      <section class="lm-pane" data-lm-pane="recall" role="tabpanel">
        ${checkRow('recallEnabled', '회상 사용', '응답 직전에 지금 장면과 관련된 과거를 찾아 넣습니다')}
        ${checkRow('eventsEnabled', '요약할 때 사건도 따로 추출', '누가, 어디서, 무엇을, 왜 — 검색의 기본 단위가 됩니다')}
        ${checkRow('vectorEnabled', '의미 검색 사용', '끄면 키워드 검색만 합니다')}
        ${checkRow('indexRawMessages', '요약된 원본 대사도 검색', '정확한 대사를 그대로 떠올릴 수 있어요')}
        ${checkRow('queryExpansion', '돌려 말해도 찾기', '"그때 그 일"처럼 애매한 말을 요약 모델이 구체적인 검색어로 바꿔서 찾아요. 답변마다 짧은 호출이 1번 늘고 응답 시작이 조금 늦어져요')}
        ${selectRow('embedSource', '임베딩 소스', selectOptions(EMBED_SOURCES, s.embedSource), s.embedSource, 'API 키는 ST에 저장된 것을 씁니다')}
        ${textRow('embedModel', '임베딩 모델', '비우면 ST 벡터 저장소 설정의 모델', '예: bge-m3')}
        ${textRow('embedApiUrl', '임베딩 서버 주소', 'Ollama, llama.cpp, vLLM만 해당. 비우면 ST 설정', 'http://127.0.0.1:11434')}
        <div class="lm-actions lm-actions-inline">
          <button type="button" class="menu_button lm-btn lm-btn-quiet" id="lm_btn_reindex">${icon('db')}<span>색인 맞추기</span></button>
          <button type="button" class="menu_button lm-btn lm-btn-quiet" id="lm_btn_search">${icon('search')}<span>검색 테스트</span></button>
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
          ${numberRow('expansionTimeoutMs', '검색어 확장 시간 제한', 1000, 120000, '넘으면 확장 없이 바로 검색해요')}
        </details>
        <div class="lm-pane-foot"><button type="button" class="lm-link-btn lm-reset-pane">${icon('rotate')}이 탭 기본값으로</button></div>
      </section>

      <section class="lm-pane" data-lm-pane="check" role="tabpanel">
        <div class="lm-field-text lm-pane-intro"><span class="lm-hint">AI 답변이 끝날 때마다 요약 모델이 한 번 살펴봐요. 둘 다 켜도 호출은 1번이에요. 요약 모델 프로필을 따로 지정해 두면 대화와 겹치지 않아요.</span></div>
        ${checkRow('checkContradictions', '모순 검사', '죽은 인물이 등장하거나, 이름·관계·부상이 바뀌거나, 모르는 비밀을 아는 등 기억과 다른 부분을 찾아 메시지에 ⚠ 표시를 해요')}
        ${checkRow('liveStateUpdate', '현재 상태 실시간 갱신', '압축 전이라도 시간·장소·함께 있는 인물·약속을 매 답변마다 기록부에 반영해요')}
        <div class="lm-pane-foot"><button type="button" class="lm-link-btn lm-reset-pane">${icon('rotate')}이 탭 기본값으로</button></div>
      </section>

      <section class="lm-pane" data-lm-pane="inject" role="tabpanel">
        ${selectRow('injectPreset', '주입 프리셋', selectOptions(Object.fromEntries(Object.entries(INJECT_PRESETS).map(([k, v]) => [k, v.label])), s.injectPreset), s.injectPreset, '')}
        <div class="lm-preset-row"><span class="lm-hint" id="lm_preset_desc">${esc(INJECT_PRESETS[s.injectPreset]?.desc || '')}</span><button type="button" class="menu_button lm-btn lm-btn-quiet" id="lm_apply_preset">${icon('sparkle')}<span>적용</span></button></div>
        ${selectRow('injectPosition', '기억 넣을 위치', selectOptions({ in_prompt: '캐릭터 설정 뒤', before_prompt: '프롬프트 맨 앞', in_chat: '채팅 안 (깊이 지정)' }, s.injectPosition), s.injectPosition, '대부분 캐릭터 설정 뒤가 가장 안정적이에요')}
        ${numberRow('injectDepth', '채팅 안 깊이', 0, 10000, '위치가 채팅 안일 때만 사용')}
        ${selectRow('injectRole', '역할', selectOptions({ system: 'system', user: 'user', assistant: 'assistant' }, s.injectRole), s.injectRole)}
        ${checkRow('anchorEnabled', '현재 상태 리마인더', '최근 대화 근처에 짧게 넣어 긴 채팅에서도 흐름을 놓치지 않게 합니다')}
        ${numberRow('anchorDepth', '리마인더 깊이', 0, 10000)}
        ${numberRow('recallDepth', '회상 넣을 깊이', 0, 10000, '0이면 마지막 메시지 바로 뒤')}
        <div class="lm-pane-foot"><button type="button" class="lm-link-btn lm-reset-pane">${icon('rotate')}이 탭 기본값으로</button></div>
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
    renderLoreList();
    root.querySelector('#lm_fold').addEventListener('toggle', renderLoreList);
    root.querySelector('#lm_lore_list').addEventListener('change', (event) => {
        const box = event.target.closest('input[data-lore]');
        if (!box) return;
        const set = new Set(s.loreBooks || []);
        if (box.checked) set.add(box.dataset.lore);
        else set.delete(box.dataset.lore);
        s.loreBooks = [...set];
        saveSettingsDebounced();
        loreCache.key = '';
    });
    const presetSelect = root.querySelector('[data-lm-setting="injectPreset"]');
    presetSelect.addEventListener('change', () => {
        root.querySelector('#lm_preset_desc').textContent = INJECT_PRESETS[presetSelect.value]?.desc || '';
    });
    root.querySelector('#lm_apply_preset').addEventListener('click', () => applyPreset(presetSelect.value));
    root.querySelector('#lm_btn_search').addEventListener('click', () => openSearchTest());
    root.querySelector('#lm_btn_test').addEventListener('click', () => testConnection());
}

function renderLoreList() {
    const el = document.getElementById('lm_lore_list');
    if (!el) return;
    const s = getSettings();
    let names = [];
    try {
        names = ctx().getWorldInfoNames?.() || [];
    } catch {
        names = [];
    }
    const auto = new Set(loreBookNames());
    if (!names.length) {
        el.innerHTML = '<span class="lm-hint">로어북이 없어요.</span>';
        return;
    }
    el.innerHTML = names.map(n => {
        const picked = (s.loreBooks || []).includes(n);
        const isAuto = auto.has(n) && !picked;
        return `<label class="lm-lore-chip ${picked ? 'on' : ''}"><input type="checkbox" data-lore="${esc(n)}" ${picked ? 'checked' : ''}><span>${esc(n)}</span>${isAuto ? '<em>자동</em>' : ''}</label>`;
    }).join('');
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
        ${memory?.timeline.some(n => n.stale) ? `<span class="lm-warn">다시 요약 필요 ${memory.timeline.filter(n => n.stale).length}개</span>` : ''}
        ${memory?.timeline.some(n => n.from === -1) ? '<span>이전 채팅에서 이어받음</span>' : ''}
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
<div class="lm-node lm-item lm-node-${node.tier}" data-node-id="${esc(node.id)}">
  <div class="lm-node-dot" aria-hidden="true"></div>
  <div class="lm-node-body">
    <div class="lm-node-meta">
      ${selBox()}
      <span class="lm-chip lm-chip-${node.tier}">${node.tier === 'chapter' ? '챕터' : '에피소드'}</span>
      <span class="lm-range">${node.from === -1 ? '이전 채팅' : node.from < 0 ? '원본 삭제됨' : `#${node.from}~#${node.to}`}</span>
      ${node.condensed ? `<span class="lm-range">${node.condensed}회 압축됨</span>` : ''}
      ${node.stale ? `<button type="button" class="lm-stale" data-resum="${esc(node.id)}" title="원본이 바뀌었어요. 눌러서 이 구간만 다시 요약해요">${icon('rotate')}다시 요약</button>` : ''}
      <span class="lm-spacer"></span>
      ${impControl(node.importance)}
      ${iconToggle('lm-pin', 'fa-thumbtack', '고정 (자동 압축에서 제외)', node.pinned)}
      ${deleteButton()}
    </div>
    <input class="text_pole lm-title" value="${esc(node.title)}" aria-label="제목">
    <input class="text_pole lm-when" value="${esc(node.when || '')}" placeholder="작중 시간 (예: 3일째 저녁)" aria-label="작중 시간">
    <textarea class="text_pole lm-text" rows="4" aria-label="내용">${esc(node.text)}</textarea>
    <input class="text_pole lm-kw" value="${esc((node.keywords || []).join(', '))}" placeholder="회상 키워드, 쉼표로 구분" aria-label="회상 키워드">
  </div>
</div>`;
}

function entryRow(entry) {
    return `
<div class="lm-entry lm-item" data-entry-id="${esc(entry.id)}">
  <div class="lm-entry-top">
    ${selBox()}
    <input class="text_pole lm-key" value="${esc(entry.key)}" placeholder="이름 또는 항목" aria-label="항목">
    <select class="text_pole lm-cat" aria-label="분류">${selectOptions(CATEGORIES, entry.cat)}</select>
    ${impControl(entry.importance)}
    ${iconToggle('lm-closed', 'fa-check', '해결됨', entry.status === 'closed')}
    ${iconToggle('lm-pin', 'fa-thumbtack', '고정', entry.pinned)}
    ${deleteButton()}
  </div>
  <textarea class="text_pole lm-val" rows="2" placeholder="내용" aria-label="내용">${esc(entry.value)}</textarea>
  ${['fact', 'note', 'item'].includes(entry.cat) ? `<input class="text_pole lm-known" value="${esc((entry.knownBy || []).join(', '))}" placeholder="이 사실을 아는 인물 (쉼표로 구분, 비우면 모두 앎)" aria-label="아는 인물">` : ''}
  ${entry.cat === 'thread' ? `<input class="text_pole lm-due" value="${esc(entry.due || '')}" placeholder="작중 기한 (예: 보름달 밤까지)" aria-label="기한">` : ''}
</div>`;
}

function eventRow(e) {
    const who = [e.characters?.join(', '), e.place].filter(Boolean);
    return `
<div class="lm-event lm-item" data-event-id="${esc(e.id)}">
  <div class="lm-entry-top">
    ${selBox()}
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
<article class="lm-result lm-arch lm-item" data-archive-id="${esc(a.id)}">
  <header>${selBox()}<span class="lm-chip lm-chip-archive">${a.kind === 'ledger' ? '기록' : '요약'}</span><span class="lm-range">${a.from === -1 ? '이전 채팅' : `#${a.from ?? '?'}~#${a.to ?? '?'}`}</span><span class="lm-spacer"></span>${deleteButton()}</header>
  <p><b>${esc(a.title)}</b><br>${esc(a.text)}</p>
</article>`).join('');
    const frameModes = Object.entries(FRAME_MODES).map(([value, label]) => {
        const [name, desc] = label.split(' (');
        return `<label class="lm-mode"><input type="radio" name="lm_f_mode" value="${value}" ${value === f.mode ? 'checked' : ''}><span class="lm-mode-name">${esc(name)}</span><span class="lm-mode-desc">${esc((desc || '').replace(/\)$/, ''))}</span></label>`;
    }).join('');
    const wikiPages = (memory.wiki?.pages || []).slice().sort((x, y) => Object.keys(WIKI_TYPES).indexOf(x.type) - Object.keys(WIKI_TYPES).indexOf(y.type) || x.title.localeCompare(y.title));
    const tab = (id, ic, label, count = null, active = false) =>
        `<button type="button" class="lm-tab ${active ? 'active' : ''}" data-lm-tab="${id}" role="tab">${icon(ic)}<span>${label}</span>${count === null ? '' : `<span class="lm-count">${count}</span>`}</button>`;
    const tool = (id, ic, label, extra = '', title = '') =>
        `<button type="button" class="lm-toolbtn ${extra}" id="${id}" ${title ? `title="${esc(title)}"` : ''}>${icon(ic)}<span>${label}</span></button>`;
    return `
<div class="lm-root lm-manager">
  <div class="lm-manager-head">
    <h3><span class="lm-mascot lm-mascot-sm">${ELEPHANT_SVG}</span>코끼리의 기억장</h3>
    <div class="lm-manager-tools">
      ${tool('lm_export', 'export', '내보내기')}
      ${tool('lm_import', 'import', '가져오기')}
      ${tool('lm_backups', 'backup', '백업')}
      ${tool('lm_handoff_save', 'handoff', '새 채팅으로 이어가기', '', '이 기억을 저장해 두고, 같은 캐릭터로 새 채팅을 열 때 이어받아요')}
      ${tool('lm_handoff_load', 'receive', '이어받기', '', '저장해 둔 이전 채팅의 기억을 이 채팅으로 가져와요')}
      ${tool('lm_reset', 'reset', '초기화', 'lm-toolbtn-danger')}
      <input type="file" id="lm_import_file" accept=".json,application/json" hidden>
    </div>
  </div>

  <div class="lm-tabs lm-tabs-line lm-tabs-sticky" role="tablist">
    ${tab('frame', 'frame', '작품 설정', null, true)}
    ${tab('timeline', 'timeline', '타임라인', memory.timeline.length)}
    ${tab('ledger', 'ledger', '기록부', memory.ledger.entries.length)}
    ${tab('events', 'events', '사건', memory.events.length)}
    ${tab('wiki', 'wiki', '위키', wikiPages.length)}
    ${tab('ask', 'ask', '질문')}
    ${tab('archive', 'archive', '보관함', memory.archive.length)}
  </div>

  <section class="lm-pane active" data-lm-pane="frame" role="tabpanel">
    <p class="lm-hint lm-pane-intro">여기 적은 내용은 요약할 때와 대화할 때 모두 AI에게 전달돼요.</p>
    <div class="lm-modes" role="radiogroup" aria-label="작품 유형">${frameModes}</div>
    <div class="lm-card-group">
      <div class="lm-field lm-field-stack">
        <div class="lm-field-text"><span class="lm-field-label">원작 제목</span></div>
        <input class="text_pole" id="lm_f_work" value="${esc(f.work)}" placeholder="2차 창작일 때 원작 이름">
      </div>
    </div>
    <h4 class="lm-subhead">세계와 언어</h4>
    <div class="lm-card-group lm-world">
      <div class="lm-field lm-field-stack">
        <div class="lm-field-text"><span class="lm-field-label">시대</span></div>
        <select class="text_pole" id="lm_f_era">${selectOptions(ERAS, f.era)}</select>
      </div>
      <div class="lm-field lm-field-stack">
        <div class="lm-field-text"><span class="lm-field-label">세계 문화권</span><span class="lm-hint">이야기 속 사람들이 사는 곳</span></div>
        <select class="text_pole" id="lm_f_culture">${selectOptions(CULTURES, f.culture)}</select>
        <input class="text_pole" id="lm_f_culture_custom" value="${esc(f.cultureCustom)}" placeholder="직접 입력 (예: 1920년대 상하이)" ${f.culture === 'custom' ? '' : 'hidden'}>
      </div>
      <div class="lm-field lm-field-stack">
        <div class="lm-field-text"><span class="lm-field-label">채팅에 쓰는 언어</span><span class="lm-hint">글로 쓰는 언어일 뿐, 인물의 국적과는 별개예요</span></div>
        <select class="text_pole" id="lm_f_lang">${selectOptions(STORY_LANGUAGES, f.storyLanguage)}</select>
      </div>
      <div class="lm-field lm-field-stack">
        <div class="lm-field-text"><span class="lm-field-label">이름 표기</span></div>
        <select class="text_pole" id="lm_f_names">${selectOptions(NAME_STYLES, f.nameStyle)}</select>
      </div>
      <div class="lm-field lm-field-stack lm-span-2">
        <div class="lm-field-text"><span class="lm-field-label">시대 · 상황 설명</span><span class="lm-hint">예: 2024년 도쿄, 고등학교 2학년 봄 / 전쟁 직후의 항구 도시</span></div>
        <textarea class="text_pole" id="lm_f_era_detail" rows="2" placeholder="언제, 어디서, 어떤 상황인지">${esc(f.eraDetail)}</textarea>
      </div>
      <p class="lm-hint lm-span-2 lm-example">일본 만화 2차 창작이라면 <b>세계 문화권: 일본</b>, <b>채팅 언어: 한국어</b>로 두세요. 인물들은 일본 현대 사회에서 살지만, 대사와 서술은 한국어로 써요.</p>
    </div>
    <h4 class="lm-subhead">인물과 배경</h4>
    <div class="lm-card-group">
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
    </div>
    ${tool('lm_f_save_char', 'userpen', '이 캐릭터의 기본값으로 저장', 'lm-toolbtn-wide', '이 캐릭터로 새 채팅을 열 때 자동으로 불러와요')}
  </section>

  <section class="lm-pane" data-lm-pane="timeline" role="tabpanel">
    <div class="lm-saga">
      <div class="lm-field-text"><span class="lm-field-label">지금까지의 이야기</span><span class="lm-hint">오래된 챕터가 합쳐지면 여기에 쌓여요</span></div>
      <textarea class="text_pole" id="lm_saga" rows="6" placeholder="아직 비어 있어요.">${esc(memory.saga.text)}</textarea>
    </div>
    ${memory.timeline.length ? bulkBar('timeline', `<label class="lm-restore" title="지운 기억에 들어 있던 메시지를 숨김 해제해서 다시 AI에게 보여줘요. 가장 최근 기억을 지우면 그 구간을 다시 압축할 수 있어요"><input type="checkbox" id="lm_restore_src"><span>원본 다시 보이기</span></label>`) : ''}
    <div id="lm_timeline" class="lm-timeline lm-list">${memory.timeline.map(nodeCard).join('') || '<div class="lm-empty">아직 기억한 이야기가 없어요. 패널에서 압축을 누르면 여기에 차곡차곡 쌓여요.</div>'}</div>
  </section>

  <section class="lm-pane" data-lm-pane="ledger" role="tabpanel">
    <div class="lm-scene">
      <div class="lm-field lm-field-stack"><div class="lm-field-text"><span class="lm-field-label">시간</span></div><input class="text_pole" id="lm_s_time" value="${esc(sc.time)}"></div>
      <div class="lm-field lm-field-stack"><div class="lm-field-text"><span class="lm-field-label">장소</span></div><input class="text_pole" id="lm_s_place" value="${esc(sc.place)}"></div>
      <div class="lm-field lm-field-stack"><div class="lm-field-text"><span class="lm-field-label">함께 있는 인물</span></div><input class="text_pole" id="lm_s_present" value="${esc(sc.present)}"></div>
      <div class="lm-field lm-field-stack"><div class="lm-field-text"><span class="lm-field-label">분위기</span></div><input class="text_pole" id="lm_s_mood" value="${esc(sc.mood)}"></div>
    </div>
    ${bulkBar('ledger')}
    <div id="lm_entries" class="lm-list">${ledgerGroups(memory)}</div>
  </section>

  <section class="lm-pane" data-lm-pane="events" role="tabpanel">
    <div class="lm-search">${icon('search')}<input class="text_pole lm-filter" id="lm_event_filter" placeholder="사건 찾기: 이름, 장소, 물건" aria-label="사건 찾기"></div>
    <p class="lm-hint lm-pane-intro">회상 검색에 쓰이는 개별 사건이에요. 최근 ${Math.min(memory.events.length, 300)}개를 보여줘요.</p>
    ${memory.events.length ? bulkBar('events') : ''}
    <div id="lm_events" class="lm-list">${memory.events.slice(-300).reverse().map(eventRow).join('') || '<div class="lm-empty">아직 사건이 없어요. 회상 탭에서 사건 추출을 켜고 압축하면 생겨요.</div>'}</div>
  </section>

  <section class="lm-pane" data-lm-pane="wiki" role="tabpanel">
    <div class="lm-wiki-tools">
      ${tool('lm_wiki_build', 'sparkle', wikiPages.length ? '위키 새로 정리' : '위키 만들기', 'lm-toolbtn-accent')}
      ${tool('lm_wiki_md', 'download', '.md')}
      ${tool('lm_wiki_html', 'download', '.html')}
    </div>
    <p class="lm-hint lm-pane-intro">기록부와 사건을 바탕으로 인물, 장소, 물건을 문서로 정리해요.${memory.wiki?.updatedAt ? ` 마지막 정리: ${new Date(memory.wiki.updatedAt).toLocaleString()}` : ''}</p>
    ${wikiPages.length ? `<div class="lm-search">${icon('search')}<input class="text_pole lm-filter" id="lm_wiki_filter" placeholder="위키 찾기" aria-label="위키 찾기"></div>${bulkBar('wiki')}` : ''}
    <div id="lm_wiki" class="lm-list">${wikiPages.map(wikiPageHtml).join('') || '<div class="lm-empty">아직 위키가 없어요. 위키 만들기를 눌러 정리해 보세요.</div>'}</div>
  </section>

  <section class="lm-pane" data-lm-pane="ask" role="tabpanel">
    ${askPanelHtml(memory)}
  </section>

  <section class="lm-pane" data-lm-pane="archive" role="tabpanel">
    <p class="lm-hint lm-pane-intro">압축하면서 줄어든 옛 요약이에요. 회상 검색에 쓰이고, 최근 100개를 보여줘요.</p>
    ${archive ? bulkBar('archive') : ''}
    <div class="lm-results lm-list" id="lm_archive">${archive || '<div class="lm-empty">비어 있어요.</div>'}</div>
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
        era: root.querySelector('#lm_f_era').value,
        eraDetail: root.querySelector('#lm_f_era_detail').value,
        culture: root.querySelector('#lm_f_culture').value,
        cultureCustom: root.querySelector('#lm_f_culture_custom').value,
        storyLanguage: root.querySelector('#lm_f_lang').value,
        nameStyle: root.querySelector('#lm_f_names').value,
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
                when: card.querySelector('.lm-when')?.value.trim() ?? original.when ?? '',
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
                knownBy: row.querySelector('.lm-known') ? toList(row.querySelector('.lm-known').value) : (original.knownBy || []),
                due: row.querySelector('.lm-due') ? row.querySelector('.lm-due').value.trim() : (original.due || ''),
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
    const deletedArchive = new Set([...root.querySelectorAll('#lm_archive .lm-arch.lm-deleted')].map(el => el.dataset.archiveId));
    out.archive = memory.archive.filter(a => !deletedArchive.has(a.id));
    const deletedWiki = new Set([...root.querySelectorAll('#lm_wiki .lm-wiki-page.lm-deleted')].map(el => el.dataset.wikiId));
    out.wiki = { ...(memory.wiki || { updatedAt: 0 }), pages: (memory.wiki?.pages || []).filter(p => !deletedWiki.has(p.id)) };
    return out;
}

// Shows the messages of deleted memories to the AI again and pulls the cursor back
// when the newest memories were removed, so that part can be compressed again.
function restoreSources(memory, ids) {
    const { chat } = ctx();
    const unhide = [];
    chat.forEach((msg, i) => {
        if (!msg?.extra?.lm_owner || !ids.has(msg.extra.lm_owner)) return;
        delete msg.extra.lm_owner;
        if (msg.extra.lm_hidden) {
            delete msg.extra.lm_hidden;
            unhide.push(i);
        }
    });
    setHidden(unhide, false);
    let maxOwned = -1;
    chat.forEach((msg, i) => { if (msg?.extra?.lm_owner) maxOwned = i; });
    memory.cursor = maxOwned;
    memory.hiddenRanges = listToRanges(chat.map((m, i) => (m?.extra?.lm_hidden ? i : -1)).filter(i => i >= 0));
}

async function openManager({ focusOwner = null, tab: startTab = null } = {}) {
    if (!hasChat()) return toastr.warning('채팅을 먼저 열어주세요.');
    if (busy) return toastr.warning('작업이 끝난 뒤에 열어주세요.');
    const c = ctx();
    const chatId = c.getCurrentChatId();
    const memory = getMemory(true);
    const root = document.createElement('div');
    root.innerHTML = managerHtml(memory);
    applyThemeMode(root.firstElementChild);
    let popup = null;
    const selectTab = (name) => {
        root.querySelectorAll('.lm-tab').forEach(t => t.classList.toggle('active', t.dataset.lmTab === name));
        root.querySelectorAll('.lm-pane').forEach(pane => pane.classList.toggle('active', pane.dataset.lmPane === name));
    };
    // Closes the manager without saving, then runs an action that changes memory.
    const closeThen = async (action) => {
        await popup?.completeCancelled();
        await action();
    };

    const lastPicked = new WeakMap();
    const paneOf = (el) => el.closest('.lm-pane');
    const visibleItems = (pane) => [...pane.querySelectorAll('.lm-item')].filter(el => !el.hidden);
    const updateBulk = (pane) => {
        const bar = pane?.querySelector('.lm-bulk');
        if (!bar) return;
        const items = visibleItems(pane);
        const picked = items.filter(el => el.querySelector('.lm-sel')?.checked);
        bar.querySelector('.lm-bulk-count').textContent = `${picked.length}개 선택`;
        bar.querySelector('.lm-bulk-del').disabled = picked.length === 0;
        const all = bar.querySelector('.lm-sel-all');
        all.checked = items.length > 0 && picked.length === items.length;
        all.indeterminate = picked.length > 0 && picked.length < items.length;
        const allDeleted = picked.length > 0 && picked.every(el => el.classList.contains('lm-deleted'));
        bar.querySelector('.lm-bulk-del span').textContent = allDeleted ? '선택 복구' : '선택 삭제';
        items.forEach(el => el.classList.toggle('lm-picked', !!el.querySelector('.lm-sel')?.checked));
    };

    root.addEventListener('click', async (event) => {
        const sel = event.target.closest('.lm-sel');
        if (sel) {
            const pane = paneOf(sel);
            const item = sel.closest('.lm-item');
            const rangeBtn = pane.querySelector('.lm-range-mode');
            const ranged = event.shiftKey || rangeBtn?.classList.contains('on');
            const last = lastPicked.get(pane);
            if (ranged && last && last !== item && pane.contains(last)) {
                const items = visibleItems(pane);
                const [a, b] = [items.indexOf(last), items.indexOf(item)].sort((x, y) => x - y);
                if (a >= 0 && b >= 0) items.slice(a, b + 1).forEach(el => { el.querySelector('.lm-sel').checked = sel.checked; });
                rangeBtn?.classList.remove('on');
            }
            lastPicked.set(pane, item);
            updateBulk(pane);
            return;
        }
        const selAll = event.target.closest('.lm-sel-all');
        if (selAll) {
            const pane = paneOf(selAll);
            visibleItems(pane).forEach(el => { el.querySelector('.lm-sel').checked = selAll.checked; });
            updateBulk(pane);
            return;
        }
        const rangeMode = event.target.closest('.lm-range-mode');
        if (rangeMode) {
            rangeMode.classList.toggle('on');
            if (rangeMode.classList.contains('on')) toastr.info('시작 항목과 끝 항목을 차례로 눌러주세요.', '', { timeOut: 2500 });
            return;
        }
        const bulkDel = event.target.closest('.lm-bulk-del');
        if (bulkDel) {
            const pane = paneOf(bulkDel);
            const picked = visibleItems(pane).filter(el => el.querySelector('.lm-sel')?.checked);
            const restore = picked.every(el => el.classList.contains('lm-deleted'));
            picked.forEach(el => {
                el.classList.toggle('lm-deleted', !restore);
                el.querySelector('.lm-sel').checked = false;
            });
            updateBulk(pane);
            if (!restore) toastr.info(`${picked.length}개를 삭제로 표시했어요. 저장을 누르면 반영돼요.`, '', { timeOut: 2500 });
            return;
        }
        const del = event.target.closest('.lm-del');
        if (del) {
            event.preventDefault();
            del.closest('.lm-item')?.classList.toggle('lm-deleted');
            updateBulk(paneOf(del));
            return;
        }
        const add = event.target.closest('.lm-add-entry');
        if (add) {
            const cat = add.dataset.cat;
            const entry = { id: newId(), cat, key: '', value: '', importance: 3, pinned: cat === 'note', status: 'open', knownBy: [], due: '' };
            const list = root.querySelector(`.lm-group[data-cat="${cat}"] .lm-group-list`);
            list?.insertAdjacentHTML('beforeend', entryRow(entry));
            list?.lastElementChild?.querySelector('.lm-key')?.focus();
            return;
        }
        const tab = event.target.closest('.lm-tab');
        if (tab) {
            selectTab(tab.dataset.lmTab);
            return;
        }
        const resum = event.target.closest('[data-resum]');
        if (resum) {
            const id = resum.dataset.resum;
            await closeThen(async () => {
                await resummarizeNode(id);
                openManager({ focusOwner: id });
            });
            return;
        }
        const tool = event.target.closest('#lm_export, #lm_backups, #lm_handoff_save, #lm_handoff_load, #lm_reset, #lm_wiki_build, #lm_wiki_md, #lm_wiki_html');
        if (!tool) return;
        switch (tool.id) {
            case 'lm_wiki_build':
                await closeThen(async () => {
                    await buildWiki();
                    openManager({ tab: 'wiki' });
                });
                break;
            case 'lm_wiki_md': {
                const data = collectManager(root, memory);
                if (!data.wiki.pages.length) return toastr.info('아직 위키가 없어요.');
                downloadFile(`elephant-wiki-${fileSafe(c.getCurrentChatId())}.md`, wikiMarkdown(data), 'text/markdown');
                break;
            }
            case 'lm_wiki_html': {
                const data = collectManager(root, memory);
                if (!data.wiki.pages.length) return toastr.info('아직 위키가 없어요.');
                downloadFile(`elephant-wiki-${fileSafe(c.getCurrentChatId())}.html`, wikiHtml(data), 'text/html');
                break;
            }
            case 'lm_export':
                await openExportMenu(() => collectManager(root, memory));
                break;
            case 'lm_backups':
                await closeThen(openBackups);
                break;
            case 'lm_handoff_save':
                await saveHandoff();
                break;
            case 'lm_handoff_load':
                await closeThen(loadHandoff);
                break;
            case 'lm_reset':
                await closeThen(runReset);
                break;
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
    const wikiFilter = root.querySelector('#lm_wiki_filter');
    wikiFilter?.addEventListener('input', () => {
        const q = wikiFilter.value.trim().toLowerCase();
        root.querySelectorAll('#lm_wiki .lm-wiki-page').forEach(el => { el.hidden = !!q && !el.textContent.toLowerCase().includes(q); });
    });
    bindAskPanel(root, (id) => closeThen(() => jumpToMessage(id)));
    const cultureSel = root.querySelector('#lm_f_culture');
    cultureSel.addEventListener('change', () => {
        root.querySelector('#lm_f_culture_custom').hidden = cultureSel.value !== 'custom';
    });
    root.querySelector('#lm_f_save_char').addEventListener('click', async () => {
        const { characterId, writeExtensionField } = ctx();
        if (characterId === undefined || characterId === null) return toastr.warning('그룹 채팅이거나 캐릭터가 선택되지 않았습니다.');
        const frame = collectManager(root, memory).frame;
        await writeExtensionField(characterId, CHAR_FIELD, frame);
        toastr.success('이 캐릭터의 기본 설정으로 저장했습니다.');
    });
    const fileInput = root.querySelector('#lm_import_file');
    root.querySelector('#lm_import').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        fileInput.value = '';
        if (!file) return;
        try {
            const data = JSON.parse(await file.text());
            if (data?.type === 'dont-think-of-elephant-settings') {
                if (!await c.Popup.show.confirm('설정 가져오기', '파일의 설정으로 이 확장의 설정을 바꿀까요?')) return;
                applyImportedSettings(data);
                toastr.success('설정을 가져왔어요.');
                return;
            }
            if (!data || !Array.isArray(data.timeline) || !data.ledger) throw new Error('코끼리를 생각하지마 기억 파일이 아니에요.');
            if (!await c.Popup.show.confirm('기억 가져오기', '현재 기억을 파일 내용으로 바꿀까요? 되돌리기로 취소할 수 있어요.')) return;
            await closeThen(async () => {
                await restoreMemory(data, '가져오기');
                toastr.success('기억을 가져왔어요.');
            });
        } catch (err) {
            toastr.error(`가져오기 실패: ${err.message}`);
        }
    });

    popup = new c.Popup(root, c.POPUP_TYPE.CONFIRM, '', {
        okButton: '저장',
        cancelButton: '닫기',
        wide: true,
        large: true,
        allowVerticalScrolling: true,
        leftAlign: true,
    });
    const showing = popup.show();
    if (startTab) setTimeout(() => selectTab(startTab), 30);
    if (focusOwner) {
        setTimeout(() => {
            selectTab('timeline');
            const card = root.querySelector(`.lm-node[data-node-id="${CSS.escape(focusOwner)}"]`);
            if (card) {
                card.scrollIntoView({ block: 'center' });
                card.classList.add('lm-focus');
            } else if (focusOwner === SAGA_OWNER) {
                root.querySelector('.lm-saga')?.scrollIntoView({ block: 'center' });
            }
        }, 80);
    }
    const result = await showing;
    if (result !== c.POPUP_RESULT.AFFIRMATIVE) return;
    if (!stillSameChat(chatId)) return toastr.warning('채팅이 바뀌어서 저장하지 않았습니다.');
    const current = getMemory(true);
    if (current !== memory) return toastr.warning('기억이 바뀌어서 저장하지 않았습니다. 다시 열어주세요.');
    const edited = collectManager(root, memory);
    pushHistory(current, '직접 편집');
    const keptIds = new Set(edited.timeline.map(n => n.id));
    const removedIds = new Set(memory.timeline.map(n => n.id).filter(id => !keptIds.has(id)));
    if (removedIds.size) {
        edited.events = edited.events.filter(e => !removedIds.has(e.episodeId));
        edited.archive = edited.archive.filter(a => !removedIds.has(a.ownerId));
    }
    for (const key of ['frame', 'saga', 'timeline', 'ledger', 'events', 'archive', 'wiki']) current[key] = edited[key];
    if (removedIds.size && root.querySelector('#lm_restore_src')?.checked) {
        restoreSources(current, removedIds);
        await ctx().saveChat();
    }
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
        name: 'lm-ask',
        callback: async (_args, value) => {
            const question = String(value || '').trim();
            if (!question || !hasChat()) return '';
            const { answer } = await askMemory(question);
            return answer;
        },
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({ description: 'question about the story', typeList: [ARGUMENT_TYPE.STRING], isRequired: true }),
        ],
        returns: 'the answer',
        helpString: '<div>코끼리를 생각하지마: 지금까지의 이야기에 대해 물어봅니다. 예: <code>/lm-ask 레온과 처음 만난 게 언제야? | /echo</code></div>',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lm-wiki',
        callback: async () => {
            await buildWiki();
            return '';
        },
        helpString: '<div>코끼리를 생각하지마: 기억을 위키로 정리합니다.</div>',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lm-auto',
        callback: (_args, value) => {
            const s = getSettings();
            const v = String(value || '').trim().toLowerCase();
            s.autoCompress = v === 'on' ? true : v === 'off' ? false : !s.autoCompress;
            ctx().saveSettingsDebounced();
            syncSettingInputs();
            toastr.info(`자동 압축을 ${s.autoCompress ? '켰어요' : '껐어요'}.`, APP_NAME);
            return s.autoCompress ? 'on' : 'off';
        },
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({ description: 'on, off, or empty to toggle', typeList: [ARGUMENT_TYPE.STRING], isRequired: false, enumList: ['on', 'off'] }),
        ],
        helpString: '<div>코끼리를 생각하지마: 자동 압축을 켜거나 끕니다. 예: <code>/lm-auto on</code></div>',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lm-remember',
        callback: async (_args, value) => {
            const text = String(value || '').trim();
            if (!text || !hasChat()) return '';
            const memory = getMemory(true);
            pushHistory(memory, '기억에 새기기');
            memory.ledger.entries.push({ id: newId(), cat: 'note', key: `메모 #${ctx().chat.length - 1}`, value: text, importance: 5, pinned: true, status: 'open', updatedAt: ctx().chat.length - 1, knownBy: [], due: '' });
            await ctx().saveMetadata();
            refreshInjection();
            updateStatus();
            return '';
        },
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({ description: 'text to always remember', typeList: [ARGUMENT_TYPE.STRING], isRequired: true }),
        ],
        helpString: '<div>코끼리를 생각하지마: "꼭 기억할 것"에 내용을 새깁니다. 예: <code>/lm-remember 레온은 고양이 알레르기가 있다</code></div>',
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
    make('lm_wand_ask', 'fa-circle-question', '코끼리에게 묻기', () => openAsk());
    make('lm_wand_auto', 'fa-robot', '코끼리: 자동 압축 켜기/끄기', () => {
        const s = getSettings();
        s.autoCompress = !s.autoCompress;
        ctx().saveSettingsDebounced();
        syncSettingInputs();
        toastr.info(`자동 압축을 ${s.autoCompress ? '켰어요' : '껐어요'}.`, APP_NAME);
    });
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
    const existing = getMemory(false);
    if (existing && existing.tagVersion !== 1) {
        retagFromRanges(existing);
        c.saveChat?.();
        c.saveMetadataDebounced?.();
    }
    refreshInjection();
    updateStatus();
    setTimeout(decorateAll, 300);
    if (getMemory(false)) syncAfter();
    setTimeout(offerHandoff, 600);
}

async function onMessageDeleted() {
    try {
        await reconcileAfterDeletion();
    } catch (err) {
        console.error(LOG_PREFIX, 'deletion reconcile failed', err);
    }
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
    eventSource.on(event_types.MESSAGE_EDITED, onMessageEdited);
    eventSource.on(event_types.MESSAGE_SWIPED, onMessageEdited);
    eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived);
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (id) => decorateMessage(Number(id)));
    eventSource.on(event_types.USER_MESSAGE_RENDERED, (id) => decorateMessage(Number(id)));
    eventSource.on(event_types.MORE_MESSAGES_LOADED, () => decorateAll());
    document.addEventListener('click', onDocumentClick, true);
    eventSource.on(event_types.MESSAGE_SENT, updateStatus);
    console.log(LOG_PREFIX, 'loaded');
})();
