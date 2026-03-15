/**
 * Dashboard 数据获取 Hook
 * 使用 SWR 进行数据获取、缓存和自动刷新
 */

'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import type { PostRecord, UserRecord } from '@/lib/storage';

// ==================== 类型定义 ====================

export interface StatsOverview {
  totalPosts: number;
  totalUsers: number;
  totalLikes: number;
  totalComments: number;
  avgLikesPerPost: number;
  lastCrawlAt: string | null;
}

export interface StatsResponse {
  success: boolean;
  data: {
    overview: StatsOverview;
    hotPosts: PostRecord[];
    activeUsers: UserRecord[];
  };
}

export interface PostsResponse {
  success: boolean;
  data: PostRecord[];
  total: number;
}

export interface UsersResponse {
  success: boolean;
  data: UserRecord[];
  total: number;
}

export interface CrawlResponse {
  success: boolean;
  message: string;
  data?: {
    posts: { success: number; total: number };
    users: { success: number; total: number };
    duration: number;
  };
  storage?: {
    postsSaved: number;
    usersSaved: number;
  };
}

// ==================== Fetcher ====================

const fetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'API request failed');
  }
  return data;
};

const postFetcher = async <T>(url: string, body: object): Promise<T> => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'API request failed');
  }
  return data;
};

// ==================== Main Dashboard Hook ====================

/**
 * Dashboard 数据获取 Hook
 * 整合所有数据源，提供统一的数据访问接口
 */
