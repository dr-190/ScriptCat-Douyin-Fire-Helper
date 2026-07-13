#!/usr/bin/env python3
"""
抖音续火助手 - HTTP 回调监听服务器
监听浏览器执行脚本 (UserScript) 发送的完成信号。

用法: python3 callback_server.py [端口] [超时秒数]
退出码: 0=收到回调 1=超时 2=错误
"""

import sys
import json
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler


class CallbackHandler(BaseHTTPRequestHandler):
    """处理浏览器执行脚本发送的 POST /done 回调请求"""
    result = None

    def do_POST(self):
        if self.path == '/done':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            try:
                CallbackHandler.result = json.loads(body)
            except (json.JSONDecodeError, UnicodeDecodeError):
                CallbackHandler.result = {'raw': body.decode('utf-8', errors='replace')}

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
            # 在后台线程中关闭服务器，避免死锁
            threading.Thread(target=self.server.shutdown, daemon=True).start()
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        # 静默日志输出，避免干扰调度脚本
        pass


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 7788
    timeout = int(sys.argv[2]) if len(sys.argv) > 2 else 300

    try:
        server = HTTPServer(('127.0.0.1', port), CallbackHandler)
    except OSError as e:
        print(f'无法启动服务器: {e}', file=sys.stderr)
        sys.exit(2)

    # 超时自动关闭
    timer = threading.Timer(timeout, server.shutdown)
    timer.daemon = True
    timer.start()

    server.serve_forever()
    timer.cancel()

    if CallbackHandler.result:
        print(json.dumps(CallbackHandler.result, ensure_ascii=False))
        sys.exit(0)
    else:
        print('超时：未收到回调', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
