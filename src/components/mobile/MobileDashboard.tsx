/**
 * 移动端 Dashboard 组件
 * 针对 9:16 竖屏优化
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  Users, 
  MessageCircle, 
  Heart, 
  Zap,
  TrendingUp,
  Award,
  BarChart3,
  Play,
  RefreshCw,
  ChevronRight,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { StatsOverview } from '@/hooks/useDashboard';
import type { PostRecord, UserRecord } from '@/lib/storage';

interface MobileDashboardProps {
  stats: StatsOverview | null;
  posts: PostRecord[];
  users: UserRecord[];
  activity: Array<{ date: string; posts: number; users: number }>;
  isLoading: boolean;
  isRefreshing: boolean;
  isCrawling: boolean;
  crawlProgress: number;
  error: string | null;
  lastUpdateTime: string | null;
  currentTime: string;
  latestPosts: number;
  onRefresh: () => void;
  onCrawl: () => void;
}

// Tab 类型
type TabType = 'posts' | 'users' | 'trend' | 'control';

export function MobileDashboard({
  stats,
  posts,
  users,
  activity,
  isLoading,
  isRefreshing,
  isCrawling,
  crawlProgress,
  error,
  lastUpdateTime,
  currentTime,
  latestPosts,
  onRefresh,
  onCrawl,
}: MobileDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('posts');

  const tabs = [
    { id: 'posts' as TabType, label: '热门', icon: TrendingUp },
    { id: 'users' as TabType, label: '用户', icon: Award },
    { id: 'trend' as TabType, label: '趋势', icon: BarChart3 },
    { id: 'control' as TabType, label: '控制', icon: Zap },
  ];

  return (
    <div className="min-h-screen bg-[#0a0e27] text-white flex flex-col">
      {/* 背景效果 */}
      <div className="fixed inset-0 pointer-events-none">
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0, 245, 212, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 245, 212, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '30px 30px',
          }}
        />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-[#00f5d4] rounded-full blur-[150px] opacity-10" />
      </div>

      {/* 固定顶部 Header */}
      <header className="sticky top-0 z-50 bg-[#0a0e27]/90 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00f5d4] to-[#b794f6] flex items-center justify-center">
              <span className="text-sm font-bold text-black">IS</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-[#00f5d4]">InStreet</h1>
              <p className="text-[10px] text-gray-500">监控大屏</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] text-gray-400">实时</span>
            </div>
            <div className="text-[10px] text-gray-500">
              {currentTime.split(' ')[1]}
            </div>
          </div>
        </div>
      </header>

      {/* 统计卡片 - 横向滚动 */}
      <div className="relative z-10 px-4 py-3">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          <StatCard
            icon={<Users className="w-4 h-4" />}
            label="用户"
            value={stats?.totalUsers || 0}
            color="cyan"
            isLoading={isLoading}
          />
          <StatCard
            icon={<MessageCircle className="w-4 h-4" />}
            label="帖子"
            value={stats?.totalPosts || 0}
            color="purple"
            badge={latestPosts > 0 ? `+${latestPosts}` : undefined}
            isLoading={isLoading}
          />
          <StatCard
            icon={<Heart className="w-4 h-4" />}
            label="互动"
            value={stats ? stats.totalLikes + stats.totalComments : 0}
            color="red"
            isLoading={isLoading}
          />
          <StatCard
            icon={<Zap className="w-4 h-4" />}
            label="状态"
            value={stats?.lastCrawlAt ? '已同步' : '待采集'}
            color="yellow"
            isText
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Tab 导航 */}
      <div className="relative z-10 px-4 mb-3">
        <div className="flex bg-white/5 rounded-xl p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all',
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-[#00f5d4]/20 to-[#b794f6]/20 text-[#00f5d4]'
                    : 'text-gray-400 hover:text-white'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 内容区域 - 可滚动 */}
      <div className="flex-1 relative z-10 px-4 overflow-hidden">
        <ScrollArea className="h-full pr-2">
          {/* 热门帖子 Tab */}
          {activeTab === 'posts' && (
            <div className="space-y-2 pb-20">
              {isLoading && posts.length === 0 ? (
                <LoadingSkeleton count={5} />
              ) : posts.length === 0 ? (
                <EmptyState message="暂无帖子数据" />
              ) : (
                posts.slice(0, 15).map((post, index) => (
                  <PostItem key={post.id} post={post} rank={index + 1} />)
                )
              )}
            </div>
          )}

          {/* 活跃用户 Tab */}
          {activeTab === 'users' && (
            <div className="space-y-2 pb-20">
              {isLoading && users.length === 0 ? (
                <LoadingSkeleton count={5} />
              ) : users.length === 0 ? (
                <EmptyState message="暂无用户数据" />
              ) : (
                users.slice(0, 15).map((user, index) => (
                  <UserItem key={user.username || index} user={user} rank={index + 1} />)
                )
              )}
            </div>
          )}

          {/* 活动趋势 Tab */}
          {activeTab === 'trend' && (
            <div className="pb-20">
              {isLoading && activity.length === 0 ? (
                <Card className="glass-card">
                  <CardContent className="py-8">
                    <LoadingSkeleton count={3} />
                  </CardContent>
                </Card>
              ) : activity.length === 0 ? (
                <EmptyState message="暂无趋势数据" />
              ) : (
                <Card className="glass-card">
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">日期</span>
                        <div className="flex gap-4">
                          <span className="text-[#00f5d4]">帖子</span>
                          <span className="text-[#b794f6]">用户</span>
                        </div>
                      </div>
                      {activity.slice(-7).map((item, index) => (
                        <div 
                          key={item.date} 
                          className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0"
                        >
                          <span className="text-xs text-gray-500 w-16">
                            {item.date.slice(5)}
                          </span>
                          <div className="flex-1 flex gap-2">
                            <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                              <div 
                                className="h-full bg-[#00f5d4] rounded-full transition-all"
                                style={{ 
                                  width: `${Math.min((item.posts / Math.max(...activity.map(a => a.posts), 1)) * 100, 100)}%` 
                                }}
                              />
                            </div>
                            <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                              <div 
                                className="h-full bg-[#b794f6] rounded-full transition-all"
                                style={{ 
                                  width: `${Math.min((item.users / Math.max(...activity.map(a => a.users), 1)) * 100, 100)}%` 
                                }}
                              />
                            </div>
                          </div>
                          <div className="flex gap-3 text-xs">
                            <span className="text-[#00f5d4] w-6 text-right">{item.posts}</span>
                            <span className="text-[#b794f6] w-6 text-right">{item.users}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* 控制面板 Tab */}
          {activeTab === 'control' && (
            <div className="space-y-3 pb-20">
              {/* 错误提示 */}
              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              {/* 采集进度 */}
              {isCrawling && (
                <Card className="glass-card">
                  <CardContent className="py-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">采集进度</span>
                        <span className="text-[#00f5d4]">{Math.round(crawlProgress)}%</span>
                      </div>
                      <Progress value={crawlProgress} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 数据统计 */}
              <Card className="glass-card">
                <CardContent className="py-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-gray-400 mb-1">已采集帖子</p>
                      <p className="text-xl font-bold text-[#00f5d4]">
                        {stats?.totalPosts.toLocaleString() || 0}
                      </p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-gray-400 mb-1">已采集用户</p>
                      <p className="text-xl font-bold text-[#b794f6]">
                        {stats?.totalUsers.toLocaleString() || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 更新信息 */}
              {lastUpdateTime && (
                <div className="flex items-center justify-center gap-2 text-xs text-gray-500 py-2">
                  <Clock className="w-3 h-3" />
                  <span>数据更新: {lastUpdateTime}</span>
                </div>
              )}

              {/* 状态标签 */}
              <div className="flex justify-center gap-2">
                <Badge className="bg-[#00f5d4]/10 text-[#00f5d4] border-[#00f5d4]/30 text-[10px]">
                  自动刷新: 30s
                </Badge>
                <Badge className="bg-[#b794f6]/10 text-[#b794f6] border-[#b794f6]/30 text-[10px]">
                  数据源: InStreet
                </Badge>
              </div>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* 固定底部操作栏 */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0e27]/95 backdrop-blur-xl border-t border-white/10 px-4 py-3 safe-area-bottom">
        <div className="flex gap-3">
          <button
            onClick={onRefresh}
            disabled={isRefreshing || isCrawling}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all',
              'bg-white/10 hover:bg-white/20 text-white',
              (isRefreshing || isCrawling) && 'opacity-50 cursor-not-allowed'
            )}
          >
            <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
            刷新
          </button>
          <button
            onClick={onCrawl}
            disabled={isCrawling}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all',
              'bg-gradient-to-r from-[#00f5d4] to-[#b794f6] text-black',
              isCrawling && 'opacity-70'
            )}
          >
            <Play className="w-4 h-4" />
            {isCrawling ? '采集中...' : '采集数据'}
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 text-center py-2 pb-24 text-[10px] text-gray-600">
        数据来源: InStreet (instreet.coze.site)
      </footer>
    </div>
  );
}

// 统计卡片组件
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: 'cyan' | 'purple' | 'red' | 'yellow';
  badge?: string;
  isText?: boolean;
  isLoading?: boolean;
}

function StatCard({ icon, label, value, color, badge, isText, isLoading }: StatCardProps) {
  const colorClasses = {
    cyan: 'text-[#00f5d4] bg-[#00f5d4]/10 border-[#00f5d4]/20',
    purple: 'text-[#b794f6] bg-[#b794f6]/10 border-[#b794f6]/20',
    red: 'text-[#ff6b6b] bg-[#ff6b6b]/10 border-[#ff6b6b]/20',
    yellow: 'text-[#ffd93d] bg-[#ffd93d]/10 border-[#ffd93d]/20',
  };

  return (
    <div className={cn(
      'flex-shrink-0 w-[85px] rounded-xl border p-3',
      colorClasses[color]
    )}>
      <div className="flex items-center justify-between mb-2">
        {icon}
        {badge && (
          <span className="text-[8px] bg-white/10 px-1.5 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </div>
      <p className="text-[10px] text-gray-400">{label}</p>
      {isLoading ? (
        <div className="w-12 h-5 bg-white/10 rounded animate-pulse mt-1" />
      ) : (
        <p className={cn(
          'font-bold mt-1',
          isText ? 'text-sm' : 'text-lg'
        )}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
      )}
    </div>
  );
}

// 帖子项组件
interface PostItemProps {
  post: PostRecord;
  rank: number;
}

function PostItem({ post, rank }: PostItemProps) {
  const getRankStyle = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black';
    if (rank === 2) return 'bg-gradient-to-br from-gray-300 to-gray-500 text-black';
    if (rank === 3) return 'bg-gradient-to-br from-amber-600 to-amber-800 text-white';
    return 'bg-white/10 text-gray-400';
  };

  return (
    <Card className="glass-card hover:border-[#00f5d4]/30 transition-colors">
      <CardContent className="py-3 px-3">
        <div className="flex gap-3">
          <div className={cn(
            'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0',
            getRankStyle(rank)
          )}>
            {rank}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium line-clamp-2 mb-1">
              {post.title}
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] text-gray-500">
                <span>@{post.author_name || '未知'}</span>
                {post.published_at && (
                  <>
                    <span>·</span>
                    <span>{formatTime(post.published_at)}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1 text-[#ff6b6b]">
                  <Heart className="w-3 h-3" />
                  {post.likes}
                </span>
                <span className="flex items-center gap-1 text-[#b794f6]">
                  <MessageCircle className="w-3 h-3" />
                  {post.comments}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// 用户项组件
interface UserItemProps {
  user: UserRecord;
  rank: number;
}

function UserItem({ user, rank }: UserItemProps) {
  const getRankStyle = (rank: number) => {
    if (rank === 1) return 'from-yellow-400 to-yellow-600';
    if (rank === 2) return 'from-gray-300 to-gray-500';
    if (rank === 3) return 'from-amber-600 to-amber-800';
    return 'from-[#00f5d4] to-[#b794f6]';
  };

  return (
    <Card className="glass-card hover:border-[#00f5d4]/30 transition-colors">
      <CardContent className="py-3 px-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={cn(
              'w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center font-bold text-black text-sm',
              getRankStyle(rank)
            )}>
              {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
            </div>
            {rank === 1 && (
              <span className="absolute -top-1 -right-1 text-sm">👑</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">
              @{user.username || '未知用户'}
            </p>
            <p className="text-[10px] text-gray-500">
              帖子 {user.posts_count || 0} · 粉丝 {user.followers_count || 0}
            </p>
          </div>
          <div className={cn(
            'w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold',
            rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
            rank === 2 ? 'bg-gray-400/20 text-gray-400' :
            rank === 3 ? 'bg-amber-600/20 text-amber-500' :
            'bg-white/10 text-gray-500'
          )}>
            #{rank}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// 空状态组件
function EmptyState({ message }: { message: string }) {
  return (
    <Card className="glass-card">
      <CardContent className="py-12 text-center">
        <p className="text-gray-400 text-sm">{message}</p>
        <p className="text-gray-500 text-xs mt-2">点击底部「采集数据」按钮获取数据</p>
      </CardContent>
    </Card>
  );
}

// 加载骨架屏
function LoadingSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="glass-card">
          <CardContent className="py-3 px-3">
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-white/10 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="w-3/4 h-4 bg-white/10 rounded animate-pulse" />
                <div className="w-1/2 h-3 bg-white/10 rounded animate-pulse" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// 格式化时间
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
