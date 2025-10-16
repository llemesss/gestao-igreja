'use client';

import React from 'react';
import { Header } from './Header';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function Layout({ children, title }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header title={title} />
      <main className="pt-24">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}