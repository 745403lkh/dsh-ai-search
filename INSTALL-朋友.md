# dsh-ai-search 安装说明（给朋友）

这是一个 DeepSeek Harness 插件（无需第三方依赖，整个文件夹即可用）。

## 安装方法

1. 把整个 `dsh-ai-search` 文件夹解压到本机任意目录（建议路径不含空格，例如 `D:\dsh-plugins\dsh-ai-search`）。
2. 打开 DeepSeek Harness，在任意会话里对 Agent 说：
   「请用 plugin_manager 安装本地插件，绝对路径是 D:\dsh-plugins\dsh-ai-search」
   （安装动作需要你点一次批准。）
3. 安装完成后刷新页面（Ctrl+R）。左侧栏出现「AI 搜索」图标即成功。
4. 设置 → AI 搜索：可配置结果语言、百科详细程度、浏览模式三指标权重、是否保留页面状态。

## 使用

- 左侧栏「AI 搜索」：答疑 / 百科 / 浏览 三种模式。
- 也可以直接让 Agent 用 `curated_search` 工具（支持 mode 和 page 参数）。

## 前提

- 使用你自己的 DSH 账号的联网搜索与模型额度。
- 插件只写本机 `~/.dsh/ai-search/` 下的设置与历史文件，不含任何密钥。