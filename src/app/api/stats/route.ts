/**
 * InStreet 统计数据 API
 * GET /api/stats - 获取统计数据（从首页实时获取）
 * 
 * 注意：由于 fetch-url 可能存在缓存，数据可能与实时数据有偏差
 */

import { NextRequest, NextResponse } from 'next/server';
import { InStreetCrawler } from '@/lib/scraper/crawler';
import { getStorageService } from '@/lib/storage';

// 缓存首页统计数据，避免频繁请求
let cachedStats: {
  totalAgents: number;
  totalPosts: number;
  totalComments: number;
  totalLikes: number;
  cachedAt: number;
} | null = null;

const CACHE_TTL = 30 * 1000; // 30秒缓存（缩短缓存时间）

/**
 * GET /api/stats - 获取统计数据
 * 优先从首页获取实时数据，如果失败则从数据库获取
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === '1';
    
    const storage = getStorageService();
    
    // 尝试从首页获取统计数据
    let homePageStats = null;
    
    // 检查缓存是否有效（缩短为30秒，且每次都尝试刷新）
    const shouldFetch = forceRefresh || !cachedStats || (Date.now() - cachedStats.cachedAt) >= CACHE_TTL;
    
    if (shouldFetch) {
      // 每次都尝试从首页获取最新数据
      try {
        const crawler = new InStreetCrawler();
        const homeResult = await crawler.crawlHomePage();
        
        if (homeResult.stats && homeResult.stats.totalAgents > 0) {
          homePageStats = {
            ...homeResult.stats,
            cachedAt: Date.now(),
          };
          cachedStats = homePageStats;
        } else if (cachedStats) {
          // 如果获取失败但有缓存，继续使用缓存
          homePageStats = cachedStats;
        }
      } catch (error) {
        console.warn('[Stats API] Failed to fetch from homepage:', error);
        // 出错时使用缓存
        if (cachedStats) {
          homePageStats = cachedStats;
        }
      }
    } else {
      homePageStats = cachedStats;
    }
    
    // 如果首页数据获取成功，使用首页统计
    if (homePageStats) {
      // 获取数据库中的热门帖子和活跃用户
      const hotPosts = await storage.getHotPosts(5);
      const activeUsers = await storage.getActiveUsers(5);
      
      return NextResponse.json({
        success: true,
        data: {
          overview: {
            totalPosts: homePageStats.totalPosts,
            totalUsers: homePageStats.totalAgents,
            totalLikes: homePageStats.totalLikes,
            totalComments: homePageStats.totalComments,
            avgLikesPerPost: homePageStats.totalPosts > 0 
              ? Math.round(homePageStats.totalLikes / homePageStats.totalPosts) 
              : 0,
            lastCrawlAt: new Date().toISOString(),
            dataSource: 'homepage',
          },
          hotPosts,
          activeUsers,
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
        hotPosts,
        activeUsers,
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
