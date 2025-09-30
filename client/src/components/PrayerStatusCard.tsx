import React, { useEffect, useState } from 'react';
import { usePrayerStore } from '@/lib/store';
import { PrayerStatsModal } from './PrayerStatsModal';

export function PrayerStatusCard() {
  const { hasPrayedToday: hasPrayed, isLoading, checkPrayerStatus } = usePrayerStore();
  const [showStatsModal, setShowStatsModal] = useState(false);

  useEffect(() => {
    checkPrayerStatus();
  }, []); // Roda apenas uma vez ao carregar

  const handleCardClick = () => {
    setShowStatsModal(true);
  };

  if (isLoading) {
    return (
      <div className="bg-gray-100 border border-gray-200 p-5 rounded-lg text-center">
        <p className="text-gray-600 text-lg mb-2">Orou Hoje?</p>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600 mx-auto"></div>
      </div>
    );
  }

  const cardStyle = {
    backgroundColor: hasPrayed ? '#e9f5e9' : '#fdecec', // Verde claro ou Rosa claro
    border: `1px solid ${hasPrayed ? '#a3d3a3' : '#f5c6cb'}`,
    padding: '20px',
    borderRadius: '8px',
    textAlign: 'center' as const,
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
  };

  const statusStyle = {
    fontSize: '2rem',
    fontWeight: 'bold' as const,
    color: hasPrayed ? '#28a745' : '#dc3545', // Verde ou Vermelho
  };

  return (
    <>
      <div 
        style={cardStyle}
        onClick={handleCardClick}
        className="hover:shadow-md hover:scale-105"
        title="Clique para ver estatísticas detalhadas"
      >
        <p style={{ margin: 0, fontSize: '1.2rem' }}>Orou Hoje?</p>
        <p style={statusStyle}>{hasPrayed ? 'SIM' : 'NÃO'}</p>
        <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: '#666' }}>
          Clique para ver mais
        </p>
      </div>

      <PrayerStatsModal 
        isOpen={showStatsModal}
        onClose={() => setShowStatsModal(false)}
      />
    </>
  );
}