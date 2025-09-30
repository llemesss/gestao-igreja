import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api'; // Ajuste o caminho se necessário
import PrayerCalendar from './PrayerCalendar';

// Interfaces para tipagem dos dados
interface ProfileData {
  name: string;
  email: string;
  phone?: string;
  // Adicione outros campos do perfil que a ficha precisa
}

interface StatsData {
  totalPrayers: number;
  lastPrayerDate: string | null;
}

interface Member {
  id: string;
  name: string;
  email?: string;
  // Adicione outros campos necessários
}

interface MemberDetailModalProps {
  member: Member | null;
  isOpen: boolean;
  onClose: () => void;
}

function formatDate(dateString?: string | null) {
  if (!dateString) return "Nunca";
  return new Date(dateString).toLocaleDateString('pt-BR');
}

export default function MemberDetailModal({ member, isOpen, onClose }: MemberDetailModalProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handlePrintPdf = (member: Member) => {
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

  useEffect(() => {
    if (isOpen && member?.id) {
      setIsLoading(true);
      setError(null);
      
      // Chamada para a ROTA PADRÃO E SIMPLES
      api.get(`/users/${member.id}`)
        .then(response => {
          setProfile(response.data.profile);
          setStats(response.data.stats);
        })
        .catch(err => {
          console.error("Erro ao buscar detalhes do membro:", err);
          setError("Não foi possível carregar os detalhes.");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [member, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {isLoading && <p>Carregando...</p>}
        {error && <p style={{ color: 'red' }}>{error}</p>}

        {!isLoading && !error && profile && (
          <>
            {/* --- CABEÇALHO DO MODAL --- */}
            <div className="modal-header">
              <h3>Detalhes do Membro</h3>
              <div className="modal-actions">
                <button 
                  onClick={() => member && handlePrintPdf(member)} 
                  className="print-button"
                >
                  Baixar Ficha em PDF
                </button>
                <button onClick={onClose} className="close-button">&times;</button>
              </div>
            </div>

            {/* --- CORPO DO MODAL --- */}
            <div className="modal-body">
              {/* Seção de Perfil */}
              <div className="profile-summary">
                <div className="profile-info">
                  <p className="profile-name">{profile.name}</p>
                  <p className="profile-contact">{profile.email}</p>
                  <p className="profile-contact">{profile.phone || 'Telefone não informado'}</p>
                </div>
              </div>

              <hr className="divider" />

              {/* Seção de Estatísticas */}
              <div className="stats-section">
                <h4>Estatísticas de Oração</h4>
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-value">{stats?.totalPrayers ?? 0}</span>
                    <span className="stat-label">Orações Registradas</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{formatDate(stats?.lastPrayerDate)}</span>
                    <span className="stat-label">Última Oração</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Adicione a área de impressão oculta aqui, se ainda não estiver */}
            <div className="printable-area">
              <div className="print-title">
                <h1>Ficha do Membro - {profile.name}</h1>
                <p>Ano: {new Date().getFullYear()}</p>
              </div>

              <section className="print-section">
                <h3>Informações Pessoais</h3>
                <div className="print-info-grid">
                  <div><strong>Nome:</strong> {profile.name}</div>
                  <div><strong>Email:</strong> {profile.email}</div>
                  <div><strong>Telefone:</strong> {profile.phone || 'Não informado'}</div>
                </div>
              </section>

              <section className="print-section">
                <h3>Estatísticas de Oração</h3>
                <div className="print-info-grid">
                  <div><strong>Total de Orações:</strong> {stats?.totalPrayers ?? 0}</div>
                  <div><strong>Última Oração:</strong> {formatDate(stats?.lastPrayerDate)}</div>
                </div>
              </section>

              <section className="print-section">
                <h3>Calendário de Oração - {new Date().getFullYear()}</h3>
                <div className="calendar-container">
                  <PrayerCalendar userId={member?.id || ''} year={new Date().getFullYear()} />
                </div>
                <div className="calendar-legend">
                  <div className="legend-item">
                    <span className="legend-color prayer-color"></span>
                    <span>Dias com oração registrada</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color invalid-color"></span>
                    <span>Dias inválidos do mês</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color empty-color"></span>
                    <span>Dias sem oração</span>
                  </div>
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}