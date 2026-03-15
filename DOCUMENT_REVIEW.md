# InStreet 论坛监控系统 - 文档评审报告

## 评审概述

**评审对象**：PROJECT_GOALS.md + DEVELOPMENT_GUIDE.md  
**评审时间**：2026-03-15  
**评审版本**：v1.0

---

## 一、总体评价

### 1.1 优点

✅ **文档结构完整**
- 包含目标、方案、实施细节
- 从架构到部署全覆盖
- 有清晰的层次结构

✅ **技术选型合理**
- 基于现有项目技术栈
- 无需额外引入复杂依赖
- 符合最佳实践

✅ **实施计划具体**
- 每个阶段有明确任务
- 有预估时间
- 有验收标准

### 1.2 不足

⚠️ **关键信息缺失**
- 未确认InStreet是否有API
- 数据采集方式未最终确定
- 实际HTML结构未知

⚠️ **风险考虑不足**
- 未充分考虑法律合规问题
- 缺少数据隐私保护方案
- 未考虑源站反爬措施

⚠️ **实施难度低估**
- 数据解析可能比预期复杂
- 增量采集策略需要验证
- 定时任务稳定性存疑

---

## 二、具体问题与建议

### 2.1 高优先级问题

#### 问题1：数据采集可行性未验证

**现状**：
- 文档假设可以使用fetch-url获取数据
- 未验证InStreet是否有公开API
- 未分析实际的HTML结构

**风险**：
- 网站可能使用JavaScript动态渲染，fetch-url无法获取完整内容
- 网站可能有反爬机制
- 数据结构可能与预期不符

**建议**：
```
【必须】在正式开发前，先完成以下验证：

1. 使用Chrome DevTools分析InStreet网站
   - 查看Network请求，确认是否有API
   - 查看HTML结构，确认数据是否在DOM中
   
2. 测试fetch-url能否获取完整内容
   - 创建测试API: /api/test-fetch
   - 实际调用fetch-url获取首页
   - 检查返回内容是否包含帖子数据
   
3. 确认数据获取方式
   - 方案A：如有API → 直接调用API
   - 方案B：如在DOM中 → 解析HTML
   - 方案C：如需JS渲染 → 考虑使用Puppeteer（需额外配置）
```

#### 问题2：数据库设计缺少关联约束

**现状**：
- comments表有外键约束
- 但未考虑级联删除的性能影响
- 缺少数据完整性校验

**建议**：
```sql
-- 调整comments表外键策略
-- 原设计：ON DELETE CASCADE（可能影响性能）
-- 建议：ON DELETE SET NULL + 定期清理

ALTER TABLE comments 
DROP CONSTRAINT comments_post_id_fkey,
ADD CONSTRAINT comments_post_id_fkey 
  FOREIGN KEY (post_id) 
  REFERENCES posts(id) 
  ON DELETE SET NULL;

-- 添加数据校验约束
ALTER TABLE posts
ADD CONSTRAINT chk_likes_count CHECK (likes_count >= 0),
ADD CONSTRAINT chk_comments_count CHECK (comments_count >= 0);
```

#### 问题3：缺少错误恢复机制

**现状**：
- 采集失败只记录日志
- 无自动重试机制
- 无数据修复方案

**建议**：
```typescript
// 添加重试机制
interface RetryConfig {
  maxRetries: number;
  backoffMs: number;
  exponentialBackoff: boolean;
}

async function crawlWithRetry(
  crawler: InStreetCrawler,
  config: RetryConfig = {
    maxRetries: 3,
    backoffMs: 1000,
    exponentialBackoff: true
  }
): Promise<CrawlResult> {
  let lastError: Error;
  
  for (let i = 0; i < config.maxRetries; i++) {
    try {
      return await crawler.crawlPosts();
    } catch (error) {
      lastError = error;
      const delay = config.exponentialBackoff 
        ? config.backoffMs * Math.pow(2, i)
        : config.backoffMs;
      await sleep(delay);
    }
  }
  
  // 所有重试失败后，发送告警
  await sendAlert('Crawl failed after all retries', lastError);
  throw lastError;
}
```

