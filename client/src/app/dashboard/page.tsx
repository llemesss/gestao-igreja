'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Layout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { auth } from '@/lib/auth';
import { api, apiMethods } from '@/lib/api';
import { PrayerStats, Cell } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';

// Views components (will be created)
import DashboardHomeView from '@/components/views/DashboardHomeView';
import DashboardSupervisorView from '@/components/views/DashboardSupervisorView';
import CellDetailView from '@/components/views/CellDetailView';
import OracaoView from '@/components/views/OracaoView';
import { default as MeuPerfilView } from '@/components/views/MeuPerfilView';
import GerenciarCelulasView from '@/components/views/GerenciarCelulasView';
import GerenciarUsuariosView from '@/components/views/GerenciarUsuariosView';
import LiderCellView from '@/components/views/LiderCellView';

type ViewType = 'inicio' | 'oracoes' | 'perfil' | 'gerenciarCelulas' | 'gerenciarUsuarios' | 'cellDetail';

export default function DashboardPage() {
  const [prayerStats, setPrayerStats] = useState<PrayerStats | null>(null);
  const [cells, setCells] = useState<Cell[]>([]);
  const [supervisedCells, setSupervisedCells] = useState<Cell[]>([]);
  const [userCell, setUserCell] = useState<Cell | null>(null);
  const [loading, setLoading] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeView, setActiveView] = useState<ViewType>('inicio');
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const user = isHydrated ? auth.getUser() : null;
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Verificar autenticação
  useEffect(() => {
    if (isHydrated && !auth.isAuthenticated()) {
      router.push('/login');
      return;
    }
  }, [isHydrated, router]);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        // Carregar estatísticas de oração usando o novo endpoint
        const statsResponse = await apiMethods.prayers.getStats();
        if (statsResponse) {
          setPrayerStats({
            recent_prayers: statsResponse.prayersToday ? 1 : 0,
            week_prayers: statsResponse.prayersThisWeek,
            total_prayers: statsResponse.prayersThisMonth,
            prayed_today: statsResponse.prayersToday || false
          });
        }

        // Carregar células supervisionadas para supervisores
        if (user && user.role === 'SUPERVISOR') {
          const cellsResponse = await apiMethods.cells.getMyCells();
          
          // LOG DE VERIFICAÇÃO: para vermos a estrutura da resposta
          console.log('ESTRUTURA DA RESPOSTA DA API DE CÉLULAS:', cellsResponse);
          
          if (cellsResponse) {
            // Garantir que sempre salvamos um array
            if (Array.isArray(cellsResponse)) {
              setSupervisedCells(cellsResponse);
            } else if (cellsResponse.cells && Array.isArray(cellsResponse.cells)) {
              setSupervisedCells(cellsResponse.cells);
            } else if (cellsResponse.data && Array.isArray(cellsResponse.data)) {
              setSupervisedCells(cellsResponse.data);
            } else {
              console.warn('Resposta da API não contém um array válido:', cellsResponse);
              setSupervisedCells([]);
            }
          }
        }
        // Carregar células (se tiver permissão)
        else if (user && auth.isLeaderOrAbove()) {
          const cellsResponse = await apiMethods.cells.getCells();
          if (Array.isArray(cellsResponse)) {
            setCells(cellsResponse);
          } else if (cellsResponse && Array.isArray((cellsResponse as any).data)) {
            setCells((cellsResponse as any).data);
          } else {
            setCells([]);
          }
        }

        // Para supervisores, não carregar célula individual do usuário
        // pois eles devem ver apenas as células que supervisionam
        if (user && user.cell_id && user.role !== 'SUPERVISOR') {
          const cellResponse = await apiMethods.cells.getDetail(user.cell_id);
          if (cellResponse) {
            setUserCell(cellResponse);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar dados do dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isHydrated && user) {
      loadDashboardData();
    }
  }, [isHydrated]); // Removendo 'user' das dependências para evitar loop infinito

  useEffect(() => {
    if (!isHydrated) return;
    const tabParam = searchParams.get('tab');
    const allowed: ViewType[] = ['inicio','oracoes','perfil','gerenciarCelulas','gerenciarUsuarios','cellDetail'];
    if (tabParam && allowed.includes(tabParam as ViewType)) {
      setActiveView(tabParam as ViewType);
    }
  }, [searchParams, isHydrated]);
  const getRoleGreeting = () => {
    if (!user) return 'Bem-vindo';
    
    const greetings: Record<string, string> = {
      ADMIN: 'Painel Administrativo',
      PASTOR: 'Painel Pastoral',
      COORDENADOR: 'Painel de Coordenação',
      SUPERVISOR: 'Painel de Supervisão',
      LIDER: 'Painel de Liderança',
      MEMBRO: 'Meu Painel'
    };
    
    return greetings[user.role] || 'Dashboard';
  };

  const handleRegisterPrayer = () => {
    router.push('/oracoes');
  };

  const handleViewCells = () => {
    router.push('/celulas');
  };

  const handleManageUsers = () => {
    router.push('/usuarios');
  };


  if (loading) {
    return (
      <Layout title={getRoleGreeting()}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout title="Usuário não encontrado">
        <div className="flex items-center justify-center h-64">
          <div className="text-red-600 font-bold">Usuário não encontrado. Faça login novamente.</div>
        </div>
      </Layout>
    );
  }

  const handleCellClick = (cellId: string) => {
    setSelectedCellId(cellId);
    setActiveView('cellDetail');
  };

  const handleBackFromCellDetail = () => {
    setSelectedCellId(null);
    setActiveView('inicio');
  };

  const renderView = () => {
    switch (activeView) {
      case 'inicio':
        // Renderização condicional baseada na role do usuário
        if (user?.role === 'SUPERVISOR') {
          return (
            <DashboardSupervisorView 
              user={user} 
              prayerStats={prayerStats} 
              supervisedCells={supervisedCells}
              onCellClick={handleCellClick}
            />
          );
        }
        return <DashboardHomeView user={user} prayerStats={prayerStats} cells={cells} userCell={userCell} />;
      case 'cellDetail':
        if (selectedCellId) {
          return (
            <CellDetailView 
              cellId={selectedCellId} 
              onBack={handleBackFromCellDetail}
            />
          );
        }
        return <div>Erro: Célula não selecionada</div>;
      case 'oracoes':
        return <OracaoView />;
      case 'perfil':
        return <MeuPerfilView />;
      case 'gerenciarCelulas':
        // Renderização condicional baseada na role do usuário
        if (user?.role === 'LIDER') {
          return <LiderCellView />;
        }
        return <GerenciarCelulasView />;
      case 'gerenciarUsuarios':
        return <GerenciarUsuariosView />;
      default:
        // Renderização condicional também no default
        if (user?.role === 'SUPERVISOR') {
          return (
            <DashboardSupervisorView 
              user={user} 
              prayerStats={prayerStats} 
              supervisedCells={supervisedCells}
              onCellClick={handleCellClick}
            />
          );
        }
        return <DashboardHomeView user={user} prayerStats={prayerStats} cells={cells} userCell={userCell} />;
    }
  };

  return (
    <Layout title={getRoleGreeting()}>
      {/* Navigation Tabs */}
      {false && (
        <nav className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <button
            onClick={() => setActiveView('inicio')}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 mr-4 ${
              activeView === 'inicio'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Início
          </button>
          <button
            onClick={() => setActiveView('oracoes')}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 mr-4 ${
              activeView === 'oracoes'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Orações
          </button>
          <button
            onClick={() => setActiveView('perfil')}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 mr-4 ${
              activeView === 'perfil'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Meu Perfil
          </button>
      
          {/* Botão Gerenciar Célula - Para Líderes */}
          {user?.role === 'LIDER' && (
            <button
              onClick={() => setActiveView('gerenciarCelulas')}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 mr-4 ${
                activeView === 'gerenciarCelulas'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Gerenciar Célula
            </button>
          )}
      
          {/* Botões de Gerenciamento - Apenas para Admins */}
          {auth.hasRole(['ADMIN', 'PASTOR', 'COORDENADOR', 'SUPERVISOR']) && (
            <>
              <button
                onClick={() => setActiveView('gerenciarCelulas')}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 mr-4 ${
                  activeView === 'gerenciarCelulas'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Gerenciar Células
              </button>
              {/* Gerenciar Usuários - Apenas para ADMIN e PASTOR */}
              {auth.hasRole(['ADMIN', 'PASTOR']) && (
                <button
                  onClick={() => setActiveView('gerenciarUsuarios')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    activeView === 'gerenciarUsuarios'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Gerenciar Usuários
                </button>
              )}
            </>
          )}
        </nav>
      )}

      {/* Dynamic Content Area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeView}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3 }}
        >
          {renderView()}
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}