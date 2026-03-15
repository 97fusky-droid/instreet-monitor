/**
 * InStreet 数据存储服务
 * 使用 Supabase 进行数据持久化
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { BatchCrawlResult } from '@/types/instreet';

// ==================== 数据库记录类型（snake_case，与 Supabase 兼容）====================

export interface PostRecord {
  id: string;
  title: string;
  content?: string | null;
  author_name?: string | null;
  author_url?: string | null;
  likes: number;
  comments: number;
  category: string;
  published_at?: string | null;
  crawled_at: string;
  created_at?: string;
  updated_at?: string | null;
}

export interface UserRecord {
  username: string;
  bio?: string | null;
  points: number;
  posts_count: number;
  comments_count: number;
  likes_count: number;
  followers_count: number;
  following_count: number;
  joined_at?: string | null;
  crawled_at: string;
  created_at?: string;
  updated_at?: string | null;
}

export interface CrawlLogRecord {
  id?: number;
  crawl_type: string;
  status: string;
  posts_crawled: number;
  users_crawled: number;
  posts_success: number;
  users_success: number;
  errors?: Array<{ url: string; error: string }> | null;
  duration?: number | null;
  started_at: string;
  finished_at?: string | null;
  created_at?: string;
}

/**
 * 数据存储服务
 */
export class StorageService {
  private client = getSupabaseClient();

  // ==================== 帖子操作 ====================

  /**
   * 保存单个帖子
   */
  async savePost(post: Partial<PostRecord> & { id: string; title: string; crawled_at: string }): Promise<{ success: boolean; data?: PostRecord; error?: string }> {
    const { data, error } = await this.client
      .from('posts')
      .upsert(post, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data };
  }

  /**
   * 批量保存帖子
   */
  async savePosts(posts: Array<Partial<PostRecord> & { id: string; title: string; crawled_at: string }>): Promise<{ success: number; failed: number; errors: string[] }> {
    if (posts.length === 0) {
      return { success: 0, failed: 0, errors: [] };
    }

    const { data, error } = await this.client
      .from('posts')
      .upsert(posts, { onConflict: 'id' })
      .select();

    if (error) {
      return { success: 0, failed: posts.length, errors: [error.message] };
    }
    
    return { 
      success: data?.length || 0, 
      failed: posts.length - (data?.length || 0), 
      errors: [] 
    };
  }

  /**
   * 获取帖子列表
   */
  async getPosts(options: {
    limit?: number;
    offset?: number;
    category?: string;
    orderBy?: 'likes' | 'comments' | 'published_at' | 'crawled_at';
    ascending?: boolean;
  } = {}): Promise<PostRecord[]> {
    const { limit = 20, offset = 0, category, orderBy = 'crawled_at', ascending = false } = options;

    let query = this.client
      .from('posts')
      .select('*')
      .range(offset, offset + limit - 1)
      .order(orderBy, { ascending });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[StorageService] Error fetching posts:', error.message);
      return [];
    }

