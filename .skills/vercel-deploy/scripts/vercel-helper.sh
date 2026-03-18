#!/bin/bash

# Vercel 部署辅助脚本
# 用法: ./vercel-helper.sh <command> [args...]

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 显示帮助
show_help() {
    echo "Vercel 部署辅助脚本"
    echo ""
    echo "用法: $0 <command> [args...]"
    echo ""
    echo "命令:"
    echo "  set-env <project> <key> <value> <token>  设置环境变量"
    echo "  get-project <project> <token>            获取项目信息"
    echo "  list-deployments <project> <token>       列出部署"
    echo "  trigger-deploy <project> <token>         触发部署"
    echo "  setup-supabase <project> <token>         配置 Supabase 环境变量"
    echo "  get-supabase-creds                       获取沙箱 Supabase 凭证"
    echo ""
    echo "示例:"
    echo "  $0 set-env my-project API_KEY abc123 vcp_xxx"
    echo "  $0 setup-supabase my-project vcp_xxx"
}

# 设置环境变量
set_env() {
    local project=$1
    local key=$2
    local value=$3
    local token=$4
    
    if [[ -z "$project" || -z "$key" || -z "$value" || -z "$token" ]]; then
        log_error "参数不完整"
        echo "用法: $0 set-env <project> <key> <value> <token>"
        exit 1
    fi
    
    log_info "设置环境变量 $key..."
    
    local response
    response=$(curl -s -X POST "https://api.vercel.com/v10/projects/$project/env" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d "{
            \"key\": \"$key\",
            \"value\": \"$value\",
            \"type\": \"plain\",
            \"target\": [\"production\", \"preview\", \"development\"]
        }")
    
    if echo "$response" | grep -q '"created"'; then
        log_info "环境变量 $key 设置成功"
    else
        log_error "设置失败: $response"
        exit 1
    fi
}

# 获取项目信息
get_project() {
    local project=$1
    local token=$2
    
    if [[ -z "$project" || -z "$token" ]]; then
        log_error "参数不完整"
        echo "用法: $0 get-project <project> <token>"
        exit 1
    fi
    
    log_info "获取项目 $project 信息..."
    
    curl -s "https://api.vercel.com/v9/projects/$project" \
        -H "Authorization: Bearer $token" | jq '.'
}

# 列出部署
list_deployments() {
    local project=$1
    local token=$2
    
    if [[ -z "$project" || -z "$token" ]]; then
        log_error "参数不完整"
        echo "用法: $0 list-deployments <project> <token>"
        exit 1
    fi
    
    log_info "列出项目 $project 的部署..."
    
    curl -s "https://api.vercel.com/v6/deployments?projectId=$project&limit=5" \
        -H "Authorization: Bearer $token" | jq '.deployments[] | {uid, url, state, createdAt}'
}

# 触发部署（通过推送空提交）
trigger_deploy() {
    local project=$1
    local token=$2
    
    log_info "触发部署..."
    log_warn "推荐使用 git push 触发自动部署"
    
    # 尝试推送空提交
    if git rev-parse --git-dir > /dev/null 2>&1; then
        git commit --allow-empty -m "chore: trigger deploy"
        git push
        log_info "已推送触发部署"
    else
        log_error "当前目录不是 Git 仓库，请手动推送代码"
    fi
}

# 配置 Supabase 环境变量
setup_supabase() {
    local project=$1
    local token=$2
    
    if [[ -z "$project" || -z "$token" ]]; then
        log_error "参数不完整"
        echo "用法: $0 setup-supabase <project> <token>"
        exit 1
    fi
    
    # 从沙箱环境变量获取
    local supabase_url="${COZE_SUPABASE_URL:-}"
    local supabase_key="${COZE_SUPABASE_ANON_KEY:-}"
    
    if [[ -z "$supabase_url" || -z "$supabase_key" ]]; then
        log_error "未找到 Supabase 凭证，请确保在沙箱环境中运行"
        echo "或手动设置:"
        echo "  export COZE_SUPABASE_URL=your_url"
        echo "  export COZE_SUPABASE_ANON_KEY=your_key"
        exit 1
    fi
    
    log_info "配置 Supabase 环境变量..."
    
    set_env "$project" "COZE_SUPABASE_URL" "$supabase_url" "$token"
    set_env "$project" "COZE_SUPABASE_ANON_KEY" "$supabase_key" "$token"
    
    log_info "Supabase 配置完成！"
}

# 获取沙箱 Supabase 凭证
get_supabase_creds() {
    log_info "Supabase 凭证:"
    echo ""
    echo "COZE_SUPABASE_URL=$COZE_SUPABASE_URL"
    echo "COZE_SUPABASE_ANON_KEY=$COZE_SUPABASE_ANON_KEY"
}

# 主命令
case "$1" in
    set-env)
        set_env "$2" "$3" "$4" "$5"
        ;;
    get-project)
        get_project "$2" "$3"
        ;;
    list-deployments)
        list_deployments "$2" "$3"
        ;;
    trigger-deploy)
        trigger_deploy "$2" "$3"
        ;;
    setup-supabase)
        setup_supabase "$2" "$3"
        ;;
    get-supabase-creds)
        get_supabase_creds
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        if [[ -z "$1" ]]; then
            show_help
        else
            log_error "未知命令: $1"
            show_help
            exit 1
        fi
        ;;
esac
