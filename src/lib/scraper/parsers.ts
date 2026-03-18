/**
 * InStreet 内容解析器
 * 解析帖子详情、用户信息、首页列表
 * 
 * 数据格式说明：
 * - 首页统计：23075Agent\n26475帖子\n115002评论\n184816点赞
 * - 帖子详情：标题、作者、积分（·75853 积分·）、点赞评论（**644**  赞**1158**  评论）
 * - 用户信息：**930**  积分**50**  帖子**92**  评论**6.3k**  获赞**1.4k**  粉丝
 */

import type { FetchResponse, FetchContentItem } from './fetcher';
import type {
  Post,
  PostListItem,
  User,
  UserListItem,
  HomePageResult,
  ContentItem,
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
} from './fetcher';

// ==================== 首页解析器 ====================

/**
 * 解析首页统计数据
 * 实际格式：23075Agent\n\n26475帖子\n\n115002评论\n\n184816点赞
 */
export function parseHomePageStats(response: FetchResponse): {
  totalAgents: number;
  totalPosts: number;
  totalComments: number;
  totalLikes: number;
} {
  const textContent = extractTextContent(response.content);
  
  console.log('[Parser] Raw text content for stats:', textContent.substring(0, 500));
  
  let totalAgents = 0;
  let totalPosts = 0;
  let totalComments = 0;
  let totalLikes = 0;

  // 匹配格式：数字 + 关键词（可能没有空格）
  // 例如：23075Agent, 26475帖子, 115002评论, 184816点赞
  
  // Agent 数量
  const agentMatch = textContent.match(/(\d[\d,]*)\s*Agent/i);
  if (agentMatch) {
    totalAgents = parseInt(agentMatch[1].replace(/,/g, ''), 10);
  }
  
  // 帖子数量
  const postsMatch = textContent.match(/(\d[\d,]*)\s*帖子/i);
  if (postsMatch) {
    totalPosts = parseInt(postsMatch[1].replace(/,/g, ''), 10);
  }
  
  // 评论数量
  const commentsMatch = textContent.match(/(\d[\d,]*)\s*评论/i);
  if (commentsMatch) {
    totalComments = parseInt(commentsMatch[1].replace(/,/g, ''), 10);
  }
  
  // 点赞数量
  const likesMatch = textContent.match(/(\d[\d,]*)\s*点赞/i);
  if (likesMatch) {
    totalLikes = parseInt(likesMatch[1].replace(/,/g, ''), 10);
  }

  console.log('[Parser] Home page stats extracted:', {
    totalAgents,
    totalPosts,
    totalComments,
    totalLikes,
  });

  return { totalAgents, totalPosts, totalComments, totalLikes };
}

/**
 * 解析首页内容，提取帖子和用户链接
 */
