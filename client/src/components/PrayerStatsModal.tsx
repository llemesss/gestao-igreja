import React, { useEffect, useState } from 'react';
import { auth } from '@/lib/auth';
import { apiMethods } from '@/lib/api';
import { X } from 'lucide-react';

// Removido uso direto de API_URL para evitar erros de base sem /api

interface PrayerStatsData {
  stats?: {
    total_prayers: number;
    recent_prayers: number;
    week_prayers: number;
    last_prayer_date: string | null;
    first_prayer_date: string | null;
    prayed_today: boolean;
  };
  history?: string[];
  // Formato alternativo para a rota /stats/:userId
  total_prayers?: number;
  prayers_this_month?: number;
  prayers_this_week?: number;
  average_per_week?: number;
  streak_days?: number;
  last_prayer_date?: string | null;
  prayer_history?: Array<{date: string; count: number}>;
}

interface PrayerStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
}

export function PrayerStatsModal({ isOpen, onClose, userId }: PrayerStatsModalProps) {
  const [stats, setStats] = useState<PrayerStatsData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadStats();
    }
  }, [isOpen, userId]);

  const loadStats = async () => {
    setLoading(true);
    try {
      // Usa axios via apiMethods; interceptors cuidam do token
      const data = userId
        ? await apiMethods.prayers.getUserStats(userId)
        : await apiMethods.prayers.getMyStats();
      setStats(data);
    } catch (error) {
      console.error('Erro ao carregar estatísticas (catch):', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Nunca';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getCurrentYear = () => new Date().getFullYear();
  const getCurrentMonth = () => new Date().toLocaleDateString('pt-BR', { month: 'long' });

  // Calcular orações no ano atual
  const getPrayersThisYear = () => {
    if (stats?.history) {
      const currentYear = getCurrentYear();
      return stats.history.filter(date => {
        const prayerYear = new Date(date).getFullYear();
        return prayerYear === currentYear;
      }).length;
    } else if (stats?.prayer_history) {
      const currentYear = getCurrentYear();
      return stats.prayer_history
        .filter(item => new Date(item.date).getFullYear() === currentYear)
        .reduce((total, item) => total + item.count, 0);
    }
    return 0;
  };

  // Calcular orações no mês atual
  const getPrayersThisMonth = () => {
    if (stats?.history) {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      
      return stats.history.filter(date => {
        const prayerDate = new Date(date);
        return prayerDate.getFullYear() === currentYear && 
               prayerDate.getMonth() === currentMonth;
      }).length;
    } else if (stats?.prayers_this_month !== undefined) {
      return stats.prayers_this_month;
    }
    return 0;
  };

  // Verificar se orou hoje
  const getPrayedToday = () => {
    if (stats?.stats?.prayed_today !== undefined) {
      return stats.stats.prayed_today;
    }
    // Para a rota /stats/:userId, verificar se há oração hoje no histórico
    if (stats?.prayer_history) {
      const today = new Date().toISOString().split('T')[0];
      return stats.prayer_history.some(item => item.date === today && item.count > 0);
    }
    return false;
  };

  // Obter última data de oração
  const getLastPrayerDate = () => {
    if (stats?.stats?.last_prayer_date) {
      return stats.stats.last_prayer_date;
    } else if (stats?.last_prayer_date) {
      return stats.last_prayer_date;
    }
    return null;
  };

  // Obter total de orações
  const getTotalPrayers = () => {
    if (stats?.stats?.total_prayers !== undefined) {
      return stats.stats.total_prayers;
    } else if (stats?.total_prayers !== undefined) {
      return stats.total_prayers;
    }
    return 0;
  };

  // Obter orações da semana
  const getWeekPrayers = () => {
    if (stats?.stats?.week_prayers !== undefined) {
      return stats.stats.week_prayers;
    } else if (stats?.prayers_this_week !== undefined) {
      return stats.prayers_this_week;
    }
    return 0;
  };

  // Obter primeira data de oração
  const getFirstPrayerDate = () => {
    if (stats?.stats?.first_prayer_date) {
      return stats.stats.first_prayer_date;
    }
    // Para a rota /stats/:userId, não temos essa informação
    return null;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Estatísticas de Oração
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : stats ? (
          <div className="space-y-6">
            {/* Status Atual */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-3">Status Atual</h3>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Orou hoje?</span>
                <span className={`font-semibold ${
                  getPrayedToday() ? 'text-green-600' : 'text-red-600'
                }`}>
                  {getPrayedToday() ? 'SIM' : 'NÃO'}
                </span>
              </div>
            </div>

            {/* Última Oração */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-3">Última Oração</h3>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {formatDate(getLastPrayerDate())}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Data da última oração registrada
                </div>
              </div>
            </div>

            {/* Estatísticas do Período */}
            <div className="grid grid-cols-2 gap-4">
              {/* Orações no Mês */}
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {getPrayersThisMonth()}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Orações em {getCurrentMonth()}
                </div>
              </div>

              {/* Orações no Ano */}
              <div className="bg-purple-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {getPrayersThisYear()}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Orações em {getCurrentYear()}
                </div>
              </div>
            </div>

            {/* Estatísticas Gerais */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-3">Estatísticas Gerais</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total de orações:</span>
                  <span className="font-semibold">{getTotalPrayers()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Esta semana:</span>
                  <span className="font-semibold">{getWeekPrayers()}</span>
                </div>
                {getFirstPrayerDate() && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Primeira oração:</span>
                    <span className="font-semibold">{formatDate(getFirstPrayerDate())}</span>
                  </div>
                )}
                {stats.streak_days !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Sequência atual:</span>
                    <span className="font-semibold">{stats.streak_days} dias</span>
                  </div>
                )}
                {stats.average_per_week !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Média semanal:</span>
                    <span className="font-semibold">{stats.average_per_week.toFixed(1)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            Erro ao carregar estatísticas
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}