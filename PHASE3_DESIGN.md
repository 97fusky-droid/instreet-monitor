# Phase 3 设计文档：监控大屏优化

## 1. 现状分析

### 1.1 当前数据结构

```typescript
// 模拟数据（需替换）
STATS_DATA    → 总用户数、总帖子数、当前在线、总互动数
TREND_DATA    → 24小时趋势数据
HOT_POSTS     → 热门帖子列表
TOP_USERS     → 活跃用户列表
LIVE_FEED     → 实时动态流
```

### 1.2 API 映射关系

| 模拟数据 | 替换为 API | 说明 |
|---------|-----------|------|
| `STATS_DATA` | `GET /api/stats` | 统计数据 |
| `HOT_POSTS` | `GET /api/posts?hot=true&limit=5` | 热门帖子 |
| `TOP_USERS` | `GET /api/users?active=true&limit=5` | 活跃用户 |
| `TREND_DATA` | 暂保留模拟 | 需要历史数据表 |
| `LIVE_FEED` | 改造为最近采集 | 显示最近帖子/用户 |

### 1.3 API 返回格式

```typescript
// GET /api/stats
{
  success: true,
  data: {
    overview: {
      totalPosts: number,
      totalUsers: number,
      totalLikes: number,
      totalComments: number,
      avgLikesPerPost: number,
      lastCrawlAt: string | null
    },
    hotPosts: PostRecord[],
    activeUsers: UserRecord[]
  }
}

// GET /api/posts?hot=true&limit=5
{
  success: true,
  data: PostRecord[],  // 按 likes 降序
  total: number
}

// GET /api/users?active=true&limit=5
{
  success: true,
  data: UserRecord[],  // 按 posts_count 降序
  total: number
}
```

---

## 2. 技术方案

### 2.1 数据获取策略

**方案选择**: SWR (stale-while-revalidate)

**理由**:
- 内置缓存机制，避免重复请求
- 支持自动刷新和窗口聚焦刷新
- 内置错误重试
- 轻量级，适合数据监控场景

**刷新策略**:
| 数据类型 | 刷新间隔 | 说明 |
|---------|---------|------|
| 统计数据 | 30秒 | 核心指标 |
| 热门帖子 | 60秒 | 变化较慢 |
| 活跃用户 | 60秒 | 变化较慢 |

### 2.2 组件结构

```
src/
├── hooks/
│   └── useDashboard.ts      # 数据获取 hook
│
├── components/dashboard/
│   ├── StatsCards.tsx       # 统计卡片组件
│   ├── TrendChart.tsx       # 趋势图表组件
│   ├── HotPosts.tsx         # 热门帖子组件
│   ├── ActiveUsers.tsx      # 活跃用户组件
│   ├── LiveFeed.tsx         # 实时动态组件
│   └── LoadingSkeleton.tsx  # 加载骨架屏
│
└── app/
    └── page.tsx             # 主页面（使用组件）
```

### 2.3 错误处理

1. **网络错误**: 显示错误提示，保留上次数据
2. **空数据**: 显示空状态提示
3. **加载超时**: 10秒后显示超时提示

### 2.4 手动刷新功能

- 添加"立即刷新"按钮
- 添加"触发采集"按钮（调用 POST /api/crawl）
- 显示上次采集时间

---

## 3. 详细设计

### 3.1 useDashboard Hook

```typescript
interface DashboardData {
  stats: StatsOverview | null;
  hotPosts: PostRecord[];
  activeUsers: UserRecord[];
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;  // 手动刷新
  lastUpdated: Date | null;
}

function useDashboard(options?: { refreshInterval?: number }): DashboardData
```

### 3.2 组件接口

#### StatsCards
```typescript
interface StatsCardsProps {
  stats: StatsOverview | null;
  isLoading: boolean;
}
```

#### HotPosts
```typescript
interface HotPostsProps {
  posts: PostRecord[];
  isLoading: boolean;
}
```

#### ActiveUsers
```typescript
interface ActiveUsersProps {
  users: UserRecord[];
  isLoading: boolean;
}
```

### 3.3 加载状态

使用骨架屏（Skeleton）替代简单的 loading 文字：
- 卡片：矩形骨架
- 列表项：圆角矩形骨架
- 图表：区域骨架

---

## 4. 实施步骤

### Step 1: 安装依赖
```bash
pnpm add swr
```

### Step 2: 创建数据获取 Hook
- `src/hooks/useDashboard.ts`

### Step 3: 创建子组件
- `src/components/dashboard/StatsCards.tsx`
- `src/components/dashboard/HotPosts.tsx`
- `src/components/dashboard/ActiveUsers.tsx`
- `src/components/dashboard/LoadingSkeleton.tsx`

### Step 4: 更新主页面
- 重构 `src/app/page.tsx`
- 使用新组件和真实数据

### Step 5: 添加刷新功能
- 手动刷新按钮
- 触发采集按钮
- 上次更新时间显示

### Step 6: 测试验证
- 验证数据正确性
- 验证刷新功能
- 验证错误处理

---

## 5. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| API 响应慢 | 用户体验差 | 骨架屏 + 超时处理 |
| 数据为空 | 显示异常 | 空状态处理 |
| 频繁刷新 | 服务器压力 | 合理设置刷新间隔 |
| 网络错误 | 数据丢失 | 保留缓存数据 + 错误提示 |

---

## 6. 验收标准

- [ ] 页面加载显示骨架屏
- [ ] 数据从 API 正确获取并显示
- [ ] 自动刷新正常工作
- [ ] 手动刷新按钮可用
- [ ] 错误状态正确处理
- [ ] 无 Hydration 错误
- [ ] TypeScript 类型检查通过
