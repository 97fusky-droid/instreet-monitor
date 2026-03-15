# InStreet 论坛监控系统 - 开发文档

## 目录

1. [系统架构](#1-系统架构)
2. [数据库设计](#2-数据库设计)
3. [API接口设计](#3-api接口设计)
4. [数据采集方案](#4-数据采集方案)
5. [前端组件设计](#5-前端组件设计)
6. [定时任务设计](#6-定时任务设计)
7. [部署方案](#7-部署方案)
8. [测试方案](#8-测试方案)
9. [监控与运维](#9-监控与运维)
10. [验证结果](#10-验证结果)

---

## 1. 系统架构

### 1.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        用户界面层                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  监控大屏     │  │  数据查询     │  │  数据导出     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                           ↓ Next.js API Routes
┌─────────────────────────────────────────────────────────────┐
│                        API服务层                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  数据聚合API  │  │  采集调度API  │  │  导出服务API  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                       业务逻辑层                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  数据采集器   │  │  数据处理器   │  │  数据聚合器   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                       数据存储层                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  PostgreSQL  │  │  Redis缓存   │  │  对象存储     │      │
│  │  (Supabase)  │  │  (可选)      │  │  (备份文件)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                       外部数据源                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              InStreet 论坛 (https://instreet.coze.site)│  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 技术栈

#### 前端技术栈
| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 16.1.1 | 全栈框架（App Router） |
| React | 19.2.3 | UI组件库 |
| TypeScript | 5.x | 类型系统 |
| Tailwind CSS | 4.x | 样式框架 |
| shadcn/ui | latest | UI组件库 |
| Recharts | 2.15.4 | 数据可视化 |
| Lucide React | 0.468.0 | 图标库 |

#### 后端技术栈
| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js API Routes | 16.1.1 | RESTful API |
| Drizzle ORM | 0.45.1 | 数据库ORM |
| Supabase | 2.95.3 | PostgreSQL数据库 |
| coze-coding-dev-sdk | 0.7.17 | fetch-url数据采集 |

#### 基础设施
| 服务 | 用途 |
|------|------|
| Supabase PostgreSQL | 主数据库 |
| Vercel | 应用托管 |
| Vercel Cron | 定时任务 |

### 1.3 数据流向

```
1. 采集流程
InStreet网站 → fetch-url技能 → 数据解析器 → 数据验证 → 数据库存储

2. 查询流程
用户请求 → API接口 → 数据聚合 → 缓存检查 → 数据库查询 → 返回结果

3. 导出流程
用户请求 → 数据查询 → 格式转换 → 文件生成 → 返回下载链接
```

---

## 2. 数据库设计

### 2.1 数据表结构

#### 2.1.1 帖子表 (posts)

```sql
CREATE TABLE posts (
  id VARCHAR(255) PRIMARY KEY,              -- 帖子ID（从网站提取）
  title TEXT NOT NULL,                       -- 标题
  content TEXT,                              -- 内容
  author_id VARCHAR(255) NOT NULL,           -- 作者ID
  author_name VARCHAR(255),                  -- 作者名称
  likes_count INTEGER DEFAULT 0,             -- 点赞数
  comments_count INTEGER DEFAULT 0,          -- 评论数
  shares_count INTEGER DEFAULT 0,            -- 分享数
  bookmarks_count INTEGER DEFAULT 0,         -- 收藏数
  tags TEXT[],                               -- 标签数组
  published_at TIMESTAMP,                    -- 发布时间
  created_at TIMESTAMP DEFAULT NOW(),        -- 创建时间
  updated_at TIMESTAMP DEFAULT NOW(),        -- 更新时间
  crawled_at TIMESTAMP DEFAULT NOW()         -- 采集时间
);

CREATE INDEX idx_posts_author_id ON posts(author_id);
CREATE INDEX idx_posts_published_at ON posts(published_at DESC);
CREATE INDEX idx_posts_likes_count ON posts(likes_count DESC);
CREATE INDEX idx_posts_crawled_at ON posts(crawled_at DESC);
```

#### 2.1.2 用户表 (users)

```sql
CREATE TABLE users (
  id VARCHAR(255) PRIMARY KEY,               -- 用户ID
  name VARCHAR(255) NOT NULL,                -- 用户名
  avatar_url TEXT,                           -- 头像URL
  bio TEXT,                                  -- 简介
  posts_count INTEGER DEFAULT 0,             -- 帖子数
  followers_count INTEGER DEFAULT 0,         -- 粉丝数
  following_count INTEGER DEFAULT 0,         -- 关注数
  created_at TIMESTAMP DEFAULT NOW(),        -- 创建时间
  updated_at TIMESTAMP DEFAULT NOW(),        -- 更新时间
  crawled_at TIMESTAMP DEFAULT NOW()         -- 采集时间
);

CREATE INDEX idx_users_posts_count ON users(posts_count DESC);
CREATE INDEX idx_users_followers_count ON users(followers_count DESC);
```

#### 2.1.3 评论表 (comments)

```sql
CREATE TABLE comments (
  id VARCHAR(255) PRIMARY KEY,               -- 评论ID
  post_id VARCHAR(255) NOT NULL,             -- 帖子ID
  user_id VARCHAR(255) NOT NULL,             -- 评论者ID
  user_name VARCHAR(255),                    -- 评论者名称
  content TEXT NOT NULL,                     -- 评论内容
  likes_count INTEGER DEFAULT 0,             -- 点赞数
  created_at TIMESTAMP DEFAULT NOW(),        -- 创建时间
  crawled_at TIMESTAMP DEFAULT NOW(),        -- 采集时间
  
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
```

#### 2.1.4 数据快照表 (snapshots)

```sql
CREATE TABLE snapshots (
  id SERIAL PRIMARY KEY,                     -- 快照ID
  snapshot_type VARCHAR(50) NOT NULL,        -- 快照类型：hourly/daily/weekly
  snapshot_time TIMESTAMP NOT NULL,          -- 快照时间
  
  -- 聚合数据
  total_posts INTEGER DEFAULT 0,             -- 总帖子数
  total_users INTEGER DEFAULT 0,             -- 总用户数
  active_users INTEGER DEFAULT 0,            -- 活跃用户数
  total_likes INTEGER DEFAULT 0,             -- 总点赞数
  total_comments INTEGER DEFAULT 0,          -- 总评论数
  total_shares INTEGER DEFAULT 0,            -- 总分享数
  
  -- 衍生指标
  avg_likes_per_post DECIMAL(10,2),          -- 平均点赞/帖
  avg_comments_per_post DECIMAL(10,2),       -- 平均评论/帖
  engagement_rate DECIMAL(10,4),             -- 参与率
  
  created_at TIMESTAMP DEFAULT NOW(),        -- 创建时间
  
  UNIQUE(snapshot_type, snapshot_time)
);

CREATE INDEX idx_snapshots_type_time ON snapshots(snapshot_type, snapshot_time DESC);
```

#### 2.1.5 采集任务日志表 (crawl_logs)

```sql
CREATE TABLE crawl_logs (
  id SERIAL PRIMARY KEY,                     -- 日志ID
  crawl_type VARCHAR(50) NOT NULL,           -- 采集类型：posts/users/comments
  status VARCHAR(20) NOT NULL,               -- 状态：success/failed/running
  started_at TIMESTAMP NOT NULL,             -- 开始时间
  finished_at TIMESTAMP,                     -- 结束时间
  items_crawled INTEGER DEFAULT 0,           -- 采集数量
  items_new INTEGER DEFAULT 0,               -- 新增数量
  items_updated INTEGER DEFAULT 0,           -- 更新数量
  error_message TEXT,                        -- 错误信息
  created_at TIMESTAMP DEFAULT NOW()         -- 创建时间
);

CREATE INDEX idx_crawl_logs_type ON crawl_logs(crawl_type);
CREATE INDEX idx_crawl_logs_status ON crawl_logs(status);
CREATE INDEX idx_crawl_logs_started_at ON crawl_logs(started_at DESC);
```

### 2.2 Drizzle Schema 定义

```typescript
// src/lib/db/schema.ts

import { pgTable, varchar, text, integer, timestamp, serial, decimal, json } from 'drizzle-orm/pg-core';

export const posts = pgTable('posts', {
  id: varchar('id', { length: 255 }).primaryKey(),
  title: text('title').notNull(),
  content: text('content'),
  authorId: varchar('author_id', { length: 255 }).notNull(),
  authorName: varchar('author_name', { length: 255 }),
  likesCount: integer('likes_count').default(0),
  commentsCount: integer('comments_count').default(0),
  sharesCount: integer('shares_count').default(0),
  bookmarksCount: integer('bookmarks_count').default(0),
  tags: json('tags').$type<string[]>(),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  crawledAt: timestamp('crawled_at').defaultNow(),
});

export const users = pgTable('users', {
  id: varchar('id', { length: 255 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  postsCount: integer('posts_count').default(0),
  followersCount: integer('followers_count').default(0),
  followingCount: integer('following_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  crawledAt: timestamp('crawled_at').defaultNow(),
});

export const comments = pgTable('comments', {
  id: varchar('id', { length: 255 }).primaryKey(),
  postId: varchar('post_id', { length: 255 }).notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  userName: varchar('user_name', { length: 255 }),
  content: text('content').notNull(),
  likesCount: integer('likes_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  crawledAt: timestamp('crawled_at').defaultNow(),
});

export const snapshots = pgTable('snapshots', {
  id: serial('id').primaryKey(),
  snapshotType: varchar('snapshot_type', { length: 50 }).notNull(),
  snapshotTime: timestamp('snapshot_time').notNull(),
  totalPosts: integer('total_posts').default(0),
  totalUsers: integer('total_users').default(0),
  activeUsers: integer('active_users').default(0),
  totalLikes: integer('total_likes').default(0),
  totalComments: integer('total_comments').default(0),
  totalShares: integer('total_shares').default(0),
  avgLikesPerPost: decimal('avg_likes_per_post', { precision: 10, scale: 2 }),
  avgCommentsPerPost: decimal('avg_comments_per_post', { precision: 10, scale: 2 }),
  engagementRate: decimal('engagement_rate', { precision: 10, scale: 4 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const crawlLogs = pgTable('crawl_logs', {
  id: serial('id').primaryKey(),
  crawlType: varchar('crawl_type', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  startedAt: timestamp('started_at').notNull(),
  finishedAt: timestamp('finished_at'),
  itemsCrawled: integer('items_crawled').default(0),
  itemsNew: integer('items_new').default(0),
  itemsUpdated: integer('items_updated').default(0),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 类型导出
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type Snapshot = typeof snapshots.$inferSelect;
export type CrawlLog = typeof crawlLogs.$inferSelect;
```

---

## 3. API接口设计

### 3.1 数据采集API

#### 3.1.1 触发采集
```typescript
POST /api/crawl/trigger
Content-Type: application/json

Request:
{
  "type": "posts" | "users" | "comments" | "all",
  "force": boolean // 是否强制全量采集
}

Response:
{
  "success": true,
  "data": {
    "logId": 123,
    "status": "running"
  }
}
```

#### 3.1.2 查询采集状态
```typescript
GET /api/crawl/status?logId=123

Response:
{
  "success": true,
  "data": {
    "id": 123,
    "crawlType": "posts",
    "status": "success",
    "startedAt": "2026-03-15T10:00:00Z",
    "finishedAt": "2026-03-15T10:00:30Z",
    "itemsCrawled": 150,
    "itemsNew": 23,
    "itemsUpdated": 12
  }
}
```

### 3.2 数据查询API

#### 3.2.1 获取概览数据
```typescript
GET /api/stats/overview

Response:
{
  "success": true,
  "data": {
    "totalUsers": 12847,
    "totalPosts": 34295,
    "activeNow": 1234,
    "totalInteractions": 156789,
    "growthRate": "+12.5%",
    "avgLikes": 23,
    "avgComments": 8,
    "lastUpdate": "2026-03-15T10:30:00Z"
  }
}
```

#### 3.2.2 获取趋势数据
```typescript
GET /api/stats/trends?period=24h | 7d | 30d

Response:
{
  "success": true,
  "data": [
    {
      "time": "2026-03-15T00:00:00Z",
      "posts": 120,
      "users": 890,
      "interactions": 2340
    },
    // ...
  ]
}
```

#### 3.2.3 获取热门帖子
```typescript
GET /api/posts/hot?limit=10&period=24h

Response:
{
  "success": true,
  "data": [
    {
      "id": "post_123",
      "title": "GPT-5 即将发布",
      "author": "AI_Explorer_01",
      "likes": 2847,
      "comments": 392,
      "publishedAt": "2026-03-15T08:00:00Z"
    },
    // ...
  ]
}
```

#### 3.2.4 获取活跃用户
```typescript
GET /api/users/active?limit=10&period=7d

Response:
{
  "success": true,
  "data": [
    {
      "id": "user_123",
      "name": "AI_Explorer_01",
      "posts": 234,
      "followers": 5678,
      "avatar": "https://..."
    },
    // ...
  ]
}
```

### 3.3 数据导出API

#### 3.3.1 导出CSV
```typescript
GET /api/export/csv?type=posts&start=2026-03-01&end=2026-03-15

Response:
Content-Type: text/csv
Content-Disposition: attachment; filename="posts_2026-03-01_2026-03-15.csv"

id,title,author,likes,comments,published_at
post_123,GPT-5 即将发布,AI_Explorer_01,2847,392,2026-03-15T08:00:00Z
...
```

#### 3.3.2 导出Excel
```typescript
GET /api/export/excel?type=posts&start=2026-03-01&end=2026-03-15

Response:
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="posts_2026-03-01_2026-03-15.xlsx"

[Excel文件二进制数据]
```

### 3.4 定时任务API

#### 3.4.1 定时采集触发（供Cron调用）
```typescript
GET /api/cron/crawl
Authorization: Bearer {CRON_SECRET}

Response:
{
  "success": true,
  "message": "Crawl task triggered"
}
```

---

## 4. 数据采集方案

### 4.1 采集策略

#### 4.1.1 采集方式选择

**方案A：DOM解析（推荐）**
- 优点：无需API，直接解析HTML
- 缺点：网站结构变化时需调整
- 适用：无公开API场景

**方案B：API调用**
- 优点：数据结构化，稳定
- 缺点：需找到API端点，可能有限制
- 适用：有公开或内部API场景

**实施建议**：
1. 首先检查是否有API接口（Chrome DevTools → Network）
2. 如有API，优先使用API方式
3. 如无API，使用fetch-url + DOM解析

#### 4.1.2 增量采集策略

```
首次采集：
- 获取全量数据
- 记录最后采集时间戳
- 存储所有数据

增量采集：
- 获取最新数据（按时间排序）
- 对比已存在数据
- 仅插入/更新变化数据
- 更新最后采集时间戳
```

### 4.2 解析规则设计

#### 4.2.1 帖子列表解析

```typescript
// src/lib/scraper/parsers.ts

interface PostParser {
  // 帖子容器选择器
  containerSelector: string;
  
  // 字段映射
  fields: {
    id: string;           // 帖子ID选择器/提取规则
    title: string;        // 标题选择器
    content: string;      // 内容选择器
    author: {
      id: string;         // 作者ID选择器
      name: string;       // 作者名选择器
    };
    stats: {
      likes: string;      // 点赞数选择器
      comments: string;   // 评论数选择器
    };
    time: string;         // 发布时间选择器
    tags: string;         // 标签选择器
  };
}

// 示例：根据实际网站结构调整
export const postParser: PostParser = {
  containerSelector: '.post-item',  // 待确认
  fields: {
    id: 'data-post-id',
    title: '.post-title',
    content: '.post-content',
    author: {
      id: 'data-author-id',
      name: '.author-name',
    },
    stats: {
      likes: '.like-count',
      comments: '.comment-count',
    },
    time: '.post-time',
    tags: '.tag-item',
  },
};
```

#### 4.2.2 数据清洗规则

```typescript
// src/lib/scraper/ cleaners.ts

export function cleanPostData(rawData: any): Partial<Post> {
  return {
    id: sanitizeId(rawData.id),
    title: sanitizeText(rawData.title),
    content: sanitizeText(rawData.content),
    authorId: sanitizeId(rawData.authorId),
    authorName: sanitizeText(rawData.authorName),
    likesCount: parseNumber(rawData.likesCount),
    commentsCount: parseNumber(rawData.commentsCount),
    publishedAt: parseDate(rawData.publishedAt),
    tags: parseArray(rawData.tags),
  };
}

function sanitizeId(id: string): string {
  return id?.trim() || '';
}

function sanitizeText(text: string): string {
  return text?.trim().replace(/\s+/g, ' ') || '';
}

function parseNumber(value: string): number {
  const num = parseInt(value?.replace(/[^0-9]/g, ''), 10);
  return isNaN(num) ? 0 : num;
}

function parseDate(dateStr: string): Date | null {
  // 支持多种日期格式
  // "2小时前" -> 相对时间
  // "2026-03-15" -> 绝对时间
  return parseRelativeTime(dateStr) || parseAbsoluteTime(dateStr);
}
```

### 4.3 采集器实现

```typescript
// src/lib/scraper/crawler.ts

import { FetchClient, Config } from 'coze-coding-dev-sdk';
import { db } from '@/lib/db';
import { posts, crawlLogs } from '@/lib/db/schema';
import { cleanPostData } from './cleaners';
import { postParser } from './parsers';

export class InStreetCrawler {
  private client: FetchClient;
  private baseUrl = 'https://instreet.coze.site/';

  constructor() {
    const config = new Config();
    this.client = new FetchClient(config);
  }

  async crawlPosts(limit: number = 100): Promise<CrawlResult> {
    const logId = await this.createCrawlLog('posts');
    
    try {
      // 1. 获取页面内容
      const response = await this.client.fetch(this.baseUrl);
      
      // 2. 解析数据
      const rawPosts = this.parsePosts(response.content);
      
      // 3. 清洗数据
      const cleanedPosts = rawPosts.map(cleanPostData);
      
      // 4. 去重并存储
      const { newCount, updateCount } = await this.savePosts(cleanedPosts);
      
      // 5. 更新日志
      await this.updateCrawlLog(logId, 'success', {
        itemsCrawled: cleanedPosts.length,
        itemsNew: newCount,
        itemsUpdated: updateCount,
      });
      
      return {
        success: true,
        crawled: cleanedPosts.length,
        new: newCount,
        updated: updateCount,
      };
      
    } catch (error) {
      await this.updateCrawlLog(logId, 'failed', {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw error;
    }
  }

  private parsePosts(content: FetchContentItem[]): any[] {
    // 根据实际网站结构实现解析逻辑
    // 这里需要根据InStreet的实际HTML结构来写
    const htmlContent = content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('');
    
    // 使用正则或DOM解析器提取数据
    // 实际实现需要根据网站结构调整
    return [];
  }

  private async savePosts(posts: Partial<Post>[]): Promise<{ newCount: number; updateCount: number }> {
    let newCount = 0;
    let updateCount = 0;

    for (const post of posts) {
      if (!post.id) continue;

      const existing = await db.select()
        .from(posts)
        .where(eq(posts.id, post.id))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(posts).values(post as NewPost);
        newCount++;
      } else {
        await db.update(posts)
          .set({ ...post, updatedAt: new Date() })
          .where(eq(posts.id, post.id));
        updateCount++;
      }
    }

    return { newCount, updateCount };
  }

  private async createCrawlLog(type: string): Promise<number> {
    const result = await db.insert(crawlLogs).values({
      crawlType: type,
      status: 'running',
      startedAt: new Date(),
    }).returning({ id: crawlLogs.id });
    
    return result[0].id;
  }

  private async updateCrawlLog(logId: number, status: string, data: Partial<CrawlLog>): Promise<void> {
    await db.update(crawlLogs)
      .set({
        status,
        finishedAt: new Date(),
        ...data,
      })
      .where(eq(crawlLogs.id, logId));
  }
}
```

---

## 5. 前端组件设计

### 5.1 组件结构

```
src/
├── app/
│   ├── page.tsx                    # 监控大屏主页
│   ├── layout.tsx                  # 全局布局
│   ├── api/                        # API路由
│   │   ├── crawl/
│   │   ├── stats/
│   │   └── export/
│   └── globals.css                 # 全局样式
│
├── components/
│   ├── ui/                         # shadcn/ui 组件
│   ├── dashboard/                  # 监控大屏组件
│   │   ├── StatsCard.tsx          # 统计卡片
│   │   ├── TrendChart.tsx         # 趋势图表
│   │   ├── HotPostsList.tsx       # 热门帖子列表
│   │   ├── ActiveUsersList.tsx    # 活跃用户列表
│   │   └── LiveFeed.tsx           # 实时动态流
│   └── shared/                     # 共享组件
│       ├── Header.tsx             # 顶部导航
│       └── Loading.tsx            # 加载状态
│
├── lib/
│   ├── db/                         # 数据库
│   │   ├── index.ts               # 数据库连接
│   │   └── schema.ts              # 表结构定义
│   ├── scraper/                    # 数据采集
│   │   ├── crawler.ts             # 采集器
│   │   ├── parsers.ts             # 解析规则
│   │   └── cleaners.ts            # 数据清洗
│   └── utils/                      # 工具函数
│       ├── format.ts              # 格式化
│       └── api.ts                 # API请求
│
└── types/                          # 类型定义
    ├── post.ts
    ├── user.ts
    └── stats.ts
```

### 5.2 核心组件实现

#### 5.2.1 StatsCard 组件（已实现）

```typescript
// src/components/dashboard/StatsCard.tsx

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  trend?: {
    value: string;
    type: 'up' | 'down';
  };
  color?: 'cyan' | 'purple' | 'yellow' | 'red';
}

export function StatsCard({ title, value, icon, trend, color = 'cyan' }: StatsCardProps) {
  // 实现代码...
}
```

#### 5.2.2 TrendChart 组件（已实现）

```typescript
// src/components/dashboard/TrendChart.tsx

interface TrendChartProps {
  data: Array<{
    time: string;
    posts: number;
    users: number;
    interactions: number;
  }>;
  height?: number;
}

export function TrendChart({ data, height = 250 }: TrendChartProps) {
  // 使用 Recharts 实现
}
```

#### 5.2.3 数据获取Hook

```typescript
// src/lib/hooks/useMonitorData.ts

import useSWR from 'swr';

export function useOverviewData() {
  const { data, error, isLoading } = useSWR(
    '/api/stats/overview',
    fetcher,
    {
      refreshInterval: 60000, // 每分钟刷新
      revalidateOnFocus: false,
    }
  );

  return {
    data,
    isLoading,
    isError: error,
  };
}

export function useTrendData(period: '24h' | '7d' | '30d' = '24h') {
  const { data, error, isLoading } = useSWR(
    `/api/stats/trends?period=${period}`,
    fetcher,
    {
      refreshInterval: 300000, // 每5分钟刷新
    }
  );

  return {
    data,
    isLoading,
    isError: error,
  };
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};
```

---

## 6. 定时任务设计

### 6.1 Vercel Cron 配置

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/crawl",
      "schedule": "0 * * * *"
    }
  ]
}
```

### 6.2 Cron API 实现

```typescript
// src/app/api/cron/crawl/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { InStreetCrawler } from '@/lib/scraper/crawler';

export async function GET(request: NextRequest) {
  // 验证 Cron 密钥
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const crawler = new InStreetCrawler();
    
    // 执行采集任务
    const result = await crawler.crawlPosts();
    
    return NextResponse.json({
      success: true,
      message: 'Crawl task completed',
      result,
    });
  } catch (error) {
    console.error('Cron crawl error:', error);
    return NextResponse.json(
      { error: 'Crawl failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
```

### 6.3 定时任务调度表

| 任务 | 频率 | 时间 | 说明 |
|------|------|------|------|
| 帖子采集 | 每小时 | 整点 | 采集最新帖子 |
| 用户采集 | 每2小时 | 偶数点 | 更新用户信息 |
| 快照生成 | 每小时 | 整点+10分 | 生成统计快照 |
| 数据备份 | 每天 | 02:00 | 备份数据库 |

---

## 7. 部署方案

### 7.1 环境变量

```bash
# .env.local

# Supabase
DATABASE_URL=postgresql://...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx

# Cron
CRON_SECRET=your-secret-key

# 可选：Redis缓存
REDIS_URL=redis://xxx
```

### 7.2 部署步骤

#### Step 1: 配置Supabase
```bash
1. 创建Supabase项目
2. 获取数据库连接字符串
3. 在Supabase SQL Editor中执行表创建脚本
4. 配置RLS策略（如需要）
```

#### Step 2: 配置Drizzle
```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

#### Step 3: 运行迁移
```bash
# 生成迁移文件
pnpm drizzle-kit generate

# 执行迁移
pnpm drizzle-kit migrate
```

#### Step 4: 部署到Vercel
```bash
1. 连接GitHub仓库到Vercel
2. 配置环境变量
3. 部署项目
4. 验证Cron任务配置
```

---

## 8. 测试方案

### 8.1 单元测试

```typescript
// __tests__/lib/scraper/cleaners.test.ts

import { cleanPostData, parseNumber, parseDate } from '@/lib/scraper/cleaners';

describe('Data Cleaners', () => {
  test('parseNumber should extract numbers', () => {
    expect(parseNumber('123')).toBe(123);
    expect(parseNumber('1.2k')).toBe(1200);
    expect(parseNumber('invalid')).toBe(0);
  });

  test('parseDate should handle relative time', () => {
    const result = parseDate('2小时前');
    expect(result).toBeInstanceOf(Date);
  });

  test('cleanPostData should sanitize all fields', () => {
    const raw = {
      id: '  post_123  ',
      title: '  Test Title  ',
      likesCount: '1.2k',
    };
    
    const cleaned = cleanPostData(raw);
    
    expect(cleaned.id).toBe('post_123');
    expect(cleaned.title).toBe('Test Title');
    expect(cleaned.likesCount).toBe(1200);
  });
});
```

### 8.2 集成测试

```typescript
// __tests__/api/stats/overview.test.ts

import { GET } from '@/app/api/stats/overview/route';

describe('/api/stats/overview', () => {
  test('should return overview stats', async () => {
    const response = await GET();
    const data = await response.json();
    
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('totalUsers');
    expect(data.data).toHaveProperty('totalPosts');
  });
});
```

### 8.3 API测试清单

```
□ GET /api/stats/overview - 返回概览数据
□ GET /api/stats/trends?period=24h - 返回趋势数据
□ GET /api/posts/hot - 返回热门帖子
□ GET /api/users/active - 返回活跃用户
□ POST /api/crawl/trigger - 触发采集
□ GET /api/crawl/status?logId=1 - 查询采集状态
□ GET /api/export/csv - 导出CSV
□ GET /api/cron/crawl - Cron触发（需认证）
```

---

## 9. 监控与运维

### 9.1 日志记录

```typescript
// src/lib/logger.ts

import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

// 使用示例
logger.info({ crawlType: 'posts', count: 150 }, 'Crawl completed');
logger.error({ error: err.message }, 'Crawl failed');
```

### 9.2 错误追踪

```typescript
// src/lib/error-tracker.ts

export class ErrorTracker {
  static async track(error: Error, context: Record<string, any>) {
    // 记录到数据库
    await db.insert(errorLogs).values({
      message: error.message,
      stack: error.stack,
      context: JSON.stringify(context),
      createdAt: new Date(),
    });
    
    // 可选：发送告警
    if (this.shouldAlert(error)) {
      await this.sendAlert(error, context);
    }
  }

  private static shouldAlert(error: Error): boolean {
    // 判断是否需要告警的逻辑
    return true;
  }

  private static async sendAlert(error: Error, context: Record<string, any>) {
    // 发送告警通知（邮件/Webhook）
  }
}
```

### 9.3 健康检查

```typescript
// src/app/api/health/route.ts

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const checks = {
    database: await checkDatabase(),
    lastCrawl: await checkLastCrawl(),
  };

  const allHealthy = Object.values(checks).every(v => v === 'ok');

  return NextResponse.json(
    {
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: allHealthy ? 200 : 503 }
  );
}

async function checkDatabase(): Promise<'ok' | 'error'> {
  try {
    await db.execute('SELECT 1');
    return 'ok';
  } catch {
    return 'error';
  }
}

async function checkLastCrawl(): Promise<'ok' | 'stale' | 'error'> {
  try {
    const lastLog = await db.select()
      .from(crawlLogs)
      .orderBy(desc(crawlLogs.startedAt))
      .limit(1);
    
    if (!lastLog[0]) return 'error';
    
    const hoursSinceLastCrawl = 
      (Date.now() - lastLog[0].startedAt.getTime()) / (1000 * 60 * 60);
    
    return hoursSinceLastCrawl < 2 ? 'ok' : 'stale';
  } catch {
    return 'error';
  }
}
```

---

## 附录

### A. 项目文件清单

```
/workspace/projects/
├── PROJECT_GOALS.md          # 项目目标文档
├── MONITOR_PLAN.md           # 监控方案文档
├── DEVELOPMENT_GUIDE.md      # 开发文档（本文件）
├── package.json
├── drizzle.config.ts
├── vercel.json
├── .env.local.example
│
├── src/
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── types/
│
└── drizzle/
    └── migrations/
```

### B. 技术债务清单

1. [ ] 添加Redis缓存层
2. [ ] 实现WebSocket实时推送
3. [ ] 添加用户认证系统
4. [ ] 移动端响应式优化
5. [ ] 性能监控Dashboard

### C. 参考资料

- [Next.js 文档](https://nextjs.org/docs)
- [Drizzle ORM 文档](https://orm.drizzle.team/docs)
- [Supabase 文档](https://supabase.com/docs)
- [Recharts 文档](https://recharts.org/)

---

## 10. 验证结果

### 10.1 验证日期

**验证日期**: 2025-01-09  
**验证状态**: ✅ 通过

### 10.2 验证结论

经过实际测试，使用 `fetch-url` 技能采集 InStreet 论坛数据**完全可行**：

| 数据类型 | 验证状态 | 采集结果 |
|---------|---------|---------|
| 首页帖子列表 | ✅ 成功 | 56个帖子链接 |
| 用户列表 | ✅ 成功 | 10个用户链接 |
| 帖子详情 | ✅ 成功 | 标题、作者、内容、点赞、评论数 |
| 用户信息 | ✅ 成功 | 积分、帖子数、粉丝数、加入时间等 |

### 10.3 关键发现

1. **InStreet 是 SSR 网站**：所有数据直接渲染在 HTML 中，无需执行 JavaScript
2. **数据结构清晰**：链接格式统一，易于解析
   - 帖子: `/post/{uuid}`
   - 用户: `/u/{username}`
   - Oracle: `/oracle/{uuid}`
   - Group: `/g/{groupname}`
3. **fetch-url 支持完整内容提取**：包括 `fullContent` 数组，包含 type、text、url 等字段

### 10.4 最终技术方案

**采用方案**: fetch-url + DOM解析

**原因**:
- ✅ 无需处理 API 认证
- ✅ 无需执行 JavaScript
- ✅ 数据结构清晰稳定
- ✅ 实现成本低

### 10.5 下一步实施计划

#### Phase 1: 数据采集层（预计1-2天）
- [ ] 创建 `fetch-url` 封装服务
- [ ] 实现帖子解析器
- [ ] 实现用户解析器
- [ ] 添加错误处理和重试机制
- [ ] 实现速率限制

#### Phase 2: 数据存储层（预计1天）
- [ ] 创建 Drizzle Schema
- [ ] 实现数据持久化服务
- [ ] 创建数据迁移脚本

#### Phase 3: 监控大屏优化（预计2-3天）
- [ ] 实现真实数据接入
- [ ] 添加自动刷新机制
- [ ] 优化数据可视化

#### Phase 4: 智能分析（可选，预计2-3天）
- [ ] 热点话题检测
- [ ] 活跃用户分析
- [ ] 趋势预测

### 10.6 详细验证报告

详见: [VALIDATION_REPORT.md](./VALIDATION_REPORT.md)

---

**文档版本**：v1.1  
**创建时间**：2026-03-15  
**最后更新**：2025-01-09  
**维护者**：InStreet Monitor Team
