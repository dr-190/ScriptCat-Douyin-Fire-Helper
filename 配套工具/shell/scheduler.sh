#!/usr/bin/env bash
# ============================================================
# 抖音续火助手 - 后端调度器 (Linux / macOS) - 支持百分浏览器
#
# 用法:
#   ./scheduler.sh          # 守护进程模式，等待到配置时间后执行
#   ./scheduler.sh once     # 立即执行一次
#
# 依赖: jq, python3
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/config.json"
LOG_DIR="${SCRIPT_DIR}/logs"
LOG_FILE="${LOG_DIR}/scheduler_$(date +%Y%m%d).log"

# ---- 全局 PID（便于信号清理） ----
BROWSER_PID=""
SERVER_PID=""

cleanup() {
    log "收到退出信号，正在清理..."
    [[ -n "$SERVER_PID"  ]] && kill "$SERVER_PID"  2>/dev/null || true
    [[ -n "$BROWSER_PID" ]] && kill "$BROWSER_PID" 2>/dev/null || true
    exit 0
}
trap cleanup INT TERM

# ---- 日志 ----
mkdir -p "$LOG_DIR"

log()         { local m="[$(date '+%Y-%m-%d %H:%M:%S')] $1"; echo -e "$m"; echo "$m" >> "$LOG_FILE"; }
log_success() { log "✓ $1"; }
log_error()   { log "✗ $1"; }
log_warn()    { log "⚠ $1"; }

# ---- 依赖检查 ----
check_deps() {
    local missing=()
    for cmd in jq python3; do
        command -v "$cmd" &>/dev/null || missing+=("$cmd")
    done
    if [[ ${#missing[@]} -gt 0 ]]; then
        log_error "缺少依赖: ${missing[*]}"
        log "  Ubuntu/Debian : sudo apt install ${missing[*]}"
        log "  macOS         : brew install ${missing[*]}"
        exit 1
    fi
}

# ---- JSON 读取 ----
cfg() { jq -r "$1" "$CONFIG_FILE"; }

# ---- 浏览器路径检测 ----
detect_browser() {
    local browser="$1"

    # 优先使用 config 中的自定义路径
    local custom
    custom=$(cfg ".browser_paths.\"${browser}\" // empty" 2>/dev/null || echo "")
    if [[ -n "$custom" ]] && [[ -x "$custom" || -e "$custom" ]]; then
        echo "$custom"; return
    fi

    local candidates=()
    case "$browser" in
        firefox)
            candidates=("firefox" "/Applications/Firefox.app/Contents/MacOS/firefox" "/snap/bin/firefox");;
        firefox-esr)
            candidates=("firefox-esr" "firefox" "/Applications/Firefox.app/Contents/MacOS/firefox");;
        chrome)
            candidates=("google-chrome" "google-chrome-stable" "chromium" "chromium-browser"
                        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");;
        edge)
            candidates=("microsoft-edge" "microsoft-edge-stable"
                        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge");;
        centbrowser)
            # 百分浏览器主要针对Windows，但为了兼容，也尝试常见命令
            candidates=("centbrowser" "chrome" "google-chrome");;
        *) echo ""; return;;
    esac

    for p in "${candidates[@]}"; do
        if command -v "$p" &>/dev/null; then command -v "$p"; return; fi
        if [[ -x "$p" ]]; then echo "$p"; return; fi
    done
    echo ""
}

# ---- 启动浏览器 ----
launch_browser() {
    local browser="$1" profile="$2" url="$3"
    local bin
    bin=$(detect_browser "$browser")

    if [[ -z "$bin" ]]; then
        log_error "未找到 ${browser}，请在 config.json 的 browser_paths 中指定路径"
        return 1
    fi
    log "启动浏览器: ${bin}"

    # 将浏览器 stdout/stderr 重定向到日志，避免阻塞调用方
    case "$browser" in
        firefox|firefox-esr)
            "$bin" --profile "$profile" --no-remote "$url" >>"$LOG_FILE" 2>&1 &;;
        chrome|edge|centbrowser)
            "$bin" --user-data-dir="$profile" --no-first-run "$url" >>"$LOG_FILE" 2>&1 &;;
    esac
    BROWSER_PID=$!
}

