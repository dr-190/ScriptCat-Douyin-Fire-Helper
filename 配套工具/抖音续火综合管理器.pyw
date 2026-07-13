"""
抖音续火助手 - 综合管理器
- 支持多浏览器（Chrome、CentBrowser、Firefox、Edge）
- 新建账号时可选择浏览器类型，自动写入配置
- 浏览器路径可手动输入，并提供自动检测按钮
"""

import os, sys, json, shutil, datetime, subprocess, platform, threading, queue
import tkinter as tk
from tkinter import ttk, messagebox, simpledialog, scrolledtext, filedialog

# ======================== 路径 ========================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROFILES_DIR = os.path.join(BASE_DIR, "profiles")
SHELL_DIR = os.path.join(BASE_DIR, "shell")
CONFIG_FILE = os.path.join(SHELL_DIR, "config.json")
LOG_FILE = os.path.join(BASE_DIR, "manager_history.log")
SCHEDULER_OUTPUT_LOG = os.path.join(SHELL_DIR, "scheduler_output.log")

# 常见浏览器默认安装路径（Windows）
DEFAULT_BROWSER_PATHS = {
    "chrome": [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"$LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
    ],
    "centbrowser": [
        r"C:\Program Files\CentBrowser\Application\chrome.exe",
        r"C:\Program Files (x86)\CentBrowser\Application\chrome.exe"
    ],
    "firefox": [
        r"C:\Program Files\Mozilla Firefox\firefox.exe",
        r"C:\Program Files (x86)\Mozilla Firefox\firefox.exe"
    ],
    "firefox-esr": [
        r"C:\Program Files\Mozilla Firefox ESR\firefox.exe",
        r"C:\Program Files (x86)\Mozilla Firefox ESR\firefox.exe"
    ],
    "edge": [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"
    ]
}

os.makedirs(PROFILES_DIR, exist_ok=True)
os.makedirs(SHELL_DIR, exist_ok=True)

# ======================== 日志 ========================
def write_log(msg):
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {msg}\n"
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line)
    except:
        pass
    return line

def read_logs(max_lines=500):
    if not os.path.isfile(LOG_FILE): return []
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        return f.readlines()[-max_lines:]

def clear_log_file():
    try: open(LOG_FILE, "w", encoding="utf-8").close()
    except: pass

def write_scheduler_log(msg):
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {msg}\n"
    try:
        with open(SCHEDULER_OUTPUT_LOG, "a", encoding="utf-8") as f:
            f.write(line)
    except:
        pass

def add_operation_log(message):
    if hasattr(add_operation_log, 'log_widget') and add_operation_log.log_widget:
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        line = f"[{timestamp}] {message}\n"
        widget = add_operation_log.log_widget
        widget.configure(state=tk.NORMAL)
        widget.insert(tk.END, line)
        widget.see(tk.END)
        widget.configure(state=tk.DISABLED)

# ======================== 工具函数 ========================
def detect_browser_path(browser_name):
    """自动检测浏览器路径"""
    paths = DEFAULT_BROWSER_PATHS.get(browser_name, [])
    for p in paths:
        expanded = os.path.expandvars(p)
        if os.path.isfile(expanded):
            return expanded
    # 尝试 PATH 中的命令
    if browser_name in ["chrome", "centbrowser"]:
        cmds = ["chrome", "chromium", "centbrowser"]
    elif browser_name.startswith("firefox"):
        cmds = ["firefox", "firefox-esr"]
    elif browser_name == "edge":
        cmds = ["edge", "microsoft-edge"]
    else:
        cmds = []
    for cmd in cmds:
        path = shutil.which(cmd)
        if path:
            return path
    return None

def detect_all_browsers():
    result = {}
    for browser in DEFAULT_BROWSER_PATHS.keys():
        path = detect_browser_path(browser)
        if path:
            result[browser] = path
    return result

def launch_browser(profile_dir, browser_name, browser_path=None, target_url=None):
    if target_url is None:
        target_url = load_config().get("target_url", "https://creator.douyin.com/creator-micro/data/following/chat")
    if not browser_path:
        browser_path = detect_browser_path(browser_name)
        if not browser_path:
            return False
    if browser_name.startswith("firefox"):
        cmd = f'"{browser_path}" --profile "{profile_dir}" --no-remote "{target_url}"'
    else:
        cmd = f'"{browser_path}" --user-data-dir="{profile_dir}" --no-first-run "{target_url}"'
    subprocess.Popen(cmd, shell=True)
    return True

def create_profile_folder(name):
    os.makedirs(os.path.join(PROFILES_DIR, name), exist_ok=True)

def delete_profile_folder(name):
    path = os.path.join(PROFILES_DIR, name)
    if os.path.isdir(path): shutil.rmtree(path)

def clone_profile_folder(src_name, dest_name, target_dir=None):
    src = os.path.join(PROFILES_DIR, src_name)
    if target_dir:
        os.makedirs(target_dir, exist_ok=True)
        dst = os.path.join(target_dir, dest_name)
    else:
        dst = os.path.join(PROFILES_DIR, dest_name)
    shutil.copytree(src, dst)
    for fname in ["Secure Preferences", "Preferences"]:
        fp = os.path.join(dst, fname)
        if os.path.isfile(fp):
            try: os.remove(fp)
            except: pass
    for root, dirs, files in os.walk(dst):
        for f in files:
            if f.lower() in ("lockfile", "singletonlock"):
                try: os.remove(os.path.join(root, f))
                except: pass
    return dst

def get_existing_accounts():
    if not os.path.isdir(PROFILES_DIR): return []
    acc = []
    for entry in os.listdir(PROFILES_DIR):
        full = os.path.join(PROFILES_DIR, entry)
        if os.path.isdir(full): acc.append((entry, full))
    acc.sort(key=lambda x: x[0])
    return acc

# ======================== 配置 ========================
DEFAULT_CONFIG = {
    "send_time": "00:01:00", "callback_port": 7788, "timeout_seconds": 300,
    "retry_wait_minutes": 25, "default_browser": "centbrowser",
    "browser_paths": {"firefox": "", "chrome": "", "edge": "", "centbrowser": "", "firefox-esr": ""},
    "target_url": "https://creator.douyin.com/creator-micro/data/following/chat",
    "accounts": []
}

def load_config():
    if not os.path.isfile(CONFIG_FILE):
        save_config(DEFAULT_CONFIG)
        return DEFAULT_CONFIG.copy()
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            config = json.load(f)
    except:
        config = {}
    changed = False
    for k, v in DEFAULT_CONFIG.items():
        if k not in config:
            config[k] = v; changed = True
    if "browser_paths" in config:
        for k, v in DEFAULT_CONFIG["browser_paths"].items():
            if k not in config["browser_paths"]:
                config["browser_paths"][k] = v; changed = True
    if changed:
        save_config(config)
        msg = "config.json 缺失字段已自动补全"
        write_log(msg)
        add_operation_log(msg)
    return config

