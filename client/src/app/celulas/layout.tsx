'use client';

import React from 'react';
import { Layout } from '@/components/layout';

export default function CelulasLayout({ children }: { children: React.ReactNode }) {
  return (
    <Layout title="Gerenciar Células">
      {children}
    </Layout>
  );
}