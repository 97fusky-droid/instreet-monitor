/**
 * InStreet 数据查询 API
 * GET /api/posts - 查询帖子列表
 * GET /api/users - 查询用户列表
 * GET /api/stats - 获取统计数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStorageService } from '@/lib/storage';

/**
 * GET /api/posts - 查询帖子列表
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const category = searchParams.get('category') || undefined;
  const orderBy = (searchParams.get('orderBy') || 'crawled_at') as 'likes' | 'comments' | 'published_at' | 'crawled_at';
  const ascending = searchParams.get('ascending') === 'true';
  const hot = searchParams.get('hot') === 'true';

  try {
    const storage = getStorageService();

    // 热门帖子
    if (hot) {
      const posts = await storage.getHotPosts(limit);
      return NextResponse.json({
        success: true,
        data: posts,
        total: posts.length,
      });
    }

    // 普通查询
    const posts = await storage.getPosts({
      limit,
      offset,
      category,
      orderBy,
      ascending,
    });

    const total = await storage.getPostsCount();

    return NextResponse.json({
      success: true,
      data: posts,
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
    });
  } catch (error) {
    console.error('[Posts API Error]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
