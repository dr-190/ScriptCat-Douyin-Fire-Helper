// ==UserScript==
// @name         抖音续火助手 - 抖音自动续火花·批量自动发送·多用户定时油猴脚本
// @namespace    http://tampermonkey.net/
// @version      2026.10.02
// @description  抖音续火、抖音续火花、抖音自动发送、抖音批量发送脚本。支持多用户批量续火花，每日定时或随机时间自动发送，集成一言API与TXTAPI自定义文案，自动记录好友火花天数，专属一言按周一至周日配置，支持暂停继续、自动重试、后端调度器回调实现无人值守挂机。适配 https://www.douyin.com/chat 页面，兼容 ScriptCat、Tampermonkey 等油猴脚本管理器。日志支持多级筛选、按天分片、批量写入。
// @author       飔梦 / 阚泥 / xiaohe123awa / YsKiKi
// @match        https://www.douyin.com/chat*
// @icon         https://free.picui.cn/free/2025/11/23/69226264aca4e.png
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @grant        GM_listValues
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @connect      hitokoto.cn
// @connect      localhost
// @license      MIT
// ==/UserScript==

(function () {
'use strict';

/* =========================================================
 * 基础工具
 * ========================================================= */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const nowMs = () => Date.now();

function getLocalTodayString(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function escapeHtml(s) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(s ?? '')));
    return div.innerHTML;
}

/* =========================================================
 * 常量
 * ========================================================= */
const STATE = Object.freeze({ IDLE: 'idle', SEARCHING: 'searching', FOUND: 'found', SENDING: 'sending' });
const LEVEL = Object.freeze({ INFO: 'info', SUCCESS: 'success', WARN: 'warn', ERROR: 'error' });
const CAT = Object.freeze({ SEND: 'send', API: 'api', UI: 'ui', STATE: 'state', SYSTEM: 'system' });

const GITHUB_REPO_URL = 'https://github.com/dr-190/ScriptCat-Douyin-Fire-Helper';
const TOOLS_ZIP_GITHUB = 'https://github.com/dr-190/ScriptCat-Douyin-Fire-Helper/raw/refs/heads/main/%E9%85%8D%E5%A5%97%E5%B7%A5%E5%85%B7.zip';
const TOOLS_ZIP_PROXY = 'https://gh-proxy.org/https://github.com/dr-190/ScriptCat-Douyin-Fire-Helper/raw/refs/heads/main/%E9%85%8D%E5%A5%97%E5%B7%A5%E5%85%B7.zip';

/* =========================================================
 * 选择器表
 * ========================================================= */
const SELECTORS = {
    searchInput: [
        'input.semi-input[placeholder="搜索"][type="text"]',
        'input.semi-input[placeholder="搜索"]',
        'input[placeholder="搜索"]',
        '.searchSearchInputinput_box input',
        '.LeftPanelHeadersearch input'
    ],
    chatBtn: [
        'div[class*="SearchPanelitemchat_btn"]',
        '[class*="chat_btn"]',
        '[class*="SearchPanel"] [class*="btn"]'
    ],
    chatInput: [
        'div[data-slate-editor="true"][contenteditable="true"]',
        'div[contenteditable="true"][data-slate-editor]',
        'div[contenteditable="true"]'
    ],
    conversationItem: [
        '[data-e2e="conversation-item"]',
        '.conversationConversationItemwrapper'
    ],
    conversationTitle: [
        '.conversationConversationItemtitle',
        '[class*="ConversationItemtitle"]:not([class*="Wrapper"]):not([class*="wrapper"])'
    ],
    conversationList: [
        '.conversationConversationListwrapper',
        '[class*="ConversationListwrapper"]',
        '[class*="conversationList-wrapper"]'
    ],
    sparkStatus: [
        '.RightPanelHeadertitleContainer .commonStreaknormalText',
        '[class*="RightPanelHeader"] .commonStreaknormalText',
        '[class*="RightPanel"] [class*="Header"] .commonStreaknormalText'
    ],
    noMore: [
        '[class*="no-more-tip-"]',
        '[class*="noMoreTip"]'
    ]
};

function queryFirst(selectorList) {
    const list = Array.isArray(selectorList) ? selectorList : [selectorList];
    for (const sel of list) {
        try {
            const el = document.querySelector(sel);
            if (el) return { el, sel };
        } catch (e) { /* ignore */ }
    }
    return { el: null, sel: null };
}

function queryAllFirst(selectorList) {
    const list = Array.isArray(selectorList) ? selectorList : [selectorList];
    for (const sel of list) {
        try {
            const els = document.querySelectorAll(sel);
            if (els.length > 0) return { els, sel };
        } catch (e) { /* ignore */ }
    }
    return { els: [], sel: null };
}

/* =========================================================
 * 配置
 * ========================================================= */
const DEFAULT_CONFIG = {
    baseMessage: "续火",
    sendTime: "00:01:00",
    sendTimeRandom: false,
    sendTimeRangeStart: "23:30:00",
    sendTimeRangeEnd: "00:30:00",
    maxRetryCount: 3,
    autoRetryInterval: 10,
    retryAfterMaxReached: true,
    retryResetInterval: 10,
    enableTargetUser: false,
    targetUsernames: "",
    multiUserMode: "sequential",
    multiUserRetrySame: false,
    customMessage: "—————每日续火—————\n\n[TXTAPI]\n\n—————每日一言—————\n\n[API]\n\n—————专属一言—————\n\n[专属一言]\n\n🔥 火花已续 [天数] 天",
    chatPageLineSeparator: " | ",
    useHitokoto: true,
    useTxtApi: true,
    useSpecialHitokoto: true,
    specialHitokotoRandom: true,
    txtApiMode: "manual",
    txtApiManualRandom: true,
    hitokotoFormat: "{hitokoto}\n—— {from}{from_who}",
    fromFormat: "{from}",
    fromWhoFormat: "「{from_who}」",
    txtApiUrl: "https://v1.hitokoto.cn/?encode=text",
    txtApiManualText: "文本1\n文本2\n文本3",
    hitokotoTimeout: 60000,
    txtApiTimeout: 60000,
    specialHitokotoMonday: "周一专属文案1\n周一专属文案2",
    specialHitokotoTuesday: "周二专属文案1\n周二专属文案2",
    specialHitokotoWednesday: "周三专属文案1\n周三专属文案2",
    specialHitokotoThursday: "周四专属文案1\n周四专属文案2",
    specialHitokotoFriday: "周五专属文案1\n周五专属文案2",
    specialHitokotoSaturday: "周六专属文案1\n周六专属文案2",
    specialHitokotoSunday: "周日专属文案1\n周日专属文案2",
    fireDays: 1,
    lastFireDate: "",
    autoFetchFireDays: true,
    userSearchTimeout: 10000,
    pageLoadWaitTime: 5000,
    chatInputCheckInterval: 1000,
    searchDebounceDelay: 500,
    searchThrottleDelay: 1000,
    maxLiveLogs: 8,
    maxViewLogs: 100,
    maxHistoryLogs: 500,
    logRetentionDays: 7,
    enableScriptBCallback: false,
    scriptBCallbackPort: 7788,
    backendRetryMinutes: 25,
    initialDelay: 30
};

/* =========================================================
 * 全局状态
 * ========================================================= */
let userConfig = {};
let currentState = STATE.IDLE;
let isProcessing = false;
let isPaused = false;
let retryCount = 0;
let currentRetryUser = null;
let sentUsersToday = [];
let failedUsersToday = [];
let allTargetUsers = [];
let currentUserIndex = -1;
let alreadyDoneNotified = false;
let lastSendCompleteTime = 0;
let nextSendTime = null;

let searchAttemptCount = 0;
let searchTimeoutId = null;
let chatInputCheckTimer = null;
let chatInputNotFoundCount = 0;
let countdownInterval = null;

let _autoSendTimer = null;
let autoRetryTimer = null;
let lastRetryResetTime = 0;
let isMaxRetryReached = false;

let specialHitokotoSentIndexes = {
    monday: [], tuesday: [], wednesday: [], thursday: [],
    friday: [], saturday: [], sunday: []
};

let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let currentPanel = null;
let dragListenersAttached = false;

/* =========================================================
 * 日志系统
 * ========================================================= */
const LOG_KEY_PREFIX = 'logs:';
let _logBuffer = [];
let _logFlushTimer = null;

function _logShardKey(dayKey) { return LOG_KEY_PREFIX + dayKey; }
function _readLogShard(dayKey) {
    const arr = GM_getValue(_logShardKey(dayKey), []);
    return Array.isArray(arr) ? arr : [];
}
function _writeLogShard(dayKey, shard) {
    const max = userConfig.maxHistoryLogs || 500;
    if (shard.length > max) shard.splice(0, shard.length - max);
    GM_setValue(_logShardKey(dayKey), shard);
}
function _cleanOldLogShards() {
    if (typeof GM_listValues === 'undefined' || typeof GM_deleteValue === 'undefined') return;
    const keep = Math.max(1, userConfig.logRetentionDays || 7);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - keep + 1);
    const cutoffKey = getLocalTodayString(cutoff);
    try {
        GM_listValues().forEach(key => {
            if (key.startsWith(LOG_KEY_PREFIX)) {
                const dayKey = key.slice(LOG_KEY_PREFIX.length);
                if (dayKey < cutoffKey) GM_deleteValue(key);
            }
        });
    } catch (e) { /* ignore */ }
}

function addHistoryLog(msg, level = LEVEL.INFO, opts = {}) {
    const entry = {
        ts: nowMs(),
        level,
        cat: opts.cat || CAT.SYSTEM,
        user: opts.user || null,
        msg: String(msg),
        ctx: opts.ctx || null
    };
    _logBuffer.push(entry);
    if (_logBuffer.length >= 20) _flushLogBuffer();
    else if (!_logFlushTimer) _logFlushTimer = setTimeout(_flushLogBuffer, 500);
    _renderLiveLog(entry);
}

function _flushLogBuffer() {
    if (_logFlushTimer) { clearTimeout(_logFlushTimer); _logFlushTimer = null; }
    if (_logBuffer.length === 0) return;
    const dayKey = getLocalTodayString();
    const shard = _readLogShard(dayKey);
    for (const e of _logBuffer) {
        shard.push([e.ts, e.level, e.cat, e.user, e.msg, e.ctx]);
    }
    _writeLogShard(dayKey, shard);
    _logBuffer = [];
}
function _flushLogBufferSync() { _flushLogBuffer(); }

function readLogs(dayKey) {
    _flushLogBufferSync();
    const shard = _readLogShard(dayKey);
    return shard.map(([ts, level, cat, user, msg, ctx]) => ({ ts, level, cat, user, msg, ctx }));
}

function listLogDays() {
    _flushLogBufferSync();
    if (typeof GM_listValues === 'undefined') return [getLocalTodayString()];
    const days = [];
    try {
        GM_listValues().forEach(k => { if (k.startsWith(LOG_KEY_PREFIX)) days.push(k.slice(LOG_KEY_PREFIX.length)); });
    } catch (e) { /* ignore */ }
    days.sort().reverse();
    return days.length ? days : [getLocalTodayString()];
}

function clearLogs(dayKey) {
    if (dayKey) GM_setValue(_logShardKey(dayKey), []);
    else {
        if (typeof GM_listValues !== 'undefined' && typeof GM_deleteValue !== 'undefined') {
            try { GM_listValues().forEach(k => { if (k.startsWith(LOG_KEY_PREFIX)) GM_deleteValue(k); }); } catch (e) { /* ignore */ }
        }
    }
    _logBuffer = [];
}

function _levelIcon(level) {
    return level === LEVEL.SUCCESS ? '✅' : level === LEVEL.ERROR ? '❌' : level === LEVEL.WARN ? '⚠️' : 'ℹ️';
}
function _catLabel(cat) {
    return { send: '发送', api: 'API', ui: 'UI', state: '状态', system: '系统' }[cat] || cat;
}
function _levelColor(level) {
    return level === LEVEL.SUCCESS ? '#00d8b8' : level === LEVEL.ERROR ? '#ff2c54' : level === LEVEL.WARN ? '#ffc107' : '#8fbdff';
}

function _renderLiveLog(entry) {
    const container = document.getElementById('dy-fire-log');
    if (!container) return;
    const line = document.createElement('div');
    line.className = 'dyfire-log-line';
    line.style.color = _levelColor(entry.level);
    const t = new Date(entry.ts);
    const timeStr = t.toLocaleTimeString('zh-CN', { hour12: false });
    const prefix = `${_levelIcon(entry.level)}[${_catLabel(entry.cat)}]`;
    const userPart = entry.user ? `[${entry.user}] ` : '';
    line.textContent = `${timeStr} ${prefix} ${userPart}${entry.msg}`;
    if (entry.level === LEVEL.ERROR && entry.ctx) {
        const btn = document.createElement('span');
        btn.textContent = ' 详情';
        btn.style.cssText = 'color:#8fbdff;cursor:pointer;text-decoration:underline;margin-left:6px;';
        btn.addEventListener('click', () => showLogPanel({ level: LEVEL.ERROR }));
        line.appendChild(btn);
    }
    container.prepend(line);
    const max = userConfig.maxLiveLogs || 8;
    while (container.children.length > max) container.removeChild(container.lastChild);
}

/* =========================================================
 * 存储
 * ========================================================= */
function saveConfig() {
    GM_setValue('userConfig', userConfig);
    GM_setValue('fireDays', userConfig.fireDays);
    GM_setValue('lastFireDate', userConfig.lastFireDate);
    GM_setValue('specialHitokotoSentIndexes', specialHitokotoSentIndexes);
    GM_setValue('retryCount', retryCount);
    GM_setValue('isMaxRetryReached', isMaxRetryReached);
    GM_setValue('lastRetryResetTime', lastRetryResetTime);
}

function initConfig() {
    const saved = GM_getValue('userConfig');
    userConfig = Object.assign({}, DEFAULT_CONFIG, saved || {});

    if (!GM_getValue('txtApiManualSentIndexes')) GM_setValue('txtApiManualSentIndexes', []);
    if (!GM_getValue('fireDays')) GM_setValue('fireDays', userConfig.fireDays);
    else userConfig.fireDays = GM_getValue('fireDays');

    if (!GM_getValue('lastFireDate')) {
        const today = getLocalTodayString();
        GM_setValue('lastFireDate', today);
        userConfig.lastFireDate = today;
    } else userConfig.lastFireDate = GM_getValue('lastFireDate');

    if (!GM_getValue('specialHitokotoSentIndexes')) {
        GM_setValue('specialHitokotoSentIndexes', specialHitokotoSentIndexes);
    } else {
        specialHitokotoSentIndexes = GM_getValue('specialHitokotoSentIndexes', specialHitokotoSentIndexes);
    }

    sentUsersToday = GM_getValue('sentUsersToday', []) || [];
    failedUsersToday = GM_getValue('failedUsersToday', []) || [];
    currentUserIndex = GM_getValue('currentUserIndex', -1);
    retryCount = GM_getValue('retryCount', 0);
    isMaxRetryReached = GM_getValue('isMaxRetryReached', false);
    lastRetryResetTime = GM_getValue('lastRetryResetTime', 0);
    isPaused = GM_getValue('isPaused', false);
    alreadyDoneNotified = GM_getValue('alreadyDoneNotified', false);

    parseTargetUsers();
    GM_setValue('userConfig', userConfig);
    return userConfig;
}

function parseTargetUsers() {
    if (!userConfig.targetUsernames || !userConfig.targetUsernames.trim()) {
        allTargetUsers = [];
        userConfig.enableTargetUser = false;
        return;
    }
    allTargetUsers = userConfig.targetUsernames.trim().split('\n').map(s => s.trim()).filter(Boolean);
    userConfig.enableTargetUser = allTargetUsers.length > 0;
    addHistoryLog(`解析到 ${allTargetUsers.length} 个目标用户`, LEVEL.INFO, { cat: CAT.STATE });
}

/* =========================================================
 * 火花天数
 * ========================================================= */
function _rawUserFireDaysMap() { return GM_getValue('userFireDays', {}); }

function getUserFireEntry(nickname) {
    if (!nickname) return null;
    const map = _rawUserFireDaysMap();
    const raw = map[nickname];
    if (raw === undefined) return null;
    if (typeof raw === 'number') return { days: raw, lastDate: '' };
    if (raw && typeof raw === 'object') {
        return { days: Number(raw.days) || 0, lastDate: raw.lastDate || '' };
    }
    return null;
}

function setUserFireEntry(nickname, days, lastDate) {
    if (!nickname) return;
    const map = _rawUserFireDaysMap();
    const prev = map[nickname];
    let prevDays = 0, prevDate = '';
    if (typeof prev === 'number') { prevDays = prev; }
    else if (prev && typeof prev === 'object') { prevDays = Number(prev.days) || 0; prevDate = prev.lastDate || ''; }

    const newDays = (days !== undefined && days !== null) ? Number(days) : prevDays;
    const newDate = (lastDate !== undefined && lastDate !== null) ? lastDate : prevDate;

    map[nickname] = { days: newDays, lastDate: newDate };
    GM_setValue('userFireDays', map);
}

function getAllFireEntries() {
    const map = _rawUserFireDaysMap();
    const out = {};
    Object.keys(map).forEach(k => {
        const v = map[k];
        if (typeof v === 'number') out[k] = { days: v, lastDate: '' };
        else if (v && typeof v === 'object') out[k] = { days: Number(v.days) || 0, lastDate: v.lastDate || '' };
    });
    return out;
}

function applyFetchedFireDays(nickname, days) {
    if (!nickname || !(days > 0)) return;
    if (userConfig.autoFetchFireDays) {
        setUserFireEntry(nickname, days, getLocalTodayString());
    } else {
        const entry = getUserFireEntry(nickname);
        if (!entry) {
            setUserFireEntry(nickname, days, getLocalTodayString());
        } else {
            const map = _rawUserFireDaysMap();
            map[nickname] = { days: entry.days, lastDate: entry.lastDate || '' };
            GM_setValue('userFireDays', map);
        }
    }
}

function bulkApplyFetchedFireDays(items) {
    if (!items || items.length === 0) return;
    const map = _rawUserFireDaysMap();
    let changed = 0;
    const today = getLocalTodayString();
    items.forEach(({ nickname, days }) => {
        if (!nickname || !(days > 0)) return;
        const raw = map[nickname];
        if (userConfig.autoFetchFireDays) {
            const oldDays = typeof raw === 'number' ? raw : (raw && raw.days) || 0;
            if (oldDays !== days) {
                map[nickname] = { days, lastDate: today };
                changed++;
            } else {
                map[nickname] = { days, lastDate: today };
            }
        } else {
            if (raw === undefined) {
                map[nickname] = { days, lastDate: today };
                changed++;
            }
        }
    });
    GM_setValue('userFireDays', map);
    if (changed > 0) {
        addHistoryLog(`已同步 ${changed} 位好友的火花天数`, LEVEL.SUCCESS, { cat: CAT.STATE });
    }
}

function bumpUserFireDays(nickname) {
    if (!nickname) return;
    if (userConfig.autoFetchFireDays) return;

    const today = getLocalTodayString();
    const entry = getUserFireEntry(nickname);
    if (!entry) {
        setUserFireEntry(nickname, 1, today);
        addHistoryLog(`[${nickname}] 新建火花天数记录: 1`, LEVEL.SUCCESS, { cat: CAT.SYSTEM, user: nickname });
        return;
    }
    if (entry.lastDate === today) return;
    const newDays = (entry.days || 0) + 1;
    setUserFireEntry(nickname, newDays, today);
    addHistoryLog(`[${nickname}] 火花天数 +1 → ${newDays}`, LEVEL.SUCCESS, { cat: CAT.SYSTEM, user: nickname });
}

function getUserFireDays(nickname) {
    if (!nickname) return userConfig.fireDays;
    const entry = getUserFireEntry(nickname);
    if (entry) return entry.days;
    return userConfig.fireDays;
}

/* =========================================================
 * 时间 / 状态
 * ========================================================= */
function isCurrentTimeInRange() {
    const [sh, sm] = userConfig.sendTimeRangeStart.split(':').map(Number);
    const [eh, em] = userConfig.sendTimeRangeEnd.split(':').map(Number);
    const n = new Date();
    const nowM = n.getHours() * 60 + n.getMinutes();
    const start = sh * 60 + sm, end = eh * 60 + em;
    return end > start ? (nowM >= start && nowM <= end) : (nowM >= start || nowM <= end);
}

function isAtOrPastSendTime() {
    const [h, m, s] = userConfig.sendTime.split(':').map(Number);
    const t = new Date();
    t.setHours(h, m, s || 0, 0);
    return new Date() >= t;
}

function updateElementStatus(id, status, isSuccess = true) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = status;
    el.style.color = isSuccess ? '#00d8b8' : '#ff2c54';
}

function pickFromTextList(lines, sentIndexes, isRandom) {
    if (!lines || lines.length === 0) return null;
    if (isRandom) {
        let avail = [];
        for (let i = 0; i < lines.length; i++) if (!sentIndexes.includes(i)) avail.push(i);
        if (avail.length === 0) {
            sentIndexes.length = 0;
            avail = Array.from({ length: lines.length }, (_, i) => i);
        }
        const idx = avail[Math.floor(Math.random() * avail.length)];
        sentIndexes.push(idx);
        return { index: idx, text: lines[idx].trim() };
    }
    let idx = sentIndexes.length > 0 ? (sentIndexes[sentIndexes.length - 1] + 1) % lines.length : 0;
    sentIndexes.push(idx);
    return { index: idx, text: lines[idx].trim() };
}

/* =========================================================
 * 输入 & 发送
 * ========================================================= */
const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;

function simulateMouseClick(element) {
    if (!element || !(element instanceof HTMLElement)) return false;
    const rect = element.getBoundingClientRect();
    element.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2
    }));
    return true;
}

