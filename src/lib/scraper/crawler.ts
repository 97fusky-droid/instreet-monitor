/**
 * InStreet 采集服务主类
 * 整合 Fetcher 和 Parsers，提供完整的数据采集能力
 */

import { HeaderUtils } from 'coze-coding-dev-sdk';
import { Fetcher, FetcherResult } from './fetcher';
import { parseHomePage, parsePostPage, parseUserPage } from './parsers';
import type {
  Post,
  User,
  PostListItem,
  UserListItem,
  HomePageResult,
  BatchCrawlResult,
  CrawlPostResult,
  CrawlUserResult,
} from '@/types/instreet';

/**
 * 采集器配置
 */
export interface CrawlerConfig {
  baseUrl: string;
  maxPosts: number;          // 最大帖子采集数
  maxUsers: number;          // 最大用户采集数
  rateLimitDelay: number;    // 速率限制延迟
  maxRetries: number;        // 最大重试次数
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: CrawlerConfig = {
  baseUrl: 'https://instreet.coze.site',
  maxPosts: 50,
  maxUsers: 20,
  rateLimitDelay: 300,
  maxRetries: 3,
};

/**
 * 采集进度回调
 */
export type ProgressCallback = (
  phase: 'home' | 'posts' | 'users',
  current: number,
  total: number,
  message?: string
) => void;

/**
 * InStreet 采集器
 */
export class InStreetCrawler {
  private config: CrawlerConfig;
  private fetcher: Fetcher;

  constructor(
    config: Partial<CrawlerConfig> = {},
    forwardHeaders?: Record<string, string>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.fetcher = new Fetcher(
      {
        rateLimitDelay: this.config.rateLimitDelay,
        maxRetries: this.config.maxRetries,
      },
      forwardHeaders
    );
  }

  /**
   * 从请求对象创建采集器（用于 API 路由）
   */
  static fromRequest(
    headers: globalThis.Headers | Record<string, string>,
    config: Partial<CrawlerConfig> = {}
  ): InStreetCrawler {
    const forwardHeaders = HeaderUtils.extractForwardHeaders(headers);
    return new InStreetCrawler(config, forwardHeaders);
  }

  /**
   * 采集首页数据
   */
  async crawlHomePage(): Promise<HomePageResult> {
    const result = await this.fetcher.fetch(this.config.baseUrl);

    if (!result.success || !result.data) {
      throw new Error(`Failed to fetch homepage: ${result.error}`);
    }

    return parseHomePage(result.data);
  }

  /**
   * 采集单个帖子详情
   */
  async crawlPost(url: string): Promise<CrawlPostResult> {
    const fullUrl = url.startsWith('http') 
      ? url 
      : `${this.config.baseUrl}${url}`;

    const result = await this.fetcher.fetch(fullUrl);

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error,
      };
    }

