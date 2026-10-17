#!/usr/bin/env bash
# 香港轻量服务器首次初始化（Ubuntu 22.04 / 24.04，root 执行）
#
#   curl -fsSL <这个文件的地址> | bash
# 或者上传后：
#   scp deploy/hk-bootstrap.sh root@<IP>:/root/ && ssh root@<IP> 'bash /root/hk-bootstrap.sh'
#
# 做的事：装 Docker、加 2G swap（2G 内存构建镜像会 OOM）、建应用目录、放行防火墙。
# 幂等：重复执行不会重复安装或重复加 swap。

set -euo pipefail

APP_DIR=${APP_DIR:-/srv/gsai}
SWAP_MB=${SWAP_MB:-2048}

[ "$(id -u)" -eq 0 ] || { echo "请用 root 运行（sudo bash $0）"; exit 1; }

echo "==> 1/5 基础软件与时区"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg git openssl >/dev/null
# 云镜像默认 UTC。业务逻辑自己带 tz（schedules 里硬编码 Asia/Shanghai），
# 这里只影响 date / 日志时间戳，但排查故障时差 8 小时很容易看错。
ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
echo "Asia/Shanghai" > /etc/timezone
echo "    $(date '+%Y-%m-%d %H:%M:%S %Z')"

echo "==> 2/5 Docker"
if command -v docker >/dev/null 2>&1; then
  echo "    已安装，跳过：$(docker --version)"
else
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker
# 日志轮转：worker 每小时跑一轮，不限制的话 json-file 会一直涨，几个月后把磁盘吃满。
# 只在没有 daemon.json 时写，避免覆盖用户已有的配置。
if [ ! -f /etc/docker/daemon.json ]; then
  cat > /etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
JSON
  systemctl restart docker
  echo "    已配置日志轮转（单容器最多 30MB）"
else
  echo "    /etc/docker/daemon.json 已存在，未改动"
fi

echo "==> 3/5 swap"
if swapon --show | grep -q .; then
  echo "    已有 swap，跳过"
else
  fallocate -l "${SWAP_MB}M" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=10 >/dev/null
  grep -q '^vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf
  echo "    已加 ${SWAP_MB}MB swap"
fi

echo "==> 4/5 应用目录"
mkdir -p "$APP_DIR"

echo "==> 5/5 防火墙"
# 腾讯云/阿里云的机器安全组在控制台，系统内 ufw 默认是关的；开了就顺手放行
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 22/tcp  >/dev/null
  ufw allow 80/tcp  >/dev/null
  ufw allow 443/tcp >/dev/null
  echo "    已放行 22/80/443"
else
  echo "    ufw 未启用，记得在云控制台安全组放行 80、443"
fi

echo
echo "============ 初始化完成 ============"
docker --version
docker compose version
echo
free -h | head -2
echo "磁盘：$(df -h "$APP_DIR" | tail -1 | awk '{print $4" 可用"}')"
echo
echo "下一步：在开发机执行 deploy/hk-upload.sh 把代码传上来。"
echo "目录：$APP_DIR"