function fireKeyEvent(el, type, key, opts = {}) {
    el.dispatchEvent(new KeyboardEvent(type, {
        key,
        code: key === 'Enter' ? 'Enter' : '',
        keyCode: 13,
        which: 13,
        shiftKey: !!opts.shiftKey,
        ctrlKey: !!opts.ctrlKey,
        bubbles: true,
        cancelable: true,
        composed: true
    }));
}

function triggerEnterToSend(el) {
    if (!el) return;
    fireKeyEvent(el, 'keydown', 'Enter');
    fireKeyEvent(el, 'keypress', 'Enter');
    fireKeyEvent(el, 'keyup', 'Enter');
}

function triggerShiftEnter(el) {
    if (!el) return;
    fireKeyEvent(el, 'keydown', 'Enter', { shiftKey: true });
    fireKeyEvent(el, 'keypress', 'Enter', { shiftKey: true });
    fireKeyEvent(el, 'keyup', 'Enter', { shiftKey: true });
}

async function inputMessageToChatEditor(editor, message) {
    if (!editor || !(editor instanceof HTMLElement)) return false;

    editor.focus();
    simulateMouseClick(editor);
    await sleep(50);

    try {
        document.execCommand('selectAll');
        document.execCommand('delete');
    } catch (e) { /* ignore */ }

    if ((editor.textContent || '').trim() !== '') {
        editor.innerHTML = '<br>';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await sleep(80);

    const lines = message.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (document.activeElement !== editor) editor.focus();
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);

        let inserted = false;
        if (line.length > 0) {
            try { inserted = document.execCommand('insertText', false, line); }
            catch (e) { inserted = false; }

            if (!inserted) {
                const tn = document.createTextNode(line);
                range.insertNode(tn);
                range.setStartAfter(tn);
                range.setEndAfter(tn);
                sel.removeAllRanges();
                sel.addRange(range);
                editor.dispatchEvent(new InputEvent('input', {
                    bubbles: true,
                    cancelable: true,
                    data: line,
                    inputType: 'insertText'
                }));
            }
        }

        if (i < lines.length - 1) {
            await sleep(60);
            triggerShiftEnter(editor);
            await sleep(60);
        }
    }

    editor.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
}

/* =========================================================
 * 火花天数读取
 * ========================================================= */
function readChatPageFireDays() {
    const panelSelectors = [
        '.RightPanelHeadertitleContainer',
        '[class*="RightPanelHeader"]',
        '[class*="RightPanel"] [class*="Header"]'
    ];
    for (const sel of panelSelectors) {
        let panel = null;
        try { panel = document.querySelector(sel); } catch (e) { /* ignore */ }
        if (!panel) continue;
        const streakEl = panel.querySelector('.commonStreaknormalText');
        if (!streakEl) continue;
        const days = parseInt((streakEl.textContent || '').trim()) || 0;
        if (days > 0) return days;
    }
    return 0;
}

/* =========================================================
 * 搜索用户
 * ========================================================= */
async function findAndClickTargetUserChat(username) {
    addHistoryLog(`[Chat] 开始搜索: ${username}`, LEVEL.INFO, { cat: CAT.SEND, user: username });
    updateUserStatus(`搜索: ${username}`, null);

    try {
        const { el: searchInput } = queryFirst(SELECTORS.searchInput);
        if (!searchInput) {
            addHistoryLog('[Chat] 未找到搜索输入框', LEVEL.ERROR, { cat: CAT.SEND, user: username });
            return false;
        }

        searchInput.focus();
        simulateMouseClick(searchInput);
        await sleep(100);

        const lastVal = searchInput.value;
        nativeInputValueSetter.call(searchInput, '');
        if (searchInput._valueTracker) searchInput._valueTracker.setValue(lastVal);
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(150);

        nativeInputValueSetter.call(searchInput, username);
        if (searchInput._valueTracker) searchInput._valueTracker.setValue('');
        searchInput.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            data: username,
            inputType: 'insertText'
        }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));

        addHistoryLog(`[Chat] 已输入: ${username}`, LEVEL.INFO, { cat: CAT.SEND, user: username });

        let chatBtn = null;
        let usedSel = '';
        const start = nowMs();
        while (nowMs() - start < 5000) {
            const { els, sel } = queryAllFirst(SELECTORS.chatBtn);
            for (const btn of els) {
                if (btn.offsetParent !== null &&
                    (btn.textContent.includes('聊天') || btn.textContent.includes('发消息') || sel.includes('chat_btn'))) {
                    chatBtn = btn;
                    usedSel = sel;
                    break;
                }
            }
            if (chatBtn) break;
            await sleep(200);
        }

        if (!chatBtn) {
            addHistoryLog(`[Chat] 未找到 ${username} 的聊天按钮`, LEVEL.WARN, {
                cat: CAT.SEND, user: username,
                ctx: { step: 'findChatBtn', elapsed: nowMs() - start }
            });
            const searchItems = document.querySelectorAll('[class*="SearchPanelitem"], [class*="search-result"]');
            for (const item of searchItems) {
                if (item.textContent.includes(username) && item.offsetParent !== null) {
                    simulateMouseClick(item);
                    addHistoryLog('[Chat] 通过点击搜索结果项进入', LEVEL.INFO, { cat: CAT.SEND, user: username });
                    currentState = STATE.FOUND;
                    if (searchTimeoutId) { clearTimeout(searchTimeoutId); searchTimeoutId = null; }
                    await sleep(2000);
                    waitForPageAndInput();
                    return true;
                }
            }
            return false;
        }

        chatBtn.focus();
        await sleep(50);
        simulateMouseClick(chatBtn);
        addHistoryLog(`[Chat] 已点击聊天按钮 (${usedSel})`, LEVEL.SUCCESS, { cat: CAT.SEND, user: username });

        currentState = STATE.FOUND;
        if (searchTimeoutId) { clearTimeout(searchTimeoutId); searchTimeoutId = null; }

        await sleep(2500);
        waitForPageAndInput();
        return true;
    } catch (err) {
        addHistoryLog(`[Chat] 搜索失败: ${err.message}`, LEVEL.ERROR, {
            cat: CAT.SEND, user: username, ctx: { stack: (err.stack || '').slice(0, 200) }
        });
        return false;
    }
}

async function findAndClickTargetUser() {
    if (!userConfig.enableTargetUser || allTargetUsers.length === 0) {
        updateUserStatus('配置错误', false);
        return false;
    }
    if (currentState !== STATE.SEARCHING) return false;

    searchAttemptCount++;
    if (searchAttemptCount > 50) {
        addHistoryLog(`查找次数过多(${searchAttemptCount})，标记失败`, LEVEL.ERROR, {
            cat: CAT.STATE, user: currentRetryUser
        });
        searchAttemptCount = 0;
        if (currentRetryUser && !failedUsersToday.includes(currentRetryUser)) {
            failedUsersToday.push(currentRetryUser);
            GM_setValue('failedUsersToday', failedUsersToday);
        }
        currentRetryUser = null;
        isProcessing = false;
        currentState = STATE.IDLE;
        checkAllUsersProcessed();
        return false;
    }

    let targetUser;
    if (userConfig.multiUserRetrySame && retryCount > 1 && currentRetryUser) {
        targetUser = currentRetryUser;
    } else {
        targetUser = getNextTargetUser();
        currentRetryUser = targetUser;
    }

    if (!targetUser) {
        updateUserStatus('无目标用户', false);
        isProcessing = false;
        currentRetryUser = null;
        checkAllUsersProcessed();
        return false;
    }

    GM_setValue('lastTargetUser', targetUser);
    updateUserStatus(`寻找: ${targetUser}`, null);
    return await findAndClickTargetUserChat(targetUser);
}

function getNextTargetUser() {
    if (allTargetUsers.length === 0) return null;
    const unsent = allTargetUsers.filter(u => !sentUsersToday.includes(u) && !failedUsersToday.includes(u));
    if (unsent.length === 0) return null;
    if (userConfig.multiUserMode === 'random') return unsent[Math.floor(Math.random() * unsent.length)];
    if (currentUserIndex < 0 || currentUserIndex >= allTargetUsers.length) currentUserIndex = 0;
    for (let i = 0; i < allTargetUsers.length; i++) {
        const idx = (currentUserIndex + i) % allTargetUsers.length;
        const u = allTargetUsers[idx];
        if (!sentUsersToday.includes(u)) {
            currentUserIndex = idx;
            return u;
        }
    }
    return null;
}

function markUserAsSent(username) {
    if (!sentUsersToday.includes(username)) {
        sentUsersToday.push(username);
        GM_setValue('sentUsersToday', sentUsersToday);
    }
    const idx = allTargetUsers.indexOf(username);
    if (idx !== -1) {
        currentUserIndex = (idx + 1) % allTargetUsers.length;
        GM_setValue('currentUserIndex', currentUserIndex);
    }
    addHistoryLog(`用户 ${username} 已标记为已发送`, LEVEL.SUCCESS, { cat: CAT.SEND, user: username });
    updateUserStatusDisplay();
}

/* =========================================================
 * 发送流程
 * ========================================================= */
function sendMessage() {
    if (isPaused) {
        addHistoryLog('脚本已暂停，无法发送', LEVEL.WARN, { cat: CAT.STATE });
        return;
    }
    if (isProcessing) return;
    if (nowMs() - lastSendCompleteTime < 3000) return;

    isMaxRetryReached = false;
    GM_setValue('isMaxRetryReached', false);

    if (userConfig.enableTargetUser && allTargetUsers.length > 0) {
        const unsent = allTargetUsers.filter(u => !sentUsersToday.includes(u) && !failedUsersToday.includes(u));
        if (unsent.length === 0) {
            addHistoryLog('所有目标用户今日已发送', LEVEL.INFO, { cat: CAT.SEND });
            return;
        }
    } else {
        const lastSentDate = GM_getValue('lastSentDate', '');
        if (lastSentDate === getLocalTodayString()) {
            addHistoryLog('今天已发送过消息', LEVEL.INFO, { cat: CAT.SEND });
            return;
        }
    }

    isProcessing = true;
    retryCount = 0;
    currentState = STATE.IDLE;
    searchAttemptCount = 0;
    updateRetryCount();
    addHistoryLog('开始发送流程...', LEVEL.INFO, { cat: CAT.SEND });

    executeSendProcess().catch(err => {
        addHistoryLog(`发送流程异常: ${err.message}`, LEVEL.ERROR, {
            cat: CAT.SEND, ctx: { stack: (err.stack || '').slice(0, 300) }
        });
        isProcessing = false;
        currentState = STATE.IDLE;
        scheduleRetry(5000);
    });
}

async function executeSendProcess() {
    if (isPaused) {
        addHistoryLog('已暂停，中断发送', LEVEL.WARN, { cat: CAT.STATE });
        isProcessing = false;
        currentState = STATE.IDLE;
        return;
    }
    if (nowMs() - lastSendCompleteTime < 5000 && retryCount > 0) return;

    if (isMaxRetryReached && userConfig.retryAfterMaxReached) {
        const intervalMs = (userConfig.autoRetryInterval || 10) * 60 * 1000;
        if (nowMs() - lastRetryResetTime < intervalMs) {
            const remain = Math.ceil((intervalMs - (nowMs() - lastRetryResetTime)) / 60000);
            addHistoryLog(`已达最大重试，${remain}分钟后重试`, LEVEL.INFO, { cat: CAT.STATE });
            isProcessing = false;
            return;
        }
        retryCount = 0;
        isMaxRetryReached = false;
        GM_setValue('retryCount', 0);
        GM_setValue('isMaxRetryReached', false);
    }

    retryCount++;
    GM_setValue('retryCount', retryCount);
    updateRetryCount();

    if (retryCount > userConfig.maxRetryCount) {
        if (userConfig.enableTargetUser && allTargetUsers.length > 0 && currentRetryUser) {
            addHistoryLog(`用户 ${currentRetryUser} 达到最大重试，标记失败`, LEVEL.ERROR, {
                cat: CAT.SEND, user: currentRetryUser
            });
            if (!failedUsersToday.includes(currentRetryUser)) {
                failedUsersToday.push(currentRetryUser);
                GM_setValue('failedUsersToday', failedUsersToday);
            }
            retryCount = 0;
            GM_setValue('retryCount', 0);
            updateRetryCount();
            currentRetryUser = null;
            isProcessing = false;
            currentState = STATE.IDLE;
            checkAllUsersProcessed();
            return;
        }
        addHistoryLog(`已达最大重试次数 (${userConfig.maxRetryCount})`, LEVEL.ERROR, { cat: CAT.SEND });
        isProcessing = false;
        currentState = STATE.IDLE;
        currentRetryUser = null;
        return;
    }

    if (retryCount === 1) {
        addHistoryLog(`开始发送任务，共 ${allTargetUsers.length} 个用户`, LEVEL.INFO, { cat: CAT.SEND });
    } else {
        addHistoryLog(`重试 (${retryCount}/${userConfig.maxRetryCount})`, LEVEL.INFO, { cat: CAT.SEND });
    }

    if (userConfig.enableTargetUser && allTargetUsers.length > 0) {
        currentState = STATE.SEARCHING;
        if (searchTimeoutId) clearTimeout(searchTimeoutId);
        searchTimeoutId = setTimeout(() => {
            searchTimeoutId = null;
            if (currentState === STATE.SEARCHING) {
                addHistoryLog('用户查找超时', LEVEL.ERROR, { cat: CAT.SEND, user: currentRetryUser });
                updateUserStatus('查找超时', false);
                scheduleRetry(5000);
            }
        }, userConfig.userSearchTimeout);

        const found = await findAndClickTargetUser();
        if (found && searchTimeoutId) { clearTimeout(searchTimeoutId); searchTimeoutId = null; }
    } else {
        setTimeout(tryFindChatInput, 1000);
    }
}

function scheduleRetry(delayMs) {
    if (autoRetryTimer) clearTimeout(autoRetryTimer);
    autoRetryTimer = setTimeout(() => {
        autoRetryTimer = null;
        if (!isPaused && !isProcessing) {
            isProcessing = true;
            executeSendProcess().catch(err => {
                addHistoryLog(`重试异常: ${err.message}`, LEVEL.ERROR, { cat: CAT.SEND });
                isProcessing = false;
            });
        }
    }, delayMs);
}

/* =========================================================
 * 输入框查找 & 发送
 * ========================================================= */
function waitForPageAndInput() {
    addHistoryLog('开始查找聊天输入框', LEVEL.INFO, { cat: CAT.SEND });
    tryFindChatInput();
}

async function tryFindChatInput() {
    if (chatInputCheckTimer) { clearTimeout(chatInputCheckTimer); chatInputCheckTimer = null; }

    const { el: editor } = queryFirst(SELECTORS.chatInput);
    if (!editor) {
        chatInputNotFoundCount++;
        if (chatInputNotFoundCount === 1 || chatInputNotFoundCount % 5 === 0) {
            addHistoryLog(`未找到输入框 (${chatInputNotFoundCount})`, LEVEL.INFO, { cat: CAT.SEND });
        }
        if (chatInputNotFoundCount >= userConfig.maxRetryCount) {
            addHistoryLog(`查找输入框超过最大重试`, LEVEL.ERROR, { cat: CAT.SEND });
            chatInputNotFoundCount = 0;
            scheduleRetry(5000);
            return;
        }
        chatInputCheckTimer = setTimeout(tryFindChatInput, userConfig.chatInputCheckInterval);
        return;
    }

    chatInputNotFoundCount = 0;
    addHistoryLog('找到聊天输入框', LEVEL.INFO, { cat: CAT.SEND });

    const currentTargetUser = GM_getValue('lastTargetUser', '');

    const sparkDays = readChatPageFireDays();
    if (sparkDays > 0 && currentTargetUser) {
        applyFetchedFireDays(currentTargetUser, sparkDays);
        const el = document.getElementById('dy-fire-days');
        if (el) el.textContent = sparkDays;
    }

    let messageToSend;
    try {
        messageToSend = await getMessageContent(currentTargetUser);
    } catch (err) {
        addHistoryLog(`消息获取失败: ${err.message}`, LEVEL.ERROR, { cat: CAT.API });
        messageToSend = `${userConfig.baseMessage} | 消息获取失败~`;
    }

    currentState = STATE.SENDING;

    const ok = await inputMessageToChatEditor(editor, messageToSend);
    if (!ok) {
        addHistoryLog('消息输入失败', LEVEL.ERROR, { cat: CAT.SEND });
        scheduleRetry(5000);
        return;
    }

    await sleep(500);

    addHistoryLog('正在发送消息...', LEVEL.INFO, { cat: CAT.SEND });
    triggerEnterToSend(editor);
    await sleep(1200);

    addHistoryLog('消息发送成功', LEVEL.SUCCESS, { cat: CAT.SEND, user: currentTargetUser });
    searchAttemptCount = 0;

    const newSparkDays = readChatPageFireDays();
    if (newSparkDays > 0 && currentTargetUser) {
        applyFetchedFireDays(currentTargetUser, newSparkDays);
    } else if (currentTargetUser) {
        bumpUserFireDays(currentTargetUser);
    }

    updateFireDays();

    if (userConfig.enableTargetUser && allTargetUsers.length > 0) {
        if (currentTargetUser) markUserAsSent(currentTargetUser);
    } else {
        GM_setValue('lastSentDate', getLocalTodayString());
        updateUserStatusDisplay();
    }

    updateStatus(true);
    isProcessing = false;
    currentState = STATE.IDLE;
    currentRetryUser = null;
    retryCount = 0;
    isMaxRetryReached = false;
    GM_setValue('retryCount', 0);
    GM_setValue('isMaxRetryReached', false);
    updateRetryCount();

    if (userConfig.enableTargetUser && allTargetUsers.length > 0) {
        const unsent = allTargetUsers.filter(u => !sentUsersToday.includes(u) && !failedUsersToday.includes(u));
        if (unsent.length > 0) {
            addHistoryLog(`还有 ${unsent.length} 个用户待发送`, LEVEL.INFO, { cat: CAT.SEND });
            const { el: list } = queryFirst(SELECTORS.conversationList);
            if (list) { await sleep(300); list.scrollTop = 0; }
            lastSendCompleteTime = nowMs();
            setTimeout(sendMessage, 3000);
        } else {
            addHistoryLog('所有用户发送完成！', LEVEL.SUCCESS, { cat: CAT.SEND });
            lastSendCompleteTime = nowMs();
            checkAllUsersProcessed();
        }
    } else {
        lastSendCompleteTime = nowMs();
        checkAllUsersProcessed();
    }

    if (typeof GM_notification !== 'undefined') {
        try { GM_notification({ title: '抖音续火助手', text: '续火消息发送成功！', timeout: 3000 }); }
        catch (e) { try { GM_notification('续火消息发送成功！', '抖音续火助手'); } catch (e2) { /* ignore */ } }
    }
}

/* =========================================================
 * 消息内容组装
 * ========================================================= */
async function getMessageContent(username) {
    let customMessage = userConfig.customMessage || userConfig.baseMessage;
    const parts = [];

    let hitokoto = '';
    if (userConfig.useHitokoto) {
        try { hitokoto = await getHitokoto(); parts.push('一言'); }
        catch (err) { addHistoryLog(`一言获取失败: ${err.message}`, LEVEL.ERROR, { cat: CAT.API }); hitokoto = '一言获取失败~'; }
    }

    let txtApi = '';
    if (userConfig.useTxtApi) {
        try { txtApi = await getTxtApiContent(); parts.push('TXTAPI'); }
        catch (err) { addHistoryLog(`TXTAPI获取失败: ${err.message}`, LEVEL.ERROR, { cat: CAT.API }); txtApi = 'TXTAPI获取失败~'; }
    }

    let special = '';
    if (userConfig.useSpecialHitokoto) {
        try { special = await getSpecialHitokoto(); parts.push('专属一言'); }
        catch (err) { addHistoryLog(`专属一言获取失败: ${err.message}`, LEVEL.ERROR, { cat: CAT.API }); special = '专属一言获取失败~'; }
    }

    if (parts.length > 0) addHistoryLog(`消息内容准备完成 [${parts.join(' + ')}]`, LEVEL.SUCCESS, { cat: CAT.API });

    if (customMessage.includes('[API]')) customMessage = customMessage.replace(/\[API\]/g, hitokoto);
    else if (userConfig.useHitokoto) customMessage += ` | ${hitokoto}`;

    if (customMessage.includes('[TXTAPI]')) customMessage = customMessage.replace(/\[TXTAPI\]/g, txtApi);
    else if (userConfig.useTxtApi) customMessage += ` | ${txtApi}`;

    if (customMessage.includes('[专属一言]')) customMessage = customMessage.replace(/\[专属一言\]/g, special);
    else if (userConfig.useSpecialHitokoto) customMessage += ` | ${special}`;

    if (customMessage.includes('[天数]')) {
        const days = username ? getUserFireDays(username) : userConfig.fireDays;
        customMessage = customMessage.replace(/\[天数\]/g, days || 1);
    }
    return customMessage;
}

function getHitokoto() {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('一言API请求超时')), userConfig.hitokotoTimeout);
        GM_xmlhttpRequest({
            method: 'GET',
            url: 'https://v1.hitokoto.cn/',
            responseType: 'json',
            onload: (res) => {
                clearTimeout(timer);
                if (res.status === 200) {
                    try {
                        const data = res.response;
                        updateElementStatus('dy-fire-hitokoto', '获取成功');
                        resolve(formatHitokoto(userConfig.hitokotoFormat, data));
                    } catch (e) {
                        updateElementStatus('dy-fire-hitokoto', '解析失败', false);
                        reject(new Error('一言解析失败'));
                    }
                } else {
                    updateElementStatus('dy-fire-hitokoto', '请求失败', false);
                    reject(new Error(`一言请求失败: ${res.status}`));
                }
            },
            onerror: () => { clearTimeout(timer); updateElementStatus('dy-fire-hitokoto', '网络错误', false); reject(new Error('一言网络错误')); },
            ontimeout: () => { clearTimeout(timer); updateElementStatus('dy-fire-hitokoto', '请求超时', false); reject(new Error('一言请求超时')); }
        });
    });
}

