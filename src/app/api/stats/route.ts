/**
 * InStreet 统计数据 API
 * GET /api/stats - 获取统计数据
 */

import { NextResponse } from 'next/server';
import { getStorageService } from '@/lib/storage';

/**
 * GET /api/stats - 获取统计数据
 */
export async function GET() {
  try {
    const storage = getStorageService();
    const stats = await storage.getStats();
    
    // 获取热门帖子
    const hotPosts = await storage.getHotPosts(5);
    
    // 获取活跃用户
    const activeUsers = await storage.getActiveUsers(5);

    return NextResponse.json({
      success: true,
      data: {
        overview: stats,
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
