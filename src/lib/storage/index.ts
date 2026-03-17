/**
 * InStreet 数据存储服务
 * 使用 Supabase 进行数据持久化
 * 
 * 注意：如果 Supabase 未配置，将使用空数据模式
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
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

// 检查 Supabase 是否可用
function isSupabaseAvailable(): boolean {
  return !!(process.env.COZE_SUPABASE_URL && process.env.COZE_SUPABASE_ANON_KEY);
}

// 创建 Supabase 客户端
function createSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseAvailable()) {
    return null;
  }
  
  return createClient(
    process.env.COZE_SUPABASE_URL!,
    process.env.COZE_SUPABASE_ANON_KEY!,
    {
      db: { timeout: 60000 },
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}

/**
 * 数据存储服务
 * 如果 Supabase 未配置，返回空数据
 */
export class StorageService {
  private client: SupabaseClient | null;
  private available: boolean;

  constructor() {
    this.available = isSupabaseAvailable();
    this.client = this.available ? createSupabaseClient() : null;
    
    if (!this.available) {
      console.log('[StorageService] Supabase not configured, running in no-database mode');
    }
  }

  // ==================== 帖子操作 ====================

  async savePost(post: Partial<PostRecord> & { id: string; title: string; crawled_at: string }): Promise<{ success: boolean; data?: PostRecord; error?: string }> {
    if (!this.client) {
      return { success: true };
    }
    
    const { data, error } = await this.client
      .from('posts')
      .upsert(post, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data: data as PostRecord };
  }

  async savePosts(posts: Array<Partial<PostRecord> & { id: string; title: string; crawled_at: string }>): Promise<{ success: number; failed: number; errors: string[] }> {
    if (!this.client) {
      return { success: posts.length, failed: 0, errors: [] };
    }
    
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

  async getPosts(options: {
    limit?: number;
    offset?: number;
    category?: string;
    orderBy?: 'likes' | 'comments' | 'published_at' | 'crawled_at';
    ascending?: boolean;
  } = {}): Promise<PostRecord[]> {
    if (!this.client) {
      return [];
    }
    
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

    return (data as PostRecord[]) || [];
  }

  async getHotPosts(limit: number = 10): Promise<PostRecord[]> {
    if (!this.client) {
      return [];
    }
    
    const { data, error } = await this.client
      .from('posts')
      .select('*')
      .order('likes', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[StorageService] Error fetching hot posts:', error.message);
      return [];
    }

    return (data as PostRecord[]) || [];
  }

  async getPostsCount(): Promise<number> {
    if (!this.client) {
      return 0;
    }
    
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

  async saveUser(user: Partial<UserRecord> & { username: string; crawled_at: string }): Promise<{ success: boolean; data?: UserRecord; error?: string }> {
    if (!this.client) {
      return { success: true };
    }
    
    const { data, error } = await this.client
      .from('users')
      .upsert(user, { onConflict: 'username' })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data: data as UserRecord };
  }

  async saveUsers(users: Array<Partial<UserRecord> & { username: string; crawled_at: string }>): Promise<{ success: number; failed: number; errors: string[] }> {
    if (!this.client) {
      return { success: users.length, failed: 0, errors: [] };
    }
    
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

  async getUsers(options: {
    limit?: number;
    offset?: number;
    orderBy?: 'points' | 'posts_count' | 'followers_count' | 'crawled_at';
    ascending?: boolean;
  } = {}): Promise<UserRecord[]> {
    if (!this.client) {
      return [];
    }
    
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

    return (data as UserRecord[]) || [];
  }

  async getActiveUsers(limit: number = 10): Promise<UserRecord[]> {
    if (!this.client) {
      return [];
    }
    
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .order('posts_count', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[StorageService] Error fetching active users:', error.message);
      return [];
    }

    return (data as UserRecord[]) || [];
  }

  async getUsersCount(): Promise<number> {
    if (!this.client) {
      return 0;
    }
    
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

  async createCrawlLog(log: Partial<CrawlLogRecord> & { crawl_type: string; status: string; started_at: string }): Promise<number | null> {
    if (!this.client) {
      return null;
    }
    
    const { data, error } = await this.client
      .from('crawl_logs')
      .insert(log)
      .select('id')
      .single();

    if (error) {
      console.error('[StorageService] Error creating crawl log:', error.message);
      return null;
    }

    return (data as { id: number })?.id || null;
  }

  async updateCrawlLog(id: number, updates: Partial<CrawlLogRecord>): Promise<boolean> {
    if (!this.client) {
      return true;
    }
    
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

  async getRecentCrawlLogs(limit: number = 10): Promise<CrawlLogRecord[]> {
    if (!this.client) {
      return [];
    }
    
    const { data, error } = await this.client
      .from('crawl_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[StorageService] Error fetching crawl logs:', error.message);
      return [];
    }

    return (data as CrawlLogRecord[]) || [];
  }

  // ==================== 统计操作 ====================

  async getStats(): Promise<{
    totalPosts: number;
    totalUsers: number;
    totalLikes: number;
    totalComments: number;
    avgLikesPerPost: number;
    lastCrawlAt: string | null;
  }> {
    if (!this.client) {
      return {
        totalPosts: 0,
        totalUsers: 0,
        totalLikes: 0,
        totalComments: 0,
        avgLikesPerPost: 0,
        lastCrawlAt: null,
      };
    }
    
    const [postsCount, usersCount, postsResult] = await Promise.all([
      this.getPostsCount(),
      this.getUsersCount(),
      this.client.from('posts').select('likes, comments'),
    ]);

    const posts = postsResult.data as Array<{ likes: number; comments: number }> | null;
    const totalLikes = posts?.reduce((sum, p) => sum + (p.likes || 0), 0) || 0;
    const totalComments = posts?.reduce((sum, p) => sum + (p.comments || 0), 0) || 0;
    const avgLikesPerPost = postsCount > 0 ? Math.round(totalLikes / postsCount) : 0;

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
      lastCrawlAt: (lastLog as { finished_at: string | null } | null)?.finished_at || null,
    };
  }

  // ==================== 批量操作 ====================

  async saveCrawlResult(result: BatchCrawlResult): Promise<{
    postsSaved: number;
    usersSaved: number;
    errors: string[];
  }> {
    if (!this.client) {
      return {
        postsSaved: result.posts.data.length,
        usersSaved: result.users.data.length,
        errors: [],
      };
    }
    
    const errors: string[] = [];

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