function formatHitokoto(format, data) {
    let result = format.replace(/{hitokoto}/g, data.hitokoto || '');
    const fromFormatted = data.from ? userConfig.fromFormat.replace(/{from}/g, data.from) : '';
    result = result.replace(/{from}/g, fromFormatted);
    const fromWhoFormatted = data.from_who ? userConfig.fromWhoFormat.replace(/{from_who}/g, data.from_who) : '';
    result = result.replace(/{from_who}/g, fromWhoFormatted);
    return result;
}

function getSpecialHitokoto() {
    try {
        const d = new Date();
        const dow = d.getDay();
        const keys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const key = keys[dow];
        const name = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dow];
        const cap = key.charAt(0).toUpperCase() + key.slice(1);
        const text = userConfig[`specialHitokoto${cap}`] || '';
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length === 0) {
            updateElementStatus('dy-fire-special-hitokoto', `${name}无内容`, false);
            return Promise.resolve(`${name}暂无专属一言`);
        }
        if (!specialHitokotoSentIndexes[key]) specialHitokotoSentIndexes[key] = [];
        const picked = pickFromTextList(lines, specialHitokotoSentIndexes[key], userConfig.specialHitokotoRandom);
        GM_setValue('specialHitokotoSentIndexes', specialHitokotoSentIndexes);
        updateElementStatus('dy-fire-special-hitokoto', `${name}获取成功`);
        return Promise.resolve(`${name}专属: ${picked.text}`);
    } catch (err) {
        updateElementStatus('dy-fire-special-hitokoto', '获取失败', false);
        return Promise.reject(err);
    }
}

function getTxtApiContent() {
    return new Promise((resolve, reject) => {
        if (userConfig.txtApiMode === 'api') {
            const timer = setTimeout(() => reject(new Error('TXTAPI请求超时')), userConfig.txtApiTimeout);
            GM_xmlhttpRequest({
                method: 'GET',
                url: userConfig.txtApiUrl,
                onload: (res) => {
                    clearTimeout(timer);
                    if (res.status === 200) {
                        updateElementStatus('dy-fire-txtapi', '获取成功');
                        resolve((res.responseText || '').trim());
                    } else {
                        updateElementStatus('dy-fire-txtapi', '请求失败', false);
                        reject(new Error(`TXTAPI请求失败: ${res.status}`));
                    }
                },
                onerror: () => { clearTimeout(timer); updateElementStatus('dy-fire-txtapi', '网络错误', false); reject(new Error('TXTAPI网络错误')); },
                ontimeout: () => { clearTimeout(timer); updateElementStatus('dy-fire-txtapi', '请求超时', false); reject(new Error('TXTAPI请求超时')); }
            });
        } else {
            try {
                const lines = userConfig.txtApiManualText.split('\n').filter(l => l.trim());
                if (lines.length === 0) {
                    updateElementStatus('dy-fire-txtapi', '无内容', false);
                    return reject(new Error('手动文本为空'));
                }
                let sent = GM_getValue('txtApiManualSentIndexes', []);
                const picked = pickFromTextList(lines, sent, userConfig.txtApiManualRandom);
                GM_setValue('txtApiManualSentIndexes', sent);
                updateElementStatus('dy-fire-txtapi', '获取成功');
                resolve(picked.text);
            } catch (err) {
                updateElementStatus('dy-fire-txtapi', '解析失败', false);
                reject(err);
            }
        }
    });
}

/* =========================================================
 * 时间 / 状态刷新
 * ========================================================= */
function parseTimeString(timeStr) {
    const [h, m, s] = timeStr.split(':').map(Number);
    const t = new Date();
    t.setHours(h, m, s || 0, 0);
    if (t <= new Date()) t.setDate(t.getDate() + 1);
    return t;
}

function parseRandomTimeString() {
    if (!userConfig.sendTimeRandom) return parseTimeString(userConfig.sendTime);
    const [sh, sm, ss] = userConfig.sendTimeRangeStart.split(':').map(Number);
    const [eh, em] = userConfig.sendTimeRangeEnd.split(':').map(Number);
    const startM = sh * 60 + sm;
    const endM = eh * 60 + em;
    let rnd;
    if (endM > startM) rnd = startM + Math.floor(Math.random() * (endM - startM));
    else rnd = startM + Math.floor(Math.random() * (1440 - startM + endM));
    const h = Math.floor(rnd / 60) % 24;
    const m = rnd % 60;
    const t = new Date();
    t.setHours(h, m, ss || 0, 0);
    if (t <= new Date()) t.setDate(t.getDate() + 1);
    return t;
}

function updateStatus(status) {
    const statusEl = document.getElementById('dy-fire-status');
    if (statusEl) {
        if (status === true) { statusEl.textContent = '已发送'; statusEl.style.color = '#00d8b8'; }
        else if (status === false) { statusEl.textContent = '未发送'; statusEl.style.color = '#dc3545'; }
        else if (status === 'sending') { statusEl.textContent = '发送中'; statusEl.style.color = '#ffc107'; }
    }
    const now = new Date();
    if (status === true) {
        nextSendTime = parseRandomTimeString();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (nextSendTime.getDate() !== tomorrow.getDate()) nextSendTime.setDate(tomorrow.getDate());
    } else if (status === false) {
        nextSendTime = parseRandomTimeString();
        if (nextSendTime <= now) nextSendTime.setDate(nextSendTime.getDate() + 1);
    }
    const nextEl = document.getElementById('dy-fire-next');
    if (nextEl) nextEl.textContent = nextSendTime.toLocaleString();
    if (status !== 'sending') startCountdown(nextSendTime);
}

function updateRetryCount() {
    const el = document.getElementById('dy-fire-retry');
    if (el) el.textContent = `${retryCount}/${userConfig.maxRetryCount}`;
}

function updateFireDaysStatus() {
    const el = document.getElementById('dy-fire-days');
    if (el) { el.textContent = userConfig.fireDays; el.style.color = '#00d8b8'; }
}

function updateFireDays() {
    const today = getLocalTodayString();
    const last = userConfig.lastFireDate || '';
    if (last !== today) {
        userConfig.fireDays++;
        userConfig.lastFireDate = today;
        GM_setValue('fireDays', userConfig.fireDays);
        GM_setValue('lastFireDate', today);
        addHistoryLog(`新的一天，全局火花天数 = ${userConfig.fireDays}`, LEVEL.SUCCESS, { cat: CAT.SYSTEM });
        updateFireDaysStatus();
    }
}

function checkIfShouldResetForNewDay() {
    return GM_getValue('lastResetDate', '') !== getLocalTodayString();
}

function resetTodaySentUsers() {
    sentUsersToday = [];
    failedUsersToday = [];
    GM_setValue('sentUsersToday', []);
    GM_setValue('failedUsersToday', []);
    currentUserIndex = -1;
    GM_setValue('currentUserIndex', -1);
    GM_setValue('lastSentDate', '');
    currentRetryUser = null;
    alreadyDoneNotified = false;
    GM_setValue('alreadyDoneNotified', false);
    GM_setValue('lastResetDate', getLocalTodayString());
    searchAttemptCount = 0;
    addHistoryLog('今日发送记录已重置', LEVEL.INFO, { cat: CAT.STATE });
    updateUserStatusDisplay();
}

function updateUserStatusDisplay() {
    const statusEl = document.getElementById('dy-fire-user-status');
    const progressEl = document.getElementById('dy-fire-user-progress');
    if (!statusEl || !progressEl) return;
    if (!userConfig.enableTargetUser || allTargetUsers.length === 0) {
        const isSent = GM_getValue('lastSentDate', '') === getLocalTodayString();
        progressEl.textContent = isSent ? '1/1' : '0/1';
        statusEl.textContent = isSent ? '已完成' : '未开始';
        statusEl.style.color = isSent ? '#00d8b8' : '#999';
        return;
    }
    const sent = sentUsersToday.length;
    const total = allTargetUsers.length;
    progressEl.textContent = `${sent}/${total}`;
    if (sent >= total) { statusEl.textContent = '全部完成'; statusEl.style.color = '#00d8b8'; }
    else { statusEl.textContent = `进行中 ${sent}/${total}`; statusEl.style.color = '#ff2c54'; }
}

function updateUserStatus(text, isSuccess = null) {
    const statusEl = document.getElementById('dy-fire-user-status');
    if (!statusEl) return;
    if (text) statusEl.textContent = text;
    if (isSuccess === true) statusEl.style.color = '#00d8b8';
    else if (isSuccess === false) statusEl.style.color = '#ff2c54';
    else statusEl.style.color = '#999';
}

/* =========================================================
 * 自动发送 + 精确调度
 * ========================================================= */
function autoSendIfNeeded() {
    if (isPaused || isProcessing) return;
    if (nowMs() - lastSendCompleteTime < 3000) return;

    const today = getLocalTodayString();

    if (userConfig.enableTargetUser && allTargetUsers.length > 0) {
        if (checkIfShouldResetForNewDay()) {
            addHistoryLog('新的一天，重置今日记录', LEVEL.INFO, { cat: CAT.STATE });
            resetTodaySentUsers();
        } else if (alreadyDoneNotified) return;

        const unsent = allTargetUsers.filter(u => !sentUsersToday.includes(u) && !failedUsersToday.includes(u));
        if (unsent.length > 0) {
            const should = userConfig.sendTimeRandom ? isCurrentTimeInRange() : isAtOrPastSendTime();
            if (should) {
                addHistoryLog(`自动触发：${unsent.length} 个用户未发送`, LEVEL.INFO, { cat: CAT.SEND });
                sendMessage();
            }
        }
    } else {
        const lastSentDate = GM_getValue('lastSentDate', '');
        if (lastSentDate !== today) {
            if (alreadyDoneNotified) { alreadyDoneNotified = false; GM_setValue('alreadyDoneNotified', false); }
            const should = userConfig.sendTimeRandom ? isCurrentTimeInRange() : isAtOrPastSendTime();
            if (should) {
                addHistoryLog('自动触发：今日未发送', LEVEL.INFO, { cat: CAT.SEND });
                sendMessage();
            }
        } else {
            if (!alreadyDoneNotified) {
                alreadyDoneNotified = true;
                GM_setValue('alreadyDoneNotified', true);
                addHistoryLog('今日已发送完毕', LEVEL.INFO, { cat: CAT.STATE });
            }
        }
    }
}

function _scheduleNextAutoCheck() {
    if (_autoSendTimer) { clearTimeout(_autoSendTimer); _autoSendTimer = null; }
    if (isPaused) return;
    if (alreadyDoneNotified) return;

    let delay = 60000;
    if (nextSendTime) {
        const diff = nextSendTime.getTime() - nowMs();
        if (diff > 0 && diff < 60000) delay = diff + 100;
        else if (diff <= 0) delay = 1000;
    }
    _autoSendTimer = setTimeout(() => {
        _autoSendTimer = null;
        autoSendIfNeeded();
        _scheduleNextAutoCheck();
    }, delay);
}

function startCountdown(targetTime) {
    if (countdownInterval) clearInterval(countdownInterval);
    function update() {
        const diff = targetTime - new Date();
        if (diff <= 0) {
            const el = document.getElementById('dy-fire-countdown');
            if (el) el.textContent = '00:00:00';
            updateStatus('sending');

            if (userConfig.enableTargetUser && allTargetUsers.length > 0) {
                if (checkIfShouldResetForNewDay()) resetTodaySentUsers();
                const unsent = allTargetUsers.filter(u => !sentUsersToday.includes(u) && !failedUsersToday.includes(u));
                if (unsent.length > 0) { if (!isProcessing) sendMessage(); }
                else {
                    GM_setValue('lastResetDate', getLocalTodayString());
                    nextSendTime = parseRandomTimeString();
                    const t = new Date();
                    t.setDate(t.getDate() + 1);
                    if (nextSendTime.getDate() !== t.getDate()) nextSendTime.setDate(t.getDate());
                    startCountdown(nextSendTime);
                    updateStatus(true);
                }
            } else {
                const lastSentDate = GM_getValue('lastSentDate', '');
                if (lastSentDate === getLocalTodayString()) {
                    nextSendTime = parseRandomTimeString();
                    const t = new Date();
                    t.setDate(t.getDate() + 1);
                    if (nextSendTime.getDate() !== t.getDate()) nextSendTime.setDate(t.getDate());
                    startCountdown(nextSendTime);
                    updateStatus(true);
                } else {
                    if (!isProcessing) {
                        GM_setValue('lastSentDate', '');
                        updateStatus(false);
                        sendMessage();
                    }
                }
            }
            return;
        }
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        const el = document.getElementById('dy-fire-countdown');
        if (el) el.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    update();
    countdownInterval = setInterval(update, 1000);
}

/* =========================================================
 * 暂停 / 恢复
 * ========================================================= */
function togglePause() {
    isPaused = !isPaused;
    GM_setValue('isPaused', isPaused);

    if (isPaused) {
        addHistoryLog('脚本已暂停', LEVEL.WARN, { cat: CAT.STATE });
        if (chatInputCheckTimer) { clearTimeout(chatInputCheckTimer); chatInputCheckTimer = null; }
        if (searchTimeoutId) { clearTimeout(searchTimeoutId); searchTimeoutId = null; }
        if (autoRetryTimer) { clearTimeout(autoRetryTimer); autoRetryTimer = null; }
        if (_autoSendTimer) { clearTimeout(_autoSendTimer); _autoSendTimer = null; }
        if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
        if (isProcessing) {
            isProcessing = false;
            currentState = STATE.IDLE;
            currentRetryUser = null;
        }
    } else {
        addHistoryLog('脚本已恢复', LEVEL.SUCCESS, { cat: CAT.STATE });
        alreadyDoneNotified = false;
        _scheduleNextAutoCheck();
        if (nextSendTime) startCountdown(nextSendTime);
    }

    updatePauseButton();
    updatePauseStatusDisplay();
}

function updatePauseButton() {
    const btn = document.getElementById('dy-fire-pause');
    if (!btn) return;
    if (isPaused) {
        btn.innerHTML = '▶️ 继续';
        btn.style.background = 'linear-gradient(135deg,#00d8b8 0%,#00b8a8 100%)';
    } else {
        btn.innerHTML = '⏸️ 暂停';
        btn.style.background = 'linear-gradient(135deg,#ff9500 0%,#ffcc00 100%)';
    }
}

function updatePauseStatusDisplay() {
    const el = document.getElementById('dy-fire-pause-status');
    if (el) el.style.display = isPaused ? 'block' : 'none';
}

/* =========================================================
 * 完成检查 / 后端回调
 * ========================================================= */
function checkAllUsersProcessed() {
    if (!userConfig.enableTargetUser || allTargetUsers.length === 0) {
        const lastSentDate = GM_getValue('lastSentDate', '');
        if (lastSentDate === getLocalTodayString() && !alreadyDoneNotified) {
            alreadyDoneNotified = true;
            GM_setValue('alreadyDoneNotified', true);
            addHistoryLog('单用户今日发送完成', LEVEL.SUCCESS, { cat: CAT.SEND });
            notifyScriptB({ mode: 'single', status: 'success' });
        }
        return;
    }

    const done = new Set([...sentUsersToday, ...failedUsersToday]);
    const allDone = allTargetUsers.every(u => done.has(u));
    if (!allDone) {
        if (!isProcessing) {
            isProcessing = true;
            setTimeout(executeSendProcess, 500);
        }
        return;
    }

    const ok = sentUsersToday.length;
    const fail = failedUsersToday.length;

    if (!alreadyDoneNotified) {
        alreadyDoneNotified = true;
        GM_setValue('alreadyDoneNotified', true);
    }

    if (fail === 0) {
        addHistoryLog('所有用户发送成功！', LEVEL.SUCCESS, { cat: CAT.SEND });
        notifyScriptB({ mode: 'multi', status: 'success', sentCount: ok, failCount: 0, failedUsers: [] });
    } else if (ok === 0) {
        addHistoryLog(`所有用户发送失败：${fail} 个`, LEVEL.ERROR, { cat: CAT.SEND });
        notifyScriptB({ mode: 'multi', status: 'all_failed', sentCount: 0, failCount: fail, failedUsers: failedUsersToday });
    } else {
        addHistoryLog(`完成：成功 ${ok}，失败 ${fail}`, LEVEL.WARN, { cat: CAT.SEND });
        notifyScriptB({ mode: 'multi', status: 'partial', sentCount: ok, failCount: fail, failedUsers: failedUsersToday });
    }
}

function notifyScriptB(payload) {
    if (!userConfig.enableScriptBCallback) return;
    const port = userConfig.scriptBCallbackPort || 7788;
    const retryMs = (userConfig.backendRetryMinutes || 25) * 60 * 1000;
    const onUnavailable = () => {
        addHistoryLog(`后端不可达，${userConfig.backendRetryMinutes || 25} 分钟后重试`, LEVEL.WARN, { cat: CAT.API });
        setTimeout(() => notifyScriptB(payload), retryMs);
    };
    GM_xmlhttpRequest({
        method: 'POST',
        url: `http://localhost:${port}/done`,
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify(Object.assign({ timestamp: nowMs() }, payload)),
        timeout: 5000,
        onerror: () => { addHistoryLog('通知后端失败', LEVEL.ERROR, { cat: CAT.API }); onUnavailable(); },
        ontimeout: () => { addHistoryLog('通知后端超时', LEVEL.ERROR, { cat: CAT.API }); onUnavailable(); },
        onload: (res) => { addHistoryLog(`已通知后端，响应: ${res.status}`, LEVEL.INFO, { cat: CAT.API }); }
    });
}

/* =========================================================
 * 数据清理
 * ========================================================= */
function clearData() {
    GM_setValue('lastSentDate', '');
    GM_setValue('txtApiManualSentIndexes', []);
    GM_setValue('lastTargetUser', '');
    specialHitokotoSentIndexes = { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] };
    GM_setValue('specialHitokotoSentIndexes', specialHitokotoSentIndexes);
    failedUsersToday = [];
    GM_setValue('failedUsersToday', []);
    resetTodaySentUsers();
    currentRetryUser = null;
    retryCount = 0;
    isMaxRetryReached = false;
    lastRetryResetTime = 0;
    GM_setValue('retryCount', 0);
    GM_setValue('isMaxRetryReached', false);
    GM_setValue('lastRetryResetTime', 0);

    addHistoryLog('发送记录已清空', LEVEL.INFO, { cat: CAT.STATE });
    updateStatus(false);
    updateRetryCount();
    updateElementStatus('dy-fire-hitokoto', '未获取');
    updateElementStatus('dy-fire-txtapi', '未获取');
    updateElementStatus('dy-fire-special-hitokoto', '未获取');
    updateUserStatusDisplay();

    if (chatInputCheckTimer) { clearTimeout(chatInputCheckTimer); chatInputCheckTimer = null; }
    if (autoRetryTimer) { clearTimeout(autoRetryTimer); autoRetryTimer = null; }
    if (searchTimeoutId) { clearTimeout(searchTimeoutId); searchTimeoutId = null; }
}

function resetAllConfig() {
    if (typeof GM_listValues !== 'undefined' && typeof GM_deleteValue !== 'undefined') {
        try { GM_listValues().forEach(k => GM_deleteValue(k)); } catch (e) { /* ignore */ }
    }
    initConfig();
    isPaused = false;
    GM_setValue('isPaused', false);
    currentRetryUser = null;
    addHistoryLog('所有配置已重置', LEVEL.INFO, { cat: CAT.STATE });
    updateStatus(false);
    retryCount = 0;
    updateRetryCount();
    updateElementStatus('dy-fire-hitokoto', '未获取');
    updateElementStatus('dy-fire-txtapi', '未获取');
    updateElementStatus('dy-fire-special-hitokoto', '未获取');
    updateFireDaysStatus();
    updateUserStatusDisplay();
    if (chatInputCheckTimer) { clearTimeout(chatInputCheckTimer); chatInputCheckTimer = null; }
    if (autoRetryTimer) { clearTimeout(autoRetryTimer); autoRetryTimer = null; }
}

/* =========================================================
 * 用户选择面板
 * ========================================================= */
function autoScrollChatListAndCollect(panelEl, onNewItems, onDone) {
    const NO_MORE_SEL = SELECTORS.noMore.join(',');
    const ITEM_SEL = SELECTORS.conversationItem.join(',');
    const TITLE_SEL = SELECTORS.conversationTitle.join(',');
    const seen = new Set();

    const collectFromRoot = (root) => {
        const fresh = [];
        if (!root || !root.querySelectorAll) return fresh;
        let items = [];
        try { items = root.querySelectorAll(ITEM_SEL); } catch (e) { return fresh; }
        items.forEach(item => {
            const titleEl = item.querySelector(TITLE_SEL);
            if (!titleEl) return;
            const nickname = (titleEl.textContent || '').trim();
            if (!nickname) return;
            if (seen.has(nickname)) return;
            seen.add(nickname);

            let days = 0;
            const streakEl = item.querySelector('.commonStreaknormalText');
            if (streakEl) {
                days = parseInt((streakEl.textContent || '').trim()) || 0;
            }
            fresh.push({ nickname, days });
        });
        return fresh;
    };

    let container = null;
    const sampleItem = document.querySelector(ITEM_SEL);
    if (sampleItem) {
        let el = sampleItem.parentElement;
        while (el && el !== document.body) {
            const s = window.getComputedStyle(el);
            if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 10) {
                container = el;
                break;
            }
            el = el.parentElement;
        }
    }

    const initial = collectFromRoot(document);
    if (initial.length) onNewItems(initial);
    if (!container) { onDone(); return; }

    const origScrollTop = container.scrollTop;
    let lastScrollTop = -1;
    let stuck = 0;

    const observer = new MutationObserver(() => {
        const fresh = collectFromRoot(container);
        if (fresh.length) onNewItems(fresh);
    });
    observer.observe(container, { childList: true, subtree: true });

    const step = () => {
        if (!document.body.contains(panelEl)) {
            observer.disconnect();
            container.scrollTop = origScrollTop;
            return;
        }
        if (document.querySelector(NO_MORE_SEL)) {
            observer.disconnect();
            container.scrollTop = origScrollTop;
            onDone();
            return;
        }
        container.scrollTop += 500;
        if (container.scrollTop === lastScrollTop) {
            if (++stuck >= 4) {
                observer.disconnect();
                container.scrollTop = origScrollTop;
                onDone();
                return;
            }
        } else stuck = 0;
        lastScrollTop = container.scrollTop;
        setTimeout(step, 350);
    };
    setTimeout(step, 100);
}

