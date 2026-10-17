#!/usr/bin/env bash
# 在服务器上生成 .env（密钥随机、权限 600、不会覆盖已有文件）
#
#   DOMAIN=gsai.example.com LLM_KEY=sk-xxx bash deploy/hk-write-env.sh
#
# 不传参数则交互式询问。已有的 .env 不会被覆盖，除非 FORCE=1。

set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env ] && [ "${FORCE:-0}" != "1" ]; then
  echo ".env 已存在，未改动。要重新生成：FORCE=1 bash $0" >&2
  exit 1
fi

DOMAIN=${DOMAIN:-}
LLM_KEY=${LLM_KEY:-}
LLM_MODEL=${LLM_MODEL:-deepseek-flash}

if [ -z "$DOMAIN" ]; then
  read -r -p "域名（例如 gsai.example.com，先把它解析到本机）: " DOMAIN
fi
if [ -z "$LLM_KEY" ]; then
  read -r -p "模型 API Key: " LLM_KEY
fi
[ -n "$DOMAIN" ] || { echo "域名不能为空" >&2; exit 1; }
[ -n "$LLM_KEY" ] || { echo "API Key 不能为空" >&2; exit 1; }

ADMIN_PASSWORD=$(openssl rand -hex 12)
SESSION_SECRET=$(openssl rand -hex 32)
IMG_PROXY_SIGN_SECRET=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 16)

umask 077
cat > .env <<EOF
# 由 deploy/hk-write-env.sh 生成于 $(date '+%Y-%m-%d %H:%M:%S')

# 读者实际访问的地址。RSS、sitemap、分享图、MCP 里的绝对链接都读它。
SITE_URL=https://${DOMAIN}
SITE_DOMAIN=${DOMAIN}
# 3000 只给本机 Caddy 用，不直接对外
PORT=127.0.0.1:3000
TRUST_PROXY=true

ADMIN_PASSWORD=${ADMIN_PASSWORD}
SESSION_SECRET=${SESSION_SECRET}
IMG_PROXY_SIGN_SECRET=${IMG_PROXY_SIGN_SECRET}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

LLM_BASE_URL=https://api.deepseek.com/v1
LLM_API_KEY=${LLM_KEY}
LLM_MODEL=${LLM_MODEL}
LLM_EXTRA_JSON={"thinking":{"type":"disabled"}}

# 这两个开关只认小写的 true
COLLECT_ENABLED=true
MODEL_CALLS_ENABLED=true
EOF
chmod 600 .env

echo
echo "已写入 .env（权限 600）。管理员密码只显示这一次，请抄走："
echo
echo "    ${ADMIN_PASSWORD}"
echo
echo "确认无误后启动："
echo "    docker compose --profile https up -d --build"
