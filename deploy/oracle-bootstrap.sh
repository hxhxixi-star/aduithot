#!/usr/bin/env bash
# Oracle Cloud「永久免费」ARM 实例首次初始化（Ubuntu 22.04 / 24.04 镜像）
#
# 适用机型：VM.Standard.A1.Flex，2 OCPU / 12 GB（2026-06 起 Always Free 的新上限）
# 用法（在 Oracle 机器上，用 ubuntu 用户执行）：
#   scp -i ~/.ssh/oracle.key deploy/oracle-bootstrap.sh ubuntu@<IP>:/tmp/
#   ssh -i ~/.ssh/oracle.key ubuntu@<IP> 'sudo bash /tmp/oracle-bootstrap.sh'
#
# 与 hk-bootstrap.sh 的三处差异：
#   1. 不用 ufw —— OCI 的 Ubuntu 镜像用 iptables，且默认 DROP/REJECT 未放行的端口
#   2. 不给 root 建目录 —— OCI 默认禁用 root 登录，日常用 ubuntu + sudo
#   3. swap 默认 0 —— 12G 内存不需要；若换成 1G 的 AMD Micro，用 SWAP_MB=2048 再跑
#
# ⚠️ 脚本管不了的一步：OCI 控制台 → 子网 → Security List → 放行入站 TCP 80 和 443。
#    不放行的话，机器里 iptables 开得再对，外网也访问不到。
#
# ⚠️ 空闲回收：Oracle 会把「7 天内 CPU 95 分位 <20% 且 网络 <20% 且 内存 <20%」的
#    Always Free 实例判定为空闲并回收。这套服务内存占用约 1GB / 12GB = 8%，
#    三个条件会同时满足。规避方式二选一：
#      a) 账号升级成「按需付费(PAYG)」—— Always Free 资源仍然 $0，但回收策略不再适用，
#         且 ARM 抢容量有优先级（推荐，只要不创建非免费资源就不会扣钱，配个预算告警即可）
#      b) 保留 Always Free，加一个吃内存的占位进程把内存占用推到 20% 以上（2.5GB）

set -euo pipefail

APP_DIR=${APP_DIR:-/srv/gsai}
SWAP_MB=${SWAP_MB:-0}
TARGET_USER=${SUDO_USER:-ubuntu}

[ "$(id -u)" -eq 0 ] || { echo "请用 sudo 运行：sudo bash $0"; exit 1; }

echo "==> 1/7 基础软件与时区"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg git openssl iptables >/dev/null
# OCI 镜像默认 UTC。业务逻辑自己带 tz（schedules 里硬编码 Asia/Shanghai），
# 这里只影响 date / 日志时间戳，但排查故障时差 8 小时很容易看错。
ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
echo "Asia/Shanghai" > /etc/timezone
echo "    $(date '+%Y-%m-%d %H:%M:%S %Z')"

echo "==> 2/7 Docker"
if command -v docker >/dev/null 2>&1; then
  echo "    已安装，跳过：$(docker --version)"
else
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker
# 日志轮转：worker 每小时跑一轮，不限制的话 json-file 会一直涨，几个月后把 47G 磁盘吃满。
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
# 让日常用户免 sudo 用 docker（OCI 默认禁用 root 登录）
if [ "$TARGET_USER" != "root" ] && id "$TARGET_USER" >/dev/null 2>&1; then
  usermod -aG docker "$TARGET_USER" || true
  echo "    已把 $TARGET_USER 加入 docker 组（重新登录生效）"
fi

echo "==> 3/7 swap"
if [ "$SWAP_MB" -eq 0 ]; then
  echo "    跳过（SWAP_MB=0，12G 机型不需要）"
elif swapon --show | grep -q .; then
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

echo "==> 4/7 应用目录"
mkdir -p "$APP_DIR"
chown "$TARGET_USER":"$TARGET_USER" "$APP_DIR" 2>/dev/null || true

echo "==> 5/7 本机防火墙（iptables）"
# OCI 的 Ubuntu 镜像可能在 INPUT 链末尾挂 REJECT，导致 80/443 连不上。
# 这里把放行规则插到链首，幂等：已存在就不重复插。
for port in 80 443; do
  if iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null; then
    echo "    $port 已放行"
  else
    iptables -I INPUT 1 -p tcp --dport "$port" -j ACCEPT
    echo "    已放行 $port"
  fi
done
if command -v netfilter-persistent >/dev/null 2>&1; then
  netfilter-persistent save >/dev/null 2>&1 || true
  echo "    规则已持久化"
elif [ -d /etc/iptables ]; then
  iptables-save > /etc/iptables/rules.v4 2>/dev/null || true
  echo "    规则已写入 /etc/iptables/rules.v4"
else
  echo "    ⚠️ 未找到持久化工具，重启后规则会丢；apt install iptables-persistent 后再跑一次"
fi

echo "==> 6/7 内核参数（Postgres / Node 的常规调优）"
# Postgres 在容器里跑，宿主的 overcommit 策略太保守时会在内存紧张时直接 OOM kill
grep -q '^vm.overcommit_memory' /etc/sysctl.conf || echo 'vm.overcommit_memory=1' >> /etc/sysctl.conf
sysctl -w vm.overcommit_memory=1 >/dev/null
echo "    vm.overcommit_memory=$(sysctl -n vm.overcommit_memory)"

echo "==> 7/7 自检"
docker --version
docker compose version
if uname -m | grep -q aarch64; then
  echo "    架构 arm64 ✓"
else
  echo "    ⚠️ 架构是 $(uname -m)，不是 arm64 —— 确认机型选的是 Ampere A1"
fi
free -h | head -2
echo "磁盘：$(df -h "$APP_DIR" | tail -1 | awk '{print $4" 可用"}')"
echo "已放行的端口："
iptables -S INPUT | grep -E 'dport (80|443)' | sed 's/^/    /' || echo "    （没找到，检查上一步的报错）"

echo
echo "============ 初始化完成 ============"
echo "还差两步："
echo "  1) OCI 控制台 → 子网 → Security List → 入站放行 TCP 80、443（0.0.0.0/0）"
echo "     系统内 iptables 已开，但安全列表不开的话外网照样连不上"
echo "  2) 放代码 —— 必须 git clone，不要用 hk-upload.sh 传 tar："
echo "       sudo mkdir -p $APP_DIR && sudo chown \$USER:\$USER $APP_DIR"
echo "       git clone https://github.com/hxhxixi-star/aduithot.git $APP_DIR"
echo "     （tar 包没有 .git，自动部署里的 git pull --ff-only 会失败）"
echo
echo "然后："
echo "  cd $APP_DIR && DOMAIN=<公网IP>.sslip.io bash deploy/hk-write-env.sh"
echo "  docker compose --profile https up -d --build    # 2 核 ARM 首次 20 分钟左右"
echo "  curl -I https://<公网IP>.sslip.io/              # Caddy 首次访问时签证书"
