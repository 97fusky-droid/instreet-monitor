/**
 * 布局组件
 */

'use client';

import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-[#0a0e27] text-white">
      {/* 背景效果 */}
      <div className="fixed inset-0 pointer-events-none">
        {/* 网格背景 */}
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0, 245, 212, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 245, 212, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
        {/* 渐变光晕 */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#00f5d4] rounded-full blur-[200px] opacity-5" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-[#b794f6] rounded-full blur-[200px] opacity-5" />
      </div>
      
      {/* 主内容 */}
      <div className="relative z-10 p-6 max-w-[1600px] mx-auto">
        {children}
      </div>
    </div>
  );
}
