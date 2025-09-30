'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { ArrowLeft, Calendar, User, Printer } from 'lucide-react';

interface UserProfile {
  id: number;
  name: string;
  email?: string;
  cell_name?: string;
  role?: string;
}

interface PrayerCalendarPrintClientProps {
  params: { userId: string };
}

const PrayerCalendarPrintClient: React.FC<PrayerCalendarPrintClientProps> = ({ params }) => {
  const router = useRouter();
  const userId = params.userId;
  
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [prayedDates, setPrayedDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // DEBUG: Capturar o ID exato que está sendo enviado
        console.log('🔍 ID DO USUÁRIO SENDO BUSCADO:', userId);
        console.log('🔍 TIPO DO userId:', typeof userId);
        console.log('🔍 URL COMPLETA DA API:', `/api/users/${userId}`);
        
        // Buscar perfil do usuário
        const profileResponse = await api.get(`/api/users/${userId}`);
        setUserProfile(profileResponse.data.profile);
        
        // Buscar calendário de oração
        const calendarResponse = await api.get(`/api/users/${userId}/prayer-calendar?year=${selectedYear}`);
        setPrayedDates(calendarResponse.data);
        
      } catch (error: any) {
        console.error('Erro ao carregar dados:', error);
        setError(error.response?.data?.error || 'Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchData();
    }
  }, [userId, selectedYear]);

  const handlePrint = () => {
    window.print();
  };

  const handleBack = () => {
    router.back();
  };

  const generateCalendar = () => {
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    const calendar = [];

    for (let month = 0; month < 12; month++) {
      const firstDay = new Date(selectedYear, month, 1);
      const lastDay = new Date(selectedYear, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      const startingDayOfWeek = firstDay.getDay();

      const monthDays = [];
      
      // Adicionar dias vazios no início
      for (let i = 0; i < startingDayOfWeek; i++) {
        monthDays.push(null);
      }
      
      // Adicionar dias do mês
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${selectedYear}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const hasPrayed = prayedDates.includes(dateStr);
        monthDays.push({ day, hasPrayed, dateStr });
      }

      calendar.push({
        month: months[month],
        days: monthDays
      });
    }

    return calendar;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando calendário...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
        </div>
      </div>
    );
  }

  const calendar = generateCalendar();
  const totalPrayedDays = prayedDates.length;
  const totalDaysInYear = new Date(selectedYear, 11, 31).getDate() === 31 ? 366 : 365;
  const prayerPercentage = ((totalPrayedDays / totalDaysInYear) * 100).toFixed(1);

  return (
    <div className="min-h-screen bg-white">
      {/* Cabeçalho - não imprime */}
      <div className="print:hidden bg-gray-50 p-4 border-b">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
          
          <div className="flex items-center gap-4">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded"
            >
              {Array.from({ length: 10 }, (_, i) => {
                const year = new Date().getFullYear() - 5 + i;
                return (
                  <option key={year} value={year}>
                    {year}
                  </option>
                );
              })}
            </select>
            
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo para impressão */}
      <div className="max-w-4xl mx-auto p-6">
        {/* Cabeçalho do calendário */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Calendário de Oração {selectedYear}
          </h1>
          {userProfile && (
            <div className="text-lg text-gray-600 space-y-1">
              <div className="flex items-center justify-center gap-2">
                <User className="h-5 w-5" />
                <span>{userProfile.name}</span>
              </div>
              {userProfile.cell_name && (
                <p>Célula: {userProfile.cell_name}</p>
              )}
              {userProfile.role && (
                <p>Função: {userProfile.role}</p>
              )}
            </div>
          )}
        </div>

        {/* Estatísticas */}
        <div className="bg-blue-50 p-4 rounded-lg mb-8 text-center">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-2xl font-bold text-blue-600">{totalPrayedDays}</div>
              <div className="text-sm text-gray-600">Dias de Oração</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{prayerPercentage}%</div>
              <div className="text-sm text-gray-600">Do Ano</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{totalDaysInYear - totalPrayedDays}</div>
              <div className="text-sm text-gray-600">Dias Restantes</div>
            </div>
          </div>
        </div>

        {/* Legenda */}
        <div className="flex items-center justify-center gap-6 mb-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span>Dia de Oração</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-200 rounded border"></div>
            <span>Dia sem Oração</span>
          </div>
        </div>

        {/* Calendário */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {calendar.map((monthData, monthIndex) => (
            <div key={monthIndex} className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-center mb-4 text-gray-800">
                {monthData.month}
              </h3>
              
              {/* Cabeçalho dos dias da semana */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, index) => (
                  <div key={index} className="text-center text-xs font-medium text-gray-500 p-1">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Dias do mês */}
              <div className="grid grid-cols-7 gap-1">
                {monthData.days.map((dayData, dayIndex) => (
                  <div key={dayIndex} className="aspect-square">
                    {dayData ? (
                      <div
                        className={`w-full h-full flex items-center justify-center text-xs rounded ${
                          dayData.hasPrayed
                            ? 'bg-green-500 text-white font-medium'
                            : 'bg-gray-100 text-gray-700 border border-gray-300'
                        }`}
                        title={dayData.hasPrayed ? `Orou em ${dayData.dateStr}` : `Não orou em ${dayData.dateStr}`}
                      >
                        {dayData.day}
                      </div>
                    ) : (
                      <div className="w-full h-full"></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Rodapé */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Calendário gerado em {new Date().toLocaleDateString('pt-BR')}</p>
        </div>
      </div>
    </div>
  );
};

export default PrayerCalendarPrintClient;