export function useDashboard(options?: {
  statsRefreshInterval?: number;
  listRefreshInterval?: number;
}) {
  const [isCrawling, setIsCrawling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 获取统计数据（包括热门帖子和活跃用户）
  const { 
    data: statsData, 
    error: statsError, 
    isLoading: statsLoading,
    mutate: mutateStats,
  } = useSWR<StatsResponse>(
    '/api/stats',
    fetcher,
    {
      refreshInterval: options?.statsRefreshInterval ?? 30000, // 默认30秒刷新
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  // 获取完整帖子列表
  const { 
    data: postsData, 
    error: postsError,
    isLoading: postsLoading,
    mutate: mutatePosts,
  } = useSWR<PostsResponse>(
    '/api/posts?limit=50',
    fetcher,
    {
      refreshInterval: options?.listRefreshInterval ?? 60000, // 默认60秒刷新
      revalidateOnFocus: true,
    }
  );

  // 获取完整用户列表
  const { 
    data: usersData, 
    error: usersError,
    isLoading: usersLoading,
    mutate: mutateUsers,
  } = useSWR<UsersResponse>(
    '/api/users?limit=50',
    fetcher,
    {
      refreshInterval: options?.listRefreshInterval ?? 60000,
      revalidateOnFocus: true,
    }
  );

  // 手动刷新所有数据
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        mutateStats(),
        mutatePosts(),
        mutateUsers(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [mutateStats, mutatePosts, mutateUsers]);

  // 触发数据采集
  const crawl = useCallback(async (crawlOptions?: {
    type?: 'full' | 'posts' | 'users';
    maxPosts?: number;
    maxUsers?: number;
  }) => {
    setIsCrawling(true);
    try {
      const body = {
        type: crawlOptions?.type ?? 'full',
        maxPosts: crawlOptions?.maxPosts ?? 10,
        maxUsers: crawlOptions?.maxUsers ?? 5,
        save: true,
      };
      
      const result = await postFetcher<CrawlResponse>('/api/crawl', body);
      
      // 采集完成后刷新数据
      await refresh();
      
      return result;
    } finally {
      setIsCrawling(false);
    }
  }, [refresh]);

  // 合并数据
  const stats = statsData?.data?.overview ?? null;
  const hotPosts = statsData?.data?.hotPosts ?? [];
  const activeUsers = statsData?.data?.activeUsers ?? [];
  const posts = postsData?.data ?? [];
  const users = usersData?.data ?? [];

  // 生成活动趋势数据（简化版，使用真实数据生成）
  const activity = generateActivityData(posts);

  // 计算最后更新时间
  const lastUpdateTime = stats?.lastCrawlAt 
    ? new Date(stats.lastCrawlAt).toLocaleTimeString('zh-CN')
    : null;

  // 合并错误
  const error = statsError?.message || postsError?.message || usersError?.message || null;

  return {
    // 统计数据
    stats,
    hotPosts,
    activeUsers,
    
    // 列表数据
    posts,
    users,
    activity,
    
    // 状态
    isLoading: statsLoading || postsLoading || usersLoading,
    isRefreshing,
    isCrawling,
    error,
    lastUpdateTime,
    
    // 操作
    refresh,
    crawl,
    mutate: refresh,
  };
}

/**
 * 生成活动趋势数据
 */
function generateActivityData(posts: PostRecord[]): Array<{ date: string; posts: number; users: number }> {
  // 按日期分组统计帖子
  const dateMap = new Map<string, { posts: number; authors: Set<string> }>();
  
  posts.forEach(post => {
    if (!post.published_at) return;
    
    const date = new Date(post.published_at).toISOString().split('T')[0];
    if (!dateMap.has(date)) {
      dateMap.set(date, { posts: 0, authors: new Set() });
    }
    
    const data = dateMap.get(date)!;
    data.posts++;
    if (post.author_name) {
      data.authors.add(post.author_name);
    }
  });
  
  // 转换为数组并排序（最近7天）
  const result = Array.from(dateMap.entries())
    .map(([date, data]) => ({
      date,
      posts: data.posts,
      users: data.authors.size,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7);
  
  return result;
}

// ==================== 单独的 Hook（可选使用）====================

/**
 * 仅获取统计数据
 */
export function useStats(options?: {
  refreshInterval?: number;
}) {
  const { data, error, isLoading, mutate } = useSWR<StatsResponse>(
    '/api/stats',
    fetcher,
    {
      refreshInterval: options?.refreshInterval ?? 30000,
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  return {
    stats: data?.data?.overview ?? null,
    hotPosts: data?.data?.hotPosts ?? [],
    activeUsers: data?.data?.activeUsers ?? [],
    isLoading,
    error: error?.message ?? null,
    refresh: mutate,
  };
}

/**
 * 仅获取帖子列表
 */
export function usePosts(options?: {
  limit?: number;
  hot?: boolean;
  refreshInterval?: number;
}) {
  const { limit = 20, hot = false } = options ?? {};
  const params = new URLSearchParams({
    limit: String(limit),
    ...(hot && { hot: 'true' }),
  });

  const { data, error, isLoading, mutate } = useSWR<PostsResponse>(
    `/api/posts?${params}`,
    fetcher,
    {
      refreshInterval: options?.refreshInterval ?? 60000,
      revalidateOnFocus: true,
    }
  );

  return {
    posts: data?.data ?? [],
    total: data?.total ?? 0,
    isLoading,
    error: error?.message ?? null,
    refresh: mutate,
  };
}

/**
 * 仅获取用户列表
 */
export function useUsers(options?: {
  limit?: number;
  active?: boolean;
  refreshInterval?: number;
}) {
  const { limit = 20, active = false } = options ?? {};
  const params = new URLSearchParams({
    limit: String(limit),
    ...(active && { active: 'true' }),
  });

  const { data, error, isLoading, mutate } = useSWR<UsersResponse>(
    `/api/users?${params}`,
    fetcher,
    {
      refreshInterval: options?.refreshInterval ?? 60000,
      revalidateOnFocus: true,
    }
  );

  return {
    users: data?.data ?? [],
    total: data?.total ?? 0,
    isLoading,
    error: error?.message ?? null,
    refresh: mutate,
  };
}

/**
 * 触发数据采集
 */
export function useCrawl() {
  const triggerCrawl = async (options?: {
    type?: 'full' | 'posts' | 'users';
    maxPosts?: number;
    maxUsers?: number;
  }): Promise<CrawlResponse> => {
    const body = {
      type: options?.type ?? 'full',
      maxPosts: options?.maxPosts ?? 10,
      maxUsers: options?.maxUsers ?? 5,
      save: true,
    };

    return postFetcher<CrawlResponse>('/api/crawl', body);
  };

  return { triggerCrawl };
}