    try {
      const post = parsePostPage(result.data, fullUrl);
      
      if (!post) {
        return {
          success: false,
          error: 'Failed to parse post',
        };
      }

      return {
        success: true,
        post,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 采集单个用户详情
   */
  async crawlUser(url: string): Promise<CrawlUserResult> {
    const fullUrl = url.startsWith('http')
      ? url
      : `${this.config.baseUrl}${url}`;

    const result = await this.fetcher.fetch(fullUrl);

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error,
      };
    }

    try {
      const user = parseUserPage(result.data, fullUrl);

      if (!user) {
        return {
          success: false,
          error: 'Failed to parse user',
        };
      }

      return {
        success: true,
        user,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 批量采集帖子和用户
   */
  async crawlBatch(
    options: {
      maxPosts?: number;
      maxUsers?: number;
      onProgress?: ProgressCallback;
    } = {}
  ): Promise<BatchCrawlResult> {
    const startTime = Date.now();
    const maxPosts = options.maxPosts ?? this.config.maxPosts;
    const maxUsers = options.maxUsers ?? this.config.maxUsers;

    // 1. 采集首页
    options.onProgress?.('home', 0, 1, '正在获取首页数据...');
    const homeResult = await this.crawlHomePage();
    options.onProgress?.('home', 1, 1, '首页数据获取完成');

    // 2. 采集帖子详情
    const postResults: Post[] = [];
    const postErrors: Array<{ url: string; error: string }> = [];
    const postsToCrawl = homeResult.posts.slice(0, maxPosts);

    for (let i = 0; i < postsToCrawl.length; i++) {
      const postItem = postsToCrawl[i];
      options.onProgress?.(
        'posts',
        i + 1,
        postsToCrawl.length,
        `正在采集帖子 ${i + 1}/${postsToCrawl.length}`
      );

      const result = await this.crawlPost(postItem.url);

      if (result.success && result.post) {
        postResults.push(result.post);
      } else {
        postErrors.push({
          url: postItem.url,
          error: result.error || 'Unknown error',
        });
      }
    }

    // 3. 采集用户详情
    const userResults: User[] = [];
    const userErrors: Array<{ url: string; error: string }> = [];
    const usersToCrawl = homeResult.users.slice(0, maxUsers);

    for (let i = 0; i < usersToCrawl.length; i++) {
      const userItem = usersToCrawl[i];
      options.onProgress?.(
        'users',
        i + 1,
        usersToCrawl.length,
        `正在采集用户 ${i + 1}/${usersToCrawl.length}`
      );

      const result = await this.crawlUser(userItem.url);

      if (result.success && result.user) {
        userResults.push(result.user);
      } else {
        userErrors.push({
          url: userItem.url,
          error: result.error || 'Unknown error',
        });
      }
    }

    const duration = Date.now() - startTime;

    return {
      posts: {
        total: postsToCrawl.length,
        success: postResults.length,
        failed: postErrors.length,
        data: postResults,
        errors: postErrors,
      },
      users: {
        total: usersToCrawl.length,
        success: userResults.length,
        failed: userErrors.length,
        data: userResults,
        errors: userErrors,
      },
      crawledAt: new Date(),
      duration,
    };
  }

  /**
   * 仅采集帖子
   */
  async crawlPosts(
    options: {
      maxPosts?: number;
      onProgress?: ProgressCallback;
    } = {}
  ): Promise<{
    total: number;
    success: number;
    failed: number;
    data: Post[];
    errors: Array<{ url: string; error: string }>;
  }> {
    const maxPosts = options.maxPosts ?? this.config.maxPosts;

    // 采集首页获取帖子列表
    options.onProgress?.('home', 0, 1, '正在获取首页数据...');
    const homeResult = await this.crawlHomePage();
    options.onProgress?.('home', 1, 1, '首页数据获取完成');

    // 采集帖子详情
    const posts: Post[] = [];
    const errors: Array<{ url: string; error: string }> = [];
    const postsToCrawl = homeResult.posts.slice(0, maxPosts);

    for (let i = 0; i < postsToCrawl.length; i++) {
      const postItem = postsToCrawl[i];
      options.onProgress?.(
        'posts',
        i + 1,
        postsToCrawl.length,
        `正在采集帖子 ${i + 1}/${postsToCrawl.length}`
      );

      const result = await this.crawlPost(postItem.url);

      if (result.success && result.post) {
        posts.push(result.post);
      } else {
        errors.push({
          url: postItem.url,
          error: result.error || 'Unknown error',
        });
      }
    }

    return {
      total: postsToCrawl.length,
      success: posts.length,
      failed: errors.length,
      data: posts,
      errors,
    };
  }

  /**
   * 仅采集用户
   */
  async crawlUsers(
    options: {
      maxUsers?: number;
      onProgress?: ProgressCallback;
    } = {}
  ): Promise<{
    total: number;
    success: number;
    failed: number;
    data: User[];
    errors: Array<{ url: string; error: string }>;
  }> {
    const maxUsers = options.maxUsers ?? this.config.maxUsers;

    // 采集首页获取用户列表
    options.onProgress?.('home', 0, 1, '正在获取首页数据...');
    const homeResult = await this.crawlHomePage();
    options.onProgress?.('home', 1, 1, '首页数据获取完成');

    // 采集用户详情
    const users: User[] = [];
    const errors: Array<{ url: string; error: string }> = [];
    const usersToCrawl = homeResult.users.slice(0, maxUsers);

    for (let i = 0; i < usersToCrawl.length; i++) {
      const userItem = usersToCrawl[i];
      options.onProgress?.(
        'users',
        i + 1,
        usersToCrawl.length,
        `正在采集用户 ${i + 1}/${usersToCrawl.length}`
      );

      const result = await this.crawlUser(userItem.url);

      if (result.success && result.user) {
        users.push(result.user);
      } else {
        errors.push({
          url: userItem.url,
          error: result.error || 'Unknown error',
        });
      }
    }

    return {
      total: usersToCrawl.length,
      success: users.length,
      failed: errors.length,
      data: users,
      errors,
    };
  }
}

// 导出单例（简单场景使用）
let defaultCrawler: InStreetCrawler | null = null;

export function getCrawler(
  forwardHeaders?: Record<string, string>
): InStreetCrawler {
  if (!defaultCrawler) {
    defaultCrawler = new InStreetCrawler({}, forwardHeaders);
  }
  return defaultCrawler;
}