### 2.2 中优先级问题

#### 问题4：缺少数据限流和存储策略

**现状**：
- 未设置数据保留策略
- 可能无限增长
- 无数据归档机制

**建议**：
```sql
-- 添加数据保留策略表
CREATE TABLE data_retention_policies (
  id SERIAL PRIMARY KEY,
  data_type VARCHAR(50) NOT NULL,        -- posts/comments/snapshots
  retention_days INTEGER NOT NULL,       -- 保留天数
  archive_enabled BOOLEAN DEFAULT false, -- 是否归档
  created_at TIMESTAMP DEFAULT NOW()
);

-- 插入默认策略
INSERT INTO data_retention_policies (data_type, retention_days, archive_enabled) VALUES
('posts', 365, true),      -- 帖子保留1年，归档
('comments', 180, false),  -- 评论保留6个月，不归档
('snapshots', 90, false);  -- 快照保留3个月，不归档

-- 定时清理任务
CREATE OR REPLACE FUNCTION cleanup_old_data() RETURNS void AS $$
BEGIN
  -- 清理过期评论
  DELETE FROM comments 
  WHERE created_at < NOW() - INTERVAL '180 days';
  
  -- 归档过期帖子（移到归档表）
  INSERT INTO posts_archive 
  SELECT * FROM posts 
  WHERE created_at < NOW() - INTERVAL '365 days';
  
  DELETE FROM posts 
  WHERE created_at < NOW() - INTERVAL '365 days';
END;
$$ LANGUAGE plpgsql;
```

#### 问题5：API缺少访问控制

**现状**：
- 所有API都是公开的
- 无速率限制
- 无认证机制

**建议**：
```typescript
// 添加API速率限制中间件
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 最多100次请求
  message: { error: 'Too many requests' }
});

// 应用到所有API路由
export const config = {
  api: {
    externalResolver: true,
  },
};

// 或使用Vercel的Edge Functions限制
export const runtime = 'edge';
```

#### 问题6：缺少监控指标

**现状**：
- 只有健康检查
- 无详细的性能指标
- 无用户行为追踪

**建议**：
```typescript
// 添加性能指标采集
import { collectMetrics } from '@/lib/metrics';

// 在API中添加指标
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const data = await getOverviewData();
    
    // 记录成功指标
    collectMetrics({
      api: '/api/stats/overview',
      duration: Date.now() - startTime,
      status: 'success',
    });
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    // 记录失败指标
    collectMetrics({
      api: '/api/stats/overview',
      duration: Date.now() - startTime,
      status: 'error',
      error: error.message,
    });
    
    throw error;
  }
}

// 存储指标到数据库或发送到监控服务
```

### 2.3 低优先级问题

#### 问题7：文档中的占位符

**现状**：
- 解析规则中有"待确认"标记
- 选择器是示例而非实际值

**建议**：
```
在完成问题1的验证后，更新文档中的实际值：
- containerSelector: '实际的选择器'
- 字段映射: '实际的提取规则'
```

#### 问题8：缺少国际化考虑

**现状**：
- 界面固定中文
- 未考虑多语言支持

**建议**：
```
如未来需要国际化，可以：
1. 使用next-intl或i18next
2. 将文案提取到语言文件
3. 支持动态语言切换
```

---

## 三、合规性审查

### 3.1 数据采集合规

⚠️ **潜在风险**：
- 采集他人数据可能涉及著作权
- 频繁请求可能被视为DDoS攻击
- 未查看网站robots.txt

**建议**：
```
1. 检查InStreet的robots.txt
   - 访问 https://instreet.coze.site/robots.txt
   - 确认哪些页面允许爬取

2. 控制采集频率
   - 不低于每小时一次
   - 避开高峰时段

3. 添加User-Agent标识
   - 标明监控目的
   - 提供联系方式

4. 如有条件，联系网站管理员获取授权
```

### 3.2 数据隐私保护

⚠️ **潜在风险**：
- 用户数据可能包含个人信息
- 未对敏感数据进行脱敏

