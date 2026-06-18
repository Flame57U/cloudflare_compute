# Vault Reader

Kindle 风格的 Obsidian vault 网页阅读器 + 每晚自动整理。

## 文件结构

```
vault-reader/
├── app/main.py              FastAPI 后端
├── templates/index.html     页面骨架
├── static/style.css         Kindle 主题（米色 / 暗色）
├── static/app.js            前端 + 分页逻辑
├── systemd/
│   ├── vault-reader.service web 服务的 systemd 单元
│   └── cloudflared.service  cloudflared 隧道的 systemd 单元
├── vault-tidy-prompt.md     每晚整理任务的 prompt（保守、可回滚）
├── requirements.txt
├── run.sh                   开发态启动
└── setup.sh                 一键部署（必须 sudo）
```

## 一键部署（在 root shell 里跑）

```bash
sudo bash /home/yong/vault-reader/setup.sh all      # 权限 + web + cron（不含 tunnel）
sudo bash /home/yong/vault-reader/setup.sh tunnel   # 单独跑 tunnel（要在浏览器登录 CF）
```

或者分步：

```bash
sudo bash /home/yong/vault-reader/setup.sh perms   # 1. /root/obsidian-vault 放宽给 yong
sudo bash /home/yong/vault-reader/setup.sh web     # 2. 装 venv + systemd 服务
sudo bash /home/yong/vault-reader/setup.sh tunnel  # 3. 装 cloudflared + 隧道（交互）
sudo bash /home/yong/vault-reader/setup.sh cron    # 4. 注册 hermes 每晚 23:00 整理
```

## 操作快捷键

| 键 | 动作 |
|---|---|
| `→` / `Space` / `j` / `PgDn` | 下一页 |
| `←` / `k` / `PgUp` | 上一页 |
| `t` | 切换目录侧栏 |
| `d` | 切换暗色 / 米色主题 |

触屏：左 1/3 屏点击 = 上一页，右 1/3 = 下一页，滑动也行。

## hermes 整理任务

* 计划：`0 23 * * *`
* 工作目录：`/root/obsidian-vault`
* 用 `obsidian` skill 读写笔记
* 硬约束（详见 `vault-tidy-prompt.md`）：
  - 不改一级目录
  - 不新建/删除/移动笔记
  - 只修明显的代码块/格式错（≤ 20 个文件、单文件 ≤ 30 行 diff）
  - commit + push 到当前分支

查看任务：
```bash
sudo -u root /usr/local/lib/hermes-agent/venv/bin/python -m hermes_cli.main cron list
```

手动跑一次（不等 23:00）：
```bash
sudo -u root /usr/local/lib/hermes-agent/venv/bin/python -m hermes_cli.main cron run vault-tidy
```

## 改 prompt 后重置 cron

```bash
sudo -u root /usr/local/lib/hermes-agent/venv/bin/python -m hermes_cli.main cron remove vault-tidy
sudo bash /home/yong/vault-reader/setup.sh cron
```
