/**
 * InStreet 论坛数据类型定义
 */

// ==================== 基础类型 ====================

/**
 * 帖子类型
 */
export type PostCategory = 'square' | 'oracle' | 'literary' | 'skill' | 'other';

/**
 * 内容项类型
 */
export interface ContentItem {
  type: 'text' | 'link' | 'image';
  text?: string;
  url?: string;
  image?: {
    url: string;
    width?: number;
    height?: number;
  };
}

// ==================== 帖子类型 ====================

/**
 * 帖子列表项（从首页提取）
 */
export interface PostListItem {
  id: string;              // UUID
  url: string;             // 完整URL
  category: PostCategory;  // 分类
}

/**
 * 帖子详情
 */
export interface Post {
  id: string;              // UUID
  title: string;           // 标题
  author: string;          // 作者用户名
  authorUrl?: string;      // 作者主页链接
  content: string;         // 内容（纯文本）
  rawContent: ContentItem[]; // 原始内容结构
  likes: number;           // 点赞数
  comments: number;        // 评论数
  category: PostCategory;  // 分类
  publishedAt?: Date;      // 发布时间
  crawledAt: Date;         // 采集时间
}

// ==================== 用户类型 ====================

/**
 * 用户列表项（从首页提取）
 */
export interface UserListItem {
  username: string;        // 用户名
  url: string;             // 完整URL
}

/**
 * 用户详情
 */
export interface User {
  username: string;        // 用户名
  bio: string;             // 个人简介
  avatarUrl?: string;      // 头像URL
  points: number;          // 积分
  posts: number;           // 帖子数
  comments: number;        // 评论数
  likes: number;           // 获赞数（可能是字符串如 "6.3k"）
  likesRaw: string;        // 原始获赞字符串
  followers: number;       // 粉丝数
  followersRaw: string;    // 原始粉丝字符串
  following: number;       // 关注数
  joinedAt?: Date;         // 加入时间
  lastActive?: Date;       // 最后活跃时间
  crawledAt: Date;         // 采集时间
  recentPosts: UserPost[]; // 最近帖子
}

/**
 * 用户主页的帖子
 */
export interface UserPost {
  id: string;
  title: string;
  url: string;
  likes: number;
  publishedAt?: string;    // 如 "20小时前"
}

// ==================== 采集结果类型 ====================

/**
 * 首页统计数据（从首页顶部提取）
 */
export interface HomePageStats {
  totalAgents: number;     // Agent 数量
  totalPosts: number;      // 帖子数
  totalComments: number;   // 评论数
  totalLikes: number;      // 点赞数
}

/**
 * 首页采集结果
 */
export interface HomePageResult {
  stats: HomePageStats;    // 首页统计
  posts: PostListItem[];
  users: UserListItem[];
  crawledAt: Date;
}

/**
 * 单个帖子采集结果
 */
export interface CrawlPostResult {
  success: boolean;
  post?: Post;
  error?: string;
}

/**
 * 单个用户采集结果
 */
export interface CrawlUserResult {
  success: boolean;
  user?: User;
  error?: string;
}

/**
 * 批量采集结果
 */
export interface BatchCrawlResult {
  posts: {
    total: number;
    success: number;
    failed: number;
    data: Post[];
    errors: Array<{ url: string; error: string }>;
  };
  users: {
    total: number;
    success: number;
    failed: number;
    data: User[];
    errors: Array<{ url: string; error: string }>;
  };
  crawledAt: Date;
  duration: number; // 毫秒
}

/**
 * 采集状态
 */
export type CrawlStatus = 'idle' | 'running' | 'completed' | 'failed';

/**
 * 采集日志
 */
export interface CrawlLog {
  id: number;
  type: 'full' | 'posts' | 'users' | 'incremental';
  status: CrawlStatus;
  startedAt: Date;
  finishedAt?: Date;
  postsCrawled: number;
  usersCrawled: number;
  errors: string[];
  duration?: number;
}

// ==================== 工具类型 ====================

/**
 * 解析数字字符串（如 "6.3k" -> 6300）
 */
export function parseNumberString(str: string): number {
  if (!str) return 0;
  
  const cleanStr = str.replace(/[,\s]/g, '').toLowerCase();
  
  if (cleanStr.endsWith('k')) {
    return Math.round(parseFloat(cleanStr) * 1000);
  }
  if (cleanStr.endsWith('m')) {
    return Math.round(parseFloat(cleanStr) * 1000000);
  }
  
  const num = parseInt(cleanStr, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * 从 URL 提取帖子 ID
 */
export function extractPostId(url: string): string {
  const match = url.match(/\/post\/([a-f0-9-]+)/i);
  return match ? match[1] : '';
}

/**
 * 从 URL 提取用户名
 */
export function extractUsername(url: string): string {
  const match = url.match(/\/u\/([^/?]+)/);
  return match ? match[1] : '';
}

/**
 * 判断帖子分类
 */
export function detectCategory(url: string): PostCategory {
  if (url.includes('/oracle')) return 'oracle';
  if (url.includes('/literary')) return 'literary';
  if (url.includes('/skill')) return 'skill';
  if (url.includes('/square')) return 'square';
  return 'other';
}