function showUserSelectPanel() {
    const existing = document.getElementById('dy-fire-user-select-panel');
    if (existing) { existing.remove(); return; }

    let currentTargets = [];
    if (userConfig.targetUsernames && userConfig.targetUsernames.trim()) {
        currentTargets = userConfig.targetUsernames.split('\n').map(u => u.trim()).filter(Boolean);
    }

    const panel = document.createElement('div');
    panel.id = 'dy-fire-user-select-panel';
    panel.className = 'dyfire-modal';
    panel.innerHTML = `
        <div id="dy-fire-user-select-header" class="dyfire-modal-header">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <h3 style="margin:0;color:#fff;font-size:18px;font-weight:600;">👥 选择用户 <span id="dy-fire-user-select-count" style="color:#00d8b8;">(加载中…)</span></h3>
                <button id="dy-fire-user-select-close" class="dyfire-close-btn">×</button>
            </div>
        </div>
        <div class="dyfire-toolbar">
            <button id="dy-fire-select-all" class="dyfire-btn dyfire-btn-info">全选</button>
            <span id="dy-fire-user-select-loading-badge" style="font-size:12px;color:#ff2c54;">⏳ 滚动加载中…</span>
            <button id="dy-fire-deselect-all" class="dyfire-btn dyfire-btn-danger">取消全选</button>
        </div>
        <div id="dy-fire-user-list-container" class="dyfire-user-list"></div>
        <div class="dyfire-modal-footer">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <button id="dy-fire-user-select-add" class="dyfire-btn dyfire-btn-primary">✅ 更新目标用户</button>
                <button id="dy-fire-user-select-cancel" class="dyfire-btn dyfire-btn-danger">❌ 取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(panel);
    addDragFunctionality(panel, 'dy-fire-user-select-header');

    const countEl = document.getElementById('dy-fire-user-select-count');
    const badgeEl = document.getElementById('dy-fire-user-select-loading-badge');
    const listEl = document.getElementById('dy-fire-user-list-container');

    let total = 0;
    const appendRows = (items) => {
        const frag = document.createDocumentFragment();
        items.forEach(({ nickname, days }) => {
            const checked = currentTargets.includes(nickname);
            const safeNickname = escapeHtml(nickname);
            const daysBadge = days > 0
                ? `<span style="margin-left:8px;font-size:11px;color:#ff9500;background:rgba(255,149,0,.15);border:1px solid rgba(255,149,0,.3);border-radius:10px;padding:1px 8px;white-space:nowrap;">🔥 ${days}天</span>`
                : '';
            const row = document.createElement('div');
            row.className = 'dyfire-user-row';
            row.innerHTML = `<label style="display:flex;align-items:center;cursor:pointer;">
                <input type="checkbox" class="user-checkbox" value="${safeNickname}" ${checked ? 'checked' : ''} style="margin-right:10px;">
                <span style="color:#fff;font-size:14px;flex:1;">${safeNickname}</span>${daysBadge}
            </label>`;
            frag.appendChild(row);
            total++;
        });
        listEl.appendChild(frag);
        if (countEl) countEl.textContent = `(${total})`;
        bulkApplyFetchedFireDays(items);
    };
    const onDone = () => {
        if (badgeEl) badgeEl.remove();
        if (countEl) countEl.textContent = `(${total})`;
    };

    document.getElementById('dy-fire-user-select-close').addEventListener('click', () => panel.remove());
    document.getElementById('dy-fire-select-all').addEventListener('click', () => panel.querySelectorAll('.user-checkbox').forEach(cb => cb.checked = true));
    document.getElementById('dy-fire-deselect-all').addEventListener('click', () => panel.querySelectorAll('.user-checkbox').forEach(cb => cb.checked = false));
    document.getElementById('dy-fire-user-select-cancel').addEventListener('click', () => panel.remove());
    document.getElementById('dy-fire-user-select-add').addEventListener('click', () => {
        const selected = [];
        panel.querySelectorAll('.user-checkbox').forEach(cb => { if (cb.checked) selected.push(cb.value); });
        userConfig.targetUsernames = selected.join('\n');
        saveConfig();
        parseTargetUsers();
        updateUserStatusDisplay();
        addHistoryLog(selected.length > 0 ? `已更新 ${selected.length} 个目标用户` : '已清空目标用户列表',
            selected.length > 0 ? LEVEL.SUCCESS : LEVEL.INFO, { cat: CAT.UI });
        panel.remove();
    });

    autoScrollChatListAndCollect(panel, appendRows, onDone);
}

/* =========================================================
 * 火花天数管理面板
 * ========================================================= */
function showFireDaysPanel() {
    const existing = document.getElementById('dy-fire-days-panel');
    if (existing) { existing.remove(); return; }

    const panel = document.createElement('div');
    panel.id = 'dy-fire-days-panel';
    panel.className = 'dyfire-modal dyfire-modal-wide';
    panel.innerHTML = `
        <div id="dy-fire-days-header" class="dyfire-modal-header">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <h3 style="margin:0;color:#fff;font-size:18px;font-weight:600;">
                    📅 火花天数管理
                    <span id="dy-fire-days-count" style="color:#00d8b8;font-size:14px;margin-left:8px;"></span>
                </h3>
                <button id="dy-fire-days-close" class="dyfire-close-btn">×</button>
            </div>
        </div>

        <div class="dyfire-filter-bar">
            <input id="dy-fire-days-search" type="text" placeholder="🔍 搜索昵称" class="dyfire-input" style="flex:1;min-width:120px;">
            <button id="dy-fire-days-scan" class="dyfire-btn dyfire-btn-info">🔄 扫描好友列表</button>
            <button id="dy-fire-days-clear" class="dyfire-btn dyfire-btn-danger">🗑️ 清空全部</button>
        </div>

        <div id="dy-fire-days-info" class="dyfire-log-info"></div>

        <div id="dy-fire-days-body" class="dyfire-log-body"></div>

        <div class="dyfire-modal-footer" style="background:rgba(0,216,184,.05);border-top:1px solid rgba(0,216,184,.15);">
            <div style="display:flex;align-items:flex-start;gap:10px;">
                <span style="font-size:16px;line-height:1;">🔥</span>
                <div style="flex:1;">
                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;color:#fff;font-weight:600;font-size:13px;">
                        <input type="checkbox" id="dy-fire-days-auto-fetch" style="cursor:pointer;">
                        <span>自动从页面获取火花天数</span>
                    </label>
                    <div style="font-size:11px;color:#8a8a8a;line-height:1.6;margin-top:6px;padding-left:22px;">
                        <b style="color:#00d8b8;">☑ 开启（推荐）</b>：扫描好友列表或发送消息时，自动从抖音页面读取真实火花天数并覆盖本地记录。<br>
                        <b style="color:#ffc107;">☐ 关闭</b>：不再从页面自动获取。改为每天首次发送成功时 <code style="background:#222;padding:1px 4px;border-radius:3px;">天数 + 1</code>，同一天重复发送不会重复增加。
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(panel);
    addDragFunctionality(panel, 'dy-fire-days-header');

    const autoFetchEl = document.getElementById('dy-fire-days-auto-fetch');
    autoFetchEl.checked = !!userConfig.autoFetchFireDays;
    autoFetchEl.addEventListener('change', () => {
        userConfig.autoFetchFireDays = autoFetchEl.checked;
        saveConfig();
        addHistoryLog(`自动获取火花天数已${autoFetchEl.checked ? '开启' : '关闭'}`, LEVEL.INFO, { cat: CAT.UI });
        render();
    });

    const searchEl = document.getElementById('dy-fire-days-search');

    const render = () => {
        const entries = getAllFireEntries();
        const keyword = (searchEl.value || '').trim();
        const filtered = Object.keys(entries)
            .filter(k => !keyword || k.includes(keyword))
            .sort((a, b) => (entries[b].days || 0) - (entries[a].days || 0));

        document.getElementById('dy-fire-days-count').textContent = `(共 ${Object.keys(entries).length} 人)`;
        document.getElementById('dy-fire-days-info').textContent =
            `显示 ${filtered.length} 人` + (keyword ? `，搜索 "${keyword}"` : '') +
            ` | 自动获取: ${userConfig.autoFetchFireDays ? '开' : '关'}`;

        const body = document.getElementById('dy-fire-days-body');
        body.innerHTML = '';
        if (filtered.length === 0) {
            body.innerHTML = `<div style="text-align:center;color:#666;padding:60px 20px;">
                <div style="font-size:48px;margin-bottom:20px;">📅</div>
                <div style="font-size:16px;color:#999;">暂无火花天数记录</div>
                <div style="font-size:12px;color:#666;margin-top:8px;">点击上方「扫描好友列表」自动采集</div>
            </div>`;
            return;
        }
        const frag = document.createDocumentFragment();
        filtered.forEach(nickname => {
            const entry = entries[nickname];
            const row = document.createElement('div');
            row.className = 'dyfire-user-row';
            row.style.cssText = 'display:flex;align-items:center;gap:10px;';
            const lastDateText = entry.lastDate ? `最近: ${entry.lastDate}` : '未记录更新日期';
            row.innerHTML = `
                <div style="flex:1;min-width:0;">
                    <div style="color:#fff;font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(nickname)}</div>
                    <div style="color:#999;font-size:11px;margin-top:2px;">${lastDateText}</div>
                </div>
                <div style="color:#ff9500;font-weight:700;font-size:15px;white-space:nowrap;">🔥 ${entry.days}</div>
                <button class="dyfire-btn dyfire-days-edit" data-name="${escapeHtml(nickname)}" data-days="${entry.days}" style="padding:5px 10px;font-size:12px;">修改</button>
            `;
            frag.appendChild(row);
        });
        body.appendChild(frag);

        body.querySelectorAll('.dyfire-days-edit').forEach(btn => {
            btn.addEventListener('click', () => {
                const name = btn.dataset.name;
                const cur = parseInt(btn.dataset.days, 10) || 0;
                const v = prompt(`修改 "${name}" 的火花天数：`, cur);
                if (v === null) return;
                const n = parseInt(v, 10);
                if (!isNaN(n) && n >= 0) {
                    setUserFireEntry(name, n, getLocalTodayString());
                    addHistoryLog(`[${name}] 火花天数修改为 ${n}`, LEVEL.SUCCESS, { cat: CAT.UI, user: name });
                    render();
                }
            });
        });
    };

    searchEl.addEventListener('input', render);

    document.getElementById('dy-fire-days-close').addEventListener('click', () => panel.remove());
    document.getElementById('dy-fire-days-clear').addEventListener('click', () => {
        if (!confirm('确定清空所有火花天数记录？此操作不可恢复。')) return;
        GM_setValue('userFireDays', {});
        addHistoryLog('已清空所有火花天数记录', LEVEL.SUCCESS, { cat: CAT.UI });
        render();
    });

    document.getElementById('dy-fire-days-scan').addEventListener('click', () => {
        addHistoryLog('开始扫描好友列表并采集火花天数...', LEVEL.INFO, { cat: CAT.STATE });

        const scanBadge = document.createElement('div');
        scanBadge.textContent = '⏳ 扫描中...';
        scanBadge.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,.85);color:#fff;padding:16px 24px;border-radius:12px;font-size:14px;z-index:10001;';
        panel.appendChild(scanBadge);

        let scanned = 0;
        let synced = 0;

        autoScrollChatListAndCollect(panel,
            (items) => {
                scanned += items.length;
                bulkApplyFetchedFireDays(items);
                synced += items.filter(x => x.days > 0).length;
            },
            () => {
                scanBadge.remove();
                addHistoryLog(
                    `扫描完成：共 ${scanned} 个会话，其中 ${synced} 个有火花天数` +
                    (userConfig.autoFetchFireDays ? '（已写入）' : '（自动获取已关闭，仅建档）'),
                    LEVEL.SUCCESS,
                    { cat: CAT.STATE }
                );
                render();
            }
        );
    });

    render();
}

/* =========================================================
 * 历史日志面板
 * ========================================================= */
let _logPanelState = { level: 'all', cat: 'all', user: 'all', day: '', keyword: '', limit: 100 };

