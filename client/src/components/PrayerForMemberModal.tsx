'use client';

import { useState, useEffect } from 'react';
import { Heart, Users, Search, X } from 'lucide-react';
import { api, apiMethods } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';

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

interface PrayerForMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PrayerForMemberModal({ isOpen, onClose }: PrayerForMemberModalProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [prayerNote, setPrayerNote] = useState('');
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadMembers();
    }
  }, [isOpen]);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const data = await apiMethods.cells.getMyCellMembers();
      console.log('DADOS RECEBIDOS PELO FRONTEND:', data);
      setMembers(data);
    } catch (error) {
      console.error('Erro ao carregar membros:', error);
      toast.error('Erro ao carregar membros da célula');
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = members.filter(member =>
    member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (member.full_name && member.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleRegisterPrayer = async () => {
    if (!selectedMember) return;

    setRegistering(true);
    try {
      // Aqui você pode implementar a lógica para registrar oração por um membro específico
      // Por enquanto, vamos apenas registrar a oração pessoal
      await apiMethods.prayers.registerPrayer();
      toast.success(`Oração registrada por ${selectedMember.name}!`);
      onClose();
      resetModal();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao registrar oração');
    } finally {
      setRegistering(false);
    }
  };

  const resetModal = () => {
    setSelectedMember(null);
    setPrayerNote('');
    setSearchTerm('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Orar por um Membro">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
          <Users className="text-white" size={24} />
        </div>
        <div>
          <p className="text-gray-600 text-sm">
            Escolha um membro da sua célula para orar
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar membros..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Lista de membros */}
        <div className="max-h-64 overflow-y-auto space-y-2">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Carregando membros...</p>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users size={48} className="mx-auto mb-4 text-gray-300" />
              <p>Nenhum membro encontrado</p>
            </div>
          ) : (
            filteredMembers.map((member) => (
              <div
                key={member.id}
                onClick={() => setSelectedMember(member)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedMember?.id === member.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-800">{member.name}</h4>
                    <p className="text-sm text-gray-600">{member.email}</p>
                    <div className="text-xs text-gray-600 space-y-1 mt-1">
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
            ))
          )}
        </div>

        {/* Nota de oração */}
        {selectedMember && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Nota de oração (opcional)
            </label>
            <textarea
              value={prayerNote}
              onChange={(e) => setPrayerNote(e.target.value)}
              placeholder="Escreva uma nota sobre sua oração..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex gap-3 mt-6">
        <button
          onClick={() => {
            onClose();
            resetModal();
          }}
          className="flex-1 px-4 py-3 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
        >
          Cancelar
        </button>
        <button
          onClick={handleRegisterPrayer}
          disabled={!selectedMember || registering}
          className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {registering ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Registrando...
            </>
          ) : (
            <>
              <Heart size={16} />
              Registrar Oração
            </>
          )}
        </button>
      </div>
    </Modal>
  );
}