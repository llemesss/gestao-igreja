'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/auth';
import { PrayerStatusCard } from '@/components/PrayerStatusCard';
import { useState } from 'react';
import { Settings } from 'lucide-react';
import { api } from '@/lib/api';
import { CreateEditCellModal } from '@/components/CreateEditCellModal';
import { User, PrayerStats, Cell } from '@/types';

// Configuração da API
const API_URL = process.env.NEXT_PUBLIC_API_URL || (
  process.env.NODE_ENV === 'production' 
    ? '/.netlify/functions' 
    : 'http://localhost:5000/api'
);

interface Leader {
  id: string;
  name: string;
  role: string;
}

interface CellForModal {
  id: string;
  name: string;
  supervisor_id?: string;
  supervisor_name?: string;
  secretary_id?: string;
  secretary_name?: string;
  leaders: Array<{
    id: string;
    name: string;
  }>;
  member_count: number;
  created_at: string;
  updated_at: string;
}

interface DashboardHomeViewProps {
  user: User | null;
  prayerStats?: PrayerStats | null;
  cells?: Cell[];
  userCell?: Cell | null;
}

export default function DashboardHomeView({ user, prayerStats, cells = [], userCell }: DashboardHomeViewProps) {
  if (!user) return null;
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<CellForModal | null>(null);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loadingCell, setLoadingCell] = useState(false);

  const isLeader = user.role === 'LIDER';

  const handleManageCell = async () => {
    if (!userCell) return;

    setLoadingCell(true);
    try {
      // Buscar dados completos da célula
      const cellResponse = await api.get(`/cells/${userCell.id}`);
      const cellData = cellResponse.data;

      // Buscar líderes disponíveis
      const leadersResponse = await api.get('/users?role=LIDER');
      
      setSelectedCell({
        id: cellData.id.toString(),
        name: cellData.name,
        supervisor_id: cellData.supervisor_id?.toString(),
        supervisor_name: cellData.supervisor_name,
        secretary_id: cellData.secretary_id?.toString(),
        secretary_name: cellData.secretary_name,
        leaders: cellData.leaders?.map((leader: { id: string; name: string }) => ({
          id: leader.id.toString(),
          name: leader.name
        })) || [],
        member_count: cellData.member_count || 0,
        created_at: cellData.created_at,
        updated_at: cellData.updated_at
      });

      setLeaders(leadersResponse.data.users?.map((leader: { id: string; name: string; role: string }) => ({
        id: leader.id.toString(),
        name: leader.name,
        role: leader.role
      })) || []);

      setIsEditModalOpen(true);
    } catch (error: unknown) {
      console.error('Erro ao carregar dados da célula:', error);
      
      // Mostrar mensagem de erro mais específica para o usuário
      const errorMessage = (error as any).response?.data?.error || 'Erro desconhecido ao carregar dados da célula';
      alert(`Erro: ${errorMessage}`);
    } finally {
      setLoadingCell(false);
    }
  };

  const handleSaveCell = async (data: { name: string; leader_ids?: string[]; secretary_id?: string }) => {
    if (!selectedCell) return;

    try {
      await api.put(`/cells/${selectedCell.id}`, {
        name: data.name,
        leader_ids: data.leader_ids,
        secretary_id: data.secretary_id
      });

      // Recarregar a página para atualizar os dados
      window.location.reload();
    } catch (error) {
      console.error('Erro ao salvar célula:', error);
      throw error;
    }
  };
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

  const handleViewCells = () => {
    router.push('/celulas');
  };

  const handleManageUsers = () => {
    router.push('/usuarios');
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
              Bem-vindo ao sistema de gestão da igreja.
            </p>
          </div>
          {user?.cell_name && (
            <div className="text-right">
              <span className="text-sm font-medium text-gray-700">
                Célula: <span className="text-blue-600 font-semibold">{user.cell_name}</span>
              </span>
            </div>
          )}
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

      {/* Células (para líderes e acima) */}
      {auth.isLeaderOrAbove() && (
        <Card>
          <CardHeader>
            <CardTitle>Minhas Células</CardTitle>
          </CardHeader>
          <CardContent>
            {cells.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cells.map((cell) => (
                  <div
                    key={cell.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/celulas/${cell.id}`)}
                  >
                    <h3 className="font-medium text-gray-900">{cell.name}</h3>
                    <div className="mt-2 text-xs text-gray-500">
                      Supervisor: {cell.supervisor_name || 'Não definido'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">Nenhuma célula encontrada.</p>
            )}
          </CardContent>
        </Card>
      )}

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

            {/* Botão Gerenciar Célula para Líderes */}
            {isLeader && userCell && (
              <button 
                onClick={handleManageCell}
                disabled={loadingCell}
                className="p-4 border border-gray-200 rounded-lg transition-colors text-left hover:bg-gray-50 text-gray-900"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium flex items-center">
                      <Settings className="w-4 h-4 mr-2" />
                      {loadingCell ? 'Carregando...' : 'Gerenciar Célula'}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      Gerencie sua célula: {userCell.name}
                    </div>
                  </div>
                </div>
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal de Edição de Célula */}
      <CreateEditCellModal
        isOpen={isEditModalOpen}
        cell={selectedCell}
        leaders={leaders}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedCell(null);
        }}
        onSave={handleSaveCell}
      />
    </div>
  );
}