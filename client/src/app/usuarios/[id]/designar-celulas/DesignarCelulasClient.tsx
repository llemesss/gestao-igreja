'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '@/components/ui';
import { ArrowLeft, Users, CheckCircle, XCircle, Plus, Minus } from 'lucide-react';
import { apiMethods } from '@/lib/api';
import { auth } from '@/lib/auth';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Cell {
  id: string;
  name: string;
  leader_id?: string;
  supervisor_id?: string;
  leader_name?: string;
  supervisor_name?: string;
  member_count: number;
}

interface UserCellAssignment {
  cell_id: string;
  cell_name: string;
  role_in_cell: 'LIDER' | 'SUPERVISOR' | 'MEMBRO';
}

interface DesignarCelulasClientProps {
  params: { id: string };
}

export default function DesignarCelulasClient({ params }: DesignarCelulasClientProps) {
  const router = useRouter();
  const userId = params.id;

  const [user, setUser] = useState<User | null>(null);
  const [cells, setCells] = useState<Cell[]>([]);
  const [userAssignments, setUserAssignments] = useState<UserCellAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCells, setSelectedCells] = useState<string[]>([]);

  useEffect(() => {
    if (userId) {
      loadData();
    }
  }, [userId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Carregar dados do usuário
      const userResponse = await apiMethods.users.getById(userId);
      if (userResponse.user) {
        setUser(userResponse.user);
      }

      // Carregar todas as células
      const cellsResponse = await apiMethods.cells.getAll();
      if (cellsResponse.data) {
        setCells(cellsResponse.data);
      }

      // Carregar designações atuais do usuário
      const assignmentsResponse = await apiMethods.users.getCellAssignments(userId);
      if (assignmentsResponse.assignments) {
        setUserAssignments(assignmentsResponse.assignments);
        
        // Se o usuário é supervisor, pré-selecionar as células que ele supervisiona
        if (userResponse.user?.role === 'SUPERVISOR') {
          const supervisedCells = assignmentsResponse.assignments
            .filter((a: UserCellAssignment) => a.role_in_cell === 'SUPERVISOR')
            .map((a: UserCellAssignment) => a.cell_id);
          setSelectedCells(supervisedCells);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignCell = async (cellId: string, roleInCell: 'LIDER' | 'SUPERVISOR' | 'MEMBRO') => {
    try {
      setSaving(true);
      
      await apiMethods.users.assignToCell(userId, {
        cell_id: cellId,
        role_in_cell: roleInCell
      });

      // Atualizar lista local
      const cell = cells.find(c => c.id === cellId);
      if (cell) {
        setUserAssignments(prev => [
          ...prev.filter(a => a.cell_id !== cellId),
          {
            cell_id: cellId,
            cell_name: cell.name,
            role_in_cell: roleInCell
          }
        ]);
      }

      // Se estamos designando o usuário logado, atualizar cookies
      const currentUser = auth.getUser();
      if (currentUser && currentUser.id === userId) {
        await auth.refreshUser();
      }

      alert('Usuário designado com sucesso!');
    } catch (error) {
      console.error('Erro ao designar usuário:', error);
      alert('Erro ao designar usuário. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleMultipleAssignSupervisor = async () => {
    try {
      setSaving(true);
      
      // Usar apiMethods para atualizar várias supervisões via axios
      await apiMethods.users.update(userId, { cell_ids: selectedCells });

      // Atualizar lista local
      const newAssignments = selectedCells.map(cellId => {
        const cell = cells.find(c => c.id === cellId);
        return {
          cell_id: cellId,
          cell_name: cell?.name || '',
          role_in_cell: 'SUPERVISOR' as const
        };
      });

      // Remover supervisões antigas e adicionar novas
      setUserAssignments(prev => [
        ...prev.filter(a => a.role_in_cell !== 'SUPERVISOR'),
        ...newAssignments
      ]);

      // Se estamos designando o usuário logado, atualizar cookies
      const currentUser = auth.getUser();
      if (currentUser && currentUser.id === userId) {
        await auth.refreshUser();
      }

      alert('Supervisões atualizadas com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar supervisões:', error);
      alert('Erro ao atualizar supervisões. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleCellSelection = (cellId: string) => {
    setSelectedCells(prev => {
      if (prev.includes(cellId)) {
        return prev.filter(id => id !== cellId);
      } else {
        return [...prev, cellId];
      }
    });
  };

  const handleRemoveAssignment = async (cellId: string) => {
    try {
      setSaving(true);
      
      await apiMethods.users.removeFromCell(userId);

      // Atualizar lista local
      setUserAssignments(prev => prev.filter(a => a.cell_id !== cellId));

      // Se estamos removendo o usuário logado, atualizar cookies
      const currentUser = auth.getUser();
      if (currentUser && currentUser.id === userId) {
        await auth.refreshUser();
      }

      alert('Usuário removido da célula com sucesso!');
    } catch (error) {
      console.error('Erro ao remover usuário da célula:', error);
      alert('Erro ao remover usuário da célula. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const isAssignedToCell = (cellId: string) => {
    return userAssignments.some(a => a.cell_id === cellId);
  };

  const getAssignmentRole = (cellId: string) => {
    const assignment = userAssignments.find(a => a.cell_id === cellId);
    return assignment?.role_in_cell;
  };

  const canAssignAsLeader = (cell: Cell) => {
    return !cell.leader_id || cell.leader_id === userId;
  };

  const canAssignAsSupervisor = (cell: Cell) => {
    return !cell.supervisor_id || cell.supervisor_id === userId;
  };

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

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Usuário não encontrado</p>
          <Button 
            variant="outline" 
            onClick={() => router.push('/usuarios')}
            className="mt-4"
          >
            Voltar para Usuários
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
              onClick={() => router.push('/usuarios')}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Voltar para Usuários</span>
            </Button>
          </div>

          {/* Page Header */}
          <div className="flex items-center space-x-3">
            <Users className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Designar Células</h1>
              <p className="text-gray-600">
                Gerenciar designações de células para <strong>{user.name}</strong>
              </p>
            </div>
          </div>

          {/* User Info */}
          <Card>
            <CardHeader>
              <CardTitle>Informações do Usuário</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold text-lg">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{user.name}</h3>
                  <p className="text-gray-600 text-sm">{user.email}</p>
                  <Badge className="mt-1">
                    {getRoleLabel(user.role)}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Assignments */}
          {userAssignments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Designações Atuais ({userAssignments.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {userAssignments.map((assignment) => (
                    <div key={assignment.cell_id} className="flex items-center justify-between p-3 border rounded-lg bg-green-50">
                      <div className="flex items-center space-x-3">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <div>
                          <h4 className="font-medium text-gray-900">{assignment.cell_name}</h4>
                          <Badge className={getRoleBadgeColor(assignment.role_in_cell)}>
                            {getRoleLabel(assignment.role_in_cell)}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveAssignment(assignment.cell_id)}
                        disabled={saving}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Minus className="h-4 w-4 mr-1" />
                        Remover
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Available Cells */}
          <Card>
            <CardHeader>
              <CardTitle>Células Disponíveis ({cells.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {/* UI Condicional baseada no papel do usuário */}
              {user.role === 'SUPERVISOR' ? (
                // Interface para supervisores - checkboxes para múltipla seleção
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900">Selecione as células para supervisionar:</h4>
                    <Button
                      onClick={handleMultipleAssignSupervisor}
                      disabled={saving || selectedCells.length === 0}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {saving ? 'Salvando...' : `Atualizar Supervisões (${selectedCells.length})`}
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {cells.map((cell) => (
                      <div key={cell.id} className="p-4 border rounded-lg hover:bg-gray-50">
                        <div className="flex items-start space-x-3">
                          <input
                            type="checkbox"
                            id={`cell-${cell.id}`}
                            checked={selectedCells.includes(cell.id)}
                            onChange={() => handleCellSelection(cell.id)}
                            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor={`cell-${cell.id}`} className="flex-1 cursor-pointer">
                            <h4 className="font-medium text-gray-900">{cell.name}</h4>
                            <div className="text-sm text-gray-600 mt-1">
                              <div>Membros: {cell.member_count}</div>
                              {cell.leader_name && <div>Líder: {cell.leader_name}</div>}
                              {cell.supervisor_name && <div>Supervisor atual: {cell.supervisor_name}</div>}
                            </div>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {cells.length === 0 && (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">Nenhuma célula encontrada</p>
                    </div>
                  )}
                </div>
              ) : (
                // Interface original para líderes e outros papéis - seleção única
                <div className="space-y-4">
                  {cells.map((cell) => {
                    const isAssigned = isAssignedToCell(cell.id);
                    const currentRole = getAssignmentRole(cell.id);
                    
                    return (
                      <div key={cell.id} className={`p-4 border rounded-lg ${isAssigned ? 'bg-green-50 border-green-200' : 'hover:bg-gray-50'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {isAssigned ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                              <XCircle className="h-5 w-5 text-gray-400" />
                            )}
                            <div>
                              <h4 className="font-medium text-gray-900">{cell.name}</h4>
                              <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                                <span>Membros: {cell.member_count}</span>
                                {cell.leader_name && (
                                  <span>Líder: {cell.leader_name}</span>
                                )}
                                {cell.supervisor_name && (
                                  <span>Supervisor: {cell.supervisor_name}</span>
                                )}
                              </div>
                              {isAssigned && currentRole && (
                                <Badge className={`mt-2 ${getRoleBadgeColor(currentRole)}`}>
                                  Designado como {getRoleLabel(currentRole)}
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex space-x-2">
                            {!isAssigned ? (
                              <>
                                {/* Botão para designar como Membro */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAssignCell(cell.id, 'MEMBRO')}
                                  disabled={saving}
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Membro
                                </Button>
                                
                                {/* Botão para designar como Supervisor (se disponível) */}
                                {canAssignAsSupervisor(cell) && (user.role === 'SUPERVISOR' || user.role === 'COORDENADOR' || user.role === 'PASTOR' || user.role === 'ADMIN') && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAssignCell(cell.id, 'SUPERVISOR')}
                                    disabled={saving}
                                    className="text-blue-600 hover:text-blue-700"
                                  >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Supervisor
                                  </Button>
                                )}
                                
                                {/* Botão para designar como Líder (se disponível) */}
                                {canAssignAsLeader(cell) && (user.role === 'LIDER' || user.role === 'SUPERVISOR' || user.role === 'COORDENADOR' || user.role === 'PASTOR' || user.role === 'ADMIN') && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAssignCell(cell.id, 'LIDER')}
                                    disabled={saving}
                                    className="text-green-600 hover:text-green-700"
                                  >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Líder
                                  </Button>
                                )}
                              </>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoveAssignment(cell.id)}
                                disabled={saving}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Minus className="h-4 w-4 mr-1" />
                                Remover
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {cells.length === 0 && (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">Nenhuma célula encontrada</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}