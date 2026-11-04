// Loads index.js into a sandbox with a fake SillyTavern context, so the extension's own
// functions can be called from Node without a browser. No dependencies.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');

function makeChat(n, text = (i) => `Line ${i}`) {
    const chat = [];
    for (let i = 0; i < n; i++) chat.push({ is_user: i % 2 === 0, name: i % 2 ? 'Rin' : 'Me', mes: text(i), is_system: false, extra: {} });
    return chat;
}

function load({ chat = makeChat(30), reply = '', profiles = [], sources = {}, chatId = 'c', fetchImpl = null } = {}) {
    const state = { reply, delay: 0, fail: null, calls: [], chatId };
    const prompts = {};
    const toasts = [];
    const context = {
        extensionSettings: { connectionManager: { profiles } },
        saveSettingsDebounced() {},
        eventSource: { on() {}, emit: async () => {} },
        event_types: {},
        chat,
        chatMetadata: {},
        name1: 'Me',
        name2: 'Rin',
        getCurrentChatId: () => state.chatId,
        setExtensionPrompt(key, text) { prompts[key] = text; },
        async saveMetadata() {},
        async saveChat() {},
        saveMetadataDebounced() {},
        getRequestHeaders: () => ({}),
        async generateRaw(args) {
            state.calls.push({ kind: 'raw', args });
            if (state.delay) await new Promise(r => setTimeout(r, state.delay));
            if (state.fail) throw state.fail;
            return typeof state.reply === 'function' ? state.reply(args) : state.reply;
        },
        ConnectionManagerRequestService: {
            validateProfile: (p) => ({ source: sources[p?.id] || '' }),
            async sendRequest(profileId, messages, max, custom, override) {
                state.calls.push({ kind: 'profile', profileId, messages, override });
                if (state.delay) await new Promise(r => setTimeout(r, state.delay));
                const f = typeof state.fail === 'function' ? state.fail({ profileId, override }) : state.fail;
                if (f) throw f;
                return { content: typeof state.reply === 'function' ? state.reply({ messages, override }) : state.reply };
            },
        },
        Popup: { show: { confirm: async () => true } },
    };
    const note = (kind) => (m) => toasts.push(`${kind}:${m}`);
    const sandbox = {
        console: { log() {}, debug() {}, warn() {}, error() {}, info() {} },
        SillyTavern: { getContext: () => context, libs: {} },
        toastr: { success: note('ok'), info: note('info'), warning: note('warn'), error: note('err') },
        document: { querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, addEventListener() {}, createElement: () => ({}) },
        fetch: fetchImpl || (async () => ({ ok: true, json: async () => [] })),
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        setTimeout, clearTimeout, setInterval: () => 0, AbortController, structuredClone,
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(SOURCE, sandbox, { filename: 'index.js' });
    const get = (expr) => vm.runInContext(expr, sandbox);
    return { context, state, prompts, toasts, get, sandbox };
}

const until = async (fn, ms = 3000) => {
    const end = Date.now() + ms;
    while (!fn() && Date.now() < end) await new Promise(r => setTimeout(r, 10));
};

module.exports = { load, makeChat, until };
