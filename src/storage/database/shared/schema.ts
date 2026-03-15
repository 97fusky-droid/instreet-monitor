import { pgTable, serial, timestamp, varchar, text, integer, jsonb, index, boolean } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// ==================== 系统表（保留） ====================

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// ==================== InStreet 监控系统表 ====================

/**
 * 帖子表 - 存储 InStreet 帖子数据
 */
export const posts = pgTable(
  "posts",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    title: text("title").notNull(),
    content: text("content"),
    authorName: varchar("author_name", { length: 128 }),
    authorUrl: varchar("author_url", { length: 512 }),
    likes: integer("likes").default(0).notNull(),
    comments: integer("comments").default(0).notNull(),
    category: varchar("category", { length: 32 }).default('other').notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    crawledAt: timestamp("crawled_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("posts_author_name_idx").on(table.authorName),
    index("posts_category_idx").on(table.category),
    index("posts_likes_idx").on(table.likes),
    index("posts_published_at_idx").on(table.publishedAt),
    index("posts_crawled_at_idx").on(table.crawledAt),
  ]
);

/**
 * 用户表 - 存储 InStreet 用户数据
 */
export const users = pgTable(
  "users",
  {
    username: varchar("username", { length: 128 }).primaryKey(),
    bio: text("bio"),
    points: integer("points").default(0).notNull(),
    postsCount: integer("posts_count").default(0).notNull(),
    commentsCount: integer("comments_count").default(0).notNull(),
    likesCount: integer("likes_count").default(0).notNull(),
    followersCount: integer("followers_count").default(0).notNull(),
    followingCount: integer("following_count").default(0).notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    crawledAt: timestamp("crawled_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("users_points_idx").on(table.points),
    index("users_posts_count_idx").on(table.postsCount),
    index("users_followers_count_idx").on(table.followersCount),
    index("users_crawled_at_idx").on(table.crawledAt),
  ]
);

/**
 * 采集日志表 - 记录每次采集的执行情况
 */
export const crawlLogs = pgTable(
  "crawl_logs",
  {
    id: serial().primaryKey(),
    crawlType: varchar("crawl_type", { length: 32 }).notNull(), // 'full' | 'posts' | 'users' | 'home'
    status: varchar("status", { length: 16 }).notNull(), // 'running' | 'completed' | 'failed'
    postsCrawled: integer("posts_crawled").default(0).notNull(),
    usersCrawled: integer("users_crawled").default(0).notNull(),
    postsSuccess: integer("posts_success").default(0).notNull(),
    usersSuccess: integer("users_success").default(0).notNull(),
    errors: jsonb("errors").default([]).$type<Array<{ url: string; error: string }>>(),
    duration: integer("duration"), // 毫秒
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("crawl_logs_crawl_type_idx").on(table.crawlType),
    index("crawl_logs_status_idx").on(table.status),
    index("crawl_logs_started_at_idx").on(table.startedAt),
  ]
);

/**
 * 数据快照表 - 存储定期统计数据
 */
export const snapshots = pgTable(
  "snapshots",
  {
    id: serial().primaryKey(),
    snapshotType: varchar("snapshot_type", { length: 16 }).notNull(), // 'hourly' | 'daily'
    snapshotTime: timestamp("snapshot_time", { withTimezone: true }).notNull(),
    totalPosts: integer("total_posts").default(0).notNull(),
    totalUsers: integer("total_users").default(0).notNull(),
    totalLikes: integer("total_likes").default(0).notNull(),
    totalComments: integer("total_comments").default(0).notNull(),
    avgLikesPerPost: integer("avg_likes_per_post").default(0),
    topPostId: varchar("top_post_id", { length: 64 }),
    topUserId: varchar("top_user_id", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("snapshots_snapshot_type_idx").on(table.snapshotType),
    index("snapshots_snapshot_time_idx").on(table.snapshotTime),
  ]
);

// ==================== TypeScript 类型推断 ====================

export type Post = typeof posts.$inferSelect;
export type InsertPost = typeof posts.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type CrawlLog = typeof crawlLogs.$inferSelect;
export type InsertCrawlLog = typeof crawlLogs.$inferInsert;
export type Snapshot = typeof snapshots.$inferSelect;
export type InsertSnapshot = typeof snapshots.$inferInsert;
