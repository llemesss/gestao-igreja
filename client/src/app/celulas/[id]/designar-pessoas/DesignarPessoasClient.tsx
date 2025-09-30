'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Input } from '@/components/ui';
import { ArrowLeft, Users, Search, Plus, Minus, CheckCircle, XCircle } from 'lucide-react';
import { api } from '@/lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  cell_id?: string;
  cell_name?: string;
}

interface Cell {
  id: string;
  name: string;
  description?: string;
  supervisor_id?: string;
  supervisor_name?: string;
  member_count: number;
}

interface CellMember {
  id: string;
  name: string;
  email: string;
  role: string;
  role_in_cell: 'LIDER' | 'SUPERVISOR' | 'MEMBRO';
}

export default function DesignarPessoasClient({ params }: { params: { id: string } }) {
  const router = useRouter();
  const cellId = params.id;

  const [cell, setCell] = useState<Cell | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [currentMembers, setCurrentMembers] = useState<CellMember[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (cellId) {
      loadData();
    }
  }, [cellId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Carregar dados da célula
      const cellResponse = await api.get(`/cells/${cellId}`);
      if (cellResponse.data) {
        setCell(cellResponse.data);
      }

      // Carregar todos os usuários
      const usersResponse = await api.get('/users');
      if (usersResponse.data) {
        setUsers(usersResponse.data);
      }

      // Carregar membros atuais da célula
      const membersResponse = await api.get(`/cells/${cellId}/members`);
      if (membersResponse.data) {
        setCurrentMembers(membersResponse.data.members || []);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignUser = async (userId: string, roleInCell: 'LIDER' | 'SUPERVISOR' | 'MEMBRO') => {
    try {
      setSaving(true);
      
      await api.post(`/cells/${cellId}/members`, {
        user_id: userId,
        role_in_cell: roleInCell
      });

      // Atualizar listas locais
      const user = users.find(u => u.id === userId);
      if (user) {
        setCurrentMembers(prev => [
          ...prev.filter(m => m.id !== userId),
          {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            role_in_cell: roleInCell
          }
        ]);

        setUsers(prev => prev.map(u => 
          u.id === userId ? { ...u, cell_id: cellId, cell_name: cell?.name } : u
        ));
      }

      alert('Pessoa designada com sucesso!');
    } catch (error) {
      console.error('Erro ao designar pessoa:', error);
      alert('Erro ao designar pessoa. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    try {
      setSaving(true);
      
      await api.delete(`/cells/${cellId}/members/${userId}`);

      // Atualizar listas locais
      setCurrentMembers(prev => prev.filter(m => m.id !== userId));
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, cell_id: undefined, cell_name: undefined } : u
      ));

      alert('Pessoa removida com sucesso!');
    } catch (error) {
      console.error('Erro ao remover pessoa:', error);
      alert('Erro ao remover pessoa. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const isUserInCell = (userId: string) => {
    return currentMembers.some(m => m.id === userId);
  };

  const getUserRoleInCell = (userId: string) => {
    const member = currentMembers.find(m => m.id === userId);
    return member?.role_in_cell;
  };

  const canAssignAsLeader = () => {
    return !currentMembers.some(m => m.role_in_cell === 'LIDER');
  };

  const canAssignAsSupervisor = () => {
    return !currentMembers.some(m => m.role_in_cell === 'SUPERVISOR');
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const availableUsers = filteredUsers.filter(user => user.cell_id !== cellId);
  const assignedUsers = filteredUsers.filter(user => user.cell_id === cellId);

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      LIDER: 'bg-green-100 text-green-800',
      SUPERVISOR: 'bg-blue-100 text-blue-800',
      MEMBRO: 'bg-gray-100 text-gray-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      LIDER: 'Líder',
      SUPERVISOR: 'Supervisor',
      MEMBRO: 'Membro'
    };
    return labels[role] || role;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-2">Carregando dados...</p>
        </div>
      </div>
    );
  }

  if (!cell) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Célula não encontrada</p>
          <Button 
            variant="outline" 
            onClick={() => router.push('/celulas')}
            className="mt-4"
          >
            Voltar para Células
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6">
        <div className="space-y-6">
          {/* Navigation Header */}
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              onClick={() => router.push(`/celulas/${cellId}`)}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Voltar para Célula</span>
            </Button>
          </div>

          {/* Page Header */}
          <div className="flex items-center space-x-3">
            <Users className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Designar Pessoas</h1>
              <p className="text-gray-600">
                Gerenciar membros da célula <strong>{cell.name}</strong>
              </p>
            </div>
          </div>

          {/* Search */}
          <Card>
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar por nome ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Current Members */}
          {assignedUsers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Membros Atuais ({assignedUsers.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {assignedUsers.map((user) => {
                    const roleInCell = getUserRoleInCell(user.id);
                    return (
                      <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg bg-green-50">
                        <div className="flex items-center space-x-3">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-semibold text-sm">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">{user.name}</h4>
                            <p className="text-gray-600 text-sm">{user.email}</p>
                            {roleInCell && (
                              <Badge className={`mt-1 ${getRoleBadgeColor(roleInCell)}`}>
                                {getRoleLabel(roleInCell)}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveUser(user.id)}
                          disabled={saving}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Minus className="h-4 w-4 mr-1" />
                          Remover
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Available Users */}
          <Card>
            <CardHeader>
              <CardTitle>Pessoas Disponíveis ({availableUsers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {availableUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center space-x-3">
                      <XCircle className="h-5 w-5 text-gray-400" />
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-semibold text-sm">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{user.name}</h4>
                        <p className="text-gray-600 text-sm">{user.email}</p>
                        <Badge className="mt-1">
                          {getRoleLabel(user.role)}
                        </Badge>
                        {user.cell_name && (
                          <p className="text-blue-600 text-xs mt-1">
                            Já está na célula: {user.cell_name}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      {/* Botão para designar como Membro */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAssignUser(user.id, 'MEMBRO')}
                        disabled={saving}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Membro
                      </Button>
                      
                      {/* Botão para designar como Supervisor (se disponível) */}
                      {canAssignAsSupervisor() && (user.role === 'SUPERVISOR' || user.role === 'COORDENADOR' || user.role === 'PASTOR' || user.role === 'ADMIN') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAssignUser(user.id, 'SUPERVISOR')}
                          disabled={saving}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Supervisor
                        </Button>
                      )}
                      
                      {/* Botão para designar como Líder (se disponível) */}
                      {canAssignAsLeader() && (user.role === 'LIDER' || user.role === 'SUPERVISOR' || user.role === 'COORDENADOR' || user.role === 'PASTOR' || user.role === 'ADMIN') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAssignUser(user.id, 'LIDER')}
                          disabled={saving}
                          className="text-green-600 hover:text-green-700"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Líder
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                
                {availableUsers.length === 0 && (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">
                      {searchTerm ? 'Nenhuma pessoa encontrada com esse termo de busca' : 'Todas as pessoas já estão designadas para células'}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}