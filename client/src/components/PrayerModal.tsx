'use client';

import { useState, useEffect } from 'react';
import { Heart, Sparkles, Users, User, X } from 'lucide-react';
import { api, apiMethods } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { usePrayerStore } from '@/lib/store';

interface Member {
  id: string;
  name: string;
  email: string;
  phone?: string;
  whatsapp?: string;
  full_name?: string;
  oikos1?: string;
  oikos2?: string;
  oikos_relacao_1?: { nome?: string } | null;
  oikos_relacao_2?: { nome?: string } | null;
  oikos_1?: { nome?: string } | null;
  oikos_2?: { nome?: string } | null;
}

interface PrayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: () => Promise<void>;
}

export default function PrayerModal({ isOpen, onClose, onRegister }: PrayerModalProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const { hasPrayedToday, checkPrayerStatus, setHasPrayedToday } = usePrayerStore();

  useEffect(() => {
    if (isOpen) {
      loadCellMembers();
      checkPrayerStatus();
    }
  }, [isOpen]);

  const loadCellMembers = async () => {
    setLoading(true);
    try {
      const cellMembers = await apiMethods.cells.getMyCellMembers();
      console.log('DADOS RECEBIDOS PELO FRONTEND:', cellMembers);
      setMembers(cellMembers);
    } catch (error) {
      console.error('Erro ao carregar membros da célula:', error);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleRegister = async () => {
    setIsRegistering(true);
    try {
      await onRegister();
      setHasPrayedToday(true);
      onClose();
    } catch (error) {
      console.error('Erro ao registrar oração:', error);
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar Oração Hoje">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Heart className="text-white" size={28} />
        </div>
        <p className="text-gray-600">
          Registre sua oração diária e veja os membros da sua célula
        </p>
      </div>

      <div className="space-y-6">
        {/* Membros da Célula */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Users className="text-blue-500" size={20} />
            <span className="font-semibold text-gray-800">Membros da Célula</span>
          </div>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Carregando membros...</p>
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users size={48} className="mx-auto mb-4 text-gray-300" />
              <p>Nenhum membro encontrado na sua célula</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {members.map((member) => (
                <div key={member.id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800">{member.name}</h4>
                      <div className="text-sm text-gray-600 space-y-1 mt-1">
                        {(member.oikos_relacao_1?.nome || member.oikos_1?.nome || member.oikos1) && (
                          <p><span className="font-medium">Oikós 1:</span> {member.oikos_relacao_1?.nome || member.oikos_1?.nome || member.oikos1}</p>
                        )}
                        {(member.oikos_relacao_2?.nome || member.oikos_2?.nome || member.oikos2) && (
                          <p><span className="font-medium">Oikós 2:</span> {member.oikos_relacao_2?.nome || member.oikos_2?.nome || member.oikos2}</p>
                        )}
                        {!(member.oikos_relacao_1?.nome || member.oikos_1?.nome || member.oikos1 || member.oikos_relacao_2?.nome || member.oikos_2?.nome || member.oikos2) && (
                          <p className="text-gray-500 italic">Oikós não definidos</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Momento de Oração */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <Sparkles className="text-purple-500" size={20} />
            <span className="font-semibold text-gray-800">Momento de Oração</span>
          </div>
          <p className="text-gray-600 text-sm leading-relaxed">
            Este é um momento especial para se conectar com Deus. Sua oração será registrada 
            como parte do seu crescimento espiritual diário.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex gap-3 mt-6">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-3 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
        >
          Cancelar
        </button>
        <button
          onClick={handleRegister}
          disabled={isRegistering || hasPrayedToday}
          className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isRegistering ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Registrando...
            </>
          ) : (
            <>
              <Heart size={16} />
              {hasPrayedToday ? 'Oração Já Registrada Hoje' : 'Registrar Oração'}
            </>
          )}
        </button>
      </div>
    </Modal>
  );
}