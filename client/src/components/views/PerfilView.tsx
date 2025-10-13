'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';
import { auth } from '@/lib/auth';
import { User, Mail, Phone, MapPin, Calendar, Shield } from 'lucide-react';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  role: string;
  cell_id?: string;
  cell_name?: string;
  created_at: string;
}

export default function PerfilView() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: ''
  });

  // Evitar setState após desmontagem
  const isMounted = useRef(true);
  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const user = auth.getUser();
      if (user) {
        // Simular carregamento do perfil completo
        const response = await api.get(`/users/${user.id}`);
        if (!isMounted.current) return;
        setProfile(response.data);
        setFormData({
          name: response.data.name || '',
          phone: response.data.phone || '',
          address: response.data.address || ''
        });
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
      // Fallback para dados do auth se a API falhar
      const user = auth.getUser();
      if (user) {
        if (!isMounted.current) return;
        setProfile({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          cell_id: user.cell_id,
          cell_name: user.cell_name,
          created_at: new Date().toISOString()
        });
        setFormData({
          name: user.name || '',
          phone: '',
          address: ''
        });
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    try {
      setSaving(true);
      await api.put(`/users/${profile.id}`, {
        name: formData.name,
        phone: formData.phone || null,
        address: formData.address || null
      });
      
      // Atualizar o perfil local
      if (isMounted.current) {
        setProfile({
          ...profile,
          name: formData.name,
          phone: formData.phone,
          address: formData.address
        });
        setEditing(false);
      }
      alert('Perfil atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      alert('Erro ao salvar perfil. Tente novamente.');
    } finally {
      if (isMounted.current) {
        setSaving(false);
      }
    }
  };

  const handleCancel = () => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        phone: profile.phone || '',
        address: profile.address || ''
      });
    }
    setEditing(false);
  };

  const getRoleLabel = (role: string) => {
    const roles: { [key: string]: string } = {
      'ADMIN': 'Administrador',
      'PASTOR': 'Pastor',
      'COORDENADOR': 'Coordenador',
      'SUPERVISOR': 'Supervisor',
      'LIDER': 'Líder',
      'MEMBRO': 'Membro'
    };
    return roles[role] || role;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-2">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-600">Erro ao carregar perfil do usuário.</p>
            <Button onClick={loadProfile} className="mt-4">
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho do Perfil */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <User className="h-6 w-6" />
              <span>Meu Perfil</span>
            </CardTitle>
            {!editing && (
              <Button onClick={() => setEditing(true)} variant="outline">
                Editar Perfil
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-6">
            <div className="h-20 w-20 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="h-10 w-10 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{profile.name}</h2>
              <p className="text-gray-600">{getRoleLabel(profile.role)}</p>
              {profile.cell_name && (
                <p className="text-sm text-blue-600 font-medium">
                  Célula: {profile.cell_name}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Informações Pessoais */}
      <Card>
        <CardHeader>
          <CardTitle>Informações Pessoais</CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Nome Completo *
                </label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Seu nome completo"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Telefone
                </label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>
              
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                  Endereço
                </label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Seu endereço completo"
                />
              </div>
              
              <div className="flex space-x-3 pt-4">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
                <Button onClick={handleCancel} variant="outline" disabled={saving}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <User className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Nome</p>
                    <p className="text-gray-900">{profile.name}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Mail className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Email</p>
                    <p className="text-gray-900">{profile.email}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Shield className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Função</p>
                    <p className="text-gray-900">{getRoleLabel(profile.role)}</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Phone className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Telefone</p>
                    <p className="text-gray-900">{profile.phone || 'Não informado'}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <MapPin className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Endereço</p>
                    <p className="text-gray-900">{profile.address || 'Não informado'}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Membro desde</p>
                    <p className="text-gray-900">{formatDate(profile.created_at)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Informações da Célula */}
      {profile.cell_name && (
        <Card>
          <CardHeader>
            <CardTitle>Minha Célula</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">{profile.cell_name}</h3>
              <p className="text-sm text-blue-700">
                Você faz parte desta célula. Para mais informações sobre atividades e eventos, 
                entre em contato com seu líder de célula.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}