#!/bin/bash

# Vercel 部署辅助脚本
# 用法: ./vercel-helper.sh <command> [args...]

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# 显示帮助
show_help() {
    echo "Vercel 部署辅助脚本"
    echo ""
    echo "用法: $0 <command> [args...]"
    echo ""
    echo "=== GitHub 操作 ==="
    echo "  create-repo <name> <github_token> [private]     创建 GitHub 仓库"
    echo "  push-code <repo_url> <github_token>             推送代码到仓库"
    echo "  check-repo <user/repo> <github_token>           检查仓库是否存在"
    echo ""
    echo "=== Vercel 操作 ==="
    echo "  create-project <name> <github_repo> <token>     创建 Vercel 项目"
    echo "  set-env <project> <key> <value> <token>         设置环境变量"
    echo "  get-project <project> <token>                   获取项目信息"
    echo "  list-projects <token>                           列出所有项目"
    echo "  list-deployments <project> <token>              列出部署"
    echo "  delete-project <project> <token>                删除项目"
    echo ""
    echo "=== Supabase 操作 ==="
    echo "  setup-supabase <project> <token>                配置 Supabase 环境变量"
    echo "  get-supabase-creds                              获取沙箱 Supabase 凭证"
    echo ""
    echo "=== 一键部署 ==="
    echo "  full-deploy <repo_name> <project_name> <github_token> <vercel_token>"
    echo "                                                  完整部署流程"
    echo ""
    echo "示例:"
    echo "  $0 create-repo my-project ghp_xxx"
    echo "  $0 create-project my-project user/repo vcp_xxx"
    echo "  $0 setup-supabase my-project vcp_xxx"
    echo "  $0 full-deploy my-project my-project ghp_xxx vcp_xxx"
}

# ==================== GitHub 操作 ====================

# 创建 GitHub 仓库
create_repo() {
    local name=$1
    local token=$2
    local private=${3:-false}
    
    if [[ -z "$name" || -z "$token" ]]; then
        log_error "参数不完整"
        echo "用法: $0 create-repo <name> <github_token> [private]"
        exit 1
    fi
    
    log_step "创建 GitHub 仓库: $name"
    
    local response
    response=$(curl -s -X POST "https://api.github.com/user/repos" \
        -H "Authorization: token $token" \
        -H "Accept: application/vnd.github.v3+json" \
        -d "{
            \"name\": \"$name\",
            \"description\": \"Created via Vercel Deploy Skill\",
            \"private\": $private,
            \"auto_init\": false
        }")
    
    if echo "$response" | grep -q '"full_name"'; then
        local full_name=$(echo "$response" | jq -r '.full_name')
        local html_url=$(echo "$response" | jq -r '.html_url')
        log_info "仓库创建成功: $full_name"
        log_info "访问地址: $html_url"
        echo ""
        echo "推送代码命令:"
        echo "  git remote add origin https://$token@github.com/$full_name.git"
        echo "  git push -u origin main"
    else
        log_error "创建失败: $response"
        exit 1
    fi
}

# 推送代码到仓库
push_code() {
    local repo_url=$1
    local token=$2
    
    if [[ -z "$repo_url" || -z "$token" ]]; then
        log_error "参数不完整"
        echo "用法: $0 push-code <repo_url> <github_token>"
        exit 1
    fi
    
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log_error "当前目录不是 Git 仓库"
        exit 1
    fi
    
    log_step "推送代码到 $repo_url"
    
    # 构建带 token 的 URL
    local auth_url="https://$token@github.com/${repo_url#github.com/}"
    if [[ "$repo_url" == https://* ]]; then
        auth_url="https://$token@${repo_url#https://}"
    fi
    
    git remote remove origin 2>/dev/null || true
    git remote add origin "$auth_url"
    git push -u origin main
    
    log_info "代码推送成功"
}

# 检查仓库是否存在
check_repo() {
    local repo=$1
    local token=$2
    
    if [[ -z "$repo" || -z "$token" ]]; then
        log_error "参数不完整"
        echo "用法: $0 check-repo <user/repo> <github_token>"
        exit 1
    fi
    
    log_info "检查仓库 $repo..."
    
    local response
    response=$(curl -s -w "\n%{http_code}" "https://api.github.com/repos/$repo" \
        -H "Authorization: token $token")
    
    local http_code=$(echo "$response" | tail -1)
    local body=$(echo "$response" | head -n -1)
    
    if [[ "$http_code" == "200" ]]; then
        log_info "仓库存在"
        echo "$body" | jq '{name, private, html_url, updated_at}'
    else
        log_warn "仓库不存在或无权限访问"
        exit 1
    fi
}

# ==================== Vercel 操作 ====================

# 创建 Vercel 项目
create_project() {
    local name=$1
    local github_repo=$2
    local token=$3
    
    if [[ -z "$name" || -z "$github_repo" || -z "$token" ]]; then
        log_error "参数不完整"
        echo "用法: $0 create-project <name> <github_repo> <token>"
        echo "示例: $0 create-project my-project user/repo vcp_xxx"
        exit 1
    fi
    
    log_step "创建 Vercel 项目: $name"
    log_info "关联 GitHub 仓库: $github_repo"
    
    local response
    response=$(curl -s -X POST "https://api.vercel.com/v11/projects" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"$name\",
            \"gitRepository\": {
                \"type\": \"github\",
                \"repo\": \"$github_repo\"
            },
            \"framework\": \"nextjs\"
        }")
    
    if echo "$response" | grep -q '"id"'; then
        local project_id=$(echo "$response" | jq -r '.id')
        local link=$(echo "$response" | jq -r '.link.repo // "N/A"')
        log_info "项目创建成功"
        echo "项目 ID: $project_id"
        echo "关联仓库: $link"
        echo ""
        echo "访问地址: https://$name.vercel.app"
    else
        log_error "创建失败: $response"
        exit 1
    fi
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
        -H "Authorization: Bearer $token" | jq '{
            name,
            id,
            framework,
            link: .link.repo,
            env_count: (.env | length),
            created: .createdAt
        }'
}

