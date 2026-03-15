/**
 * InStreet 数据采集 API
 * POST /api/crawl - 执行数据采集
 */

import { NextRequest, NextResponse } from 'next/server';
import { InStreetCrawler } from '@/lib/scraper';
import type { BatchCrawlResult } from '@/types/instreet';

/**
 * 采集请求参数
 */
interface CrawlRequest {
  type: 'full' | 'posts' | 'users' | 'home';  // 采集类型
  maxPosts?: number;   // 最大帖子数
  maxUsers?: number;   // 最大用户数
  url?: string;        // 单个URL（用于测试）
}

/**
 * 采集响应
 */
interface CrawlResponse {
  success: boolean;
  message: string;
  data?: BatchCrawlResult | object;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<CrawlResponse>> {
  try {
    const body: CrawlRequest = await request.json();
    const { type = 'full', maxPosts = 10, maxUsers = 5, url } = body;

    // 创建采集器，转发请求头
    const crawler = InStreetCrawler.fromRequest(request.headers);

    // 根据类型执行不同的采集任务
    switch (type) {
      case 'home': {
        // 仅采集首页
        const homeResult = await crawler.crawlHomePage();
        return NextResponse.json({
          success: true,
          message: '首页数据采集成功',
          data: homeResult,
        });
      }

      case 'posts': {
        // 仅采集帖子
        const result = await crawler.crawlPosts({ maxPosts });
        return NextResponse.json({
          success: true,
          message: `帖子采集完成：成功 ${result.success}/${result.total}`,
          data: result,
        });
      }

      case 'users': {
        // 仅采集用户
        const result = await crawler.crawlUsers({ maxUsers });
        return NextResponse.json({
          success: true,
          message: `用户采集完成：成功 ${result.success}/${result.total}`,
          data: result,
        });
      }

      case 'full': {
        // 完整采集
        const result = await crawler.crawlBatch({
          maxPosts,
          maxUsers,
        });
        return NextResponse.json({
          success: true,
          message: `采集完成：帖子 ${result.posts.success}/${result.posts.total}，用户 ${result.users.success}/${result.users.total}，耗时 ${(result.duration / 1000).toFixed(2)}s`,
          data: result,
        });
      }

      default:
        return NextResponse.json(
          { success: false, message: '无效的采集类型', error: 'Invalid crawl type' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Crawl API Error]', error);
    return NextResponse.json(
      {
        success: false,
        message: '采集失败',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/crawl - 获取采集状态或测试单个URL
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const testUrl = searchParams.get('test');

  // 测试模式：测试单个URL
  if (testUrl) {
    try {
      const crawler = InStreetCrawler.fromRequest(request.headers);
      
      if (testUrl.includes('/post/')) {
        const result = await crawler.crawlPost(testUrl);
        return NextResponse.json({
          success: result.success,
          data: result.post,
          error: result.error,
        });
      }
      
      if (testUrl.includes('/u/')) {
        const result = await crawler.crawlUser(testUrl);
        return NextResponse.json({
          success: result.success,
          data: result.user,
          error: result.error,
        });
      }

      return NextResponse.json(
        { success: false, error: 'URL 类型无法识别' },
        { status: 400 }
      );
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  }

  // 返回采集能力信息
  return NextResponse.json({
    success: true,
    message: 'InStreet 数据采集 API',
    capabilities: {
      types: ['full', 'posts', 'users', 'home'],
      description: {
        full: '完整采集（首页 + 帖子详情 + 用户详情）',
        posts: '仅采集帖子详情',
        users: '仅采集用户详情',
        home: '仅采集首页列表数据',
      },
    },
    example: {
      method: 'POST',
      body: {
        type: 'full',
        maxPosts: 10,
        maxUsers: 5,
      },
    },
  });
}
