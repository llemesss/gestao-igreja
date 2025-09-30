'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { api } from '@/lib/api';

interface User {
  id: string;
  name: string;
  role: string;
}

interface Cell {
  id: string;
  name: string;
  supervisor_id?: string;
  supervisor_name?: string;
  secretary_id?: string;
  secretary_name?: string;
  leaders: Array<{
    id: string;
    name: string;
  }>;
  member_count: number;
  created_at: string;
  updated_at: string;
}

interface CreateEditCellModalProps {
  isOpen: boolean;
  cell: Cell | null;
  leaders: User[];
  onClose: () => void;
  onSave: (data: { name: string; leader_ids?: string[]; secretary_id?: string }) => Promise<void>;
}

export const CreateEditCellModal: React.FC<CreateEditCellModalProps> = ({ 
  isOpen, 
  cell, 
  leaders, 
  onClose, 
  onSave 
}) => {
  const [name, setName] = useState('');
  const [selectedLeaderIds, setSelectedLeaderIds] = useState<string[]>([]);
  const [selectedSecretaryId, setSelectedSecretaryId] = useState<string>('');
  const [members, setMembers] = useState<User[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadCellMembers = async (cellId: string) => {
      setLoadingMembers(true);
      try {
        const response = await api.get(`/cells/${cellId}/members`);
        setMembers(response.data.members || []);
      } catch (error: unknown) {
        console.error('Erro ao carregar membros da célula:', error);
        setMembers([]);
      } finally {
        setLoadingMembers(false);
      }
    };

    if (cell) {
      setName(cell.name);
      setSelectedLeaderIds(cell.leaders.map(leader => leader.id));
      setSelectedSecretaryId(cell.secretary_id || '');
      loadCellMembers(cell.id);
    } else {
      setName('');
      setSelectedLeaderIds([]);
      setSelectedSecretaryId('');
      setMembers([]);
    }
  }, [cell]);

  const handleSave = async () => {
    if (!name.trim()) return;

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        leader_ids: selectedLeaderIds,
        secretary_id: selectedSecretaryId || undefined
      });
      onClose();
    } catch (error) {
      console.error('Erro ao salvar célula:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleLeaderToggle = (leaderId: string) => {
    setSelectedLeaderIds(prev => 
      prev.includes(leaderId) 
        ? prev.filter(id => id !== leaderId)
        : [...prev, leaderId]
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={cell ? 'Editar Célula' : 'Nova Célula'}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nome/Número da Célula *
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Célula 1, Célula Alpha, etc."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Líderes da Célula
          </label>
          <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-2">
            {leaders.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhum líder disponível</p>
            ) : (
              leaders.map((leader) => (
                <label key={leader.id} className="flex items-center space-x-2 py-1 cursor-pointer hover:bg-gray-50 rounded px-2">
                  <input
                    type="checkbox"
                    checked={selectedLeaderIds.includes(leader.id)}
                    onChange={() => handleLeaderToggle(leader.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">{leader.name}</span>
                </label>
              ))
            )}
          </div>
        </div>

        {cell && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Designar Secretário
            </label>
            {loadingMembers ? (
              <p className="text-gray-500 text-sm">Carregando membros...</p>
            ) : (
              <select
                value={selectedSecretaryId}
                onChange={(e) => setSelectedSecretaryId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Selecione um secretário (opcional)</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-gray-500 mt-1">
              O secretário será responsável por preencher os relatórios da célula
            </p>
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Salvando...' : (cell ? 'Atualizar' : 'Criar')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};