def save_config(data):
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        write_log("config.json 已保存")
        return True
    except Exception as e:
        write_log(f"保存 config.json 失败: {e}")
        return False

def ensure_absolute_paths(config):
    modified = False
    for acc in config.get("accounts", []):
        pp = acc.get("profile_path", "")
        if pp and not os.path.isabs(pp):
            abs_path = os.path.normpath(os.path.join(BASE_DIR, pp))
            acc["profile_path"] = abs_path
            modified = True
            write_log(f"路径已修正: {pp} -> {abs_path}")
            add_operation_log(f"路径已修正: {pp} -> {abs_path}")
    return modified

def add_account_to_config(account_name, profile_path, browser_name):
    """将新账号添加到 config.json 的 accounts 列表中"""
    config = load_config()
    # 检查是否已存在同名账号
    for acc in config.get("accounts", []):
        if acc.get("name") == account_name:
            return False
    config.setdefault("accounts", []).append({
        "name": account_name,
        "profile_path": profile_path,
        "browser": browser_name,
        "send_time": "",
        "enabled": True
    })
    save_config(config)
    return True

def remove_account_from_config(account_name):
    config = load_config()
    config["accounts"] = [acc for acc in config.get("accounts", []) if acc.get("name") != account_name]
    save_config(config)

# ======================== 自定义按钮 ========================
class ModernButton(tk.Canvas):
    def __init__(self, parent, text, command=None, width=100, height=34,
                 bg="#f0f0f0", fg="#333", hover_bg="#e0e0e0",
                 font=("Microsoft YaHei UI", 9), radius=6, **kwargs):
        parent_bg = parent.cget("bg") if parent.cget("bg") != "SystemButtonFace" else "#f5f7fa"
        super().__init__(parent, width=width, height=height, bg=parent_bg,
                        highlightthickness=0, cursor="hand2", **kwargs)
        self.command = command
        self.bg = bg; self.fg = fg; self.hover_bg = hover_bg
        self.font = font; self.radius = radius; self.text = text
        self.draw()
        self.bind("<Enter>", self.on_enter)
        self.bind("<Leave>", self.on_leave)
        self.bind("<Button-1>", self.on_click)

    def draw(self):
        self.delete("all")
        w, h = self.winfo_reqwidth() or int(self.cget("width")), self.winfo_reqheight() or int(self.cget("height"))
        points = [self.radius, 0, w-self.radius, 0, w, 0, w, self.radius,
                  w, h-self.radius, w, h, w-self.radius, h, self.radius, h, 0, h, 0, h-self.radius,
                  0, self.radius, 0, 0]
        self.create_polygon(points, smooth=True, fill=self.bg, outline=self.bg)
        self.create_text(w/2, h/2, text=self.text, fill=self.fg, font=self.font)

    def on_enter(self, e): self.draw_btn(self.hover_bg)
    def on_leave(self, e): self.draw_btn(self.bg)
    def on_click(self, e):
        if self.command: self.command()

    def draw_btn(self, color):
        self.delete("all")
        w, h = int(self.cget("width")), int(self.cget("height"))
        points = [self.radius, 0, w-self.radius, 0, w, 0, w, self.radius,
                  w, h-self.radius, w, h, w-self.radius, h, self.radius, h, 0, h, 0, h-self.radius,
                  0, self.radius, 0, 0]
        self.create_polygon(points, smooth=True, fill=color, outline=color)
        self.create_text(w/2, h/2, text=self.text, fill=self.fg, font=self.font)

class PrimaryButton(ModernButton):
    def __init__(self, parent, text, command=None, width=100, **kwargs):
        super().__init__(parent, text, command, width=width,
                        bg="#fe2c55", fg="white", hover_bg="#e8284d",
                        font=("Microsoft YaHei UI", 9, "bold"), **kwargs)
class AccentButton(ModernButton):
    def __init__(self, parent, text, command=None, width=100, **kwargs):
        super().__init__(parent, text, command, width=width,
                        bg="#4a90d9", fg="white", hover_bg="#357abd",
                        font=("Microsoft YaHei UI", 9, "bold"), **kwargs)
class SuccessButton(ModernButton):
    def __init__(self, parent, text, command=None, width=100, **kwargs):
        super().__init__(parent, text, command, width=width,
                        bg="#27ae60", fg="white", hover_bg="#219a52", **kwargs)
class DangerButton(ModernButton):
    def __init__(self, parent, text, command=None, width=100, **kwargs):
        super().__init__(parent, text, command, width=width,
                        bg="#e74c3c", fg="white", hover_bg="#c0392b", **kwargs)

