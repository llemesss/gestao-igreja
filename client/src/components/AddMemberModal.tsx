'use client';

import { useState, useEffect } from 'react';
import { UserPlus, Search } from 'lucide-react';
import { api, apiMethods } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  cell_id: string | null;
}

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  cellId: string;
  onMemberAdded: () => void;
}

export default function AddMemberModal({ isOpen, onClose, cellId, onMemberAdded }: AddMemberModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadAvailableUsers();
    }
  }, [isOpen]);

  useEffect(() => {
    const filtered = users.filter(user =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredUsers(filtered);
  }, [users, searchTerm]);

  const loadAvailableUsers = async () => {
    try {
      setLoading(true);
      const response = await apiMethods.users.getAll();
      // O endpoint retorna { users: [...] }, então precisamos acessar response.users
      const availableUsers = response.users.filter((user: User) => !user.cell_id);
      setUsers(availableUsers);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    try {
      setAdding(true);
      await apiMethods.cells.addMember(cellId, userId);
      onMemberAdded();
      onClose();
      setSearchTerm('');
    } catch (error: any) {
      console.error('Erro ao adicionar membro:', error);
      alert(error.message || 'Erro ao adicionar membro');
    } finally {
      setAdding(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Adicionar Membro">
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar usuários..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Carregando usuários...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <UserPlus size={48} className="mx-auto mb-4 text-gray-300" />
              <p>Nenhum usuário disponível</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  onClick={() => handleAddMember(user.id)}
                  className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">{user.name}</h4>
                      <p className="text-sm text-gray-600">{user.email}</p>
                    </div>
                    <div className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {user.role}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}