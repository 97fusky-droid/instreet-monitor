/**
 * 加载骨架屏组件
 */

'use client';

import { Card, CardContent } from '@/components/ui/card';

/**
 * 文本骨架屏
 */
export function SkeletonText({
  width = 'w-full',
  height = 'h-4',
  className = '',
}: {
  width?: string;
  height?: string;
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse rounded bg-white/10 ${width} ${height} ${className}`}
    />
  );
}

/**
 * 统计卡片骨架屏
 */
export function StatsCardSkeleton() {
  return (
    <Card className="glass-card">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <SkeletonText width="w-8" height="h-8" className="rounded-lg" />
          <SkeletonText width="w-16" height="h-5" className="rounded-full" />
        </div>
        <SkeletonText width="w-20" height="h-4" className="mb-2" />
        <SkeletonText width="w-32" height="h-8" />
      </CardContent>
    </Card>
  );
}

/**
 * 列表项骨架屏
 */
export function ListItemSkeleton() {
  return (
    <div className="glass-card p-3">
      <div className="flex items-start gap-2">
        <SkeletonText width="w-6" height="h-6" className="rounded mt-1 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <SkeletonText width="w-full" height="h-4" />
          <SkeletonText width="w-3/4" height="h-3" />
          <div className="flex gap-3 mt-2">
            <SkeletonText width="w-12" height="h-3" />
            <SkeletonText width="w-12" height="h-3" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 用户列表项骨架屏
 */
export function UserItemSkeleton() {
  return (
    <div className="flex items-center gap-3 glass-card p-3">
      <SkeletonText width="w-10" height="h-10" className="rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <SkeletonText width="w-32" height="h-4" />
        <SkeletonText width="w-24" height="h-3" />
      </div>
      <SkeletonText width="w-8" height="h-6" className="rounded-full" />
    </div>
  );
}

/**
 * 图表骨架屏
 */
export function ChartSkeleton({ height = 'h-[250px]' }: { height?: string }) {
  return (
    <div className={`animate-pulse ${height}`}>
      <div className="h-full rounded bg-gradient-to-b from-white/5 to-transparent" />
    </div>
  );
}

/**
 * 完整的统计卡片骨架屏组
 */
export function StatsCardsSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <StatsCardSkeleton />
      <StatsCardSkeleton />
      <StatsCardSkeleton />
      <StatsCardSkeleton />
    </div>
  );
}

/**
 * 热门帖子列表骨架屏
 */
export function HotPostsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <ListItemSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * 活跃用户列表骨架屏
 */
export function ActiveUsersSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <UserItemSkeleton key={i} />
      ))}
    </div>
  );
}
