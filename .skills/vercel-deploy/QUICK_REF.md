# Vercel 部署快速参考

## 一、获取 Vercel Token

```
https://vercel.com/account/tokens
→ Create Token
→ 复制 token (vcp_xxx)
```

## 二、配置环境变量

```bash
# 使用脚本
./scripts/vercel-helper.sh set-env PROJECT_NAME KEY VALUE TOKEN

# 或直接 API
curl -X POST "https://api.vercel.com/v10/projects/PROJECT_NAME/env" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"KEY","value":"VALUE","type":"plain","target":["production","preview","development"]}'
```

## 三、Supabase 数据库配置

```bash
# 获取沙箱凭证
echo $COZE_SUPABASE_URL
echo $COZE_SUPABASE_ANON_KEY

# 配置到 Vercel
./scripts/vercel-helper.sh setup-supabase PROJECT_NAME TOKEN
```

## 四、触发部署

```bash
# 方式1：推送代码（推荐）
git commit --allow-empty -m "deploy" && git push

# 方式2：API 触发
curl -X POST "https://api.vercel.com/v13/deployments" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"PROJECT_NAME","gitSource":{"ref":"main"}}'
```

## 五、查看状态

```bash
# 项目信息
curl -s "https://api.vercel.com/v9/projects/PROJECT_NAME" \
  -H "Authorization: Bearer TOKEN" | jq '.name,.env'

# 部署列表
curl -s "https://api.vercel.com/v6/deployments?projectId=PROJECT_NAME" \
  -H "Authorization: Bearer TOKEN" | jq '.deployments[0]'
```

## 六、常用 URL

| 用途 | URL |
|------|-----|
| Token 管理 | https://vercel.com/account/tokens |
| 项目列表 | https://vercel.com/dashboard |
| 部署日志 | https://vercel.com/TEAM/PROJECT/deployments |
| 环境变量 | https://vercel.com/TEAM/PROJECT/settings/environment-variables |
| API 文档 | https://vercel.com/docs/rest-api |

## 七、故障排查

| 问题 | 解决方案 |
|------|---------|
| 500 错误 | 检查函数日志 + 环境变量 |
| 数据库连接失败 | 确认 COZE_SUPABASE_* 已配置 |
| API 超时 | 优化代码或使用流式响应 |
| 构建失败 | 检查构建日志 + TypeScript 错误 |
