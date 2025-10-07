import { create } from 'zustand';
import { api } from './api';

interface PrayerStore {
  hasPrayedToday: boolean;
  isLoading: boolean;
  checkPrayerStatus: () => Promise<void>;
  setHasPrayedToday: (status: boolean) => void;
}

export const usePrayerStore = create<PrayerStore>((set) => ({
  hasPrayedToday: false,
  isLoading: false,

  checkPrayerStatus: async () => {
    set({ isLoading: true });
    try {
      // Primeiro tenta o endpoint de status de hoje
      const response = await api.get('/prayers/status-today');
      if (response?.data?.hasPrayed !== undefined) {
        set({ hasPrayedToday: Boolean(response.data.hasPrayed) });
      } else {
        // Fallback: usa /prayers/stats e deriva prayed_today
        const statsRes = await api.get('/prayers/stats');
        set({ hasPrayedToday: Boolean(statsRes?.data?.prayersToday) });
      }
    } catch (error) {
      // Se /status-today falhar (ex.: 404 em alguns deploys), tenta /stats
      try {
        const statsRes = await api.get('/prayers/stats');
        set({ hasPrayedToday: Boolean(statsRes?.data?.prayersToday) });
      } catch (err) {
        console.error('Erro ao verificar status de oração (fallback):', err);
      }
    } finally {
      set({ isLoading: false });
    }
  },

  setHasPrayedToday: (status: boolean) => {
    set({ hasPrayedToday: status });
  },
}));