# Vercel 部署技能

将 Next.js/前端项目部署到 Vercel 平台，包括 GitHub 仓库创建、Vercel 项目创建、环境变量配置、数据库连接、自动部署设置。

## 适用场景

- 部署 Next.js 项目到 Vercel
- 创建 GitHub 仓库并推送代码
- 配置 Supabase 数据库连接
- 管理 Vercel 环境变量
- 设置 GitHub 自动部署

---

## 第一部分：GitHub 配置

### 1. 获取 GitHub Token

```
1. 访问 https://github.com/settings/tokens
2. 点击 "Generate new token" → "Generate new token (classic)"
3. 设置：
   - Note: "vercel-deploy"
   - Expiration: No expiration（永不过期）
   - Scopes: 勾选 repo（完整仓库权限）
4. 点击 "Generate token"
5. 复制 token（ghp_xxx 格式）
```

### 2. 配置 Git 凭证

```bash
# 方式一：缓存凭证
git config --global credential.helper store

# 方式二：使用 token 作为密码
git remote set-url origin https://TOKEN@github.com/USER/REPO.git
```

### 3. 创建 GitHub 仓库（API 方式）

```bash
# 创建公开仓库
curl -X POST "https://api.github.com/user/repos" \
  -H "Authorization: token YOUR_GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  -d '{
    "name": "REPO_NAME",
    "description": "项目描述",
    "private": false,
    "auto_init": false
  }'

# 创建私有仓库
curl -X POST "https://api.github.com/user/repos" \
  -H "Authorization: token YOUR_GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  -d '{
    "name": "REPO_NAME",
    "private": true
  }'
```

### 4. 推送代码到 GitHub

```bash
# 初始化 Git（如果还没有）
git init
git add .
git commit -m "Initial commit"

# 添加远程仓库
git remote add origin https://github.com/USER/REPO.git

# 或使用 token
git remote add origin https://TOKEN@github.com/USER/REPO.git

# 推送
git branch -M main
git push -u origin main
```

### 5. 验证仓库创建成功

```bash
curl -s "https://api.github.com/repos/USER/REPO" \
  -H "Authorization: token YOUR_GITHUB_TOKEN" | jq '.name,.html_url'
```

---

## 第二部分：Vercel 配置

### 1. 获取 Vercel Token

```
1. 访问 https://vercel.com/account/tokens
2. 点击 "Create Token"
3. 设置：
   - Name: "deploy-token"
   - Scope: Full Account（完整权限）
   - Expiration: No Expiration（永不过期）
4. 点击 "Create"
5. 复制 token（vcp_xxx 格式）
```

### 2. 创建 Vercel 项目（API 方式）

```bash
# 从 GitHub 导入项目
curl -X POST "https://api.vercel.com/v11/projects" \
  -H "Authorization: Bearer YOUR_VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "PROJECT_NAME",
    "gitRepository": {
      "type": "github",
      "repo": "GITHUB_USER/REPO_NAME"
    },
    "framework": "nextjs"
  }'
```

**重要参数说明**：
- `name`: Vercel 项目名称（也是域名前缀）
- `gitRepository.type`: 固定为 "github"
- `gitRepository.repo`: GitHub 仓库路径（用户名/仓库名）
- `framework`: 框架类型，如 "nextjs", "vite", "create-react-app" 等

### 3. 验证项目创建成功

```bash
curl -s "https://api.vercel.com/v9/projects/PROJECT_NAME" \
  -H "Authorization: Bearer YOUR_VERCEL_TOKEN" | jq '.name,.link'
```

### 4. 触发首次部署

```bash
# 方式一：推送新代码触发
git commit --allow-empty -m "trigger deploy" && git push

# 方式二：API 触发（需要项目 ID）
curl -X POST "https://api.vercel.com/v13/deployments" \
  -H "Authorization: Bearer YOUR_VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "PROJECT_ID",
    "gitSource": {
      "type": "github",
      "ref": "main"
    }
  }'
```

---

## 第三部分：GitHub 与 Vercel 连接

### 连接原理

当通过 API 创建 Vercel 项目并指定 GitHub 仓库时，Vercel 会自动：
1. 在你的 Vercel 账号中安装 GitHub App
2. 为该仓库配置 webhook
3. 每次 push 到 main 分支自动触发部署

### 检查连接状态

```bash
# 查看项目的 Git 集成信息
curl -s "https://api.vercel.com/v9/projects/PROJECT_NAME" \
  -H "Authorization: Bearer YOUR_VERCEL_TOKEN" | jq '.link'
```

### 手动连接（如果自动失败）

1. 访问 https://vercel.com/account/integrations
2. 找到 GitHub 集成，点击 Configure
3. 确保目标仓库已被授权
4. 在 Vercel Dashboard 中手动导入项目

---

## 第四部分：环境变量配置

### 1. 添加环境变量

```bash
# 使用辅助脚本（推荐）
./scripts/vercel-helper.sh set-env PROJECT_NAME ENV_KEY ENV_VALUE VERCEL_TOKEN

# 或直接 API
curl -X POST "https://api.vercel.com/v10/projects/PROJECT_NAME/env" \
  -H "Authorization: Bearer YOUR_VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "ENV_KEY",
    "value": "ENV_VALUE",
    "type": "plain",
    "target": ["production", "preview", "development"]
  }'
```

### 2. 查看环境变量

```bash
curl -s "https://api.vercel.com/v9/projects/PROJECT_NAME" \
  -H "Authorization: Bearer YOUR_VERCEL_TOKEN" | jq '.env[]'
```

