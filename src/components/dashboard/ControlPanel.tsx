/**
 * 控制面板组件
 */

'use client';

import { useState } from 'react';
import { Play, RefreshCw, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';

interface ControlPanelProps {
  onRefresh: () => void;
  onCrawl: () => void;
  isRefreshing: boolean;
  isCrawling: boolean;
  crawlProgress: number;
  lastUpdateTime: string;
  error: string | null;
  stats: {
    totalPosts: number;
    totalUsers: number;
  } | null;
}

export function ControlPanel({
  onRefresh,
  onCrawl,
  isRefreshing,
  isCrawling,
  crawlProgress,
  lastUpdateTime,
  error,
  stats,
}: ControlPanelProps) {
  const [lastCrawlTime, setLastCrawlTime] = useState<string>('');

  const handleCrawl = async () => {
    setLastCrawlTime(new Date().toLocaleTimeString('zh-CN'));
    onCrawl();
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Play className="w-5 h-5 text-[#00f5d4]" />
            控制面板
          </span>
          {lastUpdateTime && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {lastUpdateTime}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* 错误提示 */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* 采集进度 */}
          {isCrawling && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">采集进度</span>
                <span className="text-[#00f5d4]">{crawlProgress}%</span>
              </div>
              <Progress value={crawlProgress} className="h-2" />
            </div>
          )}

          {/* 数据统计 */}
          {stats && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="glass-card p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">已采集帖子</p>
                <p className="text-xl font-bold text-[#00f5d4]">
                  {stats.totalPosts.toLocaleString()}
                </p>
              </div>
              <div className="glass-card p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">已采集用户</p>
                <p className="text-xl font-bold text-[#b794f6]">
                  {stats.totalUsers.toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {/* 按钮组 */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={onRefresh}
              disabled={isRefreshing || isCrawling}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              刷新数据
            </Button>
            <Button
              onClick={handleCrawl}
              disabled={isCrawling}
              className="bg-gradient-to-r from-[#00f5d4] to-[#b794f6] hover:opacity-90 text-black font-semibold"
            >
              <Play className="w-4 h-4 mr-2" />
              {isCrawling ? '采集中...' : '执行采集'}
            </Button>
          </div>

          {/* 采集历史 */}
          {lastCrawlTime && (
            <div className="text-center text-xs text-gray-500 mt-2">
              上次采集: {lastCrawlTime}
            </div>
          )}

          {/* 状态标签 */}
          <div className="flex justify-center gap-2 mt-3">
            <Badge className="bg-[#00f5d4]/10 text-[#00f5d4] border-[#00f5d4]/30">
              自动刷新: 30s
            </Badge>
            <Badge className="bg-[#b794f6]/10 text-[#b794f6] border-[#b794f6]/30">
              数据源: InStreet
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
