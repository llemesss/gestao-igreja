'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/ui';
import { ArrowLeft, Save, X } from 'lucide-react';
import { api, apiMethods } from '@/lib/api';

interface Cell {
  id: string;
  name: string;
  description?: string;
  supervisor_id?: string;
  supervisor_name?: string;
  member_count: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function EditarCelulaClient() {
  const router = useRouter();
  const params = useParams();
  const cellId = params.id as string;

  const [cell, setCell] = useState<Cell | null>(null);
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    supervisor_id: ''
  });
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
      const cellResponse = await apiMethods.cells.getDetail(cellId);
      if (cellResponse) {
        setCell(cellResponse);
        setFormData({
          name: cellResponse.name,
          description: cellResponse.description || '',
          supervisor_id: cellResponse.supervisor_id || ''
        });
      }

      // Carregar supervisores disponíveis
      const usersResponse = await apiMethods.users.getAll();
      const availableSupervisors = (Array.isArray(usersResponse) ? usersResponse : []).filter((user: User) => 
        user.role === 'SUPERVISOR' || user.role === 'COORDENADOR' || user.role === 'PASTOR' || user.role === 'ADMIN'
      );
      setSupervisors(availableSupervisors);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Por favor, preencha o nome da célula.');
      return;
    }

    try {
      setSaving(true);
      
      const updateData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        supervisor_id: formData.supervisor_id || null
      };

      await apiMethods.cells.update(cellId, updateData);
      
      alert('Célula atualizada com sucesso!');
      router.push(`/celulas/${cellId}`);
    } catch (error) {
      console.error('Erro ao atualizar célula:', error);
      alert('Erro ao atualizar célula. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.push(`/celulas/${cellId}`);
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
      <div className="max-w-2xl mx-auto p-6 space-y-6">
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Editar Célula</h1>
          <p className="text-gray-600">
            Atualize as informações da célula <strong>{cell.name}</strong>
          </p>
        </div>

          {/* Form */}
          <Card>
            <CardHeader>
              <CardTitle>Informações da Célula</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome da Célula *
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Digite o nome da célula"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descrição
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Digite uma descrição para a célula (opcional)"
                  disabled={saving}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Supervisor
                </label>
                <select
                  value={formData.supervisor_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, supervisor_id: e.target.value }))}
                  disabled={saving}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
                >
                  <option value="">Selecione um supervisor</option>
                  {supervisors.map(supervisor => (
                    <option key={supervisor.id} value={supervisor.id}>
                      {supervisor.name} ({supervisor.email})
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  Apenas usuários com função de Supervisor ou superior podem ser selecionados
                </p>
              </div>

              {/* Current Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Informações Atuais</h4>
                <p className="text-sm text-gray-600 mb-1"><strong>Membros:</strong> {cell.member_count}</p>
                <p className="text-sm text-gray-600 mb-1"><strong>Supervisor Atual:</strong> {cell.supervisor_name || 'Nenhum'}</p>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={saving}
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || !formData.name.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
  );
}