/**
 * InStreet 统计数据 API
 * GET /api/stats - 获取统计数据（从首页实时获取）
 */

import { NextRequest, NextResponse } from 'next/server';
import { InStreetCrawler } from '@/lib/scraper/crawler';
import { getStorageService } from '@/lib/storage';

// 缓存首页统计数据，避免频繁请求
let cachedData: {
  stats: {
    totalAgents: number;
    totalPosts: number;
    totalComments: number;
    totalLikes: number;
  };
  hotPosts: Array<{
    id: string;
    title: string;
    author: string;
    likes: number;
    comments: number;
  }>;
  activeUsers: Array<{
    username: string;
    posts: number;
    followers: number;
  }>;
  cachedAt: number;
} | null = null;

const CACHE_TTL = 60 * 1000; // 60秒缓存

/**
 * GET /api/stats - 获取统计数据
 * 优先从首页获取实时数据，如果失败则从数据库获取
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === '1';
    
    const storage = getStorageService();
    
    // 检查缓存是否有效
    const shouldFetch = forceRefresh || !cachedData || (Date.now() - cachedData.cachedAt) >= CACHE_TTL;
    
    if (shouldFetch) {
      try {
        // 获取首页数据
        const crawler = InStreetCrawler.fromRequest(request.headers);
        const homeResult = await crawler.crawlHomePage();
        
        if (homeResult.stats && homeResult.stats.totalAgents > 0) {
          // 爬取热门帖子详情（前5个）
          const hotPosts: Array<{
            id: string;
            title: string;
            author: string;
            likes: number;
            comments: number;
          }> = [];
          
          const postsToFetch = homeResult.posts.slice(0, 5);
          for (const postItem of postsToFetch) {
            try {
              const postResult = await crawler.crawlPost(postItem.url);
              if (postResult.success && postResult.post) {
                hotPosts.push({
                  id: postResult.post.id,
                  title: postResult.post.title,
                  author: postResult.post.author,
                  likes: postResult.post.likes,
                  comments: postResult.post.comments,
                });
              }
            } catch (e) {
              console.warn('[Stats API] Failed to fetch post:', postItem.url, e);
            }
          }
          
          // 爬取活跃用户详情（前5个）
          const activeUsers: Array<{
            username: string;
            posts: number;
            followers: number;
          }> = [];
          
          const usersToFetch = homeResult.users.slice(0, 5);
          for (const userItem of usersToFetch) {
            try {
              const userResult = await crawler.crawlUser(userItem.url);
              if (userResult.success && userResult.user) {
                activeUsers.push({
                  username: userResult.user.username,
                  posts: userResult.user.posts,
                  followers: userResult.user.followers,
                });
              }
            } catch (e) {
              console.warn('[Stats API] Failed to fetch user:', userItem.url, e);
            }
          }
          
          cachedData = {
            stats: homeResult.stats,
            hotPosts,
            activeUsers,
            cachedAt: Date.now(),
          };
          
          console.log('[Stats API] Fresh data from homepage:', cachedData);
        }
      } catch (error) {
        console.warn('[Stats API] Failed to fetch from homepage:', error);
      }
    }
    
    // 如果有缓存数据，直接返回
    if (cachedData) {
      // 尝试从数据库获取更多数据
      const dbHotPosts = await storage.getHotPosts(10);
      const dbActiveUsers = await storage.getActiveUsers(10);
      
      // 合并数据：优先使用爬取的数据，补充数据库数据
      const finalHotPosts = cachedData.hotPosts.length > 0 
        ? cachedData.hotPosts 
        : dbHotPosts.map(p => ({
            id: p.id,
            title: p.title,
            author: p.author_name || 'Unknown',
            likes: p.likes,
            comments: p.comments,
          }));
      
      const finalActiveUsers = cachedData.activeUsers.length > 0
        ? cachedData.activeUsers
        : dbActiveUsers.map(u => ({
            username: u.username,
            posts: u.posts_count,
            followers: u.followers_count,
          }));
      
      return NextResponse.json({
        success: true,
        data: {
          overview: {
            totalPosts: cachedData.stats.totalPosts,
            totalUsers: cachedData.stats.totalAgents,
            totalLikes: cachedData.stats.totalLikes,
            totalComments: cachedData.stats.totalComments,
            avgLikesPerPost: cachedData.stats.totalPosts > 0 
              ? Math.round(cachedData.stats.totalLikes / cachedData.stats.totalPosts) 
              : 0,
            lastCrawlAt: new Date().toISOString(),
            dataSource: 'homepage',
          },
          hotPosts: finalHotPosts.slice(0, 5),
          activeUsers: finalActiveUsers.slice(0, 5),
        },
      });
    }
    
    // 如果首页获取失败，回退到数据库统计
    const stats = await storage.getStats();
    const hotPosts = await storage.getHotPosts(5);
    const activeUsers = await storage.getActiveUsers(5);

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          ...stats,
          dataSource: 'database',
        },
        hotPosts: hotPosts.map(p => ({
          id: p.id,
          title: p.title,
          author: p.author_name || 'Unknown',
          likes: p.likes,
          comments: p.comments,
        })),
        activeUsers: activeUsers.map(u => ({
          username: u.username,
          posts: u.posts_count,
          followers: u.followers_count,
        })),
      },
    });
  } catch (error) {
    console.error('[Stats API Error]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
