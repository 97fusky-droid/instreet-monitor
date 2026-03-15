/**
 * Fetch URL 封装服务
 * 提供错误处理、重试机制和速率限制
 */

import { FetchClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import type { FetchResponse, FetchContentItem } from 'coze-coding-dev-sdk';

/**
 * Fetcher 配置
 */
export interface FetcherConfig {
  maxRetries: number;        // 最大重试次数
  retryDelay: number;        // 重试延迟（毫秒）
  rateLimitDelay: number;    // 速率限制延迟（毫秒）
  timeout: number;           // 超时时间（毫秒）
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: FetcherConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  rateLimitDelay: 500,
  timeout: 30000,
};

/**
 * 请求头（用于转发）
 */
type ForwardHeaders = Record<string, string>;

/**
 * Fetcher 结果
 */
export interface FetcherResult {
  success: boolean;
  data?: FetchResponse;
  error?: string;
  retries: number;
  duration: number;
}

/**
 * Fetch URL 封装类
 */
export class Fetcher {
  private config: FetcherConfig;
  private lastRequestTime: number = 0;
  private client: FetchClient;
  private customHeaders?: ForwardHeaders;

  constructor(
    config: Partial<FetcherConfig> = {},
    forwardHeaders?: ForwardHeaders
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.customHeaders = forwardHeaders;
    
    const sdkConfig = new Config({
      timeout: this.config.timeout,
    });
    
    this.client = new FetchClient(sdkConfig, this.customHeaders);
  }

  /**
   * 从请求对象创建 Fetcher（用于 API 路由）
   */
  static fromRequest(
    headers: Headers | Record<string, string>,
    config: Partial<FetcherConfig> = {}
  ): Fetcher {
    const forwardHeaders = HeaderUtils.extractForwardHeaders(headers);
    return new Fetcher(config, forwardHeaders);
  }

  /**
   * 获取 URL 内容（带重试和速率限制）
   */
  async fetch(url: string): Promise<FetcherResult> {
    const startTime = Date.now();
    let lastError: string | undefined;
    let retries = 0;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        // 速率限制
        await this.enforceRateLimit();

        // 执行请求
        const response = await this.client.fetch(url);

        // 检查响应状态
        if (response.status_code !== undefined && response.status_code !== 0) {
          throw new Error(`Fetch failed with status: ${response.status_message || 'Unknown error'}`);
        }

        return {
          success: true,
          data: response,
          retries: attempt,
          duration: Date.now() - startTime,
        };
      } catch (error) {
        retries = attempt;
        lastError = error instanceof Error ? error.message : String(error);

        // 如果不是最后一次尝试，等待后重试
        if (attempt < this.config.maxRetries) {
          await this.delay(this.getRetryDelay(attempt));
        }
      }
    }

    return {
      success: false,
      error: lastError,
      retries,
      duration: Date.now() - startTime,
    };
  }

  /**
   * 批量获取 URL 内容
   */
  async fetchBatch(
    urls: string[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<Map<string, FetcherResult>> {
    const results = new Map<string, FetcherResult>();
    
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const result = await this.fetch(url);
      results.set(url, result);
      
      onProgress?.(i + 1, urls.length);
    }

    return results;
  }

  /**
   * 强制执行速率限制
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    
    if (elapsed < this.config.rateLimitDelay) {
      await this.delay(this.config.rateLimitDelay - elapsed);
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * 计算重试延迟（指数退避）
   */
  private getRetryDelay(attempt: number): number {
    const baseDelay = this.config.retryDelay;
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 100; // 添加随机抖动
    return exponentialDelay + jitter;
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 提取文本内容
 */
export function extractTextContent(items: FetchContentItem[]): string {
  return items
    .filter(item => item.type === 'text' && item.text)
    .map(item => item.text!)
    .join('\n')
    .trim();
}

/**
 * 提取链接列表
 */
export function extractLinks(items: FetchContentItem[]): string[] {
  return items
    .filter(item => item.type === 'link' && item.url)
    .map(item => item.url!);
}

/**
 * 提取图片列表
 */
export function extractImages(items: FetchContentItem[]): Array<{
  url: string;
  width?: number;
  height?: number;
}> {
  return items
    .filter(item => item.type === 'image' && item.image)
    .map(item => ({
      url: item.image!.display_url || item.image!.image_url || '',
      width: item.image!.width,
      height: item.image!.height,
    }));
}

/**
 * 去重数组
 */
export function uniqueArray<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

/**
 * 过滤有效的 InStreet 链接
 */
export function filterInStreetLinks(links: string[]): string[] {
  const baseUrl = 'https://instreet.coze.site';
  return uniqueArray(links)
    .filter(link => link.startsWith(baseUrl) || link.startsWith('/'))
    .map(link => link.startsWith('/') ? `https://instreet.coze.site${link}` : link);
}
