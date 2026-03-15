/**
 * InStreet 内容解析器
 * 解析帖子详情、用户信息、首页列表
 */

import type { FetchResponse, FetchContentItem } from 'coze-coding-dev-sdk';
import type {
  Post,
  PostListItem,
  User,
  UserListItem,
  HomePageResult,
  ContentItem,
  PostCategory,
} from '@/types/instreet';
import {
  parseNumberString,
  extractPostId,
  extractUsername,
  detectCategory,
} from '@/types/instreet';
import {
  extractTextContent,
  extractLinks,
  filterInStreetLinks,
  uniqueArray,
} from './fetcher';

// ==================== 首页解析器 ====================

/**
 * 解析首页内容，提取帖子和用户链接
 */
export function parseHomePage(response: FetchResponse): HomePageResult {
  const links = extractLinks(response.content);
  const inStreetLinks = filterInStreetLinks(links);

  const posts: PostListItem[] = [];
  const users: UserListItem[] = [];
  const seenPosts = new Set<string>();
  const seenUsers = new Set<string>();

  for (const link of inStreetLinks) {
    // 提取帖子链接
    const postId = extractPostId(link);
    if (postId && !seenPosts.has(postId)) {
      seenPosts.add(postId);
      posts.push({
        id: postId,
        url: link,
        category: detectCategory(link),
      });
    }

    // 提取用户链接
    const username = extractUsername(link);
    if (username && !seenUsers.has(username)) {
      seenUsers.add(username);
      users.push({
        username,
        url: link,
      });
    }
  }

  return {
    posts,
    users,
    crawledAt: new Date(),
  };
}

// ==================== 帖子解析器 ====================

/**
 * 解析帖子详情页
 */
export function parsePostPage(response: FetchResponse, postUrl: string): Post | null {
  const postId = extractPostId(postUrl);
  if (!postId) {
    console.error(`[Parser] Invalid post URL: ${postUrl}`);
    return null;
  }

  const content = response.content;
  const title = response.title || '';
  
  // 提取作者信息
  const { author, authorUrl, points } = extractAuthorInfo(content);
  
  // 提取点赞和评论数
  const { likes, comments } = extractEngagementInfo(content);
  
  // 提取内容
  const textContent = extractTextContent(content);
  const rawContent = convertToContentItems(content);

  return {
    id: postId,
    title,
    author,
    authorUrl,
    content: textContent,
    rawContent,
    likes,
    comments,
    category: detectCategory(postUrl),
    publishedAt: parsePublishTime(response.publish_time),
    crawledAt: new Date(),
  };
}

/**
 * 从内容中提取作者信息
 */
function extractAuthorInfo(content: FetchContentItem[]): {
  author: string;
  authorUrl?: string;
  points: number;
} {
  let author = '';
  let authorUrl: string | undefined;
  let points = 0;

  for (const item of content) {
    if (item.type === 'link' && item.url?.includes('/u/')) {
      // 提取用户名
      const username = extractUsername(item.url);
      if (username && !author) {
        author = username;
        authorUrl = item.url;
      }
    }

    if (item.type === 'text') {
      const text = item.text || '';
      
      // 提取积分：格式如 "·75853 积分·"
      const pointsMatch = text.match(/·(\d+)\s*积分·/);
      if (pointsMatch) {
        points = parseInt(pointsMatch[1], 10);
      }
    }
  }

  return { author, authorUrl, points };
}

/**
 * 从内容中提取互动信息（点赞、评论数）
 */
function extractEngagementInfo(content: FetchContentItem[]): {
  likes: number;
  comments: number;
} {
  let likes = 0;
  let comments = 0;

  for (const item of content) {
    if (item.type === 'text') {
      const text = item.text || '';
      
      // 格式："**644**  赞**1158**  评论举报"
      const likesMatch = text.match(/\*\*(\d+)\*\*\s*赞/);
      if (likesMatch) {
        likes = parseInt(likesMatch[1], 10);
      }

      const commentsMatch = text.match(/\*\*(\d+)\*\*\s*评论/);
      if (commentsMatch) {
        comments = parseInt(commentsMatch[1], 10);
      }
    }
  }

  return { likes, comments };
}

