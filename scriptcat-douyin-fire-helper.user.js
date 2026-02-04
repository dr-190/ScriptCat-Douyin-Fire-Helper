// ==UserScript==
// @name         抖音续火花自动发送助手-集成一言API和TXTAPI-支持多用户-增强版
// @namespace    http://tampermonkey.net/
// @version      3.0.0
// @description  每天自动发送续火消息，支持自定义时间，集成一言API和TXTAPI，支持多目标用户，记录火花天数，专属一言，随机发送时间，用户列表解析
// @author       飔梦 / 阚泥 / xiaohe123awa
// @match        https://creator.douyin.com/creator-micro/data/following/chat
// @icon         https://free.picui.cn/free/2025/11/23/69226264aca4e.png
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @grant        GM_listValues
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @connect      hitokoto.cn
// @connect      self
// ==/UserScript==

(function() {
    'use strict';

    // 默认配置
    const DEFAULT_CONFIG = {
        baseMessage: "续火",
        sendTime: "00:01:00",
        sendTimeRandom: false,
        sendTimeRangeStart: "23:30:00",
        sendTimeRangeEnd: "00:30:00",
        checkInterval: 1000,
        maxWaitTime: 30000,
        maxRetryCount: 3,
        hitokotoTimeout: 60000,
        txtApiTimeout: 60000,
        useHitokoto: true,
        useTxtApi: true,
        useSpecialHitokoto: true,
        specialHitokotoMode: "random",
        specialHitokotoRandom: true,
        txtApiMode: "manual",
        txtApiManualRandom: true,
        customMessage: "—————每日续火—————\n\n[TXTAPI]\n\n—————每日一言—————\n\n[API]\n\n—————专属一言—————\n\n[专属一言]\n\n🔥 火花已续 [天数] 天",
        hitokotoFormat: "{hitokoto}\n—— {from}{from_who}",
        fromFormat: "{from}",
        fromWhoFormat: "「{from_who}」",
        txtApiUrl: "https://v1.hitokoto.cn/?encode=text",
        txtApiManualText: "文本1\n文本2\n文本3",
        enableTargetUser: false,  // 这个值会根据目标用户列表自动调整
        targetUsernames: "",
        userSearchTimeout: 10000,
        maxHistoryLogs: 200,
        searchDebounceDelay: 500,
        searchThrottleDelay: 1000,
        clickMethod: "direct",
        pageLoadWaitTime: 5000,
        chatInputCheckInterval: 1000,
        multiUserMode: "sequential",
        multiUserRetrySame: false,
        fireDays: 1,
        specialHitokotoMonday: "周一专属文案1\n周一专属文案2",
        specialHitokotoTuesday: "周二专属文案1\n周二专属文案2",
        specialHitokotoWednesday: "周三专属文案1\n周三专属文案2",
        specialHitokotoThursday: "周四专属文案1\n周四专属文案2",
        specialHitokotoFriday: "周五专属文案1\n周五专属文案2",
        specialHitokotoSaturday: "周六专属文案1\n周六专属文案2",
        specialHitokotoSunday: "周日专属文案1\n周日专属文案2"
    };

    // 状态变量
    let isProcessing = false;
    let retryCount = 0;
    let countdownInterval = null;
    let isScriptCat = false;
    let userConfig = {};
    let nextSendTime = null;
    let currentState = "idle";
    let chatObserver = null;
    let searchTimeout = null;
    let lastSearchTime = 0;
    let searchDebounceTimer = null;
    let chatInputCheckTimer = null;
    
    // 多用户相关变量
    let currentUserIndex = -1;
    let sentUsersToday = [];
    let allTargetUsers = [];
    let currentRetryUser = null;

    // 专属一言发送记录
    let specialHitokotoSentIndexes = {
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
        sunday: []
    };

    // 拖动相关变量
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let currentPanel = null;

    // ==================== 核心功能函数 ====================

    // 检测是否是ScriptCat
    function detectScriptCat() {
        return typeof ScriptCat !== 'undefined' ||
               (typeof GM_info !== 'undefined' && GM_info.scriptHandler === 'ScriptCat');
    }

    // 初始化配置
    function initConfig() {
        const savedConfig = GM_getValue('userConfig');
        userConfig = savedConfig ? {...DEFAULT_CONFIG, ...savedConfig} : {...DEFAULT_CONFIG};
       
        for (const key in DEFAULT_CONFIG) {
            if (userConfig[key] === undefined) {
                userConfig[key] = DEFAULT_CONFIG[key];
            }
        }
       
        if (!GM_getValue('txtApiManualSentIndexes')) {
            GM_setValue('txtApiManualSentIndexes', []);
        }

        if (!GM_getValue('historyLogs')) {
            GM_setValue('historyLogs', []);
        }

        // 初始化火花天数
        if (!GM_getValue('fireDays')) {
            GM_setValue('fireDays', userConfig.fireDays);
        } else {
            userConfig.fireDays = GM_getValue('fireDays');
        }

        // 初始化最后发送日期（用于判断是否为新的一天）
        if (!GM_getValue('lastFireDate')) {
            const today = new Date().toDateString();
            GM_setValue('lastFireDate', today);
        }

        // 初始化专属一言发送记录
        if (!GM_getValue('specialHitokotoSentIndexes')) {
            GM_setValue('specialHitokotoSentIndexes', specialHitokotoSentIndexes);
        } else {
            specialHitokotoSentIndexes = GM_getValue('specialHitokotoSentIndexes', specialHitokotoSentIndexes);
        }
       
        // 初始化多用户数据
        if (!GM_getValue('sentUsersToday')) {
            GM_setValue('sentUsersToday', []);
        }
        sentUsersToday = GM_getValue('sentUsersToday', []);
        
        if (!GM_getValue('currentUserIndex')) {
            GM_setValue('currentUserIndex', -1);
        }
        currentUserIndex = GM_getValue('currentUserIndex', -1);
        
        // 解析目标用户列表并自动设置enableTargetUser
        parseTargetUsers();
       
        GM_setValue('userConfig', userConfig);
        return userConfig;
    }

    // 解析目标用户列表并自动设置enableTargetUser
    function parseTargetUsers() {
        if (!userConfig.targetUsernames || !userConfig.targetUsernames.trim()) {
            allTargetUsers = [];
            userConfig.enableTargetUser = false;  // 无目标用户时自动关闭
            saveConfig();
            return;
        }
        
        const rawText = userConfig.targetUsernames.trim();
        allTargetUsers = rawText.split(/[,|\n]/)
            .map(user => user.trim())
            .filter(user => user.length > 0);
        
        // 有目标用户时自动开启
        if (allTargetUsers.length > 0) {
            userConfig.enableTargetUser = true;
            saveConfig();
        } else {
            userConfig.enableTargetUser = false;
            saveConfig();
        }
            
        addHistoryLog(`解析到 ${allTargetUsers.length} 个目标用户: ${allTargetUsers.join(', ')}`, 'info');
    }

    // 更新enableTargetUser状态（当目标用户列表变化时调用）
    function updateEnableTargetUserStatus() {
        if (allTargetUsers.length === 0) {
            userConfig.enableTargetUser = false;
        } else {
            userConfig.enableTargetUser = true;
        }
        saveConfig();
    }

    // 获取下一个目标用户
    function getNextTargetUser() {
        if (allTargetUsers.length === 0) {
            return null;
        }
        
        const unsentUsers = allTargetUsers.filter(user => !sentUsersToday.includes(user));
        
        if (unsentUsers.length === 0) {
            addHistoryLog('所有目标用户今日都已发送', 'info');
            return null;
        }
        
        let nextUser;
        
        if (userConfig.multiUserMode === 'random') {
            const randomIndex = Math.floor(Math.random() * unsentUsers.length);
            nextUser = unsentUsers[randomIndex];
        } else {
            if (currentUserIndex < 0 || currentUserIndex >= allTargetUsers.length) {
                currentUserIndex = 0;
            }
            
            let found = false;
            for (let i = 0; i < allTargetUsers.length; i++) {
                const index = (currentUserIndex + i) % allTargetUsers.length;
                const user = allTargetUsers[index];
                if (!sentUsersToday.includes(user)) {
                    nextUser = user;
                    currentUserIndex = index;
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                return null;
            }
        }
        
        return nextUser;
    }

    // 标记用户为已发送
    function markUserAsSent(username) {
        if (!sentUsersToday.includes(username)) {
            sentUsersToday.push(username);
            GM_setValue('sentUsersToday', sentUsersToday);
        }
        
        const index = allTargetUsers.indexOf(username);
        if (index !== -1) {
            currentUserIndex = (index + 1) % allTargetUsers.length;
            GM_setValue('currentUserIndex', currentUserIndex);
        }
        
        addHistoryLog(`用户 ${username} 已标记为今日已发送`, 'success');
        updateUserStatusDisplay();
    }

    // 保存配置
    function saveConfig() {
        GM_setValue('userConfig', userConfig);
        GM_setValue('fireDays', userConfig.fireDays);
        GM_setValue('specialHitokotoSentIndexes', specialHitokotoSentIndexes);
    }

    // 添加历史日志
    function addHistoryLog(message, type = 'info') {
        const logs = GM_getValue('historyLogs', []);
        const logEntry = {
            timestamp: new Date().toISOString(),
            message: message,
            type: type
        };
        
        logs.unshift(logEntry);
        
        if (logs.length > userConfig.maxHistoryLogs) {
            logs.splice(userConfig.maxHistoryLogs);
        }
        
        GM_setValue('historyLogs', logs);
        
        addLog(message, type);
    }

    // 获取历史日志
    function getHistoryLogs() {
        return GM_getValue('historyLogs', []);
    }

    // 清空历史日志
    function clearHistoryLogs() {
        GM_setValue('historyLogs', []);
        addHistoryLog('历史日志已清空', 'info');
    }

    // 导出历史日志
    function exportHistoryLogs() {
        const logs = getHistoryLogs();
        const logText = logs.map(log => 
            `${new Date(log.timestamp).toLocaleString()} [${log.type.toUpperCase()}] ${log.message}`
        ).join('\n');
        
        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `抖音续火助手日志_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        addHistoryLog('日志已导出', 'success');
    }

    // 添加实时日志
    function addLog(message, type = 'info') {
        const now = new Date();
        const timeString = now.toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.style.color = type === 'success' ? '#00d8b8' : type === 'error' ? '#ff2c54' : '#ffc107';
        logEntry.style.padding = '5px 0';
        logEntry.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        logEntry.textContent = `${timeString} - ${message}`;
       
        const logContainer = document.getElementById('dy-fire-log');
        if (logContainer) {
            logContainer.prepend(logEntry);
           
            if (logContainer.children.length > 8) {
                logContainer.removeChild(logContainer.lastChild);
            }
           
            logContainer.scrollTop = 0;
        }
    }

    // 更新重试计数显示
    function updateRetryCount() {
        const retryEl = document.getElementById('dy-fire-retry');
        if (retryEl) {
            retryEl.textContent = `${retryCount}/${userConfig.maxRetryCount}`;
        }
    }

    // 更新一言状态显示
    function updateHitokotoStatus(status, isSuccess = true) {
        const statusEl = document.getElementById('dy-fire-hitokoto');
        if (statusEl) {
            statusEl.textContent = status;
            statusEl.style.color = isSuccess ? '#00d8b8' : '#ff2c54';
        }
    }

    // 更新TXTAPI状态显示
    function updateTxtApiStatus(status, isSuccess = true) {
        const statusEl = document.getElementById('dy-fire-txtapi');
        if (statusEl) {
            statusEl.textContent = status;
            statusEl.style.color = isSuccess ? '#00d8b8' : '#ff2c54';
        }
    }

    // 更新专属一言状态显示
    function updateSpecialHitokotoStatus(status, isSuccess = true) {
        const statusEl = document.getElementById('dy-fire-special-hitokoto');
        if (statusEl) {
            statusEl.textContent = status;
            statusEl.style.color = isSuccess ? '#00d8b8' : '#ff2c54';
        }
    }

    // 更新火花天数显示
    function updateFireDaysStatus() {
        const statusEl = document.getElementById('dy-fire-days');
        if (statusEl) {
            statusEl.textContent = userConfig.fireDays;
            statusEl.style.color = '#00d8b8';
        }
    }

    // 初始化聊天列表观察器
    function initChatObserver() {
        if (chatObserver) {
            chatObserver.disconnect();
            chatObserver = null;
        }

        if (!userConfig.enableTargetUser || currentState !== 'searching') {
            return;
        }

        chatObserver = new MutationObserver(function(mutations) {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                const now = Date.now();
                if (now - lastSearchTime < userConfig.searchThrottleDelay) {
                    return;
                }
                lastSearchTime = now;
                
                findAndClickTargetUser();
            }, userConfig.searchDebounceDelay);
        });

        const chatContainer = findChatContainer();
        if (chatContainer) {
            chatObserver.observe(chatContainer, {
                childList: true,
                subtree: true,
                attributes: false,
                characterData: false
            });
            addHistoryLog('聊天列表观察器已启动', 'info');
        } else {
            addHistoryLog('未找到聊天列表容器，将使用备用查找策略', 'warn');
            chatObserver.observe(document.body, {
                childList: true,
                subtree: false,
                attributes: false,
                characterData: false
            });
        }
    }

    // 查找聊天容器
    function findChatContainer() {
        const possibleSelectors = [
            '.chat-list-container',
            '.semi-list',
            '[role="list"]',
            '.conversation-list',
            '.message-list'
        ];
        
        for (const selector of possibleSelectors) {
            const container = document.querySelector(selector);
            if (container) {
                return container;
            }
        }
        
        const sampleUser = document.querySelector('.item-header-name-vL_79m');
        if (sampleUser) {
            let parent = sampleUser;
            for (let i = 0; i < 10; i++) {
                parent = parent.parentElement;
                if (parent && parent.children.length > 5) {
                    return parent;
                }
                if (!parent) break;
            }
        }
        
        return null;
    }

    // 停止聊天观察器
    function stopChatObserver() {
        if (chatObserver) {
            chatObserver.disconnect();
            chatObserver = null;
        }
        clearTimeout(searchDebounceTimer);
        addHistoryLog('聊天列表观察器已停止', 'info');
    }

    // 安全地创建鼠标事件
    function createSafeMouseEvent(type, options = {}) {
        try {
            const safeOptions = {
                bubbles: true,
                cancelable: true,
                view: window,
                ...options
            };
            return new MouseEvent(type, safeOptions);
        } catch (error) {
            try {
                const safeOptions = {
                    bubbles: true,
                    cancelable: true,
                    ...options
                };
                delete safeOptions.view;
                return new MouseEvent(type, safeOptions);
            } catch (error2) {
                addHistoryLog(`创建鼠标事件失败: ${error2.message}`, 'error');
                return null;
            }
        }
    }

    // 查找并点击目标用户
    function findAndClickTargetUser() {
        if (!userConfig.enableTargetUser || allTargetUsers.length === 0) {
            updateUserStatus('配置错误', false);
            return false;
        }

        if (currentState !== 'searching') {
            return false;
        }

        let currentTargetUser;
        if (userConfig.multiUserRetrySame && retryCount > 1 && currentRetryUser) {
            // 重试时使用同一用户
            currentTargetUser = currentRetryUser;
            addHistoryLog(`重试使用同一用户: ${currentTargetUser}`, 'info');
        } else {
            currentTargetUser = getNextTargetUser();
            currentRetryUser = currentTargetUser;
        }

        if (!currentTargetUser) {
            addHistoryLog('没有可发送的目标用户', 'info');
            updateUserStatus('无目标用户', false);
            stopChatObserver();
            isProcessing = false;
            currentRetryUser = null;
            return false;
        }

        GM_setValue('lastTargetUser', currentTargetUser);

        addHistoryLog(`查找目标用户: ${currentTargetUser}`, 'info');
        updateUserStatus(`寻找: ${currentTargetUser}`, null);

        const userElements = document.querySelectorAll('.item-header-name-vL_79m');
        let targetElement = null;

        for (let element of userElements) {
            if (element.textContent.trim() === currentTargetUser) {
                targetElement = element;
                break;
            }
        }

        if (targetElement) {
            addHistoryLog(`找到目标用户: ${currentTargetUser}`, 'success');
            updateUserStatus(`已找到: ${currentTargetUser}`, true);
            
            stopChatObserver();
            
            let clickSuccess = false;
            
            if (userConfig.clickMethod === 'direct') {
                try {
                    targetElement.click();
                    addHistoryLog('使用直接点击方法成功', 'success');
                    clickSuccess = true;
                } catch (error) {
                    addHistoryLog(`直接点击失败: ${error.message}`, 'error');
                }
            } else {
                try {
                    const clickEvent = createSafeMouseEvent('click');
                    if (clickEvent) {
                        targetElement.dispatchEvent(clickEvent);
                        addHistoryLog('使用事件触发方法成功', 'success');
                        clickSuccess = true;
                    } else {
                        targetElement.click();
                        addHistoryLog('事件创建失败，使用直接点击成功', 'success');
                        clickSuccess = true;
                    }
                } catch (error) {
                    addHistoryLog(`事件触发失败: ${error.message}`, 'error');
                }
            }
            
            if (clickSuccess) {
                currentState = 'found';
                waitForPageLoad().then(() => {
                    addHistoryLog('页面加载完成，开始查找聊天输入框', 'info');
                    tryFindChatInput();
                }).catch(error => {
                    addHistoryLog(`等待页面加载超时: ${error.message}`, 'error');
                    tryFindChatInput();
                });
                return true;
            } else {
                try {
                    let clickableParent = targetElement;
                    for (let i = 0; i < 5; i++) {
                        clickableParent = clickableParent.parentElement;
                        if (!clickableParent) break;
                        
                        const style = window.getComputedStyle(clickableParent);
                        if (style.cursor === 'pointer' || clickableParent.onclick) {
                            clickableParent.click();
                            addHistoryLog('通过父元素点击成功', 'success');
                            currentState = 'found';
                            waitForPageLoad().then(() => {
                                addHistoryLog('页面加载完成，开始查找聊天输入框', 'info');
                                tryFindChatInput();
                            }).catch(error => {
                                addHistoryLog(`等待页面加载超时: ${error.message}`, 'error');
                                tryFindChatInput();
                            });
                            return true;
                        }
                    }
                } catch (error) {
                    addHistoryLog(`父元素点击也失败: ${error.message}`, 'error');
                }
                
                updateUserStatus('点击失败', false);
                return false;
            }
        } else {
            addHistoryLog(`未找到目标用户: ${currentTargetUser}`, 'warn');
            updateUserStatus(`寻找: ${currentTargetUser}`, null);
            return false;
        }
    }

    // 等待页面加载完成
    function waitForPageLoad() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`页面加载等待超时 (${userConfig.pageLoadWaitTime}ms)`));
            }, userConfig.pageLoadWaitTime);

            if (document.readyState === 'complete') {
                clearTimeout(timeout);
                resolve();
                return;
            }

            window.addEventListener('load', function onLoad() {
                clearTimeout(timeout);
                window.removeEventListener('load', onLoad);
                resolve();
            });

            let checkCount = 0;
            const maxChecks = userConfig.pageLoadWaitTime / 100;
            const checkInterval = setInterval(() => {
                checkCount++;
                
                const chatInput = document.querySelector('.chat-input-dccKiL');
                if (chatInput) {
                    clearTimeout(timeout);
                    clearInterval(checkInterval);
                    resolve();
                    return;
                }
                
                if (checkCount >= maxChecks) {
                    clearTimeout(timeout);
                    clearInterval(checkInterval);
                    reject(new Error('页面DOM变化检查超时'));
                }
            }, 100);
        });
    }

    // 发送消息函数
    async function sendMessage() {
        if (isProcessing) {
            addHistoryLog('已有任务正在进行中', 'error');
            return;
        }

        if (userConfig.enableTargetUser && allTargetUsers.length > 0) {
            const unsentUsers = allTargetUsers.filter(user => !sentUsersToday.includes(user));
            if (unsentUsers.length === 0) {
                addHistoryLog('所有目标用户今日都已发送', 'info');
                return;
            }
        } else {
            const lastSentDate = GM_getValue('lastSentDate', '');
            const today = new Date().toDateString();
            if (lastSentDate === today) {
                addHistoryLog('今天已经发送过消息', 'info');
                return;
            }
        }

        isProcessing = true;
        retryCount = 0;
        currentState = 'idle';
        updateRetryCount();
        addHistoryLog('开始发送流程...', 'info');

        executeSendProcess();
    }

    // 执行发送流程
    async function executeSendProcess() {
        retryCount++;
        updateRetryCount();
        
        if (retryCount > userConfig.maxRetryCount) {
            addHistoryLog(`已达到最大重试次数 (${userConfig.maxRetryCount})`, 'error');
            isProcessing = false;
            currentState = 'idle';
            stopChatObserver();
            currentRetryUser = null;
            return;
        }

        addHistoryLog(`尝试发送 (${retryCount}/${userConfig.maxRetryCount})`, 'info');

        if (userConfig.enableTargetUser && allTargetUsers.length > 0) {
            currentState = 'searching';
            
            const searchTimeoutId = setTimeout(() => {
                if (currentState === 'searching') {
                    addHistoryLog('用户查找超时', 'error');
                    updateUserStatus('查找超时', false);
                    stopChatObserver();
                    setTimeout(executeSendProcess, 2000);
                }
            }, userConfig.userSearchTimeout);

            initChatObserver();
            
            const found = findAndClickTargetUser();
            
            if (!found) {
                // 用户查找失败，观察器会继续工作
            }
        } else {
            setTimeout(tryFindChatInput, 1000);
        }
    }

    // 尝试查找聊天输入框并发送消息
    let chatInputRetryCount = 0;
    async function tryFindChatInput() {
        if (chatInputCheckTimer) {
            clearTimeout(chatInputCheckTimer);
        }

        const input = document.querySelector('.chat-input-dccKiL');
        if (input) {
            chatInputRetryCount = 0;
            addHistoryLog('找到聊天输入框', 'info');
            
            let messageToSend;
            try {
                messageToSend = await getMessageContent();
                addHistoryLog('消息内容准备完成', 'success');
            } catch (error) {
                addHistoryLog(`消息获取失败: ${error.message}`, 'error');
                messageToSend = `${userConfig.baseMessage} | 消息获取失败~`;
            }

            currentState = 'sending';
            input.textContent = '';
            input.focus();
           
            const lines = messageToSend.split('\n');
            for (let i = 0; i < lines.length; i++) {
                document.execCommand('insertText', false, lines[i]);
                if (i < lines.length - 1) {
                    document.execCommand('insertLineBreak');
                }
            }
           
            input.dispatchEvent(new Event('input', { bubbles: true }));
            
            setTimeout(() => {
                const sendBtn = document.querySelector('.chat-btn');
                if (sendBtn && !sendBtn.disabled) {
                    addHistoryLog('正在发送消息...', 'info');
                    sendBtn.click();
                    
                    setTimeout(() => {
                        addHistoryLog('消息发送成功！', 'success');
                        
                        // 更新火花天数（按天增加，不是按发送次数）
                        const today = new Date().toDateString();
                        const lastFireDate = GM_getValue('lastFireDate', '');
                        
                        if (lastFireDate !== today) {
                            // 新的一天，增加天数
                            userConfig.fireDays++;
                            GM_setValue('fireDays', userConfig.fireDays);
                            GM_setValue('lastFireDate', today);
                            addHistoryLog(`火花天数已更新为: ${userConfig.fireDays}`, 'success');
                        } else {
                            // 同一天，不增加天数
                            addHistoryLog('今天已发送过，火花天数不变', 'info');
                        }
                        
                        updateFireDaysStatus();
                        
                        if (userConfig.enableTargetUser && allTargetUsers.length > 0) {
                            const currentTargetUser = GM_getValue('lastTargetUser', '');
                            if (currentTargetUser) {
                                markUserAsSent(currentTargetUser);
                            }
                        } else {
                            const today = new Date().toDateString();
                            GM_setValue('lastSentDate', today);
                            updateUserStatusDisplay();
                        }
                        
                        updateStatus(true);
                        isProcessing = false;
                        currentState = 'idle';
                        stopChatObserver();
                        currentRetryUser = null;
                        
                        if (userConfig.enableTargetUser && allTargetUsers.length > 0) {
                            const unsentUsers = allTargetUsers.filter(user => !sentUsersToday.includes(user));
                            if (unsentUsers.length > 0) {
                                addHistoryLog(`还有 ${unsentUsers.length} 个用户待发送，继续下一个用户`, 'info');
                                setTimeout(sendMessage, 2000);
                            } else {
                                addHistoryLog('所有用户发送完成！', 'success');
                            }
                        }
                        
                        if (typeof GM_notification !== 'undefined') {
                            try {
                                GM_notification({
                                    title: '抖音续火助手',
                                    text: '续火消息发送成功！',
                                    timeout: 3000
                                });
                            } catch (e) {
                                GM_notification('续火消息发送成功！', '抖音续火助手');
                            }
                        }
                    }, 1000);
                } else {
                    addHistoryLog('发送按钮不可用', 'error');
                    setTimeout(executeSendProcess, 2000);
                }
            }, 500);
        } else {
            chatInputRetryCount++;
            addHistoryLog(`未找到输入框，继续查找中... (${chatInputRetryCount}/${userConfig.maxRetryCount})`, 'info');
            
            if (chatInputRetryCount >= userConfig.maxRetryCount) {
                addHistoryLog(`查找聊天输入框超过最大重试次数 (${userConfig.maxRetryCount})，触发重试流程`, 'error');
                chatInputRetryCount = 0;
                setTimeout(executeSendProcess, 2000);
                return;
            }
            
            chatInputCheckTimer = setTimeout(() => {
                tryFindChatInput();
            }, userConfig.chatInputCheckInterval);
        }
    }

    // 获取消息内容
    async function getMessageContent() {
        let customMessage = userConfig.customMessage || userConfig.baseMessage;
        
        let hitokotoContent = '';
        if (userConfig.useHitokoto) {
            try {
                addHistoryLog('正在获取一言内容...', 'info');
                hitokotoContent = await getHitokoto();
                addHistoryLog('一言内容获取成功', 'success');
            } catch (error) {
                addHistoryLog(`一言获取失败: ${error.message}`, 'error');
                hitokotoContent = '一言获取失败~';
            }
        }
        
        let txtApiContent = '';
        if (userConfig.useTxtApi) {
            try {
                addHistoryLog('正在获取TXTAPI内容...', 'info');
                txtApiContent = await getTxtApiContent();
                addHistoryLog('TXTAPI内容获取成功', 'success');
            } catch (error) {
                addHistoryLog(`TXTAPI获取失败: ${error.message}`, 'error');
                txtApiContent = 'TXTAPI获取失败~';
            }
        }
        
        let specialHitokotoContent = '';
        if (userConfig.useSpecialHitokoto) {
            try {
                addHistoryLog('正在获取专属一言内容...', 'info');
                specialHitokotoContent = await getSpecialHitokoto();
                addHistoryLog('专属一言内容获取成功', 'success');
            } catch (error) {
                addHistoryLog(`专属一言获取失败: ${error.message}`, 'error');
                specialHitokotoContent = '专属一言获取失败~';
            }
        }
        
        // 替换占位符
        if (customMessage.includes('[API]')) {
            customMessage = customMessage.replace('[API]', hitokotoContent);
        } else if (userConfig.useHitokoto) {
            customMessage += ` | ${hitokotoContent}`;
        }
        
        if (customMessage.includes('[TXTAPI]')) {
            customMessage = customMessage.replace('[TXTAPI]', txtApiContent);
        } else if (userConfig.useTxtApi) {
            customMessage += ` | ${txtApiContent}`;
        }
        
        if (customMessage.includes('[专属一言]')) {
            customMessage = customMessage.replace('[专属一言]', specialHitokotoContent);
        } else if (userConfig.useSpecialHitokoto) {
            customMessage += ` | ${specialHitokotoContent}`;
        }
        
        if (customMessage.includes('[天数]')) {
            customMessage = customMessage.replace('[天数]', userConfig.fireDays || 1);
        }
        
        return customMessage;
    }

    // 获取一言内容
    function getHitokoto() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('一言API请求超时'));
            }, userConfig.hitokotoTimeout);
            
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://v1.hitokoto.cn/',
                responseType: 'json',
                onload: function(response) {
                    clearTimeout(timeout);
                    if (response.status === 200) {
                        try {
                            const data = response.response;
                            let message = formatHitokoto(userConfig.hitokotoFormat, data);
                                
                            updateHitokotoStatus('获取成功');
                            resolve(message);
                        } catch (e) {
                            updateHitokotoStatus('解析失败', false);
                            reject(new Error('一言API响应解析失败'));
                        }
                    } else {
                        updateHitokotoStatus('请求失败', false);
                        reject(new Error(`一言API请求失败: ${response.status}`));
                    }
                },
                onerror: function(error) {
                    clearTimeout(timeout);
                    updateHitokotoStatus('网络错误', false);
                    reject(new Error('一言API网络错误'));
                },
                ontimeout: function() {
                    clearTimeout(timeout);
                    updateHitokotoStatus('请求超时', false);
                    reject(new Error('一言API请求超时'));
                }
            });
        });
    }

    // 格式化一言内容
    function formatHitokoto(format, data) {
        let result = format.replace(/{hitokoto}/g, data.hitokoto || '');
        
        let fromFormatted = '';
        if (data.from) {
            fromFormatted = userConfig.fromFormat.replace(/{from}/g, data.from);
        }
        result = result.replace(/{from}/g, fromFormatted);
        
        let fromWhoFormatted = '';
        if (data.from_who) {
            fromWhoFormatted = userConfig.fromWhoFormat.replace(/{from_who}/g, data.from_who);
        }
        result = result.replace(/{from_who}/g, fromWhoFormatted);
        
        return result;
    }

    // 获取专属一言内容
    function getSpecialHitokoto() {
        return new Promise((resolve, reject) => {
            try {
                const now = new Date();
                const dayOfWeek = now.getDay(); // 0=周日, 1=周一, ..., 6=周六
                
                // 转换为我们的键名
                const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                const currentDayKey = dayKeys[dayOfWeek];
                const dayName = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dayOfWeek];
                
                // 获取对应日期的文本
                const text = userConfig[`specialHitokoto${currentDayKey.charAt(0).toUpperCase() + currentDayKey.slice(1)}`] || '';
                const lines = text.split('\n').filter(line => line.trim());
                
                if (lines.length === 0) {
                    updateSpecialHitokotoStatus(`${dayName}无内容`, false);
                    resolve(`${dayName}暂无专属一言`);
                    return;
                }
                
                // 获取该日期的发送记录
                const sentIndexes = specialHitokotoSentIndexes[currentDayKey] || [];
                
                let selectedIndex;
                let selectedText;
                
                if (userConfig.specialHitokotoRandom) {
                    // 随机模式
                    let availableIndexes = [];
                    for (let i = 0; i < lines.length; i++) {
                        if (!sentIndexes.includes(i)) {
                            availableIndexes.push(i);
                        }
                    }
                    
                    if (availableIndexes.length === 0) {
                        // 所有都发送过了，重置
                        specialHitokotoSentIndexes[currentDayKey] = [];
                        sentIndexes.length = 0;
                        availableIndexes = Array.from({length: lines.length}, (_, i) => i);
                    }
                    
                    const randomIndex = Math.floor(Math.random() * availableIndexes.length);
                    selectedIndex = availableIndexes[randomIndex];
                    selectedText = lines[selectedIndex].trim();
                    
                    // 记录发送
                    specialHitokotoSentIndexes[currentDayKey].push(selectedIndex);
                    GM_setValue('specialHitokotoSentIndexes', specialHitokotoSentIndexes);
                } else {
                    // 顺序模式
                    let nextIndex = 0;
                    if (sentIndexes.length > 0) {
                        nextIndex = (sentIndexes[sentIndexes.length - 1] + 1) % lines.length;
                    }
                    
                    selectedIndex = nextIndex;
                    selectedText = lines[selectedIndex].trim();
                    
                    // 记录发送
                    specialHitokotoSentIndexes[currentDayKey].push(selectedIndex);
                    GM_setValue('specialHitokotoSentIndexes', specialHitokotoSentIndexes);
                }
                
                updateSpecialHitokotoStatus(`${dayName}获取成功`);
                resolve(`${dayName}专属: ${selectedText}`);
            } catch (error) {
                updateSpecialHitokotoStatus('获取失败', false);
                reject(new Error(`专属一言获取失败: ${error.message}`));
            }
        });
    }

    // 获取TXTAPI内容
    function getTxtApiContent() {
        return new Promise((resolve, reject) => {
            if (userConfig.txtApiMode === 'api') {
                const timeout = setTimeout(() => {
                    reject(new Error('TXTAPI请求超时'));
                }, userConfig.txtApiTimeout);
                
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: userConfig.txtApiUrl,
                    onload: function(response) {
                        clearTimeout(timeout);
                        if (response.status === 200) {
                            try {
                                updateTxtApiStatus('获取成功');
                                resolve(response.responseText.trim());
                            } catch (e) {
                                updateTxtApiStatus('解析失败', false);
                                reject(new Error('TXTAPI响应解析失败'));
                            }
                        } else {
                            updateTxtApiStatus('请求失败', false);
                            reject(new Error(`TXTAPI请求失败: ${response.status}`));
                        }
                    },
                    onerror: function(error) {
                        clearTimeout(timeout);
                        updateTxtApiStatus('网络错误', false);
                        reject(new Error('TXTAPI网络错误'));
                    },
                    ontimeout: function() {
                        clearTimeout(timeout);
                        updateTxtApiStatus('请求超时', false);
                        reject(new Error('TXTAPI请求超时'));
                    }
                });
            } else {
                try {
                    const lines = userConfig.txtApiManualText.split('\n').filter(line => line.trim());
                    if (lines.length === 0) {
                        updateTxtApiStatus('无内容', false);
                        reject(new Error('手动文本内容为空'));
                        return;
                    }
                    
                    let sentIndexes = GM_getValue('txtApiManualSentIndexes', []);
                    
                    if (userConfig.txtApiManualRandom) {
                        let availableIndexes = [];
                        for (let i = 0; i < lines.length; i++) {
                            if (!sentIndexes.includes(i)) {
                                availableIndexes.push(i);
                            }
                        }
                        
                        if (availableIndexes.length === 0) {
                            sentIndexes = [];
                            availableIndexes = Array.from({length: lines.length}, (_, i) => i);
                            GM_setValue('txtApiManualSentIndexes', []);
                        }
                        
                        const randomIndex = Math.floor(Math.random() * availableIndexes.length);
                        const selectedIndex = availableIndexes[randomIndex];
                        const selectedText = lines[selectedIndex].trim();
                        
                        sentIndexes.push(selectedIndex);
                        GM_setValue('txtApiManualSentIndexes', sentIndexes);
                        
                        updateTxtApiStatus('获取成功');
                        resolve(selectedText);
                    } else {
                        let nextIndex = 0;
                        if (sentIndexes.length > 0) {
                            nextIndex = (sentIndexes[sentIndexes.length - 1] + 1) % lines.length;
                        }
                        
                        const selectedText = lines[nextIndex].trim();
                        
                        sentIndexes.push(nextIndex);
                        GM_setValue('txtApiManualSentIndexes', sentIndexes);
                        
                        updateTxtApiStatus('获取成功');
                        resolve(selectedText);
                    }
                } catch (e) {
                    updateTxtApiStatus('解析失败', false);
                    reject(new Error('手动文本解析失败'));
                }
            }
        });
    }

    // 解析时间字符串为日期对象
    function parseTimeString(timeStr) {
        const [hours, minutes, seconds] = timeStr.split(':').map(Number);
        const now = new Date();
        const targetTime = new Date(now);
        targetTime.setHours(hours, minutes, seconds || 0, 0);
       
        if (targetTime <= now) {
            targetTime.setDate(targetTime.getDate() + 1);
        }
       
        return targetTime;
    }

    // 解析随机时间字符串
    function parseRandomTimeString() {
        if (!userConfig.sendTimeRandom) {
            return parseTimeString(userConfig.sendTime);
        }
        
        const now = new Date();
        
        // 解析时间范围
        const [startHour, startMinute, startSecond] = userConfig.sendTimeRangeStart.split(':').map(Number);
        const [endHour, endMinute, endSecond] = userConfig.sendTimeRangeEnd.split(':').map(Number);
        
        // 转换为分钟数
        const startMinutes = startHour * 60 + startMinute;
        const endMinutes = endHour * 60 + endMinute;
        
        let randomMinutes;
        
        // 处理跨天情况
        if (endMinutes > startMinutes) {
            randomMinutes = startMinutes + Math.floor(Math.random() * (endMinutes - startMinutes));
        } else {
            // 跨天情况
            randomMinutes = startMinutes + Math.floor(Math.random() * (1440 - startMinutes + endMinutes));
        }
        
        // 转换回小时和分钟
        const randomHour = Math.floor(randomMinutes / 60) % 24;
        const randomMinute = randomMinutes % 60;
        
        const targetTime = new Date(now);
        targetTime.setHours(randomHour, randomMinute, startSecond || 0, 0);
        
        // 如果随机时间已经过去，就安排到明天
        if (targetTime <= now) {
            targetTime.setDate(targetTime.getDate() + 1);
        }
        
        return targetTime;
    }

    // 更新状态
    function updateStatus(status) {
    const statusEl = document.getElementById('dy-fire-status');
    if (statusEl) {
        statusEl.textContent = '未发送';
        statusEl.style.color = '#dc3545';
    }
    
    retryCount = 0;
    updateRetryCount();
    updateHitokotoStatus('未获取');
    updateTxtApiStatus('未获取');
    updateSpecialHitokotoStatus('未获取');
    updateFireDaysStatus();
    updateUserStatusDisplay();
    stopChatObserver();
    
    if (chatInputCheckTimer) {
        clearTimeout(chatInputCheckTimer);
        chatInputCheckTimer = null;
    }
       
        const now = new Date();
       
        if (status === true) {
            nextSendTime = parseRandomTimeString();
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            if (nextSendTime.getDate() !== tomorrow.getDate()) {
                nextSendTime.setDate(tomorrow.getDate());
            }
        } else if (status === false) {
            nextSendTime = parseRandomTimeString();
            if (nextSendTime <= now) {
                nextSendTime.setDate(nextSendTime.getDate() + 1);
            }
        }
       
        const nextEl = document.getElementById('dy-fire-next');
        if (nextEl) {
            nextEl.textContent = nextSendTime.toLocaleString();
        }
        
        if (status !== 'sending') {
            startCountdown(nextSendTime);
        }
    }

    // 检查是否需要为新的一天重置记录
    function checkIfShouldResetForNewDay() {
        const today = new Date().toDateString();
        const lastResetDate = GM_getValue('lastResetDate', '');
        
        if (lastResetDate !== today) {
            return true;
        }
        
        if (sentUsersToday.length > 0) {
            const firstSendTime = GM_getValue('firstSendTimeToday', 0);
            if (firstSendTime > 0) {
                const firstSendDate = new Date(firstSendTime).toDateString();
                if (firstSendDate !== today) {
                    return true;
                }
            }
        }
        
        return false;
    }

    // 检查是否需要自动发送
    function autoSendIfNeeded() {
        const now = new Date();
        const today = new Date().toDateString();
       
        if (userConfig.enableTargetUser && allTargetUsers.length > 0) {
            // 检查是否需要为新的一天重置记录
            const shouldResetForNewDay = checkIfShouldResetForNewDay();
            
            if (shouldResetForNewDay) {
                addHistoryLog('新的一天开始，重置今日发送记录', 'info');
                resetTodaySentUsers();
            }
            
            const unsentUsers = allTargetUsers.filter(user => !sentUsersToday.includes(user));
            if (unsentUsers.length > 0 && !isProcessing) {
                // 获取今天的目标时间
                let targetTimeToday;
                if (userConfig.sendTimeRandom) {
                    // 对于随机时间，我们检查是否在时间范围内
                    const [startHour, startMinute] = userConfig.sendTimeRangeStart.split(':').map(Number);
                    const [endHour, endMinute] = userConfig.sendTimeRangeEnd.split(':').map(Number);
                    
                    const nowMinutes = now.getHours() * 60 + now.getMinutes();
                    const startMinutes = startHour * 60 + startMinute;
                    const endMinutes = endHour * 60 + endMinute;
                    
                    // 检查是否在时间范围内
                    let isInRange = false;
                    if (endMinutes > startMinutes) {
                        // 不跨天
                        isInRange = nowMinutes >= startMinutes && nowMinutes <= endMinutes;
                    } else {
                        // 跨天
                        isInRange = nowMinutes >= startMinutes || nowMinutes <= endMinutes;
                    }
                    
                    if (isInRange) {
                        addHistoryLog(`检测到有${unsentUsers.length}个用户未发送且在随机时间范围内(${userConfig.sendTimeRangeStart}-${userConfig.sendTimeRangeEnd})，自动发送`, 'info');
                        sendMessage();
                    }
                } else {
                    const [targetHour, targetMinute, targetSecond] = userConfig.sendTime.split(':').map(Number);
                    const targetTimeToday = new Date();
                    targetTimeToday.setHours(targetHour, targetMinute, targetSecond || 0, 0);
                   
                    if (now >= targetTimeToday) {
                        addHistoryLog(`检测到有${unsentUsers.length}个用户未发送且已过${userConfig.sendTime}，自动发送`, 'info');
                        sendMessage();
                    }
                }
            }
        } else {
            const lastSentDate = GM_getValue('lastSentDate', '');
            
            if (lastSentDate !== today) {
                if (userConfig.sendTimeRandom) {
                    // 对于随机时间，我们检查是否在时间范围内
                    const [startHour, startMinute] = userConfig.sendTimeRangeStart.split(':').map(Number);
                    const [endHour, endMinute] = userConfig.sendTimeRangeEnd.split(':').map(Number);
                    
                    const nowMinutes = now.getHours() * 60 + now.getMinutes();
                    const startMinutes = startHour * 60 + startMinute;
                    const endMinutes = endHour * 60 + endMinute;
                    
                    // 检查是否在时间范围内
                    let isInRange = false;
                    if (endMinutes > startMinutes) {
                        // 不跨天
                        isInRange = nowMinutes >= startMinutes && nowMinutes <= endMinutes;
                    } else {
                        // 跨天
                        isInRange = nowMinutes >= startMinutes || nowMinutes <= endMinutes;
                    }
                    
                    if (isInRange && !isProcessing) {
                        addHistoryLog(`检测到今日未发送且在随机时间范围内(${userConfig.sendTimeRangeStart}-${userConfig.sendTimeRangeEnd})，自动发送`, 'info');
                        sendMessage();
                    }
                } else {
                    const [targetHour, targetMinute, targetSecond] = userConfig.sendTime.split(':').map(Number);
                    const targetTimeToday = new Date();
                    targetTimeToday.setHours(targetHour, targetMinute, targetSecond || 0, 0);
                   
                    if (now >= targetTimeToday && !isProcessing) {
                        addHistoryLog(`检测到今日未发送且已过${userConfig.sendTime}，自动发送`, 'info');
                        sendMessage();
                    }
                }
            }
        }
    }

    // 开始倒计时
    function startCountdown(targetTime) {
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }
       
        function update() {
            const now = new Date();
            const diff = targetTime - now;
           
            if (diff <= 0) {
                const countdownEl = document.getElementById('dy-fire-countdown');
                if (countdownEl) {
                    countdownEl.textContent = '00:00:00';
                }
               
                updateStatus('sending');
                
                if (userConfig.enableTargetUser && allTargetUsers.length > 0) {
                    // 检查是否需要为新的一天重置记录
                    const shouldResetForNewDay = checkIfShouldResetForNewDay();
                    if (shouldResetForNewDay) {
                        addHistoryLog('新的一天开始，重置今日发送记录', 'info');
                        resetTodaySentUsers();
                    }
                    
                    const unsentUsers = allTargetUsers.filter(user => !sentUsersToday.includes(user));
                    if (unsentUsers.length > 0) {
                        if (!isProcessing) {
                            addHistoryLog('倒计时结束，开始发送给未发送的用户', 'info');
                            sendMessage();
                        }
                    } else {
                        // 所有用户已完成，记录重置日期
                        GM_setValue('lastResetDate', new Date().toDateString());
                        nextSendTime = parseRandomTimeString();
                        const tomorrow = new Date(now);
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        if (nextSendTime.getDate() !== tomorrow.getDate()) {
                            nextSendTime.setDate(nextSendTime.getDate() + 1);
                        }
                        startCountdown(nextSendTime);
                        updateStatus(true);
                    }
                } else {
                    const lastSentDate = GM_getValue('lastSentDate', '');
                    const today = new Date().toDateString();
                   
                    if (lastSentDate === today) {
                        nextSendTime = parseRandomTimeString();
                        const tomorrow = new Date(now);
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        if (nextSendTime.getDate() !== tomorrow.getDate()) {
                            nextSendTime.setDate(tomorrow.getDate());
                        }
                        startCountdown(nextSendTime);
                        updateStatus(true);
                    } else {
                        if (!isProcessing) {
                            GM_setValue('lastSentDate', '');
                            updateStatus(false);
                            addHistoryLog('已清空发送记录，准备发送新消息', 'info');
                            sendMessage();
                        }
                    }
                }
                return;
            }
           
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
           
            const countdownEl = document.getElementById('dy-fire-countdown');
            if (countdownEl) {
                countdownEl.textContent =
                    `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }
       
        update();
        countdownInterval = setInterval(update, 1000);
    }

    // 清空数据
    function clearData() {
        GM_setValue('lastSentDate', '');
        GM_setValue('txtApiManualSentIndexes', []);
        GM_setValue('lastTargetUser', '');
        GM_setValue('specialHitokotoSentIndexes', specialHitokotoSentIndexes);
        resetTodaySentUsers();
        currentRetryUser = null;
        isProcessing = false;
        currentState = 'idle';
        addHistoryLog('发送记录已清空', 'info');
    const statusEl = document.getElementById('dy-fire-status');
    if (statusEl) {
        statusEl.textContent = '未发送';
        statusEl.style.color = '#dc3545';
    }
    
    retryCount = 0;
    updateRetryCount();
    updateHitokotoStatus('未获取');
    updateTxtApiStatus('未获取');
    updateSpecialHitokotoStatus('未获取');
    updateUserStatusDisplay();
    stopChatObserver();
    
    if (chatInputCheckTimer) {
        clearTimeout(chatInputCheckTimer);
        chatInputCheckTimer = null;
    }
    
    // 重新计算下次发送时间并开始倒计时
    nextSendTime = parseRandomTimeString();
    const now = new Date();
    if (nextSendTime <= now) {
        nextSendTime.setDate(nextSendTime.getDate() + 1);
    }
    
    const nextEl = document.getElementById('dy-fire-next');
    if (nextEl) {
        nextEl.textContent = nextSendTime.toLocaleString();
    }
    
    startCountdown(nextSendTime);
    
    // 触发自动发送检查
    setTimeout(() => {
        autoSendIfNeeded();
    }, 1000);
    
    addHistoryLog('状态已重置，将重新检查是否需要自动发送', 'info');
}

    // 重置所有配置
    function resetAllConfig() {
        if (typeof GM_listValues !== 'undefined' && typeof GM_deleteValue !== 'undefined') {
            try {
                const values = GM_listValues();
                values.forEach(key => {
                    GM_deleteValue(key);
                });
            } catch (e) {
                GM_setValue('lastSentDate', '');
                GM_setValue('userConfig', '');
                GM_setValue('txtApiManualSentIndexes', []);
                GM_setValue('historyLogs', []);
                GM_setValue('sentUsersToday', []);
                GM_setValue('currentUserIndex', -1);
                GM_setValue('lastTargetUser', '');
                GM_setValue('lastResetDate', '');
                GM_setValue('fireDays', 1);
                GM_setValue('lastFireDate', '');
                GM_setValue('specialHitokotoSentIndexes', specialHitokotoSentIndexes);
            }
        } else {
            GM_setValue('lastSentDate', '');
            GM_setValue('userConfig', '');
            GM_setValue('txtApiManualSentIndexes', []);
            GM_setValue('historyLogs', []);
            GM_setValue('sentUsersToday', []);
            GM_setValue('currentUserIndex', -1);
            GM_setValue('lastTargetUser', '');
            GM_setValue('lastResetDate', '');
            GM_setValue('fireDays', 1);
            GM_setValue('lastFireDate', '');
            GM_setValue('specialHitokotoSentIndexes', specialHitokotoSentIndexes);
        }
       
        initConfig();
        currentRetryUser = null;
        isProcessing = false;
        currentState = 'idle';
        addHistoryLog('所有配置已重置', 'info');
        updateStatus(false);
        retryCount = 0;
        updateRetryCount();
        updateHitokotoStatus('未获取');
        updateTxtApiStatus('未获取');
        updateSpecialHitokotoStatus('未获取');
        updateFireDaysStatus();
        updateUserStatusDisplay();
        stopChatObserver();
        if (chatInputCheckTimer) {
            clearTimeout(chatInputCheckTimer);
        }
       
        if (typeof GM_notification !== 'undefined') {
            try {
                GM_notification({
                    title: '抖音续火助手',
                    text: '所有配置已重置！',
                    timeout: 3000
                });
            } catch (e) {
                GM_notification('所有配置已重置！', '抖音续火助手');
            }
        }
    }

    // ==================== UI相关函数 ====================

    // 更新用户状态显示
    function updateUserStatusDisplay() {
        const statusEl = document.getElementById('dy-fire-user-status');
        const progressEl = document.getElementById('dy-fire-user-progress');
        
        if (!statusEl || !progressEl) return;
        
        if (!userConfig.enableTargetUser || allTargetUsers.length === 0) {
            const lastSentDate = GM_getValue('lastSentDate', '');
            const today = new Date().toDateString();
            const isSentToday = lastSentDate === today;
            const progressText = isSentToday ? '1/1' : '0/1';
            
            progressEl.textContent = progressText;
            
            if (isSentToday) {
                statusEl.textContent = '已完成';
                statusEl.style.color = '#00d8b8';
            } else {
                statusEl.textContent = '未开始';
                statusEl.style.color = '#999';
            }
            return;
        }
        
        const sentCount = sentUsersToday.length;
        const totalCount = allTargetUsers.length;
        const progressText = `${sentCount}/${totalCount}`;
        
        progressEl.textContent = progressText;
        
        if (sentCount >= totalCount) {
            statusEl.textContent = '全部完成';
            statusEl.style.color = '#00d8b8';
        } else {
            statusEl.textContent = `进行中 ${progressText}`;
            statusEl.style.color = '#ff2c54';
        }
    }

    // 重置今日发送记录
    function resetTodaySentUsers() {
        sentUsersToday = [];
        GM_setValue('sentUsersToday', []);
        currentUserIndex = -1;
        GM_setValue('currentUserIndex', -1);
        GM_setValue('lastSentDate', '');
        currentRetryUser = null;
        
        // 记录重置日期
        const today = new Date().toDateString();
        GM_setValue('lastResetDate', today);
        
        addHistoryLog('今日发送记录已重置', 'info');
        updateUserStatusDisplay();
    }

    // 更新用户状态显示
    function updateUserStatus(status, isSuccess = null) {
        const statusEl = document.getElementById('dy-fire-user-status');
        if (!statusEl) return;
        
        if (status) {
            statusEl.textContent = status;
        }
        
        if (isSuccess === true) {
            statusEl.style.color = '#00d8b8';
        } else if (isSuccess === false) {
            statusEl.style.color = '#ff2c54';
        } else {
            statusEl.style.color = '#999';
        }
    }

    // 解析当前聊天列表的用户（排除已添加的用户）
    function parseCurrentChatUsers() {
        const userElements = document.querySelectorAll('.item-header-name-vL_79m');
        const users = [];
        
        userElements.forEach(element => {
            const username = element.textContent.trim();
            if (username && !users.includes(username)) {
                // 排除已经添加的用户
                if (!allTargetUsers.includes(username)) {
                    users.push(username);
                }
            }
        });
        
        return users;
    }

    // 显示用户选择面板
    function showUserSelectPanel() {
        const existingPanel = document.getElementById('dy-fire-user-select-panel');
        if (existingPanel) {
            existingPanel.remove();
            return;
        }

        const currentUsers = parseCurrentChatUsers();
        
        if (currentUsers.length === 0) {
            addHistoryLog('未找到聊天列表中的新用户（已添加的用户已过滤）', 'warn');
            return;
        }

        const userSelectPanel = document.createElement('div');
        userSelectPanel.id = 'dy-fire-user-select-panel';
        userSelectPanel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            max-width: 90vw;
            width: 500px;
            max-height: 80vh;
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            z-index: 10000;
            padding: 0;
            font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
            overflow: hidden;
            box-sizing: border-box;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1);
        `;

        const userCheckboxes = currentUsers.map(user => `
            <div style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <label style="display: flex; align-items: center; cursor: pointer;">
                    <input type="checkbox" class="user-checkbox" value="${user}" style="margin-right: 10px;">
                    <span style="color: #fff; font-size: 14px;">${user}</span>
                </label>
            </div>
        `).join('');

        userSelectPanel.innerHTML = `
            <div id="dy-fire-user-select-header" style="padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); cursor: move;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; color: #fff; font-size: 18px; font-weight: 600;">
                        👥 选择用户 (${currentUsers.length})
                    </h3>
                    <button id="dy-fire-user-select-close" style="background: rgba(255,255,255,0.1); border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; color: #fff; font-size: 18px; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;">×</button>
                </div>
                <div style="font-size: 12px; color: #999; margin-top: 5px;">已添加的用户不显示在此列表中</div>
            </div>
            
            <div style="padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                    <button id="dy-fire-select-all" style="padding: 8px 16px; background: rgba(0, 216, 184, 0.2); color: #00d8b8; border: 1px solid rgba(0, 216, 184, 0.3); border-radius: 8px; cursor: pointer; font-weight: 500; font-size: 13px; transition: all 0.2s ease;">
                        全选
                    </button>
                    <button id="dy-fire-deselect-all" style="padding: 8px 16px; background: rgba(255, 44, 84, 0.2); color: #ff2c54; border: 1px solid rgba(255, 44, 84, 0.3); border-radius: 8px; cursor: pointer; font-weight: 500; font-size: 13px; transition: all 0.2s ease;">
                        取消全选
                    </button>
                </div>
                
                <div style="height: 300px; overflow-y: auto; background: rgba(0,0,0,0.2); border-radius: 8px; padding: 10px;">
                    ${userCheckboxes}
                </div>
            </div>
            
            <div style="padding: 20px; border-top: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2);">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <button id="dy-fire-user-select-add" style="padding: 12px; background: linear-gradient(135deg, #00d8b8 0%, #00b8a8 100%); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.2s ease;">
                        ✅ 添加到目标用户
                    </button>
                    <button id="dy-fire-user-select-cancel" style="padding: 12px; background: linear-gradient(135deg, #ff2c54 0%, #ff6b8b 100%); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.2s ease;">
                        ❌ 取消
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(userSelectPanel);

        addDragFunctionality(userSelectPanel, 'dy-fire-user-select-header');

        const selectAllBtn = document.getElementById('dy-fire-select-all');
        const deselectAllBtn = document.getElementById('dy-fire-deselect-all');
        const addBtn = document.getElementById('dy-fire-user-select-add');
        const cancelBtn = document.getElementById('dy-fire-user-select-cancel');
        const closeBtn = document.getElementById('dy-fire-user-select-close');

        // 全选
        selectAllBtn.addEventListener('click', function() {
            const checkboxes = userSelectPanel.querySelectorAll('.user-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = true;
            });
        });

        // 取消全选
        deselectAllBtn.addEventListener('click', function() {
            const checkboxes = userSelectPanel.querySelectorAll('.user-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
        });

        // 添加到目标用户
        addBtn.addEventListener('click', function() {
            const checkboxes = userSelectPanel.querySelectorAll('.user-checkbox:checked');
            const selectedUsers = Array.from(checkboxes).map(cb => cb.value);
            
            if (selectedUsers.length === 0) {
                addHistoryLog('未选择任何用户', 'warn');
                return;
            }
            
            // 获取现有目标用户
            let currentTargetUsers = [];
            if (userConfig.targetUsernames && userConfig.targetUsernames.trim()) {
                currentTargetUsers = userConfig.targetUsernames.split(/[,|\n]/)
                    .map(user => user.trim())
                    .filter(user => user.length > 0);
            }
            
            // 添加新用户（去重）
            let addedCount = 0;
            selectedUsers.forEach(user => {
                if (!currentTargetUsers.includes(user)) {
                    currentTargetUsers.push(user);
                    addedCount++;
                }
            });
            
            // 更新配置
            userConfig.targetUsernames = currentTargetUsers.join('\n');
            saveConfig();
            parseTargetUsers();
            updateUserStatusDisplay();
            
            addHistoryLog(`已添加 ${addedCount} 个用户到目标列表`, 'success');
            userSelectPanel.remove();
        });

        // 取消
        cancelBtn.addEventListener('click', function() {
            userSelectPanel.remove();
        });

        // 关闭
        closeBtn.addEventListener('click', function() {
            userSelectPanel.remove();
        });

        // 悬停效果
        [selectAllBtn, deselectAllBtn, addBtn, cancelBtn].forEach(btn => {
            btn.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-2px)';
            });
            btn.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0)';
            });
        });

        closeBtn.addEventListener('mouseenter', function() {
            this.style.background = 'rgba(255,255,255,0.2)';
            this.style.transform = 'scale(1.1)';
        });
        closeBtn.addEventListener('mouseleave', function() {
            this.style.background = 'rgba(255,255,255,0.1)';
            this.style.transform = 'scale(1)';
        });
    }

    // 修改火花天数
    function modifyFireDays() {
        const newDays = prompt('请输入新的火花天数:', userConfig.fireDays);
        if (newDays !== null) {
            const days = parseInt(newDays, 10);
            if (!isNaN(days) && days >= 0) {
                userConfig.fireDays = days;
                GM_setValue('fireDays', days);
                updateFireDaysStatus();
                addHistoryLog(`火花天数已修改为: ${days}`, 'success');
            } else {
                addHistoryLog('请输入有效的数字', 'error');
            }
        }
    }

    // 创建UI控制面板
    function createControlPanel() {
        const existingPanel = document.getElementById('dy-fire-helper');
        if (existingPanel) {
            existingPanel.remove();
        }

        const panel = document.createElement('div');
        panel.id = 'dy-fire-helper';
        panel.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 500px;
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1);
            z-index: 9999;
            font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
            padding: 0;
            color: #fff;
            transition: all 0.3s ease;
            max-height: 1000px;
            overflow: hidden;
            backdrop-filter: blur(10px);
            user-select: none;
        `;

        panel.innerHTML = `
            <div id="dy-fire-header" style="padding: 20px 20px 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); cursor: move;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin: 0; color: #fff; font-size: 18px; display: flex; align-items: center; font-weight: 600;">
                        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #ff2c54; margin-right: 10px; box-shadow: 0 0 8px #ff2c54;"></span>
                        🔥 抖音续火助手 ${isScriptCat ? '<span style="font-size: 12px; color: #00d8b8; margin-left: 8px;">(ScriptCat)</span>' : ''}
                    </h3>
                    <button id="dy-fire-helper-close" style="background: rgba(255,255,255,0.1); border: none; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; color: #fff; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;">×</button>
                </div>
               
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px;">
                    <div style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 8px;">
                        <div style="color: #999; margin-bottom: 4px;">今日状态</div>
                        <div id="dy-fire-status" style="color: #00d8b8; font-weight: 600; font-size: 13px;">已发送</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 8px;">
                        <div style="color: #999; margin-bottom: 4px;">用户状态</div>
                        <div id="dy-fire-user-status" style="color: #999; font-weight: 600; font-size: 13px;">未启用</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 8px;">
                        <div style="color: #999; margin-bottom: 4px;">发送进度</div>
                        <div id="dy-fire-user-progress" style="color: #ff2c54; font-weight: 600; font-size: 13px;"></div>
                    </div>
                    <div style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 8px;">
                        <div style="color: #999; margin-bottom: 4px;">重试次数</div>
                        <div id="dy-fire-retry" style="color: #fff; font-weight: 600; font-size: 13px;">0/${userConfig.maxRetryCount}</div>
                    </div>
                </div>
            </div>
           
            <div style="padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 12px;">
                    <div style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 8px;">
                        <div style="color: #999; font-size: 11px; margin-bottom: 2px;">下次发送</div>
                        <div id="dy-fire-next" style="color: #fff; font-size: 12px; font-weight: 500;">2023-11-05 00:01:00</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 8px;">
                        <div style="color: #999; font-size: 11px; margin-bottom: 2px;">倒计时</div>
                        <div id="dy-fire-countdown" style="color: #ff2c54; font-size: 12px; font-weight: 700;">23:45:12</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 8px;">
                        <div style="color: #999; font-size: 11px; margin-bottom: 2px;">火花天数</div>
                        <div id="dy-fire-days" style="color: #00d8b8; font-size: 12px; font-weight: 700;">${userConfig.fireDays}</div>
                    </div>
                </div>
               
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
                    <div style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 8px;">
                        <div style="color: #999; font-size: 11px; margin-bottom: 2px;">一言状态</div>
                        <div id="dy-fire-hitokoto" style="color: #00d8b8; font-size: 12px; font-weight: 500;">未获取</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 8px;">
                        <div style="color: #999; font-size: 11px; margin-bottom: 2px;">专属一言状态</div>
                        <div id="dy-fire-special-hitokoto" style="color: #00d8b8; font-size: 12px; font-weight: 500;">未获取</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 8px;">
                        <div style="color: #999; font-size: 11px; margin-bottom: 2px;">TXTAPI状态</div>
                        <div id="dy-fire-txtapi" style="color: #00d8b8; font-size: 12px; font-weight: 500;">未获取</div>
                    </div>
                </div>
            </div>
           
            <div style="padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                    <button id="dy-fire-send" style="padding: 12px; background: linear-gradient(135deg, #ff2c54 0%, #ff6b8b 100%); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.2s ease; box-shadow: 0 4px 12px rgba(255, 44, 84, 0.3);">
                        🚀 立即发送
                    </button>
                    <button id="dy-fire-reset-users" style="padding: 12px; background: rgba(111, 66, 193, 0.8); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.2s ease;">
                        🔄 重置记录
                    </button>
                </div>
               
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <button id="dy-fire-settings" style="padding: 10px; background: rgba(255,255,255,0.1); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500; font-size: 13px; transition: all 0.2s ease;">
                        ⚙️ 设置
                    </button>
                    <button id="dy-fire-history" style="padding: 10px; background: rgba(255,255,255,0.1); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500; font-size: 13px; transition: all 0.2s ease;">
                        📋 历史日志
                    </button>
                    <button id="dy-fire-modify-days" style="padding: 10px; background: rgba(255,255,255,0.1); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500; font-size: 13px; transition: all 0.2s ease;">
                        📅 修改天数
                    </button>
                    <button id="dy-fire-select-users" style="padding: 10px; background: rgba(255,255,255,0.1); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500; font-size: 13px; transition: all 0.2s ease;">
                        👥 选择用户
                    </button>
                    <button id="dy-fire-clear" style="padding: 10px; background: rgba(255,255,255,0.1); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500; font-size: 13px; transition: all 0.2s ease;">
                        🗑️ 清空记录
                    </button>
                    <button id="dy-fire-reset" style="padding: 10px; background: rgba(255,255,255,0.1); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500; font-size: 13px; transition: all 0.2s ease;">
                        🔧 重置配置
                    </button>
                </div>
            </div>
           
            <div style="padding: 15px 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div style="font-weight: 600; font-size: 14px;">操作日志</div>
                    <div style="font-size: 11px; color: #999;">实时更新</div>
                </div>
                <div id="dy-fire-log" style="font-size: 12px; height: 120px; overflow-y: auto; line-height: 1.4; background: rgba(0,0,0,0.3); border-radius: 8px; padding: 10px;">
                    <div style="color: #00d8b8; padding: 5px 0;">系统已就绪，等待执行...</div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        addButtonHoverEffects();
        addDragFunctionality(panel, 'dy-fire-header');
        createReopenButton();

        document.getElementById('dy-fire-helper-close').addEventListener('click', function() {
            panel.style.display = 'none';
            const reopenBtn = document.getElementById('dy-fire-reopen-btn');
            if (reopenBtn) {
                reopenBtn.style.display = 'flex';
            }
        });
        
        document.getElementById('dy-fire-send').addEventListener('click', sendMessage);
        document.getElementById('dy-fire-settings').addEventListener('click', showSettingsPanel);
        document.getElementById('dy-fire-history').addEventListener('click', showHistoryPanel);
        document.getElementById('dy-fire-modify-days').addEventListener('click', modifyFireDays);
        document.getElementById('dy-fire-select-users').addEventListener('click', showUserSelectPanel);
        document.getElementById('dy-fire-clear').addEventListener('click', clearData);
        document.getElementById('dy-fire-reset').addEventListener('click', resetAllConfig);
        document.getElementById('dy-fire-reset-users').addEventListener('click', resetTodaySentUsers);
        
        updateUserStatusDisplay();
        updateFireDaysStatus();
    }

    // 添加按钮悬停效果
    function addButtonHoverEffects() {
        const buttons = document.querySelectorAll('#dy-fire-helper button');
        buttons.forEach(button => {
            if (button.id !== 'dy-fire-helper-close') {
                button.addEventListener('mouseenter', function() {
                    this.style.transform = 'translateY(-2px)';
                    this.style.boxShadow = '0 6px 20px rgba(255, 44, 84, 0.4)';
                });
                
                button.addEventListener('mouseleave', function() {
                    this.style.transform = 'translateY(0)';
                    this.style.boxShadow = '';
                });
            }
        });

        const closeBtn = document.getElementById('dy-fire-helper-close');
        if (closeBtn) {
            closeBtn.addEventListener('mouseenter', function() {
                this.style.background = 'rgba(255,255,255,0.2)';
                this.style.transform = 'scale(1.1)';
            });
            
            closeBtn.addEventListener('mouseleave', function() {
                this.style.background = 'rgba(255,255,255,0.1)';
                this.style.transform = 'scale(1)';
            });
        }
    }

    // 添加拖动功能
    function addDragFunctionality(panel, headerSelector) {
        const header = typeof headerSelector === 'string' ? 
            document.getElementById(headerSelector) : headerSelector;
        
        if (!header) return;
        
        header.addEventListener('mousedown', function(e) {
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
                panel.style.right = 'auto';
            }
            
            panel.style.transition = 'none';
            document.body.style.userSelect = 'none';
            
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', function(e) {
            if (!isDragging || !currentPanel) return;
            
            const x = e.clientX - dragOffsetX;
            const y = e.clientY - dragOffsetY;
            
            const maxX = window.innerWidth - currentPanel.offsetWidth;
            const maxY = window.innerHeight - currentPanel.offsetHeight;
            
            currentPanel.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
            currentPanel.style.right = 'auto';
            currentPanel.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
        });
        
        document.addEventListener('mouseup', function() {
            if (isDragging) {
                isDragging = false;
                if (currentPanel) {
                    currentPanel.style.transition = 'all 0.3s ease';
                }
                currentPanel = null;
                document.body.style.userSelect = '';
            }
        });
    }

    // 创建重新打开面板的按钮
    function createReopenButton() {
        const existingBtn = document.getElementById('dy-fire-reopen-btn');
        if (existingBtn) {
            existingBtn.remove();
        }

        const reopenBtn = document.createElement('div');
        reopenBtn.id = 'dy-fire-reopen-btn';
        reopenBtn.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            background: linear-gradient(135deg, #ff2c54 0%, #ff6b8b 100%);
            border-radius: 50%;
            color: white;
            display: none;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            z-index: 9998;
            box-shadow: 0 6px 20px rgba(255, 44, 84, 0.4);
            font-size: 20px;
            font-weight: bold;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
            border: 2px solid rgba(255,255,255,0.2);
        `;
        reopenBtn.innerHTML = '🔥';
        reopenBtn.title = '打开续火助手面板';

        reopenBtn.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.1) rotate(10deg)';
            this.style.boxShadow = '0 8px 25px rgba(255, 44, 84, 0.6)';
        });
        
        reopenBtn.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1) rotate(0)';
            this.style.boxShadow = '0 6px 20px rgba(255, 44, 84, 0.4)';
        });

        reopenBtn.addEventListener('click', function() {
            const panel = document.getElementById('dy-fire-helper');
            if (panel) {
                panel.style.display = 'block';
                reopenBtn.style.display = 'none';
            } else {
                createControlPanel();
                reopenBtn.style.display = 'none';
            }
        });
        
        document.body.appendChild(reopenBtn);
    }

    // 显示历史日志面板
    function showHistoryPanel() {
        const existingPanel = document.getElementById('dy-fire-history-panel');
        if (existingPanel) {
            existingPanel.remove();
            return;
        }

        const historyPanel = document.createElement('div');
        historyPanel.id = 'dy-fire-history-panel';
        historyPanel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            max-width: 90vw;
            width: 800px;
            height: 600px;
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            z-index: 10000;
            padding: 0;
            font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1);
            overflow: hidden;
        `;

        const logs = getHistoryLogs();
        const logItems = logs.map(log => `
            <div style="padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s ease;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span style="font-size: 11px; color: #999;">
                        ${new Date(log.timestamp).toLocaleString()}
                    </span>
                    <span style="padding: 4px 8px; border-radius: 12px; font-size: 10px; font-weight: 600;
                         background: ${log.type === 'success' ? 'rgba(0, 216, 184, 0.2)' : log.type === 'error' ? 'rgba(255, 44, 84, 0.2)' : 'rgba(255, 193, 7, 0.2)'}; 
                         color: ${log.type === 'success' ? '#00d8b8' : log.type === 'error' ? '#ff2c54' : '#ffc107'};
                         border: 1px solid ${log.type === 'success' ? 'rgba(0, 216, 184, 0.3)' : log.type === 'error' ? 'rgba(255, 44, 84, 0.3)' : 'rgba(255, 193, 7, 0.3)'}">
                        ${log.type.toUpperCase()}
                    </span>
                </div>
                <div style="font-size: 13px; color: #fff; line-height: 1.4;">${log.message}</div>
            </div>
        `).join('');

        historyPanel.innerHTML = `
            <div id="dy-fire-history-header" style="padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); cursor: move;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; color: #fff; font-size: 18px; font-weight: 600;">
                        📋 历史日志 (${logs.length}/${userConfig.maxHistoryLogs})
                    </h3>
                    <button id="dy-fire-history-close" style="background: rgba(255,255,255,0.1); border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; color: #fff; font-size: 18px; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;">×</button>
                </div>
            </div>
            
            <div style="flex: 1; overflow-y: auto; padding: 0;">
                <div style="min-height: 100%; background: rgba(0,0,0,0.2);">
                    ${logs.length > 0 ? logItems : `
                        <div style="text-align: center; color: #666; padding: 60px 20px;">
                            <div style="font-size: 48px; margin-bottom: 20px;">📝</div>
                            <div style="font-size: 16px; color: #999;">暂无日志记录</div>
                        </div>
                    `}
                </div>
            </div>
            
            <div style="padding: 20px; border-top: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2);">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <button id="dy-fire-history-export" style="padding: 12px; background: linear-gradient(135deg, #00d8b8 0%, #00b8a8 100%); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.2s ease;">
                        📤 导出日志
                    </button>
                    <button id="dy-fire-history-clear" style="padding: 12px; background: linear-gradient(135deg, #ff2c54 0%, #ff6b8b 100%); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.2s ease;">
                        🗑️ 清空日志
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(historyPanel);

        addDragFunctionality(historyPanel, 'dy-fire-history-header');

        const historyButtons = historyPanel.querySelectorAll('button');
        historyButtons.forEach(button => {
            if (button.id !== 'dy-fire-history-close') {
                button.addEventListener('mouseenter', function() {
                    this.style.transform = 'translateY(-2px)';
                });
                button.addEventListener('mouseleave', function() {
                    this.style.transform = 'translateY(0)';
                });
            }
        });

        const historyCloseBtn = document.getElementById('dy-fire-history-close');
        historyCloseBtn.addEventListener('mouseenter', function() {
            this.style.background = 'rgba(255,255,255,0.2)';
            this.style.transform = 'scale(1.1)';
        });
        historyCloseBtn.addEventListener('mouseleave', function() {
            this.style.background = 'rgba(255,255,255,0.1)';
            this.style.transform = 'scale(1)';
        });

        document.getElementById('dy-fire-history-close').addEventListener('click', function() {
            historyPanel.remove();
        });
        document.getElementById('dy-fire-history-export').addEventListener('click', exportHistoryLogs);
        document.getElementById('dy-fire-history-clear').addEventListener('click', clearHistoryLogs);
    }

    // 显示设置面板
    function showSettingsPanel() {
        const existingSettings = document.getElementById('dy-fire-settings-panel');
        if (existingSettings) {
            existingSettings.remove();
            return;
        }

        const settingsPanel = document.createElement('div');
        settingsPanel.id = 'dy-fire-settings-panel';
        settingsPanel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            max-width: 90vw;
            width: 1000px;
            max-height: 85vh;
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            z-index: 10000;
            padding: 0;
            font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
            overflow: hidden;
            box-sizing: border-box;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1);
        `;

        settingsPanel.innerHTML = `
            <div id="dy-fire-settings-header" style="padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); cursor: move;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; color: #fff; font-size: 18px; font-weight: 600;">⚙️ 设置面板</h3>
                    <button id="dy-fire-settings-close" style="background: rgba(255,255,255,0.1); border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; color: #fff; font-size: 18px; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;">×</button>
                </div>
            </div>
           
            <div style="display: flex; height: calc(85vh - 140px);">
                <div style="width: 200px; background: rgba(0,0,0,0.3); padding: 20px 0; border-right: 1px solid rgba(255,255,255,0.1);">
                    <div class="settings-nav-item active" data-tab="basic">📅 基本设置</div>
                    <div class="settings-nav-item" data-tab="message">💬 消息设置</div>
                    <div class="settings-nav-item" data-tab="api">🔗 API设置</div>
                    <div class="settings-nav-item" data-tab="special">🌟 专属一言</div>
                    <div class="settings-nav-item" data-tab="users">👥 用户设置</div>
                    <div class="settings-nav-item" data-tab="advanced">⚡ 高级设置</div>
                </div>
               
                <div style="flex: 1; overflow-y: auto; padding: 20px;">
                    <div id="basic-settings" class="settings-tab active">
                        <div class="settings-section">
                            <h4 style="color: #fff; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">🕒 发送时间设置</h4>
                            <div style="margin-bottom: 15px;">
                                <label style="display: flex; align-items: center; cursor: pointer; margin-bottom: 10px;">
                                    <input type="checkbox" id="dy-fire-settings-time-random" ${userConfig.sendTimeRandom ? 'checked' : ''} style="margin-right: 10px;">
                                    <span style="color: #ccc;">启用随机发送时间</span>
                                </label>
                            </div>
                            
                            <div id="fixed-time-container" style="margin-bottom: 15px; ${userConfig.sendTimeRandom ? 'display: none;' : ''}">
                                <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: 500;">发送时间 (HH:mm:ss)</label>
                                <input type="text" id="dy-fire-settings-time" value="${userConfig.sendTime}" style="width: 100%; padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; box-sizing: border-box; color: #fff; font-size: 14px;" placeholder="例如: 00:01:00">
                                <div style="font-size: 12px; color: #999; margin-top: 5px;">设置每日自动发送消息的时间</div>
                            </div>
                            
                            <div id="random-time-container" style="margin-bottom: 15px; ${userConfig.sendTimeRandom ? '' : 'display: none;'}">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: 500;">开始时间 (HH:mm:ss)</label>
                                        <input type="text" id="dy-fire-settings-time-start" value="${userConfig.sendTimeRangeStart}" style="width: 100%; padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; box-sizing: border-box; color: #fff; font-size: 14px;" placeholder="例如: 23:30:00">
                                    </div>
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: 500;">结束时间 (HH:mm:ss)</label>
                                        <input type="text" id="dy-fire-settings-time-end" value="${userConfig.sendTimeRangeEnd}" style="width: 100%; padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; box-sizing: border-box; color: #fff; font-size: 14px;" placeholder="例如: 00:30:00">
                                    </div>
                                </div>
                                <div style="font-size: 12px; color: #999; margin-top: 5px;">在开始时间和结束时间之间随机选择一个时间发送（支持跨天）</div>
                            </div>
                        </div>

                        <div class="settings-section">
                            <h4 style="color: #fff; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">🔄 重试设置</h4>
                            <div style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: 500;">最大重试次数</label>
                                <input type="number" id="dy-fire-settings-retry-count" min="1" max="10" value="${userConfig.maxRetryCount}" style="width: 100%; padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; box-sizing: border-box; color: #fff; font-size: 14px;">
                            </div>
                        </div>
                    </div>

                    <div id="message-settings" class="settings-tab" style="display: none;">
                        <div class="settings-section">
                            <h4 style="color: #fff; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">📝 消息内容</h4>
                            <div style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: 500;">自定义消息模板</label>
                                <textarea id="dy-fire-settings-custom-message" style="width: 100%; height: 150px; padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; resize: vertical; box-sizing: border-box; color: #fff; font-size: 14px;">${userConfig.customMessage}</textarea>
                                <div style="font-size: 12px; color: #999; margin-top: 5px;">
                                    可用占位符:<br>
                                    [API] - 一言内容<br>
                                    [TXTAPI] - TXTAPI内容<br>
                                    [专属一言] - 专属一言内容<br>
                                    [天数] - 火花持续天数<br>
                                    支持换行符，关闭相应功能时占位符标记将保留
                                </div>
                            </div>
                        </div>
                    </div>

                    <div id="api-settings" class="settings-tab" style="display: none;">
                        <div class="settings-section">
                            <h4 style="color: #fff; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">📚 一言API</h4>
                            <div style="margin-bottom: 15px;">
                                <label style="display: flex; align-items: center; cursor: pointer; margin-bottom: 10px;">
                                    <input type="checkbox" id="dy-fire-settings-use-hitokoto" ${userConfig.useHitokoto ? 'checked' : ''} style="margin-right: 10px;">
                                    <span style="color: #ccc;">启用一言API</span>
                                </label>
                            </div>
                           
                            <div style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: 500;">一言格式</label>
                                <textarea id="dy-fire-settings-hitokoto-format" style="width: 100%; height: 60px; padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; resize: vertical; box-sizing: border-box; color: #fff; font-size: 14px;">${userConfig.hitokotoFormat}</textarea>
                                <div style="font-size: 12px; color: #999; margin-top: 5px;">
                                    可用变量: {hitokoto} {from} {from_who}<br>
                                    示例: {hitokoto} —— {from}{from_who}
                                </div>
                            </div>
                        </div>

                        <div class="settings-section">
                            <h4 style="color: #fff; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">📄 TXTAPI</h4>
                            <div style="margin-bottom: 15px;">
                                <label style="display: flex; align-items: center; cursor: pointer; margin-bottom: 10px;">
                                    <input type="checkbox" id="dy-fire-settings-use-txtapi" ${userConfig.useTxtApi ? 'checked' : ''} style="margin-right: 10px;">
                                    <span style="color: #ccc;">启用TXTAPI</span>
                                </label>
                            </div>
                           
                            <div id="txt-api-mode-container" style="margin-bottom: 15px; ${userConfig.useTxtApi ? '' : 'display: none;'}">
                                <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: 500;">TXTAPI模式</label>
                                <div style="display: flex; gap: 20px;">
                                    <label style="display: flex; align-items: center; cursor: pointer;">
                                        <input type="radio" name="txt-api-mode" value="api" ${userConfig.txtApiMode === 'api' ? 'checked' : ''} style="margin-right: 8px;">
                                        <span style="color: #ccc;">API模式</span>
                                    </label>
                                    <label style="display: flex; align-items: center; cursor: pointer;">
                                        <input type="radio" name="txt-api-mode" value="manual" ${userConfig.txtApiMode === 'manual' ? 'checked' : ''} style="margin-right: 8px;">
                                        <span style="color: #ccc;">手动模式</span>
                                    </label>
                                </div>
                            </div>
                           
                            <div id="txt-api-url-container" style="margin-bottom: 15px; ${userConfig.useTxtApi && userConfig.txtApiMode === 'api' ? '' : 'display: none;'}">
                                <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: 500;">TXTAPI链接</label>
                                <input type="text" id="dy-fire-settings-txtapi-url" value="${userConfig.txtApiUrl}" style="width: 100%; padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; box-sizing: border-box; color: #fff; font-size: 14px;" placeholder="例如: https://v1.hitokoto.cn/?encode=text">
                            </div>
                           
                            <div id="txt-api-manual-container" style="margin-bottom: 15px; ${userConfig.useTxtApi && userConfig.txtApiMode === 'manual' ? '' : 'display: none;'}">
                                <div style="margin-bottom: 10px;">
                                    <label style="display: flex; align-items: center; cursor: pointer;">
                                        <input type="checkbox" id="dy-fire-settings-txtapi-random" ${userConfig.txtApiManualRandom ? 'checked' : ''} style="margin-right: 8px;">
                                        <span style="color: #ccc;">随机选择文本</span>
                                    </label>
                                </div>
                                <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: 500;">手动文本内容（一行一个）</label>
                                <textarea id="dy-fire-settings-txtapi-manual" style="width: 100%; height: 120px; padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; resize: vertical; box-sizing: border-box; color: #fff; font-size: 14px;">${userConfig.txtApiManualText}</textarea>
                            </div>
                        </div>
                    </div>
                    
                    <div id="special-settings" class="settings-tab" style="display: none;">
                        <div class="settings-section">
                            <h4 style="color: #fff; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">🌟 专属一言设置</h4>
                            <div style="margin-bottom: 15px;">
                                <label style="display: flex; align-items: center; cursor: pointer; margin-bottom: 15px;">
                                    <input type="checkbox" id="dy-fire-settings-use-special-hitokoto" ${userConfig.useSpecialHitokoto ? 'checked' : ''} style="margin-right: 10px;">
                                    <span style="color: #ccc;">启用专属一言</span>
                                </label>
                            </div>
                            
                            <div style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: 500;">发送模式</label>
                                <div style="display: flex; gap: 20px;">
                                    <label style="display: flex; align-items: center; cursor: pointer;">
                                        <input type="radio" name="special-hitokoto-mode" value="random" ${userConfig.specialHitokotoRandom ? 'checked' : ''} style="margin-right: 8px;">
                                        <span style="color: #ccc;">随机发送</span>
                                    </label>
                                    <label style="display: flex; align-items: center; cursor: pointer;">
                                        <input type="radio" name="special-hitokoto-mode" value="sequential" ${!userConfig.specialHitokotoRandom ? 'checked' : ''} style="margin-right: 8px;">
                                        <span style="color: #ccc;">顺序发送</span>
                                    </label>
                                </div>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                <div>
                                    <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: 500;">周一文案（一行一个）</label>
                                    <textarea id="dy-fire-settings-special-monday" style="width: 100%; height: 80px; padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; resize: vertical; box-sizing: border-box; color: #fff; font-size: 14px;">${userConfig.specialHitokotoMonday}</textarea>
                                </div>
                                <div>
                                    <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: 500;">周二文案（一行一个）</label>
                                    <textarea id="dy-fire-settings-special-tuesday" style="width: 100%; height: 80px; padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; resize: vertical; box-sizing: border-box; color: #fff; font-size: 14px;">${userConfig.specialHitokotoTuesday}</textarea>
                                </div>
                                <div>
                                    <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: 500;">周三文案（一行一个）</label>
                                    <textarea id="dy-fire-settings-special-wednesday" style="width: 100%; height: 80px; padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; resize: vertical; box-sizing: border-box; color: #fff; font-size: 14px;">${userConfig.specialHitokotoWednesday}</textarea>
                                </div>
                                <div>
                                    <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: 500;">周四文案（一行一个）</label>
                                    <textarea id="dy-fire-settings-special-thursday" style="width: 100%; height: 80px; padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; resize: vertical; box-sizing: border-box; color: #fff; font-size: 14px;">${userConfig.specialHitokotoThursday}</textarea>
                                </div>
                                <div>
                                    <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: 500;">周五文案（一行一个）</label>
                                    <textarea id="dy-fire-settings-special-friday" style="width: 100%; height: 80px; padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; resize: vertical; box-sizing: border-box; color: #fff; font-size: 14px;">${userConfig.specialHitokotoFriday}</textarea>
                                </div>
                                <div>
                                    <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: 500;">周六文案（一行一个）</label>
                                    <textarea id="dy-fire-settings-special-saturday" style="width: 100%; height: 80px; padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; resize: vertical; box-sizing: border-box; color: #fff; font-size: 14px;">${userConfig.specialHitokotoSaturday}</textarea>
                                </div>
                                <div>
                                    <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: 500;">周日文案（一行一个）</label>
                                    <textarea id="dy-fire-settings-special-sunday" style="width: 100%; height: 80px; padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; resize: vertical; box-sizing: border-box; color: #fff; font-size: 14px;">${userConfig.specialHitokotoSunday}</textarea>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div id="users-settings" class="settings-tab" style="display: none;">
                        <div class="settings-section">
                            <h4 style="color: #fff; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">👥 用户设置</h4>
                            <div style="margin-bottom: 15px;">
                                <label style="display: flex; align-items: center; cursor: pointer; margin-bottom: 15px;">
                                    <input type="checkbox" id="dy-fire-settings-enable-target" ${userConfig.enableTargetUser ? 'checked' : ''} style="margin-right: 10px;">
                                    <span style="color: #ccc;">启用目标用户查找</span>
                                </label>
                                <div style="font-size: 12px; color: #999; margin-top: 5px;">注意：当目标用户列表不为空时，此选项会自动启用；当目标用户列表为空时，此选项会自动关闭</div>
                            </div>

                            <div id="target-user-container" style="margin-bottom: 15px; ${userConfig.enableTargetUser ? '' : 'display: none;'}">
                                <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: 500;">目标用户名（支持单个或多个用户，用逗号、竖线或换行分隔）</label>
                                <textarea id="dy-fire-settings-target-user" style="width: 100%; height: 100px; padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; resize: vertical; box-sizing: border-box; color: #fff; font-size: 14px;" placeholder="例如: 用户1&#10;或: 用户1, 用户2 | 用户3">${userConfig.targetUsernames}</textarea>
                                <div style="font-size: 12px; color: #999; margin-top: 5px;">启用后会自动在聊天列表中查找指定用户并点击，支持单个或多个用户</div>
                                
                                <div style="margin-top: 15px;">
                                    <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: 500;">用户发送模式</label>
                                    <div style="display: flex; gap: 20px;">
                                        <label style="display: flex; align-items: center; cursor: pointer;">
                                            <input type="radio" name="multi-user-mode" value="sequential" ${userConfig.multiUserMode === 'sequential' ? 'checked' : ''} style="margin-right: 8px;">
                                            <span style="color: #ccc;">顺序发送</span>
                                        </label>
                                        <label style="display: flex; align-items: center; cursor: pointer;">
                                            <input type="radio" name="multi-user-mode" value="random" ${userConfig.multiUserMode === 'random' ? 'checked' : ''} style="margin-right: 8px;">
                                            <span style="color: #ccc;">随机发送</span>
                                        </label>
                                    </div>
                                    <div style="font-size: 12px; color: #999; margin-top: 5px;">仅在有多个用户时生效</div>
                                </div>
                                
                                <div style="margin-top: 15px;">
                                    <label style="display: flex; align-items: center; cursor: pointer;">
                                        <input type="checkbox" id="dy-fire-settings-multi-retry-same" ${userConfig.multiUserRetrySame ? 'checked' : ''} style="margin-right: 8px;">
                                        <span style="color: #ccc;">重试时使用同一用户</span>
                                    </label>
                                    <div style="font-size: 12px; color: #999; margin-top: 5px;">启用后重试时会继续发送给同一用户，否则会切换到下一用户</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div id="advanced-settings" class="settings-tab" style="display: none;">
                        <div class="settings-section">
                            <h4 style="color: #fff; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">⚡ 性能设置</h4>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                                <div>
                                    <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: 500;">用户查找超时(毫秒)</label>
                                    <input type="number" id="dy-fire-settings-user-timeout" min="1000" max="30000" value="${userConfig.userSearchTimeout}" style="width: 100%; padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; box-sizing: border-box; color: #fff; font-size: 14px;">
                                </div>
                                <div>
                                    <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: 500;">页面加载等待时间(毫秒)</label>
                                    <input type="number" id="dy-fire-settings-page-wait" min="1000" max="15000" value="${userConfig.pageLoadWaitTime}" style="width: 100%; padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; box-sizing: border-box; color: #fff; font-size: 14px;">
                                </div>
                            </div>

                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                                <div>
                                    <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: 500;">查找防抖延迟(毫秒)</label>
                                    <input type="number" id="dy-fire-settings-debounce-delay" min="100" max="2000" value="${userConfig.searchDebounceDelay}" style="width: 100%; padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; box-sizing: border-box; color: #fff; font-size: 14px;">
                                    <div style="font-size: 12px; color: #999; margin-top: 5px;">降低频繁查找导致的性能消耗</div>
                                </div>
                                <div>
                                    <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: 500;">查找节流延迟(毫秒)</label>
                                    <input type="number" id="dy-fire-settings-throttle-delay" min="500" max="3000" value="${userConfig.searchThrottleDelay}" style="width: 100%; padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; box-sizing: border-box; color: #fff; font-size: 14px;">
                                    <div style="font-size: 12px; color: #999; margin-top: 5px;">控制查找的最小时间间隔</div>
                                </div>
                            </div>
                        </div>

                        <div class="settings-section">
                            <h4 style="color: #fff; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">🔧 技术设置</h4>
                            <div style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: 500;">点击方法</label>
                                <div style="display: flex; gap: 20px;">
                                    <label style="display: flex; align-items: center; cursor: pointer;">
                                        <input type="radio" name="click-method" value="direct" ${userConfig.clickMethod === 'direct' ? 'checked' : ''} style="margin-right: 8px;">
                                        <span style="color: #ccc;">直接点击</span>
                                    </label>
                                    <label style="display: flex; align-items: center; cursor: pointer;">
                                        <input type="radio" name="click-method" value="event" ${userConfig.clickMethod === 'event' ? 'checked' : ''} style="margin-right: 8px;">
                                        <span style="color: #ccc;">事件触发</span>
                                    </label>
                                </div>
                                <div style="font-size: 12px; color: #999; margin-top: 5px;">直接点击更可靠，事件触发更安全</div>
                            </div>

                            <div style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: 500;">最大历史日志数量</label>
                                <input type="number" id="dy-fire-settings-max-logs" min="50" max="1000" value="${userConfig.maxHistoryLogs}" style="width: 100%; padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; box-sizing: border-box; color: #fff; font-size: 14px;">
                            </div>
                        </div>

                        <div class="settings-section">
                            <h4 style="color: #fff; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">🎨 格式设置</h4>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                <div>
                                    <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: 500;">from格式</label>
                                    <input type="text" id="dy-fire-settings-from-format" value="${userConfig.fromFormat}" style="width: 100%; padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; box-sizing: border-box; color: #fff; font-size: 14px;" placeholder="例如: {from}">
                                    <div style="font-size: 12px; color: #999; margin-top: 5px;">当from不为空时显示此格式</div>
                                </div>
                                <div>
                                    <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: 500;">from_who格式</label>
                                    <input type="text" id="dy-fire-settings-from-who-format" value="${userConfig.fromWhoFormat}" style="width: 100%; padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; box-sizing: border-box; color: #fff; font-size: 14px;" placeholder="例如: 「{from_who}」">
                                    <div style="font-size: 12px; color: #999; margin-top: 5px;">当from_who不为空时显示此格式</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
           
            <div style="padding: 20px; border-top: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2);">
                <button id="dy-fire-settings-save" style="width: 100%; padding: 15px; background: linear-gradient(135deg, #00d8b8 0%, #00b8a8 100%); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 16px; transition: all 0.2s ease; box-shadow: 0 4px 12px rgba(0, 216, 184, 0.3);">
                    💾 保存设置
                </button>
            </div>
        `;

        document.body.appendChild(settingsPanel);

        addDragFunctionality(settingsPanel, 'dy-fire-settings-header');

        const navItems = settingsPanel.querySelectorAll('.settings-nav-item');
        const tabs = settingsPanel.querySelectorAll('.settings-tab');
        
        navItems.forEach(item => {
            item.addEventListener('click', function() {
                const tabName = this.getAttribute('data-tab');
                
                navItems.forEach(nav => nav.classList.remove('active'));
                this.classList.add('active');
                
                tabs.forEach(tab => {
                    tab.style.display = 'none';
                    if (tab.id === `${tabName}-settings`) {
                        tab.style.display = 'block';
                    }
                });
            });
            
            item.addEventListener('mouseenter', function() {
                if (!this.classList.contains('active')) {
                    this.style.background = 'rgba(255,255,255,0.05)';
                }
            });
            item.addEventListener('mouseleave', function() {
                if (!this.classList.contains('active')) {
                    this.style.background = 'transparent';
                }
            });
        });

        const navStyle = `
            .settings-nav-item {
                padding: 12px 20px;
                color: #999;
                cursor: pointer;
                transition: all 0.2s ease;
                border-left: 3px solid transparent;
                font-size: 14px;
            }
            .settings-nav-item:hover {
                color: #fff;
                background: rgba(255,255,255,0.05);
            }
            .settings-nav-item.active {
                color: #ff2c54;
                background: rgba(255,44,84,0.1);
                border-left-color: #ff2c54;
                font-weight: 600;
            }
            .settings-section {
                background: rgba(255,255,255,0.05);
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 20px;
                border: 1px solid rgba(255,255,255,0.1);
            }
        `;
        const styleEl = document.createElement('style');
        styleEl.textContent = navStyle;
        settingsPanel.appendChild(styleEl);

        // 随机时间切换
        document.getElementById('dy-fire-settings-time-random').addEventListener('change', function() {
            const isRandom = this.checked;
            document.getElementById('fixed-time-container').style.display = isRandom ? 'none' : 'block';
            document.getElementById('random-time-container').style.display = isRandom ? 'block' : 'none';
        });

        document.getElementById('dy-fire-settings-enable-target').addEventListener('change', function() {
            document.getElementById('target-user-container').style.display = this.checked ? 'block' : 'none';
        });

        const modeRadios = document.querySelectorAll('input[name="txt-api-mode"]');
        modeRadios.forEach(radio => {
            radio.addEventListener('change', function() {
                const mode = this.value;
                document.getElementById('txt-api-url-container').style.display = mode === 'api' ? 'block' : 'none';
                document.getElementById('txt-api-manual-container').style.display = mode === 'manual' ? 'block' : 'none';
            });
        });

        document.getElementById('dy-fire-settings-use-txtapi').addEventListener('change', function() {
            const useTxtApi = this.checked;
            document.getElementById('txt-api-mode-container').style.display = useTxtApi ? 'block' : 'none';
            
            const currentMode = document.querySelector('input[name="txt-api-mode"]:checked').value;
            document.getElementById('txt-api-url-container').style.display = (useTxtApi && currentMode === 'api') ? 'block' : 'none';
            document.getElementById('txt-api-manual-container').style.display = (useTxtApi && currentMode === 'manual') ? 'block' : 'none';
        });

        const settingsButtons = settingsPanel.querySelectorAll('button');
        settingsButtons.forEach(button => {
            if (button.id !== 'dy-fire-settings-close') {
                button.addEventListener('mouseenter', function() {
                    this.style.transform = 'translateY(-2px)';
                });
                button.addEventListener('mouseleave', function() {
                    this.style.transform = 'translateY(0)';
                });
            }
        });

        const settingsCloseBtn = document.getElementById('dy-fire-settings-close');
        settingsCloseBtn.addEventListener('mouseenter', function() {
            this.style.background = 'rgba(255,255,255,0.2)';
            this.style.transform = 'scale(1.1)';
        });
        settingsCloseBtn.addEventListener('mouseleave', function() {
            this.style.background = 'rgba(255,255,255,0.1)';
            this.style.transform = 'scale(1)';
        });

        document.getElementById('dy-fire-settings-close').addEventListener('click', function() {
            settingsPanel.remove();
        });

        document.getElementById('dy-fire-settings-save').addEventListener('click', saveSettings);
    }

    // 保存设置
    function saveSettings() {
        const timeRandom = document.getElementById('dy-fire-settings-time-random').checked;
        const timeValue = document.getElementById('dy-fire-settings-time').value;
        const timeStart = document.getElementById('dy-fire-settings-time-start').value;
        const timeEnd = document.getElementById('dy-fire-settings-time-end').value;
        const enableTargetUser = document.getElementById('dy-fire-settings-enable-target').checked;
        const targetUsernames = document.getElementById('dy-fire-settings-target-user').value;
        const multiUserMode = document.querySelector('input[name="multi-user-mode"]:checked').value;
        const multiUserRetrySame = document.getElementById('dy-fire-settings-multi-retry-same').checked;
        const clickMethod = document.querySelector('input[name="click-method"]:checked').value;
        const pageLoadWaitTime = parseInt(document.getElementById('dy-fire-settings-page-wait').value, 10);
        const useHitokoto = document.getElementById('dy-fire-settings-use-hitokoto').checked;
        const useTxtApi = document.getElementById('dy-fire-settings-use-txtapi').checked;
        const useSpecialHitokoto = document.getElementById('dy-fire-settings-use-special-hitokoto').checked;
        const specialHitokotoRandom = document.querySelector('input[name="special-hitokoto-mode"]:checked').value === 'random';
        const txtApiMode = document.querySelector('input[name="txt-api-mode"]:checked').value;
        const txtApiRandom = document.getElementById('dy-fire-settings-txtapi-random').checked;
        const txtApiUrl = document.getElementById('dy-fire-settings-txtapi-url').value;
        const txtApiManualText = document.getElementById('dy-fire-settings-txtapi-manual').value;
        const maxRetryCount = parseInt(document.getElementById('dy-fire-settings-retry-count').value, 10);
        const userSearchTimeout = parseInt(document.getElementById('dy-fire-settings-user-timeout').value, 10);
        const maxHistoryLogs = parseInt(document.getElementById('dy-fire-settings-max-logs').value, 10);
        const debounceDelay = parseInt(document.getElementById('dy-fire-settings-debounce-delay').value, 10);
        const throttleDelay = parseInt(document.getElementById('dy-fire-settings-throttle-delay').value, 10);
        const hitokotoFormat = document.getElementById('dy-fire-settings-hitokoto-format').value;
        const fromFormat = document.getElementById('dy-fire-settings-from-format').value;
        const fromWhoFormat = document.getElementById('dy-fire-settings-from-who-format').value;
        const customMessage = document.getElementById('dy-fire-settings-custom-message').value;
        
        // 专属一言文案
        const specialMonday = document.getElementById('dy-fire-settings-special-monday').value;
        const specialTuesday = document.getElementById('dy-fire-settings-special-tuesday').value;
        const specialWednesday = document.getElementById('dy-fire-settings-special-wednesday').value;
        const specialThursday = document.getElementById('dy-fire-settings-special-thursday').value;
        const specialFriday = document.getElementById('dy-fire-settings-special-friday').value;
        const specialSaturday = document.getElementById('dy-fire-settings-special-saturday').value;
        const specialSunday = document.getElementById('dy-fire-settings-special-sunday').value;
       
        // 时间格式验证
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
        
        if (!timeRandom && !timeRegex.test(timeValue)) {
            addHistoryLog('时间格式错误，请使用HH:mm:ss格式', 'error');
            return;
        }
        
        if (timeRandom) {
            if (!timeRegex.test(timeStart) || !timeRegex.test(timeEnd)) {
                addHistoryLog('时间格式错误，请使用HH:mm:ss格式', 'error');
                return;
            }
        }
       
        if (isNaN(maxRetryCount) || maxRetryCount < 1 || maxRetryCount > 10) {
            addHistoryLog('重试次数必须是1-10之间的数字', 'error');
            return;
        }

        if (isNaN(userSearchTimeout) || userSearchTimeout < 1000 || userSearchTimeout > 30000) {
            addHistoryLog('用户查找超时必须介于1000-30000毫秒之间', 'error');
            return;
        }

        if (isNaN(maxHistoryLogs) || maxHistoryLogs < 50 || maxHistoryLogs > 1000) {
            addHistoryLog('最大历史日志数量必须介于50-1000之间', 'error');
            return;
        }

        if (isNaN(debounceDelay) || debounceDelay < 100 || debounceDelay > 2000) {
            addHistoryLog('防抖延迟必须介于100-2000毫秒之间', 'error');
            return;
        }

        if (isNaN(throttleDelay) || throttleDelay < 500 || throttleDelay > 3000) {
            addHistoryLog('节流延迟必须介于500-3000毫秒之间', 'error');
            return;
        }

        if (isNaN(pageLoadWaitTime) || pageLoadWaitTime < 1000 || pageLoadWaitTime > 15000) {
            addHistoryLog('页面加载等待时间必须介于1000-15000毫秒之间', 'error');
            return;
        }
       
        if (useTxtApi && txtApiMode === 'api' && !txtApiUrl) {
            addHistoryLog('请填写TXTAPI链接', 'error');
            return;
        }
       
        if (useTxtApi && txtApiMode === 'manual' && !txtApiManualText.trim()) {
            addHistoryLog('请填写手动文本内容', 'error');
            return;
        }

        if (enableTargetUser && !targetUsernames.trim()) {
            addHistoryLog('启用目标用户查找时，必须填写目标用户名', 'error');
            return;
        }
       
        userConfig.sendTimeRandom = timeRandom;
        userConfig.sendTime = timeValue;
        userConfig.sendTimeRangeStart = timeStart;
        userConfig.sendTimeRangeEnd = timeEnd;
        userConfig.targetUsernames = targetUsernames;
        userConfig.multiUserMode = multiUserMode;
        userConfig.multiUserRetrySame = multiUserRetrySame;
        userConfig.clickMethod = clickMethod;
        userConfig.pageLoadWaitTime = pageLoadWaitTime;
        userConfig.useHitokoto = useHitokoto;
        userConfig.useTxtApi = useTxtApi;
        userConfig.useSpecialHitokoto = useSpecialHitokoto;
        userConfig.specialHitokotoRandom = specialHitokotoRandom;
        userConfig.txtApiMode = txtApiMode;
        userConfig.txtApiManualRandom = txtApiRandom;
        userConfig.txtApiUrl = txtApiUrl;
        userConfig.txtApiManualText = txtApiManualText;
        userConfig.maxRetryCount = maxRetryCount;
        userConfig.userSearchTimeout = userSearchTimeout;
        userConfig.maxHistoryLogs = maxHistoryLogs;
        userConfig.searchDebounceDelay = debounceDelay;
        userConfig.searchThrottleDelay = throttleDelay;
        userConfig.hitokotoFormat = hitokotoFormat;
        userConfig.fromFormat = fromFormat;
        userConfig.fromWhoFormat = fromWhoFormat;
        userConfig.customMessage = customMessage;
        
        // 专属一言文案
        userConfig.specialHitokotoMonday = specialMonday;
        userConfig.specialHitokotoTuesday = specialTuesday;
        userConfig.specialHitokotoWednesday = specialWednesday;
        userConfig.specialHitokotoThursday = specialThursday;
        userConfig.specialHitokotoFriday = specialFriday;
        userConfig.specialHitokotoSaturday = specialSaturday;
        userConfig.specialHitokotoSunday = specialSunday;
        
        // 自动设置enableTargetUser
        parseTargetUsers();
       
        saveConfig();
        updateUserStatusDisplay();
       
        // 重置倒计时
        nextSendTime = parseRandomTimeString();
        startCountdown(nextSendTime);
        
        document.getElementById('dy-fire-settings-panel').remove();
        addHistoryLog('设置已保存', 'success');
    }

    // ==================== 初始化函数 ====================

    function init() {
        isScriptCat = detectScriptCat();
        initConfig();
        createControlPanel();
       
        const today = new Date().toDateString();
        const lastResetDate = GM_getValue('lastResetDate', '');
        if (lastResetDate !== today) {
            resetTodaySentUsers();
        }
       
        const lastSentDate = GM_getValue('lastSentDate', '');
        const isSentToday = lastSentDate === today;
       
        updateStatus(isSentToday);
        updateUserStatusDisplay();
        updateFireDaysStatus();

        const reopenBtn = document.getElementById('dy-fire-reopen-btn');
        if (reopenBtn) {
            reopenBtn.style.display = 'none';
        }
       
        if (typeof GM_registerMenuCommand !== 'undefined') {
            try {
                GM_registerMenuCommand('抖音续火助手-显示面板', function() {
                    const panel = document.getElementById('dy-fire-helper');
                    const reopenBtn = document.getElementById('dy-fire-reopen-btn');
                    if (panel) {
                        panel.style.display = 'block';
                        if (reopenBtn) {
                            reopenBtn.style.display = 'none';
                        }
                    }
                });
                GM_registerMenuCommand('立即发送续火消息', sendMessage);
                GM_registerMenuCommand('设置', showSettingsPanel);
                GM_registerMenuCommand('历史日志', showHistoryPanel);
                GM_registerMenuCommand('修改火花天数', modifyFireDays);
                GM_registerMenuCommand('从列表选择用户', showUserSelectPanel);
                GM_registerMenuCommand('清空发送记录', clearData);
                GM_registerMenuCommand('重置所有配置', resetAllConfig);
                GM_registerMenuCommand('重置今日发送记录', resetTodaySentUsers);
            } catch (e) {
                addHistoryLog('菜单命令注册失败，使用面板控制', 'error');
            }
        }
       
        addHistoryLog('抖音续火助手已启动', 'info');
       
        setInterval(() => {
            const now = new Date();
            const today = new Date().toDateString();
            const lastSentDate = GM_getValue('lastSentDate', '');
            
            if (userConfig.enableTargetUser && allTargetUsers.length > 0) {
                const unsentUsers = allTargetUsers.filter(user => !sentUsersToday.includes(user));
                if (unsentUsers.length > 0) {
                    if (userConfig.sendTimeRandom) {
                        // 随机时间模式，检查是否在时间范围内
                        const [startHour, startMinute] = userConfig.sendTimeRangeStart.split(':').map(Number);
                        const [endHour, endMinute] = userConfig.sendTimeRangeEnd.split(':').map(Number);
                        
                        const nowMinutes = now.getHours() * 60 + now.getMinutes();
                        const startMinutes = startHour * 60 + startMinute;
                        const endMinutes = endHour * 60 + endMinute;
                        
                        let isInRange = false;
                        if (endMinutes > startMinutes) {
                            // 不跨天
                            isInRange = nowMinutes >= startMinutes && nowMinutes <= endMinutes;
                        } else {
                            // 跨天
                            isInRange = nowMinutes >= startMinutes || nowMinutes <= endMinutes;
                        }
                        
                        if (isInRange && !isProcessing) {
                            const shouldSend = checkIfShouldSendNow();
                            if (shouldSend) {
                                addHistoryLog('定时任务触发发送（随机时间模式）', 'info');
                                sendMessage();
                            }
                        }
                    } else {
                        // 固定时间模式
                        const [targetHour, targetMinute, targetSecond] = userConfig.sendTime.split(':').map(Number);
                        if (now.getHours() === targetHour &&
                            now.getMinutes() === targetMinute &&
                            now.getSeconds() === (targetSecond || 0)) {
                           
                            const shouldSend = checkIfShouldSendNow();
                            if (shouldSend) {
                                addHistoryLog('定时任务触发发送（固定时间模式）', 'info');
                                sendMessage();
                            }
                        }
                    }
                }
            } else {
                if (lastSentDate !== today) {
                    if (userConfig.sendTimeRandom) {
                        // 随机时间模式
                        const [startHour, startMinute] = userConfig.sendTimeRangeStart.split(':').map(Number);
                        const [endHour, endMinute] = userConfig.sendTimeRangeEnd.split(':').map(Number);
                        
                        const nowMinutes = now.getHours() * 60 + now.getMinutes();
                        const startMinutes = startHour * 60 + startMinute;
                        const endMinutes = endHour * 60 + endMinute;
                        
                        let isInRange = false;
                        if (endMinutes > startMinutes) {
                            // 不跨天
                            isInRange = nowMinutes >= startMinutes && nowMinutes <= endMinutes;
                        } else {
                            // 跨天
                            isInRange = nowMinutes >= startMinutes || nowMinutes <= endMinutes;
                        }
                        
                        if (isInRange && !isProcessing) {
                            addHistoryLog('定时任务触发发送（随机时间模式）', 'info');
                            sendMessage();
                        }
                    } else {
                        // 固定时间模式
                        const [targetHour, targetMinute, targetSecond] = userConfig.sendTime.split(':').map(Number);
                        if (now.getHours() === targetHour &&
                            now.getMinutes() === targetMinute &&
                            now.getSeconds() === (targetSecond || 0)) {
                           
                            addHistoryLog('定时任务触发发送（固定时间模式）', 'info');
                            sendMessage();
                        }
                    }
                }
            }
        }, 1000);
    }

    // 检查当前是否应该发送
    function checkIfShouldSendNow() {
        const lastSendTimestamp = GM_getValue('lastSendTimestamp', 0);
        const now = Date.now();
        
        // 避免短时间内重复发送（至少间隔5分钟）
        if (now - lastSendTimestamp < 5 * 60 * 1000) {
            return false;
        }
        
        GM_setValue('lastSendTimestamp', now);
        return true;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