function showLogPanel(initialFilter) {
    const existing = document.getElementById('dy-fire-log-panel');
    if (existing) existing.remove();

    if (initialFilter) Object.assign(_logPanelState, initialFilter);
    if (!_logPanelState.day) _logPanelState.day = getLocalTodayString();

    const days = listLogDays();
    const panel = document.createElement('div');
    panel.id = 'dy-fire-log-panel';
    panel.className = 'dyfire-modal dyfire-modal-wide';
    panel.innerHTML = `
        <div id="dy-fire-log-header" class="dyfire-modal-header">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <h3 style="margin:0;color:#fff;font-size:18px;font-weight:600;">📋 历史日志</h3>
                <button id="dy-fire-log-close" class="dyfire-close-btn">×</button>
            </div>
        </div>
        <div class="dyfire-filter-bar">
            <label>级别
                <select id="dy-fire-log-filter-level">
                    <option value="all">全部</option>
                    <option value="info">info</option>
                    <option value="success">success</option>
                    <option value="warn">warn</option>
                    <option value="error">error</option>
                </select>
            </label>
            <label>分类
                <select id="dy-fire-log-filter-cat">
                    <option value="all">全部</option>
                    <option value="send">发送</option>
                    <option value="api">API</option>
                    <option value="ui">UI</option>
                    <option value="state">状态</option>
                    <option value="system">系统</option>
                </select>
            </label>
            <label>日期
                <select id="dy-fire-log-filter-day">
                    ${days.map(d => `<option value="${d}">${d}</option>`).join('')}
                </select>
            </label>
            <label>条数
                <select id="dy-fire-log-filter-limit">
                    <option value="50">50</option>
                    <option value="100">100</option>
                    <option value="200">200</option>
                    <option value="500">500</option>
                    <option value="0">全部</option>
                </select>
            </label>
            <input id="dy-fire-log-filter-kw" type="text" placeholder="搜索关键词" class="dyfire-input">
            <button id="dy-fire-log-load-more" class="dyfire-btn">加载更多</button>
        </div>
        <div id="dy-fire-log-info" class="dyfire-log-info"></div>
        <div id="dy-fire-log-body" class="dyfire-log-body"></div>
        <div class="dyfire-modal-footer">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
                <button id="dy-fire-log-export-cur" class="dyfire-btn dyfire-btn-primary">导出当前筛选</button>
                <button id="dy-fire-log-export-all" class="dyfire-btn dyfire-btn-primary">导出全部</button>
                <button id="dy-fire-log-clear" class="dyfire-btn dyfire-btn-danger">清空当前日期</button>
            </div>
        </div>
    `;
    document.body.appendChild(panel);
    addDragFunctionality(panel, 'dy-fire-log-header');

    document.getElementById('dy-fire-log-filter-level').value = _logPanelState.level;
    document.getElementById('dy-fire-log-filter-cat').value = _logPanelState.cat;
    document.getElementById('dy-fire-log-filter-day').value = _logPanelState.day;
    document.getElementById('dy-fire-log-filter-limit').value = String(_logPanelState.limit);

    const render = () => {
        const all = readLogs(_logPanelState.day);
        const users = Array.from(new Set(all.map(l => l.user).filter(Boolean))).sort();

        const filtered = all.filter(l => {
            if (_logPanelState.level !== 'all' && l.level !== _logPanelState.level) return false;
            if (_logPanelState.cat !== 'all' && l.cat !== _logPanelState.cat) return false;
            if (_logPanelState.user !== 'all' && l.user !== _logPanelState.user) return false;
            if (_logPanelState.keyword && !l.msg.includes(_logPanelState.keyword)) return false;
            return true;
        });
        filtered.sort((a, b) => b.ts - a.ts);

        const limit = _logPanelState.limit || filtered.length;
        const slice = filtered.slice(0, limit);

        const info = document.getElementById('dy-fire-log-info');
        info.textContent = `共 ${filtered.length} 条，显示 ${slice.length} 条` + (users.length ? ` | 用户: ${users.join(', ')}` : '');

        const body = document.getElementById('dy-fire-log-body');
        body.innerHTML = '';
        if (slice.length === 0) {
            body.innerHTML = `<div style="text-align:center;color:#666;padding:60px 20px;">
                <div style="font-size:48px;margin-bottom:20px;">📝</div>
                <div style="font-size:16px;color:#999;">无匹配日志</div>
            </div>`;
            return;
        }
        const frag = document.createDocumentFragment();
        slice.forEach(l => {
            const row = document.createElement('div');
            row.className = 'dyfire-log-row';
            const t = new Date(l.ts).toLocaleString('zh-CN', { hour12: false });
            const color = _levelColor(l.level);
            row.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <span style="font-size:11px;color:#999;">${t}</span>
                    <span style="font-size:10px;color:${color};padding:2px 6px;border-radius:10px;background:${color}22;border:1px solid ${color}55;">${l.level.toUpperCase()} · ${_catLabel(l.cat)}</span>
                </div>
                <div style="font-size:13px;color:#fff;line-height:1.4;word-break:break-all;">
                    ${l.user ? `<span style="color:#8fbdff;">[${escapeHtml(l.user)}]</span> ` : ''}${escapeHtml(l.msg)}
                </div>
                ${l.ctx ? `<details style="margin-top:6px;"><summary style="font-size:11px;color:#8fbdff;cursor:pointer;">上下文</summary><pre style="font-size:11px;color:#bbb;margin:6px 0 0 0;padding:6px;background:#000;border-radius:4px;overflow:auto;max-height:120px;">${escapeHtml(JSON.stringify(l.ctx, null, 2))}</pre></details>` : ''}
            `;
            frag.appendChild(row);
        });
        body.appendChild(frag);
    };

    const bindChange = (id, key, transform = v => v) => {
        document.getElementById(id).addEventListener('change', e => {
            _logPanelState[key] = transform(e.target.value);
            render();
        });
    };
    bindChange('dy-fire-log-filter-level', 'level');
    bindChange('dy-fire-log-filter-cat', 'cat');
    bindChange('dy-fire-log-filter-day', 'day');
    bindChange('dy-fire-log-filter-limit', 'limit', v => parseInt(v, 10) || 0);

    let kwTimer = null;
    document.getElementById('dy-fire-log-filter-kw').addEventListener('input', e => {
        clearTimeout(kwTimer);
        kwTimer = setTimeout(() => { _logPanelState.keyword = e.target.value.trim(); render(); }, 300);
    });

    document.getElementById('dy-fire-log-load-more').addEventListener('click', () => {
        const cur = _logPanelState.limit || 100;
        _logPanelState.limit = cur + 100;
        document.getElementById('dy-fire-log-filter-limit').value = String(_logPanelState.limit);
        render();
    });

    document.getElementById('dy-fire-log-close').addEventListener('click', () => panel.remove());
    document.getElementById('dy-fire-log-export-cur').addEventListener('click', () => exportLogs(true));
    document.getElementById('dy-fire-log-export-all').addEventListener('click', () => exportLogs(false));
    document.getElementById('dy-fire-log-clear').addEventListener('click', () => {
        if (confirm(`确定清空 ${_logPanelState.day} 的日志？`)) { clearLogs(_logPanelState.day); render(); }
    });

    render();
}

function exportLogs(onlyFiltered) {
    const all = readLogs(_logPanelState.day);
    let logs = all;
    if (onlyFiltered) {
        logs = all.filter(l => {
            if (_logPanelState.level !== 'all' && l.level !== _logPanelState.level) return false;
            if (_logPanelState.cat !== 'all' && l.cat !== _logPanelState.cat) return false;
            if (_logPanelState.user !== 'all' && l.user !== _logPanelState.user) return false;
            if (_logPanelState.keyword && !l.msg.includes(_logPanelState.keyword)) return false;
            return true;
        });
    }
    logs = logs.slice().sort((a, b) => a.ts - b.ts);

    const txt = logs.map(l =>
        `${new Date(l.ts).toLocaleString()} [${l.level.toUpperCase()}][${_catLabel(l.cat)}]${l.user ? '[' + l.user + ']' : ''} ${l.msg}`
    ).join('\n');
    const blob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `抖音续火日志_${_logPanelState.day}${onlyFiltered ? '_筛选' : ''}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const jsonBlob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const a2 = document.createElement('a');
    a2.href = jsonUrl;
    a2.download = `抖音续火日志_${_logPanelState.day}${onlyFiltered ? '_筛选' : ''}.json`;
    document.body.appendChild(a2); a2.click(); document.body.removeChild(a2);
    URL.revokeObjectURL(jsonUrl);

    addHistoryLog(`已导出 ${logs.length} 条日志`, LEVEL.SUCCESS, { cat: CAT.UI });
}

/* =========================================================
 * 帮助面板（含搜索 + 高亮定位 + 调度器分节）
 * ========================================================= */
function _helpSearchAll(keyword) {
    const kw = (keyword || '').trim().toLowerCase();
    if (!kw) return [];
    const results = [];
    HELP_TABS.forEach(tab => {
        const tmp = document.createElement('div');
        tmp.innerHTML = tab.html;
        const text = tmp.textContent || '';
        const lc = text.toLowerCase();
        let idx = lc.indexOf(kw);
        while (idx !== -1) {
            const start = Math.max(0, idx - 40);
            const end = Math.min(text.length, idx + kw.length + 60);
            const snippet = (start > 0 ? '…' : '') + text.slice(start, end).replace(/\s+/g, ' ').trim() + (end < text.length ? '…' : '');
            results.push({
                tabId: tab.id,
                tabLabel: tab.label,
                snippet
            });
            if (results.length > 80) break;
            idx = lc.indexOf(kw, idx + kw.length);
        }
    });
    return results;
}

/**
 * 在指定根节点内高亮关键词（不改动 DOM 结构，仅包裹文本节点）
 * - 用 TreeWalker 遍历文本节点，跳过 script/style/textarea/mark
 * - 高亮 3 秒后自动还原
 * - 自动滚动到第一个匹配位置
 * 返回匹配数量
 */
function _highlightKeyword(root, keyword, durationMs = 3000) {
    if (!root || !keyword) return 0;
    const kw = String(keyword).trim();
    if (!kw) return 0;
    const lowerKw = kw.toLowerCase();

    const textNodes = [];
    const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode(node) {
                const parent = node.parentNode;
                if (!parent) return NodeFilter.FILTER_REJECT;
                const tag = parent.tagName;
                if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'MARK') {
                    return NodeFilter.FILTER_REJECT;
                }
                if (parent.classList && parent.classList.contains('dyfire-help-highlight')) {
                    return NodeFilter.FILTER_REJECT;
                }
                const text = node.nodeValue || '';
                if (!text) return NodeFilter.FILTER_REJECT;
                if (text.toLowerCase().indexOf(lowerKw) === -1) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );
    let n;
    while ((n = walker.nextNode())) textNodes.push(n);

    if (textNodes.length === 0) return 0;

    const marks = [];
    textNodes.forEach(node => {
        const text = node.nodeValue || '';
        const lowerText = text.toLowerCase();
        const frag = document.createDocumentFragment();
        let lastIdx = 0;
        let idx = lowerText.indexOf(lowerKw);
        if (idx === -1) return;
        while (idx !== -1) {
            if (idx > lastIdx) frag.appendChild(document.createTextNode(text.slice(lastIdx, idx)));
            const mark = document.createElement('mark');
            mark.className = 'dyfire-help-highlight';
            mark.style.cssText = [
                'background:#ffc107',
                'color:#000',
                'padding:1px 3px',
                'border-radius:3px',
                'box-shadow:0 0 0 2px rgba(255,193,7,.35)',
                'transition:background .4s,box-shadow .4s'
            ].join(';');
            mark.textContent = text.slice(idx, idx + kw.length);
            frag.appendChild(mark);
            marks.push(mark);
            lastIdx = idx + kw.length;
            idx = lowerText.indexOf(lowerKw, lastIdx);
        }
        if (lastIdx < text.length) frag.appendChild(document.createTextNode(text.slice(lastIdx)));
        try { node.parentNode.replaceChild(frag, node); } catch (e) { /* ignore */ }
    });

    if (marks.length === 0) return 0;

    setTimeout(() => {
        try {
            marks[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (e) { /* ignore */ }
    }, 60);

    setTimeout(() => {
        marks.forEach(mark => {
            if (mark.parentNode) {
                const tn = document.createTextNode(mark.textContent);
                try { mark.parentNode.replaceChild(tn, mark); } catch (e) { /* ignore */ }
            }
        });
    }, durationMs);

    return marks.length;
}

let HELP_TABS = [
    {
        id: 'quickstart',
        label: '🚀 快速开始',
        html: `
            <div class="dyfire-section">
                <h4>🕐 一分钟跑通脚本</h4>
                <div style="color:#ddd;font-size:13px;line-height:2;">
                    <b style="color:#00d8b8;">步骤 1.</b> 在浏览器中打开 <code style="background:#222;padding:2px 6px;border-radius:4px;">https://www.douyin.com/chat</code>，等待 2~3 秒，页面右上角会出现深色控制面板。<br>
                    <b style="color:#00d8b8;">步骤 2.</b> 点击面板上的「<b>👥 用户选择</b>」按钮，脚本会自动滚动解析左侧的好友列表，弹出用户选择窗口。<br>
                    <b style="color:#00d8b8;">步骤 3.</b> 勾选你要续火花的好友（支持全选），点击「<b>✅ 更新目标用户</b>」保存。<br>
                    <b style="color:#00d8b8;">步骤 4.</b> 点击「<b>⚙️ 偏好设置</b>」，在「基本设置」里调整发送时间（默认 00:01:00），在「消息设置」里编辑消息模板。<br>
                    <b style="color:#00d8b8;">步骤 5.</b> 到点后脚本会自动依次给每个好友发送消息。也可以随时点击「<b>🚀 立即发送</b>」手动触发。<br>
                </div>
            </div>

            <div class="dyfire-section">
                <h4>🎯 最小可用配置</h4>
                <div style="color:#ddd;font-size:13px;line-height:2;">
                    如果你不想折腾，只需要做三件事：<br>
                    ① 在「👥 用户选择」里选好友<br>
                    ② 在「⚙️ 偏好设置 → 💬 消息设置」里改一下要发的内容<br>
                    ③ 什么都不动，保持页面开着即可<br>
                    <br>
                    默认配置已经能跑通：<br>
                    · 每天 00:01:00 自动发送<br>
                    · 附带一言 API 随机句子<br>
                    · 附带专属一言（按星期切换）<br>
                    · 自动记录每个好友的火花天数
                </div>
            </div>

            <div class="dyfire-section">
                <h4>⚠️ 挂机注意事项</h4>
                <div style="color:#ddd;font-size:13px;line-height:1.9;">
                    <b style="color:#ffc107;">保持页面活跃：</b>浏览器后台休眠会中断脚本。请在 <code style="background:#222;padding:2px 6px;border-radius:4px;">chrome://settings/performance</code> 里把 <code>www.douyin.com</code> 加入"始终活跃"白名单。<br>
                    <b style="color:#ffc107;">别关标签页：</b>关掉 Chat 页面脚本就会停止工作。<br>
                    <b style="color:#ffc107;">别开多标签：</b>同一账号开多个 Chat 页面会导致重复发送。<br>
                </div>
            </div>
        `
    },
    {
        id: 'features',
        label: '✨ 功能详解',
        html: `
            <div class="dyfire-section">
                <h4>🔥 火花天数记录</h4>
                <div style="color:#ddd;font-size:13px;line-height:1.9;">
                    每个好友独立记录火花天数，与抖音页面上的数字保持一致。<br><br>
                    <b style="color:#00d8b8;">📥 获取方式有两种：</b><br>
                    · <b>自动获取（默认开启）</b>：扫描好友列表或发送消息时，脚本会读取抖音页面上的真实火花天数并写入本地。<br>
                    · <b>手动递增（关闭自动获取时）</b>：每天首次发送成功时 <code>天数 + 1</code>，同一天重复发送不会重复加。<br><br>
                    <b style="color:#00d8b8;">🔧 在哪里管理：</b> 点击面板上的「<b>📅 天数管理</b>」按钮查看所有好友的天数，支持搜索、手动修改、批量清空、一键扫描刷新。<br><br>
                    <b style="color:#00d8b8;">💬 怎么用：</b> 在消息模板里写 <code style="background:#222;padding:2px 6px;border-radius:4px;">[天数]</code>，发送时会自动替换为该好友的实际天数。
                </div>
            </div>

            <div class="dyfire-section">
                <h4>👥 多用户批量发送</h4>
                <div style="color:#ddd;font-size:13px;line-height:1.9;">
                    支持一次给多个好友发送续火消息。<br><br>
                    <b style="color:#00d8b8;">发送模式：</b><br>
                    · <b>顺序模式（默认）</b>：按用户列表顺序依次发送，一个完成再发下一个。<br>
                    · <b>随机模式</b>：每次随机挑一个未发送的用户。<br><br>
                    <b style="color:#00d8b8;">失败处理：</b><br>
                    · 某个用户连续失败达到「最大重试次数」后，自动标记为失败并切换到下一个用户。<br>
                    · 所有用户都处理完毕（成功或失败）后，才会通知后端调度器。<br>
                </div>
            </div>

            <div class="dyfire-section">
                <h4>🎲 随机发送时间</h4>
                <div style="color:#ddd;font-size:13px;line-height:1.9;">
                    在「偏好设置 → 基本设置」里可以开启随机发送时间，让每天的发送时间不固定，避免过于规律。<br><br>
                    <b style="color:#00d8b8;">示例：</b> 开始时间 <code>23:30:00</code>，结束时间 <code>00:30:00</code><br>
                    → 每天会在 23:30 ~ 次日 00:30 之间随机挑一个时间点发送。<br><br>
                    <b style="color:#ffc107;">注意：</b> 结束时间可以比开始时间小（表示跨天）。
                </div>
            </div>

            <div class="dyfire-section">
                <h4>💬 消息模板与占位符</h4>
                <div style="color:#ddd;font-size:13px;line-height:1.9;">
                    在「偏好设置 → 消息设置 → 自定义消息模板」里编辑要发送的内容，支持以下占位符：<br><br>
                    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:8px;">
                        <tr style="background:rgba(0,216,184,.1);">
                            <th style="text-align:left;padding:6px 10px;color:#00d8b8;">占位符</th>
                            <th style="text-align:left;padding:6px 10px;color:#00d8b8;">说明</th>
                        </tr>
                        <tr><td style="padding:6px 10px;color:#8fbdff;">[天数]</td><td style="padding:6px 10px;">替换为该好友的火花天数</td></tr>
                        <tr><td style="padding:6px 10px;color:#8fbdff;">[API]</td><td style="padding:6px 10px;">替换为一言 API 获取的随机句子</td></tr>
                        <tr><td style="padding:6px 10px;color:#8fbdff;">[TXTAPI]</td><td style="padding:6px 10px;">替换为 TXTAPI 内容（API 或手动文本）</td></tr>
                        <tr><td style="padding:6px 10px;color:#8fbdff;">[专属一言]</td><td style="padding:6px 10px;">替换为当天星期对应的专属文案</td></tr>
                    </table>
                    <br>
                    <b style="color:#00d8b8;">模板示例：</b><br>
                    <pre style="background:#1a1a1a;padding:10px;border-radius:6px;color:#ffc107;font-size:12px;margin-top:6px;white-space:pre-wrap;">🔥 火花已续 [天数] 天

—— 每日一言 ——
[API]

—— 专属问候 ——
[专属一言]</pre>
                </div>
            </div>

            <div class="dyfire-section">
                <h4>📚 一言 API / TXTAPI / 专属一言</h4>
                <div style="color:#ddd;font-size:13px;line-height:1.9;">
                    <b style="color:#00d8b8;">📚 一言 API：</b><br>
                    从 <code>https://v1.hitokoto.cn/</code> 获取一句随机的优美句子。<br>
                    支持自定义格式，可用变量：<code>{hitokoto}</code>（句子）、<code>{from}</code>（出处）、<code>{from_who}</code>（作者）。<br><br>

                    <b style="color:#00d8b8;">📄 TXTAPI：</b><br>
                    两种模式：<br>
                    · <b>API 模式</b>：从一个 URL 获取纯文本（默认使用一言的纯文本接口）<br>
                    · <b>手动模式</b>：自己写几行文本，每行一条，发送时随机或顺序挑一条<br><br>

                    <b style="color:#00d8b8;">🌟 专属一言：</b><br>
                    按周一 ~ 周日分别配置专属文案，每天发送时自动使用当天对应的文案。<br>
                    支持两种发送模式：<br>
                    · <b>随机模式</b>：随机挑一条（发过的不会再发，直到当天全部用完）<br>
                    · <b>顺序模式</b>：按你写的顺序依次发送
                </div>
            </div>

            <div class="dyfire-section">
                <h4>🔄 智能重试 & 冷却期</h4>
                <div style="color:#ddd;font-size:13px;line-height:1.9;">
                    发送失败会自动重试，默认最多 3 次。<br><br>
                    <b style="color:#00d8b8;">重试策略：</b><br>
                    · 每次重试间隔 5 秒<br>
                    · 达到最大重试次数后，可选择"继续等待 N 分钟后重试"（在设置里开启）<br>
                    · 也可以手动点击「🔄 重置重试」立即清零计数并重新触发<br><br>
                    <b style="color:#00d8b8;">冷却期：</b><br>
                    · 两次发送之间至少间隔 3 秒，避免被风控<br>
                    · 每次重试之间至少间隔 5 秒
                </div>
            </div>

            <div class="dyfire-section">
                <h4>⏸️ 暂停 / 恢复</h4>
                <div style="color:#ddd;font-size:13px;line-height:1.9;">
                    点击「⏸️ 暂停」按钮后，脚本会停止自动检测和发送。<br>
                    暂停状态会保存到浏览器存储，刷新页面后依然有效。<br>
                    再次点击「▶️ 继续」即可恢复正常运行。<br><br>
                    <b style="color:#ffc107;">注意：</b>暂停后正在进行的发送任务会被中断。
                </div>
            </div>
        `
    },
    {
        id: 'scheduler',
        label: '⚡ 调度器',
        html: `
            <div class="dyfire-section">
                <h4>🤖 什么是「配套工具 / 调度器」？</h4>
                <div style="color:#ddd;font-size:13px;line-height:1.9;">
                    本脚本本身只能处理 <b>单个抖音账号</b>。<br>
                    如果你需要同时给多个抖音账号续火花，就需要配合本项目提供的 <b>「配套工具」</b>：<br><br>
                    · <b>后端调度器</b>：跨平台命令行工具，按顺序启动每个账号的浏览器，跑完一个再跑下一个。<br>
                    · <b>综合管理器（Windows GUI）</b>：图形化配置工具，一键启动/停止调度器，管理多个账号的浏览器 Profile。<br>
                    · <b>Python 回调服务器</b>：监听本地端口，接收脚本"任务完成"的通知，让调度器知道该切换下一个账号了。<br><br>
                    <b style="color:#00d8b8;">单账号用户不需要用它</b>，直接使用脚本本身的定时发送即可。
                </div>
            </div>

            <div class="dyfire-section">
                <h4>📥 从哪里下载配套工具？</h4>
                <div style="color:#ddd;font-size:13px;line-height:1.9;">
                    配套工具 <b style="color:#ffc107;">不单独发布到 Releases</b>，直接放在 GitHub 仓库根目录：<br>
                    <code style="background:#222;padding:3px 8px;border-radius:4px;color:#8fbdff;display:inline-block;margin:8px 0;word-break:break-all;">ScriptCat-Douyin-Fire-Helper / 配套工具.zip</code>
                    <br><br>
                    <div style="display:flex;flex-direction:column;gap:10px;margin:12px 0;">
                        <a href="${TOOLS_ZIP_GITHUB}"
                           target="_blank" rel="noopener noreferrer"
                           style="display:block;padding:12px 20px;background:linear-gradient(135deg,#00d8b8,#00b8a8);color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px;text-align:center;box-shadow:0 4px 12px rgba(0,216,184,.3);">
                            🔗 GitHub 直链下载（raw）
                        </a>
                        <a href="${TOOLS_ZIP_PROXY}"
                           target="_blank" rel="noopener noreferrer"
                           style="display:block;padding:12px 20px;background:linear-gradient(135deg,#ff9500,#ffcc00);color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px;text-align:center;box-shadow:0 4px 12px rgba(255,149,0,.3);">
                            🚀 国内加速下载（gh-proxy）
                        </a>
                    </div>
                    <b style="color:#ffc107;">⚠️ 下载后请解压到本地任意目录</b>（建议路径不含中文和空格，例如 <code>D:\\DouyinFire\\</code>）。
                </div>
            </div>

            <div class="dyfire-section">
                <h4>🧩 配套工具目录结构</h4>
                <div style="color:#ddd;font-size:13px;line-height:1.9;">
                    <pre style="background:#1a1a1a;padding:10px;border-radius:6px;color:#8fbdff;font-size:12px;margin-top:6px;white-space:pre;overflow:auto;">配套工具/
├── shell/                          # 调度器核心
│   ├── callback_server.py          # Python 回调服务器
│   ├── scheduler.ps1               # Windows 调度器
│   ├── scheduler.sh                # Linux/macOS 调度器
│   ├── config.json                 # ★ 核心配置
│   └── logs/                       # 调度器日志
├── profiles/                       # 各账号浏览器 Profile（自动生成）
├── manager_history.log             # 管理器操作日志（自动生成）
└── 抖音续火综合管理器.pyw          # Windows GUI 管理器</pre>
                </div>
            </div>

            <div class="dyfire-section">
                <h4>🚀 使用步骤（简述）</h4>
                <div style="color:#ddd;font-size:13px;line-height:2;">
                    <b style="color:#00d8b8;">① 环境准备</b><br>
                    · 安装 Python 3（Windows 记得勾选 "Add to PATH"）<br>
                    · Linux/macOS 还需安装 <code>jq</code><br><br>

                    <b style="color:#00d8b8;">② 创建账号 Profile</b><br>
                    · 每个抖音账号一个独立的浏览器 Profile 文件夹<br>
                    · 用对应 Profile 打开浏览器 → 登录抖音 → 关闭浏览器<br>
                    · 用综合管理器（Windows）或手动命令行启动都可以<br><br>

                    <b style="color:#00d8b8;">③ 编辑 config.json</b><br>
                    · 配置账号列表、调度端口（默认 7788）、浏览器类型、目标 URL<br>
                    · 每个账号指定唯一的 <code>profile</code> 名，对应 <code>profiles/</code> 下的子目录<br><br>

                    <b style="color:#00d8b8;">④ 脚本端开启回调</b><br>
                    · 打开本脚本的「⚙️ 偏好设置 → 后端调度器回调（高级）」<br>
                    · 勾选"启用"并确认端口一致（默认 7788）<br>
                    · 每个 Profile 里设置一次即可<br><br>

                    <b style="color:#00d8b8;">⑤ 启动调度器</b><br>
                    · Windows：双击综合管理器 → 点「启动调度器」<br>
                    · Linux/macOS：进入 shell 目录 → <code>./scheduler.sh</code><br>
                    · 调度器会自动依次启动每个账号的浏览器，跑完一个切换下一个<br>
                </div>
            </div>

            <div class="dyfire-section">
                <h4>❓ 常见问题</h4>
                <div style="color:#ddd;font-size:13px;line-height:1.9;">
                    <b>Q：为什么调度器跑完一个账号不切换下一个？</b><br>
                    检查脚本里"后端调度器回调"是否已启用，端口是否与 config.json 一致。<br><br>

                    <b>Q：端口 7788 被占用？</b><br>
                    Windows：<code>netstat -ano | findstr :7788</code> → <code>taskkill /PID xxx /F</code><br>
                    Linux/macOS：<code>lsof -i :7788</code> → <code>kill -9 xxx</code><br>
                    或者修改 config.json 和脚本设置里的端口为其他值。<br><br>

                    <b>Q：浏览器打开显示未登录？</b><br>
                    确认 <code>profiles/</code> 下对应账号目录确实保存了登录状态，且 config.json 里 <code>profile</code> 字段与目录名完全一致。<br><br>

                    <b>Q：更多问题？</b><br>
                    访问 GitHub Issues 提交，或查看 README 中的完整调度器教程。
                </div>
            </div>
        `
    },
    {
        id: 'buttons',
        label: '🎛️ 按钮说明',
        html: `
            <div class="dyfire-section">
                <h4>主面板 · 第一行（主要操作）</h4>
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <tr style="background:rgba(0,216,184,.1);">
                        <th style="text-align:left;padding:8px 10px;color:#00d8b8;width:150px;">按钮</th>
                        <th style="text-align:left;padding:8px 10px;color:#00d8b8;">作用</th>
                    </tr>
                    <tr>
                        <td style="padding:8px 10px;color:#ff2c54;font-weight:600;">🚀 立即发送</td>
                        <td style="padding:8px 10px;color:#ddd;">跳过等待，立即开始发送流程。会依次给所有未发送的好友发送续火消息。</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 10px;color:#ff9500;font-weight:600;">⏸️ 暂停</td>
                        <td style="padding:8px 10px;color:#ddd;">暂停所有自动发送。点击后按钮会变成「▶️ 继续」，再次点击可恢复。</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 10px;color:#8e44ad;font-weight:600;">🔄 重置记录</td>
                        <td style="padding:8px 10px;color:#ddd;">清空"今日已发送"记录，让所有好友重新变成待发送状态。</td>
                    </tr>
                </table>
            </div>

            <div class="dyfire-section">
                <h4>主面板 · 第二行（功能入口）</h4>
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <tr style="background:rgba(0,216,184,.1);">
                        <th style="text-align:left;padding:8px 10px;color:#00d8b8;width:150px;">按钮</th>
                        <th style="text-align:left;padding:8px 10px;color:#00d8b8;">作用</th>
                    </tr>
                    <tr><td style="padding:8px 10px;color:#fff;">⚙️ 偏好设置</td><td style="padding:8px 10px;color:#ddd;">打开设置面板，配置发送时间、消息模板、API、用户列表、日志等。</td></tr>
                    <tr><td style="padding:8px 10px;color:#fff;">👁️ 消息预览</td><td style="padding:8px 10px;color:#ddd;">调用 API 生成一条完整消息并展示出来，<b style="color:#00d8b8;">但不会真的发送</b>。用来调试模板很方便。</td></tr>
                    <tr><td style="padding:8px 10px;color:#fff;">📋 历史日志</td><td style="padding:8px 10px;color:#ddd;">查看历史发送记录。支持按级别、分类、日期、关键词筛选。可以导出为 txt 或 json。</td></tr>
                    <tr><td style="padding:8px 10px;color:#fff;">📅 天数管理</td><td style="padding:8px 10px;color:#ddd;">查看和管理所有好友的火花天数。可以一键扫描好友列表刷新、单个修改、批量清空。</td></tr>
                    <tr><td style="padding:8px 10px;color:#fff;">👥 用户选择</td><td style="padding:8px 10px;color:#ddd;">打开用户选择面板，勾选要续火花的好友。会自动解析左侧聊天列表。</td></tr>
                    <tr><td style="padding:8px 10px;color:#fff;">🔄 重置重试</td><td style="padding:8px 10px;color:#ddd;">清零重试计数，并立即触发一次自动检测。发送失败卡住时可以点这个。</td></tr>
                    <tr><td style="padding:8px 10px;color:#fff;">📖 使用帮助</td><td style="padding:8px 10px;color:#ddd;">打开当前这个帮助面板，包含所有功能说明、常见问题、调度器教程等。</td></tr>
                    <tr><td style="padding:8px 10px;color:#fff;">🗑️ 清空数据</td><td style="padding:8px 10px;color:#ddd;">清空今日发送记录、失败列表、重试计数。<b style="color:#ffc107;">不会影响设置和目标用户列表。</b></td></tr>
                    <tr><td style="padding:8px 10px;color:#fff;">🔧 重置配置</td><td style="padding:8px 10px;color:#ddd;">恢复所有设置到默认值。<b style="color:#ff2c54;">危险操作</b>，会清空目标用户、消息模板、火花天数记录等全部数据。</td></tr>
                </table>
            </div>

            <div class="dyfire-section">
                <h4>用户选择面板</h4>
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <tr style="background:rgba(0,216,184,.1);">
                        <th style="text-align:left;padding:8px 10px;color:#00d8b8;width:150px;">按钮</th>
                        <th style="text-align:left;padding:8px 10px;color:#00d8b8;">作用</th>
                    </tr>
                    <tr><td style="padding:8px 10px;color:#fff;">全选</td><td style="padding:8px 10px;color:#ddd;">勾选当前已加载出来的所有好友。</td></tr>
                    <tr><td style="padding:8px 10px;color:#fff;">取消全选</td><td style="padding:8px 10px;color:#ddd;">取消所有勾选。</td></tr>
                    <tr><td style="padding:8px 10px;color:#00d8b8;">✅ 更新目标用户</td><td style="padding:8px 10px;color:#ddd;">保存当前勾选的好友作为目标用户列表。</td></tr>
                    <tr><td style="padding:8px 10px;color:#ff2c54;">❌ 取消</td><td style="padding:8px 10px;color:#ddd;">不保存，直接关闭面板。</td></tr>
                </table>
                <div style="color:#999;font-size:12px;margin-top:8px;">
                    💡 好友昵称旁边的 <span style="color:#ff9500;">🔥 410天</span> 徽章表示采集到的火花天数，鼠标悬停可查看。
                </div>
            </div>

            <div class="dyfire-section">
                <h4>天数管理面板</h4>
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <tr style="background:rgba(0,216,184,.1);">
                        <th style="text-align:left;padding:8px 10px;color:#00d8b8;width:200px;">项目</th>
                        <th style="text-align:left;padding:8px 10px;color:#00d8b8;">作用</th>
                    </tr>
                    <tr><td style="padding:8px 10px;color:#fff;">🔍 搜索框</td><td style="padding:8px 10px;color:#ddd;">按昵称关键词快速筛选列表。</td></tr>
                    <tr><td style="padding:8px 10px;color:#fff;">🔄 扫描好友列表</td><td style="padding:8px 10px;color:#ddd;">打开左侧聊天列表、自动滚动到底部，采集所有会话的昵称和火花天数。</td></tr>
                    <tr><td style="padding:8px 10px;color:#ff2c54;">🗑️ 清空全部</td><td style="padding:8px 10px;color:#ddd;">清空所有好友的火花天数记录（<b>不可恢复</b>）。</td></tr>
                    <tr><td style="padding:8px 10px;color:#fff;">修改</td><td style="padding:8px 10px;color:#ddd;">手动修改某位好友的火花天数。</td></tr>
                    <tr><td style="padding:8px 10px;color:#ffc107;">☑️ 自动从页面获取火花天数</td><td style="padding:8px 10px;color:#ddd;">见天数管理面板底部的开关说明：<br>· 开启：扫描/发送时从抖音页面实时读取并覆盖本地<br>· 关闭：每天首次发送成功 +1，同一天重复发送不自增</td></tr>
                </table>
            </div>

            <div class="dyfire-section">
                <h4>日志面板</h4>
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <tr style="background:rgba(0,216,184,.1);">
                        <th style="text-align:left;padding:8px 10px;color:#00d8b8;width:180px;">按钮</th>
                        <th style="text-align:left;padding:8px 10px;color:#00d8b8;">作用</th>
                    </tr>
                    <tr><td style="padding:8px 10px;color:#fff;">级别筛选</td><td style="padding:8px 10px;color:#ddd;">只看 info / success / warn / error 某一级别的日志。</td></tr>
                    <tr><td style="padding:8px 10px;color:#fff;">分类筛选</td><td style="padding:8px 10px;color:#ddd;">只看"发送"或"API"或"UI"等某一类日志。</td></tr>
                    <tr><td style="padding:8px 10px;color:#fff;">日期 / 条数 / 关键词</td><td style="padding:8px 10px;color:#ddd;">按日期切换、限制显示条数、对消息文本模糊搜索。</td></tr>
                    <tr><td style="padding:8px 10px;color:#fff;">📤 导出当前筛选</td><td style="padding:8px 10px;color:#ddd;">把当前筛选条件下看到的日志导出为 txt + json 两个文件。</td></tr>
                    <tr><td style="padding:8px 10px;color:#fff;">📤 导出全部</td><td style="padding:8px 10px;color:#ddd;">忽略筛选，导出当前日期的全部日志。</td></tr>
                </table>
            </div>
        `
    },
    {
        id: 'settings',
        label: '⚙️ 设置项对照',
        html: `
            <div class="dyfire-section">
                <h4>📅 基本设置</h4>
                <table style="width:100%;border-collapse:collapse;font-size:12px;">
                    <tr style="background:rgba(0,216,184,.1);">
                        <th style="text-align:left;padding:6px 10px;color:#00d8b8;width:180px;">设置项</th>
                        <th style="text-align:left;padding:6px 10px;color:#00d8b8;">说明</th>
                    </tr>
                    <tr><td style="padding:6px 10px;color:#8fbdff;">启用随机发送时间</td><td style="padding:6px 10px;color:#ddd;">开启后每天在指定区间随机挑时间发送。</td></tr>
                    <tr><td style="padding:6px 10px;color:#8fbdff;">发送时间</td><td style="padding:6px 10px;color:#ddd;">格式 HH:mm:ss，例如 00:01:00 表示每天凌晨 0 点 1 分发送。</td></tr>
                    <tr><td style="padding:6px 10px;color:#8fbdff;">自动从页面获取火花天数</td><td style="padding:6px 10px;color:#ddd;">详见「功能详解 → 火花天数记录」。</td></tr>
                    <tr><td style="padding:6px 10px;color:#8fbdff;">页面初始加载等待时间</td><td style="padding:6px 10px;color:#ddd;">打开页面后延迟多少秒开始自动检测。页面加载慢的话可以调大。</td></tr>
                    <tr><td style="padding:6px 10px;color:#8fbdff;">最大重试次数</td><td style="padding:6px 10px;color:#ddd;">发送失败时的最大重试次数（1~10）。</td></tr>
                    <tr><td style="padding:6px 10px;color:#8fbdff;">达到最大重试次数后继续重试</td><td style="padding:6px 10px;color:#ddd;">开启后，会在"自动重试间隔"时间后自动重置计数并重试。</td></tr>
                    <tr><td style="padding:6px 10px;color:#8fbdff;">自动重试间隔（分钟）</td><td style="padding:6px 10px;color:#ddd;">达到最大重试后，等待多少分钟自动重置。</td></tr>
                    <tr><td style="padding:6px 10px;color:#ffc107;">🔗 后端调度器回调（高级）</td><td style="padding:6px 10px;color:#ddd;">仅配合外部调度器时使用。单账号可忽略。详见「⚡ 调度器」分节。</td></tr>
                </table>
            </div>

            <div class="dyfire-section">
                <h4>💬 消息设置</h4>
                <table style="width:100%;border-collapse:collapse;font-size:12px;">
                    <tr style="background:rgba(0,216,184,.1);">
                        <th style="text-align:left;padding:6px 10px;color:#00d8b8;width:180px;">设置项</th>
                        <th style="text-align:left;padding:6px 10px;color:#00d8b8;">说明</th>
                    </tr>
                    <tr><td style="padding:6px 10px;color:#8fbdff;">自定义消息模板</td><td style="padding:6px 10px;color:#ddd;">要发送的消息内容，支持 [天数] [API] [TXTAPI] [专属一言] 等占位符。</td></tr>
                    <tr><td style="padding:6px 10px;color:#8fbdff;">Chat 页面换行替换符</td><td style="padding:6px 10px;color:#ddd;">Chat 页面聊天框不支持换行，消息里的 \\n 会被替换为该符号（默认 " | "）。</td></tr>
                </table>
            </div>

            <div class="dyfire-section">
                <h4>🔗 API 设置</h4>
                <table style="width:100%;border-collapse:collapse;font-size:12px;">
                    <tr style="background:rgba(0,216,184,.1);">
                        <th style="text-align:left;padding:6px 10px;color:#00d8b8;width:180px;">设置项</th>
                        <th style="text-align:left;padding:6px 10px;color:#00d8b8;">说明</th>
                    </tr>
                    <tr><td style="padding:6px 10px;color:#8fbdff;">启用一言 API</td><td style="padding:6px 10px;color:#ddd;">从 hitokoto.cn 获取随机句子。</td></tr>
                    <tr><td style="padding:6px 10px;color:#8fbdff;">一言格式</td><td style="padding:6px 10px;color:#ddd;">最终展示格式，支持 {hitokoto} {from} {from_who} 变量。</td></tr>
                    <tr><td style="padding:6px 10px;color:#8fbdff;">启用 TXTAPI</td><td style="padding:6px 10px;color:#ddd;">从 URL 或手动文本里取一条文本。</td></tr>
                    <tr><td style="padding:6px 10px;color:#8fbdff;">TXTAPI 模式</td><td style="padding:6px 10px;color:#ddd;">API 模式 / 手动模式。</td></tr>
                    <tr><td style="padding:6px 10px;color:#8fbdff;">手动文本</td><td style="padding:6px 10px;color:#ddd;">每行一条，可随机或顺序发送。</td></tr>
                </table>
            </div>

            <div class="dyfire-section">
                <h4>🌟 专属一言</h4>
                <table style="width:100%;border-collapse:collapse;font-size:12px;">
                    <tr style="background:rgba(0,216,184,.1);">
                        <th style="text-align:left;padding:6px 10px;color:#00d8b8;width:180px;">设置项</th>
                        <th style="text-align:left;padding:6px 10px;color:#00d8b8;">说明</th>
                    </tr>
                    <tr><td style="padding:6px 10px;color:#8fbdff;">启用专属一言</td><td style="padding:6px 10px;color:#ddd;">按星期切换的专属文案。</td></tr>
                    <tr><td style="padding:6px 10px;color:#8fbdff;">发送模式</td><td style="padding:6px 10px;color:#ddd;">随机（发过的不再发） / 顺序（按顺序）。</td></tr>
                    <tr><td style="padding:6px 10px;color:#8fbdff;">周一~周日</td><td style="padding:6px 10px;color:#ddd;">每天对应的一组文案，每行一条。</td></tr>
                </table>
            </div>

            <div class="dyfire-section">
                <h4>👥 用户设置</h4>
                <table style="width:100%;border-collapse:collapse;font-size:12px;">
                    <tr style="background:rgba(0,216,184,.1);">
                        <th style="text-align:left;padding:6px 10px;color:#00d8b8;width:180px;">设置项</th>
                        <th style="text-align:left;padding:6px 10px;color:#00d8b8;">说明</th>
                    </tr>
                    <tr><td style="padding:6px 10px;color:#8fbdff;">目标用户名</td><td style="padding:6px 10px;color:#ddd;">每行一个，列表不为空时自动启用目标用户查找。</td></tr>
                    <tr><td style="padding:6px 10px;color:#8fbdff;">发送模式</td><td style="padding:6px 10px;color:#ddd;">顺序 / 随机。</td></tr>
                    <tr><td style="padding:6px 10px;color:#8fbdff;">重试时使用同一用户</td><td style="padding:6px 10px;color:#ddd;">开启后重试时还是发同一个人；关闭则切换到下一个人。</td></tr>
                </table>
            </div>

            <div class="dyfire-section">
                <h4>⚡ 高级设置</h4>
                <table style="width:100%;border-collapse:collapse;font-size:12px;">
                    <tr style="background:rgba(0,216,184,.1);">
                        <th style="text-align:left;padding:6px 10px;color:#00d8b8;width:180px;">设置项</th>
                        <th style="text-align:left;padding:6px 10px;color:#00d8b8;">说明</th>
                    </tr>
                    <tr><td style="padding:6px 10px;color:#8fbdff;">用户查找超时</td><td style="padding:6px 10px;color:#ddd;">搜索某个用户的最长等待时间。</td></tr>
                    <tr><td style="padding:6px 10px;color:#8fbdff;">页面加载等待</td><td style="padding:6px 10px;color:#ddd;">打开页面后等待输入框出现的最大时长。</td></tr>
                    <tr><td style="padding:6px 10px;color:#8fbdff;">实时面板显示条数</td><td style="padding:6px 10px;color:#ddd;">主面板下方"操作日志"显示多少条。</td></tr>
                    <tr><td style="padding:6px 10px;color:#8fbdff;">历史面板默认显示条数</td><td style="padding:6px 10px;color:#ddd;">日志面板打开时默认展示多少条。</td></tr>
                    <tr><td style="padding:6px 10px;color:#8fbdff;">每日日志上限</td><td style="padding:6px 10px;color:#ddd;">每天日志最多保留多少条，超出自动轮转。</td></tr>
                    <tr><td style="padding:6px 10px;color:#8fbdff;">日志保留天数</td><td style="padding:6px 10px;color:#ddd;">超过天数的日志分片会被自动删除。</td></tr>
                </table>
            </div>
        `
    },
    {
        id: 'faq',
        label: '❓ 常见问题',
        html: `
            <div class="dyfire-section">
                <h4>Q1：脚本安装后不显示控制面板？</h4>
                <div style="color:#ddd;font-size:13px;line-height:1.9;">
                    ① 确认脚本管理器里该脚本已"启用"。<br>
                    ② 确认当前 URL 是 <code>www.douyin.com/chat</code> 开头的页面。<br>
                    ③ 刷新页面，等 2~3 秒。<br>
                    ④ 按 F12 打开控制台，看是否有红色报错。
                </div>
            </div>

            <div class="dyfire-section">
                <h4>Q2：扫描好友列表后发现天数不更新？</h4>
                <div style="color:#ddd;font-size:13px;line-height:1.9;">
                    ① 检查「天数管理」底部的"自动从页面获取火花天数"是否被关闭。<br>
                    ② 关闭状态下扫描只会给新用户建档，不会覆盖已有天数。<br>
                    ③ 开启后再次扫描即可刷新。
                </div>
            </div>

            <div class="dyfire-section">
                <h4>Q3：好友明明没有火花天数，脚本却显示数字？</h4>
                <div style="color:#ddd;font-size:13px;line-height:1.9;">
                    早期版本可能存在"读取到别人天数"的 bug，v2026.10.02 已修复：<br>
                    · 只会从右侧聊天面板读取当前会话的天数<br>
                    · 用户列表采集时从每个会话项内部独立读取<br>
                    如果仍出现，请点击「📅 天数管理 → 🗑️ 清空全部」后重新扫描。
                </div>
            </div>

            <div class="dyfire-section">
                <h4>Q4：消息模板里的占位符没被替换？</h4>
                <div style="color:#ddd;font-size:13px;line-height:1.9;">
                    ① 占位符必须用英文方括号 <code>[天数]</code>，不能用全角 <code>［天数］</code>。<br>
                    ② 使用 <code>[API]</code> 需要开启"启用一言 API"。<br>
                    ③ 使用 <code>[TXTAPI]</code> 需要开启"启用 TXTAPI"。<br>
                    ④ 使用 <code>[专属一言]</code> 需要开启"启用专属一言"。
                </div>
            </div>

            <div class="dyfire-section">
                <h4>Q5：到点了但脚本没有自动发送？</h4>
                <div style="color:#ddd;font-size:13px;line-height:1.9;">
                    ① 确认脚本没有处于"暂停"状态。<br>
                    ② 确认「👥 用户选择」里已经选好目标好友。<br>
                    ③ 检查是否已经发送过（每天只发一次，重复点击会被跳过）。<br>
                    ④ 看「📋 历史日志」里的记录，会显示为什么没触发。
                </div>
            </div>

            <div class="dyfire-section">
                <h4>Q6：发送失败一直重试？</h4>
                <div style="color:#ddd;font-size:13px;line-height:1.9;">
                    ① 打开「📋 历史日志」筛选 error 级别，看具体报错。<br>
                    ② 常见原因：网络不稳定、抖音页面改版、被风控。<br>
                    ③ 可以点击「🔄 重置重试」手动清零。<br>
                    ④ 如果多次失败，建议暂停脚本，刷新页面后重启。
                </div>
            </div>

            <div class="dyfire-section">
                <h4>Q7：怎么让脚本 24 小时挂机？</h4>
                <div style="color:#ddd;font-size:13px;line-height:1.9;">
                    ① 在 <code>chrome://settings/performance</code> 里把 <code>www.douyin.com</code> 加入"始终活跃"白名单。<br>
                    ② 保持 Chat 页面标签页打开，别关。<br>
                    ③ 电脑不要休眠（电源设置里改为"从不"）。<br>
                    ④ 追求稳定的话可以使用配套的后端调度器，实现多账号自动切换（详见「⚡ 调度器」分节）。
                </div>
            </div>

            <div class="dyfire-section">
                <h4>Q8：日志太多了占空间？</h4>
                <div style="color:#ddd;font-size:13px;line-height:1.9;">
                    在「偏好设置 → 高级设置 → 日志设置」里调整：<br>
                    · 每日日志上限：调小（如 200）<br>
                    · 日志保留天数：调小（如 3）<br>
                    超出天数或条数的日志会自动被清理。
                </div>
            </div>

            <div class="dyfire-section">
                <h4>Q9：如何导出错误日志给开发者排查？</h4>
                <div style="color:#ddd;font-size:13px;line-height:1.9;">
                    ① 打开「📋 历史日志」<br>
                    ② 级别筛选选择 <code>error</code><br>
                    ③ 点击「📤 导出当前筛选」<br>
                    ④ 会得到 .txt 和 .json 两个文件，把 json 附在反馈里即可。
                </div>
            </div>

            <div class="dyfire-section">
                <h4>Q10：能同时给多个抖音账号续火吗？</h4>
                <div style="color:#ddd;font-size:13px;line-height:1.9;">
                    单个脚本实例只处理一个账号。多账号需要使用配套的「后端调度器 + 综合管理器」，让每个账号跑在独立的浏览器 Profile 里依次执行。<br><br>
                    详见「⚡ 调度器」分节，或访问 GitHub 仓库：<br>
                    <a href="${GITHUB_REPO_URL}" target="_blank" rel="noopener noreferrer" style="color:#00d8b8;word-break:break-all;">${GITHUB_REPO_URL}</a>
                </div>
            </div>
        `
    },
    {
        id: 'tips',
        label: '💡 技巧 & 注意',
        html: `
            <div class="dyfire-section">
                <h4>💡 实用技巧</h4>
                <div style="color:#ddd;font-size:13px;line-height:2;">
                    · <b>调模板前先预览</b>：改完消息模板点「👁️ 消息预览」确认效果，避免发送后才发现占位符写错了。<br>
                    · <b>用随机时间防规律</b>：固定时间久了容易让人觉得机械，开随机时间更像真人。<br>
                    · <b>专属一言叠加每日一句</b>：把 <code>[专属一言]</code> 和 <code>[API]</code> 都用上，每天内容都不一样。<br>
                    · <b>天数用来做差异化</b>：写"我们已经认识第 [天数] 天啦"，比单纯"续火"更走心。<br>
                    · <b>批量发送后看日志</b>：日志会显示每个用户是否成功，方便发现问题。<br>
                    · <b>多标签互斥</b>：同一个账号不要开多个 Chat 页面，会导致同一天重复发送。
                </div>
            </div>

            <div class="dyfire-section">
                <h4>⚠️ 使用注意事项</h4>
                <div style="color:#ddd;font-size:13px;line-height:2;">
                    · <b>别频繁改消息模板</b>：改完最好先在"预览"里检查，避免发送奇怪内容。<br>
                    · <b>别开多个脚本实例</b>：同一个账号开多个 Chat 页面会重复发送。<br>
                    · <b>注意冷却期</b>：脚本默认 3 秒冷却，不要手动狂点"立即发送"。<br>
                    · <b>仅在好友同意下使用</b>：不要用来骚扰陌生人。<br>
                    · <b>遵守抖音社区规范</b>：本脚本仅供学习研究，请勿用于违规用途。
                </div>
            </div>

            <div class="dyfire-section">
                <h4>🎯 推荐配置组合</h4>
                <div style="color:#ddd;font-size:13px;line-height:2;">
                    <b style="color:#00d8b8;">📌 稳妥型（默认）：</b><br>
                    · 发送时间 00:01:00<br>
                    · 只启用一言 API<br>
                    · 每个好友单独记录天数<br>
                    · 最大重试次数 3<br><br>

                    <b style="color:#00d8b8;">📌 内容型：</b><br>
                    · 开启随机发送时间（23:30 ~ 00:30）<br>
                    · 消息模板里同时用 [天数] + [专属一言] + [API]<br>
                    · 专属一言按星期配好 5~7 条文案<br><br>

                    <b style="color:#00d8b8;">📌 省心型：</b><br>
                    · 保持默认配置<br>
                    · 定期点「📅 天数管理 → 🔄 扫描好友列表」刷新一次<br>
                    · 把日志保留天数改小，避免占空间
                </div>
            </div>

            <div class="dyfire-section">
                <h4>📝 反馈问题时的建议</h4>
                <div style="color:#ddd;font-size:13px;line-height:1.9;">
                    提交 Issue 时请附上：<br>
                    · 脚本版本号（在脚本管理器里查看）<br>
                    · 浏览器版本<br>
                    · 日志导出的 .json 文件（筛选 error 级别导出即可）<br>
                    · 复现步骤（怎么操作出现的）<br>
                    这样能快速定位问题。<br><br>
                    GitHub 仓库：<br>
                    <a href="${GITHUB_REPO_URL}" target="_blank" rel="noopener noreferrer" style="color:#00d8b8;word-break:break-all;">${GITHUB_REPO_URL}</a>
                </div>
            </div>
        `
    }
];

function showHelpPanel() {
    const existing = document.getElementById('dy-fire-help-panel');
    if (existing) { existing.remove(); return; }

    const panel = document.createElement('div');
    panel.id = 'dy-fire-help-panel';
    panel.className = 'dyfire-modal dyfire-modal-wide';
    panel.style.maxHeight = '88vh';

    panel.innerHTML = `
        <div id="dy-fire-help-header" class="dyfire-modal-header">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <h3 style="margin:0;color:#fff;font-size:18px;font-weight:600;">📖 使用帮助</h3>
                <button id="dy-fire-help-close" class="dyfire-close-btn">×</button>
            </div>
        </div>

        <div class="dyfire-filter-bar" style="padding:8px 20px;">
            <span style="font-size:14px;">🔍</span>
            <input id="dy-fire-help-search" type="text" placeholder="搜索帮助内容（如：火花天数 / TXTAPI / 调度器 / 重试）" class="dyfire-input" style="flex:1;min-width:200px;">
            <button id="dy-fire-help-search-clear" class="dyfire-btn" style="display:none;padding:6px 12px;">清除</button>
        </div>

        <div style="display:flex;height:calc(88vh - 180px);">
            <div class="dyfire-settings-nav" id="dy-fire-help-nav" style="width:160px;"></div>
            <div class="dyfire-settings-body" id="dy-fire-help-body" style="padding:20px;"></div>
        </div>

        <div class="dyfire-modal-footer">
            <button id="dy-fire-help-gotit" class="dyfire-btn dyfire-btn-primary" style="width:100%;padding:12px;font-size:14px;">✅ 我知道了</button>
        </div>
    `;
    document.body.appendChild(panel);
    addDragFunctionality(panel, 'dy-fire-help-header');

    const navEl = document.getElementById('dy-fire-help-nav');
    const bodyEl = document.getElementById('dy-fire-help-body');
    const searchEl = document.getElementById('dy-fire-help-search');
    const clearBtn = document.getElementById('dy-fire-help-search-clear');

    let currentTab = 'quickstart';
    let searchKeyword = '';
    let searchTimer = null;

    const renderTab = () => {
        const tab = HELP_TABS.find(t => t.id === currentTab);
        if (!tab) return;
        bodyEl.innerHTML = tab.html;
        bodyEl.scrollTop = 0;
    };

    const renderSearchResults = () => {
        const kw = searchKeyword.trim().toLowerCase();
        if (!kw) {
            renderTab();
            return;
        }
        const results = _helpSearchAll(kw);
        bodyEl.innerHTML = '';
        bodyEl.scrollTop = 0;

        if (results.length === 0) {
            bodyEl.innerHTML = `<div style="text-align:center;color:#666;padding:60px 20px;">
                <div style="font-size:48px;margin-bottom:20px;">🔍</div>
                <div style="font-size:16px;color:#999;">未找到匹配内容</div>
                <div style="font-size:12px;color:#666;margin-top:8px;">试试其他关键词</div>
            </div>`;
            return;
        }

        const title = document.createElement('div');
        title.style.cssText = 'color:#8fbdff;font-size:13px;margin-bottom:12px;';
        title.textContent = `找到 ${results.length} 条匹配 " ${searchKeyword} " 的内容，点击可跳转并高亮`;
        bodyEl.appendChild(title);

        const frag = document.createDocumentFragment();
        results.forEach(r => {
            const card = document.createElement('div');
            card.className = 'dyfire-section';
            card.style.cursor = 'pointer';
            card.style.marginBottom = '10px';
            card.style.transition = 'all 0.2s';
            card.innerHTML = `
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                    <span style="background:rgba(0,216,184,.15);color:#00d8b8;padding:2px 8px;border-radius:10px;font-size:11px;">${r.tabLabel}</span>
                    <span style="color:#888;font-size:11px;">点击跳转并高亮 →</span>
                </div>
                <div style="color:#ddd;font-size:12px;line-height:1.6;word-break:break-all;">${escapeHtml(r.snippet)}</div>
            `;
            card.addEventListener('mouseenter', () => { card.style.background = 'rgba(0,216,184,.08)'; });
            card.addEventListener('mouseleave', () => { card.style.background = ''; });
            card.addEventListener('click', () => {
                const kw = searchKeyword.trim();

                searchEl.value = '';
                searchKeyword = '';
                clearBtn.style.display = 'none';
                currentTab = r.tabId;
                navEl.querySelectorAll('.dyfire-settings-nav-item').forEach(x => {
                    x.classList.toggle('active', x.dataset.tab === r.tabId);
                });
                renderTab();

                if (kw) {
                    setTimeout(() => {
                        const hit = _highlightKeyword(bodyEl, kw, 3000);
                        if (hit > 0) {
                            addHistoryLog(`帮助跳转：命中 ${hit} 处 "${kw}"`, LEVEL.INFO, { cat: CAT.UI });
                        }
                    }, 120);
                }
            });
            frag.appendChild(card);
        });
        bodyEl.appendChild(frag);
    };

    HELP_TABS.forEach(t => {
        const item = document.createElement('div');
        item.className = 'dyfire-settings-nav-item' + (t.id === currentTab ? ' active' : '');
        item.dataset.tab = t.id;
        item.textContent = t.label;
        item.style.fontSize = '13px';
        item.style.padding = '10px 14px';
        item.addEventListener('click', () => {
            searchEl.value = '';
            searchKeyword = '';
            clearBtn.style.display = 'none';
            currentTab = t.id;
            navEl.querySelectorAll('.dyfire-settings-nav-item').forEach(x => x.classList.remove('active'));
            item.classList.add('active');
            renderTab();
        });
        navEl.appendChild(item);
    });

    renderTab();

    searchEl.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            searchKeyword = searchEl.value;
            clearBtn.style.display = searchKeyword.trim() ? '' : 'none';
            renderSearchResults();
        }, 200);
    });

    clearBtn.addEventListener('click', () => {
        searchEl.value = '';
        searchKeyword = '';
        clearBtn.style.display = 'none';
        renderTab();
    });

    document.getElementById('dy-fire-help-close').addEventListener('click', () => panel.remove());
    document.getElementById('dy-fire-help-gotit').addEventListener('click', () => panel.remove());
}