    return data || [];
  }

  /**
   * 获取热门帖子
   */
  async getHotPosts(limit: number = 10): Promise<PostRecord[]> {
    const { data, error } = await this.client
      .from('posts')
      .select('*')
      .order('likes', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[StorageService] Error fetching hot posts:', error.message);
      return [];
    }

    return data || [];
  }

  /**
   * 获取帖子总数
   */
  async getPostsCount(): Promise<number> {
    const { count, error } = await this.client
      .from('posts')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('[StorageService] Error counting posts:', error.message);
      return 0;
    }

    return count || 0;
  }

  // ==================== 用户操作 ====================

  /**
   * 保存单个用户
   */
  async saveUser(user: Partial<UserRecord> & { username: string; crawled_at: string }): Promise<{ success: boolean; data?: UserRecord; error?: string }> {
    const { data, error } = await this.client
      .from('users')
      .upsert(user, { onConflict: 'username' })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data };
  }

  /**
   * 批量保存用户
   */
  async saveUsers(users: Array<Partial<UserRecord> & { username: string; crawled_at: string }>): Promise<{ success: number; failed: number; errors: string[] }> {
    if (users.length === 0) {
      return { success: 0, failed: 0, errors: [] };
    }

    const { data, error } = await this.client
      .from('users')
      .upsert(users, { onConflict: 'username' })
      .select();

    if (error) {
      return { success: 0, failed: users.length, errors: [error.message] };
    }

    return { 
      success: data?.length || 0, 
      failed: users.length - (data?.length || 0), 
      errors: [] 
    };
  }

  /**
   * 获取用户列表
   */
  async getUsers(options: {
    limit?: number;
    offset?: number;
    orderBy?: 'points' | 'posts_count' | 'followers_count' | 'crawled_at';
    ascending?: boolean;
  } = {}): Promise<UserRecord[]> {
    const { limit = 20, offset = 0, orderBy = 'crawled_at', ascending = false } = options;

    const { data, error } = await this.client
      .from('users')
      .select('*')
      .range(offset, offset + limit - 1)
      .order(orderBy, { ascending });

    if (error) {
      console.error('[StorageService] Error fetching users:', error.message);
      return [];
    }

    return data || [];
  }

  /**
   * 获取活跃用户（按帖子数排序）
   */
  async getActiveUsers(limit: number = 10): Promise<UserRecord[]> {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .order('posts_count', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[StorageService] Error fetching active users:', error.message);
      return [];
    }

    return data || [];
  }

  /**
   * 获取用户总数
   */
  async getUsersCount(): Promise<number> {
    const { count, error } = await this.client
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('[StorageService] Error counting users:', error.message);
      return 0;
    }

    return count || 0;
  }

  // ==================== 采集日志操作 ====================

  /**
   * 创建采集日志
   */
  async createCrawlLog(log: Partial<CrawlLogRecord> & { crawl_type: string; status: string; started_at: string }): Promise<number | null> {
    const { data, error } = await this.client
      .from('crawl_logs')
      .insert(log)
      .select('id')
      .single();

    if (error) {
      console.error('[StorageService] Error creating crawl log:', error.message);
      return null;
    }

    return data?.id || null;
  }

  /**
   * 更新采集日志
   */
  async updateCrawlLog(id: number, updates: Partial<CrawlLogRecord>): Promise<boolean> {
    const { error } = await this.client
      .from('crawl_logs')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('[StorageService] Error updating crawl log:', error.message);
      return false;
    }

    return true;
  }

  /**
   * 获取最近的采集日志
   */
  async getRecentCrawlLogs(limit: number = 10): Promise<CrawlLogRecord[]> {
    const { data, error } = await this.client
      .from('crawl_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[StorageService] Error fetching crawl logs:', error.message);
      return [];
    }

    return data || [];
  }

  // ==================== 统计操作 ====================

  /**
   * 获取统计数据
   */
  async getStats(): Promise<{
    totalPosts: number;
    totalUsers: number;
    totalLikes: number;
    totalComments: number;
    avgLikesPerPost: number;
    lastCrawlAt: string | null;
  }> {
    // 并行获取各项统计数据
    const [postsCount, usersCount, posts] = await Promise.all([
      this.getPostsCount(),
      this.getUsersCount(),
      this.client.from('posts').select('likes, comments'),
    ]);

    const totalLikes = posts.data?.reduce((sum, p) => sum + (p.likes || 0), 0) || 0;
    const totalComments = posts.data?.reduce((sum, p) => sum + (p.comments || 0), 0) || 0;
    const avgLikesPerPost = postsCount > 0 ? Math.round(totalLikes / postsCount) : 0;

    // 获取最后采集时间
    const { data: lastLog } = await this.client
      .from('crawl_logs')
      .select('finished_at')
      .eq('status', 'completed')
      .order('finished_at', { ascending: false })
      .limit(1)
      .single();

    return {
      totalPosts: postsCount,
      totalUsers: usersCount,
      totalLikes,
      totalComments,
      avgLikesPerPost,
      lastCrawlAt: lastLog?.finished_at || null,
    };
  }

  // ==================== 批量操作 ====================

  /**
   * 保存采集结果
   */
  async saveCrawlResult(result: BatchCrawlResult): Promise<{
    postsSaved: number;
    usersSaved: number;
    errors: string[];
  }> {
    const errors: string[] = [];

    // 转换帖子数据（使用 snake_case 字段名）
    const postsData = result.posts.data.map(post => ({
      id: post.id,
      title: post.title,
      content: post.content,
      author_name: post.author,
      author_url: post.authorUrl,
      likes: post.likes,
      comments: post.comments,
      category: post.category,
      published_at: post.publishedAt?.toISOString(),
      crawled_at: post.crawledAt.toISOString(),
    }));

    // 转换用户数据（使用 snake_case 字段名）
    const usersData = result.users.data.map(user => ({
      username: user.username,
      bio: user.bio,
      points: user.points,
      posts_count: user.posts,
      comments_count: user.comments,
      likes_count: user.likes,
      followers_count: user.followers,
      following_count: user.following,
      joined_at: user.joinedAt?.toISOString(),
      crawled_at: user.crawledAt.toISOString(),
    }));

    // 并行保存
    const [postsResult, usersResult] = await Promise.all([
      this.savePosts(postsData),
      this.saveUsers(usersData),
    ]);

    if (postsResult.errors.length > 0) {
      errors.push(...postsResult.errors);
    }
    if (usersResult.errors.length > 0) {
      errors.push(...usersResult.errors);
    }

    return {
      postsSaved: postsResult.success,
      usersSaved: usersResult.success,
      errors,
    };
  }
}

// 导出单例
let storageService: StorageService | null = null;

export function getStorageService(): StorageService {
  if (!storageService) {
    storageService = new StorageService();
  }
  return storageService;
}
