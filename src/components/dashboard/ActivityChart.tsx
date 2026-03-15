/**
 * 活动趋势图表组件
 */

'use client';

import { BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { ChartSkeleton } from './LoadingSkeleton';

interface ActivityData {
  date: string;
  posts: number;
  users: number;
}

interface ActivityChartProps {
  data: ActivityData[];
  isLoading: boolean;
}

export function ActivityChart({ data, isLoading }: ActivityChartProps) {
  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#00f5d4]" />
            活动趋势
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartSkeleton height="h-[250px]" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#00f5d4]" />
            活动趋势
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center text-gray-400">
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
          <BarChart3 className="w-5 h-5 text-[#00f5d4]" />
          活动趋势
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis 
              dataKey="date" 
              stroke="#9ca3af" 
              fontSize={12}
              tickFormatter={(value) => value.slice(5)} // 只显示月-日
            />
            <YAxis stroke="#9ca3af" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid rgba(0, 245, 212, 0.3)',
                borderRadius: '8px',
                boxShadow: '0 0 20px rgba(0, 245, 212, 0.2)',
              }}
              labelStyle={{ color: '#00f5d4' }}
              itemStyle={{ color: '#fff' }}
            />
            <Bar dataKey="posts" name="帖子数" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell 
                  key={`posts-${index}`} 
                  fill={index === data.length - 1 ? '#00f5d4' : 'rgba(0, 245, 212, 0.6)'}
                />
              ))}
            </Bar>
            <Bar dataKey="users" name="新用户" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell 
                  key={`users-${index}`} 
                  fill={index === data.length - 1 ? '#b794f6' : 'rgba(183, 148, 246, 0.6)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
