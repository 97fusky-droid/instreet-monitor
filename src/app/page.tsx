'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export default function Home() {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeSite = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/analyze-site', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: 'https://instreet.coze.site/' }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Instreet 论坛分析工具</h1>
          <p className="text-muted-foreground text-lg">
            分析 https://instreet.coze.site/ 网站的结构和内容
          </p>
        </div>

        <div className="flex justify-center">
          <Button onClick={analyzeSite} disabled={loading} size="lg">
            {loading ? '分析中...' : '开始分析网站'}
          </Button>
        </div>

        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive font-semibold">错误: {error}</p>
            </CardContent>
          </Card>
        )}

        {analysis && (
          <div className="space-y-6">
            {/* 基本信息 */}
            <Card>
              <CardHeader>
                <CardTitle>网站基本信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="font-semibold">标题：</span>
                  <span className="text-muted-foreground">{analysis.title}</span>
                </div>
                <div>
                  <span className="font-semibold">URL：</span>
                  <span className="text-muted-foreground">{analysis.url}</span>
                </div>
                {analysis.publishTime && (
                  <div>
                    <span className="font-semibold">发布时间：</span>
                    <span className="text-muted-foreground">{analysis.publishTime}</span>
                  </div>
                )}
                {analysis.filetype && (
                  <div>
                    <span className="font-semibold">文件类型：</span>
                    <Badge>{analysis.filetype}</Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 内容统计 */}
            <Card>
              <CardHeader>
                <CardTitle>内容统计</CardTitle>
                <CardDescription>网站包含的内容类型分布</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">{analysis.contentStats?.textCount || 0}</div>
                    <div className="text-sm text-muted-foreground mt-1">文本块</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">{analysis.contentStats?.imageCount || 0}</div>
                    <div className="text-sm text-muted-foreground mt-1">图片</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600">{analysis.contentStats?.linkCount || 0}</div>
                    <div className="text-sm text-muted-foreground mt-1">链接</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 文本预览 */}
            {analysis.textPreview && analysis.textPreview.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>文本内容预览</CardTitle>
                  <CardDescription>前5个文本块（每个最多200字符）</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {analysis.textPreview.map((text: string, index: number) => (
                    <div key={index}>
                      <div className="text-sm font-medium text-muted-foreground mb-1">文本块 {index + 1}</div>
                      <p className="text-sm bg-muted p-3 rounded-md">{text}...</p>
                      {index < analysis.textPreview.length - 1 && <Separator className="mt-4" />}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* 链接列表 */}
            {analysis.links && analysis.links.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>发现的链接</CardTitle>
                  <CardDescription>共找到 {analysis.links.length} 个链接</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {analysis.links.slice(0, 20).map((link: string, index: number) => (
                      <div key={index} className="flex items-center gap-2">
                        <Badge variant="outline">{index + 1}</Badge>
                        <a 
                          href={link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline truncate"
                        >
                          {link}
                        </a>
                      </div>
                    ))}
                    {analysis.links.length > 20 && (
                      <p className="text-sm text-muted-foreground text-center mt-4">
                        还有 {analysis.links.length - 20} 个链接未显示...
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
