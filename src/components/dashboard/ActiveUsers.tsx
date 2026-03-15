/**
 * 活跃用户组件
 */

'use client';

import { User, Award, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ActiveUsersSkeleton } from './LoadingSkeleton';
import type { UserRecord } from '@/lib/storage';

interface ActiveUsersProps {
  users: UserRecord[];
  isLoading: boolean;
}

export function ActiveUsers({ users, isLoading }: ActiveUsersProps) {
  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-[#ffd93d]" />
            活跃用户
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ActiveUsersSkeleton count={5} />
        </CardContent>
      </Card>
    );
  }

  if (users.length === 0) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-[#ffd93d]" />
            活跃用户
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
          <Award className="w-5 h-5 text-[#ffd93d]" />
          活跃用户
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[280px] pr-4 custom-scrollbar">
          <div className="space-y-3">
            {users.map((user, index) => (
              <div 
                key={user.username || index} 
                className="flex items-center gap-3 glass-card p-3 cursor-pointer hover:border-[#00f5d4]/50 transition-colors"
              >
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00f5d4] to-[#b794f6] flex items-center justify-center font-bold text-black">
                    {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
                  </div>
                  {index === 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#ffd93d] flex items-center justify-center">
                      <span className="text-xs">👑</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">
                    @{user.username || '未知用户'}
                  </p>
                  <p className="text-xs text-gray-400">
                    帖子: {user.posts_count || 0} · 粉丝: {user.followers_count || 0}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge 
                    className={`
                      ${index === 0 ? 'bg-[#ffd93d]/20 text-[#ffd93d] border-[#ffd93d]/30' : ''}
                      ${index === 1 ? 'bg-gray-400/20 text-gray-400 border-gray-400/30' : ''}
                      ${index === 2 ? 'bg-amber-600/20 text-amber-600 border-amber-600/30' : ''}
                      ${index > 2 ? 'bg-white/10 text-gray-400 border-white/20' : ''}
                    `}
                  >
                    #{index + 1}
                  </Badge>
                  {index < 3 && (
                    <TrendingUp className="w-3 h-3 text-green-400" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
