/**
 * InStreet 监控大屏主页
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/layout/Layout';
import { 
  StatsCards, 
  HotPosts, 
  ActiveUsers, 
  ActivityChart, 
  ControlPanel,
  StatsCardsSkeleton,
  HotPostsSkeleton,
  ActiveUsersSkeleton,
  ChartSkeleton,
} from '@/components/dashboard';
import { useDashboard } from '@/hooks/useDashboard';

export default function DashboardPage() {
  const [currentTime, setCurrentTime] = useState('');
  const [crawlProgress, setCrawlProgress] = useState(0);

  // 使用 Dashboard Hook
  const {
    stats,
    posts,
    users,
    activity,
    isLoading,
    isRefreshing,
    isCrawling,
    error,
    lastUpdateTime,
    refresh,
    crawl,
    mutate,
  } = useDashboard();

  // 更新当前时间
  useEffect(() => {
    setCurrentTime(new Date().toLocaleString('zh-CN'));
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleString('zh-CN'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 模拟采集进度
  useEffect(() => {
    if (isCrawling) {
      setCrawlProgress(0);
      const interval = setInterval(() => {
        setCrawlProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + Math.random() * 15;
        });
      }, 500);
      return () => clearInterval(interval);
    } else {
      setCrawlProgress(100);
    }
  }, [isCrawling]);

  // 手动刷新
  const handleRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  // 执行采集
  const handleCrawl = useCallback(async () => {
    try {
      await crawl();
      // 采集完成后刷新所有数据
      mutate();
    } catch (err) {
      console.error('Crawl failed:', err);
    }
  }, [crawl, mutate]);

  // 计算最新帖子数
  const latestPosts = posts.filter(post => {
    if (!post.published_at) return false;
    const postDate = new Date(post.published_at);
    const today = new Date();
    return postDate.toDateString() === today.toDateString();
  }).length;

  return (
    <Layout>
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold neon-text-cyan">
            InStreet 监控大屏
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm text-gray-400">实时监控</span>
            </div>
            <div className="text-sm text-gray-400">
              {currentTime}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-gray-500 text-sm">
            监控 AI Agent 社交网络平台 · 数据自动刷新
          </p>
          {lastUpdateTime && (
            <p className="text-xs text-gray-500">
              数据更新时间: {lastUpdateTime}
            </p>
          )}
        </div>
      </header>

      {/* 统计卡片 */}
      <StatsCards 
        stats={stats}
        latestPosts={latestPosts}
        isLive={!isRefreshing}
        isLoading={isLoading && !stats}
      />

      {/* 主内容区 */}
      <div className="grid grid-cols-3 gap-6">
        {/* 左侧 - 热门帖子 */}
        <div className="col-span-1">
          <HotPosts 
            posts={posts.slice(0, 10)} 
            isLoading={isLoading && posts.length === 0}
          />
        </div>

        {/* 中间 - 活动趋势 + 控制面板 */}
        <div className="col-span-1 space-y-6">
          <ActivityChart 
            data={activity}
            isLoading={isLoading && activity.length === 0}
          />
          <ControlPanel
            onRefresh={handleRefresh}
            onCrawl={handleCrawl}
            isRefreshing={isRefreshing}
            isCrawling={isCrawling}
            crawlProgress={crawlProgress}
            lastUpdateTime={lastUpdateTime || ''}
            error={error}
            stats={stats ? { totalPosts: stats.totalPosts, totalUsers: stats.totalUsers } : null}
          />
        </div>

        {/* 右侧 - 活跃用户 */}
        <div className="col-span-1">
          <ActiveUsers 
            users={users.slice(0, 10)}
            isLoading={isLoading && users.length === 0}
          />
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-6 text-center text-xs text-gray-500">
        <p>
          数据来源: InStreet (
          <a 
            href="https://instreet.coze.site/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[#00f5d4] hover:underline"
          >
            instreet.coze.site
          </a>
          ) · 最后更新: {lastUpdateTime || '暂无'}
        </p>
      </footer>
    </Layout>
  );
}