export function parseHomePage(response: FetchResponse): HomePageResult {
  // 提取首页统计数据
  const stats = parseHomePageStats(response);
  
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

  console.log('[Parser] Home page parsed:', {
    stats,
    postsCount: posts.length,
    usersCount: users.length,
  });

  return {
    stats,
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
  const textContent = extractTextContent(content);
  
  // 从内容中提取标题（通常是第一个 # 开头的行）
  let title = '';
  const titleMatch = textContent.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    title = titleMatch[1].trim();
  } else {
    // 如果没有 # 标题，尝试从内容前几行提取
    const lines = textContent.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const cleanLine = line.replace(/[·\s]+积分·/g, '').trim();
      if (cleanLine.length > 5 && cleanLine.length < 200 && !cleanLine.includes('赞') && !cleanLine.includes('评论')) {
        title = cleanLine;
        break;
      }
    }
    if (!title && response.title) {
      title = response.title.replace(' - InStreet', '').trim();
    }
  }
  
  // 提取作者信息
  const { author, authorUrl, points } = extractAuthorInfo(content);
  
  // 提取点赞和评论数
  const { likes, comments } = extractEngagementInfo(content);
  
  const rawContent = convertToContentItems(content);

  console.log('[Parser] Post parsed:', {
    id: postId,
    title,
    author,
    points,
    likes,
    comments,
  });

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
 * 格式：·75853 积分·
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
 * 格式：**644**  赞**1158**  评论举报
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
          url: item.image.url,
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
  const bio = extractUserBio(text, username);
  
  // 提取最近帖子
  const recentPosts = extractUserRecentPosts(content);

  console.log('[Parser] User parsed:', {
    username,
    points: stats.points,
    posts: stats.posts,
    followers: stats.followers,
  });

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
 * 格式：**930**  积分**50**  帖子**92**  评论**6.3k**  获赞**1.4k**  粉丝**1367**  关注
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

  // 积分：**930**  积分
  const pointsMatch = text.match(/\*\*(\d+)\*\*\s*积分/);
  if (pointsMatch) {
    stats.points = parseInt(pointsMatch[1], 10);
  }

  // 帖子数：**50**  帖子
  const postsMatch = text.match(/\*\*(\d+)\*\*\s*帖子/);
  if (postsMatch) {
    stats.posts = parseInt(postsMatch[1], 10);
  }

  // 评论数：**92**  评论 或 **6.3k**  评论
  const commentsMatch = text.match(/\*\*([\d.]+[kK]?)\*\*\s*评论/);
  if (commentsMatch) {
    stats.comments = parseNumberString(commentsMatch[1]);
  }

  // 获赞：**6.3k**  获赞
  const likesMatch = text.match(/\*\*([\d.]+[kK]?)\*\*\s*获赞/);
  if (likesMatch) {
    stats.likesRaw = likesMatch[1];
    stats.likes = parseNumberString(likesMatch[1]);
  }

  // 粉丝：**1.4k**  粉丝
  const followersMatch = text.match(/\*\*([\d.]+[kK]?)\*\*\s*粉丝/);
  if (followersMatch) {
    stats.followersRaw = followersMatch[1];
    stats.followers = parseNumberString(followersMatch[1]);
  }

  // 关注：**0**  关注
  const followingMatch = text.match(/\*\*(\d+)\*\*\s*关注/);
  if (followingMatch) {
    stats.following = parseInt(followingMatch[1], 10);
  }

  // 提取备用格式（底部统计栏）
  // 格式：帖子50评论92小组1竞技场0粉丝1367关注0
  if (stats.posts === 0) {
    const altPostsMatch = text.match(/帖子(\d+)/);
    if (altPostsMatch) {
      stats.posts = parseInt(altPostsMatch[1], 10);
    }
  }
  
  if (stats.comments === 0) {
    const altCommentsMatch = text.match(/评论(\d+)/);
    if (altCommentsMatch) {
      stats.comments = parseInt(altCommentsMatch[1], 10);
    }
  }
  
  if (stats.followers === 0) {
    const altFollowersMatch = text.match(/粉丝(\d+)/);
    if (altFollowersMatch) {
      stats.followers = parseInt(altFollowersMatch[1], 10);
    }
  }

  // 加入时间：2026年3月11日 加入
  const joinedMatch = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日\s*加入/);
  if (joinedMatch) {
    const [_, year, month, day] = joinedMatch;
    stats.joinedAt = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // 最后活跃：最后活跃 刚刚
  if (text.includes('最后活跃')) {
    stats.lastActive = new Date();
  }

  return stats;
}

/**
 * 提取用户简介
 * 格式：用户名后到统计数据前的内容
 */
function extractUserBio(text: string, username: string): string {
  // 找到用户名后的内容，直到遇到统计数字
  const bioMatch = text.split(username)[1]?.match(/^\s*\n+([\s\S]*?)(?=\*\*\d)/);
  if (bioMatch) {
    return bioMatch[1].trim();
  }
  
  // 备用方式：提取 # username 之后到积分之前的内容
  const altMatch = text.match(new RegExp(`#\\s*${username}[\\s\\S]*?\\n([\\s\\S]*?)(?=\\*\\*\\d)`));
  if (altMatch) {
    return altMatch[1].trim();
  }
  
  return '';
}

/**
 * 提取用户最近帖子
 */
function extractUserRecentPosts(content: FetchContentItem[]): { id: string; title: string; url: string; likes: number }[] {
  const posts: { id: string; title: string; url: string; likes: number }[] = [];
  const seenUrls = new Set<string>();
  
  for (const item of content) {
    if (item.type === 'link' && item.url?.includes('/post/')) {
      const url = item.url;
      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        // 从 URL 提取帖子 ID
        const id = url.split('/post/')[1]?.split('?')[0] || '';
        posts.push({
          id,
          title: '', // 标题需要单独获取
          url,
          likes: 0,  // 点赞数需要单独获取
        });
      }
    }
  }
  
  return posts.slice(0, 10);
}
