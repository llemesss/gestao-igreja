'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { useRouter } from 'next/navigation';
import { PrayerStatusCard } from '@/components/PrayerStatusCard';
import { Users } from 'lucide-react';
import SupervisedCellCard from '@/components/SupervisedCellCard';
import { User, PrayerStats, Cell } from '@/types';

// Removido uso direto de API_URL para evitar erros de base sem /api

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

  // Estado robusto para listas (exemplo futuro, se adicionar mais listas)
  // const [cells, setCells] = useState<Cell[]>([]);
  // const [members, setMembers] = useState<User[]>([]);

  // Garante que supervisedCells é sempre array
  const safeSupervisedCells: Cell[] = Array.isArray(supervisedCells) ? supervisedCells : [];

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
              Células Supervisionadas: <span className="text-blue-600 font-semibold">{Array.isArray(safeSupervisedCells) ? safeSupervisedCells.length : 0}</span>
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
          {Array.isArray(safeSupervisedCells) && safeSupervisedCells.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {safeSupervisedCells.map((cell) => (
                <SupervisedCellCard
                  key={cell.id}
                  id={cell.id.toString()}
                  name={cell.name}
                  supervisorName={cell.supervisor_name}
                  leaderName={
                    (Array.isArray(cell.leaders) && cell.leaders.length > 0
                      ? cell.leaders.map(leader => leader.name).join(', ')
                      : undefined)
                  }
                  memberCount={typeof cell.member_count === 'number' ? cell.member_count : 0}
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

      
    </div>
  );
}