**建议**：
```
1. 数据脱敏处理
   - 不存储用户的真实姓名（如有）
   - 不存储联系方式
   - 仅保留必要的公开信息

2. 数据加密存储
   - 敏感字段加密
   - 使用Supabase的加密功能

3. 添加隐私声明
   - 在界面说明数据来源
   - 说明数据用途
```

---

## 四、实施建议优先级

### P0 - 必须完成（阻塞开发）

| 序号 | 任务 | 预计时间 | 负责人 |
|------|------|----------|--------|
| 1 | 验证数据采集可行性 | 2小时 | 开发 |
| 2 | 确认InStreet页面结构 | 2小时 | 开发 |
| 3 | 测试fetch-url效果 | 1小时 | 开发 |

### P1 - 应该完成（影响质量）

| 序号 | 任务 | 预计时间 | 负责人 |
|------|------|----------|--------|
| 4 | 添加错误重试机制 | 2小时 | 开发 |
| 5 | 配置数据库约束 | 1小时 | 开发 |
| 6 | 添加速率限制 | 1小时 | 开发 |

### P2 - 建议完成（提升体验）

| 序号 | 任务 | 预计时间 | 负责人 |
|------|------|----------|--------|
| 7 | 添加数据保留策略 | 2小时 | 开发 |
| 8 | 添加性能监控 | 2小时 | 开发 |
| 9 | 完善错误日志 | 1小时 | 开发 |

---

## 五、文档改进建议

### 5.1 需要补充的内容

1. **验证报告章节**
   - 添加数据采集验证结果
   - 记录实际的HTML结构
   - 确认最终的采集方式

2. **合规声明章节**
   - 添加robots.txt内容
   - 说明数据使用范围
   - 添加免责声明

3. **故障处理手册**
   - 常见错误及解决方案
   - 数据修复流程
   - 紧急联系机制

### 5.2 需要更新的内容

1. **解析规则**
   - 将"待确认"替换为实际值
   - 添加实际的选择器示例

2. **时间预估**
   - 根据实际验证结果调整
   - 添加缓冲时间

3. **风险评估**
   - 更新已确认的风险
   - 删除不存在的风险

---

## 六、评审结论

### 6.1 是否可以开始开发？

**结论**：❌ 需要先完成P0任务

**原因**：
1. 数据采集可行性未验证，可能存在重大技术风险
2. InStreet的实际数据结构未知，无法设计解析规则
3. 一旦开始开发，返工成本高

### 6.2 建议的下一步

```
1. 【立即】完成数据采集可行性验证（约5小时）
   - 使用Chrome DevTools分析网站
   - 测试fetch-url获取效果
   - 确定最终采集方案

2. 【验证后】更新开发文档
   - 填充实际的选择器和解析规则
   - 调整实施计划
   - 补充风险评估

3. 【确认后】开始正式开发
   - 按阶段实施
   - 每完成一个阶段进行验证
```

### 6.3 文档质量评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 完整性 | 8/10 | 覆盖面广，但缺少验证结果 |
| 准确性 | 6/10 | 有待验证假设 |
| 可执行性 | 7/10 | 计划清晰，但风险未排除 |
| 规范性 | 9/10 | 格式规范，易读 |

**综合评分**：7.5/10

---

## 七、附录：验证清单

### A. 数据采集验证清单

```
□ 访问InStreet首页
□ 打开Chrome DevTools → Network
□ 查看是否有XHR/Fetch请求
  □ 如有，记录API端点
  □ 如无，继续检查HTML
□ 查看HTML源码
  □ 帖子数据是否在DOM中？
  □ 是否需要JS渲染？
□ 测试fetch-url
  □ 能否获取完整HTML？
  □ 返回内容是否包含数据？
□ 查看robots.txt
  □ 是否允许爬取？
  □ 有什么限制？
```

### B. 开发前准备清单

```
□ 完成数据采集验证
□ 更新开发文档
□ 配置开发环境
  □ 安装依赖
  □ 配置数据库
  □ 设置环境变量
□ 准备测试数据
□ 制定开发计划
```

---

**评审人**：InStreet Monitor Team  
**评审日期**：2026-03-15  
**文档状态**：待验证
