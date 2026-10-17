#!/usr/bin/env bash
# 在开发机执行：把源码（可选连同镜像）传到香港服务器
#
#   HOST=1.2.3.4 ./deploy/hk-upload.sh
#   HOST=1.2.3.4 WITH_IMAGE=1 ./deploy/hk-upload.sh   # 2G 内存的机器推荐带上镜像，跳过服务器构建
#
# 排除 node_modules / .git / .env / .data：.env 里有密钥，必须在服务器上单独生成。

set -euo pipefail

: "${HOST:?用法：HOST=服务器IP ./deploy/hk-upload.sh}"
APP_DIR=${APP_DIR:-/srv/gsai}
SSH_USER=${SSH_USER:-root}
ROOT=$(cd "$(dirname "$0")/.." && pwd)

cd "$ROOT"

echo "==> 打包并上传（排除 node_modules/.git/.env/.data）"
tar -czf - \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=.env \
  --exclude=.data \
  --exclude=.workbuddy \
  . | ssh "${SSH_USER}@${HOST}" "mkdir -p ${APP_DIR} && tar xzf - -C ${APP_DIR}"
echo "    已上传到 ${SSH_USER}@${HOST}:${APP_DIR}"

if [ "${WITH_IMAGE:-0}" = "1" ]; then
  echo "==> 传镜像 aihot-app（未压缩 707MB，压缩后约 250MB）"
  docker save aihot-app:latest | gzip -1 | ssh "${SSH_USER}@${HOST}" 'gunzip | docker load'
  echo "    镜像已载入，服务器上启动时加 --no-build"
fi

echo
echo "上传完成。接下来："
echo "  ssh ${SSH_USER}@${HOST}"
echo "  cd ${APP_DIR} && bash deploy/hk-write-env.sh && docker compose --profile https up -d --build"
if [ "${WITH_IMAGE:-0}" = "1" ]; then
  echo "  （已传镜像，把 --build 换成 --no-build）"
fi
