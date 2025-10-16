'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge } from '@/components/ui';
import { Users, Search, Plus, Edit, ArrowLeft, X } from 'lucide-react';
import { apiMethods } from '@/lib/api';
import { auth } from '@/lib/auth';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  cell_id?: string;
  cell_name?: string;
  created_at: string;
}

interface EditUserModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (userId: string, role: string, cellId?: string) => void;
  loading: boolean;
}

function EditUserModal({ user, isOpen, onClose, onSave, loading }: EditUserModalProps) {
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedCellId, setSelectedCellId] = useState('');
  const [cells, setCells] = useState<{ id: string; name: string; leaders: { id: string; name: string }[] }[]>([]);
  const [loadingCells, setLoadingCells] = useState(false);

  const roles = [
    { value: 'MEMBRO', label: 'Membro' },
    { value: 'LIDER', label: 'Líder' },
    { value: 'SUPERVISOR', label: 'Supervisor' },
    { value: 'COORDENADOR', label: 'Coordenador' },
    { value: 'PASTOR', label: 'Pastor' },
    { value: 'ADMIN', label: 'Administrador' },
  ];

  // Carregar células quando o modal abrir
  useEffect(() => {
    if (isOpen) {
      loadCells();
    }
  }, [isOpen]);

  // Definir valores iniciais quando o usuário mudar
  useEffect(() => {
    if (user) {
      setSelectedRole(user.role);
      setSelectedCellId(user.cell_id || '');
    }
  }, [user]);

  const loadCells = async () => {
    try {
      setLoadingCells(true);
      const response = await apiMethods.cells.getAll();
      
      // Verificar se o usuário tem permissão para buscar detalhes das células
      const currentUser = auth.getUser();
      const canViewCellDetails = currentUser && ['ADMIN', 'PASTOR', 'COORDENADOR', 'SUPERVISOR', 'LIDER'].includes(currentUser.role);
      
      if (canViewCellDetails) {
        // Para cada célula, buscar detalhes incluindo líderes
        const cellsWithLeaders = await Promise.all(
          (Array.isArray(response) ? response : []).map(async (cell: { id: string; name: string }) => {
            try {
              const cellDetail = await apiMethods.cells.getDetail(cell.id);
              return {
                id: cell.id,
                name: cell.name,
                leaders: cellDetail.leaders || []
              };
            } catch (error) {
              console.error(`Erro ao buscar detalhes da célula ${cell.id}:`, error);
              return {
                id: cell.id,
                name: cell.name,
                leaders: []
              };
            }
          })
        );
        
        setCells(cellsWithLeaders);
      } else {
        // Para usuários MEMBRO, apenas definir células básicas sem buscar detalhes
        const basicCells = (Array.isArray(response) ? response : []).map((cell: { id: string; name: string }) => ({
          id: cell.id,
          name: cell.name,
          leaders: []
        }));
        
        setCells(basicCells);
      }
    } catch (error) {
      console.error('Erro ao carregar células:', error);
    } finally {
      setLoadingCells(false);
    }
  };

  const handleSave = () => {
    if (user) {
      const hasRoleChanged = selectedRole !== user.role;
      const hasCellChanged = selectedCellId !== (user.cell_id || '');
      
      if (hasRoleChanged || hasCellChanged) {
        // Se está promovendo para LIDER e não tem célula selecionada, exigir seleção
        if (selectedRole === 'LIDER' && !selectedCellId) {
          alert('Por favor, selecione uma célula para o líder.');
          return;
        }
        
        // Verificar se a célula já tem líderes (máximo 2)
        if (selectedRole === 'LIDER' && selectedCellId) {
          const selectedCell = cells.find(cell => cell.id === selectedCellId);
          if (selectedCell) {
            const currentLeaders = selectedCell.leaders || [];
            const leadersCount = currentLeaders.length;
            
            // Se já tem 2 líderes, não permitir
            if (leadersCount >= 2) {
              alert('Esta célula já possui o máximo de 2 líderes. Não é possível adicionar mais líderes.');
              return;
            }
            
            // Se já tem 1 líder, pedir confirmação
            if (leadersCount === 1) {
              const existingLeader = currentLeaders[0];
              const confirmed = confirm(
                `Esta célula já possui um líder: ${existingLeader.name}.\n\n` +
                `${user.name} será líder junto com ${existingLeader.name}?\n\n` +
                `Confirma a designação?`
              );
              
              if (!confirmed) {
                return;
              }
            }
          }
        }
        
        onSave(user.id, selectedRole, selectedCellId || undefined);
      } else {
        onClose();
      }
    }
  };

  const isLeaderRole = selectedRole === 'LIDER';

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Editar Usuário</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={loading}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome
            </label>
            <input
              type="text"
              value={user.name}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={user.email}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Função
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
            >
              {roles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          {/* Seleção de Célula - aparece apenas quando o role é LIDER */}
          {isLeaderRole && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Célula para Liderar <span className="text-red-500">*</span>
              </label>
              {loadingCells ? (
                <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                  Carregando células...
                </div>
              ) : (
                <select
                   value={selectedCellId}
                   onChange={(e) => setSelectedCellId(e.target.value)}
                   disabled={loading || selectedRole !== 'LIDER'}
                   className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 disabled:bg-gray-100 disabled:text-gray-500"
                 >
                   <option value="">Selecione uma célula</option>
                   {cells.map((cell) => {
                     const leadersCount = cell.leaders?.length || 0;
                     const isDisabled = leadersCount >= 2;
                     const leadersInfo = leadersCount > 0 
                       ? ` (${leadersCount} líder${leadersCount > 1 ? 'es' : ''})`
                       : '';
                     
                     return (
                       <option 
                         key={cell.id} 
                         value={cell.id}
                         disabled={isDisabled}
                       >
                         {cell.name}{leadersInfo}{isDisabled ? ' - LOTADA' : ''}
                       </option>
                     );
                   })}
                 </select>
              )}
              {isLeaderRole && !selectedCellId && (
                <p className="text-sm text-red-600 mt-1">
                  É obrigatório selecionar uma célula para o líder
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end mt-6">
          <Button
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function UsuariosPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [updateLoading, setUpdateLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const list = await apiMethods.users.getAll();
      setUsers(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditModalOpen(true);
  };

  const handleSaveUser = async (userId: string, role: string, cellId?: string) => {
    try {
      setUpdateLoading(true);
      const updateData: any = { role };
      if (cellId !== undefined) {
        updateData.cell_id = cellId || null;
      }
      
      await apiMethods.users.update(userId, updateData);
      
      // Atualizar a lista local
      setUsers(users.map(user => 
        user.id === userId ? { ...user, role, cell_id: cellId || undefined } : user
      ));
      
      setEditModalOpen(false);
      setSelectedUser(null);
      alert('Usuário atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      alert('Erro ao atualizar usuário. Tente novamente.');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleDesignCells = (user: User) => {
    // Navegar para página de designação de células
    router.push(`/usuarios/${user.id}/designar-celulas`);
  };

  const filteredUsers = (Array.isArray(users) ? users : []).filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      ADMIN: 'bg-red-100 text-red-800',
      PASTOR: 'bg-purple-100 text-purple-800',
      COORDENADOR: 'bg-indigo-100 text-indigo-800',
      SUPERVISOR: 'bg-blue-100 text-blue-800',
      LIDER: 'bg-green-100 text-green-800',
      MEMBRO: 'bg-gray-100 text-gray-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      ADMIN: 'Administrador',
      PASTOR: 'Pastor',
      COORDENADOR: 'Coordenador',
      SUPERVISOR: 'Supervisor',
      LIDER: 'Líder',
      MEMBRO: 'Membro'
    };
    return labels[role] || role;
  };


  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6">
        <div className="space-y-6">
          {/* Navigation Header */}
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              onClick={() => router.push('/dashboard')}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Voltar ao Dashboard</span>
            </Button>
          </div>

          {/* Page Header */}
          <div className="flex items-center space-x-3">
            <Users className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gerenciar Usuários</h1>
              <p className="text-gray-600">Administre os usuários do sistema</p>
            </div>
          </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuários ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Carregando usuários...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 shadow-sm transition">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate max-w-[200px]">{user.name}</h3>
                      <p className="text-gray-600 text-sm truncate max-w-[240px]">{user.email}</p>
                      <p className="text-gray-500 text-xs">
                        Criado em: {user?.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : 'N/A'}
                      </p>
                      {user.cell_name && (
                        <span className="text-blue-600 text-xs truncate max-w-[240px]">Célula: {user.cell_name}</span>
                      )}
                      {user.role === 'LIDER' && user.cell_name && (
                        <span className="text-green-600 text-xs font-semibold">🌟 Líder desta célula</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Badge className={getRoleBadgeColor(user.role)}>
                      {getRoleLabel(user.role)}
                    </Badge>
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEditUser(user)}
                        title="Editar usuário"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>

                    </div>
                  </div>
                </div>
              ))}
              {filteredUsers.length === 0 && (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">
                    {searchTerm ? 'Nenhum usuário encontrado com esse termo de busca' : 'Nenhum usuário encontrado'}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
        </div>
      </div>

      {/* Modal de Edição */}
      <EditUserModal
        user={selectedUser}
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedUser(null);
        }}
        onSave={handleSaveUser}
        loading={updateLoading}
      />
    </div>
  );
}