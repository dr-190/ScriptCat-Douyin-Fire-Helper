// ==UserScript==
// @name         抖音续火花自动发送助手-集成一言API和TXTAPI-支持多用户
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  每天自动发送续火消息，支持自定义时间，集成一言API和TXTAPI，支持多目标用户
// @author       飔梦 / 阚泥
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
        checkInterval: 1000,
        maxWaitTime: 30000,
        maxRetryCount: 3,
        hitokotoTimeout: 60000,
        txtApiTimeout: 60000,
        useHitokoto: true,
        useTxtApi: true,
        txtApiMode: "manual",
        txtApiManualRandom: true,
        customMessage: "—————每日续火—————\n\n[TXTAPI]\n\n—————每日一言—————\n\n[API]\n",
        hitokotoFormat: "{hitokoto}\n—— {from}{from_who}",
        fromFormat: "{from}",
        fromWhoFormat: "「{from_who}」",
        txtApiUrl: "https://v1.hitokoto.cn/?encode=text",
        txtApiManualText: "文本1\n文本2\n文本3",
        enableTargetUser: false,
        targetUsernames: "",
        userSearchTimeout: 10000,
        maxHistoryLogs: 200,
        searchDebounceDelay: 500,
        searchThrottleDelay: 1000,
        clickMethod: "direct",
        pageLoadWaitTime: 5000,
        chatInputCheckInterval: 1000,
        multiUserMode: "sequential", // sequential: 顺序发送, random: 随机发送
        multiUserRetrySame: false // 重试时是否使用同一用户
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
       
        // 初始化多用户数据
        if (!GM_getValue('sentUsersToday')) {
            GM_setValue('sentUsersToday', []);
        }
        sentUsersToday = GM_getValue('sentUsersToday', []);
        
        if (!GM_getValue('currentUserIndex')) {
            GM_setValue('currentUserIndex', -1);
        }
        currentUserIndex = GM_getValue('currentUserIndex', -1);
        
        // 解析目标用户列表
        parseTargetUsers();
       
        GM_setValue('userConfig', userConfig);
        return userConfig;
    }

    // 解析目标用户列表
    function parseTargetUsers() {
        if (!userConfig.targetUsernames || !userConfig.targetUsernames.trim()) {
            allTargetUsers = [];
            return;
        }
        
        // 支持逗号、竖线、换行符分隔
        const rawText = userConfig.targetUsernames.trim();
        allTargetUsers = rawText.split(/[,|\n]/)
            .map(user => user.trim())
            .filter(user => user.length > 0);
            
        addHistoryLog(`解析到 ${allTargetUsers.length} 个目标用户: ${allTargetUsers.join(', ')}`, 'info');
    }

    // 获取下一个目标用户
    function getNextTargetUser() {
        if (allTargetUsers.length === 0) {
            return null;
        }
        
        // 获取今天还未发送的用户
        const unsentUsers = allTargetUsers.filter(user => !sentUsersToday.includes(user));
        
        if (unsentUsers.length === 0) {
            addHistoryLog('所有目标用户今日都已发送', 'info');
            return null;
        }
        
        let nextUser;
        
        if (userConfig.multiUserMode === 'random') {
            // 随机模式
            const randomIndex = Math.floor(Math.random() * unsentUsers.length);
            nextUser = unsentUsers[randomIndex];
        } else {
            // 顺序模式
            if (currentUserIndex < 0 || currentUserIndex >= allTargetUsers.length) {
                currentUserIndex = 0;
            }
            
            // 找到下一个未发送的用户
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
        
        // 更新当前用户索引
        const index = allTargetUsers.indexOf(username);
        if (index !== -1) {
            currentUserIndex = (index + 1) % allTargetUsers.length;
            GM_setValue('currentUserIndex', currentUserIndex);
        }
        
        addHistoryLog(`用户 ${username} 已标记为今日已发送`, 'success');
        updateUserStatusDisplay();
    }

    // 更新用户状态显示
    function updateUserStatusDisplay() {
        const statusEl = document.getElementById('dy-fire-user-status');
        const progressEl = document.getElementById('dy-fire-user-progress');
        
        if (!userConfig.enableTargetUser || allTargetUsers.length === 0) {
            statusEl.textContent = '未启用';
            statusEl.style.color = '#6c757d';
            if (progressEl) {
                progressEl.textContent = '';
            }
            return;
        }
        
        const sentCount = sentUsersToday.length;
        const totalCount = allTargetUsers.length;
        const progressText = `${sentCount}/${totalCount}`;
        
        if (progressEl) {
            progressEl.textContent = progressText;
        }
        
        if (sentCount >= totalCount) {
            statusEl.textContent = '全部完成';
            statusEl.style.color = '#28a745';
        } else {
            statusEl.textContent = `进行中 ${progressText}`;
            statusEl.style.color = '#007bff';
        }
    }

    // 重置今日发送记录
    function resetTodaySentUsers() {
        sentUsersToday = [];
        GM_setValue('sentUsersToday', []);
        currentUserIndex = -1;
        GM_setValue('currentUserIndex', -1);
        addHistoryLog('今日发送记录已重置', 'info');
        updateUserStatusDisplay();
    }

    // 保存配置
    function saveConfig() {
        GM_setValue('userConfig', userConfig);
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
            width: 450px;
            background: rgba(255, 255, 255, 0.98);
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            z-index: 9999;
            font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
            padding: 15px;
            color: #333;
            transition: all 0.3s ease;
            max-height: 600px;
            overflow: hidden;
            border: 1px solid #eee;
        `;

        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="margin: 0; color: #ff2c54; font-size: 16px; display: flex; align-items: center;">
                    <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #28a745; margin-right: 8px;"></span>
                    抖音续火助手 ${isScriptCat ? '(ScriptCat)' : ''}
                </h3>
                <button id="dy-fire-helper-close" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #999;">×</button>
            </div>
           
            <div style="margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-weight: 500;">今日状态:</span>
                    <span id="dy-fire-status" style="color: #28a745; font-weight: 600;">已发送</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-weight: 500;">用户状态:</span>
                    <span id="dy-fire-user-status" style="color: #6c757d; font-weight: 600;">未启用</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-weight: 500;">发送进度:</span>
                    <span id="dy-fire-user-progress" style="color: #007bff; font-weight: 600;"></span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-weight: 500;">下次发送:</span>
                    <span id="dy-fire-next">2023-11-05 00:01:00</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-weight: 500;">倒计时:</span>
                    <span id="dy-fire-countdown" style="color: #dc3545; font-weight: 700;">23:45:12</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="font-weight: 500;">重试次数:</span>
                    <span id="dy-fire-retry">0/${userConfig.maxRetryCount}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 8px;">
                    <span style="font-weight: 500;">一言状态:</span>
                    <span id="dy-fire-hitokoto">未获取</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 8px;">
                    <span style="font-weight: 500;">TXTAPI状态:</span>
                    <span id="dy-fire-txtapi">未获取</span>
                </div>
            </div>
           
            <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 15px;">
                <button id="dy-fire-send" style="padding: 8px 12px; background: #007bff; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">立即发送续火消息</button>
                <div style="display: flex; gap: 10px;">
                    <button id="dy-fire-settings" style="flex: 1; padding: 8px 12px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">设置</button>
                    <button id="dy-fire-history" style="flex: 1; padding: 8px 12px; background: #17a2b8; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">历史日志</button>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button id="dy-fire-clear" style="flex: 1; padding: 8px 12px; background: #dc3545; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">清空记录</button>
                    <button id="dy-fire-reset" style="flex: 1; padding: 8px 12px; background: #ffc107; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">重置配置</button>
                </div>
                <button id="dy-fire-reset-users" style="padding: 8px 12px; background: #6f42c1; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">重置今日发送记录</button>
            </div>
           
            <div style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 10px;">
                <div style="font-weight: 500; margin-bottom: 8px;">操作日志</div>
                <div id="dy-fire-log" style="font-size: 12px; height: 120px; overflow-y: auto; line-height: 1.4;">
                    <div style="color: #28a745;">系统已就绪，等待执行...</div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        document.getElementById('dy-fire-helper-close').addEventListener('click', function() {
            panel.style.display = 'none';
        });
        document.getElementById('dy-fire-send').addEventListener('click', sendMessage);
        document.getElementById('dy-fire-settings').addEventListener('click', showSettingsPanel);
        document.getElementById('dy-fire-history').addEventListener('click', showHistoryPanel);
        document.getElementById('dy-fire-clear').addEventListener('click', clearData);
        document.getElementById('dy-fire-reset').addEventListener('click', resetAllConfig);
        document.getElementById('dy-fire-reset-users').addEventListener('click', resetTodaySentUsers);
        
        updateUserStatusDisplay();
    }

    // 更新用户状态显示（兼容旧函数）
    function updateUserStatus(status, isSuccess = null) {
        const statusEl = document.getElementById('dy-fire-user-status');
        if (status) {
            statusEl.textContent = status;
        }
        
        if (isSuccess === true) {
            statusEl.style.color = '#28a745';
        } else if (isSuccess === false) {
            statusEl.style.color = '#dc3545';
        } else {
            statusEl.style.color = '#6c757d';
        }
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
            width: 700px;
            height: 500px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 5px 25px rgba(0, 0, 0, 0.2);
            z-index: 10000;
            padding: 20px;
            font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
        `;

        const logs = getHistoryLogs();
        const logItems = logs.map(log => `
            <div style="padding: 5px 0; border-bottom: 1px solid #f0f0f0;">
                <div style="font-size: 11px; color: #666;">
                    ${new Date(log.timestamp).toLocaleString()}
                    <span style="margin-left: 10px; padding: 2px 6px; border-radius: 3px; font-size: 10px; 
                         background: ${log.type === 'success' ? '#d4edda' : log.type === 'error' ? '#f8d7da' : '#d1ecf1'}; 
                         color: ${log.type === 'success' ? '#155724' : log.type === 'error' ? '#721c24' : '#0c5460'}">
                        ${log.type.toUpperCase()}
                    </span>
                </div>
                <div style="font-size: 12px; margin-top: 2px;">${log.message}</div>
            </div>
        `).join('');

        historyPanel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="margin: 0; color: #ff2c54;">历史日志 (${logs.length}/${userConfig.maxHistoryLogs})</h3>
                <button id="dy-fire-history-close" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #999;">×</button>
            </div>
            <div style="flex: 1; overflow-y: auto; margin-bottom: 15px; border: 1px solid #eee; border-radius: 6px; padding: 10px;">
                ${logs.length > 0 ? logItems : '<div style="text-align: center; color: #666; padding: 20px;">暂无日志记录</div>'}
            </div>
            <div style="display: flex; gap: 10px;">
                <button id="dy-fire-history-export" style="flex: 1; padding: 10px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer;">导出日志</button>
                <button id="dy-fire-history-clear" style="flex: 1; padding: 10px; background: #dc3545; color: white; border: none; border-radius: 6px; cursor: pointer;">清空日志</button>
            </div>
        `;

        document.body.appendChild(historyPanel);

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
            width: 500px;
            max-height: 80vh;
            background: white;
            border-radius: 12px;
            box-shadow: 0 5px 25px rgba(0, 0, 0, 0.2);
            z-index: 10000;
            padding: 20px;
            font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
            overflow-y: auto;
            box-sizing: border-box;
        `;

        settingsPanel.innerHTML = `
            <h3 style="margin: 0 0 20px 0; color: #ff2c54; display: flex; justify-content: space-between; align-items: center;">
                <span>设置</span>
                <button id="dy-fire-settings-close" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #999;">×</button>
            </h3>
           
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">发送时间 (HH:mm:ss)</label>
                <input type="text" id="dy-fire-settings-time" value="${userConfig.sendTime}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;" placeholder="例如: 00:01:00">
            </div>

            <div style="margin-bottom: 15px;">
                <label style="display: flex; align-items: center; cursor: pointer;">
                    <input type="checkbox" id="dy-fire-settings-enable-target" ${userConfig.enableTargetUser ? 'checked' : ''} style="margin-right: 8px;">
                    启用目标用户查找
                </label>
            </div>

            <div id="target-user-container" style="margin-bottom: 15px; ${userConfig.enableTargetUser ? '' : 'display: none;'}">
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">目标用户名（多个用户用逗号、竖线或换行分隔）</label>
                <textarea id="dy-fire-settings-target-user" style="width: 100%; height: 80px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical; box-sizing: border-box;" placeholder="例如: 用户1, 用户2 | 用户3&#10;用户4">${userConfig.targetUsernames}</textarea>
                <div style="font-size: 12px; color: #666; margin-top: 5px;">启用后会自动在聊天列表中查找指定用户并点击</div>
                
                <div style="margin-top: 10px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 500;">多用户发送模式</label>
                    <div style="display: flex; gap: 15px;">
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="radio" name="multi-user-mode" value="sequential" ${userConfig.multiUserMode === 'sequential' ? 'checked' : ''} style="margin-right: 5px;">
                            顺序发送
                        </label>
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="radio" name="multi-user-mode" value="random" ${userConfig.multiUserMode === 'random' ? 'checked' : ''} style="margin-right: 5px;">
                            随机发送
                        </label>
                    </div>
                </div>
                
                <div style="margin-top: 10px;">
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="dy-fire-settings-multi-retry-same" ${userConfig.multiUserRetrySame ? 'checked' : ''} style="margin-right: 8px;">
                        重试时使用同一用户
                    </label>
                    <div style="font-size: 12px; color: #666; margin-top: 5px;">启用后重试时会继续发送给同一用户，否则会切换到下一用户</div>
                </div>
            </div>

            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">点击方法</label>
                <div style="display: flex; gap: 15px;">
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="radio" name="click-method" value="direct" ${userConfig.clickMethod === 'direct' ? 'checked' : ''} style="margin-right: 5px;">
                        直接点击
                    </label>
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="radio" name="click-method" value="event" ${userConfig.clickMethod === 'event' ? 'checked' : ''} style="margin-right: 5px;">
                        事件触发
                    </label>
                </div>
                <div style="font-size: 12px; color: #666; margin-top: 5px;">直接点击更可靠，事件触发更安全</div>
            </div>

            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">页面加载等待时间(毫秒)</label>
                <input type="number" id="dy-fire-settings-page-wait" min="1000" max="15000" value="${userConfig.pageLoadWaitTime}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;">
                <div style="font-size: 12px; color: #666; margin-top: 5px;">点击用户后等待页面加载的时间</div>
            </div>
           
            <div style="margin-bottom: 15px;">
                <label style="display: flex; align-items: center; cursor: pointer;">
                    <input type="checkbox" id="dy-fire-settings-use-hitokoto" ${userConfig.useHitokoto ? 'checked' : ''} style="margin-right: 8px;">
                    使用一言API
                </label>
            </div>
           
            <div style="margin-bottom: 15px;">
                <label style="display: flex; align-items: center; cursor: pointer;">
                    <input type="checkbox" id="dy-fire-settings-use-txtapi" ${userConfig.useTxtApi ? 'checked' : ''} style="margin-right: 8px;">
                    使用TXTAPI
                </label>
            </div>
           
            <div id="txt-api-mode-container" style="margin-bottom: 15px; ${userConfig.useTxtApi ? '' : 'display: none;'}">
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">TXTAPI模式</label>
                <div style="display: flex; gap: 15px;">
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="radio" name="txt-api-mode" value="api" ${userConfig.txtApiMode === 'api' ? 'checked' : ''} style="margin-right: 5px;">
                        API模式
                    </label>
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="radio" name="txt-api-mode" value="manual" ${userConfig.txtApiMode === 'manual' ? 'checked' : ''} style="margin-right: 5px;">
                        手动模式
                    </label>
                </div>
            </div>
           
            <div id="txt-api-url-container" style="margin-bottom: 15px; ${userConfig.useTxtApi && userConfig.txtApiMode === 'api' ? '' : 'display: none;'}">
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">TXTAPI链接</label>
                <input type="text" id="dy-fire-settings-txtapi-url" value="${userConfig.txtApiUrl}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;" placeholder="例如: https://123.cn">
            </div>
           
            <div id="txt-api-manual-container" style="margin-bottom: 15px; ${userConfig.useTxtApi && userConfig.txtApiMode === 'manual' ? '' : 'display: none;'}">
                <div style="margin-bottom: 10px;">
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="dy-fire-settings-txtapi-random" ${userConfig.txtApiManualRandom ? 'checked' : ''} style="margin-right: 8px;">
                        随机选择文本
                    </label>
                </div>
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">手动文本内容（一行一个）</label>
                <textarea id="dy-fire-settings-txtapi-manual" style="width: 100%; height: 100px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical; box-sizing: border-box;">${userConfig.txtApiManualText}</textarea>
            </div>
           
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">最大重试次数</label>
                <input type="number" id="dy-fire-settings-retry-count" min="1" max="10" value="${userConfig.maxRetryCount}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;">
            </div>

            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">用户查找超时(毫秒)</label>
                <input type="number" id="dy-fire-settings-user-timeout" min="1000" max="30000" value="${userConfig.userSearchTimeout}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;">
            </div>

            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">最大历史日志数量</label>
                <input type="number" id="dy-fire-settings-max-logs" min="50" max="1000" value="${userConfig.maxHistoryLogs}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;">
            </div>

            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">查找防抖延迟(毫秒)</label>
                <input type="number" id="dy-fire-settings-debounce-delay" min="100" max="2000" value="${userConfig.searchDebounceDelay}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;">
                <div style="font-size: 12px; color: #666; margin-top: 5px;">降低频繁查找导致的性能消耗</div>
            </div>

            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">查找节流延迟(毫秒)</label>
                <input type="number" id="dy-fire-settings-throttle-delay" min="500" max="3000" value="${userConfig.searchThrottleDelay}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;">
                <div style="font-size: 12px; color: #666; margin-top: 5px;">控制查找的最小时间间隔</div>
            </div>
           
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">一言API格式</label>
                <textarea id="dy-fire-settings-hitokoto-format" style="width: 100%; height: 60px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical; box-sizing: border-box;">${userConfig.hitokotoFormat}</textarea>
                <div style="font-size: 12px; color: #666; margin-top: 5px;">
                    可用变量: {hitokoto} {from} {from_who}<br>
                    示例: {hitokoto} —— {from}{from_who}
                </div>
            </div>
           
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">from格式</label>
                <input type="text" id="dy-fire-settings-from-format" value="${userConfig.fromFormat}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;" placeholder="例如: {from}">
                <div style="font-size: 12px; color: #666; margin-top: 5px;">
                    当from不为空时显示此格式，为空时不显示
                </div>
            </div>
           
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">from_who格式</label>
                <input type="text" id="dy-fire-settings-from-who-format" value="${userConfig.fromWhoFormat}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;" placeholder="例如: 「{from_who}」">
                <div style="font-size: 12px; color: #666; margin-top: 5px;">
                    当from_who不为空时显示此格式，为空时不显示
                </div>
            </div>
           
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">自定义消息内容</label>
                <textarea id="dy-fire-settings-custom-message" style="width: 100%; height: 100px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical; box-sizing: border-box;">${userConfig.customMessage}</textarea>
                <div style="font-size: 12px; color: #666; margin-top: 5px;">
                    使用 [API] 作为一言内容的占位符<br>
                    使用 [TXTAPI] 作为TXTAPI内容的占位符<br>
                    支持换行符，关闭API时占位符标记将保留
                </div>
            </div>
           
            <button id="dy-fire-settings-save" style="width: 100%; padding: 10px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; box-sizing: border-box;">保存设置</button>
        `;

        document.body.appendChild(settingsPanel);

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

        document.getElementById('dy-fire-settings-close').addEventListener('click', function() {
            settingsPanel.remove();
        });

        document.getElementById('dy-fire-settings-save').addEventListener('click', saveSettings);
    }

    // 保存设置
    function saveSettings() {
        const timeValue = document.getElementById('dy-fire-settings-time').value;
        const enableTargetUser = document.getElementById('dy-fire-settings-enable-target').checked;
        const targetUsernames = document.getElementById('dy-fire-settings-target-user').value;
        const multiUserMode = document.querySelector('input[name="multi-user-mode"]:checked').value;
        const multiUserRetrySame = document.getElementById('dy-fire-settings-multi-retry-same').checked;
        const clickMethod = document.querySelector('input[name="click-method"]:checked').value;
        const pageLoadWaitTime = parseInt(document.getElementById('dy-fire-settings-page-wait').value, 10);
        const useHitokoto = document.getElementById('dy-fire-settings-use-hitokoto').checked;
        const useTxtApi = document.getElementById('dy-fire-settings-use-txtapi').checked;
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
       
        if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(timeValue)) {
            addHistoryLog('时间格式错误，请使用HH:mm:ss格式', 'error');
            return;
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
       
        userConfig.sendTime = timeValue;
        userConfig.enableTargetUser = enableTargetUser;
        userConfig.targetUsernames = targetUsernames;
        userConfig.multiUserMode = multiUserMode;
        userConfig.multiUserRetrySame = multiUserRetrySame;
        userConfig.clickMethod = clickMethod;
        userConfig.pageLoadWaitTime = pageLoadWaitTime;
        userConfig.useHitokoto = useHitokoto;
        userConfig.useTxtApi = useTxtApi;
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
       
        saveConfig();
        parseTargetUsers();
        updateUserStatusDisplay();
       
        document.getElementById('dy-fire-settings-panel').remove();
        addHistoryLog('设置已保存', 'success');
    }

    // 添加实时日志
    function addLog(message, type = 'info') {
        const now = new Date();
        const timeString = now.toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.style.color = type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8';
        logEntry.textContent = `${timeString} - ${message}`;
       
        const logContainer = document.getElementById('dy-fire-log');
        logContainer.prepend(logEntry);
       
        if (logContainer.children.length > 8) {
            logContainer.removeChild(logContainer.lastChild);
        }
       
        logContainer.scrollTop = 0;
    }

    // 更新重试计数显示
    function updateRetryCount() {
        document.getElementById('dy-fire-retry').textContent = `${retryCount}/${userConfig.maxRetryCount}`;
    }

    // 更新一言状态显示
    function updateHitokotoStatus(status, isSuccess = true) {
        const statusEl = document.getElementById('dy-fire-hitokoto');
        statusEl.textContent = status;
        statusEl.style.color = isSuccess ? '#28a745' : '#dc3545';
    }

    // 更新TXTAPI状态显示
    function updateTxtApiStatus(status, isSuccess = true) {
        const statusEl = document.getElementById('dy-fire-txtapi');
        statusEl.textContent = status;
        statusEl.style.color = isSuccess ? '#28a745' : '#dc3545';
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

        // 获取当前要发送的用户
        let currentTargetUser;
        if (userConfig.multiUserRetrySame && retryCount > 1) {
            // 重试时使用同一用户
            const lastSentUser = GM_getValue('lastTargetUser', '');
            if (lastSentUser && allTargetUsers.includes(lastSentUser)) {
                currentTargetUser = lastSentUser;
            } else {
                currentTargetUser = getNextTargetUser();
            }
        } else {
            currentTargetUser = getNextTargetUser();
        }

        if (!currentTargetUser) {
            addHistoryLog('没有可发送的目标用户', 'info');
            updateUserStatus('无目标用户', false);
            stopChatObserver();
            isProcessing = false;
            return false;
        }

        // 保存当前目标用户
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
                // 点击用户后，等待页面加载完成
                waitForPageLoad().then(() => {
                    addHistoryLog('页面加载完成，开始查找聊天输入框', 'info');
                    tryFindChatInput();
                }).catch(error => {
                    addHistoryLog(`等待页面加载超时: ${error.message}`, 'error');
                    // 即使超时也尝试继续
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
                            // 点击用户后，等待页面加载完成
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

            // 检查页面是否已经加载完成
            if (document.readyState === 'complete') {
                clearTimeout(timeout);
                resolve();
                return;
            }

            // 监听页面加载完成事件
            window.addEventListener('load', function onLoad() {
                clearTimeout(timeout);
                window.removeEventListener('load', onLoad);
                resolve();
            });

            // 同时检查DOM是否已经稳定（没有频繁的DOM变化）
            let checkCount = 0;
            const maxChecks = userConfig.pageLoadWaitTime / 100;
            const checkInterval = setInterval(() => {
                checkCount++;
                
                // 检查是否有聊天输入框出现
                const chatInput = document.querySelector('.chat-input-dccKiL');
                if (chatInput) {
                    clearTimeout(timeout);
                    clearInterval(checkInterval);
                    resolve();
                    return;
                }
                
                // 检查是否超时
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

        // 检查是否所有用户都已发送
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

    // 执行发送流程 - 修复版本
    async function executeSendProcess() {
        retryCount++;
        updateRetryCount();
        
        if (retryCount > userConfig.maxRetryCount) {
            addHistoryLog(`已达到最大重试次数 (${userConfig.maxRetryCount})`, 'error');
            isProcessing = false;
            currentState = 'idle';
            stopChatObserver();
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
                // 超时后会通过上面的setTimeout处理
            }
        } else {
            setTimeout(tryFindChatInput, 1000);
        }
    }

    // 尝试查找聊天输入框并发送消息
    async function tryFindChatInput() {
        // 先清除之前的检查计时器
        if (chatInputCheckTimer) {
            clearTimeout(chatInputCheckTimer);
        }

        const input = document.querySelector('.chat-input-dccKiL');
        if (input) {
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
                        
                        // 标记用户为已发送（如果是多用户模式）
                        if (userConfig.enableTargetUser && allTargetUsers.length > 0) {
                            const currentTargetUser = GM_getValue('lastTargetUser', '');
                            if (currentTargetUser) {
                                markUserAsSent(currentTargetUser);
                            }
                        } else {
                            const today = new Date().toDateString();
                            GM_setValue('lastSentDate', today);
                        }
                        
                        updateStatus(true);
                        isProcessing = false;
                        currentState = 'idle';
                        stopChatObserver();
                        
                        // 检查是否还有未发送的用户
                        if (userConfig.enableTargetUser && allTargetUsers.length > 0) {
                            const unsentUsers = allTargetUsers.filter(user => !sentUsersToday.includes(user));
                            if (unsentUsers.length > 0) {
                                addHistoryLog(`还有 ${unsentUsers.length} 个用户待发送，继续下一个用户`, 'info');
                                setTimeout(sendMessage, 2000); // 2秒后发送下一个用户
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
            addHistoryLog('未找到输入框，继续查找中...', 'info');
            // 持续检查聊天输入框，直到找到或超时
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

    // 更新状态
    function updateStatus(isSent) {
        const statusEl = document.getElementById('dy-fire-status');
        if (isSent) {
            statusEl.textContent = '已发送';
            statusEl.style.color = '#28a745';
        } else {
            statusEl.textContent = '未发送';
            statusEl.style.color = '#dc3545';
            autoSendIfNeeded();
        }
       
        const now = new Date();
       
        if (isSent) {
            nextSendTime = parseTimeString(userConfig.sendTime);
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            if (nextSendTime.getDate() !== tomorrow.getDate()) {
                nextSendTime.setDate(tomorrow.getDate());
            }
        } else {
            nextSendTime = parseTimeString(userConfig.sendTime);
            if (nextSendTime <= now) {
                nextSendTime.setDate(nextSendTime.getDate() + 1);
            }
        }
       
        document.getElementById('dy-fire-next').textContent = nextSendTime.toLocaleString();
        startCountdown(nextSendTime);
    }

    // 检查是否需要自动发送
    function autoSendIfNeeded() {
        const now = new Date();
        const today = new Date().toDateString();
       
        if (userConfig.enableTargetUser && allTargetUsers.length > 0) {
            // 多用户模式：检查是否有未发送的用户
            const unsentUsers = allTargetUsers.filter(user => !sentUsersToday.includes(user));
            if (unsentUsers.length > 0 && !isProcessing) {
                const [targetHour, targetMinute, targetSecond] = userConfig.sendTime.split(':').map(Number);
                const targetTimeToday = new Date();
                targetTimeToday.setHours(targetHour, targetMinute, targetSecond || 0, 0);
               
                if (now >= targetTimeToday) {
                    addHistoryLog(`检测到有${unsentUsers.length}个用户未发送且已过${userConfig.sendTime}，自动发送`, 'info');
                    sendMessage();
                }
            }
        } else {
            // 单用户模式：检查今日是否已发送
            const lastSentDate = GM_getValue('lastSentDate', '');
            const [targetHour, targetMinute, targetSecond] = userConfig.sendTime.split(':').map(Number);
           
            if (lastSentDate !== today) {
                const targetTimeToday = new Date();
                targetTimeToday.setHours(targetHour, targetMinute, targetSecond || 0, 0);
               
                if (now >= targetTimeToday && !isProcessing) {
                    addHistoryLog(`检测到今日未发送且已过${userConfig.sendTime}，自动发送`, 'info');
                    sendMessage();
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
                document.getElementById('dy-fire-countdown').textContent = '00:00:00';
               
                if (userConfig.enableTargetUser && allTargetUsers.length > 0) {
                    // 多用户模式：检查是否有未发送的用户
                    const unsentUsers = allTargetUsers.filter(user => !sentUsersToday.includes(user));
                    if (unsentUsers.length > 0) {
                        if (!isProcessing) {
                            addHistoryLog('倒计时结束，开始发送给未发送的用户', 'info');
                            sendMessage();
                        }
                    } else {
                        nextSendTime = parseTimeString(userConfig.sendTime);
                        const tomorrow = new Date(now);
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        if (nextSendTime.getDate() !== tomorrow.getDate()) {
                            nextSendTime.setDate(tomorrow.getDate());
                        }
                        startCountdown(nextSendTime);
                    }
                } else {
                    // 单用户模式
                    const lastSentDate = GM_getValue('lastSentDate', '');
                    const today = new Date().toDateString();
                   
                    if (lastSentDate === today) {
                        nextSendTime = parseTimeString(userConfig.sendTime);
                        const tomorrow = new Date(now);
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        if (nextSendTime.getDate() !== tomorrow.getDate()) {
                            nextSendTime.setDate(tomorrow.getDate());
                        }
                        startCountdown(nextSendTime);
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
           
            document.getElementById('dy-fire-countdown').textContent =
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
       
        update();
        countdownInterval = setInterval(update, 1000);
    }

    // 清空数据
    function clearData() {
        GM_setValue('lastSentDate', '');
        GM_setValue('txtApiManualSentIndexes', []);
        GM_setValue('lastTargetUser', '');
        resetTodaySentUsers();
        addHistoryLog('发送记录已清空', 'info');
        updateStatus(false);
        retryCount = 0;
        updateRetryCount();
        updateHitokotoStatus('未获取');
        updateTxtApiStatus('未获取');
        updateUserStatusDisplay();
        stopChatObserver();
        if (chatInputCheckTimer) {
            clearTimeout(chatInputCheckTimer);
        }
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
            }
        } else {
            GM_setValue('lastSentDate', '');
            GM_setValue('userConfig', '');
            GM_setValue('txtApiManualSentIndexes', []);
            GM_setValue('historyLogs', []);
            GM_setValue('sentUsersToday', []);
            GM_setValue('currentUserIndex', -1);
            GM_setValue('lastTargetUser', '');
        }
       
        initConfig();
        addHistoryLog('所有配置已重置', 'info');
        updateStatus(false);
        retryCount = 0;
        updateRetryCount();
        updateHitokotoStatus('未获取');
        updateTxtApiStatus('未获取');
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

    // 初始化函数
    function init() {
        isScriptCat = detectScriptCat();
        initConfig();
        createControlPanel();
       
        // 检查每日重置
        const today = new Date().toDateString();
        const lastResetDate = GM_getValue('lastResetDate', '');
        if (lastResetDate !== today) {
            resetTodaySentUsers();
            GM_setValue('lastResetDate', today);
        }
       
        const lastSentDate = GM_getValue('lastSentDate', '');
        const isSentToday = lastSentDate === today;
       
        updateStatus(isSentToday);
        updateUserStatusDisplay();
       
        if (typeof GM_registerMenuCommand !== 'undefined') {
            try {
                GM_registerMenuCommand('抖音续火助手-显示面板', function() {
                    document.getElementById('dy-fire-helper').style.display = 'block';
                });
                GM_registerMenuCommand('立即发送续火消息', sendMessage);
                GM_registerMenuCommand('设置', showSettingsPanel);
                GM_registerMenuCommand('历史日志', showHistoryPanel);
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
            const [targetHour, targetMinute, targetSecond] = userConfig.sendTime.split(':').map(Number);
           
            if (now.getHours() === targetHour &&
                now.getMinutes() === targetMinute &&
                now.getSeconds() === (targetSecond || 0)) {
               
                if (userConfig.enableTargetUser && allTargetUsers.length > 0) {
                    // 多用户模式：检查是否有未发送的用户
                    const unsentUsers = allTargetUsers.filter(user => !sentUsersToday.includes(user));
                    if (unsentUsers.length > 0) {
                        addHistoryLog('定时任务触发发送', 'info');
                        sendMessage();
                    }
                } else {
                    // 单用户模式
                    const today = new Date().toDateString();
                    const lastSentDate = GM_getValue('lastSentDate', '');
                   
                    if (lastSentDate !== today) {
                        addHistoryLog('定时任务触发发送', 'info');
                        sendMessage();
                    }
                }
            }
        }, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