/* =========================================================
 * 设置面板 schema
 * ========================================================= */
const SETTINGS_SCHEMA = [
    {
        tab: 'basic', label: '📅 基本设置',
        sections: [
            {
                title: '🕒 发送时间设置', fields: [
                    { key: 'sendTimeRandom', type: 'checkbox', label: '启用随机发送时间' },
                    { key: 'sendTime', type: 'text', label: '发送时间 (HH:mm:ss)', validate: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, showIf: c => !c.sendTimeRandom },
                    { key: 'sendTimeRangeStart', type: 'text', label: '开始时间 (HH:mm:ss)', validate: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, showIf: c => c.sendTimeRandom },
                    { key: 'sendTimeRangeEnd', type: 'text', label: '结束时间 (HH:mm:ss)', validate: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, showIf: c => c.sendTimeRandom }
                ]
            },
            {
                title: '🔥 火花天数设置', fields: [
                    { key: 'autoFetchFireDays', type: 'checkbox', label: '自动从页面获取火花天数（关闭则每天首次发送 +1）' }
                ]
            },
            {
                title: '⏱️ 启动设置', fields: [
                    { key: 'initialDelay', type: 'number', label: '页面初始加载等待时间（秒）', min: 0, max: 300 }
                ]
            },
            {
                title: '🔄 重试设置', fields: [
                    { key: 'maxRetryCount', type: 'number', label: '最大重试次数', min: 1, max: 10 },
                    { key: 'retryAfterMaxReached', type: 'checkbox', label: '达到最大重试次数后继续重试' },
                    { key: 'autoRetryInterval', type: 'number', label: '自动重试间隔（分钟）', min: 1, max: 1440 },
                    { key: 'retryResetInterval', type: 'number', label: '定时重置重试间隔（分钟）', min: 0, max: 1440 }
                ]
            },
            {
                title: '🔗 后端调度器回调 <span style="display:inline-block;background:rgba(255,193,7,.15);color:#ffc107;border:1px solid rgba(255,193,7,.35);font-size:11px;padding:1px 8px;border-radius:10px;margin-left:6px;vertical-align:middle;">高级</span>',
                isHtmlTitle: true,
                fields: [
                    { key: 'enableScriptBCallback', type: 'checkbox', label: '启用后端调度器回调' },
                    { key: 'scriptBCallbackPort', type: 'number', label: '回调端口', min: 1024, max: 65535, hint: '单账号使用可忽略此项；多账号请参考「📖 使用帮助 → ⚡ 调度器」' }
                ]
            }
        ]
    },
    {
        tab: 'message', label: '💬 消息设置',
        sections: [
            {
                title: '📝 消息内容', fields: [
                    { key: 'customMessage', type: 'textarea', label: '自定义消息模板', rows: 6, hint: '可用占位符: [API] [TXTAPI] [专属一言] [天数]' }
                ]
            },
            {
                title: '💬 Chat 页面设置', fields: [
                    { key: 'chatPageLineSeparator', type: 'text', label: '换行替换符' }
                ]
            }
        ]
    },
    {
        tab: 'api', label: '🔗 API设置',
        sections: [
            {
                title: '📚 一言API', fields: [
                    { key: 'useHitokoto', type: 'checkbox', label: '启用一言API' },
                    { key: 'hitokotoFormat', type: 'textarea', label: '一言格式', rows: 2, hint: '可用变量: {hitokoto} {from} {from_who}' }
                ]
            },
            {
                title: '📄 TXTAPI', fields: [
                    { key: 'useTxtApi', type: 'checkbox', label: '启用TXTAPI' },
                    { key: 'txtApiMode', type: 'radio', label: 'TXTAPI 模式', options: [{ value: 'api', label: 'API模式' }, { value: 'manual', label: '手动模式' }], showIf: c => c.useTxtApi },
                    { key: 'txtApiUrl', type: 'text', label: 'TXTAPI 链接', showIf: c => c.useTxtApi && c.txtApiMode === 'api' },
                    { key: 'txtApiManualRandom', type: 'checkbox', label: '手动模式随机选择', showIf: c => c.useTxtApi && c.txtApiMode === 'manual' },
                    { key: 'txtApiManualText', type: 'textarea', label: '手动文本（一行一个）', rows: 5, showIf: c => c.useTxtApi && c.txtApiMode === 'manual' }
                ]
            }
        ]
    },
    {
        tab: 'special', label: '🌟 专属一言',
        sections: [
            {
                title: '🌟 专属一言设置', fields: [
                    { key: 'useSpecialHitokoto', type: 'checkbox', label: '启用专属一言' },
                    { key: 'specialHitokotoRandom', type: 'radio', label: '发送模式', options: [{ value: true, label: '随机' }, { value: false, label: '顺序' }] },
                    { key: 'specialHitokotoMonday', type: 'textarea', label: '周一', rows: 3 },
                    { key: 'specialHitokotoTuesday', type: 'textarea', label: '周二', rows: 3 },
                    { key: 'specialHitokotoWednesday', type: 'textarea', label: '周三', rows: 3 },
                    { key: 'specialHitokotoThursday', type: 'textarea', label: '周四', rows: 3 },
                    { key: 'specialHitokotoFriday', type: 'textarea', label: '周五', rows: 3 },
                    { key: 'specialHitokotoSaturday', type: 'textarea', label: '周六', rows: 3 },
                    { key: 'specialHitokotoSunday', type: 'textarea', label: '周日', rows: 3 }
                ]
            }
        ]
    },
    {
        tab: 'users', label: '👥 用户设置',
        sections: [
            {
                title: '👥 目标用户', fields: [
                    { key: 'targetUsernames', type: 'textarea', label: '目标用户名（一行一个）', rows: 5, hint: '列表不为空时自动启用目标用户查找' },
                    { key: 'multiUserMode', type: 'radio', label: '发送模式', options: [{ value: 'sequential', label: '顺序' }, { value: 'random', label: '随机' }] },
                    { key: 'multiUserRetrySame', type: 'checkbox', label: '重试时使用同一用户' }
                ]
            }
        ]
    },
    {
        tab: 'advanced', label: '⚡ 高级设置',
        sections: [
            {
                title: '⚡ 性能设置', fields: [
                    { key: 'userSearchTimeout', type: 'number', label: '用户查找超时(ms)', min: 1000, max: 30000 },
                    { key: 'pageLoadWaitTime', type: 'number', label: '页面加载等待(ms)', min: 1000, max: 15000 }
                ]
            },
            {
                title: '📋 日志设置', fields: [
                    { key: 'maxLiveLogs', type: 'number', label: '实时面板显示条数', min: 3, max: 50 },
                    { key: 'maxViewLogs', type: 'number', label: '历史面板默认显示条数', min: 20, max: 1000 },
                    { key: 'maxHistoryLogs', type: 'number', label: '每日日志上限', min: 100, max: 5000 },
                    { key: 'logRetentionDays', type: 'number', label: '日志保留天数', min: 1, max: 90 }
                ]
            },
            {
                title: '🎨 格式设置', fields: [
                    { key: 'fromFormat', type: 'text', label: 'from 格式' },
                    { key: 'fromWhoFormat', type: 'text', label: 'from_who 格式' }
                ]
            }
        ]
    }
];

