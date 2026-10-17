#!/usr/bin/env bash
# Cloudflare 快速隧道：把本机已经在跑的站暴露成公网 HTTPS 地址
#
#   bash deploy/cf-quick-tunnel.sh          # 默认转 127.0.0.1:3000
#   PORT=8080 bash deploy/cf-quick-tunnel.sh
#
# 这是「最快看到公网效果」的路子：不改代码、不买机器、不要域名。
# 代价三条，长期用必须换 named tunnel 或退回服务器部署：
#   1. 地址是随机的 xxx.trycloudflare.com，**每次重启都变**
#   2. 走的是本机网络，电脑关机/休眠就断
#   3. Cloudflare 快速隧道没有 SLA，官方定位是「测试用」
#
# 前提：docker compose up -d 已经跑起来，本机 3000 端口有响应。
#
# ⚠️ 最常见的失败原因：本机开着 HTTP 代理（Clash / v2ray / 公司代理）。
#    云厂商隧道走 **UDP 7844（QUIC）**，HTTP 代理转发不了，现象是日志里
#    「Failed to dial a quic connection: timeout: no recent network activity」
#    一直重试、地址拿到了但访问是 530。所以这里先清掉代理变量。
#    如果清掉仍不通，说明运营商或防火墙封了 UDP 7844，改用：
#      bash deploy/cf-quick-tunnel.sh --protocol http2      # 走 TCP 7844

set -euo pipefail

unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy 2>/dev/null || true

PORT=${PORT:-3000}
CF=${CF:-/c/Users/Administrator/.workbuddy/bin/cloudflared.exe}

[ -x "$CF" ] || { echo "找不到 cloudflared：$CF" >&2; echo "下载：curl -fL -o \$CF https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" >&2; exit 1; }

if ! curl -fsS -o /dev/null --max-time 5 "http://127.0.0.1:${PORT}/"; then
  echo "本机 ${PORT} 端口没有响应。" >&2
  echo "先在 AIHOT 目录执行：docker compose up -d" >&2
  exit 1
fi

LOG=${LOG:-/tmp/cf-tunnel.log}

echo "本机 ${PORT} 正常，正在建立隧道…"
echo "（地址会在十几秒内出现；这个窗口要一直开着，关掉隧道就断）"
echo

# 只留「地址」和「错误」两类行：全量日志进 $LOG，需要排查时看它。
# 额外参数原样透传，例如 --protocol http2
"$CF" tunnel --url "http://127.0.0.1:${PORT}" --no-autoupdate "$@" 2>&1 \
  | tee "$LOG" \
  | grep --line-buffered -E 'https://[a-z0-9-]+\.trycloudflare\.com|ERR '

echo
echo "隧道已退出。完整日志：$LOG" >&2
