'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { api, apiMethods } from '@/lib/api';

interface ProfileFormData {
  name: string;
  email?: string;
  full_name?: string;
  phone?: string;
  whatsapp?: string;
  gender?: 'MALE' | 'FEMALE' | '';
  birth_city?: string;
  birth_state?: string;
  birth_date?: string;
  address?: string;
  address_number?: string;
  neighborhood?: string;
  zip_code?: string;
  address_reference?: string;
  father_name?: string;
  mother_name?: string;
  marital_status?: 'SINGLE' | 'MARRIED' | 'OTHER' | '';
  spouse_name?: string;
  education_level?: 'BASIC' | 'FUNDAMENTAL' | 'HIGH_SCHOOL' | 'UNIVERSITY' | 'OTHER' | '';
  education_course?: string;
  profession?: string;
  conversion_date?: string;
  previous_church?: string;
  transfer_info?: string;
  has_children?: boolean;
  oikos1?: string;
  oikos2?: string;
}

const estadosDoBrasil = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
  'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC',
  'SP','SE','TO'
];

function MeuPerfilView() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Evitar setState após desmontagem
  const isMounted = useRef(true);
  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<ProfileFormData>();

  const maritalStatus = watch('marital_status');
  const birthDate = watch('birth_date');
  const idade = (() => {
    if (!birthDate) return null;
    const hoje = new Date();
    const nascimento = new Date(birthDate);
    if (isNaN(nascimento.getTime())) return null;
    let anos = hoje.getFullYear() - nascimento.getFullYear();
    const mes = hoje.getMonth() - nascimento.getMonth();
    if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
      anos--;
    }
    return anos >= 0 ? anos : null;
  })();

  useEffect(() => {
    async function loadProfile() {
      try {
        setIsLoading(true);
        const response = await api.get('/me');
        const userData = response.data?.user || response.data; // compatível com ambos formatos

        // Mapear os dados para o formato do formulário
        const formData: ProfileFormData = {
          name: userData.name || '',
          email: userData.email || '',
          full_name: userData.full_name || '',
          phone: userData.phone || '',
          whatsapp: userData.whatsapp || '',
          gender: userData.gender || '',
          birth_city: userData.birth_city || '',
          birth_state: userData.birth_state || '',
          birth_date: userData.birth_date ? userData.birth_date.split('T')[0] : '',
          address: userData.address || '',
          address_number: userData.address_number || '',
          neighborhood: userData.neighborhood || '',
          zip_code: userData.zip_code || '',
          address_reference: userData.address_reference || '',
          father_name: userData.father_name || '',
          mother_name: userData.mother_name || '',
          marital_status: userData.marital_status || '',
          spouse_name: userData.spouse_name || '',
          education_level: userData.education_level || '',
          education_course: userData.education_course || '',
          profession: userData.profession || '',
          conversion_date: userData.conversion_date ? userData.conversion_date.split('T')[0] : '',
          previous_church: userData.previous_church || '',
          transfer_info: userData.transfer_info || '',
          has_children: userData.has_children || false,
          oikos1: userData.oikos1 || '',
          oikos2: userData.oikos2 || '',
        };

        if (isMounted.current) {
          reset(formData);
        }
      } catch (error) {
        console.error('Erro ao carregar perfil:', error);
        toast.error('Erro ao carregar dados do perfil');
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
        }
      }
    }

    loadProfile();
  }, [reset]);

  async function onSubmit(data: ProfileFormData) {
    // LOG CRÍTICO PARA DEPURAÇÃO
    console.log("DADOS DO FORMULÁRIO SENDO ENVIADOS PARA A API:", data);
    
    try {
      setIsSaving(true);
      await api.put('/me', data);
      toast.success('Perfil atualizado com sucesso!', {
        position: 'top-center',
        autoClose: 5000,
        hideProgressBar: false,
        closeButton: true,
        pauseOnHover: true,
      });
    } catch (error: any) {
      console.error('Erro ao salvar perfil:', error);
      // Tenta extrair mensagem específica do backend
      const backendMsg = error?.response?.data?.error || error?.message || 'Erro ao salvar perfil';
      toast.error(backendMsg, {
        position: 'top-center',
      });
    } finally {
      if (isMounted.current) {
        setIsSaving(false);
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>
          <button
            type="button"
            onClick={() => setIsChangePasswordOpen(true)}
            className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            Alterar Senha
          </button>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Meu Perfil</h1>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Informações Básicas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                placeholder="Digite seu email"
                {...register('email')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 placeholder-gray-500 bg-white"
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome *
              </label>
              <input
                type="text"
                placeholder="Digite seu nome"
                {...register('name', { required: 'Nome é obrigatório' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 placeholder-gray-500 bg-white"
              />
              {errors.name && (
                <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sobrenome
              </label>
              <input
                type="text"
                placeholder="Digite seu sobrenome"
                {...register('full_name')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 placeholder-gray-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefone
              </label>
              <input
                type="tel"
                placeholder="(11) 99999-9999"
                {...register('phone')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 placeholder-gray-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                WhatsApp
              </label>
              <input
                type="tel"
                placeholder="(11) 99999-9999"
                {...register('whatsapp')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 placeholder-gray-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gênero
              </label>
              <select
                {...register('gender')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
              >
                <option value="">Selecione...</option>
                <option value="MALE">Masculino</option>
                <option value="FEMALE">Feminino</option>
              </select>
            </div>

            {/* Idade calculada dinamicamente */}
            {idade !== null && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Idade
                </label>
                <p className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700">
                  Você tem {idade} anos.
                </p>
              </div>
            )}
          </div>

          {/* Nascimento */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data de Nascimento
              </label>
              <input
                type="date"
                {...register('birth_date')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cidade de Nascimento
              </label>
              <input
                type="text"
                placeholder="Digite a cidade"
                {...register('birth_city')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 placeholder-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado de Nascimento
              </label>
              <select
                {...register('birth_state')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
              >
                <option value="">Selecione um estado</option>
                {estadosDoBrasil.map((sigla) => (
                  <option key={sigla} value={sigla}>{sigla}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Endereço */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Endereço</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rua/Avenida
                </label>
                <input
                  type="text"
                  placeholder="Digite o nome da rua/avenida"
                  {...register('address')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 placeholder-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número
                </label>
                <input
                  type="text"
                  placeholder="Nº"
                  {...register('address_number')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 placeholder-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bairro
                </label>
                <input
                   type="text"
                   placeholder="Digite o bairro"
                   {...register('neighborhood')}
                   className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 placeholder-gray-500"
                 />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CEP
                </label>
                <input
                   type="text"
                   placeholder="00000-000"
                   {...register('zip_code')}
                   className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 placeholder-gray-500"
                 />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ponto de Referência
                </label>
                <input
                   type="text"
                   placeholder="Ex: Próximo ao mercado"
                   {...register('address_reference')}
                   className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 placeholder-gray-500"
                 />
              </div>
            </div>
          </div>

          {/* Família */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Informações Familiares</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Pai
                </label>
                <input
                  type="text"
                  {...register('father_name')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome da Mãe
                </label>
                <input
                  type="text"
                  {...register('mother_name')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estado Civil
                </label>
                <select
                  {...register('marital_status')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
                >
                  <option value="">Selecione...</option>
                  <option value="SINGLE">Solteiro(a)</option>
                  <option value="MARRIED">Casado(a)</option>
                  <option value="OTHER">Outro</option>
                </select>
              </div>

              {maritalStatus === 'MARRIED' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome do Cônjuge
                  </label>
                  <input
                    type="text"
                    {...register('spouse_name')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                {...register('has_children')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm text-gray-900">
                Possui filhos
              </label>
            </div>
          </div>

          {/* Educação e Profissão */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Educação e Profissão</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nível de Escolaridade
                </label>
                <select
                  {...register('education_level')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
                >
                  <option value="">Selecione...</option>
                  <option value="BASIC">Ensino Básico</option>
                  <option value="FUNDAMENTAL">Ensino Fundamental</option>
                  <option value="HIGH_SCHOOL">Ensino Médio</option>
                  <option value="UNIVERSITY">Ensino Superior</option>
                  <option value="OTHER">Outro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Curso/Formação
                </label>
                <input
                  type="text"
                  {...register('education_course')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Profissão
                </label>
                <input
                  type="text"
                  {...register('profession')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Informações Espirituais */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Informações Espirituais</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data de Conversão
                </label>
                <input
                  type="date"
                  {...register('conversion_date')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Igreja Anterior
                </label>
                <input
                  type="text"
                  {...register('previous_church')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Oikos */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Oikos</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Oikos 1
                </label>
                <input
                  type="text"
                  {...register('oikos1')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Oikos 2
                </label>
                <input
                  type="text"
                  {...register('oikos2')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Botão de Salvar */}
          <div className="flex justify-end pt-6">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>

    {/* Modal Alterar Senha */}
    <Modal isOpen={isChangePasswordOpen} onClose={() => setIsChangePasswordOpen(false)} title="Alterar Senha">
      <div className="space-y-4">
        <Input
          type="password"
          label="Senha Atual"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Digite sua senha atual"
        />
        <Input
          type="password"
          label="Nova Senha"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Digite a nova senha"
        />
        <Input
          type="password"
          label="Confirmar Nova Senha"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirme a nova senha"
        />
    
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => setIsChangePasswordOpen(false)}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isChangingPassword}
            onClick={async () => {
              if (!currentPassword || !newPassword || !confirmPassword) {
                toast.error('Preencha todos os campos.');
                return;
              }
              if (newPassword !== confirmPassword) {
                toast.error('As senhas não coincidem.');
                return;
              }
              try {
                setIsChangingPassword(true);
                await apiMethods.users.changePassword({ currentPassword, newPassword });
                toast.success('Senha alterada com sucesso!');
                setIsChangePasswordOpen(false);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
              } catch (error: any) {
                const msg = error?.response?.data?.error || error?.response?.data?.message || 'Não foi possível alterar a senha';
                toast.error(msg);
              } finally {
                setIsChangingPassword(false);
              }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isChangingPassword ? 'Alterando...' : 'Alterar Senha'}
          </button>
        </div>
      </div>
    </Modal>
    </>
  );
}

export default MeuPerfilView;