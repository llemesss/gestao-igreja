'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Badge } from '@/components/ui';
import { ArrowLeft, Home, Plus, Users, Calendar, Settings, UserPlus, UserMinus, Crown, Search } from 'lucide-react';
import { api, apiMethods } from '@/lib/api';
import { User, Cell, CellMember } from '@/types';
import { Modal } from '@/components/ui/Modal';

interface CreateCellModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  loading: boolean;
}

interface DesignationModalProps {
  isOpen: boolean;
  onClose: () => void;
  cell: Cell | null;
  onRefresh: () => void;
}

function CreateCellModal({ isOpen, onClose, onSave, loading }: CreateCellModalProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Número da célula é obrigatório');
      return;
    }

    // Verificar se é apenas números
    if (!/^\d+$/.test(name.trim())) {
      setError('Digite apenas números para a célula');
      return;
    }

    // Adicionar "Célula" antes do número
    const cellName = `Célula ${name.trim()}`;
    onSave(cellName);
  };

  const handleClose = () => {
    setName('');
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Nova Célula">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Número da Célula
          </label>
          <Input
            type="number"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Digite apenas o número (ex: 1, 2, 3...)"
            disabled={loading}
          />
          <p className="text-xs text-gray-500 mt-1">
            Será criada como &quot;Célula {name || 'X'}&quot;
          </p>
        </div>

        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}

        <div className="flex space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={loading}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="flex-1"
          >
            {loading ? 'Criando...' : 'Criar Célula'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DesignationModal({ isOpen, onClose, cell, onRefresh }: DesignationModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [cellMembers, setCellMembers] = useState<CellMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'leaders' | 'supervisor'>('leaders');

  const loadCellMembers = useCallback(async () => {
    if (!cell) return;
    try {
      const response = await apiMethods.cells.getMembers(cell.id);
      setCellMembers(response.members || []);
    } catch (error) {
      console.error('Erro ao carregar membros da célula:', error);
    }
  }, [cell?.id]);

  useEffect(() => {
    if (isOpen && cell) {
      loadUsers();
      loadCellMembers();
    }
  }, [isOpen, cell?.id, loadCellMembers]);

  const loadUsers = async () => {
    try {
      const data = await apiMethods.users.getAll();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      setUsers([]); // Garantir que users seja sempre um array
    }
  };

  const handleAssignLeader = async (userId: string) => {
    if (!cell) return;
    setLoading(true);
    try {
      await apiMethods.cells.assignLeader(cell.id, userId);
      await loadCellMembers();
      onRefresh();
    } catch (error) {
      console.error('Erro ao designar líder:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveLeader = async (userId: string) => {
    if (!cell) return;
    setLoading(true);
    try {
      await apiMethods.cells.removeLeader(cell.id, userId);
      await loadCellMembers();
      onRefresh();
    } catch (error) {
      console.error('Erro ao remover líder:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignSupervisor = async (supervisorId: string | null) => {
    if (!cell) return;
    setLoading(true);
    try {
      await apiMethods.cells.assignSupervisor(cell.id, supervisorId);
      onRefresh();
    } catch (error) {
      console.error('Erro ao designar supervisor:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Verificação de segurança para garantir que users é um array
  if (!Array.isArray(users)) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Carregando...">
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p>Carregando usuários...</p>
          </div>
        </div>
      </Modal>
    );
  }

  const availableSupervisors = users.filter(user => 
    ['SUPERVISOR', 'COORDENADOR', 'PASTOR', 'ADMIN'].includes(user.role)
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Gerenciar Designações - ${cell?.name}`}>
      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex space-x-4 border-b">
          <button
            className={`pb-2 px-1 ${activeTab === 'leaders' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
            onClick={() => setActiveTab('leaders')}
          >
            Líderes
          </button>
          <button
            className={`pb-2 px-1 ${activeTab === 'supervisor' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
            onClick={() => setActiveTab('supervisor')}
          >
            Supervisor
          </button>
        </div>

        {activeTab === 'leaders' && (
          <div className="space-y-4">
            <h3 className="font-medium">Membros da Célula</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {cellMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-sm text-gray-600">{member.email}</p>
                    <p className="text-xs text-gray-500">{member.role}</p>
                  </div>
                  <div className="flex space-x-2">
                    {member.is_leader ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveLeader(member.id)}
                        disabled={loading}
                        className="text-red-600 hover:text-red-700"
                      >
                        <UserMinus className="h-4 w-4 mr-1" />
                        Remover Líder
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAssignLeader(member.id)}
                        disabled={loading}
                      >
                        <UserPlus className="h-4 w-4 mr-1" />
                        Designar Líder
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {cellMembers.length === 0 && (
                <p className="text-gray-600 text-center py-4">Nenhum membro encontrado nesta célula</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'supervisor' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Supervisor Atual</h3>
              {cell?.supervisor_name && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAssignSupervisor(null)}
                  disabled={loading}
                  className="text-red-600 hover:text-red-700"
                >
                  Remover Supervisor
                </Button>
              )}
            </div>
            
            {cell?.supervisor_name ? (
              <div className="p-3 border rounded-lg bg-blue-50">
                <p className="font-medium">{cell.supervisor_name}</p>
                <p className="text-sm text-gray-600">Supervisor atual</p>
              </div>
            ) : (
              <p className="text-gray-600">Nenhum supervisor designado</p>
            )}

            <h3 className="font-medium">Designar Novo Supervisor</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {availableSupervisors.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-gray-600">{user.email}</p>
                    <p className="text-xs text-gray-500">{user.role}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAssignSupervisor(user.id)}
                    disabled={loading || user.id === cell?.supervisor_id}
                  >
                    <Crown className="h-4 w-4 mr-1" />
                    {user.id === cell?.supervisor_id ? 'Atual' : 'Designar'}
                  </Button>
                </div>
              ))}
              {availableSupervisors.length === 0 && (
                <p className="text-gray-600 text-center py-4">Nenhum usuário disponível para supervisão</p>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function CelulasPage() {
  const router = useRouter();
  const [cells, setCells] = useState<Cell[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [designationModalOpen, setDesignationModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<Cell | null>(null);

  useEffect(() => {
    loadCells();
  }, []);

  const loadCells = async () => {
    try {
      setLoading(true);
      const response = await apiMethods.cells.getCells();
      console.log('Loaded cells:', response); // Debug log
      setCells(response);
    } catch (error) {
      console.error('Erro ao carregar células:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCell = async (name: string) => {
    setCreateLoading(true);
    try {
      await apiMethods.cells.create(name);
      setCreateModalOpen(false);
      loadCells();
    } catch (error) {
      console.error('Erro ao criar célula:', error);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleOpenDesignation = (cell: Cell) => {
    setSelectedCell(cell);
    setDesignationModalOpen(true);
  };

  const handleCloseDesignation = () => {
    setDesignationModalOpen(false);
    setSelectedCell(null);
  };

  const handleEditCell = (cell: Cell) => {
    // Navegar para página de detalhes/edição da célula
    router.push(`/celulas/${cell.id}`);
  };

  const handleDeleteCell = async (cell: Cell) => {
    // Verificar se o ID da célula é válido
    if (!cell || !cell.id) {
      alert('Erro: ID da célula não encontrado. Recarregue a página e tente novamente.');
      return;
    }
    
    if (window.confirm(`Tem certeza que deseja excluir a ${cell.name}?`)) {
      try {
        await apiMethods.cells.delete(cell.id);
        alert('Célula excluída com sucesso!');
        loadCells(); // Recarregar lista
      } catch (error) {
        console.error('Erro ao excluir célula:', error);
        alert('Erro ao excluir célula. Tente novamente.');
      }
    }
  };

  const handleNavigate = (cellId: string) => {
    // Log para depuração final
    console.log('ID recebido para navegação:', cellId);

    if (cellId) {
      router.push(`/celulas/${cellId}`);
    } else {
      alert('Erro crítico: O ID da célula é inválido e não pode ser passado para a navegação.');
    }
  };

  // Salvaguarda: garantir que sempre operamos sobre um array
  const safeCells = Array.isArray(cells) ? cells : [];
  const filteredCells = safeCells.filter(cell =>
    cell.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (cell.supervisor_name && cell.supervisor_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const activeCells = cells.length; // Todas as células são consideradas ativas por padrão
  const totalMembers = cells.reduce((sum, cell) => sum + cell.member_count, 0);

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
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Home className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Gerenciar Células</h1>
                <p className="text-gray-600">Administre as células da igreja</p>
              </div>
            </div>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setCreateModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Célula
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total de Células</p>
                <p className="text-2xl font-bold text-gray-900">{cells.length}</p>
              </div>
              <Home className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Células Ativas</p>
                <p className="text-2xl font-bold text-green-600">{activeCells}</p>
              </div>
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                <div className="h-3 w-3 bg-green-600 rounded-full"></div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total de Membros</p>
                <p className="text-2xl font-bold text-purple-600">{totalMembers}</p>
              </div>
              <Users className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar por nome ou supervisor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          </div>
        </CardContent>
      </Card>

      {/* Cells List */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Células ({filteredCells.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Carregando células...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Array.isArray(filteredCells) && filteredCells.length > 0 ? (
                filteredCells.map((cell) => (
                  <div 
                    key={cell.id} 
                    className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleNavigate(cell.id)}
                  >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-semibold text-gray-900 text-lg">{cell.name}</h3>
                        <Badge className="bg-green-100 text-green-800">
                          Ativa
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                        <div className="flex items-center space-x-2">
                          <Users className="h-4 w-4" />
                          <span>Supervisor: {cell.supervisor_name || 'Não definido'}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Users className="h-4 w-4" />
                          <span>{cell.member_count} membros</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Users className="h-4 w-4" />
                          <span>Líderes: {cell.leaders?.length || 0}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4" />
                          <span>Criada em: {new Date(cell.created_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2 ml-4" onClick={(e) => e.stopPropagation()}>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleNavigate(cell.id)}
                        title="Gerenciar Célula"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
              ) : (
                <div className="text-center py-8">
                  <Home className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Nenhuma célula encontrada</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
        </div>
      </div>

      {/* Modal de Criação */}
      <CreateCellModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSave={handleCreateCell}
        loading={createLoading}
      />

      {/* Modal de Designação */}
      {selectedCell && (
        <DesignationModal
          isOpen={designationModalOpen}
          onClose={handleCloseDesignation}
          cell={selectedCell}
          onRefresh={loadCells}
        />
      )}
    </div>
  );
}