### 3. 删除环境变量

```bash
curl -X DELETE "https://api.vercel.com/v9/projects/PROJECT_NAME/env/ENV_ID" \
  -H "Authorization: Bearer YOUR_VERCEL_TOKEN"
```

---

## 第五部分：Supabase 数据库配置

### 1. 获取 Supabase 凭证（沙箱预置）

```bash
# 查看沙箱中的凭证
echo "URL: $COZE_SUPABASE_URL"
echo "KEY: $COZE_SUPABASE_ANON_KEY"

# 或使用辅助脚本
./scripts/vercel-helper.sh get-supabase-creds
```

### 2. 配置到 Vercel

```bash
# 一键配置（推荐）
./scripts/vercel-helper.sh setup-supabase PROJECT_NAME VERCEL_TOKEN

# 或手动配置
curl -X POST "https://api.vercel.com/v10/projects/PROJECT_NAME/env" \
  -H "Authorization: Bearer VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"COZE_SUPABASE_URL","value":"YOUR_URL","type":"plain","target":["production","preview","development"]}'

curl -X POST "https://api.vercel.com/v10/projects/PROJECT_NAME/env" \
  -H "Authorization: Bearer VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"COZE_SUPABASE_ANON_KEY","value":"YOUR_KEY","type":"plain","target":["production","preview","development"]}'
```

### 3. 代码中使用

```typescript
import { createClient } from '@supabase/supabase-js';

// 检查环境变量是否存在
if (!process.env.COZE_SUPABASE_URL || !process.env.COZE_SUPABASE_ANON_KEY) {
  console.warn('Supabase 未配置，使用无数据库模式');
}

const supabase = process.env.COZE_SUPABASE_URL 
  ? createClient(
      process.env.COZE_SUPABASE_URL,
      process.env.COZE_SUPABASE_ANON_KEY!
    )
  : null;
```

---

## 第六部分：完整部署流程

### 一键部署脚本示例

```bash
#!/bin/bash
# 完整部署流程

# 配置变量
GITHUB_TOKEN="ghp_xxx"
VERCEL_TOKEN="vcp_xxx"
REPO_NAME="my-project"
PROJECT_NAME="my-project"

# 1. 创建 GitHub 仓库
echo "创建 GitHub 仓库..."
curl -X POST "https://api.github.com/user/repos" \
  -H "Authorization: token $GITHUB_TOKEN" \
  -d "{\"name\":\"$REPO_NAME\",\"private\":false}"

# 2. 推送代码
echo "推送代码..."
git remote add origin "https://$GITHUB_TOKEN@github.com/USER/$REPO_NAME.git"
git push -u origin main

# 3. 创建 Vercel 项目
echo "创建 Vercel 项目..."
curl -X POST "https://api.vercel.com/v11/projects" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -d "{\"name\":\"$PROJECT_NAME\",\"gitRepository\":{\"type\":\"github\",\"repo\":\"USER/$REPO_NAME\"}}"

# 4. 配置 Supabase
echo "配置数据库..."
./scripts/vercel-helper.sh setup-supabase $PROJECT_NAME $VERCEL_TOKEN

# 5. 触发部署
echo "触发部署..."
git commit --allow-empty -m "deploy" && git push

echo "部署完成！"
echo "访问: https://$PROJECT_NAME.vercel.app"
```

---

## 第七部分：常用操作

### 查看 Vercel 项目列表

```bash
curl -s "https://api.vercel.com/v9/projects" \
  -H "Authorization: Bearer YOUR_VERCEL_TOKEN" | jq '.projects[] | {name, link}'
```

### 查看部署历史

```bash
curl -s "https://api.vercel.com/v6/deployments?projectId=PROJECT_NAME" \
  -H "Authorization: Bearer YOUR_VERCEL_TOKEN" | jq '.deployments[] | {uid,url,state}'
```

### 查看部署日志

```bash
# 通过 Dashboard
https://vercel.com/TEAM/PROJECT/deployments

# 通过 API（需要部署 ID）
curl -s "https://api.vercel.com/v13/deployments/DEPLOYMENT_ID/events" \
  -H "Authorization: Bearer YOUR_VERCEL_TOKEN"
```

### 删除项目

```bash
curl -X DELETE "https://api.vercel.com/v9/projects/PROJECT_NAME" \
  -H "Authorization: Bearer YOUR_VERCEL_TOKEN"
```

---

## 第八部分：故障排查

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| GitHub push 失败 | Token 权限不足 | 确保 Token 有 `repo` 权限 |
| Vercel 创建失败 | 未安装 GitHub App | 访问 Vercel Dashboard 手动导入一次 |
| 部署后 500 错误 | 环境变量缺失 | 检查并添加必要的环境变量 |
| 数据库连接失败 | Supabase 未配置 | 运行 `setup-supabase` 命令 |
| API 超时 | Vercel 免费版限制 | 优化代码或使用流式响应 |
| 构建失败 | 依赖/配置问题 | 检查构建日志和 TypeScript 错误 |

---

## 相关链接

| 平台 | URL |
|------|-----|
| GitHub Token | https://github.com/settings/tokens |
| GitHub API 文档 | https://docs.github.com/en/rest |
| Vercel Dashboard | https://vercel.com/ |
| Vercel Token | https://vercel.com/account/tokens |
| Vercel API 文档 | https://vercel.com/docs/rest-api |
| Supabase Dashboard | https://supabase.com/dashboard |
