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
    
    // 先尝试从数据库获取热门数据（如果采集过的话）
    const dbHotPosts = await storage.getHotPosts(10);
    const dbActiveUsers = await storage.getActiveUsers(10);
    
    // 如果数据库有数据，直接使用
    if (dbHotPosts.length >= 5 && dbActiveUsers.length >= 5) {
      // 获取统计数据
      let stats = cachedData?.stats;
      
      if (!stats || forceRefresh || (Date.now() - cachedData!.cachedAt) >= CACHE_TTL) {
        try {
          const crawler = InStreetCrawler.fromRequest(request.headers);
          const homeResult = await crawler.crawlHomePage();
          if (homeResult.stats && homeResult.stats.totalAgents > 0) {
            stats = homeResult.stats;
            cachedData = {
              stats,
              hotPosts: cachedData?.hotPosts || [],
              activeUsers: cachedData?.activeUsers || [],
              cachedAt: Date.now(),
            };
          }
        } catch (e) {
          console.warn('[Stats API] Failed to fetch homepage stats:', e);
        }
      }
      
      // 使用数据库数据
      const finalHotPosts = dbHotPosts.map(p => ({
        id: p.id,
        title: p.title,
        author: p.author_name || 'Unknown',
        likes: p.likes,
        comments: p.comments,
      }));
      
      const finalActiveUsers = dbActiveUsers.map(u => ({
        username: u.username,
        posts: u.posts_count,
        followers: u.followers_count,
      }));
      
      return NextResponse.json({
        success: true,
        data: {
          overview: {
            totalPosts: stats?.totalPosts || 0,
            totalUsers: stats?.totalAgents || 0,
            totalLikes: stats?.totalLikes || 0,
            totalComments: stats?.totalComments || 0,
            avgLikesPerPost: stats && stats.totalPosts > 0 
              ? Math.round(stats.totalLikes / stats.totalPosts) 
              : 0,
            lastCrawlAt: new Date().toISOString(),
            dataSource: stats ? 'database+homepage' : 'database',
          },
          hotPosts: finalHotPosts.slice(0, 5),
          activeUsers: finalActiveUsers.slice(0, 5),
        },
      });
    }
    
    // 数据库没有数据，从首页实时爬取
    const shouldFetch = forceRefresh || !cachedData || (Date.now() - cachedData.cachedAt) >= CACHE_TTL;
    
    if (shouldFetch) {
      try {
        const crawler = InStreetCrawler.fromRequest(request.headers);
        const homeResult = await crawler.crawlHomePage();
        
        if (homeResult.stats && homeResult.stats.totalAgents > 0) {
          // 爬取更多帖子详情（前10个），然后按点赞排序
          const allPosts: Array<{
            id: string;
            title: string;
            author: string;
            likes: number;
            comments: number;
          }> = [];
          
          const postsToFetch = homeResult.posts.slice(0, 10);
          for (const postItem of postsToFetch) {
            try {
              const postResult = await crawler.crawlPost(postItem.url);
              if (postResult.success && postResult.post) {
                allPosts.push({
                  id: postResult.post.id,
                  title: postResult.post.title,
                  author: postResult.post.author,
                  likes: postResult.post.likes,
                  comments: postResult.post.comments,
                });
              }
            } catch (e) {
              console.warn('[Stats API] Failed to fetch post:', postItem.url);
            }
          }
          
          // 按点赞数排序，取前5个作为热门帖子
          const hotPosts = allPosts
            .sort((a, b) => b.likes - a.likes)
            .slice(0, 5);
          
          // 爬取更多用户详情（前10个），然后按帖子数排序
          const allUsers: Array<{
            username: string;
            posts: number;
            followers: number;
          }> = [];
          
          const usersToFetch = homeResult.users.slice(0, 10);
          for (const userItem of usersToFetch) {
            try {
              const userResult = await crawler.crawlUser(userItem.url);
              if (userResult.success && userResult.user) {
                allUsers.push({
                  username: userResult.user.username,
                  posts: userResult.user.posts,
                  followers: userResult.user.followers,
                });
              }
            } catch (e) {
              console.warn('[Stats API] Failed to fetch user:', userItem.url);
            }
          }
          
          // 按帖子数排序，取前5个作为活跃用户
          const activeUsers = allUsers
            .sort((a, b) => b.posts - a.posts)
            .slice(0, 5);
          
          cachedData = {
            stats: homeResult.stats,
            hotPosts,
            activeUsers,
            cachedAt: Date.now(),
          };
          
          console.log('[Stats API] Fresh data from homepage:', {
            stats: homeResult.stats,
            hotPostsCount: hotPosts.length,
            activeUsersCount: activeUsers.length,
          });
        }
      } catch (error) {
        console.warn('[Stats API] Failed to fetch from homepage:', error);
      }
    }
    
    // 返回缓存数据
    if (cachedData) {
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
          hotPosts: cachedData.hotPosts,
          activeUsers: cachedData.activeUsers,
        },
      });
    }
    
    // 完全没有数据
    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalPosts: 0,
          totalUsers: 0,
          totalLikes: 0,
          totalComments: 0,
          avgLikesPerPost: 0,
          lastCrawlAt: null,
          dataSource: 'none',
        },
        hotPosts: [],
        activeUsers: [],
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
