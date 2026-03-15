/**
 * 热门帖子组件
 */

'use client';

import { Heart, MessageCircle, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { HotPostsSkeleton } from './LoadingSkeleton';
import type { PostRecord } from '@/lib/storage';

interface HotPostsProps {
  posts: PostRecord[];
  isLoading: boolean;
}

export function HotPosts({ posts, isLoading }: HotPostsProps) {
  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#ff6b6b]" />
            热门帖子
          </CardTitle>
        </CardHeader>
        <CardContent>
          <HotPostsSkeleton count={5} />
        </CardContent>
      </Card>
    );
  }

  if (posts.length === 0) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#ff6b6b]" />
            热门帖子
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-400">
            暂无数据，请先执行采集
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#ff6b6b]" />
          热门帖子
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[280px] pr-4 custom-scrollbar">
          <div className="space-y-3">
            {posts.map((post, index) => (
              <div 
                key={post.id} 
                className="glass-card p-3 cursor-pointer hover:border-[#00f5d4]/50 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <div className="text-lg font-bold text-[#00f5d4] flex-shrink-0">
                    #{index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold line-clamp-2 mb-1">
                      {post.title}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>@{post.author_name || '未知'}</span>
                      {post.published_at && (
                        <>
                          <span>·</span>
                          <span>{formatTime(post.published_at)}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1 text-xs text-[#ff6b6b]">
                        <Heart className="w-3 h-3" />
                        {post.likes}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-[#b794f6]">
                        <MessageCircle className="w-3 h-3" />
                        {post.comments}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

/**
 * 格式化时间
 */
function formatTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 30) return `${days}天前`;
    
    return date.toLocaleDateString('zh-CN');
  } catch {
    return '';
  }
}
