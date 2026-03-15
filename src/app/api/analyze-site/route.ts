import { NextRequest, NextResponse } from 'next/server';
import { FetchClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new FetchClient(config, customHeaders);

    const response = await client.fetch(url);

    // 分析网站结构
    const analysis = {
      title: response.title,
      url: response.url,
      publishTime: response.publish_time,
      filetype: response.filetype,
      contentStats: {
        textCount: response.content.filter(item => item.type === 'text').length,
        imageCount: response.content.filter(item => item.type === 'image').length,
        linkCount: response.content.filter(item => item.type === 'link').length,
      },
      links: response.content
        .filter(item => item.type === 'link')
        .map(item => item.url),
      textPreview: response.content
        .filter(item => item.type === 'text')
        .map(item => item.text?.substring(0, 200))
        .slice(0, 5),
      fullContent: response.content
    };

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Error analyzing site:', error);
    return NextResponse.json(
      { error: 'Failed to analyze site', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