/**
 * 解析发布时间
 */
function parsePublishTime(publishTime?: string): Date | undefined {
  if (!publishTime) return undefined;
  
  try {
    return new Date(publishTime);
  } catch {
    return undefined;
  }
}

/**
 * 转换为 ContentItem 格式
 */
function convertToContentItems(items: FetchContentItem[]): ContentItem[] {
  return items.map(item => {
    if (item.type === 'text') {
      return { type: 'text', text: item.text };
    }
    if (item.type === 'link') {
      return { type: 'link', url: item.url };
    }
    if (item.type === 'image' && item.image) {
      return {
        type: 'image',
        image: {
          url: item.image.display_url || item.image.image_url || '',
          width: item.image.width,
          height: item.image.height,
        },
      };
    }
    return { type: 'text', text: '' };
  });
}

// ==================== 用户解析器 ====================

/**
 * 解析用户主页
 */
export function parseUserPage(response: FetchResponse, userUrl: string): User | null {
  const username = extractUsername(userUrl);
  if (!username) {
    console.error(`[Parser] Invalid user URL: ${userUrl}`);
    return null;
  }

  const content = response.content;
  const text = extractTextContent(content);

  // 提取统计数据
  const stats = extractUserStats(text);
  
  // 提取简介
  const bio = extractUserBio(text);
  
  // 提取最近帖子
  const recentPosts = extractUserRecentPosts(content);

  return {
    username,
    bio,
    points: stats.points,
    posts: stats.posts,
    comments: stats.comments,
    likes: stats.likes,
    likesRaw: stats.likesRaw,
    followers: stats.followers,
    followersRaw: stats.followersRaw,
    following: stats.following,
    joinedAt: stats.joinedAt,
    lastActive: stats.lastActive,
    crawledAt: new Date(),
    recentPosts,
  };
}

/**
 * 从文本中提取用户统计数据
 */
function extractUserStats(text: string): {
  points: number;
  posts: number;
  comments: number;
  likes: number;
  likesRaw: string;
  followers: number;
  followersRaw: string;
  following: number;
  joinedAt?: Date;
  lastActive?: Date;
} {
  // 格式示例：
  // "**930**  积分**50**  帖子**92**  评论**6.3k**  获赞**1.4k**  粉丝**0**  关注 驻站 2 天"
  // "2026年3月11日 加入最后活跃 刚刚"

  const stats = {
    points: 0,
    posts: 0,
    comments: 0,
    likes: 0,
    likesRaw: '',
    followers: 0,
    followersRaw: '',
    following: 0,
    joinedAt: undefined as Date | undefined,
    lastActive: undefined as Date | undefined,
  };

  // 积分
  const pointsMatch = text.match(/\*\*(\d+)\*\*\s*积分/);
  if (pointsMatch) {
    stats.points = parseInt(pointsMatch[1], 10);
  }

  // 帖子数
  const postsMatch = text.match(/\*\*(\d+)\*\*\s*帖子/);
  if (postsMatch) {
    stats.posts = parseInt(postsMatch[1], 10);
  }

  // 评论数
  const commentsMatch = text.match(/\*\*(\d+)\*\*\s*评论/);
  if (commentsMatch) {
    stats.comments = parseInt(commentsMatch[1], 10);
  }

  // 获赞数（可能是 "6.3k" 格式）
  const likesMatch = text.match(/\*\*([\d.]+[km]?)\*\*\s*获赞/i);
  if (likesMatch) {
    stats.likesRaw = likesMatch[1];
    stats.likes = parseNumberString(likesMatch[1]);
  }

  // 粉丝数（可能是 "1.4k" 格式）
  const followersMatch = text.match(/\*\*([\d.]+[km]?)\*\*\s*粉丝/i);
  if (followersMatch) {
    stats.followersRaw = followersMatch[1];
    stats.followers = parseNumberString(followersMatch[1]);
  }

  // 关注数
  const followingMatch = text.match(/\*\*(\d+)\*\*\s*关注/);
  if (followingMatch) {
    stats.following = parseInt(followingMatch[1], 10);
  }

  // 加入时间
  const joinedMatch = text.match(/(\d{4}年\d{1,2}月\d{1,2}日)\s*加入/);
  if (joinedMatch) {
    try {
      const dateStr = joinedMatch[1].replace(/年|月/g, '-').replace('日', '');
      stats.joinedAt = new Date(dateStr);
    } catch {
      // 忽略解析错误
    }
  }

  return stats;
}

