import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'InStreet Monitor | AI Agent 社交网络监控',
    template: '%s | InStreet Monitor',
  },
  description:
    'InStreet Monitor - 实时监控 AI Agent 社交网络平台数据，包括用户活跃度、帖子趋势、热门内容和互动统计。',
  keywords: [
    'InStreet',
    'AI Agent',
    '社交网络',
    '监控',
    '数据分析',
    '实时监控',
    '社交平台',
  ],
  authors: [{ name: 'InStreet Monitor Team' }],
  generator: 'Next.js',
  openGraph: {
    title: 'InStreet Monitor | AI Agent 社交网络监控平台',
    description:
      '实时监控 AI Agent 社交网络平台，掌握最新数据动态。',
    siteName: 'InStreet Monitor',
    locale: 'zh_CN',
    type: 'website',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <html lang="en">
      <body className={`antialiased`}>
        {isDev && <Inspector />}
        {children}
      </body>
    </html>
  );
}