# ======================== 主界面 ========================
class App:
    def __init__(self, root):
        self.root = root
        self.root.title("抖音续火助手 · 综合管理器 1.0")
        self.root.geometry("1000x850")
        self.root.minsize(900, 750)
        self.root.configure(bg="#f0f2f5")
        self.c = {"bg":"#f0f2f5","card":"white","primary":"#fe2c55","accent":"#4a90d9",
                  "text":"#2c3e50","text_secondary":"#7f8c8d","border":"#e0e4e8"}
        self.scheduler_process = None
        self.scheduler_queue = queue.Queue()
        self.build_ui()
        self.load_file_logs()
        write_log("综合管理器 1.0 启动 (新建账号可选择浏览器)")
        add_operation_log("综合管理器 1.0 启动 (新建账号可选择浏览器)")
        self.poll_scheduler_output()
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

    def build_ui(self):
        header = tk.Frame(self.root, bg="white", height=56)
        header.pack(fill=tk.X); header.pack_propagate(False)
        tk.Frame(header, bg=self.c["primary"], width=4).pack(side=tk.LEFT, fill=tk.Y)
        tk.Label(header, text="🔥 抖音续火助手 · 1.0", font=("Microsoft YaHei UI", 14, "bold"),
                fg=self.c["primary"], bg="white").pack(side=tk.LEFT, padx=16, pady=12)
        tk.Frame(self.root, bg=self.c["border"], height=1).pack(fill=tk.X)

        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=16, pady=(12,4))
        self.tab_acc = tk.Frame(self.notebook, bg=self.c["bg"])
        self.tab_cfg = tk.Frame(self.notebook, bg=self.c["bg"])
        self.notebook.add(self.tab_acc, text=" 账号管理 ")
        self.notebook.add(self.tab_cfg, text=" 调度配置 ")
        self.build_accounts_tab()
        self.build_config_tab()

        bottom = tk.Frame(self.root, bg=self.c["bg"])
        bottom.pack(fill=tk.BOTH, expand=True, padx=16, pady=(0,8))

        log_card = tk.Frame(bottom, bg="white", borderwidth=1, relief="solid")
        log_card.pack(fill=tk.BOTH, expand=True, pady=(0,4))
        log_h = tk.Frame(log_card, bg="white")
        log_h.pack(fill=tk.X, padx=12, pady=(8,4))
        tk.Label(log_h, text="📜 操作日志", font=("Microsoft YaHei UI", 10, "bold"), bg="white").pack(side=tk.LEFT)
        log_btn = tk.Frame(log_h, bg="white")
        log_btn.pack(side=tk.RIGHT)
        ModernButton(log_btn, "清空", self.clear_operation_log, width=60, height=26).pack(side=tk.LEFT, padx=2)
        ModernButton(log_btn, "导出", self.export_logs, width=60, height=26).pack(side=tk.LEFT, padx=2)
        self.op_log_text = scrolledtext.ScrolledText(log_card, height=6, font=("Consolas", 9),
                                                     bg="#f8f9fa", relief=tk.FLAT, state=tk.DISABLED)
        self.op_log_text.pack(fill=tk.BOTH, expand=True, padx=12, pady=(0,8))
        add_operation_log.log_widget = self.op_log_text

        self.status = tk.Label(self.root, text="✨ 就绪", font=("Microsoft YaHei UI", 8),
                              fg=self.c["text_secondary"], bg="white", anchor=tk.W, padx=12, pady=4)
        self.status.pack(fill=tk.X)
        tk.Frame(self.root, bg=self.c["border"], height=1).pack(fill=tk.X)

    def on_close(self):
        if self.scheduler_process and self.scheduler_process.poll() is None:
            if messagebox.askyesno("确认退出", "调度器正在运行，关闭窗口将自动停止调度器。\n确定要停止并退出吗？"):
                self.stop_scheduler()
                self.root.destroy()
        else:
            self.root.destroy()

    # ---------- 账号管理标签页 ----------
    def build_accounts_tab(self):
        detect_frame = tk.Frame(self.tab_acc, bg="white", borderwidth=1, relief="solid")
        detect_frame.pack(fill=tk.X, padx=8, pady=(8,4))
        tk.Label(detect_frame, text="🔍 浏览器路径检测", font=("Microsoft YaHei UI", 10, "bold"), bg="white").pack(anchor=tk.W, padx=12, pady=(6,0))
        btn_frame = tk.Frame(detect_frame, bg="white")
        btn_frame.pack(fill=tk.X, padx=12, pady=(4,8))
        AccentButton(btn_frame, "检测所有浏览器", self.detect_all_browsers, width=130).pack(side=tk.LEFT, padx=2)
        ModernButton(btn_frame, "刷新配置路径", self.refresh_browser_paths, width=110).pack(side=tk.LEFT, padx=2)

        list_card = tk.Frame(self.tab_acc, bg="white", borderwidth=1, relief="solid")
        list_card.pack(fill=tk.BOTH, expand=True, padx=8, pady=4)
        hdr = tk.Frame(list_card, bg="white")
        hdr.pack(fill=tk.X, padx=12, pady=(8,4))
        tk.Label(hdr, text="📋 账号列表", font=("Microsoft YaHei UI",10,"bold"), bg="white").pack(side=tk.LEFT)
        self.lbl_cnt = tk.Label(hdr, text="", fg=self.c["text_secondary"], bg="white")
        self.lbl_cnt.pack(side=tk.RIGHT)

        cv = tk.Frame(list_card, bg="white")
        cv.pack(fill=tk.BOTH, expand=True, padx=12, pady=(0,8))
        self.acct_canvas = tk.Canvas(cv, bg="white", highlightthickness=0)
        self.acct_scroll = tk.Scrollbar(cv, orient=tk.VERTICAL, command=self.acct_canvas.yview)
        self.acct_frame = tk.Frame(self.acct_canvas, bg="white")
        self.acct_frame.bind("<Configure>", lambda e: self.acct_canvas.configure(scrollregion=self.acct_canvas.bbox("all")))
        self.acct_canvas.create_window((0,0), window=self.acct_frame, anchor=tk.NW, tags="acct")
        self.acct_canvas.configure(yscrollcommand=self.acct_scroll.set)
        self.acct_canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        self.acct_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self.acct_canvas.bind_all("<MouseWheel>", lambda e: self.acct_canvas.yview_scroll(int(-1*(e.delta/120)),"units"))
        self.acct_canvas.bind("<Configure>", lambda e: self.acct_canvas.itemconfig("acct", width=e.width))

        btn1 = tk.Frame(self.tab_acc, bg=self.c["bg"])
        btn1.pack(fill=tk.X, padx=8, pady=4)
        AccentButton(btn1, "➕ 新建空白账号", self.add_account, width=130).pack(side=tk.LEFT, padx=2)
        AccentButton(btn1, "🧬 克隆账号", self.clone_account, width=110).pack(side=tk.LEFT, padx=2)
        ModernButton(btn1, "🗑 批量删除", self.batch_delete_accounts, width=90).pack(side=tk.LEFT, padx=2)
        ModernButton(btn1, "📋 复制全部命令", self.copy_all_commands, width=110).pack(side=tk.RIGHT, padx=2)
        ModernButton(btn1, "🔄 刷新", self.refresh_account_list, width=80).pack(side=tk.RIGHT, padx=2)
        self.refresh_account_list()

    def detect_all_browsers(self):
        config = load_config()
        detected = detect_all_browsers()
        if not detected:
            add_operation_log("未检测到任何浏览器，请手动设置路径")
            messagebox.showwarning("检测失败", "未找到任何支持的浏览器安装")
            return
        changed = False
        for browser, path in detected.items():
            if browser in config["browser_paths"]:
                if config["browser_paths"][browser] != path:
                    config["browser_paths"][browser] = path
                    changed = True
                    add_operation_log(f"检测到 {browser}: {path}")
            else:
                config["browser_paths"][browser] = path
                changed = True
        if changed:
            save_config(config)
            add_operation_log("浏览器路径已更新到配置文件")
            self.load_config_to_ui()
            messagebox.showinfo("完成", "浏览器路径已自动填充")
        else:
            add_operation_log("所有浏览器路径已是最新")

    def refresh_browser_paths(self):
        self.load_config_to_ui()
        add_operation_log("已从配置刷新浏览器路径")

    # ---------- 调度配置标签页 ----------
    def build_config_tab(self):
        top = tk.Frame(self.tab_cfg, bg=self.c["bg"])
        top.pack(fill=tk.X, padx=8, pady=(8,4))
        tk.Label(top, text="⚙️ 调度器配置 (PowerShell)", font=("Microsoft YaHei UI",12,"bold"), bg=self.c["bg"]).pack(side=tk.LEFT)
        self.config_mode = tk.StringVar(value="form")
        tk.Radiobutton(top, text="简易", variable=self.config_mode, value="form", bg=self.c["bg"], command=self.switch_mode).pack(side=tk.RIGHT, padx=4)
        tk.Radiobutton(top, text="高级", variable=self.config_mode, value="code", bg=self.c["bg"], command=self.switch_mode).pack(side=tk.RIGHT, padx=4)

        self.form_frame = tk.Frame(self.tab_cfg, bg=self.c["bg"])
        self.build_form_editor()
        self.code_frame = tk.Frame(self.tab_cfg, bg=self.c["bg"])
        self.code_text = scrolledtext.ScrolledText(self.code_frame, font=("Consolas",10),
                                                   bg="#2b2b2b", fg="#d4d4d4", insertbackground="white")
        self.code_text.pack(fill=tk.BOTH, expand=True, padx=8, pady=4)
        self.switch_mode()

        bar = tk.Frame(self.tab_cfg, bg=self.c["bg"])
        bar.pack(fill=tk.X, padx=8, pady=4)
        self.btn_start = SuccessButton(bar, "🚀 启动调度器", self.start_scheduler, width=120)
        self.btn_start.pack(side=tk.LEFT, padx=4)
        self.btn_stop = DangerButton(bar, "⏹ 停止调度器", self.stop_scheduler, width=120)
        AccentButton(bar, "💾 保存配置", self.save_config_from_ui, width=110).pack(side=tk.RIGHT, padx=4)
        ModernButton(bar, "🔄 重新加载", self.load_config_to_ui, width=100).pack(side=tk.RIGHT, padx=4)

    def build_form_editor(self):
        left = tk.Frame(self.form_frame, bg=self.c["bg"])
        left.pack(side=tk.LEFT, fill=tk.BOTH, padx=(0,4))
        card = tk.Frame(left, bg="white", borderwidth=1, relief="solid")
        card.pack(fill=tk.X)
        f = tk.LabelFrame(card, text="全局参数", font=("Microsoft YaHei UI",10,"bold"), bg="white")
        f.pack(fill=tk.X, padx=12, pady=8)
        self.form_vars = {}
        for label, key, w in [("发送时间", "send_time", 10), ("回调端口", "callback_port", 6),
                              ("超时秒数", "timeout_seconds", 6), ("重试等待(分钟)", "retry_wait_minutes", 6)]:
            row = tk.Frame(f, bg="white")
            row.pack(fill=tk.X, padx=8, pady=2)
            tk.Label(row, text=label, bg="white", width=14, anchor=tk.W).pack(side=tk.LEFT)
            self.form_vars[key] = tk.StringVar()
            tk.Entry(row, textvariable=self.form_vars[key], width=w, font=("Consolas",10)).pack(side=tk.LEFT, padx=8)
        row = tk.Frame(f, bg="white")
        row.pack(fill=tk.X, padx=8, pady=2)
        tk.Label(row, text="默认浏览器", bg="white", width=14).pack(side=tk.LEFT)
        self.form_vars["default_browser"] = tk.StringVar(value="centbrowser")
        tk.OptionMenu(row, self.form_vars["default_browser"], *["centbrowser","chrome","firefox","firefox-esr","edge"]).pack(side=tk.LEFT, padx=8)
        # 目标网页选择
        row = tk.Frame(f, bg="white")
        row.pack(fill=tk.X, padx=8, pady=2)
        tk.Label(row, text="目标网页", bg="white", width=14, anchor=tk.W).pack(side=tk.LEFT)
        self.form_vars["target_url"] = tk.StringVar()
        target_combo = ttk.Combobox(row, textvariable=self.form_vars["target_url"], width=55, font=("Consolas",9))
        target_combo["values"] = (
            "https://www.douyin.com/chat",
            "https://creator.douyin.com/creator-micro/data/following/chat"
        )
        target_combo.pack(side=tk.LEFT, padx=8)
        f2 = tk.LabelFrame(card, text="浏览器路径", font=("Microsoft YaHei UI",10,"bold"), bg="white")
        f2.pack(fill=tk.X, padx=12, pady=4)
        for name, var in [("Firefox","browser_paths_firefox"), ("Firefox ESR","browser_paths_firefox-esr"),
                          ("Chrome","browser_paths_chrome"), ("Edge","browser_paths_edge"),
                          ("CentBrowser","browser_paths_centbrowser")]:
            r = tk.Frame(f2, bg="white")
            r.pack(fill=tk.X, padx=8, pady=2)
            tk.Label(r, text=name, bg="white", width=12).pack(side=tk.LEFT)
            self.form_vars[var] = tk.StringVar()
            entry = tk.Entry(r, textvariable=self.form_vars[var], font=("Consolas",9))
            entry.pack(side=tk.LEFT, expand=True, fill=tk.X)
            detect_btn = ModernButton(r, "🔍", lambda n=name.split()[0].lower(): self.detect_single_browser(n), width=30, height=26)
            detect_btn.pack(side=tk.LEFT, padx=2)

        right = tk.Frame(self.form_frame, bg=self.c["bg"])
        right.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)
        tk.Label(right, text="账号列表（卡片编辑）", font=("Microsoft YaHei UI",10,"bold"), bg=self.c["bg"]).pack(anchor=tk.W)
        btns = tk.Frame(right, bg=self.c["bg"])
        btns.pack(fill=tk.X, pady=4)
        ModernButton(btns, "➕ 添加", self.add_card, width=70).pack(side=tk.LEFT, padx=2)
        ModernButton(btns, "🔄 同步profiles", self.sync_cards, width=110).pack(side=tk.LEFT, padx=2)
        ModernButton(btns, "📝 示例", self.sample_cards, width=70).pack(side=tk.RIGHT, padx=2)
        self.cards_frame = tk.Frame(right, bg=self.c["bg"])
        self.cards_frame.pack(fill=tk.BOTH, expand=True)

        tk.Label(right, text="🖥️ 调度器输出 (实时)", font=("Microsoft YaHei UI",10,"bold"), bg=self.c["bg"]).pack(anchor=tk.W, pady=(8,0))
        self.terminal = scrolledtext.ScrolledText(right, height=10, font=("Consolas",9),
                                                  bg="#1e1e1e", fg="#ccc", insertbackground="white", state=tk.DISABLED)
        self.terminal.pack(fill=tk.BOTH, expand=True)

    def detect_single_browser(self, browser_name):
        path = detect_browser_path(browser_name)
        if path:
            var_name = f"browser_paths_{browser_name}"
            if var_name in self.form_vars:
                self.form_vars[var_name].set(path)
                add_operation_log(f"检测到 {browser_name}: {path}")
            else:
                add_operation_log(f"不支持的浏览器: {browser_name}")
        else:
            add_operation_log(f"未找到 {browser_name} 浏览器")
            messagebox.showwarning("未找到", f"未安装 {browser_name} 或未在默认路径")

    def switch_mode(self):
        if self.config_mode.get() == "form":
            self.code_frame.pack_forget()
            self.form_frame.pack(fill=tk.BOTH, expand=True, padx=4, pady=4)
            self.load_config_to_ui()
        else:
            self.form_frame.pack_forget()
            self.code_frame.pack(fill=tk.BOTH, expand=True, padx=4, pady=4)
            self.load_config_to_code()

    def load_config_to_ui(self):
        config = load_config()
        if not config: return
        for k in ["send_time","callback_port","timeout_seconds","retry_wait_minutes"]:
            self.form_vars[k].set(str(config.get(k, "")))
        self.form_vars["default_browser"].set(config.get("default_browser","centbrowser"))
        self.form_vars["target_url"].set(config.get("target_url", "https://creator.douyin.com/creator-micro/data/following/chat"))
        bps = config.get("browser_paths", {})
        self.form_vars["browser_paths_firefox"].set(bps.get("firefox",""))
        self.form_vars["browser_paths_firefox-esr"].set(bps.get("firefox-esr",""))
        self.form_vars["browser_paths_chrome"].set(bps.get("chrome",""))
        self.form_vars["browser_paths_edge"].set(bps.get("edge",""))
        self.form_vars["browser_paths_centbrowser"].set(bps.get("centbrowser",""))
        self.load_cards(config.get("accounts", []))

    def load_config_to_code(self):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                content = f.read()
        except:
            content = ""
        self.code_text.delete(1.0, tk.END)
        self.code_text.insert(tk.END, content)

    def save_config_from_ui(self):
        add_operation_log("保存配置...")
        if self.config_mode.get() == "form":
            config = load_config() or DEFAULT_CONFIG.copy()
            config["send_time"] = self.form_vars["send_time"].get()
            try:
                config["callback_port"] = int(self.form_vars["callback_port"].get())
                config["timeout_seconds"] = int(self.form_vars["timeout_seconds"].get())
                config["retry_wait_minutes"] = int(self.form_vars["retry_wait_minutes"].get())
            except:
                add_operation_log("保存失败：数字字段格式错误")
                messagebox.showerror("错误", "数字字段格式错误")
                return
            config["default_browser"] = self.form_vars["default_browser"].get()
            config["target_url"] = self.form_vars["target_url"].get().strip()
            config["browser_paths"] = {
                "firefox": self.form_vars["browser_paths_firefox"].get(),
                "firefox-esr": self.form_vars["browser_paths_firefox-esr"].get(),
                "chrome": self.form_vars["browser_paths_chrome"].get(),
                "edge": self.form_vars["browser_paths_edge"].get(),
                "centbrowser": self.form_vars["browser_paths_centbrowser"].get(),
            }
            config["accounts"] = self.get_cards_data()
            ensure_absolute_paths(config)
            if save_config(config):
                add_operation_log("配置保存成功")
                messagebox.showinfo("成功", "配置已保存")
        else:
            content = self.code_text.get(1.0, tk.END).strip()
            try:
                json.loads(content)
                with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                    f.write(content)
                write_log("config.json 已保存(高级)")
                add_operation_log("配置保存成功（高级模式）")
                messagebox.showinfo("成功", "配置已保存")
            except Exception as e:
                add_operation_log(f"保存失败：{e}")
                messagebox.showerror("格式错误", str(e))

    # ---------- 卡片管理 ----------
    def load_cards(self, accounts):
        for w in self.cards_frame.winfo_children():
            w.destroy()
        if not accounts:
            tk.Label(self.cards_frame, text="无账号", bg=self.c["bg"], fg=self.c["text_secondary"]).pack(pady=10)
            return
        for i, acc in enumerate(accounts):
            card = tk.LabelFrame(self.cards_frame, text=f" 账号{i+1} ", font=("Microsoft YaHei UI",9,"bold"), bg="white")
            card.pack(fill=tk.X, padx=2, pady=2)
            r1 = tk.Frame(card, bg="white")
            r1.pack(fill=tk.X)
            tk.Label(r1, text="名称", bg="white", width=6).pack(side=tk.LEFT)
            nv = tk.StringVar(value=acc.get("name",""))
            tk.Entry(r1, textvariable=nv, width=18).pack(side=tk.LEFT, padx=(0,8))
            tk.Label(r1, text="Profile路径", bg="white", width=10).pack(side=tk.LEFT)
            pv = tk.StringVar(value=acc.get("profile_path",""))
            tk.Entry(r1, textvariable=pv, width=24).pack(side=tk.LEFT)
            r2 = tk.Frame(card, bg="white")
            r2.pack(fill=tk.X, pady=2)
            tk.Label(r2, text="浏览器", bg="white", width=6).pack(side=tk.LEFT)
            bv = tk.StringVar(value=acc.get("browser","centbrowser"))
            browser_combo = ttk.Combobox(r2, textvariable=bv, width=12, values=["centbrowser","chrome","firefox","firefox-esr","edge"])
            browser_combo.pack(side=tk.LEFT, padx=(0,8))
            tk.Label(r2, text="发送时间", bg="white", width=8).pack(side=tk.LEFT)
            sv = tk.StringVar(value=acc.get("send_time",""))
            tk.Entry(r2, textvariable=sv, width=10).pack(side=tk.LEFT, padx=(0,8))
            ev = tk.BooleanVar(value=acc.get("enabled",True))
            tk.Checkbutton(r2, text="启用", variable=ev, bg="white").pack(side=tk.LEFT)
            ModernButton(r2, "🗑", lambda c=card: self.del_card(c), width=30, height=28, fg="#e74c3c", hover_bg="#ffe0e0").pack(side=tk.RIGHT)
            card.data_vars = (nv, pv, bv, sv, ev)

    def add_card(self):
        accs = self.get_cards_data()
        accs.append({"name":"","profile_path":"","browser":"centbrowser","send_time":"","enabled":True})
        self.load_cards(accs)
        add_operation_log("添加了一个空白账号卡片")
        write_log("添加空白账号卡片")

    def del_card(self, card):
        card.destroy()
        self.load_cards(self.get_cards_data())
        add_operation_log("删除了一个账号卡片")
        write_log("删除账号卡片")

    def sync_cards(self):
        accs = self.get_cards_data()
        exist = {a["name"] for a in accs}
        added = 0
        for name, path in get_existing_accounts():
            if name not in exist:
                accs.append({"name":name,"profile_path":path,"browser":"centbrowser","send_time":"","enabled":True})
                added += 1
        self.load_cards(accs)
        if added:
            add_operation_log(f"从 profiles 同步了 {added} 个账号")
            write_log(f"从 profiles 同步了 {added} 个账号")
        else:
            add_operation_log("同步 profiles：没有新账号可添加")

    def sample_cards(self):
        self.load_cards([
            {"name":"示例1","profile_path":os.path.join(BASE_DIR,"profiles","account1"),"browser":"centbrowser","send_time":"","enabled":True},
            {"name":"示例2","profile_path":os.path.join(BASE_DIR,"profiles","account2"),"browser":"chrome","send_time":"08:30","enabled":True}
        ])
        add_operation_log("插入了示例账号")
        write_log("插入示例账号")

    def get_cards_data(self):
        accs = []
        for c in self.cards_frame.winfo_children():
            if hasattr(c, 'data_vars'):
                nv, pv, bv, sv, ev = c.data_vars
                accs.append({"name":nv.get(),"profile_path":pv.get(),"browser":bv.get(),"send_time":sv.get(),"enabled":ev.get()})
        return accs

    # ---------- 增强的添加账号功能（可选择浏览器）----------
    def add_account(self):
        """新建空白账号，可选择浏览器类型"""
        dlg = tk.Toplevel(self.root)
        dlg.title("新建空白账号"); dlg.geometry("450x350"); dlg.configure(bg="white")
        tk.Label(dlg, text="新建空白账号", font=("Microsoft YaHei UI",12,"bold"), bg="white").pack(pady=10)

        # 浏览器选择
        browser_frame = tk.Frame(dlg, bg="white")
        browser_frame.pack(fill=tk.X, padx=20, pady=5)
        tk.Label(browser_frame, text="使用浏览器：", bg="white", width=12, anchor=tk.W).pack(side=tk.LEFT)
        browser_var = tk.StringVar(value=load_config().get("default_browser", "centbrowser"))
        browser_combo = ttk.Combobox(browser_frame, textvariable=browser_var, values=["centbrowser","chrome","firefox","firefox-esr","edge"], width=15)
        browser_combo.pack(side=tk.LEFT)

        # 模式选择
        mode = tk.StringVar(value="quantity")
        tk.Radiobutton(dlg, text="按数量", variable=mode, value="quantity", bg="white").pack(anchor=tk.W, padx=20, pady=2)
        qty_frame = tk.Frame(dlg, bg="white")
        tk.Label(qty_frame, text="数量：", bg="white").pack(side=tk.LEFT)
        qty = tk.StringVar(value="1")
        tk.Spinbox(qty_frame, from_=1, to=20, textvariable=qty, width=5).pack(side=tk.LEFT)
        qty_frame.pack(pady=2, padx=40, anchor=tk.W)

        tk.Radiobutton(dlg, text="手动名称（每行一个）", variable=mode, value="manual", bg="white").pack(anchor=tk.W, padx=20, pady=5)
        txt = tk.Text(dlg, height=5, width=40)
        txt.pack(pady=5, padx=20)

        def toggle():
            if mode.get() == "quantity":
                qty_frame.pack(pady=2, padx=40, anchor=tk.W)
                txt.pack_forget()
            else:
                qty_frame.pack_forget()
                txt.pack(pady=5, padx=20)
        mode.trace("w", lambda *a: toggle())
        toggle()

        def ok():
            chosen_browser = browser_var.get()
            if mode.get() == "quantity":
                count = int(qty.get())
                created = 0
                for i in range(1, count+1):
                    name = f"account{i}"
                    # 避免重名
                    while os.path.isdir(os.path.join(PROFILES_DIR, name)):
                        i += 1
                        name = f"account{i}"
                    create_profile_folder(name)
                    # 将账号添加到 config.json
                    add_account_to_config(name, os.path.join(PROFILES_DIR, name), chosen_browser)
                    add_operation_log(f"创建账号: {name} (浏览器: {chosen_browser})")
                    write_log(f"创建: {name} 浏览器:{chosen_browser}")
                    created += 1
                messagebox.showinfo("完成", f"已创建 {created} 个账号，浏览器类型已记录")
            else:
                names = [line.strip() for line in txt.get("1.0", tk.END).splitlines() if line.strip()]
                created = 0
                for name in names:
                    if os.path.isdir(os.path.join(PROFILES_DIR, name)):
                        add_operation_log(f"账号 {name} 已存在，跳过")
                        continue
                    create_profile_folder(name)
                    add_account_to_config(name, os.path.join(PROFILES_DIR, name), chosen_browser)
                    add_operation_log(f"创建账号: {name} (浏览器: {chosen_browser})")
                    write_log(f"创建: {name} 浏览器:{chosen_browser}")
                    created += 1
                messagebox.showinfo("完成", f"已创建 {created} 个账号")
            dlg.destroy()
            self.refresh_account_list()
            # 同时刷新卡片列表（如果调度配置标签页打开）
            if hasattr(self, 'cards_frame'):
                self.load_cards(load_config().get("accounts", []))

        AccentButton(dlg, "确定", ok).pack(pady=10)

    # 删除账号时同时从配置中移除
    def del_acc(self, name, path):
        if messagebox.askyesno("删除", f"删除账号 {name} 及其配置？"):
            delete_profile_folder(name)
            remove_account_from_config(name)
            add_operation_log(f"删除账号: {name}（已从配置移除）")
            write_log(f"删除: {name}")
            self.refresh_account_list()
            # 刷新卡片
            if hasattr(self, 'cards_frame'):
                self.load_cards(load_config().get("accounts", []))

    # 批量删除时也同步移除配置
    def batch_delete_accounts(self):
        sel = [n for n, v in self.account_checkboxes.items() if v.get()]
        if not sel:
            messagebox.showinfo("提示", "请勾选要删除的账号")
            return
        if messagebox.askyesno("删除", f"删除 {len(sel)} 个账号及其配置？"):
            for n in sel:
                delete_profile_folder(n)
                remove_account_from_config(n)
                add_operation_log(f"删除账号: {n}（已从配置移除）")
                write_log(f"删除: {n}")
            self.refresh_account_list()
            if hasattr(self, 'cards_frame'):
                self.load_cards(load_config().get("accounts", []))

    # 重命名时也需要更新 config 中的 profile_path
    def rename_acc(self, name, path):
        new_name = simpledialog.askstring("重命名", "新名称：", initialvalue=name)
        if new_name and new_name != name:
            new_path = os.path.join(PROFILES_DIR, new_name)
            if not os.path.exists(new_path):
                os.rename(path, new_path)
                # 更新 config.json
                config = load_config()
                for acc in config.get("accounts", []):
                    if acc.get("name") == name:
                        acc["name"] = new_name
                        acc["profile_path"] = new_path
                        break
                save_config(config)
                add_operation_log(f"重命名账号: {name} -> {new_name} (已更新配置)")
                write_log(f"重命名: {name} -> {new_name}")
                self.refresh_account_list()
                if hasattr(self, 'cards_frame'):
                    self.load_cards(config.get("accounts", []))
            else:
                messagebox.showerror("错误", "目标名称已存在")

    # ---------- 账号列表刷新（显示浏览器）----------
    def refresh_account_list(self):
        for w in self.acct_frame.winfo_children():
            w.destroy()
        accs = get_existing_accounts()
        config = load_config()
        # 构建 name -> browser 映射
        account_browsers = {acc["name"]: acc.get("browser", "centbrowser") for acc in config.get("accounts", [])}
        self.lbl_cnt.config(text=f"共 {len(accs)} 个")
        if not accs:
            tk.Label(self.acct_frame, text="暂无账号", bg="white", fg=self.c["text_secondary"]).pack(pady=20)
            self.account_checkboxes = {}
            return
        head = tk.Frame(self.acct_frame, bg="#f0f2f5")
        head.pack(fill=tk.X, padx=4, pady=2)
        tk.Label(head, text="☐", bg="#f0f2f5", width=2).pack(side=tk.LEFT)
        tk.Label(head, text="名称", bg="#f0f2f5", font=("Microsoft YaHei UI",9,"bold"), width=15).pack(side=tk.LEFT)
        tk.Label(head, text="浏览器", bg="#f0f2f5", font=("Microsoft YaHei UI",9,"bold"), width=12).pack(side=tk.LEFT)
        tk.Label(head, text="路径", bg="#f0f2f5", font=("Microsoft YaHei UI",9,"bold")).pack(side=tk.LEFT, fill=tk.X, expand=True)
        tk.Label(head, text="操作", bg="#f0f2f5", font=("Microsoft YaHei UI",9,"bold"), width=30).pack(side=tk.RIGHT, padx=4)
        self.account_checkboxes = {}
        for name, path in accs:
            row = tk.Frame(self.acct_frame, bg="white")
            row.pack(fill=tk.X, padx=4, pady=2)
            var = tk.BooleanVar()
            self.account_checkboxes[name] = var
            tk.Checkbutton(row, variable=var, bg="white").pack(side=tk.LEFT)
            tk.Label(row, text=name, bg="white", font=("Microsoft YaHei UI",9,"bold"), width=15, anchor=tk.W).pack(side=tk.LEFT)
            browser = account_browsers.get(name, "centbrowser")
            tk.Label(row, text=browser, bg="white", fg=self.c["accent"], width=12, anchor=tk.W).pack(side=tk.LEFT)
            tk.Label(row, text=path, bg="white", fg=self.c["text_secondary"]).pack(side=tk.LEFT, fill=tk.X, expand=True, padx=8)
            btns = tk.Frame(row, bg="white")
            btns.pack(side=tk.RIGHT)
            PrimaryButton(btns, "启动", lambda p=path, b=browser: self.start_account(p, b), width=50, height=28).pack(side=tk.LEFT, padx=1)
            ModernButton(btns, "命令", lambda p=path, b=browser: self.copy_account_cmd(p, b), width=50, height=28, font=("Microsoft YaHei UI",8)).pack(side=tk.LEFT, padx=1)
            ModernButton(btns, "重命名", lambda n=name, p=path: self.rename_acc(n, p), width=55, height=28, font=("Microsoft YaHei UI",8)).pack(side=tk.LEFT, padx=1)
            ModernButton(btns, "删除", lambda n=name, p=path: self.del_acc(n, p), width=50, height=28, fg="#e74c3c").pack(side=tk.LEFT, padx=1)
            tk.Frame(self.acct_frame, bg=self.c["border"], height=1).pack(fill=tk.X)

    # 启动和复制命令函数（保持不变，已支持多浏览器）
    def start_account(self, profile_path, browser_name):
        config = load_config()
        browser_paths = config.get("browser_paths", {})
        target_url = config.get("target_url", "https://creator.douyin.com/creator-micro/data/following/chat")
        browser_exe = browser_paths.get(browser_name, "")
        if not browser_exe or not os.path.isfile(browser_exe):
            browser_exe = detect_browser_path(browser_name)
            if not browser_exe:
                add_operation_log(f"启动失败：未找到 {browser_name} 浏览器")
                messagebox.showerror("错误", f"未找到 {browser_name} 浏览器，请在调度配置中设置路径或点击检测按钮")
                return
        success = launch_browser(profile_path, browser_name, browser_exe, target_url)
        if success:
            add_operation_log(f"启动 {browser_name} 账号: {profile_path}")
            write_log(f"启动 {browser_name}: {profile_path}")
        else:
            add_operation_log(f"启动失败: {profile_path}")

    def copy_account_cmd(self, profile_path, browser_name):
        config = load_config()
        browser_paths = config.get("browser_paths", {})
        target_url = config.get("target_url", "https://creator.douyin.com/creator-micro/data/following/chat")
        browser_exe = browser_paths.get(browser_name, "")
        if not browser_exe or not os.path.isfile(browser_exe):
            browser_exe = detect_browser_path(browser_name)
            if not browser_exe:
                add_operation_log(f"复制命令失败：未找到 {browser_name} 浏览器")
                messagebox.showerror("错误", f"未找到 {browser_name} 浏览器")
                return
        if browser_name.startswith("firefox"):
            cmd = f'"{browser_exe}" --profile "{profile_path}" --no-remote "{target_url}"'
        else:
            cmd = f'"{browser_exe}" --user-data-dir="{profile_path}" --no-first-run "{target_url}"'
        self.root.clipboard_clear()
        self.root.clipboard_append(cmd)
        add_operation_log(f"已复制 {browser_name} 启动命令: {profile_path}")
        write_log(f"复制命令 ({browser_name}): {profile_path}")
        messagebox.showinfo("已复制", "命令已复制")

    def copy_all_commands(self):
        accs = get_existing_accounts()
        config = load_config()
        account_browsers = {acc["name"]: acc.get("browser", "centbrowser") for acc in config.get("accounts", [])}
        browser_paths = config.get("browser_paths", {})
        cmds = []
        for name, path in accs:
            browser = account_browsers.get(name, "centbrowser")
            browser_exe = browser_paths.get(browser, "")
            if not browser_exe or not os.path.isfile(browser_exe):
                browser_exe = detect_browser_path(browser)
                if not browser_exe:
                    cmds.append(f"# 错误：未找到 {browser} 浏览器，无法生成命令 for {name}")
                    continue
            target_url = "https://creator.douyin.com/creator-micro/data/following/chat"
            if browser.startswith("firefox"):
                cmd = f'"{browser_exe}" --profile "{path}" --no-remote "{target_url}"'
            else:
                cmd = f'"{browser_exe}" --user-data-dir="{path}" --no-first-run "{target_url}"'
            cmds.append(cmd)
        self.root.clipboard_clear()
        self.root.clipboard_append("\n".join(cmds))
        add_operation_log("已复制所有账号的浏览器启动命令")
        write_log("复制所有账号命令")
        messagebox.showinfo("已复制", "全部命令已复制")

    # ---------- 克隆账号（克隆时继承源账号的浏览器类型）----------
    def clone_account(self):
        accs = get_existing_accounts()
        if not accs: return
        # 获取源账号的浏览器类型
        config = load_config()
        account_browsers = {acc["name"]: acc.get("browser", "centbrowser") for acc in config.get("accounts", [])}

        dlg = tk.Toplevel(self.root); dlg.title("克隆账号"); dlg.geometry("450x300"); dlg.configure(bg="white")
        tk.Label(dlg, text="选择源账号", font=("Microsoft YaHei UI",10,"bold"), bg="white").pack(pady=10)
        src = tk.StringVar()
        src_combo = ttk.Combobox(dlg, textvariable=src, values=[a[0] for a in accs], state="readonly", width=20)
        src_combo.pack(pady=4)
        src_combo.current(0)
        tk.Label(dlg, text="克隆数量", bg="white").pack()
        cnt = tk.StringVar(value="1")
        tk.Spinbox(dlg, from_=1, to=10, textvariable=cnt, width=5).pack()
        tk.Label(dlg, text="目标目录（可选）", bg="white", font=("Microsoft YaHei UI",8)).pack(pady=(8,0))
        tgt_frame = tk.Frame(dlg, bg="white")
        tgt_frame.pack(pady=2)
        tgt_var = tk.StringVar()
        tk.Entry(tgt_frame, textvariable=tgt_var, width=32).pack(side=tk.LEFT, padx=(0,4))
        ModernButton(tgt_frame, "浏览...", command=lambda: tgt_var.set(filedialog.askdirectory()), width=60).pack(side=tk.LEFT)

        def ok():
            s = src.get()
            c = int(cnt.get())
            target = tgt_var.get().strip() or None
            source_browser = account_browsers.get(s, "centbrowser")
            for i in range(1, c+1):
                d = f"{s}_clone{i}"
                if target:
                    dst_check = os.path.join(target, d)
                else:
                    dst_check = os.path.join(PROFILES_DIR, d)
                while os.path.exists(dst_check):
                    i += 1
                    d = f"{s}_clone{i}"
                    if target:
                        dst_check = os.path.join(target, d)
                    else:
                        dst_check = os.path.join(PROFILES_DIR, d)
                clone_profile_folder(s, d, target)
                # 添加克隆账号到配置，继承浏览器类型
                add_account_to_config(d, dst_check, source_browser)
                add_operation_log(f"克隆账号: {s} -> {d} (浏览器: {source_browser})")
                write_log(f"克隆: {s} -> {d}")
            dlg.destroy()
            self.refresh_account_list()
            if hasattr(self, 'cards_frame'):
                self.load_cards(load_config().get("accounts", []))
            messagebox.showinfo("完成", f"已克隆 {c} 个账号")
        AccentButton(dlg, "开始克隆", ok).pack(pady=10)

    # ---------- 调度器控制（保持不变）----------
    def start_scheduler(self):
        if self.scheduler_process and self.scheduler_process.poll() is None:
            messagebox.showinfo("提示", "调度器已在运行")
            return

        self.save_config_from_ui()
        config = load_config()
        if ensure_absolute_paths(config):
            save_config(config)

        for acc in config.get("accounts", []):
            pp = acc.get("profile_path", "")
            if not os.path.isdir(pp):
                if not messagebox.askyesno("目录不存在", f"账号 {acc['name']} 的目录不存在：\n{pp}\n\n是否继续？"):
                    return

        script = os.path.join(SHELL_DIR, "scheduler.ps1")
        if not os.path.isfile(script):
            messagebox.showerror("错误", "找不到 scheduler.ps1")
            return

        open(SCHEDULER_OUTPUT_LOG, "w", encoding="utf-8").close()
        write_scheduler_log("=== 调度器启动 ===")

        ps_cmd = f"chcp 65001 > $null; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; & '{script}'"
        cmd = ["powershell", "-NoProfile", "-Command", ps_cmd]

        try:
            creationflags = subprocess.CREATE_NO_WINDOW if platform.system() == "Windows" else 0
            self.scheduler_process = subprocess.Popen(
                cmd, cwd=SHELL_DIR,
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                universal_newlines=True, encoding='utf-8', errors='replace',
                creationflags=creationflags
            )
            add_operation_log("调度器已启动（守护进程）")
            write_log("调度器已启动")
            self.btn_start.pack_forget()
            self.btn_stop.pack(side=tk.LEFT, padx=4)
            self.terminal_append("=== 调度器已启动（守护进程）===\n")
            threading.Thread(target=self.read_output, daemon=True).start()
        except Exception as e:
            add_operation_log(f"调度器启动失败: {e}")
            messagebox.showerror("启动失败", str(e))

    def stop_scheduler(self):
        if self.scheduler_process and self.scheduler_process.poll() is None:
            if platform.system() == "Windows":
                subprocess.run(f'taskkill /F /T /PID {self.scheduler_process.pid}', shell=True)
            else:
                self.scheduler_process.terminate()
            self.scheduler_process = None
            add_operation_log("调度器已手动停止")
            write_log("调度器手动停止")
            self.btn_stop.pack_forget()
            self.btn_start.pack(side=tk.LEFT, padx=4)
            self.terminal_append("\n=== 调度器已停止 ===\n")

    def read_output(self):
        try:
            for line in iter(self.scheduler_process.stdout.readline, ''):
                if line:
                    self.scheduler_queue.put(line)
                    write_scheduler_log(line.strip())
        except:
            pass
        finally:
            self.scheduler_queue.put(None)

    def poll_scheduler_output(self):
        try:
            while True:
                line = self.scheduler_queue.get_nowait()
                if line is None:
                    self.terminal_append("=== 调度器已退出 ===\n")
                    add_operation_log("调度器已退出")
                    write_log("调度器已退出")
                    write_scheduler_log("=== 调度器结束 ===")
                    self.btn_stop.pack_forget()
                    self.btn_start.pack(side=tk.LEFT, padx=4)
                    self.scheduler_process = None
                    break
                self.terminal_append(line)
        except queue.Empty:
            pass
        self.root.after(100, self.poll_scheduler_output)

    def terminal_append(self, text):
        self.terminal.configure(state=tk.NORMAL)
        self.terminal.insert(tk.END, text)
        self.terminal.see(tk.END)
        self.terminal.configure(state=tk.DISABLED)

    def load_file_logs(self):
        self.op_log_text.configure(state=tk.NORMAL)
        self.op_log_text.delete(1.0, tk.END)
        for line in read_logs():
            self.op_log_text.insert(tk.END, line)
        self.op_log_text.see(tk.END)
        self.op_log_text.configure(state=tk.DISABLED)

    def clear_operation_log(self):
        if messagebox.askyesno("清空", "清空操作日志？"):
            clear_log_file()
            self.op_log_text.configure(state=tk.NORMAL)
            self.op_log_text.delete(1.0, tk.END)
            self.op_log_text.configure(state=tk.DISABLED)
            add_operation_log("操作日志已清空")
            write_log("操作日志已清空")

    def export_logs(self):
        path = filedialog.asksaveasfilename(defaultextension=".log")
        if path:
            with open(LOG_FILE, "r", encoding="utf-8") as src, open(path, "w", encoding="utf-8") as dst:
                dst.write(src.read())
            add_operation_log(f"日志已导出到: {path}")
            write_log(f"日志导出到: {path}")
            messagebox.showinfo("成功", "已导出")

if __name__ == "__main__":
    root = tk.Tk()
    try: root.iconbitmap(default="fire.ico")
    except: pass
    App(root)
    root.mainloop()