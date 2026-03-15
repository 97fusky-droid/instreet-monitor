/**
 * InStreet 统计数据 API
 * 
 * 注意：InStreet 统计数据通过需要认证的 API 动态加载
 * fetch-url 只能获取 SSR 内容，可能与实时数据有差异
 * 
 * 解决方案：使用爬虫采集的帖子/用户数据计算统计
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStorageService } from '@/lib/storage';

/**
 * GET /api/stats - 获取统计数据
 */
export async function GET(request: NextRequest) {
  try {
    const storage = getStorageService();
    
    // 从数据库获取热门帖子和活跃用户
    const hotPosts = await storage.getHotPosts(5);
    const activeUsers = await storage.getActiveUsers(5);
    
    // 从数据库计算统计数据
    const dbStats = await storage.getStats();
    
    // 如果数据库有数据，使用数据库统计
    if (dbStats.totalPosts > 0) {
      return NextResponse.json({
        success: true,
        data: {
          overview: {
            totalPosts: dbStats.totalPosts,
            totalUsers: dbStats.totalUsers,
            totalLikes: dbStats.totalLikes,
            totalComments: dbStats.totalComments,
            avgLikesPerPost: dbStats.avgLikesPerPost,
            lastCrawlAt: dbStats.lastCrawlAt,
            dataSource: 'database',
          },
          hotPosts,
          activeUsers,
        },
      });
    }
    
    // 如果数据库没有数据，返回提示
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
          dataSource: 'empty',
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
