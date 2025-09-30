'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui';
import { auth } from '@/lib/auth';
import { useRouter } from 'next/navigation';

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
    <header className="bg-white border-b border-gray-200 px-6 py-4 relative z-30 fixed top-0 left-0 right-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
          </div>
        </div>
        
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
    </header>
  );
}