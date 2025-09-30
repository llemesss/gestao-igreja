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
      const response = await api.get('/prayers/status-today');
      set({ hasPrayedToday: response.data.hasPrayed });
    } catch (error) {
      console.error("Erro ao verificar status de oração:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  setHasPrayedToday: (status: boolean) => {
    set({ hasPrayedToday: status });
  },
}));