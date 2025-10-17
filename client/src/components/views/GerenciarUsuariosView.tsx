'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';
import { auth } from '@/lib/auth';
import { toast } from 'sonner';
import { 
  useReactTable, 
  getCoreRowModel, 
  getFilteredRowModel, 
  getSortedRowModel,
  getPaginationRowModel,
  createColumnHelper,
  flexRender 
} from '@tanstack/react-table';
import { Edit, Trash2, Search, Users, ChevronLeft, ChevronRight, Eye, UserX } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import MemberDetailModal from '@/components/MemberDetailModal';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  cell_id?: string;
  cell_name?: string;
  supervised_cells?: Array<{ id: string; name: string }>; // Adicionando células supervisionadas
  created_at: string;
  updated_at: string;
}

interface Cell {
  id: string;
  name: string;
}

interface EditUserModalProps {
  isOpen: boolean;
  user: User | null;
  cells: Cell[];
  onClose: () => void;
  onSave: (userId: string, data: { 
    name: string; 
    email: string; 
    role: string; 
    cell_id?: string; 
    cell_ids?: string[];
    leader_cell_id?: string | null;
  }) => Promise<void>;
}

const EditUserModal: React.FC<EditUserModalProps> = ({ isOpen, user, cells, onClose, onSave }) => {
  const [role, setRole] = useState('');
  const [cellId, setCellId] = useState('');
  const [selectedCellIds, setSelectedCellIds] = useState<string[]>([]);
  const [leaderCellId, setLeaderCellId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setRole(user.role);
      setCellId(user.cell_id || '');
      setLeaderCellId('');
      // Para supervisores, inicializar com as células supervisionadas
      if (user.role === 'SUPERVISOR') {
        // Buscar células supervisionadas pelo usuário
        fetchSupervisedCells(user.id);
      } else {
        setSelectedCellIds([]);
      }
    } else {
      // Limpar estados quando não há usuário
      setRole('');
      setCellId('');
      setLeaderCellId('');
      setSelectedCellIds([]);
    }
  }, [user]);

  const fetchSupervisedCells = async (userId: string) => {
    try {
      const response = await api.get(`/users/${userId}/supervised-cells`);
      const cellsList = Array.isArray(response?.data) ? response.data : [];
      const supervisedCells = cellsList.map((cell: { id: string }) => cell.id);
      setSelectedCellIds(supervisedCells);
    } catch (error) {
      console.error('Erro ao buscar células supervisionadas:', error);
      // Em caso de erro, inicializar com array vazio
      setSelectedCellIds([]);
    }
  };

  const handleCellSelection = (cellId: string, checked: boolean) => {
    if (checked) {
      setSelectedCellIds(prev => [...prev, cellId]);
    } else {
      setSelectedCellIds(prev => prev.filter(id => id !== cellId));
    }
  };

  const handleSave = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      // Enviar TODOS os campos obrigatórios sempre, não apenas os que mudaram
      const updateData: { 
        name: string; 
        email: string; 
        role: string; 
        cell_id?: string; 
        cell_ids?: string[];
        leader_cell_id?: string | null;
        celulaLideradaId?: string | null; // campo redundante para compatibilidade e auditoria
      } = {
        name: user.name,     // Campo obrigatório
        email: user.email,   // Campo obrigatório
        role: role,          // Campo obrigatório (pode ter mudado)
        cell_id: cellId || undefined
      };
      
      // Para supervisores, também enviar array de cell_ids (células supervisionadas)
      if (role === 'SUPERVISOR') {
        updateData.cell_ids = selectedCellIds;
      }

      // Para líderes, exigir seleção de célula a liderar
      if (role === 'LIDER') {
        if (!leaderCellId) {
          toast.error('Selecione uma célula para o líder.');
          setSaving(false);
          return;
        }
        updateData.leader_cell_id = leaderCellId;
        updateData.celulaLideradaId = leaderCellId;
      } else {
        // Papéis que não sejam LIDER removem qualquer liderança existente
        updateData.leader_cell_id = null;
        updateData.celulaLideradaId = null;
      }
      
      console.log('=== DEBUG EditUserModal ===');
      console.log('Payload Enviado:', updateData);
      console.log('Dados completos sendo enviados:', updateData);
      
      await onSave(user.id, updateData);
      onClose();
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Usuário">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Nome
          </label>
          <Input value={user?.name || ''} disabled className="bg-white text-gray-700 border-gray-300" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Email
          </label>
          <Input value={user?.email || ''} disabled className="bg-white text-gray-700 border-gray-300" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Nível (Role)
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="MEMBRO">Membro</option>
            <option value="LIDER">Líder</option>
            <option value="SUPERVISOR">Supervisor</option>
            <option value="COORDENADOR">Coordenador</option>
            <option value="PASTOR">Pastor</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>

        {/* Célula de membro - sempre mostrar para todos os roles */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Célula (como membro)
          </label>
          <select
            value={cellId}
            onChange={(e) => setCellId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Sem célula</option>
            {cells.map((cell) => (
              <option key={cell.id} value={cell.id}>
                {cell.name}
              </option>
            ))}
          </select>
        </div>

        {/* Células supervisionadas - apenas para supervisores */}
        {role === 'SUPERVISOR' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Células Supervisionadas
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3 bg-white">
              {!Array.isArray(cells) || cells.length === 0 ? (
                <p className="text-gray-500 text-sm">Nenhuma célula disponível</p>
              ) : (
                (Array.isArray(cells) ? cells : []).map((cell) => (
                  <label key={cell.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={selectedCellIds.includes(cell.id)}
                      onChange={(e) => handleCellSelection(cell.id, e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="text-gray-700 text-sm">{cell.name}</span>
                  </label>
                ))
              )}
              {(Array.isArray(selectedCellIds) ? selectedCellIds.length : 0) > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    {(Array.isArray(selectedCellIds) ? selectedCellIds.length : 0)} célula(s) selecionada(s)
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Célula para Liderar - apenas quando role = LIDER */}
        {role === 'LIDER' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Célula para Liderar
            </label>
            <select
              value={leaderCellId}
              onChange={(e) => setLeaderCellId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecione uma célula</option>
              {cells.map((cell) => (
                <option key={cell.id} value={cell.id}>
                  {cell.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default function GerenciarUsuariosView() {
  const [users, setUsers] = useState<User[]>([]);
  const [cells, setCells] = useState<Cell[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalFilter, setGlobalFilter] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [userForDetails, setUserForDetails] = useState<User | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');

  const columnHelper = createColumnHelper<User>();

  const columns = [
    columnHelper.accessor('name', {
      header: 'Nome',
      cell: info => info.getValue(),
    }),
    columnHelper.accessor('email', {
      header: 'Email',
      cell: info => info.getValue(),
    }),
    columnHelper.accessor('role', {
      header: 'Nível (Role)',
      cell: info => {
        const role = info.getValue();
        const roleColors = {
          ADMIN: 'bg-red-100 text-red-800',
          PASTOR: 'bg-purple-100 text-purple-800',
          COORDENADOR: 'bg-blue-100 text-blue-800',
          SUPERVISOR: 'bg-green-100 text-green-800',
          LIDER: 'bg-yellow-100 text-yellow-800',
          MEMBRO: 'bg-gray-100 text-gray-800'
        };
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleColors[role as keyof typeof roleColors] || 'bg-gray-100 text-gray-800'}`}>
            {role}
          </span>
        );
      },
    }),
    columnHelper.accessor('cell_name', {
      header: 'Célula',
      cell: ({ row }) => {
        const user = row.original;
        
        // Se for supervisor, mostrar células supervisionadas
        if (user.role === 'SUPERVISOR' && Array.isArray(user.supervised_cells) && user.supervised_cells.length > 0) {
          return (
            <div className="space-y-1">
              <div className="text-xs text-blue-600 font-semibold">Supervisiona:</div>
              {user.supervised_cells.map((cell, index) => (
                <div key={cell.id} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                  {cell.name}
                </div>
              ))}
            </div>
          );
        }
        
        // Para outros roles, mostrar célula normal
        return user.cell_name || 'Sem célula';
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Ações',
      cell: ({ row }) => (
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleViewDetails(row.original)}
            title="Ver detalhes"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEditUser(row.original)}
            title="Editar usuário"
          >
            <Edit className="h-4 w-4" />
          </Button>
          {canDeletePermanently(currentUserRole) ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUserToDelete(row.original)}
              className="text-red-600 hover:text-red-700"
              title="Excluir permanentemente"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleInactivateUser(row.original)}
              className="text-orange-600 hover:text-orange-700"
              title="Inativar usuário"
            >
              <UserX className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    }),
  ];

  const table = useReactTable({
    data: users,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  useEffect(() => {
    loadData();
    // Carregar papel do usuário atual
    const userRole = auth.getUser()?.role || '';
    setCurrentUserRole(userRole);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Carregar usuários
      const usersResponse = await api.get('/users');
      const usersData = Array.isArray(usersResponse.data) ? usersResponse.data : [];
      
      // Para cada supervisor, buscar suas células supervisionadas
      const usersWithSupervisedCells = await Promise.all(
        usersData.map(async (user: User) => {
          if (user.role === 'SUPERVISOR') {
            try {
              const supervisedResponse = await api.get(`/users/${user.id}/supervised-cells`);
              return {
                ...user,
                supervised_cells: supervisedResponse.data || []
              };
            } catch (error) {
              console.error(`Erro ao buscar células supervisionadas para ${user.name}:`, error);
              return {
                ...user,
                supervised_cells: []
              };
            }
          }
          return user;
        })
      );
      
      setUsers(usersWithSupervisedCells);
      
      // Carregar células
      const cellsResponse = await api.get('/cells');
      setCells(Array.isArray(cellsResponse.data) ? cellsResponse.data : []);
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (user: User) => {
    setUserForDetails(user);
    setDetailModalOpen(true);
  };

  const handleInactivateUser = async (user: User) => {
    if (confirm(`Tem certeza que deseja inativar o usuário ${user.name}?`)) {
      try {
        await api.patch(`/users/${user.id}/status`, { status: 'INACTIVE' });
        toast.success(`Usuário ${user.name} inativado com sucesso!`);
        await loadData();
      } catch (error) {
        console.error('Erro ao inativar usuário:', error);
        toast.error('Não foi possível inativar o usuário. Tente novamente.');
      }
    }
  };

  const canDeletePermanently = (userRole: string) => {
    return userRole === 'ADMIN';
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditModalOpen(true);
  };

  const handleDeleteUser = async (userId: string) => {
    if (confirm('Tem certeza que deseja excluir este usuário?')) {
      try {
        await api.delete(`/users/${userId}`);
        await loadData();
      } catch (error) {
        console.error('Erro ao excluir usuário:', error);
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;

    try {
      await api.delete(`/users/${userToDelete.id}`);
      toast.success(`Usuário ${userToDelete.name} excluído com sucesso!`);
      await loadData();
    } catch (error) {
      console.error('Falha ao excluir usuário:', error);
      toast.error('Não foi possível excluir o usuário. Tente novamente.');
    } finally {
      setUserToDelete(null);
    }
  };

  const handleSaveUser = async (userId: string, data: { 
    name: string; 
    email: string; 
    role: string; 
    cell_id?: string; 
    cell_ids?: string[];
    leader_cell_id?: string | null;
  }) => {
    console.log('=== DEBUG handleSaveUser ===');
    console.log('userId:', userId);
    console.log('data enviado (completo):', data);
    
    try {
      console.log('Fazendo requisição PUT para:', `/users/${userId}`);
      const response = await api.put(`/users/${userId}`, data);
      console.log('Resposta da API:', response);
      
      toast.success('Usuário atualizado com sucesso!');
      await loadData();
    } catch (error: unknown) {
      console.error('=== ERRO DETALHADO ===');
      console.error('Erro completo:', error);
      console.error('Status:', (error as any)?.response?.status);
      console.error('Data:', (error as any)?.response?.data);
      console.error('Message:', (error as any)?.message);
      
      const errorMessage = (error as any)?.response?.data?.error || (error as any)?.message || 'Erro desconhecido';
      toast.error(`Erro ao salvar usuário: ${errorMessage}`);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-gray-800">
              Gerenciamento de Usuários
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-800 flex items-center">
            <Users className="h-6 w-6 mr-2" />
            Gerenciamento de Usuários
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Barra de busca */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar usuários..."
                value={globalFilter ?? ''}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Tabela */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id} className="border-b border-gray-200">
                    {headerGroup.headers.map(header => (
                      <th
                        key={header.id}
                        className="text-left py-3 px-4 font-medium text-gray-700 cursor-pointer hover:bg-gray-50"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="py-3 px-4 text-gray-800">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Paginação */}
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-600">
                Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal de edição */}
      <EditUserModal 
        isOpen={editModalOpen} 
        user={selectedUser} 
        cells={cells} 
        onClose={() => setEditModalOpen(false)} 
        onSave={handleSaveUser} 
      />

      {/* Modal de Detalhes do Membro */}
      {detailModalOpen && userForDetails && (
        <MemberDetailModal
          isOpen={detailModalOpen}
          onClose={() => {
            setDetailModalOpen(false);
            setUserForDetails(null);
          }}
          userId={userForDetails.id}
          userName={userForDetails.name}
          userEmail={userForDetails.email}
          userRole={userForDetails.role}
        />
      )}

      {/* Modal de confirmação de exclusão */}
      {userToDelete && (
        <Modal isOpen={!!userToDelete} onClose={() => setUserToDelete(null)} title="Excluir Usuário">
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Tem certeza que deseja excluir permanentemente o usuário <strong>{userToDelete.name}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={() => setUserToDelete(null)}>Cancelar</Button>
              <Button className="bg-red-600 hover:bg-red-700" onClick={handleConfirmDelete}>Excluir</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}