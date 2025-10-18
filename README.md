# ScriptCat-Douyin-Fire-Helper 🔥

抖音续火花自动发送助手 - 每天自动发送续火消息，保持好友火花不熄灭！学生党狂喜！

[![GitHub license](https://img.shields.io/github/license/dr-190/ScriptCat-Douyin-Fire-Helper)](https://github.com/dr-190/ScriptCat-Douyin-Fire-Helper/blob/main/LICENSE)
[![Tampermonkey](https://img.shields.io/badge/Tampermonkey-✓-blue)](https://www.tampermonkey.net/)
[![ScriptCat](https://img.shields.io/badge/ScriptCat-✓-orange)](https://docs.scriptcat.org/)
[![GitHub stars](https://img.shields.io/github/stars/dr-190/ScriptCat-Douyin-Fire-Helper)](https://github.com/dr-190/ScriptCat-Douyin-Fire-Helper/stargazers)

## ✨ 功能特性

### 🕒 智能定时发送
- ⏰ **精准定时**: 支持自定义发送时间（默认 00:01:00）
- 🔄 **自动重试**: 可配置重试机制，最多重试10次
- 📅 **每日检测**: 智能判断当日是否已发送，避免重复

### 🎭 丰富消息内容
- 🤖 **一言API集成**: 自动获取优美句子，支持自定义格式
- 📝 **TXTAPI支持**: 支持外部API和手动文本两种模式
- 🎨 **灵活格式**: 自定义消息模板，支持占位符替换
- 🔄 **随机选择**: 手动模式下支持随机或顺序发送文本

### 🎛️ 人性化控制
- 🖥️ **可视化面板**: 实时显示状态、倒计时和操作日志
- ⚙️ **图形化设置**: 友好的设置界面，配置简单直观
- 📊 **状态监控**: 实时显示一言API和TXTAPI状态
- 🔔 **桌面通知**: 发送成功时显示系统通知

## 🛠️ 安装使用

### 前提条件
- 浏览器安装 [ScriptCat（推荐）](https://docs.scriptcat.org/) 或 [Tampermonkey](https://www.tampermonkey.net/) 脚本管理器

### 安装步骤
1. 在线查看 [scriptcat-douyin-fire-helper.user.js](https://github.com/dr-190/ScriptCat-Douyin-Fire-Helper/blob/main/scriptcat-douyin-fire-helper.user.js) 文件 或 下载 [scriptcat-douyin-fire-helper.user.js](https://github.com/dr-190/ScriptCat-Douyin-Fire-Helper/releases/download/v2.6/scriptcat-douyin-fire-helper.user.js) 文件
2. 在脚本管理器中点击"添加新脚本"
3. 将文件内容粘贴到编辑器中保存
- **已经安装ScriptCat或Tampermonkey的点击 > [快速安装](https://scriptcat.org/scripts/code/4141/%E6%8A%96%E9%9F%B3%E7%BB%AD%E7%81%AB%E8%8A%B1%E8%87%AA%E5%8A%A8%E5%8F%91%E9%80%81%E5%8A%A9%E6%89%8B-%E9%9B%86%E6%88%90%E4%B8%80%E8%A8%80API%E5%92%8CTXTAPI.user.js)**
4. 访问 [抖音创作者平台-互动管理-私信管理](https://creator.douyin.com/creator-micro/data/following/chat)

### 快速开始
1. 打开[抖音创作者平台私信管理页面](https://creator.douyin.com/creator-micro/data/following/chat)
2. 页面右上角会出现控制面板
3. 点击"设置"按钮配置发送时间和消息内容
4. 点击你要续火的用户，进入聊天界面【（一个网页只能单独一个，多个可以尝试多开几个网页再点进其他用户聊天（没做过测试）】
5. 脚本将在指定时间自动发送续火消息
6. **重点：浏览器设置(Chrome为例) > 性能 > 始终让以下网站保持活跃状态 > 添加 > 手动添加网站 > 网站填写 'creator.douyin.com' > 添加**

## 💻 挂脚本

### 云电脑挂机方案

为了实现 24 小时不间断自动发送续火消息，推荐使用**挂机宝（云电脑）**来运行本脚本。

### 推荐挂机平台

| 平台名称 | 特点 | 价格参考 |
|---------|------|---------|
| **阿里云/腾讯云轻量服务器** | 稳定可靠，性能强劲 | 约 24-50 元/月 |
| **各种挂机宝服务商** | 专为挂机优化，价格低廉 | 约 10-30 元/月 |

### 挂机部署步骤

1. **购买云服务器**
   - 选择 Windows 系统的云电脑（推荐 Windows Server）
   - 配置建议：1核CPU、1GB内存、20GB硬盘即可

2. **环境配置**
   - 安装浏览器（推荐 [百分浏览器](https://www.centbrowser.cn/)）
   - 安装 [Tampermonkey](https://www.tampermonkey.net/) 或 [ScriptCat](https://docs.scriptcat.org/) 脚本管理器
   - 登录抖音创作者平台并保持页面打开
   - **重点：浏览器设置 > 性能 > 始终让以下网站保持活跃状态 > 添加 > 手动添加网站 > 网站填写 'creator.douyin.com' > 添加**

## ⚙️ 配置说明

### 基本设置
- **发送时间**: 设置每天的发送时间（格式: HH:mm:ss）
- **重试次数**: 发送失败时的最大重试次数（1-10次）

### 一言API设置
- **启用/禁用**: 是否使用一言API
- **消息格式**: 自定义显示格式，支持变量：
  - `{hitokoto}` - 一言内容
  - `{from}` - 出处
  - `{from_who}` - 作者

### TXTAPI设置
- **模式选择**: 
  - API模式: 从指定URL获取文本内容
  - 手动模式: 使用自定义文本列表
- **随机发送**: 手动模式下是否随机选择文本
- **文本内容**: 每行一个文本，支持换行

## 🔧 技术特性

- **跨平台支持**: 支持 Tampermonkey 和 ScriptCat
- **本地存储**: 使用GM_setValue保存配置，无需服务器
- **错误处理**: 完善的错误处理和重试机制
- **性能优化**: 轻量级设计，不影响页面性能

## 📁 项目结构

ScriptCat-Douyin-Fire-Helper/
├── scriptCat-douyin-fire-helper.user.js # 主脚本文件
├── README.md # 项目说明文档
└── LICENSE # 开源许可证


# 🚀 更新日志

## 📋 版本概览

## v1.0 (初始版本)

### 🔥 核心功能
- **自动发送续火消息**：每天在指定时间自动发送消息，保持火花不灭
- **智能发送检测**：自动检测今日是否已发送，避免重复发送
- **精确时间控制**：支持自定义发送时间，精确到秒（HH:mm:ss格式）

### 📝 消息内容系统
- **基础消息配置**：可设置默认文本内容
- **自定义消息模板**：支持 `[API]` 和 `[TXTAPI]` 占位符
- **多行消息支持**：完整支持消息内容中的换行符
- **占位符保留**：自定义消息中的占位符在关闭API时保持不变

### 🌐 API集成功能
- **一言API集成**：自动从 hitokoto.cn 获取每日一言
- **自定义格式**：支持 `{hitokoto}`、`{from}`、`{from_who}` 变量
- **TXTAPI支持**：
  - **API模式**：从自定义API链接获取文本
  - **手动模式**：自定义文本列表，支持随机选择或顺序发送
- **跨日重置**：自动重置手动文本发送记录

### ⚙️ 配置管理系统
- **图形化设置面板**：无需修改代码即可调整所有参数
- **配置持久化**：自动保存用户设置到本地存储
- **一键重置**：支持完全重置所有配置到默认值
- **配置验证**：完整的输入验证和错误提示

### 🎮 控制面板特性
- **实时状态显示**：今日发送状态、下次发送时间、重试次数
- **动态倒计时**：精确显示距离下次发送的剩余时间
- **API状态监控**：实时显示一言和TXTAPI的获取状态
- **操作日志**：完整的操作记录和状态反馈

### 🔧 高级功能
- **智能重试机制**：发送失败时自动重试，可配置重试次数（1-10次）
- **系统通知**：发送成功时显示桌面通知
- **多平台兼容**：完整支持 Tampermonkey 和 ScriptCat
- **环境自适应**：自动检测运行环境并优化兼容性

### 🛡️ 稳定性和错误处理
- **网络超时控制**：API请求超时处理机制
- **错误恢复**：完善的错误处理和恢复逻辑
- **元素定位优化**：精确的聊天输入框定位方法
- **防重复发送**：多重机制防止消息重复发送

### 🎨 用户界面
- **现代化设计**：美观的悬浮控制面板
- **响应式布局**：适配不同屏幕尺寸
- **直观操作**：所有功能一键可达
- **实时反馈**：操作结果立即可见

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

## 📜 开源协议

本项目采用 MIT 协议 - 查看 [LICENSE](LICENSE) 文件了解详情

## ⚠️ 注意事项

- 请合理使用，避免频繁发送消息
- 本脚本仅用于学习交流目的
- 使用前请确保遵守抖音平台规则
- 开发者不对滥用造成的后果负责

## ❓ 常见问题

**Q: 脚本无法正常工作时怎么办？**  
A: 请检查控制台错误信息，或提交Issue描述具体问题。

**Q: 如何修改发送时间？**  
A: 点击控制面板的"设置"按钮，在发送时间字段中输入新的时间。

**Q: 支持多个抖音账号吗？**   
A: 每个浏览器实例只能运行一个脚本实例，多账号需要使用不同浏览器或配置文件。

## 🤖 AI 声明

**重要声明**: 本脚本由 AI 辅助开发完成。虽然经过多次测试和优化，但仍可能存在未发现的 bug 或兼容性问题。

### 开发背景
- 🔧 **AI 辅助开发**: 本项目的主要代码逻辑和功能实现由 AI 生成
- 👨‍💻 **人工优化**: 经过开发者多次测试、调试和功能优化
- 🧪 **持续改进**: 欢迎用户反馈使用中的问题，共同完善脚本

## 🌟 致谢

感谢以下项目的支持：
- [一言API](https://hitokoto.cn/) - 提供优美的句子
- [Tampermonkey](https://www.tampermonkey.net/) - 强大的用户脚本管理器
- [ScriptCat](https://docs.scriptcat.org/) - 优秀的脚本管理器
- [DeepSeek](https://www.deepseek.com/) - 提供AI辅助开发支持

---

⭐ 如果这个项目对您有帮助，请给它一个 Star！您的支持是我持续更新的动力。
