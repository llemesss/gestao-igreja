'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { useRouter } from 'next/navigation';
import { PrayerStatusCard } from '@/components/PrayerStatusCard';
import { Users } from 'lucide-react';
import CellCard from '@/components/CellCard';
import SupervisedCellCard from '@/components/SupervisedCellCard';
import { User, PrayerStats, Cell } from '@/types';

// Base da API: usa NEXT_PUBLIC_API_URL ou fallback para dev local
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

interface DashboardSupervisorViewProps {
  user: User;
  prayerStats?: PrayerStats | null;
  supervisedCells?: Cell[];
  onCellClick?: (cellId: string) => void;
}

export default function DashboardSupervisorView({ 
  user, 
  prayerStats, 
  supervisedCells = [], 
  onCellClick 
}: DashboardSupervisorViewProps) {
  const router = useRouter();

  const handleRegisterPrayer = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`${API_URL}/prayers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Recarregar a página para atualizar as estatísticas
        window.location.reload();
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao registrar oração');
      }
    } catch (error) {
      console.error('Erro ao registrar oração:', error);
      alert('Erro ao registrar oração');
    }
  };

  const handleCellClick = (cellId: string) => {
    if (onCellClick) {
      onCellClick(cellId);
    } else {
      router.push(`/celulas/${cellId}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Saudação */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Olá, {user?.name}!
            </h2>
            <p className="text-gray-600">
              Bem-vindo ao seu painel de supervisão.
            </p>
          </div>
          <div className="text-right">
            <span className="text-sm font-medium text-gray-700">
              Células Supervisionadas: <span className="text-blue-600 font-semibold">{supervisedCells.length}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Estatísticas de Oração */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <PrayerStatusCard />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Esta Semana</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {prayerStats?.week_prayers || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Este Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {prayerStats?.total_prayers || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Células Supervisionadas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Minhas Células Supervisionadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Array.isArray(supervisedCells) && supervisedCells.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {supervisedCells.map((cell) => (
                <SupervisedCellCard
                  key={cell.id}
                  id={cell.id.toString()}
                  name={cell.name}
                  supervisorName={cell.supervisor_name}
                  leaderName={
                    (cell.leaders && cell.leaders.length > 0 
                      ? cell.leaders.map(leader => leader.name).join(', ')
                      : undefined
                    )
                  }
                  memberCount={cell.member_count}
                  onClick={handleCellClick}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">Nenhuma célula supervisionada encontrada.</p>
              <p className="text-sm text-gray-500 mt-1">
                Entre em contato com o administrador para designar células.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ações Rápidas */}
      <Card>
        <CardHeader>
          <CardTitle>Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4">
            <button 
              onClick={handleRegisterPrayer}
              disabled={(prayerStats?.recent_prayers || 0) > 0}
              className={`p-4 border rounded-lg transition-colors text-left ${
                (prayerStats?.recent_prayers || 0) > 0 
                  ? 'border-gray-300 bg-gray-100 text-gray-500 cursor-not-allowed' 
                  : 'border-gray-200 hover:bg-gray-50 text-gray-900'
              }`}
            >
              <div className="text-sm font-medium">
                {(prayerStats?.recent_prayers || 0) > 0 ? 'Oração Já Registrada Hoje' : 'Registrar Oração'}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {(prayerStats?.recent_prayers || 0) > 0 
                  ? 'Você já registrou sua oração hoje' 
                  : 'Registre seu tempo de oração hoje'
                }
              </div>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}