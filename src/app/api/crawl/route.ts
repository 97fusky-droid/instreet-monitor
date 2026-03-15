/**
 * InStreet 数据采集 API
 * POST /api/crawl - 执行数据采集
 */

import { NextRequest, NextResponse } from 'next/server';
import { InStreetCrawler } from '@/lib/scraper';
import { getStorageService } from '@/lib/storage';
import type { BatchCrawlResult } from '@/types/instreet';

/**
 * 采集请求参数
 */
interface CrawlRequest {
  type: 'full' | 'posts' | 'users' | 'home';  // 采集类型
  maxPosts?: number;   // 最大帖子数
  maxUsers?: number;   // 最大用户数
  save?: boolean;      // 是否保存到数据库
}

/**
 * 采集响应
 */
interface CrawlResponse {
  success: boolean;
  message: string;
  data?: BatchCrawlResult | object;
  storage?: {
    postsSaved: number;
    usersSaved: number;
    errors: string[];
  };
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<CrawlResponse>> {
  try {
    const body: CrawlRequest = await request.json();
    const { type = 'full', maxPosts = 10, maxUsers = 5, save = false } = body;

    // 创建采集器，转发请求头
    const crawler = InStreetCrawler.fromRequest(request.headers);
    const storage = save ? getStorageService() : null;

    // 创建采集日志（如果需要保存）
    let crawlLogId: number | null = null;
    if (storage) {
      crawlLogId = await storage.createCrawlLog({
        crawl_type: type,
        status: 'running',
        posts_crawled: 0,
        users_crawled: 0,
        posts_success: 0,
        users_success: 0,
        started_at: new Date().toISOString(),
      });
    }

    const startTime = Date.now();
    let result: BatchCrawlResult | null = null;
    let message = '';

    try {
      // 根据类型执行不同的采集任务
      switch (type) {
        case 'home': {
          // 仅采集首页（不保存）
          const homeResult = await crawler.crawlHomePage();
          return NextResponse.json({
            success: true,
            message: '首页数据采集成功',
            data: homeResult,
          });
        }

        case 'posts': {
          // 仅采集帖子
          const postsResult = await crawler.crawlPosts({ maxPosts });
          
          result = {
            posts: postsResult,
            users: { total: 0, success: 0, failed: 0, data: [], errors: [] },
            crawledAt: new Date(),
            duration: Date.now() - startTime,
          };
          message = `帖子采集完成：成功 ${postsResult.success}/${postsResult.total}`;
          break;
        }

        case 'users': {
          // 仅采集用户
          const usersResult = await crawler.crawlUsers({ maxUsers });
          
          result = {
            posts: { total: 0, success: 0, failed: 0, data: [], errors: [] },
            users: usersResult,
            crawledAt: new Date(),
            duration: Date.now() - startTime,
          };
          message = `用户采集完成：成功 ${usersResult.success}/${usersResult.total}`;
          break;
        }

        case 'full': {
          // 完整采集
          result = await crawler.crawlBatch({
            maxPosts,
            maxUsers,
          });
          message = `采集完成：帖子 ${result.posts.success}/${result.posts.total}，用户 ${result.users.success}/${result.users.total}，耗时 ${(result.duration / 1000).toFixed(2)}s`;
          break;
        }

        default:
          return NextResponse.json(
            { success: false, message: '无效的采集类型', error: 'Invalid crawl type' },
            { status: 400 }
          );
      }

      // 保存数据到数据库
      let storageResult = { postsSaved: 0, usersSaved: 0, errors: [] as string[] };
      
      if (storage && result) {
        storageResult = await storage.saveCrawlResult(result);
        message += `，已保存帖子 ${storageResult.postsSaved}，用户 ${storageResult.usersSaved}`;
      }

      // 更新采集日志
      if (storage && crawlLogId && result) {
        await storage.updateCrawlLog(crawlLogId, {
          status: 'completed',
          posts_crawled: result.posts.total,
          users_crawled: result.users.total,
          posts_success: result.posts.success,
          users_success: result.users.success,
          errors: [...result.posts.errors, ...result.users.errors],
          duration: result.duration,
          finished_at: new Date().toISOString(),
        });
      }

      return NextResponse.json({
        success: true,
        message,
        data: result,
        storage: save ? storageResult : undefined,
      });

    } catch (crawlError) {
      // 更新采集日志为失败状态
      if (storage && crawlLogId) {
        await storage.updateCrawlLog(crawlLogId, {
          status: 'failed',
          errors: [{ url: '', error: crawlError instanceof Error ? crawlError.message : 'Unknown error' }],
          finished_at: new Date().toISOString(),
        });
      }
      throw crawlError;
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
  const testUrl = searchParams.get('test');
  const stats = searchParams.get('stats');

  // 获取统计数据
  if (stats === 'true') {
    try {
      const storage = getStorageService();
      const statsData = await storage.getStats();
      return NextResponse.json({
        success: true,
        data: statsData,
      });
    } catch (error) {
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  }

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
        save: true,
      },
    },
  });
}
