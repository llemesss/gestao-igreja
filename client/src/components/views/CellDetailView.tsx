'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { ArrowLeft, Users, User, Phone, Mail, Calendar, MapPin, FileText, Printer } from 'lucide-react';
import MemberDetailModal from '@/components/MemberDetailModal';
import MemberListItem from '@/components/MemberListItem';
import { apiMethods } from '@/lib/api';

interface Member {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  birth_date?: string;
  address?: string;
  role?: string;
}

interface Leader {
  id: string;
  name: string;
  email?: string;
}

interface CellDetail {
  id: string;
  name: string;
  description?: string;
  leader_name?: string;
  supervisor_name?: string;
  member_count: number;
  members: Member[];
  leaders?: Leader[];
}

interface CellDetailViewProps {
  cellId: string;
  onBack: () => void;
  onNavigate?: (view: string, cellId?: string) => void;
}

const CellDetailView: React.FC<CellDetailViewProps> = ({ cellId, onBack, onNavigate }) => {
  const [cellDetail, setCellDetail] = useState<CellDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showMemberModal, setShowMemberModal] = useState(false);

  useEffect(() => {
    loadCellDetail();
  }, [cellId]);

  const loadCellDetail = async () => {
    try {
      setLoading(true);
      
      const response = await apiMethods.cells.getDetail(cellId);
      
      if (response) {
        setCellDetail(response);
      }
    } catch (error) {
      console.error('❌ [CELL DETAIL VIEW] Erro ao carregar detalhes da célula:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMemberClick = (member: Member) => {
    setSelectedMember(member);
    setShowMemberModal(true);
  };

  const handleCloseMemberModal = () => {
    setShowMemberModal(false);
    setSelectedMember(null);
  };

  const handleFillReport = () => {
    if (onNavigate) {
      onNavigate('fillReport', cellId);
    }
  };

  const handlePrintCell = () => {
    // Implementar lógica de impressão da ficha da célula
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando detalhes da célula...</p>
        </div>
      </div>
    );
  }

  if (!cellDetail) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Célula não encontrada.</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com botões de ação */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{cellDetail.name}</h1>
            <p className="text-gray-600">Detalhes da célula</p>
          </div>
        </div>
        
        {/* Botões de ação */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleFillReport}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <FileText className="h-4 w-4" />
            Preencher Relatório
          </button>
          <button
            onClick={handlePrintCell}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Printer className="h-4 w-4" />
            Imprimir Ficha da Célula
          </button>
        </div>
      </div>

      {/* Informações da célula */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              Informações da Célula
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Nome</label>
              <p className="text-gray-900">{cellDetail.name}</p>
            </div>
            {cellDetail.description && (
              <div>
                <label className="text-sm font-medium text-gray-700">Descrição</label>
                <p className="text-gray-900">{cellDetail.description}</p>
              </div>
            )}
            {cellDetail.leader_name && (
              <div>
                <label className="text-sm font-medium text-gray-700">Líder</label>
                <p className="text-gray-900">{cellDetail.leader_name}</p>
              </div>
            )}
            {cellDetail.supervisor_name && (
              <div>
                <label className="text-sm font-medium text-gray-700">Supervisor</label>
                <p className="text-gray-900">{cellDetail.supervisor_name}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-600" />
              Estatísticas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 mb-2">
                {cellDetail.member_count}
              </div>
              <p className="text-gray-600">
                {cellDetail.member_count === 1 ? 'Membro' : 'Membros'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de membros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Membros da Célula
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Array.isArray(cellDetail.members) && cellDetail.members.length > 0 ? (
            <div className="members-list-container grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
              {cellDetail.members.map(member => (
                <MemberListItem key={member.id} member={member} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">Nenhum membro encontrado nesta célula.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalhes do membro */}
      {showMemberModal && selectedMember && (
        <MemberDetailModal
          member={selectedMember}
          isOpen={showMemberModal}
          onClose={handleCloseMemberModal}
        />
      )}
    </div>
  );
};

export default CellDetailView;