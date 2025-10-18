// ==UserScript==
// @name         抖音续火花自动发送助手-集成一言API和TXTAPI
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  每天自动发送续火消息，支持自定义时间，集成一言API和TXTAPI，消息内容更丰富，支持动态聊天列表和历史日志
// @author       飔梦 / 阚泥
// @match        https://creator.douyin.com/creator-micro/data/following/chat
// @icon         data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAAAXNSR0IArs4c6QAAF19JREFUeF7tnQl8U1X2x38vabqlLWOFrpStUMrWsrdUEARkEREQCoiAghswHQdQEFREGXfhD24MjOiMIqKD4IyICCObFCgt1JaC0ELpmq0L3ZLuyft/bkpL8pI07yUvaVre/Xz6KTT3nnvOud93381dzqXAU+riGzJarMMoGogGqD4A3RXAPQC8eKribhSjBVBJA0UUkAfgGgXq90YRzpZUybL4cAhlj5BAn9DxoOkFAGYB8LdHllCWsweuAfgvDWpvkUaWzrn07QI2ARDkExpPg14FGqNsrVgox58HaFCHAd2HRRrFEa5SOQEQ7B08VEdR7wCYxLUiIb8TPEDjB0qke1WpVv7BtjbWAARJQ9bQwPtsBQv52tID9CqVRrGNjQZsAKACpSG7ATzORqCQxzU8QIHerdQoFlvTplUAuvp19W/Q0gcAeqw1QcLnrugB+qRELJ5dWFl4y5J2FgFoanztYYAa6YqmCTqx9QCdLBGLp1qCwCIAgdLgEwA1jm01Qj5X9gB1SqWRPQCAZmppFoAgafBXNKhFrmySoBtnD+xRaeQLrQIQKA1eCVBbOYsXCri8ByhgrVIj/8BQUaMeIMgnqD9Ni664vCWCgjZ7QETTwxTVitRmAUYABHqHHACln9YVUsf1wFGVRj7ZBIAAafBkCtQvHddu85aJ40bYbbL2bIrdMpwpgKKouUq1bB+ps6UHCJCG/kyBnupMRVyhLj/VZbvUqN/5FWpfa2cTpBTOqdTyuBYAAqSh0RToNLs80U4L2wtAw76DqElY3/6sp6gJKrXsuL4HCJSGvAvgpfZnhf0a2wtA45GTqF6cYL8izpfwuUojf7oZgKsAIp2vQ9vXyARg2NVsTkr1u5aPtJWvmpQ5W1vBSU4bZL6l0sjvpTr7hkaIdXRmGyjgElUyARh+LRvfDBvOWrfClEvotGQTfChRS5knVVdxpNri9Dtr2Y7OqBNhDBUkDX2SBv1PR1fmqvKZAIy4lo09HAAgdmWMegwD1WT3VlNKKM7CfnWxq5rcoheZGCJLvR8CeN7ltXWQgkwARl7LxtccAUhauh4xKXdeHa+U3sQXlQoHacyr2D0EALKN6K7d4cMEIObaTeweNoyTl7P2/4I+r3/RUmZzWT62lBdwktE2malkKkAaco0C+raNAm1fKxOA2Myb+GooNwCIFckPLMaIklq9QadqyjFf2S5m1OWkByCjFbJ9+65MTABGZd7ElzYAcGnHNxj06X/0PizWNiAqP7k9+LOGANAIQNwetHWEjnwBQHS7GLcAQ6uIO4EJsjT8Ua9xhMq8yiQAmGwS4LUGFxfGBCAuMwf/GjrUJq1vHDyGLuu3w48S441budhRIbNJjjMLCQAw1gLuy8rBP4fYBgBpuLPLNmDUmUxcqKvCdPklZ7alTXUJADAAGJ2Vgy/sAMDwVRCvvIzEGteeERQAYAAwJisHn9sJQPOr4LCmFCuLr9v0ZDqrkAAAA4D7s3Kxa8gQu/2f/vFX6LLjAN4szcUBF54VFABgADD2ei4+G2w/AISggp9PomrtVswtSEeJtsFuqBwhQADAgQCQBqu/no+f5iZgxfWLjmg/u2UKADAAGHc9D/8YPNhuxxoJKK/CW7OfxsfnE/mVy4M0AQAGAA9cz8NOvgEgDUXTmLNtO85s/gR0RSUPTcePCAEABgDjb+RhRzTPPYBBWy0+cRKnjv+G+m8OgFa1/ZKxAAADgAk38vB3BwJAWFiReAb/69UV2sRkNJ5OQsOPR0GXts0GEgEABgATb+Rje3Q0P/1rK1I+/y0R2yN6oMpXqs/VeDYFdKECOpkCdHEp6JJS6IpvwdFbzgUAGAA8mJ2PT6McDwBp9CtZ2fiopAgnos1vx9TMWiIA4OhHkbkY5EwAmm376XwK9rhRuBgZbmSuAICjWx8AE4BJ2fn4xEk9ANO8vYnncBxapPcIQ/k9fhAAaAMAJmcX4OOoKCfUbLkKlaoY57NvomrLl0g5ew5FjQ0o0tajSNv0m88kjAEYY4ApNwvw0aC2BaC5gS8Pj8eAOuMQDsE5Z/hsfwgAMACYerMAHwoA8AqZSwtjjgEeulmAbQIALt1mvCpnCkAhtg0axGsdtgoTXgG2eo5DOSYA03IKsXUgewAq8mTo1D2UQ43sswoAsPeVzTmZADycU4j/4wDA5S/2oTpXhpGbVtqsg6WCAgC8u9RUIBOA6TkybBk4kHXNBIABW/chuYsX7n1+IXrPfJB1WWsZBQCseYiHz5kAPJIjw2YbACCqqGktMgb3xJCPNsDLv5Pd2gkAMFxIBQdCPKgfRIFdQJGfoC76f8PDHaiuAa2pBq2uBtQaNBw7zWoenQnAjFwZPhjAvQcwVPWGWIvioX3Q7Zm56DrK9i3mAgDkyFLcCLiNHw23cXH6xmeb2E6jOgKAVSXXscm/FzwoEdI7e0E8JQ7D1i1jq3pLvrsWAFG3UEgemwXJzKkQ9erO2XGkgK0AzMyV4/0BA1jX2TwGMCwwW3EZJEJIQqeueMW/Sf8ckRaKAd3h98AIRC6cBYmXp9U67joARJG94U4a/rFZoDr5WXVQaxlsBWBWrhzv8QQA0a+HxFMPwuO+gS3qVtJa3PDzQF1UOAKmjUPv6RPMmnLXAEBJveHx+ov6xodEwrnhO5eUIbi0DKHqanTT0ejr44OeL3yEvIIClOkaUU1rUa3T4d0ycu+ScWK+Ah7Nk+Pd/vz0AIY1TfS+B3N9AjBd2tlEBx1o1NA0akGjjiI/FBrETT8dfi1A1LMbPLe8Drf72Eeld6+tw8jLWZgAEaYOGgB/f9PT7edHxmNkjfWFFCYAs/PkeMcBADS3+jAPX8z1DUC8TwC8DOIKsaW+Qy0GiWOGwvubv4PyadoW1VoKkasQU6BErMQdU4YPgZdX67fRHY+NxwMa7gDMyVPg7f79ralzZ6B2ex7A3BigNSG9JF76HmGStz/6uXuzrq/DACB5ZDK8Ptti1XC/SjWeysrF8rFjrOY1zHBoVDweUnMHID5fgbf6OR4AQ10Dxe6I8vBBlLsU0eS3hw/I38ylDgGA53sb4P7kPKsNOj31Cp4L7YqIXj2s5mVm2B8Xj0er2gcA5ozzpkS4Vyxp+eksavr3dp5jDjh9P4DXzs2QzJzSaoP2y87HMzX1eDjG9kDO394Xj3mV3AGYm6/Am07uATjTzWMBpwLgvmQ+PN81jappaM/ylAwsj42Bp6eHXWbaCsC8fCX+1o/9hFNr8wB2GeCkwk4DgHzH9znVFETJUlqeeBGrJk/kxXRbAZhfoMSmSAEAXhrBUIjPyQMQ9YuwKPe53T/ghWVLeavXVgAeK1DiDQEA3tpBL8jzg41wXxxvUeizu77Di3/lPlfempa2ArCgQInXBQD4A0Aydwa8Pn7LosBlPx3H6nmz+avwtiTbAVDh9Uj2gdOFMUArTUf5+kB6aA9EfY1PvDQXWZ5yGavGcft+z5YUWwF4vFCFjX0FANj6udV8Hi+ugMeaFWbzRJ1Pw7f33w83NztjVNbWAeVVQFkV0NAIRPYA3CWwFYCFhSq8JgBgf/uTp548/aQXYCZdbgH+cUuN8WP019ZwT9dy8cdn38LvdDpCa+6EaW8WVCemIBPR6MUIy2NuFo25FrCosAgb+rIPnSy8Aiw0n+db6+H+tPkLxxd8/zNef4L7ZeSl+/8HzdbdCKtoCsrMNbEBYHFhEV4VAODqWtP8Pkk/g6z0MVOPU0n4NjbW7AqexVq1OmQl/A19Eu2LwM0GgCdkRXglQugB7CLAbcIY/SqfufT++QzMHH8/e/nZhchZ8gp6lNWwL2MhpwCAqWMcMhNoqfufkXIJH4wby74hswshm78GIbWm73mmkNS6Kn1AxtQ6Ncp1DSjTNqJc14ieEk/0dPPS//7czC0ezDHAk7JivBxhecKKWa8wBjDTnD6//dfsV79d1wtw/2CWJ2+ra5E/bgnCzAzyDKskjb67SomkWtsibzEBWCIrxnoBAPYPKTMnGf0TAJgpXF6Ew33Yv1szlr6CgSmtx9ndVl6A98rybVfWTICIpfJirOsj9AA2O1WycDa8trxhUn5ZRhZWx8awkluRdhV+iza2mndYwQXIG+tYyWstE7MHeEpejJcEAGz3q9cX2yCZZrqit09WiuiI3qwEX0zYhKGnLN/pO7QgBYpGfiJlMAF4Wl6CtX36sNKTZBLGAAxXSY9+B3G08a5art3/leFz0d/Cw9285551C1nJKADA85Ux5r7/L0+9glVjRrNqs8zTyYhYsdls3rdu5eGTikJWcthmYgLwjKIEa3oLPQBb/5nk8716GhRjm/aeHAVGDGS30fL7v7yG2SevmchNq1NjuuISGml+rzhiAvCsogQvCgDY3P7wk6UDjAWeQ0WV6NOT3RGvg8texsNnbpgo8FxRJn7UlNiumIWSTACeU5Tihd7sxirCGMCMU81dx36mRocune9l1XhHn3oJDybnGOW92VCD+wpTWZXnmomp7zJlKVaHCwBw9WNLfnMA/OHhCzc3N1YyTy56EWPTjL/bkyef9AB8J3Lc3DftmJHY5cpSrBIAsN3VTACkmmr8HsA+hs7/lqzFxAu5Rgq8VpqDzyrltitloSQ5ei79wfji9BXKW1gZbn4Dizkx5zduw8gDZ40+4vubCu+GGwjkfS2ACUCwshinwtnPrKUc+hXD1/3DyOZ5yiv4raacdz+Ym7TiCsCJmcsxLrtUAKDZA74ZJ0EF3DkBG5mdjx85xt49FjkF4yV3joc7agDo+c4rcF/6mFHjPS8vQQKHiaCk4XMQUycykjFNfglkcao9JN57AO+9O/QRPZrTkMyb+I7jZcy7Jy3GQsWdTR/rSrPxZaWSV3+S+AM+p/+rDzVjmF7OLsSTUezDxGX3fwS9xMbBHkYXpiK7wf7la14NtiCMdwA8N6yGe8Kd/f3heXIc5nDcmuh5YOeXGLJ1vz64AknkXP+H5fxOAEkWPAqvrZtM3PJOZi5mD2V3bVz66fOIWmF6wHVgfjJKXfSaOKbBvAPAdGyXkjKc6d6LM8xfT3kCj8uaniJHfAvw3rMdbhNNN6Z8kpmHSUPZ3Rl0eNM2TNlnPAAk+oblnuV9woqzA1kW4B0A8ZBBkP6yt6V6j7p6ZPjfCY/CUi+kpaajZv46xHr4oqCxDiMLLrAtajWfJ4lGsvxJs/m+zCrAqCHs9izsm5uAOVeLjOSotPUYnJ9iVQdXycA7AMQw7+93wW1MbIuNp9QNCA4M4GzzD39+FQ+dugZ3SoSxhb8jq6GaswxmAfHwaP1uZXMpLCkVxyaYj9djLv+h4bPwUJ1xSJvk2krMUGTYraezBDgEADKyJiPs5vThlWxMHTncJpu+W7kRsUd+xy+aW9h4y3iGkKtAMuDzvXTCYrFlv57F6hnTWIk9tWsvYrbt14eCM0z71EV43sUvjDbU1yEAUMEB8Ek82BL65dmUDLw4jsNGUEYT/Oulv6HfgTN6AMiikC3JbdI4eO/+xGJRt0I5jnh3QlhYV1biD49fhCnFpmvWm8vysaW8gJUMV8jkEACIYWSETQaEJI1Pv4odcTYeArntpezMG8h4Yj2WXTYddLXmSFFYCCTzZlo8odRc9pnTF7BmCrs4v1eOn0FAwmZ0FptGNBtTmIob7eQrILHdYQC4jR4J7/1f6P3bqaIKR7074Z4/2R8/9+W3P8Hu3Ew07DsINFi+kVs8MBKSeTP0jU918m31YXsoKxfbOFwZ/+ucBEzINB78kQou1akxWZ7uCg82ax0cBgDRwHBS6L30LMyKY7cn0Jr2Pfd+CxJkqvG3c6DLKpp+yisgCugMqkcYyFMvCmO//pAlNQ0zZ0mH0nwZqqb+Gd1FpkGc3i7Lw8c8z1dY84W9nzsUAMmch+H16bt6Haf9fgVbR7PbFWTNqAvJFzEnKQnuTy2wlrXVzwedPo/9U1qPV8QUkLj8NdyXaLphheSbJEtHRr1tYxS7DLGjsEMB0PcC+z+H2+gY/WvgkMQbAV1MI2Xaon9VZRWe27ELydMfBIktzCk1NmJRSgY2TBzPqVjZzXyUzlqFcJ3piWYy90/WANpbcjgA5Hu39/efg/LyxKoLlznH+7Pm0P8cPIyk2loc6x6MigGtnzugi0oQn5WL+d26Iaof+zMKzTokTVqKGIX5J3xNSTa+ruJ3vcKa7Xx87nAAiJLuyxbD84216FGgwMGe4fDwsC8CmCXDz6VdwpnyclRSFKpEFKokboCORoSmBj0oCpEBXRAVxf4uAMN6kl54GzFH08xW3R4Hf82GOAUAUhmJCkoGbq+lXsVCW+MC8IG8DTKyfzqOe9Z9inso88Es2uvTT1zhNABIZT6//4rQ+kZ87eePMA6jdBvajNciabHzEa3Rdbin3+kAkAp9s87ikQuXseURdlOuvLakDcLOLFiNuAzLS9Ht+elvEwBIpdKj/8Y7VbWYO5n9wosNbWd3kbOPJmDUddMJn2bB/9GUYLkDNqvarTgHAU59BRjqFfTdZ9gV1g3DbRyUcbDRpqznpj2L2HzL+xBzGmoRV3jRJtmuVKjNACBOGPb+RvxzzqMIMNhD6ArOSXpwKWKUrU/oTJCl4Y96jSuoa48OWgIAWWRv/fYFe6qwUvbhZUuwK2EF0CPEgbWwF508bjFGlLYehOovxVn4Xl3MXqjr5iwjAMgAtKn3n+kXjUXjJyDivRfazFUX3vwU0gMnENlgvL7PVGhDaQ52OeCMQlsYTgOZVKA09DxAs7+wx0GaksuU1vbsD9Gf5yN80QwH1WIq9ureg9Bs/w7Dyq3HG5guv4QL7WS7N0sHHiU9wNcAuAftY1kDl2wEgvc7hyOrTzBCVj+BsPsdx+WVf30P9e5DGFlk/T1OtnmtLLkOMvDrYOkjKkgasoYG3ncVw8gFSiv/FIZHpJ2R4Qmoo8IROGsiwh+2/yujWlWC63t+hPbAMQyrsLyXwNAXhzSlWF1yA5W6RldxEW96UKCWUF18Q0aLdDjNm1SeBJGLFgkIXd2a1g1kaERBty4QR/eBf+xg9Jw8FmIPy3cM1mlqoEzNQFHaVVQnpsLvphwRNTTIXTxsUka9BjsrZNjfMQZ7Zk3Wiqi++kt1AqUh5HCbPxvHODNPkNgdS/2CscQvGD4i03n4PKoRanfjv4u1NPwbdAig2J1GZtpDDnTsrJRjZ4Uc9bT56V9n+sCBdV1TaeT9mgHYBeApB1Zml+jeEq8WEOwS1ErhKp0W+9VF+sbP7XjvenOWv6fSyNc1AeATOh40bXxQ3lGetkNuhMQb06X36q9f7cvhssXWqjxWXYYj1bfwc3VpuznOZYcLW4rSoAYXaWTpLfeqBfqEnAWNUXwId4aMkZ5+eNDbHz3cPPVnCMlvc68JQ11qaZ0+vJxCW4eDmlIc1JTcVY3e7Asa1OEijewh8v8WAIJ8QuNpmv63MxrPUXWQbdrNQHR384RSW3+7wcnvOn3sYCEBNOgpRRrFESMAbg8GyR8nCU7qwB6g8YOqWt50YMOwByD/CfYOHqqjqPa/xNWB289e0yhKN0CpVv5hFgDyR1ebGLLXYKG8oQfoVSqNYpvhX4wv1739iStNDwsNyI8HKNC7lRrFYqY0swA07RUMPQHQHG534EdRQYojPECfVGkUD5iTbAkAdPXr6t+g1R4GKMetyDjCVkEmwwN0skQsnlpYWXiLEwAk820I9gPUOMGv7dED1CmJmHrUUuObfAuwZGKQNPgrGtSi9uiCu1jnPSqNnLRZq9G1Lb4CmI4LlAavBKitd7FD243pFLBWqZF/wEZh1gDovyL6BPWndaI3QWEWG+FCHqd74KiIptcrqhWsI2tzAqDZnABp8GRA9FcK9FSnmyhUaOoBCucoUFuVatk+ru6xCYA7IIRGU6BJrFWyiY/9ldtctRTym/MAGdX/AIr6RqWWHbfVRXYBYFhpZ9/QCDcd4mjQJMxmJA10pwASG44E/bXzinBbzesQ5Ui0zDKAKgTo6xSQrhXhXHGVPJEP6/4fAayH1yFvEgIAAAAASUVORK5CYII=
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
        useTxtApi: true, // 默认开启TXTAPI
        txtApiMode: "manual", // 默认手动模式
        txtApiManualRandom: true, // 手动模式是否随机选择
        customMessage: "—————每日续火—————\n\n[TXTAPI]\n\n—————每日一言—————\n\n[API]\n",
        hitokotoFormat: "{hitokoto}\n—— {from}{from_who}",
        fromFormat: "{from}",
        fromWhoFormat: "「{from_who}」",
        txtApiUrl: "https://v1.hitokoto.cn/?encode=text",
        txtApiManualText: "文本1\n文本2\n文本3",
        targetUsername: "请修改此处为续火目标用户名", // 新增：目标用户名
        maxLogCount: 200 // 最大日志数量
    };

    // 状态变量
    let isProcessing = false;
    let retryCount = 0;
    let countdownInterval = null;
    let isScriptCat = false;
    let userConfig = {};
    let nextSendTime = null;
    let chatObserver = null; // 聊天列表观察器
    let hasClickedTarget = false; // 是否已点击目标用户
    let initialAttemptTimer = null; // 初始尝试定时器
    let debounceTimer = null; // 防抖定时器
    let allLogs = []; // 所有日志记录
    let sendProcessObserver = null; // 发送流程中的观察器

    // 检测是否是ScriptCat
    function detectScriptCat() {
        return typeof ScriptCat !== 'undefined' ||
               (typeof GM_info !== 'undefined' && GM_info.scriptHandler === 'ScriptCat');
    }

    // 初始化配置
    function initConfig() {
        // 从存储中获取用户配置
        const savedConfig = GM_getValue('userConfig');
        userConfig = savedConfig ? {...DEFAULT_CONFIG, ...savedConfig} : {...DEFAULT_CONFIG};
       
        // 确保所有配置项都存在
        for (const key in DEFAULT_CONFIG) {
            if (userConfig[key] === undefined) {
                userConfig[key] = DEFAULT_CONFIG[key];
            }
        }
       
        // 初始化手动文本发送记录
        if (!GM_getValue('txtApiManualSentIndexes')) {
            GM_setValue('txtApiManualSentIndexes', []);
        }

        // 初始化日志记录
        allLogs = GM_getValue('allLogs', []);
       
        GM_setValue('userConfig', userConfig);
        return userConfig;
    }

    // 保存配置
    function saveConfig() {
        GM_setValue('userConfig', userConfig);
    }

    // 创建UI控制面板
    function createControlPanel() {
        // 移除可能已存在的面板
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
            width: 400px;
            background: rgba(255, 255, 255, 0.98);
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            z-index: 9999;
            font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
            padding: 15px;
            color: #333;
            transition: all 0.3s ease;
            max-height: 500px;
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
                <div style="display: flex; justify-content: between; margin-top: 8px;">
                    <span style="font-weight: 500;">一言状态:</span>
                    <span id="dy-fire-hitokoto">未获取</span>
                </div>
                <div style="display: flex; justify-content: between; margin-top: 8px;">
                    <span style="font-weight: 500;">TXTAPI状态:</span>
                    <span id="dy-fire-txtapi">未获取</span>
                </div>
                <div style="display: flex; justify-content: between; margin-top: 8px;">
                    <span style="font-weight: 500;">聊天目标:</span>
                    <span id="dy-fire-chat-target">${hasClickedTarget ? '已找到' : '寻找中'}</span>
                </div>
            </div>
           
            <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 15px;">
                <button id="dy-fire-send" style="padding: 8px 12px; background: #007bff; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">立即发送续火消息</button>
                <button id="dy-fire-settings" style="padding: 8px 12px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">设置</button>
                <div style="display: flex; gap: 10px;">
                    <button id="dy-fire-history" style="flex: 1; padding: 8px 12px; background: #17a2b8; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">历史日志</button>
                    <button id="dy-fire-clear" style="flex: 1; padding: 8px 12px; background: #dc3545; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">清空记录</button>
                </div>
                <button id="dy-fire-reset" style="padding: 8px 12px; background: #ffc107; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">重置配置</button>
            </div>
           
            <div style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 10px;">
                <div style="font-weight: 500; margin-bottom: 8px;">操作日志</div>
                <div id="dy-fire-log" style="font-size: 12px; height: 100px; overflow-y: auto; line-height: 1.4;">
                    <div style="color: #28a745;">系统已就绪，等待执行...</div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        // 添加关闭按钮事件
        document.getElementById('dy-fire-helper-close').addEventListener('click', function() {
            panel.style.display = 'none';
        });

        // 添加按钮事件
        document.getElementById('dy-fire-send').addEventListener('click', sendMessage);
        document.getElementById('dy-fire-settings').addEventListener('click', showSettingsPanel);
        document.getElementById('dy-fire-history').addEventListener('click', showHistoryPanel);
        document.getElementById('dy-fire-clear').addEventListener('click', clearData);
        document.getElementById('dy-fire-reset').addEventListener('click', resetAllConfig);
    }

    // 显示设置面板
    function showSettingsPanel() {
        // 移除可能已存在的设置面板
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
            background: white;
            border-radius: 12px;
            box-shadow: 0 5px 25px rgba(0, 0, 0, 0.2);
            z-index: 10000;
            padding: 20px;
            font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
            max-height: 90vh;
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
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">目标用户名</label>
                <input type="text" id="dy-fire-settings-target-username" value="${userConfig.targetUsername}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;" placeholder="要自动点击聊天的用户名">
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
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">一言API格式</label>
                <textarea id="dy-fire-settings-hitokoto-format" style="width: 100%; height: 60px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical; box-sizing: border-box;">${userConfig.hitokotoFormat}</textarea>
                <div style="font-size: 12px; color: #666; margin-top: 5px;">
                    可用变量: {hitokoto} {from} {from_who}<br>
                    示例: {hitokoto} ------ {from}{from_who}
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

        // 添加TXTAPI模式切换事件
        const modeRadios = document.querySelectorAll('input[name="txt-api-mode"]');
        modeRadios.forEach(radio => {
            radio.addEventListener('change', function() {
                const mode = this.value;
                document.getElementById('txt-api-url-container').style.display = mode === 'api' ? 'block' : 'none';
                document.getElementById('txt-api-manual-container').style.display = mode === 'manual' ? 'block' : 'none';
            });
        });

        // 添加TXTAPI开关切换事件
        document.getElementById('dy-fire-settings-use-txtapi').addEventListener('change', function() {
            const useTxtApi = this.checked;
            document.getElementById('txt-api-mode-container').style.display = useTxtApi ? 'block' : 'none';
           
            // 根据当前选择的模式显示相应的表单
            const currentMode = document.querySelector('input[name="txt-api-mode"]:checked').value;
            document.getElementById('txt-api-url-container').style.display = (useTxtApi && currentMode === 'api') ? 'block' : 'none';
            document.getElementById('txt-api-manual-container').style.display = (useTxtApi && currentMode === 'manual') ? 'block' : 'none';
        });

        // 添加关闭按钮事件
        document.getElementById('dy-fire-settings-close').addEventListener('click', function() {
            settingsPanel.remove();
        });

        // 添加保存按钮事件
        document.getElementById('dy-fire-settings-save').addEventListener('click', function() {
            const timeValue = document.getElementById('dy-fire-settings-time').value;
            const targetUsername = document.getElementById('dy-fire-settings-target-username').value;
            const useHitokoto = document.getElementById('dy-fire-settings-use-hitokoto').checked;
            const useTxtApi = document.getElementById('dy-fire-settings-use-txtapi').checked;
            const txtApiMode = document.querySelector('input[name="txt-api-mode"]:checked').value;
            const txtApiRandom = document.getElementById('dy-fire-settings-txtapi-random').checked;
            const txtApiUrl = document.getElementById('dy-fire-settings-txtapi-url').value;
            const txtApiManualText = document.getElementById('dy-fire-settings-txtapi-manual').value;
            const maxRetryCount = parseInt(document.getElementById('dy-fire-settings-retry-count').value, 10);
            const hitokotoFormat = document.getElementById('dy-fire-settings-hitokoto-format').value;
            const fromFormat = document.getElementById('dy-fire-settings-from-format').value;
            const fromWhoFormat = document.getElementById('dy-fire-settings-from-who-format').value;
            const customMessage = document.getElementById('dy-fire-settings-custom-message').value;
           
            // 验证时间格式 (HH:mm:ss)
            if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(timeValue)) {
                addLog('时间格式错误，请使用HH:mm:ss格式', 'error');
                return;
            }
           
            // 验证重试次数
            if (isNaN(maxRetryCount) || maxRetryCount < 1 || maxRetryCount > 10) {
                addLog('重试次数必须是1-10之间的数字', 'error');
                return;
            }
           
            // 验证TXTAPI链接（仅在API模式下）
            if (useTxtApi && txtApiMode === 'api' && !txtApiUrl) {
                addLog('请填写TXTAPI链接', 'error');
                return;
            }
           
            // 验证手动文本（仅在手动模式下）
            if (useTxtApi && txtApiMode === 'manual' && !txtApiManualText.trim()) {
                addLog('请填写手动文本内容', 'error');
                return;
            }
           
            // 更新配置
            userConfig.sendTime = timeValue;
            userConfig.targetUsername = targetUsername;
            userConfig.useHitokoto = useHitokoto;
            userConfig.useTxtApi = useTxtApi;
            userConfig.txtApiMode = txtApiMode;
            userConfig.txtApiManualRandom = txtApiRandom;
            userConfig.txtApiUrl = txtApiUrl;
            userConfig.txtApiManualText = txtApiManualText;
            userConfig.maxRetryCount = maxRetryCount;
            userConfig.hitokotoFormat = hitokotoFormat;
            userConfig.fromFormat = fromFormat;
            userConfig.fromWhoFormat = fromWhoFormat;
            userConfig.customMessage = customMessage;
           
            // 保存配置
            saveConfig();
           
            // 更新状态
            updateStatus(GM_getValue('lastSentDate', '') === new Date().toDateString());
            updateRetryCount();
           
            // 关闭设置面板
            settingsPanel.remove();
           
            addLog('设置已保存', 'success');
            
            // 重启聊天观察器
            initDynamicChatClick();
        });
    }

    // 显示历史日志面板
    function showHistoryPanel() {
        // 移除可能已存在的历史面板
        const existingHistory = document.getElementById('dy-fire-history-panel');
        if (existingHistory) {
            existingHistory.remove();
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
            width: 600px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 5px 25px rgba(0, 0, 0, 0.2);
            z-index: 10000;
            padding: 20px;
            font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
            max-height: 90vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
        `;

        // 获取所有日志
        const logs = GM_getValue('allLogs', []);
        
        historyPanel.innerHTML = `
            <h3 style="margin: 0 0 20px 0; color: #ff2c54; display: flex; justify-content: space-between; align-items: center;">
                <span>历史日志 (${logs.length} 条)</span>
                <button id="dy-fire-history-close" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #999;">×</button>
            </h3>
            
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <button id="dy-fire-history-clear" style="padding: 6px 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">清空所有日志</button>
                <button id="dy-fire-history-export" style="padding: 6px 12px; background: #17a2b8; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">导出日志</button>
            </div>
            
            <div id="dy-fire-history-content" style="flex: 1; overflow-y: auto; border: 1px solid #eee; border-radius: 4px; padding: 10px; font-size: 12px; line-height: 1.4;">
                ${logs.length === 0 ? '<div style="text-align: center; color: #999; padding: 20px;">暂无历史日志</div>' : ''}
                ${logs.map(log => `
                    <div style="margin-bottom: 5px; color: ${log.type === 'success' ? '#28a745' : log.type === 'error' ? '#dc3545' : log.type === 'warning' ? '#ffc107' : '#17a2b8'};">
                        ${log.time} - ${log.message}
                    </div>
                `).join('')}
            </div>
        `;

        document.body.appendChild(historyPanel);

        // 添加关闭按钮事件
        document.getElementById('dy-fire-history-close').addEventListener('click', function() {
            historyPanel.remove();
        });

        // 添加清空日志按钮事件
        document.getElementById('dy-fire-history-clear').addEventListener('click', function() {
            if (confirm('确定要清空所有历史日志吗？此操作不可恢复。')) {
                GM_setValue('allLogs', []);
                allLogs = [];
                document.getElementById('dy-fire-history-content').innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">暂无历史日志</div>';
                addLog('历史日志已清空', 'info');
            }
        });

        // 添加导出日志按钮事件
        document.getElementById('dy-fire-history-export').addEventListener('click', function() {
            if (logs.length === 0) {
                alert('没有日志可导出');
                return;
            }
            
            const logText = logs.map(log => `${log.time} - ${log.message}`).join('\n');
            const blob = new Blob([logText], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `抖音续火助手日志_${new Date().toISOString().slice(0, 10)}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            addLog('日志已导出', 'success');
        });

        // 自动滚动到底部
        const content = document.getElementById('dy-fire-history-content');
        if (content) {
            content.scrollTop = content.scrollHeight;
        }
    }

    // 添加日志
    function addLog(message, type = 'info') {
        const now = new Date();
        const timeString = now.toLocaleTimeString();
        const logEntry = {
            time: timeString,
            message: message,
            type: type
        };
        
        // 添加到内存中的日志
        allLogs.push(logEntry);
        
        // 限制日志数量
        if (allLogs.length > userConfig.maxLogCount) {
            allLogs = allLogs.slice(-userConfig.maxLogCount);
        }
        
        // 保存到存储
        GM_setValue('allLogs', allLogs);
       
        const logEntryElement = document.createElement('div');
        logEntryElement.style.color = type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : '#17a2b8';
        logEntryElement.textContent = `${timeString} - ${message}`;
       
        const logContainer = document.getElementById('dy-fire-log');
        if (logContainer) {
            logContainer.prepend(logEntryElement);
           
            // 限制日志数量
            if (logContainer.children.length > 8) {
                logContainer.removeChild(logContainer.lastChild);
            }
           
            // 自动滚动到顶部
            logContainer.scrollTop = 0;
        }
    }

    // 更新重试计数显示
    function updateRetryCount() {
        const retryElement = document.getElementById('dy-fire-retry');
        if (retryElement) {
            retryElement.textContent = `${retryCount}/${userConfig.maxRetryCount}`;
        }
    }

    // 更新一言状态显示
    function updateHitokotoStatus(status, isSuccess = true) {
        const statusEl = document.getElementById('dy-fire-hitokoto');
        if (statusEl) {
            statusEl.textContent = status;
            statusEl.style.color = isSuccess ? '#28a745' : '#dc3545';
        }
    }

    // 更新TXTAPI状态显示
    function updateTxtApiStatus(status, isSuccess = true) {
        const statusEl = document.getElementById('dy-fire-txtapi');
        if (statusEl) {
            statusEl.textContent = status;
            statusEl.style.color = isSuccess ? '#28a745' : '#dc3545';
        }
    }

    // 更新聊天目标状态显示
    function updateChatTargetStatus(status, isSuccess = true) {
        const statusEl = document.getElementById('dy-fire-chat-target');
        if (statusEl) {
            statusEl.textContent = status;
            statusEl.style.color = isSuccess ? '#28a745' : '#dc3545';
        }
    }

    // 获取消息内容
    async function getMessageContent() {
        let customMessage = userConfig.customMessage || userConfig.baseMessage;
       
        // 获取一言内容
        let hitokotoContent = '';
        if (userConfig.useHitokoto) {
            try {
                addLog('正在获取一言内容...', 'info');
                hitokotoContent = await getHitokoto();
                addLog('一言内容获取成功', 'success');
            } catch (error) {
                addLog(`一言获取失败: ${error.message}`, 'error');
                hitokotoContent = '一言获取失败~';
            }
        }
       
        // 获取TXTAPI内容
        let txtApiContent = '';
        if (userConfig.useTxtApi) {
            try {
                addLog('正在获取TXTAPI内容...', 'info');
                txtApiContent = await getTxtApiContent();
                addLog('TXTAPI内容获取成功', 'success');
            } catch (error) {
                addLog(`TXTAPI获取失败: ${error.message}`, 'error');
                txtApiContent = 'TXTAPI获取失败~';
            }
        }
       
        // 替换自定义消息中的占位符
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
        // 首先替换基本变量
        let result = format
            .replace(/{hitokoto}/g, data.hitokoto || '');
       
        // 格式化from
        let fromFormatted = '';
        if (data.from) {
            fromFormatted = userConfig.fromFormat.replace(/{from}/g, data.from);
        }
        result = result.replace(/{from}/g, fromFormatted);
       
        // 格式化from_who
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
                // API模式
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
                // 手动模式
                try {
                    const lines = userConfig.txtApiManualText.split('\n').filter(line => line.trim());
                    if (lines.length === 0) {
                        updateTxtApiStatus('无内容', false);
                        reject(new Error('手动文本内容为空'));
                        return;
                    }
                   
                    // 获取已发送的索引
                    let sentIndexes = GM_getValue('txtApiManualSentIndexes', []);
                   
                    if (userConfig.txtApiManualRandom) {
                        // 随机模式：找出未发送的索引
                        let availableIndexes = [];
                        for (let i = 0; i < lines.length; i++) {
                            if (!sentIndexes.includes(i)) {
                                availableIndexes.push(i);
                            }
                        }
                       
                        // 如果所有行都已发送，重置已发送记录
                        if (availableIndexes.length === 0) {
                            sentIndexes = [];
                            availableIndexes = Array.from({length: lines.length}, (_, i) => i);
                            GM_setValue('txtApiManualSentIndexes', []);
                        }
                       
                        // 随机选择一个未发送的索引
                        const randomIndex = Math.floor(Math.random() * availableIndexes.length);
                        const selectedIndex = availableIndexes[randomIndex];
                        const selectedText = lines[selectedIndex].trim();
                       
                        // 记录已发送的索引
                        sentIndexes.push(selectedIndex);
                        GM_setValue('txtApiManualSentIndexes', sentIndexes);
                       
                        updateTxtApiStatus('获取成功');
                        resolve(selectedText);
                    } else {
                        // 顺序模式：按顺序选择下一行
                        let nextIndex = 0;
                        if (sentIndexes.length > 0) {
                            nextIndex = (sentIndexes[sentIndexes.length - 1] + 1) % lines.length;
                        }
                       
                        const selectedText = lines[nextIndex].trim();
                       
                        // 记录已发送的索引
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

    // 发送消息函数
    async function sendMessage() {
        if (isProcessing) {
            addLog('已有任务正在进行中', 'error');
            return;
        }
        // 检查是否今天已发送
        const lastSentDate = GM_getValue('lastSentDate', '');
        const today = new Date().toDateString();
        if (lastSentDate === today) {
            addLog('今天已经发送过消息', 'info');
            return;
        }
        isProcessing = true;
        retryCount = 0;
        updateRetryCount();
        addLog('开始发送流程...', 'info');
        // 执行发送流程
        executeSendProcess();
    }

    // 执行发送流程
    async function executeSendProcess() {
        retryCount++;
        updateRetryCount();
        if (retryCount > userConfig.maxRetryCount) {
            addLog(`已达到最大重试次数 (${userConfig.maxRetryCount})`, 'error');
            isProcessing = false;
            return;
        }
        addLog(`尝试发送 (${retryCount}/${userConfig.maxRetryCount})`, 'info');
        
        // 根据目标用户状态决定下一步操作
        if (!hasClickedTarget) {
            // 如果目标用户未找到，先查找并点击目标用户
            addLog('目标用户未找到，先查找目标用户...', 'info');
            findAndClickTargetUser();
        } else {
            // 如果目标用户已找到，直接查找聊天输入框
            addLog('目标用户已找到，直接查找聊天输入框...', 'info');
            setTimeout(tryFindChatInput, 1000);
        }
    }

    // 查找并点击目标用户
    function findAndClickTargetUser() {
        addLog(`开始查找目标用户: ${userConfig.targetUsername}`, 'info');
        
        // 停止之前的观察器
        if (sendProcessObserver) {
            sendProcessObserver.disconnect();
            sendProcessObserver = null;
        }
        
        // 先立即尝试一次查找
        if (tryClickTargetUser()) {
            return;
        }
        
        // 如果没找到，启动观察器监听DOM变化
        sendProcessObserver = new MutationObserver((mutations) => {
            if (hasClickedTarget) {
                sendProcessObserver.disconnect();
                return;
            }
            
            for (let mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    if (tryClickTargetUser()) {
                        sendProcessObserver.disconnect();
                        return;
                    }
                }
            }
        });
        
        // 开始观察整个文档的变化
        sendProcessObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // 设置超时，如果一段时间内没找到就重试
        setTimeout(() => {
            if (!hasClickedTarget && sendProcessObserver) {
                sendProcessObserver.disconnect();
                addLog('查找目标用户超时，重试中...', 'warning');
                setTimeout(executeSendProcess, 2000);
            }
        }, 10000); // 10秒超时
    }

    // 尝试点击目标用户
    function tryClickTargetUser() {
        if (hasClickedTarget) return true;
        
        try {
            // 使用多种选择器尝试查找目标用户
            const selectors = [
                // 抖音聊天列表常见的选择器
                '[class*="name"]',
                '[class*="username"]',
                '[class*="header"]',
                '[class*="item"]',
                '[class*="contact"]',
                '[class*="list"] [class*="name"]',
                '[class*="chat"] [class*="name"]',
                '[class*="message"] [class*="name"]'
            ];
            
            for (let selector of selectors) {
                const elements = document.querySelectorAll(selector);
                for (let element of elements) {
                    if (element.textContent && element.textContent.trim() === userConfig.targetUsername) {
                        // 找到目标用户，点击它
                        element.click();
                        addLog(`成功点击动态加载的用户: ${userConfig.targetUsername}`, 'success');
                        hasClickedTarget = true;
                        updateChatTargetStatus('已找到', true);
                        
                        // 等待聊天界面加载，然后查找聊天输入框
                        setTimeout(() => {
                            addLog('目标用户已点击，等待聊天界面加载...', 'info');
                            setTimeout(tryFindChatInput, 2000);
                        }, 1000);
                        
                        return true;
                    }
                }
            }
            
            return false;
        } catch (error) {
            addLog(`寻找目标用户时出错: ${error.message}`, 'error');
            return false;
        }
    }

    // 尝试查找聊天输入框并发送消息
    async function tryFindChatInput() {
        const inputSelectors = [
            '.chat-input-dccKiL',
            '[class*="input"]',
            '[class*="textarea"]',
            '[contenteditable="true"]',
            'textarea',
            'input[type="text"]'
        ];
        
        let input = null;
        for (let selector of inputSelectors) {
            input = document.querySelector(selector);
            if (input) break;
        }
        
        if (input) {
            addLog('找到聊天输入框', 'info');
            // 获取消息内容
            let messageToSend;
            try {
                messageToSend = await getMessageContent();
                addLog('消息内容准备完成', 'success');
            } catch (error) {
                addLog(`消息获取失败: ${error.message}`, 'error');
                messageToSend = `${userConfig.baseMessage} | 消息获取失败~`;
            }
            
            // 清空输入框
            input.textContent = '';
            // 输入消息
            input.focus();
           
            // 处理换行符
            const lines = messageToSend.split('\n');
            for (let i = 0; i < lines.length; i++) {
                document.execCommand('insertText', false, lines[i]);
                if (i < lines.length - 1) {
                    // 插入换行符
                    document.execCommand('insertLineBreak');
                }
            }
           
            input.dispatchEvent(new Event('input', { bubbles: true }));
            
            // 查找发送按钮
            const sendBtnSelectors = [
                '.chat-btn',
                '[class*="send"]',
                '[class*="button"]:not([disabled])',
                'button:not([disabled])'
            ];
            
            let sendBtn = null;
            for (let selector of sendBtnSelectors) {
                sendBtn = document.querySelector(selector);
                if (sendBtn) break;
            }
            
            // 检查发送按钮状态
            setTimeout(() => {
                if (sendBtn && !sendBtn.disabled) {
                    addLog('正在发送消息...', 'info');
                    sendBtn.click();
                    // 确认发送成功
                    setTimeout(() => {
                        addLog('消息发送成功！', 'success');
                        // 立即记录发送状态
                        const today = new Date().toDateString();
                        GM_setValue('lastSentDate', today);
                        // 更新状态显示
                        updateStatus(true);
                        isProcessing = false;
                        // 显示通知
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
                    addLog('发送按钮不可用或未找到', 'error');
                    setTimeout(executeSendProcess, 2000);
                }
            }, 500);
        } else {
            addLog('未找到输入框，重试中...', 'error');
            setTimeout(executeSendProcess, 2000);
        }
    }

    // 解析时间字符串为日期对象
    function parseTimeString(timeStr) {
        const [hours, minutes, seconds] = timeStr.split(':').map(Number);
        const now = new Date();
        const targetTime = new Date(now);
        targetTime.setHours(hours, minutes, seconds || 0, 0);
       
        // 如果目标时间已经过去，设置为明天
        if (targetTime <= now) {
            targetTime.setDate(targetTime.getDate() + 1);
        }
       
        return targetTime;
    }

    // 更新状态
    function updateStatus(isSent) {
        const statusEl = document.getElementById('dy-fire-status');
        if (statusEl) {
            if (isSent) {
                statusEl.textContent = '已发送';
                statusEl.style.color = '#28a745';
            } else {
                statusEl.textContent = '未发送';
                statusEl.style.color = '#dc3545';
               
                // 如果是"未发送"状态，检查是否需要自动发送
                autoSendIfNeeded();
            }
        }
       
        // 更新下次发送时间
        const now = new Date();
       
        if (isSent) {
            // 如果已发送，下次发送时间是明天指定时间
            nextSendTime = parseTimeString(userConfig.sendTime);
            // 确保是明天而不是后天
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            if (nextSendTime.getDate() !== tomorrow.getDate()) {
                nextSendTime.setDate(tomorrow.getDate());
            }
        } else {
            // 如果未发送，检查当前时间是否已过指定时间
            nextSendTime = parseTimeString(userConfig.sendTime);
           
            // 如果目标时间已经过去，设置为明天
            if (nextSendTime <= now) {
                nextSendTime.setDate(nextSendTime.getDate() + 1);
            }
        }
       
        const nextElement = document.getElementById('dy-fire-next');
        if (nextElement) {
            nextElement.textContent = nextSendTime.toLocaleString();
        }
       
        // 开始倒计时
        startCountdown(nextSendTime);
    }

    // 检查是否需要自动发送
    function autoSendIfNeeded() {
        const now = new Date();
        const today = new Date().toDateString();
        const lastSentDate = GM_getValue('lastSentDate', '');
       
        // 解析发送时间
        const [targetHour, targetMinute, targetSecond] = userConfig.sendTime.split(':').map(Number);
       
        // 如果今天未发送且当前时间已过指定时间，则自动发送
        if (lastSentDate !== today) {
            const targetTimeToday = new Date();
            targetTimeToday.setHours(targetHour, targetMinute, targetSecond || 0, 0);
           
            if (now >= targetTimeToday && !isProcessing) {
                addLog(`检测到今日未发送且已过${userConfig.sendTime}，自动发送`, 'info');
                sendMessage();
            }
        }
    }

    // 开始倒计时
    function startCountdown(targetTime) {
        // 清除之前的倒计时
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }
       
        function update() {
            const now = new Date();
            const diff = targetTime - now;
           
            if (diff <= 0) {
                const countdownElement = document.getElementById('dy-fire-countdown');
                if (countdownElement) {
                    countdownElement.textContent = '00:00:00';
                }
               
                // 检查是否今天已发送
                const lastSentDate = GM_getValue('lastSentDate', '');
                const today = new Date().toDateString();
               
                if (lastSentDate === today) {
                    // 如果已发送，设置明天指定时间为目标时间
                    nextSendTime = parseTimeString(userConfig.sendTime);
                    // 确保是明天而不是后天
                    const tomorrow = new Date(now);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    if (nextSendTime.getDate() !== tomorrow.getDate()) {
                        nextSendTime.setDate(tomorrow.getDate());
                    }
                    startCountdown(nextSendTime);
                } else {
                    // 如果未发送，清空数据并发送消息
                    if (!isProcessing) {
                        // 清空数据，避免重复发送
                        GM_setValue('lastSentDate', '');
                        updateStatus(false);
                        addLog('已清空发送记录，准备发送新消息', 'info');
                        sendMessage();
                    }
                }
                return;
            }
           
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
           
            const countdownElement = document.getElementById('dy-fire-countdown');
            if (countdownElement) {
                countdownElement.textContent =
                    `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }
       
        update();
        countdownInterval = setInterval(update, 1000);
    }

    // 动态聊天列表点击功能
    function initDynamicChatClick() {
        // 停止之前的观察器和定时器
        stopDynamicChatClick();
        
        // 刷新页面后重置为寻找中
        hasClickedTarget = false;
        updateChatTargetStatus('寻找中', false);
        
        function clickIfFound() {
            if (hasClickedTarget) return;
            
            try {
                // 使用多种选择器尝试查找目标用户
                const selectors = [
                    '[class*="name"]',
                    '[class*="username"]',
                    '[class*="header"]',
                    '[class*="item"]',
                    '[class*="contact"]',
                    '[class*="list"] [class*="name"]',
                    '[class*="chat"] [class*="name"]',
                    '[class*="message"] [class*="name"]'
                ];
                
                for (let selector of selectors) {
                    const elements = document.querySelectorAll(selector);
                    for (let element of elements) {
                        if (element.textContent && element.textContent.trim() === userConfig.targetUsername) {
                            element.click();
                            addLog(`成功点击动态加载的用户: ${userConfig.targetUsername}`, 'success');
                            hasClickedTarget = true;
                            updateChatTargetStatus('已找到', true);
                            
                            // 找到后停止观察器
                            stopDynamicChatClick();
                            return true;
                        }
                    }
                }
                return false;
            } catch (error) {
                addLog(`寻找目标用户时出错: ${error.message}`, 'error');
                return false;
            }
        }
        
        // 使用MutationObserver监听DOM变化，但限制观察范围
        chatObserver = new MutationObserver((mutations) => {
            // 修复：检查mutations是否为可迭代对象
            if (!mutations || typeof mutations[Symbol.iterator] !== 'function') {
                return;
            }
            
            try {
                for (let mutation of mutations) {
                    if (mutation.addedNodes.length > 0 && !hasClickedTarget) {
                        clickIfFound();
                        break;
                    }
                }
            } catch (error) {
                addLog(`处理DOM变化时出错: ${error.message}`, 'error');
            }
        });
        
        // 只观察body的子节点变化，减少性能消耗
        try {
            chatObserver.observe(document.body, {
                childList: true,
                subtree: true // 改为true，观察所有子节点
            });
        } catch (error) {
            addLog(`启动DOM观察器时出错: ${error.message}`, 'error');
        }
        
        // 初始尝试，但限制尝试次数
        let initialAttempts = 0;
        const maxInitialAttempts = 5;
        
        function initialTry() {
            if (hasClickedTarget || initialAttempts >= maxInitialAttempts) return;
            
            if (clickIfFound()) {
                return;
            }
            
            initialAttempts++;
            if (initialAttempts < maxInitialAttempts) {
                initialAttemptTimer = setTimeout(initialTry, 1000);
            } else {
                updateChatTargetStatus('未找到', false);
                addLog(`未找到目标用户: ${userConfig.targetUsername}`, 'warning');
            }
        }
        
        // 延迟初始尝试，等待页面加载
        initialAttemptTimer = setTimeout(initialTry, 2000);
    }

    // 停止动态聊天点击功能
    function stopDynamicChatClick() {
        if (chatObserver) {
            chatObserver.disconnect();
            chatObserver = null;
        }
        
        if (sendProcessObserver) {
            sendProcessObserver.disconnect();
            sendProcessObserver = null;
        }
        
        if (initialAttemptTimer) {
            clearTimeout(initialAttemptTimer);
            initialAttemptTimer = null;
        }
        
        if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
        }
    }

    // 清空数据
    function clearData() {
        GM_setValue('lastSentDate', '');
        GM_setValue('txtApiManualSentIndexes', []);
        addLog('发送记录已清空', 'info');
        updateStatus(false);
        retryCount = 0;
        updateRetryCount();
        updateHitokotoStatus('未获取');
        updateTxtApiStatus('未获取');
        hasClickedTarget = false; // 重置目标用户状态
        updateChatTargetStatus('寻找中', false);
        
        // 重启聊天观察器
        initDynamicChatClick();
    }

    // 重置所有配置
    function resetAllConfig() {
        // 获取所有存储的值并删除
        if (typeof GM_listValues !== 'undefined' && typeof GM_deleteValue !== 'undefined') {
            try {
                const values = GM_listValues();
                values.forEach(key => {
                    GM_deleteValue(key);
                });
            } catch (e) {
                // ScriptCat可能不支持GM_listValues
                GM_setValue('lastSentDate', '');
                GM_setValue('userConfig', '');
                GM_setValue('txtApiManualSentIndexes', []);
                GM_setValue('allLogs', []);
            }
        } else {
            // 如果GM_listValues不可用，只删除已知的key
            GM_setValue('lastSentDate', '');
            GM_setValue('userConfig', '');
            GM_setValue('txtApiManualSentIndexes', []);
            GM_setValue('allLogs', []);
        }
       
        // 重新初始化配置
        initConfig();
       
        addLog('所有配置已重置', 'info');
        updateStatus(false);
        retryCount = 0;
        updateRetryCount();
        updateHitokotoStatus('未获取');
        updateTxtApiStatus('未获取');
        hasClickedTarget = false; // 重置目标用户状态
        updateChatTargetStatus('寻找中', false);
       
        // 显示通知
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
        
        // 重启聊天观察器
        initDynamicChatClick();
    }

    // 初始化函数
    function init() {
        // 检测是否是ScriptCat
        isScriptCat = detectScriptCat();
       
        // 初始化配置
        initConfig();
       
        // 创建控制面板
        createControlPanel();
       
        // 初始化动态聊天列表点击功能
        initDynamicChatClick();
       
        // 检查今天是否已发送
        const lastSentDate = GM_getValue('lastSentDate', '');
        const today = new Date().toDateString();
        const isSentToday = lastSentDate === today;
       
        // 更新状态
        updateStatus(isSentToday);
       
        // 注册菜单命令
        if (typeof GM_registerMenuCommand !== 'undefined') {
            try {
                GM_registerMenuCommand('抖音续火助手-显示面板', function() {
                    const panel = document.getElementById('dy-fire-helper');
                    if (panel) {
                        panel.style.display = 'block';
                    }
                });
                GM_registerMenuCommand('立即发送续火消息', sendMessage);
                GM_registerMenuCommand('设置', showSettingsPanel);
                GM_registerMenuCommand('历史日志', showHistoryPanel);
                GM_registerMenuCommand('清空发送记录', clearData);
                GM_registerMenuCommand('重置所有配置', resetAllConfig);
            } catch (e) {
                addLog('菜单命令注册失败，使用面板控制', 'error');
            }
        }
       
        addLog('抖音续火助手已启动', 'info');
       
        // 优化定时检查：改为每5分钟检查一次，而不是每分钟
        setInterval(() => {
            const now = new Date();
            const [targetHour, targetMinute] = userConfig.sendTime.split(':').map(Number);
           
            // 只在目标时间前后5分钟内进行检查
            if (Math.abs(now.getHours() - targetHour) <= 1 && 
                Math.abs(now.getMinutes() - targetMinute) <= 5) {
                checkAndSend();
            }
        }, 300000); // 5分钟检查一次
        
        function checkAndSend() {
            const now = new Date();
            const [targetHour, targetMinute] = userConfig.sendTime.split(':').map(Number);
            
            if (now.getHours() === targetHour && now.getMinutes() === targetMinute) {
                const lastSentDate = GM_getValue('lastSentDate', '');
                const today = new Date().toDateString();
                
                if (lastSentDate !== today && !isProcessing) {
                    addLog('定时检查：准备发送消息', 'info');
                    sendMessage();
                }
            }
        }
    }

    // 等待页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
