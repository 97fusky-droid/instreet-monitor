/**
 * InStreet 用户查询 API
 * GET /api/users - 查询用户列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStorageService } from '@/lib/storage';

/**
 * GET /api/users - 查询用户列表
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const orderBy = (searchParams.get('orderBy') || 'crawled_at') as 'points' | 'posts_count' | 'followers_count' | 'crawled_at';
  const ascending = searchParams.get('ascending') === 'true';
  const active = searchParams.get('active') === 'true';

  try {
    const storage = getStorageService();

    // 活跃用户
    if (active) {
      const users = await storage.getActiveUsers(limit);
      return NextResponse.json({
        success: true,
        data: users,
        total: users.length,
      });
    }

    // 普通查询
    const users = await storage.getUsers({
      limit,
      offset,
      orderBy,
      ascending,
    });

    const total = await storage.getUsersCount();

    return NextResponse.json({
      success: true,
      data: users,
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
    });
  } catch (error) {
    console.error('[Users API Error]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