let _settingsDraft = {};
let _settingsPanel = null;

function _renderSettingsField(field, draft) {
    const id = `set-${field.key}`;
    const show = !field.showIf || field.showIf(draft);
    const wrap = document.createElement('div');
    wrap.className = 'dyfire-field';
    wrap.dataset.key = field.key;
    wrap.style.display = show ? '' : 'none';

    const label = document.createElement('label');
    label.className = 'dyfire-field-label';
    label.textContent = field.label;
    wrap.appendChild(label);

    if (field.type === 'checkbox') {
        const row = document.createElement('label');
        row.style.cssText = 'display:flex;align-items:center;cursor:pointer;';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = id;
        cb.checked = !!draft[field.key];
        cb.style.marginRight = '8px';
        cb.addEventListener('change', () => { draft[field.key] = cb.checked; _refreshSettingsVisibility(); });
        row.appendChild(cb);
        const span = document.createElement('span');
        span.style.color = '#ccc';
        span.textContent = '启用';
        row.appendChild(span);
        wrap.appendChild(row);
    } else if (field.type === 'textarea') {
        const ta = document.createElement('textarea');
        ta.id = id;
        ta.rows = field.rows || 3;
        ta.className = 'dyfire-input';
        ta.value = draft[field.key] ?? '';
        ta.addEventListener('input', () => { draft[field.key] = ta.value; });
        wrap.appendChild(ta);
    } else if (field.type === 'radio') {
        const group = document.createElement('div');
        group.style.cssText = 'display:flex;gap:20px;flex-wrap:wrap;';
        field.options.forEach(opt => {
            const lbl = document.createElement('label');
            lbl.style.cssText = 'display:flex;align-items:center;cursor:pointer;';
            const r = document.createElement('input');
            r.type = 'radio';
            r.name = `radio-${field.key}`;
            r.value = String(opt.value);
            r.checked = draft[field.key] === opt.value;
            r.style.marginRight = '8px';
            r.addEventListener('change', () => { draft[field.key] = opt.value; _refreshSettingsVisibility(); });
            lbl.appendChild(r);
            const s = document.createElement('span');
            s.style.color = '#ccc';
            s.textContent = opt.label;
            lbl.appendChild(s);
            group.appendChild(lbl);
        });
        wrap.appendChild(group);
    } else if (field.type === 'number') {
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.id = id;
        inp.className = 'dyfire-input';
        if (field.min != null) inp.min = field.min;
        if (field.max != null) inp.max = field.max;
        inp.value = draft[field.key] ?? '';
        inp.addEventListener('input', () => { draft[field.key] = Number(inp.value); });
        wrap.appendChild(inp);
    } else {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.id = id;
        inp.className = 'dyfire-input';
        inp.value = draft[field.key] ?? '';
        inp.addEventListener('input', () => { draft[field.key] = inp.value; });
        wrap.appendChild(inp);
    }

    if (field.hint) {
        const hint = document.createElement('div');
        hint.className = 'dyfire-field-hint';
        hint.textContent = field.hint;
        wrap.appendChild(hint);
    }
    return wrap;
}

function _refreshSettingsVisibility() {
    if (!_settingsPanel) return;
    _settingsPanel.querySelectorAll('.dyfire-field').forEach(el => {
        let field = null;
        for (const tab of SETTINGS_SCHEMA) {
            for (const sec of tab.sections) {
                for (const f of sec.fields) {
                    if (f.key === el.dataset.key) { field = f; break; }
                }
                if (field) break;
            }
            if (field) break;
        }
        if (!field) return;
        el.style.display = (!field.showIf || field.showIf(_settingsDraft)) ? '' : 'none';
    });
}

function showSettingsPanel() {
    const existing = document.getElementById('dy-fire-settings-panel');
    if (existing) { existing.remove(); return; }

    _settingsDraft = Object.assign({}, userConfig);

    const panel = document.createElement('div');
    panel.id = 'dy-fire-settings-panel';
    panel.className = 'dyfire-modal dyfire-modal-wide';
    panel.innerHTML = `
        <div id="dy-fire-settings-header" class="dyfire-modal-header">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <h3 style="margin:0;color:#fff;font-size:18px;font-weight:600;">⚙️ 偏好设置</h3>
                <button id="dy-fire-settings-close" class="dyfire-close-btn">×</button>
            </div>
        </div>
        <div style="display:flex;height:calc(85vh - 160px);">
            <div class="dyfire-settings-nav" id="dy-fire-settings-nav"></div>
            <div class="dyfire-settings-body" id="dy-fire-settings-body"></div>
        </div>
        <div class="dyfire-modal-footer">
            <button id="dy-fire-settings-save" class="dyfire-btn dyfire-btn-primary" style="width:100%;padding:14px;font-size:15px;">💾 保存设置</button>
        </div>
    `;
    document.body.appendChild(panel);
    _settingsPanel = panel;
    addDragFunctionality(panel, 'dy-fire-settings-header');

    const navEl = document.getElementById('dy-fire-settings-nav');
    const bodyEl = document.getElementById('dy-fire-settings-body');
    let currentTab = 'basic';

    const renderTab = () => {
        bodyEl.innerHTML = '';
        const tabSchema = SETTINGS_SCHEMA.find(t => t.tab === currentTab);
        if (!tabSchema) return;
        tabSchema.sections.forEach(sec => {
            const sectionEl = document.createElement('div');
            sectionEl.className = 'dyfire-section';
            const title = document.createElement('h4');
            if (sec.isHtmlTitle) {
                title.innerHTML = sec.title;
            } else {
                title.textContent = sec.title;
            }
            sectionEl.appendChild(title);
            sec.fields.forEach(f => sectionEl.appendChild(_renderSettingsField(f, _settingsDraft)));
            bodyEl.appendChild(sectionEl);
        });
        _refreshSettingsVisibility();
    };

    SETTINGS_SCHEMA.forEach(t => {
        const item = document.createElement('div');
        item.className = 'dyfire-settings-nav-item' + (t.tab === currentTab ? ' active' : '');
        item.textContent = t.label;
        item.addEventListener('click', () => {
            currentTab = t.tab;
            navEl.querySelectorAll('.dyfire-settings-nav-item').forEach(x => x.classList.remove('active'));
            item.classList.add('active');
            renderTab();
        });
        navEl.appendChild(item);
    });

    renderTab();

    document.getElementById('dy-fire-settings-close').addEventListener('click', () => { panel.remove(); _settingsPanel = null; });
    document.getElementById('dy-fire-settings-save').addEventListener('click', () => { saveSettingsFromDraft(); panel.remove(); _settingsPanel = null; });
}

function saveSettingsFromDraft() {
    for (const tab of SETTINGS_SCHEMA) {
        for (const sec of tab.sections) {
            for (const f of sec.fields) {
                if (f.validate && !f.validate.test(String(_settingsDraft[f.key] ?? ''))) { alert(`字段「${f.label}」格式不正确`); return; }
                if (f.type === 'number' && (f.min != null || f.max != null)) {
                    const v = Number(_settingsDraft[f.key]);
                    if (isNaN(v) || (f.min != null && v < f.min) || (f.max != null && v > f.max)) { alert(`字段「${f.label}」超出范围`); return; }
                }
            }
        }
    }

    Object.assign(userConfig, _settingsDraft);
    const targets = (userConfig.targetUsernames || '').trim().split('\n').filter(x => x.trim());
    userConfig.enableTargetUser = targets.length > 0;

    saveConfig();
    parseTargetUsers();
    updateUserStatusDisplay();
    updateFireDaysStatus();
    _cleanOldLogShards();

    nextSendTime = parseRandomTimeString();
    startCountdown(nextSendTime);

    addHistoryLog('设置已保存', LEVEL.SUCCESS, { cat: CAT.UI });
}

/* =========================================================
 * 拖拽 / 主面板 / 预览
 * ========================================================= */
