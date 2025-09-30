'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { auth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Menu, X, FileText } from 'lucide-react';

interface SidebarItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: string[];
}

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const sidebarItems: SidebarItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
      </svg>
    ),
    roles: ['ADMIN', 'PASTOR', 'COORDENADOR', 'SUPERVISOR', 'LIDER', 'MEMBRO']
  },
  {
    label: 'Usuários',
    href: '/usuarios',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
    roles: ['ADMIN']
  },
  {
    label: 'Células',
    href: '/celulas',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    roles: ['ADMIN', 'PASTOR', 'COORDENADOR', 'SUPERVISOR', 'LIDER']
  },
  {
    label: 'Orações',
    href: '/oracoes',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
    roles: ['ADMIN', 'PASTOR', 'COORDENADOR', 'SUPERVISOR', 'LIDER', 'MEMBRO']
  },
  {
    label: 'Perfil',
    href: '/perfil',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    roles: ['ADMIN', 'PASTOR', 'COORDENADOR', 'SUPERVISOR', 'LIDER', 'MEMBRO']
  }
];

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);
  const user = isHydrated ? auth.getUser() : null;

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  if (!isHydrated || !user) return null;

  const allowedItems = sidebarItems.filter(item => 
    item.roles.includes(user.role)
  );

  const handleReportClick = () => {
    if (user.cell_id) {
      router.push(`/reports/new/${user.cell_id}`);
    }
    // Fechar sidebar no mobile após clicar
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      onToggle();
    }
  };

  return (
    <>
      {/* Overlay para mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}
      
      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-20 z-50 h-[calc(100vh-5rem)] bg-white border-r border-gray-200 transition-transform duration-300 ease-in-out",
        "w-64",
        isOpen ? "translate-x-0" : "-translate-x-full",
        "lg:relative lg:top-0 lg:h-full lg:translate-x-0"
      )}>
        {/* Header do sidebar com botão de fechar */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
          <button
            onClick={onToggle}
            className="p-1 rounded-md hover:bg-gray-100 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navegação */}
        <nav className="p-4 space-y-2">
          {allowedItems.map((item) => {
            const isActive = pathname === item.href;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(e) => {
                  // Fechar sidebar no mobile após clicar em um link
                  if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                    onToggle();
                  }
                }}
                className={cn(
                  'flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* Botão condicional para secretários de célula */}
          {user?.isCellSecretary && (
            <button
              onClick={handleReportClick}
              className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 bg-green-600 text-white hover:bg-green-700 shadow-md"
            >
              <FileText className="w-5 h-5" />
              <span>Preencher Relatório</span>
            </button>
          )}
        </nav>
      </aside>
    </>
  );
}