# 列出所有项目
list_projects() {
    local token=$1
    
    if [[ -z "$token" ]]; then
        log_error "参数不完整"
        echo "用法: $0 list-projects <token>"
        exit 1
    fi
    
    log_info "列出所有 Vercel 项目..."
    
    curl -s "https://api.vercel.com/v9/projects?limit=100" \
        -H "Authorization: Bearer $token" | jq '.projects[] | {
            name,
            framework,
            link: .link.repo,
            updated: .updatedAt
        }'
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
        -H "Authorization: Bearer $token" | jq '.deployments[] | {
            uid,
            url,
            state,
            created: .createdAt
        }'
}

# 删除项目
delete_project() {
    local project=$1
    local token=$2
    
    if [[ -z "$project" || -z "$token" ]]; then
        log_error "参数不完整"
        echo "用法: $0 delete-project <project> <token>"
        exit 1
    fi
    
    log_warn "即将删除项目: $project"
    read -p "确认删除? (y/N): " confirm
    
    if [[ "$confirm" == "y" || "$confirm" == "Y" ]]; then
        curl -X DELETE "https://api.vercel.com/v9/projects/$project" \
            -H "Authorization: Bearer $token"
        log_info "项目已删除"
    else
        log_info "已取消"
    fi
}

# ==================== Supabase 操作 ====================

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
        log_error "未找到 Supabase 凭证"
        echo "请确保在沙箱环境中运行，或手动设置:"
        echo "  export COZE_SUPABASE_URL=your_url"
        echo "  export COZE_SUPABASE_ANON_KEY=your_key"
        exit 1
    fi
    
    log_step "配置 Supabase 环境变量..."
    
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

# ==================== 一键部署 ====================

# 完整部署流程
full_deploy() {
    local repo_name=$1
    local project_name=$2
    local github_token=$3
    local vercel_token=$4
    
    if [[ -z "$repo_name" || -z "$project_name" || -z "$github_token" || -z "$vercel_token" ]]; then
        log_error "参数不完整"
        echo "用法: $0 full-deploy <repo_name> <project_name> <github_token> <vercel_token>"
        exit 1
    fi
    
    log_step "开始完整部署流程..."
    
    # 1. 创建 GitHub 仓库
    create_repo "$repo_name" "$github_token" "false"
    
    # 2. 推送代码
    local github_user=$(curl -s "https://api.github.com/user" \
        -H "Authorization: token $github_token" | jq -r '.login')
    
    push_code "$github_user/$repo_name" "$github_token"
    
    # 3. 创建 Vercel 项目
    create_project "$project_name" "$github_user/$repo_name" "$vercel_token"
    
    # 4. 配置 Supabase
    setup_supabase "$project_name" "$vercel_token"
    
    # 5. 触发部署
    log_step "触发部署..."
    git commit --allow-empty -m "chore: initial deploy" 2>/dev/null || true
    git push
    
    log_info "========================================="
    log_info "部署完成！"
    log_info "访问地址: https://$project_name.vercel.app"
    log_info "========================================="
}

# ==================== 主命令 ====================

case "$1" in
    # GitHub
    create-repo)
        create_repo "$2" "$3" "$4"
        ;;
    push-code)
        push_code "$2" "$3"
        ;;
    check-repo)
        check_repo "$2" "$3"
        ;;
    # Vercel
    create-project)
        create_project "$2" "$3" "$4"
        ;;
    set-env)
        set_env "$2" "$3" "$4" "$5"
        ;;
    get-project)
        get_project "$2" "$3"
        ;;
    list-projects)
        list_projects "$2"
        ;;
    list-deployments)
        list_deployments "$2" "$3"
        ;;
    delete-project)
        delete_project "$2" "$3"
        ;;
    # Supabase
    setup-supabase)
        setup_supabase "$2" "$3"
        ;;
    get-supabase-creds)
        get_supabase_creds
        ;;
    # 一键部署
    full-deploy)
        full_deploy "$2" "$3" "$4" "$5"
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
