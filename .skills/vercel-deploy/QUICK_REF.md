# Vercel 部署快速参考

## 一、Token 获取

### GitHub Token
```
https://github.com/settings/tokens
→ Generate new token (classic)
→ 勾选 repo 权限
→ 复制 token (ghp_xxx)
```

### Vercel Token
```
https://vercel.com/account/tokens
→ Create Token
→ Scope: Full Account
→ 复制 token (vcp_xxx)
```

---

## 二、GitHub 操作

### 创建仓库
```bash
curl -X POST "https://api.github.com/user/repos" \
  -H "Authorization: token GITHUB_TOKEN" \
  -d '{"name":"REPO_NAME","private":false}'

# 或使用脚本
./scripts/vercel-helper.sh create-repo REPO_NAME GITHUB_TOKEN
```

### 推送代码
```bash
git remote add origin https://TOKEN@github.com/USER/REPO.git
git push -u origin main

# 或使用脚本
./scripts/vercel-helper.sh push-code USER/REPO GITHUB_TOKEN
```

### 检查仓库
```bash
curl -s "https://api.github.com/repos/USER/REPO" \
  -H "Authorization: token GITHUB_TOKEN" | jq '.name,.html_url'

# 或使用脚本
./scripts/vercel-helper.sh check-repo USER/REPO GITHUB_TOKEN
```

---

## 三、Vercel 操作

### 创建项目
```bash
curl -X POST "https://api.vercel.com/v11/projects" \
  -H "Authorization: Bearer VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "PROJECT_NAME",
    "gitRepository": {
      "type": "github",
      "repo": "USER/REPO"
    }
  }'

# 或使用脚本
./scripts/vercel-helper.sh create-project PROJECT_NAME USER/REPO VERCEL_TOKEN
```

### 设置环境变量
```bash
curl -X POST "https://api.vercel.com/v10/projects/PROJECT_NAME/env" \
  -H "Authorization: Bearer VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"KEY","value":"VALUE","type":"plain","target":["production","preview","development"]}'

# 或使用脚本
./scripts/vercel-helper.sh set-env PROJECT_NAME KEY VALUE VERCEL_TOKEN
```

### 查看项目
```bash
curl -s "https://api.vercel.com/v9/projects/PROJECT_NAME" \
  -H "Authorization: Bearer VERCEL_TOKEN" | jq '.'

# 或使用脚本
./scripts/vercel-helper.sh get-project PROJECT_NAME VERCEL_TOKEN
```

---

## 四、Supabase 配置

### 获取沙箱凭证
```bash
echo $COZE_SUPABASE_URL
echo $COZE_SUPABASE_ANON_KEY

# 或使用脚本
./scripts/vercel-helper.sh get-supabase-creds
```

### 配置到 Vercel
```bash
# 一键配置
./scripts/vercel-helper.sh setup-supabase PROJECT_NAME VERCEL_TOKEN
```

---

## 五、触发部署

```bash
# 方式1：推送代码（推荐）
git commit --allow-empty -m "deploy" && git push

# 方式2：API 触发
curl -X POST "https://api.vercel.com/v13/deployments" \
  -H "Authorization: Bearer VERCEL_TOKEN" \
  -d '{"projectId":"PROJECT_ID"}'
```

---

## 六、一键部署

```bash
# 完整流程：创建仓库 → 推送代码 → 创建项目 → 配置数据库 → 部署
./scripts/vercel-helper.sh full-deploy REPO_NAME PROJECT_NAME GITHUB_TOKEN VERCEL_TOKEN
```

---

## 七、常用 URL

| 用途 | URL |
|------|-----|
| GitHub Token | https://github.com/settings/tokens |
| GitHub API 文档 | https://docs.github.com/en/rest |
| Vercel Dashboard | https://vercel.com/ |
| Vercel Token | https://vercel.com/account/tokens |
| Vercel API 文档 | https://vercel.com/docs/rest-api |
| Vercel GitHub 集成 | https://vercel.com/account/integrations |
| Supabase Dashboard | https://supabase.com/dashboard |

---

## 八、故障排查

| 问题 | 解决方案 |
|------|---------|
| GitHub push 失败 | 确保 Token 有 `repo` 权限 |
| Vercel 创建失败 | 检查 GitHub App 是否已安装 |
| 部署后 500 错误 | 检查环境变量 + 函数日志 |
| 数据库连接失败 | 运行 `setup-supabase` 配置 |
| API 超时 | 优化代码或使用流式响应 |

---

## 九、脚本命令速查

```bash
# GitHub
./scripts/vercel-helper.sh create-repo <name> <token> [private]
./scripts/vercel-helper.sh push-code <repo> <token>
./scripts/vercel-helper.sh check-repo <user/repo> <token>

# Vercel
./scripts/vercel-helper.sh create-project <name> <github_repo> <token>
./scripts/vercel-helper.sh set-env <project> <key> <value> <token>
./scripts/vercel-helper.sh get-project <project> <token>
./scripts/vercel-helper.sh list-projects <token>
./scripts/vercel-helper.sh delete-project <project> <token>

# Supabase
./scripts/vercel-helper.sh setup-supabase <project> <token>
./scripts/vercel-helper.sh get-supabase-creds

# 一键部署
./scripts/vercel-helper.sh full-deploy <repo> <project> <github_token> <vercel_token>
```
