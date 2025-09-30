'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';
import { auth } from '@/lib/auth';
import { 
  useReactTable, 
  getCoreRowModel, 
  getFilteredRowModel, 
  getSortedRowModel,
  getPaginationRowModel,
  createColumnHelper,
  flexRender 
} from '@tanstack/react-table';
import { Edit, Trash2, Search, Home, Plus, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useRouter } from 'next/navigation';

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

interface User {
  id: string;
  name: string;
  role: string;
}

interface CreateEditCellModalProps {
  isOpen: boolean;
  cell: Cell | null;
  leaders: User[];
  onClose: () => void;
  onSave: (data: { name: string; leader_ids?: string[]; secretary_id?: string }) => Promise<void>;
}

const CreateEditCellModal: React.FC<CreateEditCellModalProps> = ({ isOpen, cell, leaders, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [selectedLeaderIds, setSelectedLeaderIds] = useState<string[]>([]);
  const [selectedSecretaryId, setSelectedSecretaryId] = useState<string>('');
  const [members, setMembers] = useState<User[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
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

  const loadCellMembers = async (cellId: string) => {
    if (!cellId) return;
    
    setLoadingMembers(true);
    try {
      const response = await api.get(`/cells/${cellId}/members`);
      setMembers(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar membros da célula:', error);
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Nome da célula é obrigatório');
      return;
    }
    
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        leader_ids: selectedLeaderIds.length > 0 ? selectedLeaderIds : undefined,
        secretary_id: selectedSecretaryId || undefined
      });
      onClose();
    } catch (error) {
      console.error('Erro ao salvar célula:', error);
      alert('Erro ao salvar célula');
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

export default function GerenciarCelulasView() {
  const router = useRouter();
  const [cells, setCells] = useState<Cell[]>([]);
  const [leaders, setLeaders] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalFilter, setGlobalFilter] = useState('');
  const [createEditModalOpen, setCreateEditModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<Cell | null>(null);

  const columnHelper = createColumnHelper<Cell>();

  const columns = [
    columnHelper.accessor('name', {
      header: 'Nome/Número',
      cell: info => (
        <div className="font-medium text-gray-900">
          {info.getValue()}
        </div>
      ),
    }),
    columnHelper.accessor('leaders', {
      header: 'Líder(es)',
      cell: info => {
        const leaders = info.getValue();
        if (leaders.length === 0) {
          return <span className="text-gray-500 italic">Sem líder</span>;
        }
        return (
          <div className="space-y-1">
            {leaders.map((leader, index) => (
              <div key={leader.id} className="text-sm">
                {leader.name}
              </div>
            ))}
          </div>
        );
      },
    }),
    columnHelper.accessor('supervisor_name', {
      header: 'Supervisor',
      cell: info => info.getValue() || <span className="text-gray-500 italic">Sem supervisor</span>,
    }),
    columnHelper.accessor('member_count', {
      header: 'Qtd. Membros',
      cell: info => (
        <div className="flex items-center space-x-1">
          <Users className="h-4 w-4 text-gray-400" />
          <span className="font-medium">{info.getValue()}</span>
        </div>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Ações',
      cell: ({ row }) => (
        <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEditCell(row.original)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDeleteCell(row.original.id)}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    }),
  ];

  const table = useReactTable({
    data: cells,
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
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Buscar apenas dados das células - o backend já retorna as informações necessárias
      const cellsResponse = await api.get('/cells');
      setCells(cellsResponse.data || []);
      
      // Para líderes, buscar usuários apenas quando necessário (no modal)
      // Isso será feito de forma lazy quando o modal for aberto
      setLeaders([]);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      // Em caso de erro, definir arrays vazios
      setCells([]);
      setLeaders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCell = () => {
    setSelectedCell(null);
    setCreateEditModalOpen(true);
  };

  const handleEditCell = (cell: Cell) => {
    setSelectedCell(cell);
    setCreateEditModalOpen(true);
  };

  const handleDeleteCell = async (cellId: string) => {
    if (confirm('Tem certeza que deseja excluir esta célula?')) {
      try {
        await api.delete(`/cells/${cellId}`);
        await loadData();
      } catch (error) {
        console.error('Erro ao excluir célula:', error);
      }
    }
  };

  const handleCellClick = (cellId: string) => {
    router.push(`/celulas/${cellId}`);
  };

  const handleSaveCell = async (data: { name: string; leader_ids?: string[]; secretary_id?: string }) => {
    try {
      if (selectedCell) {
        // Editar célula existente
        await api.put(`/cells/${selectedCell.id}`, data);
      } else {
        // Criar nova célula
        await api.post('/cells', data);
      }
      await loadData();
    } catch (error) {
      console.error('Erro ao salvar célula:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-gray-800">
              Gerenciamento de Células
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
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold text-gray-800 flex items-center">
              <Home className="h-6 w-6 mr-2" />
              Gerenciamento de Células
            </CardTitle>
            <Button onClick={handleCreateCell} className="flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>Nova Célula</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Barra de busca */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar células..."
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
                  <tr 
                    key={row.id} 
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleCellClick(row.original.id)}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="py-3 px-4">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-gray-700">
              Mostrando {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} a{' '}
              {Math.min(
                (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                table.getFilteredRowModel().rows.length
              )}{' '}
              de {table.getFilteredRowModel().rows.length} células
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
              <span className="text-sm text-gray-700">
                Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
              </span>
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
        </CardContent>
      </Card>

      {/* Modal de Criação/Edição */}
      <CreateEditCellModal
        isOpen={createEditModalOpen}
        cell={selectedCell}
        leaders={leaders}
        onClose={() => {
          setCreateEditModalOpen(false);
          setSelectedCell(null);
        }}
        onSave={handleSaveCell}
      />
    </div>
  );
}