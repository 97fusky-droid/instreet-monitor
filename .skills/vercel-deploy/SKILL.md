# Vercel 部署技能

将 Next.js/前端项目部署到 Vercel 平台，包括环境变量配置、数据库连接、自动部署设置。

## 适用场景

- 部署 Next.js 项目到 Vercel
- 配置 Supabase 数据库连接
- 管理 Vercel 环境变量
- 设置 GitHub 自动部署

## 前置条件

1. GitHub 仓库已创建
2. Vercel 账号已注册
3. 项目代码已推送到 GitHub

## 快速开始

### 1. 创建 Vercel 项目

```bash
# 方式一：通过 CLI（需要 token）
vercel --token YOUR_TOKEN

# 方式二：通过网页
# 访问 https://vercel.com/new
# 选择 GitHub 仓库导入
```

### 2. 配置环境变量

```bash
# 使用脚本配置（推荐）
./scripts/vercel-helper.sh set-env PROJECT_NAME ENV_KEY ENV_VALUE TOKEN

# 或通过 API
curl -X POST "https://api.vercel.com/v10/projects/PROJECT_NAME/env" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "ENV_KEY",
    "value": "ENV_VALUE",
    "type": "plain",
    "target": ["production", "preview", "development"]
  }'
```

### 3. 触发部署

```bash
# 方式一：推送代码触发
git commit --allow-empty -m "chore: trigger redeploy" && git push

# 方式二：通过 API 重新部署最新版本
curl -X POST "https://api.vercel.com/v13/deployments" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "PROJECT_NAME", "gitSource": {"ref": "main"}}'
```

## Supabase 数据库配置

### 获取 Supabase 凭证

沙箱环境变量中已预置：
- `COZE_SUPABASE_URL` - Supabase 项目 URL
- `COZE_SUPABASE_ANON_KEY` - Supabase 匿名密钥

```bash
# 在沙箱中获取
echo "URL: $COZE_SUPABASE_URL"
echo "KEY: $COZE_SUPABASE_ANON_KEY"
```

### 配置到 Vercel

```bash
# 添加数据库 URL
./scripts/vercel-helper.sh set-env PROJECT_NAME COZE_SUPABASE_URL "$COZE_SUPABASE_URL" TOKEN

# 添加数据库密钥
./scripts/vercel-helper.sh set-env PROJECT_NAME COZE_SUPABASE_ANON_KEY "$COZE_SUPABASE_ANON_KEY" TOKEN
```

### 代码中使用

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.COZE_SUPABASE_URL!,
  process.env.COZE_SUPABASE_ANON_KEY!
);
```

## Vercel Token 获取

1. 访问 https://vercel.com/account/tokens
2. 点击 **Create Token**
3. 设置名称和权限（建议 Full Account）
4. 复制生成的 Token

## 常用操作

### 查看项目信息

```bash
curl -s "https://api.vercel.com/v9/projects/PROJECT_NAME" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 查看部署列表

```bash
curl -s "https://api.vercel.com/v6/deployments?projectId=PROJECT_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 删除环境变量

```bash
curl -X DELETE "https://api.vercel.com/v9/projects/PROJECT_NAME/env/ENV_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 查看 Vercel 日志

```bash
# 访问 Vercel Dashboard
# 项目 → Deployments → 点击部署 → Functions 日志
```

## 项目配置文件

### next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // 输出配置
  output: 'standalone',
  
  // 环境变量
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  
  // 忽略 TypeScript 错误（不推荐）
  typescript: {
    ignoreBuildErrors: false,
  },
};

module.exports = nextConfig;
```

### package.json 脚本

```json
{
  "scripts": {
    "dev": "next dev --port 5000",
    "build": "next build",
    "start": "next start --port 5000"
  }
}
```

## 常见问题

### 1. 部署后 500 错误

**原因**：环境变量未配置或代码有错误

**解决**：
1. 检查 Vercel 函数日志
2. 确认环境变量已正确设置
3. 检查代码中的硬编码值

### 2. 数据库连接失败

**原因**：Supabase 环境变量未配置

**解决**：
```bash
# 添加环境变量
./scripts/vercel-helper.sh set-env PROJECT_NAME COZE_SUPABASE_URL "YOUR_URL" TOKEN
./scripts/vercel-helper.sh set-env PROJECT_NAME COZE_SUPABASE_ANON_KEY "YOUR_KEY" TOKEN

# 重新部署
git commit --allow-empty -m "chore: trigger redeploy" && git push
```

### 3. API 超时

**原因**：Vercel 免费版 API 超时限制 10 秒

**解决**：
1. 优化 API 响应速度
2. 使用流式响应
3. 考虑升级 Vercel 计划

### 4. 构建失败

**原因**：依赖或配置问题

**解决**：
1. 检查构建日志
2. 确保 `package.json` 正确
3. 检查 TypeScript 错误

## 完整部署流程

```bash
# 1. 初始化项目
coze init /workspace/projects --template nextjs

# 2. 开发并测试
cd /workspace/projects
pnpm install
pnpm dev

# 3. 推送到 GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/USER/REPO.git
git push -u origin main

# 4. 在 Vercel 导入项目
# 访问 https://vercel.com/new

# 5. 配置环境变量
./scripts/vercel-helper.sh set-env PROJECT_NAME COZE_SUPABASE_URL "$COZE_SUPABASE_URL" TOKEN
./scripts/vercel-helper.sh set-env PROJECT_NAME COZE_SUPABASE_ANON_KEY "$COZE_SUPABASE_ANON_KEY" TOKEN

# 6. 触发部署
git commit --allow-empty -m "chore: deploy" && git push

# 7. 验证部署
curl -s https://YOUR-PROJECT.vercel.app/api/health
```

## 相关链接

- Vercel Dashboard: https://vercel.com/
- Vercel API 文档: https://vercel.com/docs/rest-api
- Supabase Dashboard: https://supabase.com/dashboard
- GitHub Token: https://github.com/settings/tokens
