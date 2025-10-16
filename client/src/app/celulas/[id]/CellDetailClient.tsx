'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Badge } from '@/components/ui';
import { ArrowLeft, Users, Calendar, Phone, Mail, MapPin, Search, UserPlus, Edit, Trash2, Eye, Printer, Settings } from 'lucide-react';
import { api, apiMethods } from '@/lib/api';
import MemberDetailModal from '@/components/MemberDetailModal';
import AddMemberModal from '@/components/AddMemberModal';

interface Member {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  role: string;
  joined_at: string;
  prayer_count?: number;
  last_prayer?: string;
  cell_id?: string;
  cell_name?: string;
  oikos1?: string;
  oikos2?: string;
  oikos_relacao_1?: { nome?: string } | null;
  oikos_relacao_2?: { nome?: string } | null;
  oikos_1?: { nome?: string } | null;
  oikos_2?: { nome?: string } | null;
}

interface CellDetail {
  id: string;
  name: string;
  description?: string;
  supervisor_id?: string;
  supervisor_name?: string;
  member_count: number;
  leaders: Array<{
    id: string;
    name: string;
    email: string;
  }>;
  created_at: string;
  updated_at: string;
}

export default function CellDetailClient() {
  const router = useRouter();
  const params = useParams();
  const cellId = params.id as string;

  const [cell, setCell] = useState<CellDetail | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);

  const normalizedSearch = (searchTerm || '').trim().toLowerCase();
  const safeMembers = Array.isArray(members) ? members : [];
  const filteredMembers = normalizedSearch
    ? safeMembers.filter(member =>
        (member.name || '').toLowerCase().includes(normalizedSearch) ||
        (member.email || '').toLowerCase().includes(normalizedSearch)
      )
    : safeMembers;

  const loadCellDetail = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiMethods.cells.getDetail(cellId);
      setCell(data);
    } catch (error) {
      console.error('Erro ao carregar detalhes da célula:', error);
    } finally {
      setLoading(false);
    }
  }, [cellId]);

  const loadMembers = useCallback(async () => {
    try {
      console.log('🔍 [DEBUG] Carregando membros para célula:', cellId);
      const data = await apiMethods.cells.getMembers(cellId);
      console.log('DADOS RECEBIDOS PELO FRONTEND:', data);
      console.log('🔍 [DEBUG] Dados recebidos da API:', data);
      console.log('🔍 [DEBUG] Tipo dos dados:', typeof data);
      console.log('🔍 [DEBUG] É array?', Array.isArray(data));
      console.log('🔍 [DEBUG] Quantidade de membros:', data?.length);
      setMembers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('❌ [DEBUG] Erro ao carregar membros:', error);
    }
  }, [cellId]);

  useEffect(() => {
    console.log('Cell ID from params:', cellId);
    if (cellId && cellId !== 'undefined' && cellId !== 'null') {
      loadCellDetail();
      loadMembers();
    } else {
      console.error('Invalid cell ID:', cellId);
      router.push('/celulas');
    }
  }, [cellId, loadCellDetail, loadMembers, router]);

  const handleMemberClick = (member: Member) => {
    setSelectedMember(member);
    setMemberModalOpen(true);
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!cell) return;
    
    // Confirmar antes de fazer qualquer alteração
    const confirmRemove = window.confirm('Tem certeza que deseja remover este membro da célula?');
    if (!confirmRemove) {
      return; // Se cancelar, não faz nada
    }

    try {
      setLoading(true);
      await apiMethods.cells.removeMember(cell.id, memberId);
      // Só recarrega a lista após sucesso na API
      await loadMembers();
      alert('Membro removido com sucesso!');
    } catch (error) {
      console.error('Erro ao remover membro:', error);
      alert('Erro ao remover membro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-red-100 text-red-800';
      case 'PASTOR': return 'bg-purple-100 text-purple-800';
      case 'COORDENADOR': return 'bg-blue-100 text-blue-800';
      case 'SUPERVISOR': return 'bg-green-100 text-green-800';
      case 'LIDER': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role: string) => {
    const labels = {
      'ADMIN': 'Administrador',
      'PASTOR': 'Pastor',
      'COORDENADOR': 'Coordenador',
      'SUPERVISOR': 'Supervisor',
      'LIDER': 'Líder',
      'MEMBRO': 'Membro'
    };
    return labels[role as keyof typeof labels] || role;
  };

  const handleDeleteCell = async () => {
    if (!cell) return;
    
    const confirmDelete = window.confirm(
      `Tem certeza que deseja excluir a célula "${cell.name}"? Esta ação não pode ser desfeita.`
    );
    
    if (!confirmDelete) return;
    
    try {
      setLoading(true);
      await apiMethods.cells.delete(cellId);
      alert('Célula excluída com sucesso!');
      router.push('/celulas');
    } catch (error) {
      console.error('Erro ao excluir célula:', error);
      alert('Erro ao excluir célula. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintCell = () => {
    // Criar conteúdo para impressão
    const printContent = `
      <html>
        <head>
          <title>Relatório da Célula - ${cell?.name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .info { margin-bottom: 20px; }
            .members { margin-top: 30px; }
            .member { margin-bottom: 10px; padding: 10px; border: 1px solid #ddd; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Relatório da Célula</h1>
            <h2>${cell?.name}</h2>
            <p>Gerado em: ${new Date().toLocaleDateString('pt-BR')}</p>
          </div>
          
          <div class="info">
            <h3>Informações Gerais</h3>
            <p><strong>Nome:</strong> ${cell?.name}</p>
            <p><strong>Descrição:</strong> ${cell?.description || 'Não informado'}</p>
            <p><strong>Supervisor:</strong> ${cell?.supervisor_name || 'Não designado'}</p>
            <p><strong>Total de Membros:</strong> ${cell?.member_count}</p>
            <p><strong>Criada em:</strong> ${cell?.created_at ? new Date(cell.created_at).toLocaleDateString('pt-BR') : 'N/A'}</p>
          </div>
          
          <div class="members">
            <h3>Lista de Membros (${Array.isArray(members) ? members.length : 0})</h3>
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Email</th>
                  <th>Função</th>
                  <th>Membro desde</th>
                </tr>
              </thead>
              <tbody>
                ${(Array.isArray(members) ? members : []).map(member => `
                  <tr>
                    <td>${member.name}</td>
                    <td>${member.email}</td>
                    <td>${getRoleLabel(member.role)}</td>
                    <td>${(member.created_at || member.joined_at) ? new Date(member.created_at || member.joined_at).toLocaleDateString('pt-BR') : 'N/A'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </body>
      </html>
    `;

    // Abrir janela de impressão
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!cell) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Célula não encontrada</h2>
          <Button onClick={() => router.push('/celulas')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Células
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => router.push('/celulas')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{cell.name}</h1>
              <p className="text-gray-600 mt-1">
                {cell.description || 'Detalhes da célula'}
              </p>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button 
              variant="outline"
              onClick={() => router.push(`/celulas/${cellId}/designar-pessoas`)}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Designar Pessoas
            </Button>
            <Button 
              variant="outline"
              onClick={() => router.push(`/celulas/${cellId}/editar`)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Editar Célula
            </Button>
            <Button 
              variant="outline" 
              className="text-red-600 hover:text-red-700"
              onClick={handleDeleteCell}
              disabled={loading}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir Célula
            </Button>
            <Button 
              variant="outline"
              onClick={handlePrintCell}
            >
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total de Membros</p>
                  <p className="text-2xl font-bold text-blue-600">{Array.isArray(members) ? members.length : 0}</p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Líderes</p>
                  <p className="text-2xl font-bold text-green-600">{Array.isArray(cell.leaders) ? cell.leaders.length : 0}</p>
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
                  <p className="text-sm font-medium text-gray-600">Supervisor</p>
                  <p className="text-lg font-semibold text-purple-600">
                    {cell.supervisor_name || 'Não definido'}
                  </p>
                </div>
                <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <div className="h-3 w-3 bg-purple-600 rounded-full"></div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Criada em</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {cell?.created_at ? new Date(cell.created_at).toLocaleDateString('pt-BR') : 'N/A'}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-gray-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Leaders Section */}
        {Array.isArray(cell.leaders) && cell.leaders.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Líderes da Célula</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cell.leaders.map((leader) => (
                  <div key={leader.id} className="border rounded-lg p-4 bg-green-50">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                        <Users className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate max-w-[200px]">{leader.name}</h3>
                        <p className="text-sm text-gray-600 truncate max-w-[240px]">{leader.email}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar membros por nome ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={() => setAddMemberModalOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Adicionar Membro
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Members List */}
        <Card>
          <CardHeader>
            <CardTitle>Membros da Célula ({filteredMembers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredMembers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Nenhum membro encontrado</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200 p-2">
                {filteredMembers.map((member) => (
                  <li key={member.id} className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 min-w-0">
                        <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <Users className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-3 mb-1">
                            <h3 className="font-semibold text-gray-900 truncate max-w-[180px]">{member.name}</h3>
                            <Badge className={getRoleBadgeColor(member.role)}>
                              {getRoleLabel(member.role)}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-1 gap-2 text-sm text-gray-600">
                            <div className="flex items-center space-x-2">
                              <Mail className="h-4 w-4" />
                              <span className="break-all">{member.email}</span>
                            </div>
                            {member.phone && (
                              <div className="flex items-center space-x-2">
                                <Phone className="h-4 w-4" />
                                <span className="break-all">{member.phone}</span>
                              </div>
                            )}
                            {member.address && (
                              <div className="flex items-center space-x-2">
                                <MapPin className="h-4 w-4" />
                                <span className="break-words">{member.address}</span>
                              </div>
                            )}
                            <div className="flex items-center space-x-2">
                              <Calendar className="h-4 w-4" />
                              <span>
                                {(() => {
                                  const memberJoinedDate = member?.created_at || member?.joined_at;
                                  return memberJoinedDate
                                    ? `Membro desde ${new Date(memberJoinedDate).toLocaleDateString('pt-BR')}`
                                    : 'Membro desde: N/A';
                                })()}
                              </span>
                            </div>
                            {member.cell_name && (
                              <div className="flex items-center space-x-2">
                                <Users className="h-4 w-4" />
                                <span className="break-words">Célula: {member.cell_name}</span>
                              </div>
                            )}
                            {(
                              (member.oikos_relacao_1 && member.oikos_relacao_1.nome) ||
                              (member.oikos_relacao_2 && member.oikos_relacao_2.nome) ||
                              (member.oikos_1 && member.oikos_1.nome) ||
                              (member.oikos_2 && member.oikos_2.nome) ||
                              member.oikos1 || member.oikos2
                            ) && (
                              <div className="flex items-start space-x-2">
                                <Users className="h-4 w-4 mt-0.5" />
                                <div className="flex flex-col text-xs mt-1 text-gray-600">
                                  {(member.oikos_relacao_1?.nome || member.oikos_1?.nome || member.oikos1) && (
                                    <span className="break-words">Oikós 1: {member.oikos_relacao_1?.nome || member.oikos_1?.nome || member.oikos1}</span>
                                  )}
                                  {(member.oikos_relacao_2?.nome || member.oikos_2?.nome || member.oikos2) && (
                                    <span className="break-words">Oikós 2: {member.oikos_relacao_2?.nome || member.oikos_2?.nome || member.oikos2}</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMemberClick(member)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleRemoveMember(member.id)}
                          disabled={loading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Member Detail Modal */}
      <MemberDetailModal
        member={selectedMember}
        isOpen={memberModalOpen}
        onClose={() => {
          setMemberModalOpen(false);
          setSelectedMember(null);
        }}
      />

      {/* Add Member Modal */}
      <AddMemberModal
        isOpen={addMemberModalOpen}
        onClose={() => setAddMemberModalOpen(false)}
        cellId={cellId}
        onMemberAdded={() => {
          loadMembers();
          setAddMemberModalOpen(false);
        }}
      />
    </div>
   );
 }