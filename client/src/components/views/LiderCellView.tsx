'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { api } from '@/lib/api';
import { auth } from '@/lib/auth';
import MemberListItem from '@/components/MemberListItem';
import { Users, Home } from 'lucide-react';

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  created_at: string;
}

interface CellDetails {
  id: string;
  name: string;
  supervisor_name?: string;
  secretary_name?: string;
  member_count: number;
}

export function LiderCellView() {
  const [members, setMembers] = useState<Member[]>([]);
  const [cellDetails, setCellDetails] = useState<CellDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = auth.getUser();

  useEffect(() => {
    const loadCellData = async () => {
      if (!user?.cell_id) {
        setError('Você não está associado a uma célula de liderança.');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Busca os detalhes da célula e os membros
        const [cellResponse, membersResponse] = await Promise.all([
          api.get(`/cells/${user.cell_id}`),
          api.get(`/cells/${user.cell_id}/members`)
        ]);

        setCellDetails(cellResponse.data);
        setMembers(membersResponse.data || []);
      } catch (error) {
        console.error('Erro ao buscar dados da célula do líder:', error);
        setError('Erro ao carregar os dados da sua célula. Tente novamente.');
      } finally {
        setIsLoading(false);
      }
    };

    loadCellData();
  }, [user?.cell_id]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-gray-800 flex items-center">
              <Home className="h-6 w-6 mr-2" />
              Gerenciamento da Célula
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Carregando sua célula...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-gray-800 flex items-center">
              <Home className="h-6 w-6 mr-2" />
              Gerenciamento da Célula
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <div className="text-red-600 mb-4">
                <Users className="h-12 w-12 mx-auto mb-3" />
                <p className="text-lg font-medium">{error}</p>
              </div>
              <p className="text-gray-500">
                Entre em contato com o administrador para verificar sua associação à célula.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header da Célula */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-800 flex items-center">
            <Home className="h-6 w-6 mr-2" />
            Gerenciamento da Célula {cellDetails?.name}
          </CardTitle>
          <p className="text-gray-600 mt-2">
            Gerencie os membros da sua célula e acompanhe o crescimento
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Estatísticas da Célula */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-blue-600">Total de Membros</p>
                  <p className="text-2xl font-bold text-blue-900">{Array.isArray(members) ? members.length : 0}</p>
                </div>
              </div>
            </div>

            {/* Líder da Célula */}
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-orange-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-orange-600">Líder</p>
                  <p className="text-lg font-bold text-orange-900">{user?.name}</p>
                </div>
              </div>
            </div>

            {/* Supervisor */}
            {cellDetails?.supervisor_name && (
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-green-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-green-600">Supervisor</p>
                    <p className="text-lg font-bold text-green-900">{cellDetails.supervisor_name}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Secretário */}
            {cellDetails?.secretary_name && (
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-purple-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-purple-600">Secretário</p>
                    <p className="text-lg font-bold text-purple-900">{cellDetails.secretary_name}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista de Membros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Membros da sua Célula
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Array.isArray(members) && members.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
              {(members || []).map(member => (
                <MemberListItem key={member.id} member={member} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">Nenhum membro encontrado nesta célula.</p>
              <p className="text-sm text-gray-500 mt-1">
                Os membros aparecerão aqui quando forem adicionados à célula.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default LiderCellView;