# ---- 等待到指定时间（跨平台 date 兼容），返回等待秒数 ----
wait_until() {
    local send_time="$1"
    local wait_seconds
    wait_seconds=$(python3 -c "
import datetime
h, m, s = [int(x) for x in '${send_time}'.split(':')[:3]]
now = datetime.datetime.now()
target = now.replace(hour=h, minute=m, second=s, microsecond=0)
if target <= now:
    target += datetime.timedelta(days=1)
print(int((target - now).total_seconds()))
")
    local hrs=$((wait_seconds / 3600))
    local mins=$(((wait_seconds % 3600) / 60))
    log "距离下次发送 (${send_time}) 还有 ${hrs}小时${mins}分钟"
    sleep "$wait_seconds"
}

# ---- 计算距离指定时间的秒数（不 sleep，仅返回数值） ----
seconds_until() {
    local send_time="$1"
    python3 -c "
import datetime
h, m, s = [int(x) for x in '${send_time}'.split(':')[:3]]
now = datetime.datetime.now()
target = now.replace(hour=h, minute=m, second=s, microsecond=0)
if target <= now:
    target += datetime.timedelta(days=1)
print(int((target - now).total_seconds()))
"
}

# ---- 检查指定时间是否已过（今天） ----
is_time_past_today() {
    local send_time="$1"
    python3 -c "
import datetime
h, m, s = [int(x) for x in '${send_time}'.split(':')[:3]]
now = datetime.datetime.now()
target = now.replace(hour=h, minute=m, second=s, microsecond=0)
print('yes' if now >= target else 'no')
"
}

# ---- 处理单个账号 ----
# 输出格式：第一行 "SUCCESS" / "TIMEDOUT" / "FAIL"，超时时第二行为浏览器 PID
process_account() {
    local name="$1" profile="$2" browser="$3" port="$4" timeout="$5" url="$6"

    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "处理账号: ${name}"
    log "浏览器: ${browser} | Profile: ${profile}"

    if [[ ! -d "$profile" ]]; then
        log_warn "Profile 目录不存在: ${profile}（首次运行时浏览器会自动创建）"
    fi

    # 启动回调服务器
    python3 "${SCRIPT_DIR}/callback_server.py" "$port" "$timeout" &
    SERVER_PID=$!
    sleep 1

    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
        log_error "回调服务器启动失败（端口 ${port} 可能被占用）"
        SERVER_PID=""
        echo "FAIL"
        return
    fi
    log "回调服务器已启动 (端口: ${port}, PID: ${SERVER_PID})"

    # 启动浏览器
    launch_browser "$browser" "$profile" "$url" || { kill "$SERVER_PID" 2>/dev/null || true; SERVER_PID=""; echo "FAIL"; return; }
    local pid="$BROWSER_PID"
    log "浏览器已启动 (PID: ${pid})"
    log "等待浏览器执行脚本完成 (超时: ${timeout}秒)..."

    # 等待回调
    local result=0
    wait "$SERVER_PID" 2>/dev/null || result=$?
    SERVER_PID=""

    if [[ "$result" -eq 0 ]]; then
        log_success "账号 ${name} 任务完成，关闭浏览器"
        kill "$pid" 2>/dev/null || true
        sleep 2
        kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
        BROWSER_PID=""
        echo "SUCCESS"
    else
        log_warn "账号 ${name} 回调超时，关闭浏览器"
        kill "$pid" 2>/dev/null || true
        sleep 2
        kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
        BROWSER_PID=""
        echo "TIMEDOUT"
        echo "0"
    fi
}

# ---- 仅等待回调（浏览器已在运行）----
# 输出格式：第一行 "SUCCESS" / "TIMEDOUT" / "FAIL"
wait_for_callback() {
    local name="$1" port="$2" timeout="$3"

    python3 "${SCRIPT_DIR}/callback_server.py" "$port" "$timeout" &
    SERVER_PID=$!
    sleep 1

    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
        log_error "回调服务器启动失败（端口 ${port} 可能被占用）"
        SERVER_PID=""
        echo "FAIL"
        return
    fi
    log "回调服务器已重启，等待账号 ${name} 重新通知 (超时: ${timeout}秒)..."

    local result=0
    wait "$SERVER_PID" 2>/dev/null || result=$?
    SERVER_PID=""

    if [[ "$result" -eq 0 ]]; then
        echo "SUCCESS"
    else
        log_warn "账号 ${name} 再次超时"
        echo "TIMEDOUT"
    fi
}

# ============================================================
# 主流程
# ============================================================
main() {
    local mode="${1:-daemon}"

    check_deps

    if [[ ! -f "$CONFIG_FILE" ]]; then
        log_error "配置文件不存在: ${CONFIG_FILE}"
        log "请先编辑 config.json"
        exit 1
    fi

    log "═══════════════════════════════════════"
    log " 抖音续火助手 - 后端调度器"
    log " 模式: $( [[ "$mode" == "daemon" ]] && echo "守护进程" || echo "单次执行" )"
    log "═══════════════════════════════════════"

    local default_send_time port timeout default_browser url account_count
    default_send_time=$(cfg '.send_time')
    port=$(cfg '.callback_port')
    timeout=$(cfg '.timeout_seconds')
    default_browser=$(cfg '.default_browser')
    url=$(cfg '.target_url')
    account_count=$(cfg '.accounts | length')

    log "全局发送时间: ${default_send_time} | 端口: ${port} | 超时: ${timeout}秒"
    log "默认浏览器: ${default_browser} | 账号数: ${account_count}"

    # 打印每个账号的发送时间
    for ((i = 0; i < account_count; i++)); do
        local acct_name acct_time acct_enabled
        acct_name=$(cfg ".accounts[$i].name")
        acct_time=$(cfg ".accounts[$i].send_time // empty")
        acct_enabled=$(cfg ".accounts[$i].enabled")
        [[ -z "$acct_time" || "$acct_time" == "null" ]] && acct_time="$default_send_time"
        [[ "$acct_enabled" != "true" ]] && continue
        log "  ${acct_name}: 发送时间 ${acct_time}"
    done

    local retry_wait_minutes
    retry_wait_minutes=$(cfg '.retry_wait_minutes // 25')

    if [[ "$mode" != "daemon" ]]; then
        # ---- once 模式：立即执行所有已启用账号 ----
        log ""
        log "═══════════════════════════════════════"
        log " 开始执行 $(date '+%Y-%m-%d %H:%M:%S')"
        log "═══════════════════════════════════════"

        local success=0 fail=0
        local -a timedout_indices timedout_pids timedout_ats
        timedout_indices=(); timedout_pids=(); timedout_ats=()

        for ((i = 0; i < account_count; i++)); do
            local name profile browser enabled
            name=$(cfg ".accounts[$i].name")
            profile=$(cfg ".accounts[$i].profile_path")
            browser=$(cfg ".accounts[$i].browser // empty")
            enabled=$(cfg ".accounts[$i].enabled")

            [[ -z "$browser" || "$browser" == "null" ]] && browser="$default_browser"

            if [[ "$enabled" != "true" ]]; then
                log "跳过已禁用账号: ${name}"
                continue
            fi

            local out
            out=$(process_account "$name" "$profile" "$browser" "$port" "$timeout" "$url")
            local status; status=$(echo "$out" | head -1)

            if [[ "$status" == "SUCCESS" ]]; then
                ((success++)) || true
            elif [[ "$status" == "TIMEDOUT" ]]; then
                local bpid; bpid=$(echo "$out" | sed -n '2p')
                timedout_indices+=("$i")
                timedout_pids+=("$bpid")
                timedout_ats+=("$(date +%s)")
            else
                ((fail++)) || true
            fi

            if [[ $i -lt $((account_count - 1)) ]]; then
                log "等待 5 秒后处理下一个账号..."
                sleep 5
            fi
        done

        # 等待所有超时账号重试
        if [[ ${#timedout_indices[@]} -gt 0 ]]; then
            log "有 ${#timedout_indices[@]} 个账号超时，等待 ${retry_wait_minutes} 分钟后重试..."
            sleep $((retry_wait_minutes * 60))
            for j in "${!timedout_indices[@]}"; do
                local idx="${timedout_indices[$j]}"
                local rname; rname=$(cfg ".accounts[$idx].name")
                local rprofile; rprofile=$(cfg ".accounts[$idx].profile_path")
                local rbrowser; rbrowser=$(cfg ".accounts[$idx].browser // empty" || echo "$default_browser")
                log "重试账号: ${rname}"
                local rout; rout=$(process_account "$rname" "$rprofile" "$rbrowser" "$port" "$timeout" "$url")
                if [[ "$rout" == "SUCCESS" ]]; then
                    log_success "账号 ${rname} 重试成功"
                    ((success++)) || true
                else
                    log_error "账号 ${rname} 重试仍超时或失败"
                    ((fail++)) || true
                fi
            done
        fi

        log ""
        log "═══════════════════════════════════════"
        log " 任务完成: 成功=${success}  失败=${fail}"
        log "═══════════════════════════════════════"
    else
        # ---- daemon 模式：按每个账号的 send_time 分别调度 ----
        local -A executed_today timed_out_at timed_out_pid
        local current_day
        current_day=$(date +%Y%m%d)

        while true; do
            local today
            today=$(date +%Y%m%d)
            if [[ "$today" != "$current_day" ]]; then
                log "新的一天，重置执行记录"
                # 关闭所有仍在等待的超时浏览器
                for pid_val in "${timed_out_pid[@]}"; do
                    kill "$pid_val" 2>/dev/null || true
                done
                executed_today=(); timed_out_at=(); timed_out_pid=()
                current_day="$today"
            fi

            # ---- 检查超时账号是否到了重试时间 ----
            for idx in "${!timed_out_at[@]}"; do
                local elapsed_min
                elapsed_min=$(python3 -c "import time; print(int((time.time() - ${timed_out_at[$idx]}) / 60))")
                [[ "$elapsed_min" -lt "$retry_wait_minutes" ]] && continue

                local rname; rname=$(cfg ".accounts[$idx].name")
                log ""
                log "═══════════════════════════════════════"
                log " 重试超时账号: ${rname} @ $(date '+%Y-%m-%d %H:%M:%S')"
                log "═══════════════════════════════════════"

                local rprofile; rprofile=$(cfg ".accounts[$idx].profile_path")
                local rbrowser; rbrowser=$(cfg ".accounts[$idx].browser // empty" || echo "$default_browser")
                local rout; rout=$(process_account "$rname" "$rprofile" "$rbrowser" "$port" "$timeout" "$url")

                if [[ "$rout" == "SUCCESS" ]]; then
                    log_success "账号 ${rname} 重试成功"
                    executed_today[$idx]=1
                    unset 'timed_out_at[$idx]'
                    unset 'timed_out_pid[$idx]'
                elif [[ "$rout" == "TIMEDOUT" ]]; then
                    log_warn "账号 ${rname} 重试仍超时，继续等待 ${retry_wait_minutes} 分钟"
                    timed_out_at[$idx]=$(date +%s)
                else
                    log_error "账号 ${rname} 重试失败"
                    executed_today[$idx]=1
                    unset 'timed_out_at[$idx]'
                    unset 'timed_out_pid[$idx]'
                fi
            done

            # ---- 找到下一个需要执行的账号（跳过已完成和超时等待中的） ----
            local next_index=-1 next_seconds=999999 next_time_str=""

            for ((i = 0; i < account_count; i++)); do
                local enabled acct_time
                enabled=$(cfg ".accounts[$i].enabled")
                [[ "$enabled" != "true" ]] && continue
                [[ -n "${executed_today[$i]+x}" ]] && continue
                [[ -n "${timed_out_at[$i]+x}" ]] && continue   # 超时等待中，跳过

                acct_time=$(cfg ".accounts[$i].send_time // empty")
                [[ -z "$acct_time" || "$acct_time" == "null" ]] && acct_time="$default_send_time"

                local past; past=$(is_time_past_today "$acct_time")
                if [[ "$past" == "yes" ]]; then
                    next_index=$i; next_seconds=0; next_time_str="$acct_time"
                    break
                fi

                local secs; secs=$(seconds_until "$acct_time")
                if [[ "$secs" -lt "$next_seconds" ]]; then
                    next_seconds=$secs; next_index=$i; next_time_str="$acct_time"
                fi
            done

            if [[ "$next_index" -eq -1 ]]; then
                if [[ ${#timed_out_at[@]} -gt 0 ]]; then
                    sleep 60   # 还有超时账号在等待，每分钟轮询一次
                    continue
                fi
                log "今日所有账号已执行完毕，等待至明天..."
                local sleep_secs
                sleep_secs=$(python3 -c "
import datetime
now = datetime.datetime.now()
tomorrow = (now + datetime.timedelta(days=1)).replace(hour=0, minute=0, second=1, microsecond=0)
print(int((tomorrow - now).total_seconds()))
")
                sleep "$sleep_secs"
                continue
            fi

            local name profile browser
            name=$(cfg ".accounts[$next_index].name")
            profile=$(cfg ".accounts[$next_index].profile_path")
            browser=$(cfg ".accounts[$next_index].browser // empty")
            [[ -z "$browser" || "$browser" == "null" ]] && browser="$default_browser"

            if [[ "$next_seconds" -gt 0 ]]; then
                log "下一个账号: ${name} (${next_time_str})"
                wait_until "$next_time_str"
            fi

            log ""
            log "═══════════════════════════════════════"
            log " 执行账号: ${name} @ $(date '+%Y-%m-%d %H:%M:%S')"
            log "═══════════════════════════════════════"

            local out; out=$(process_account "$name" "$profile" "$browser" "$port" "$timeout" "$url")
            local status; status=$(echo "$out" | head -1)

            if [[ "$status" == "SUCCESS" ]]; then
                log_success "账号 ${name} 完成"
                executed_today[$next_index]=1
            elif [[ "$status" == "TIMEDOUT" ]]; then
                log_warn "账号 ${name} 超时，关闭浏览器，${retry_wait_minutes} 分钟后重试"
                timed_out_at[$next_index]=$(date +%s)
                timed_out_pid[$next_index]="0"
            else
                log_error "账号 ${name} 失败（非超时）"
                executed_today[$next_index]=1
            fi

            sleep 5
        done
    fi
}

main "$@"