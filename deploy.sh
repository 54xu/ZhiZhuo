#!/bin/bash
# =============================================================================
# 致卓收银 ZhiZhuo POS - 一键部署脚本
# =============================================================================
# 用法:
#   首次部署:  ./deploy.sh
#   更新部署:  ./deploy.sh update
#   查看状态:  ./deploy.sh status
#   查看日志:  ./deploy.sh logs
#   停止服务:  ./deploy.sh stop
#   重启服务:  ./deploy.sh restart
#   初始化数据: ./deploy.sh seed
#   完全卸载:  ./deploy.sh destroy
# =============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目目录 (脚本所在目录)
DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.prod.yml"
ENV_FILE="$DEPLOY_DIR/.env.prod"

# ---- 辅助函数 ----
log_info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装，正在自动安装..."
        curl -fsSL https://get.docker.com | sh
        sudo systemctl start docker
        sudo systemctl enable docker
        sudo usermod -aG docker "$USER"
        log_ok "Docker 安装完成，请重新登录后再运行此脚本"
        exit 0
    fi
    log_ok "Docker 已安装: $(docker --version)"
}

check_compose() {
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose V2 未安装"
        exit 1
    fi
    log_ok "Docker Compose 已安装: $(docker compose version --short)"
}

check_env() {
    if [ ! -f "$ENV_FILE" ]; then
        log_error ".env.prod 文件不存在，请先配置环境变量"
        log_info "复制模板: cp .env.prod.example .env.prod"
        exit 1
    fi
    log_ok "环境配置文件存在"
}

# ---- 首次部署 / 更新部署 ----
deploy() {
    echo ""
    echo "============================================"
    echo "   致卓收银 ZhiZhuo POS - 部署"
    echo "============================================"
    echo ""

    check_docker
    check_compose
    check_env

    # 创建 nginx 日志目录
    mkdir -p "$DEPLOY_DIR/nginx/logs"

    log_info "拉取基础镜像..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull mysql redis nginx 2>/dev/null || true

    log_info "构建并启动所有服务..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

    log_info "等待服务启动..."
    sleep 10

    # 检查服务状态
    log_info "检查服务状态..."
    if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps | grep -q "unhealthy\|Exit"; then
        log_warn "部分服务异常，查看日志:"
        docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
        docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs --tail=30 api
    else
        log_ok "所有服务启动成功!"
    fi

    # 运行数据库迁移
    log_info "执行数据库 Schema 同步..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec api sh -c "npx prisma db push --accept-data-loss" 2>/dev/null || {
        log_warn "Prisma db push 失败，等待 MySQL 完全就绪后重试..."
        sleep 15
        docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec api sh -c "npx prisma db push --accept-data-loss"
    }
    log_ok "数据库 Schema 同步完成"

    echo ""
    show_info
}

# ---- Seed 演示数据 ----
seed_data() {
    log_info "导入演示数据 (Seed)..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec api sh -c "node dist/prisma-seed.js" 2>/dev/null || {
        # 如果没有编译好的 seed，用 npx 运行
        docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec api sh -c "npx ts-node prisma/seed.ts" 2>/dev/null || {
            log_warn "容器内没有 ts-node，尝试用 prisma db seed..."
            docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec api sh -c "npx prisma db seed"
        }
    }
    log_ok "演示数据导入完成"
}

# ---- 查看状态 ----
status() {
    echo ""
    echo "============================================"
    echo "   致卓收银 - 服务状态"
    echo "============================================"
    echo ""
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
    echo ""

    # 尝试健康检查
    source "$ENV_FILE" 2>/dev/null
    local port="${NGINX_PORT:-8800}"
    log_info "API 健康检查 (http://localhost:$port/health):"
    curl -s "http://localhost:$port/health" 2>/dev/null && echo "" || log_warn "API 尚未就绪"
}

# ---- 查看日志 ----
logs() {
    local service="${1:-api}"
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs -f --tail=100 "$service"
}

# ---- 停止服务 ----
stop() {
    log_info "停止所有服务..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down
    log_ok "服务已停止"
}

# ---- 重启服务 ----
restart() {
    log_info "重启所有服务..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" restart
    log_ok "服务已重启"
}

# ---- 更新部署 (重新构建 API) ----
update() {
    echo ""
    echo "============================================"
    echo "   致卓收银 - 更新部署"
    echo "============================================"
    echo ""
    check_env

    log_info "重新构建 API 服务..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build api

    log_info "等待服务就绪..."
    sleep 8

    log_info "执行数据库 Schema 同步..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec api sh -c "npx prisma db push --accept-data-loss" 2>/dev/null || true

    log_ok "更新完成!"
    echo ""
    show_info
}

# ---- 完全卸载 ----
destroy() {
    log_warn "⚠️  即将删除所有容器和数据卷 (包括数据库数据)!"
    read -p "确认删除? (输入 yes 继续): " confirm
    if [ "$confirm" = "yes" ]; then
        docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down -v
        log_ok "已完全清除"
    else
        log_info "已取消"
    fi
}

# ---- 显示访问信息 ----
show_info() {
    source "$ENV_FILE" 2>/dev/null
    local api_port="${API_PORT:-3000}"
    local nginx_port="${NGINX_PORT:-8800}"
    local server_ip
    server_ip=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "YOUR_SERVER_IP")

    echo "============================================"
    echo "   🎉 致卓收银 POS 部署信息"
    echo "============================================"
    echo ""
    echo "  Nginx 入口:  http://$server_ip:$nginx_port"
    echo "  API 直连:    http://$server_ip:$api_port"
    echo "  健康检查:    http://$server_ip:$nginx_port/health"
    echo "  API 基础路径: http://$server_ip:$nginx_port/api/v1"
    echo ""
    echo "  常用命令:"
    echo "    ./deploy.sh status   # 查看状态"
    echo "    ./deploy.sh logs     # 查看 API 日志"
    echo "    ./deploy.sh logs mysql  # 查看 MySQL 日志"
    echo "    ./deploy.sh seed     # 导入演示数据"
    echo "    ./deploy.sh update   # 更新部署"
    echo "    ./deploy.sh restart  # 重启服务"
    echo "    ./deploy.sh stop     # 停止服务"
    echo "============================================"
}

# ---- 主入口 ----
case "${1:-deploy}" in
    deploy)   deploy ;;
    update)   update ;;
    status)   status ;;
    logs)     logs "${2:-api}" ;;
    stop)     stop ;;
    restart)  restart ;;
    seed)     seed_data ;;
    destroy)  destroy ;;
    info)     show_info ;;
    *)
        echo "用法: $0 {deploy|update|status|logs|stop|restart|seed|destroy|info}"
        echo ""
        echo "  deploy   - 首次部署 (默认)"
        echo "  update   - 更新代码重新构建"
        echo "  status   - 查看服务状态"
        echo "  logs     - 查看日志 (可选: logs mysql / logs redis)"
        echo "  stop     - 停止所有服务"
        echo "  restart  - 重启所有服务"
        echo "  seed     - 导入演示数据"
        echo "  destroy  - 完全卸载 (删除数据)"
        echo "  info     - 显示部署信息"
        exit 1
        ;;
esac
