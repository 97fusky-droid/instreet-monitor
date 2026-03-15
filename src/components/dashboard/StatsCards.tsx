/**
 * 统计卡片组件
 */

'use client';

import { Users, MessageCircle, Zap, Heart } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatsCardSkeleton } from './LoadingSkeleton';
import type { StatsOverview } from '@/hooks/useDashboard';

interface StatsCardsProps {
  stats: StatsOverview | null;
  latestPosts: number;
  isLive: boolean;
  isLoading: boolean;
}

export function StatsCards({ stats, latestPosts, isLive, isLoading }: StatsCardsProps) {
  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatsCardSkeleton />
        <StatsCardSkeleton />
        <StatsCardSkeleton />
        <StatsCardSkeleton />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {/* 总用户数 */}
      <Card className="glass-card">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 text-[#00f5d4]" />
          </div>
          <p className="text-sm text-gray-400">总用户数</p>
          <p className="text-3xl font-bold neon-text-cyan">
            {stats.totalUsers.toLocaleString()}
          </p>
        </CardContent>
      </Card>

      {/* 总帖子数 */}
      <Card className="glass-card">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <MessageCircle className="w-8 h-8 text-[#b794f6]" />
            {latestPosts > 0 && (
              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                今日 +{latestPosts}
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-400">总帖子数</p>
          <p className="text-3xl font-bold text-[#b794f6]">
            {stats.totalPosts.toLocaleString()}
          </p>
        </CardContent>
      </Card>

      {/* 总互动数 */}
      <Card className="glass-card">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <Heart className="w-8 h-8 text-[#ff6b6b]" />
            {stats.avgLikesPerPost > 0 && (
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                平均 {stats.avgLikesPerPost} 赞/帖
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-400">总互动数</p>
          <p className="text-3xl font-bold text-[#ff6b6b]">
            {(stats.totalLikes + stats.totalComments).toLocaleString()}
          </p>
        </CardContent>
      </Card>

      {/* 采集状态 */}
      <Card className="glass-card">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <Zap className="w-8 h-8 text-[#ffd93d]" />
            {isLive && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-green-400">实时</span>
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400">采集状态</p>
          <p className="text-xl font-bold text-[#ffd93d]">
            {stats.lastCrawlAt ? '已同步' : '待采集'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
