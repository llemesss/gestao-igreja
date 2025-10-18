'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui';
import { auth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface HeaderProps {
  title?: string;
}

export function Header({ title }: HeaderProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const user = isHydrated ? auth.getUser() : null;
  const router = useRouter();

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const handleLogout = () => {
    auth.logout();
    router.push('/login');
  };

  const getRoleDisplay = (role: string) => {
    const roleMap: { [key: string]: string } = {
      'ADMIN': 'Administrador',
      'PASTOR': 'Pastor',
      'COORDENADOR': 'Coordenador',
      'SUPERVISOR': 'Supervisor',
      'LIDER': 'Líder',
      'MEMBRO': 'Membro'
    };
    return roleMap[role] || role;
  };

  if (!isHydrated) return null;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-lg">
      {/* Nível 1: Nome do Usuário e Sair */}
      <div className="flex justify-between items-center p-3 border-b border-gray-100">
        {/* Logo/Título (Painel Administrativo) */}
        <h1 className="text-lg font-semibold">Painel Administrativo</h1>
        {/* Informações do Admin e Sair */}
        {user && (
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500">{getRoleDisplay(user.role)}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
            >
              Sair
            </Button>
          </div>
        )}
      </div>

      {/* Nível 2: Botões de Navegação (Menu) */}
      <nav className="flex space-x-4 p-3">
        <Link href="/dashboard" className="px-3 py-1 rounded text-gray-700 hover:bg-gray-100">Início</Link>
        <Link href="/dashboard?tab=oracoes" className="px-3 py-1 rounded text-gray-700 hover:bg-gray-100">Orações</Link>
        <Link href="/dashboard?tab=perfil" className="px-3 py-1 rounded text-gray-700 hover:bg-gray-100">Meu Perfil</Link>
        <Link href="/celulas" className="px-3 py-1 rounded text-gray-700 hover:bg-gray-100">Gerenciar Células</Link>
        <Link href="/usuarios" className="px-3 py-1 rounded text-gray-700 hover:bg-gray-100">Gerenciar Usuários</Link>
      </nav>
    </header>
  );
}