/**
 * 提取用户简介
 */
function extractUserBio(text: string): string {
  // 简介通常在用户名后面，统计数据前面
  // 格式：用户名后换行，然后是简介，然后是统计数据
  
  const lines = text.split('\n').filter(line => line.trim());
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // 跳过 "TA" 和用户名行
    if (line === 'TA' || line.startsWith('#')) continue;
    
    // 统计数据行（包含 "**数字** 积分" 等格式）
    if (line.includes('积分') && line.includes('帖子')) continue;
    
    // 加入时间行
    if (line.includes('加入') && line.includes('活跃')) continue;
    
    // 帖子列表区域
    if (line.includes('帖子') && line.includes('评论')) continue;
    
    // 其他可能是简介
    if (line.length > 10 && !line.includes('**')) {
      return line;
    }
  }
  
  return '';
}

/**
 * 提取用户最近帖子
 */
function extractUserRecentPosts(content: FetchContentItem[]): Array<{
  id: string;
  title: string;
  url: string;
  likes: number;
  publishedAt?: string;
}> {
  const posts: Array<{
    id: string;
    title: string;
    url: string;
    likes: number;
    publishedAt?: string;
  }> = [];

  let currentTitle = '';
  let currentUrl = '';
  let currentLikes = 0;
  let currentTime = '';

  for (const item of content) {
    if (item.type === 'link' && item.url) {
      const postId = extractPostId(item.url);
      
      if (postId) {
        // 如果有之前的帖子数据，先保存
        if (currentTitle && currentUrl) {
          posts.push({
            id: extractPostId(currentUrl) || '',
            title: currentTitle,
            url: currentUrl,
            likes: currentLikes,
            publishedAt: currentTime,
          });
        }
        
        // 开始新帖子
        currentUrl = item.url;
        currentTitle = item.text || '';
        currentLikes = 0;
        currentTime = '';
      } else if (item.url.includes('/post/')) {
        // 可能是时间或点赞数链接
        const text = item.text || '';
        if (text.match(/^\d+$/)) {
          currentLikes = parseInt(text, 10);
        }
      }
    }

    if (item.type === 'text') {
      const text = item.text || '';
      
      // 提取时间：如 "20小时前"
      const timeMatch = text.match(/(\d+小时前|\d+天前|刚刚)/);
      if (timeMatch) {
        currentTime = timeMatch[1];
      }
      
      // 提取点赞数
      const likesMatch = text.match(/^(\d+)$/);
      if (likesMatch && currentUrl) {
        currentLikes = parseInt(likesMatch[1], 10);
      }
    }
  }

  // 保存最后一个帖子
  if (currentTitle && currentUrl) {
    posts.push({
      id: extractPostId(currentUrl) || '',
      title: currentTitle,
      url: currentUrl,
      likes: currentLikes,
      publishedAt: currentTime,
    });
  }

  return posts;
}

// ==================== 工具函数 ====================

/**
 * 解析相对时间字符串
 */
export function parseRelativeTime(timeStr: string): Date | undefined {
  const now = new Date();
  
  if (timeStr === '刚刚') {
    return now;
  }
  
  const hoursMatch = timeStr.match(/(\d+)小时前/);
  if (hoursMatch) {
    const hours = parseInt(hoursMatch[1], 10);
    return new Date(now.getTime() - hours * 60 * 60 * 1000);
  }
  
  const daysMatch = timeStr.match(/(\d+)天前/);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }
  
  return undefined;
}
