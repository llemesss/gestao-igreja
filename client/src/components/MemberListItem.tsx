'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Phone, Mail, Calendar, FileText, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { PrayerStatsModal } from '@/components/PrayerStatsModal';

interface Member {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  birth_date?: string;
  address?: string;
  role?: string;
}

interface MemberListItemProps {
  member: Member;
}

export const MemberListItem: React.FC<MemberListItemProps> = ({ member }) => {
  const router = useRouter();
  const [showStatsModal, setShowStatsModal] = useState(false);

  const handleCardClick = (e: React.MouseEvent) => {
    // Previne que o clique nos botões de ação abra o modal
    if ((e.target as HTMLElement).closest('.member-actions')) {
      return;
    }
    setShowStatsModal(true);
  };

  const handlePrintSheet = (member: Member) => {
    let progress = 0;
    const toastId = toast.loading('Gerando sua ficha em PDF...', {
      description: 'Preparando documento...'
    });

    // Simula progresso visual
    const progressInterval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress < 90) {
        toast.loading('Gerando sua ficha em PDF...', {
          id: toastId,
          description: `Progresso: ${Math.round(progress)}%`
        });
      }
    }, 200);

    // Faz a requisição
    api.get(`/users/reports/member/${member.id}/pdf`, {
      responseType: 'blob',
      timeout: 30000,
    })
    .then((response) => {
      clearInterval(progressInterval);
      
      // Finaliza o progresso
      toast.loading('Gerando sua ficha em PDF...', {
        id: toastId,
        description: 'Finalizando download...'
      });

      // Inicia o download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ficha-${member.name}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      // Toast de sucesso
      toast.success('Download iniciado!', { id: toastId });
    })
    .catch((error) => {
      clearInterval(progressInterval);
      toast.error('Erro ao gerar o PDF. Tente novamente.', { id: toastId });
    });
  };

  const handlePrintPrayerCalendar = (member: Member) => {
    const currentYear = new Date().getFullYear();
    let progress = 0;
    const toastId = toast.loading('Gerando calendário de oração em PDF...', {
      description: 'Preparando calendário...'
    });

    // Simula progresso visual
    const progressInterval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress < 90) {
        toast.loading('Gerando calendário de oração em PDF...', {
          id: toastId,
          description: `Progresso: ${Math.round(progress)}%`
        });
      }
    }, 200);
    
    // Faz a requisição
    api.get(`/users/reports/calendar/${member.id}/pdf?year=${currentYear}`, {
      responseType: 'blob',
      timeout: 30000,
    })
    .then((response) => {
      clearInterval(progressInterval);
      
      // Finaliza o progresso
      toast.loading('Gerando calendário de oração em PDF...', {
        id: toastId,
        description: 'Finalizando download...'
      });

      // Inicia o download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `calendario-oracao-${member.name}-${currentYear}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      // Toast de sucesso
      toast.success('Download do calendário iniciado!', { id: toastId });
    })
    .catch((error) => {
      clearInterval(progressInterval);
      toast.error('Erro ao gerar o calendário. Tente novamente.', { id: toastId });
    });
  };

  return (
    <>
      <div 
        className="member-list-item border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
        onClick={handleCardClick}
      >
        <div className="flex items-center justify-between">
          <div className="member-info flex items-center gap-3 flex-1">
            <div className="bg-blue-100 p-2 rounded-full">
              <User className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
                <span className="member-name font-medium text-gray-900 truncate">
                  {member.name}
                </span>
                {member.role && (
                  <span className="member-role text-sm text-gray-600 capitalize">
                    {member.role}
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-col sm:flex-row sm:gap-4 text-sm text-gray-500">
                {member.email && (
                  <div className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{member.email}</span>
                  </div>
                )}
                {member.phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    <span>{member.phone}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="member-actions flex gap-2 ml-4">
            <button
              onClick={() => handlePrintSheet(member)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              title="Imprimir Ficha Cadastral"
            >
              <FileText className="h-3 w-3" />
              <span className="hidden sm:inline">Ficha</span>
            </button>
            <button
              onClick={() => handlePrintPrayerCalendar(member)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              title="Imprimir Calendário de Oração"
            >
              <Printer className="h-3 w-3" />
              <span className="hidden sm:inline">Calendário</span>
            </button>
          </div>
        </div>
      </div>

      <PrayerStatsModal
        isOpen={showStatsModal}
        onClose={() => setShowStatsModal(false)}
        userId={member.id}
      />
    </>
  );
};

export default MemberListItem;