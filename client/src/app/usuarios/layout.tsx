'use client';

import React from 'react';
import { Layout } from '@/components/layout';

export default function UsuariosLayout({ children }: { children: React.ReactNode }) {
  return (
    <Layout title="Gerenciar Usuários">
      {children}
    </Layout>
  );
}