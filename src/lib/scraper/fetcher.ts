/**
 * Fetch URL 封装服务
 * 使用标准 fetch API 和 cheerio 解析 HTML
 * 适用于 Vercel 等生产环境
 */

import * as cheerio from 'cheerio';

/**
 * 内容项类型
 */
export type FetchContentItem = 
  | { type: 'text'; text: string }
  | { type: 'link'; url: string; text?: string }
  | { type: 'image'; image: { url: string; width?: number; height?: number } };

/**
 * Fetch 响应结果
 */
export interface FetchResponse {
  url: string;
  title: string;
  content: FetchContentItem[];
  status_code?: number;
  status_message?: string;
  publish_time?: string;
}

/**
 * Fetcher 配置
 */
export interface FetcherConfig {
  maxRetries: number;
  retryDelay: number;
  rateLimitDelay: number;
  timeout: number;
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

  constructor(config: Partial<FetcherConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
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

        // 使用标准 fetch 获取 HTML
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          },
          signal: AbortSignal.timeout(this.config.timeout),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();
        const parsed = this.parseHtml(html, url);

        return {
          success: true,
          data: parsed,
          retries: attempt,
          duration: Date.now() - startTime,
        };
      } catch (error) {
        retries = attempt;
        lastError = error instanceof Error ? error.message : String(error);

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
   * 解析 HTML 内容
   */
  private parseHtml(html: string, url: string): FetchResponse {
    const $ = cheerio.load(html);
    
    // 提取标题
    const title = $('title').text().trim() || '';
    
    // 提取内容项
    const content: FetchContentItem[] = [];
    
    // 提取所有文本内容
    const bodyText = $('body').text();
    content.push({ type: 'text', text: bodyText });
    
    // 提取所有链接
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        // 转换相对链接为绝对链接
        const absoluteUrl = href.startsWith('http') 
          ? href 
          : href.startsWith('/') 
            ? new URL(href, url).href 
            : new URL(href, url).href;
        content.push({ type: 'link', url: absoluteUrl, text: $(el).text().trim() });
      }
    });
    
    // 提取所有图片
    $('img[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (src) {
        const absoluteUrl = src.startsWith('http') 
          ? src 
          : src.startsWith('/') 
            ? new URL(src, url).href 
            : new URL(src, url).href;
        content.push({
          type: 'image',
          image: {
            url: absoluteUrl,
            width: parseInt($(el).attr('width') || '0'),
            height: parseInt($(el).attr('height') || '0'),
          },
        });
      }
    });

    return {
      url,
      title,
      content,
      status_code: 0,
      status_message: 'OK',
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
    const jitter = Math.random() * 100;
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
    .filter((item): item is { type: 'text'; text: string } => item.type === 'text')
    .map(item => item.text)
    .join('\n')
    .trim();
}

/**
 * 提取链接列表
 */
export function extractLinks(items: FetchContentItem[]): string[] {
  return items
    .filter((item): item is { type: 'link'; url: string; text?: string } => item.type === 'link')
    .map(item => item.url);
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
    .filter((item): item is { type: 'image'; image: { url: string; width?: number; height?: number } } => item.type === 'image')
    .map(item => ({
      url: item.image.url,
      width: item.image.width,
      height: item.image.height,
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
