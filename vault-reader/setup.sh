#!/bin/bash
# vault-reader 一键安装脚本（必须 sudo 执行）
# 用法：
#   sudo bash /home/yong/vault-reader/setup.sh perms      # 修复 vault 权限
#   sudo bash /home/yong/vault-reader/setup.sh web        # 装 web 服务
#   sudo bash /home/yong/vault-reader/setup.sh tunnel     # 装 cloudflared 并初始化（交互式）
#   sudo bash /home/yong/vault-reader/setup.sh cron       # 装 hermes 每晚 23:00 整理任务
#   sudo bash /home/yong/vault-reader/setup.sh all        # 1+2+4 自动跑，3 单独跑（要交互）

set -euo pipefail

PROJECT_DIR="/home/yong/vault-reader"
VAULT_DIR="/root/obsidian-vault"
HERMES_HOME="/root/.hermes"

step_perms() {
  echo "==> 调整 vault 权限"
  chmod o+x /root
  chgrp -R users "$VAULT_DIR"
  chmod -R g+rwX "$VAULT_DIR"
  find "$VAULT_DIR" -type d -exec chmod g+s {} \;
  # 让 root 跑 git 时不报 dubious ownership
  git config --global --add safe.directory "$VAULT_DIR" 2>/dev/null || true
  echo "    done"
}

step_web() {
  echo "==> 安装 vault-reader systemd 服务"
  sudo -u yong python3 -m venv "$PROJECT_DIR/venv"
  sudo -u yong "$PROJECT_DIR/venv/bin/pip" install --quiet --upgrade pip
  sudo -u yong "$PROJECT_DIR/venv/bin/pip" install --quiet -r "$PROJECT_DIR/requirements.txt"

  install -m 644 "$PROJECT_DIR/systemd/vault-reader.service" /etc/systemd/system/vault-reader.service
  systemctl daemon-reload
  systemctl enable --now vault-reader.service
  sleep 2
  systemctl --no-pager status vault-reader.service | head -8
  echo "    web 服务跑在 http://127.0.0.1:8765"
}

step_tunnel() {
  echo "==> 安装 cloudflared"
  if ! command -v cloudflared >/dev/null 2>&1; then
    curl -fsSL -o /usr/local/bin/cloudflared \
      https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
    chmod +x /usr/local/bin/cloudflared
  fi
  cloudflared --version

  echo ""
  echo "    接下来需要交互登录。脚本会：1) 让你在浏览器登录 Cloudflare 并选一个 zone；"
  echo "    2) 创建一个名为 vault-reader 的 tunnel；3) 让你给个子域名（如 notes.example.com）"
  echo ""
  read -rp "继续？[y/N] " ans
  [ "$ans" = "y" ] || { echo "跳过"; return; }

  # ~/.cloudflared 默认在执行者家目录（root）
  cloudflared tunnel login
  cloudflared tunnel create vault-reader || true   # 已存在就跳过
  TUNNEL_ID=$(cloudflared tunnel list | awk '/vault-reader/ {print $1; exit}')
  echo "    tunnel ID = $TUNNEL_ID"

  read -rp "    输入要绑定的完整域名（如 notes.yourdomain.com）: " HOSTNAME
  cloudflared tunnel route dns vault-reader "$HOSTNAME"

  mkdir -p /etc/cloudflared
  cat >/etc/cloudflared/config.yml <<EOF
tunnel: $TUNNEL_ID
credentials-file: /root/.cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: $HOSTNAME
    service: http://127.0.0.1:8765
  - service: http_status:404
EOF

  install -m 644 "$PROJECT_DIR/systemd/cloudflared.service" /etc/systemd/system/cloudflared.service
  systemctl daemon-reload
  systemctl enable --now cloudflared.service
  sleep 2
  systemctl --no-pager status cloudflared.service | head -8
  echo "    tunnel 上线后，浏览器打开 https://$HOSTNAME 即可"
}

step_cron() {
  echo "==> 注册 hermes 每晚 23:00 整理任务"
  PROMPT_FILE="$PROJECT_DIR/vault-tidy-prompt.md"
  if [ ! -f "$PROMPT_FILE" ]; then
    echo "    缺少 $PROMPT_FILE"; exit 1
  fi

  cd /usr/local/lib/hermes-agent
  PROMPT_CONTENT=$(cat "$PROMPT_FILE")

  # 用 hermes_cli 直接调底层 API（避开 argparse 多行字符串的坑）
  HERMES_HOME=$HERMES_HOME ./venv/bin/python - <<PYEOF
import os, sys
os.environ.setdefault("HERMES_HOME", "$HERMES_HOME")
sys.path.insert(0, "/usr/local/lib/hermes-agent")
from cron.jobs import create_job

prompt = open("$PROMPT_FILE", "r", encoding="utf-8").read()

job = create_job(
    prompt=prompt,
    schedule="0 23 * * *",
    name="vault-tidy",
    skills=["obsidian"],
    workdir="$VAULT_DIR",
    deliver="local",
)
print(f"created job {job['id']}: next_run_at={job['next_run_at']}")
PYEOF

  echo "    完成。查看：hermes cron list"
}

case "${1:-help}" in
  perms)  step_perms ;;
  web)    step_web ;;
  tunnel) step_tunnel ;;
  cron)   step_cron ;;
  all)    step_perms; step_web; step_cron
          echo ""
          echo "==> 'all' 跳过了交互式 tunnel 步骤。完成后请单独跑："
          echo "    sudo bash $0 tunnel" ;;
  *)      echo "用法: $0 {perms|web|tunnel|cron|all}"; exit 1 ;;
esac