function addDragFunctionality(panel, headerId) {
    const header = document.getElementById(headerId);
    if (!header) return;

    header.addEventListener('mousedown', e => {
        if (e.target.tagName === 'BUTTON') return;
        isDragging = true;
        currentPanel = panel;
        const rect = panel.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        if (panel.style.transform && panel.style.transform.includes('translate')) {
            panel.style.transform = 'none';
            panel.style.left = rect.left + 'px';
            panel.style.top = rect.top + 'px';
        }
        panel.style.transition = 'none';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });

    if (!dragListenersAttached) {
        dragListenersAttached = true;
        document.addEventListener('mousemove', e => {
            if (!isDragging || !currentPanel) return;
            const x = e.clientX - dragOffsetX;
            const y = e.clientY - dragOffsetY;
            const maxX = window.innerWidth - currentPanel.offsetWidth;
            const maxY = window.innerHeight - currentPanel.offsetHeight;
            currentPanel.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
            currentPanel.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
            currentPanel.style.transform = 'none';
        });
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                if (currentPanel) currentPanel.style.transition = 'all 0.3s ease';
                currentPanel = null;
                document.body.style.userSelect = '';
            }
        });
    }
}

function createControlPanel() {
    const existing = document.getElementById('dy-fire-helper');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = 'dy-fire-helper';
    panel.className = 'dyfire-panel';
    panel.innerHTML = `
        <div id="dy-fire-header" class="dyfire-panel-header">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                <h3 style="margin:0;color:#fff;font-size:18px;display:flex;align-items:center;font-weight:600;">
                    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff2c54;margin-right:10px;box-shadow:0 0 8px #ff2c54;"></span>
                    🔥 抖音续火助手
                </h3>
                <div style="display:flex;align-items:center;gap:10px;">
                    <div id="dy-fire-pause-status" style="font-size:12px;color:#ff9500;font-weight:500;display:none;">⏸️ 已暂停</div>
                    <button id="dy-fire-helper-close" class="dyfire-close-btn">×</button>
                </div>
            </div>
            <div class="dyfire-status-grid">
                <div class="dyfire-status-card"><div class="dyfire-status-label">今日状态</div><div id="dy-fire-status" class="dyfire-status-value" style="color:#00d8b8;">已发送</div></div>
                <div class="dyfire-status-card"><div class="dyfire-status-label">用户状态</div><div id="dy-fire-user-status" class="dyfire-status-value" style="color:#999;">未启用</div></div>
                <div class="dyfire-status-card"><div class="dyfire-status-label">发送进度</div><div id="dy-fire-user-progress" class="dyfire-status-value" style="color:#ff2c54;"></div></div>
                <div class="dyfire-status-card"><div class="dyfire-status-label">重试次数</div><div id="dy-fire-retry" class="dyfire-status-value" style="color:#fff;">0/${userConfig.maxRetryCount}</div></div>
            </div>
        </div>

        <div class="dyfire-block">
            <div class="dyfire-info-grid">
                <div class="dyfire-status-card"><div class="dyfire-status-label">下次发送</div><div id="dy-fire-next" class="dyfire-status-value" style="font-size:11px;">-</div></div>
                <div class="dyfire-status-card"><div class="dyfire-status-label">倒计时</div><div id="dy-fire-countdown" class="dyfire-status-value" style="color:#ff2c54;font-weight:700;">--:--:--</div></div>
                <div class="dyfire-status-card"><div class="dyfire-status-label">火花天数</div><div id="dy-fire-days" class="dyfire-status-value" style="color:#00d8b8;font-weight:700;">${userConfig.fireDays}</div></div>
            </div>
            <div class="dyfire-info-grid" style="margin-top:8px;">
                <div class="dyfire-status-card"><div class="dyfire-status-label">一言</div><div id="dy-fire-hitokoto" class="dyfire-status-value" style="color:#00d8b8;">未获取</div></div>
                <div class="dyfire-status-card"><div class="dyfire-status-label">专属一言</div><div id="dy-fire-special-hitokoto" class="dyfire-status-value" style="color:#00d8b8;">未获取</div></div>
                <div class="dyfire-status-card"><div class="dyfire-status-label">TXTAPI</div><div id="dy-fire-txtapi" class="dyfire-status-value" style="color:#00d8b8;">未获取</div></div>
            </div>
        </div>

        <div class="dyfire-block">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px;">
                <button id="dy-fire-send" class="dyfire-btn dyfire-btn-primary">🚀 立即发送</button>
                <button id="dy-fire-pause" class="dyfire-btn" style="background:linear-gradient(135deg,#ff9500,#ffcc00);">⏸️ 暂停</button>
                <button id="dy-fire-reset-users" class="dyfire-btn" style="background:linear-gradient(135deg,#6f42c1,#8e44ad);">🔄 重置记录</button>
            </div>
            <div class="dyfire-btn-grid">
                <button id="dy-fire-settings" class="dyfire-btn dyfire-btn-ghost">⚙️ 偏好设置</button>
                <button id="dy-fire-preview" class="dyfire-btn dyfire-btn-ghost">👁️ 消息预览</button>
                <button id="dy-fire-history" class="dyfire-btn dyfire-btn-ghost">📋 历史日志</button>
                <button id="dy-fire-manage-days" class="dyfire-btn dyfire-btn-ghost">📅 天数管理</button>
                <button id="dy-fire-select-users" class="dyfire-btn dyfire-btn-ghost">👥 用户选择</button>
                <button id="dy-fire-reset-retry" class="dyfire-btn dyfire-btn-ghost">🔄 重置重试</button>
                <button id="dy-fire-help" class="dyfire-btn dyfire-btn-ghost">📖 使用帮助</button>
                <button id="dy-fire-clear" class="dyfire-btn dyfire-btn-ghost">🗑️ 清空数据</button>
                <button id="dy-fire-reset" class="dyfire-btn dyfire-btn-ghost">🔧 重置配置</button>
            </div>
        </div>

        <div class="dyfire-block">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <div style="font-weight:600;font-size:14px;">操作日志</div>
                <div style="font-size:11px;color:#999;">实时</div>
            </div>
            <div id="dy-fire-log" class="dyfire-live-log">
                <div style="color:#00d8b8;padding:5px 0;">系统已就绪...</div>
            </div>
        </div>
    `;
    document.body.appendChild(panel);
    addDragFunctionality(panel, 'dy-fire-header');
    createReopenButton();

    document.getElementById('dy-fire-helper-close').addEventListener('click', () => {
        panel.style.display = 'none';
        const rb = document.getElementById('dy-fire-reopen-btn');
        if (rb) rb.style.display = 'flex';
    });
    document.getElementById('dy-fire-send').addEventListener('click', sendMessage);
    document.getElementById('dy-fire-pause').addEventListener('click', togglePause);
    document.getElementById('dy-fire-settings').addEventListener('click', showSettingsPanel);
    document.getElementById('dy-fire-preview').addEventListener('click', showMessagePreview);
    document.getElementById('dy-fire-history').addEventListener('click', () => showLogPanel());
    document.getElementById('dy-fire-manage-days').addEventListener('click', showFireDaysPanel);
    document.getElementById('dy-fire-select-users').addEventListener('click', showUserSelectPanel);
    document.getElementById('dy-fire-reset-retry').addEventListener('click', resetRetryAndSend);
    document.getElementById('dy-fire-help').addEventListener('click', showHelpPanel);
    document.getElementById('dy-fire-clear').addEventListener('click', clearData);
    document.getElementById('dy-fire-reset').addEventListener('click', resetAllConfig);
    document.getElementById('dy-fire-reset-users').addEventListener('click', resetTodaySentUsers);

    updateUserStatusDisplay();
    updateFireDaysStatus();
    updateRetryCount();
    updatePauseButton();
    updatePauseStatusDisplay();
}

function createReopenButton() {
    const exist = document.getElementById('dy-fire-reopen-btn');
    if (exist) exist.remove();
    const btn = document.createElement('div');
    btn.id = 'dy-fire-reopen-btn';
    btn.className = 'dyfire-reopen-btn';
    btn.innerHTML = '🔥';
    btn.title = '打开续火助手';
    btn.addEventListener('click', () => {
        const panel = document.getElementById('dy-fire-helper');
        if (panel) { panel.style.display = 'block'; btn.style.display = 'none'; }
        else { createControlPanel(); btn.style.display = 'none'; }
    });
    document.body.appendChild(btn);
}

function showMessagePreview() {
    const existing = document.getElementById('dy-fire-preview-panel');
    if (existing) { existing.remove(); return; }
    const panel = document.createElement('div');
    panel.id = 'dy-fire-preview-panel';
    panel.className = 'dyfire-modal';
    const targetUser = GM_getValue('lastTargetUser', '') || (allTargetUsers[0] || '');
    panel.innerHTML = `
        <div class="dyfire-modal-header">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <h3 style="margin:0;color:#fff;font-size:16px;">👁️ 消息预览 ${targetUser ? `(${escapeHtml(targetUser)})` : ''}</h3>
                <button id="dy-fire-preview-close" class="dyfire-close-btn">×</button>
            </div>
        </div>
        <div style="padding:16px;">
            <pre id="dy-fire-preview-body" style="white-space:pre-wrap;background:rgba(0,0,0,0.3);padding:14px;border-radius:8px;color:#fff;font-size:13px;max-height:360px;overflow:auto;font-family:inherit;">加载中...</pre>
            <div style="font-size:12px;color:#999;margin-top:8px;">预览不发送，仅调用 API 后展示最终内容</div>
        </div>
    `;
    document.body.appendChild(panel);
    document.getElementById('dy-fire-preview-close').addEventListener('click', () => panel.remove());

    getMessageContent(targetUser).then(msg => {
        const el = document.getElementById('dy-fire-preview-body');
        if (el) el.textContent = msg;
    }).catch(err => {
        const el = document.getElementById('dy-fire-preview-body');
        if (el) el.textContent = `获取失败: ${err.message}`;
    });
}

function resetRetryAndSend() {
    if (isProcessing) { addHistoryLog('任务进行中，跳过', LEVEL.INFO, { cat: CAT.STATE }); return; }
    retryCount = 0;
    isMaxRetryReached = false;
    lastRetryResetTime = nowMs();
    GM_setValue('retryCount', 0);
    GM_setValue('isMaxRetryReached', false);
    GM_setValue('lastRetryResetTime', lastRetryResetTime);
    updateRetryCount();
    addHistoryLog('重试已重置', LEVEL.SUCCESS, { cat: CAT.STATE });
    autoSendIfNeeded();
}

/* =========================================================
 * 样式注入
 * ========================================================= */
function injectStyles() {
    if (document.getElementById('dy-fire-styles')) return;
    const style = document.createElement('style');
    style.id = 'dy-fire-styles';
    style.textContent = `
.dyfire-panel, .dyfire-modal, .dyfire-panel *, .dyfire-modal * { color-scheme: dark; }
.dyfire-panel{position:fixed;top:20px;right:20px;width:500px;max-width:95vw;background:linear-gradient(135deg,#1a1a1a,#2d2d2d);border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.4),0 0 0 1px rgba(255,255,255,.1);z-index:9999;font-family:'PingFang SC','Microsoft YaHei',sans-serif;color:#fff;max-height:1000px;overflow:hidden;backdrop-filter:blur(10px);user-select:none;}
.dyfire-panel-header{padding:20px 20px 15px;border-bottom:1px solid rgba(255,255,255,.1);cursor:move;}
.dyfire-close-btn{background:rgba(255,255,255,.1);border:none;width:28px;height:28px;border-radius:50%;cursor:pointer;color:#fff;font-size:16px;display:flex;align-items:center;justify-content:center;transition:all .2s;}
.dyfire-close-btn:hover{background:rgba(255,255,255,.2);transform:scale(1.1);}
.dyfire-status-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.dyfire-info-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}
.dyfire-status-card{background:rgba(255,255,255,.05);padding:8px;border-radius:8px;}
.dyfire-status-label{color:#999;font-size:11px;margin-bottom:4px;}
.dyfire-status-value{color:#fff;font-weight:600;font-size:12px;word-break:break-all;}
.dyfire-block{padding:15px 20px;border-bottom:1px solid rgba(255,255,255,.1);}
.dyfire-block:last-child{border-bottom:none;}
.dyfire-btn{padding:10px 12px;background:rgba(255,255,255,.1);color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:500;font-size:13px;transition:all .2s;text-align:center;font-family:inherit;white-space:nowrap;line-height:1.2;}
.dyfire-btn:hover{transform:translateY(-2px);}
.dyfire-btn-primary{background:linear-gradient(135deg,#00d8b8,#00b8a8);box-shadow:0 4px 12px rgba(0,216,184,.3);}
.dyfire-btn-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}
.dyfire-btn-ghost{padding:10px 4px;font-size:12px;overflow:hidden;text-overflow:ellipsis;}
.dyfire-btn-danger{background:linear-gradient(135deg,#ff2c54,#ff6b8b);}
.dyfire-btn-info{background:rgba(0,216,184,.2);color:#00d8b8;border:1px solid rgba(0,216,184,.3);}
.dyfire-live-log{font-size:12px;height:120px;overflow-y:auto;line-height:1.5;background:rgba(0,0,0,.3);border-radius:8px;padding:10px;}
.dyfire-log-line{padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05);word-break:break-all;}
.dyfire-reopen-btn{position:fixed;top:20px;right:20px;width:50px;height:50px;background:linear-gradient(135deg,#ff2c54,#ff6b8b);border-radius:50%;color:#fff;display:none;justify-content:center;align-items:center;cursor:pointer;z-index:9998;box-shadow:0 6px 20px rgba(255,44,84,.4);font-size:20px;font-weight:bold;transition:all .3s;backdrop-filter:blur(10px);border:2px solid rgba(255,255,255,.2);}
.dyfire-reopen-btn:hover{transform:scale(1.1) rotate(10deg);}
.dyfire-modal{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:500px;max-width:95vw;max-height:85vh;background:linear-gradient(135deg,#1a1a1a,#2d2d2d);border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,.5);z-index:10000;font-family:'PingFang SC','Microsoft YaHei',sans-serif;overflow:hidden;box-sizing:border-box;backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;color:#fff;}
.dyfire-modal-wide{width:min(1000px,95vw);}
.dyfire-modal-header{padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.2);cursor:move;flex-shrink:0;}
.dyfire-modal-footer{padding:16px 20px;border-top:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.2);flex-shrink:0;}
.dyfire-toolbar{padding:12px 20px;border-bottom:1px solid rgba(255,255,255,.1);flex-shrink:0;display:flex;justify-content:space-between;gap:10px;}
.dyfire-user-list{flex:1;overflow-y:auto;background:rgba(0,0,0,.2);margin:10px 20px;border-radius:8px;padding:6px;min-height:200px;max-height:320px;}
.dyfire-user-row{padding:10px;border-bottom:1px solid rgba(255,255,255,.05);}
.dyfire-settings-nav{width:180px;background:rgba(0,0,0,.3);padding:16px 0;border-right:1px solid rgba(255,255,255,.1);flex-shrink:0;overflow-y:auto;}
.dyfire-settings-nav-item{padding:12px 18px;color:#999;cursor:pointer;transition:all .2s;border-left:3px solid transparent;font-size:14px;}
.dyfire-settings-nav-item:hover{color:#fff;background:rgba(255,255,255,.05);}
.dyfire-settings-nav-item.active{color:#ff2c54;background:rgba(255,44,84,.1);border-left-color:#ff2c54;font-weight:600;}
.dyfire-settings-body{flex:1;overflow-y:auto;padding:20px;}
.dyfire-section{background:rgba(255,255,255,.05);border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid rgba(255,255,255,.1);}
.dyfire-section h4{color:#fff;margin:0 0 12px;font-size:15px;font-weight:600;}
.dyfire-field{margin-bottom:14px;}
.dyfire-field-label{display:block;margin-bottom:6px;color:#ccc;font-weight:500;font-size:13px;}
.dyfire-field-hint{font-size:11px;color:#888;margin-top:4px;}
.dyfire-input{width:100%;padding:10px 12px;background:#2a2a2a;border:1px solid rgba(255,255,255,.2);border-radius:8px;box-sizing:border-box;color:#fff;font-size:13px;font-family:inherit;color-scheme:dark;}
.dyfire-input:focus{outline:none;border-color:#00d8b8;background:#222;}
.dyfire-filter-bar{display:flex;gap:8px;padding:10px 20px;border-bottom:1px solid rgba(255,255,255,.1);flex-wrap:wrap;align-items:center;flex-shrink:0;}
.dyfire-filter-bar label{font-size:12px;color:#999;display:flex;align-items:center;gap:6px;}
.dyfire-filter-bar select, .dyfire-input select {
    background:#2a2a2a !important;color:#fff !important;border:1px solid rgba(255,255,255,.2);border-radius:6px;padding:4px 8px;font-size:12px;font-family:inherit;color-scheme:dark;appearance:none;-webkit-appearance:none;
    background-image:linear-gradient(45deg,transparent 50%,#fff 50%),linear-gradient(135deg,#fff 50%,transparent 50%);
    background-position:calc(100% - 14px) calc(50% - 2px),calc(100% - 10px) calc(50% - 2px);
    background-size:4px 4px,4px 4px;background-repeat:no-repeat;padding-right:24px;
}
.dyfire-filter-bar select option, .dyfire-input select option { background:#2a2a2a !important;color:#fff !important; }
.dyfire-filter-bar input{flex:1;min-width:120px;padding:6px 10px;font-size:12px;color-scheme:dark;}
.dyfire-log-info{padding:8px 20px;font-size:12px;color:#8fbdff;background:rgba(0,0,0,.2);}
.dyfire-log-body{flex:1;overflow-y:auto;padding:0 20px 20px;background:rgba(0,0,0,.2);}
.dyfire-log-row{padding:10px;border-bottom:1px solid rgba(255,255,255,.05);}
.dyfire-log-row details summary{outline:none;}
.dyfire-panel ::-webkit-scrollbar, .dyfire-modal ::-webkit-scrollbar{width:8px;height:8px;}
.dyfire-panel ::-webkit-scrollbar-track, .dyfire-modal ::-webkit-scrollbar-track{background:rgba(0,0,0,.2);}
.dyfire-panel ::-webkit-scrollbar-thumb, .dyfire-modal ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:4px;}
.dyfire-panel ::-webkit-scrollbar-thumb:hover, .dyfire-modal ::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.25);}
.dyfire-modal input[type="checkbox"]{width:15px;height:15px;accent-color:#00d8b8;cursor:pointer;}
.dyfire-help-highlight { animation: dyfire-hl-pulse 1s ease-in-out; }
@keyframes dyfire-hl-pulse {
    0% { background: #ffc107; box-shadow: 0 0 0 2px rgba(255,193,7,.35); }
    50% { background: #ffda6b; box-shadow: 0 0 0 5px rgba(255,193,7,.15); }
    100% { background: #ffc107; box-shadow: 0 0 0 2px rgba(255,193,7,.35); }
}
`;
    document.head.appendChild(style);
}

/* =========================================================
 * 初始化
 * ========================================================= */
function init() {
    injectStyles();
    initConfig();
    _cleanOldLogShards();
    createControlPanel();

    const today = getLocalTodayString();
    if (GM_getValue('lastResetDate', '') !== today) resetTodaySentUsers();

    const isSentToday = GM_getValue('lastSentDate', '') === today;
    updateStatus(isSentToday);
    updateUserStatusDisplay();
    updateFireDaysStatus();
    updateRetryCount();
    updatePauseButton();
    updatePauseStatusDisplay();

    const rb = document.getElementById('dy-fire-reopen-btn');
    if (rb) rb.style.display = 'none';

    if (typeof GM_registerMenuCommand !== 'undefined') {
        try {
            GM_registerMenuCommand('显示面板', () => {
                const p = document.getElementById('dy-fire-helper');
                if (p) p.style.display = 'block';
                if (rb) rb.style.display = 'none';
            });
            GM_registerMenuCommand('使用帮助', showHelpPanel);
            GM_registerMenuCommand('立即发送', sendMessage);
            GM_registerMenuCommand('偏好设置', showSettingsPanel);
            GM_registerMenuCommand('历史日志', () => showLogPanel());
            GM_registerMenuCommand('火花天数管理', showFireDaysPanel);
            GM_registerMenuCommand('从列表选择用户', showUserSelectPanel);
            GM_registerMenuCommand('重置重试并发送', resetRetryAndSend);
            GM_registerMenuCommand('清空发送记录', clearData);
            GM_registerMenuCommand('重置配置', resetAllConfig);
            GM_registerMenuCommand('重置今日记录', resetTodaySentUsers);
            GM_registerMenuCommand(isPaused ? '▶️ 继续脚本' : '⏸️ 暂停脚本', togglePause);
        } catch (e) { /* ignore */ }
    }

    addHistoryLog('抖音续火助手已启动', LEVEL.INFO, { cat: CAT.SYSTEM });

    alreadyDoneNotified = false;
    GM_setValue('alreadyDoneNotified', false);

    if (userConfig.enableTargetUser && allTargetUsers.length > 0) {
        const done = new Set([...sentUsersToday, ...failedUsersToday]);
        const allDone = allTargetUsers.every(u => done.has(u));
        if (allDone) checkAllUsersProcessed();
    } else {
        if (GM_getValue('lastSentDate', '') === today) checkAllUsersProcessed();
    }

    window.addEventListener('beforeunload', () => _flushLogBufferSync());

    if (userConfig.initialDelay > 0) {
        addHistoryLog(`初始延迟 ${userConfig.initialDelay} 秒`, LEVEL.INFO, { cat: CAT.STATE });
        setTimeout(() => {
            autoSendIfNeeded();
            _scheduleNextAutoCheck();
        }, userConfig.initialDelay * 1000);
    } else {
        autoSendIfNeeded();
        _scheduleNextAutoCheck();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

})();