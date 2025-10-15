import React, { useState, useEffect } from 'react';
import { api, apiMethods } from '@/lib/api';
import { toast } from 'sonner';
import { usePrayerStore } from '@/lib/store';

export function OracaoView() {
  // Estado para a lista de membros
  const [membros, setMembros] = useState([]);
  // Estado para controlar o carregamento
  const [isLoading, setIsLoading] = useState(true);
  // Estado para controlar se já orou hoje
  const [jaOrou, setJaOrou] = useState(false);
  
  // Store Zustand para o status de oração
  const { setHasPrayedToday } = usePrayerStore();

  // Carrega os membros da célula quando o componente é montado
  useEffect(() => {
    async function fetchMembros() {
      try {
        const data = await apiMethods.cells.getMyCellMembers();
        console.log('DADOS RECEBIDOS PELO FRONTEND:', data);
        setMembros(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Erro ao buscar membros da célula:", error);
        toast.error('Falha ao buscar membros da sua célula.');
      } finally {
        setIsLoading(false);
      }
    }
    fetchMembros();
  }, []);

  // Função para o clique do botão
  async function handleRegisterPrayer() {
    // Se já orou hoje, mostra mensagem informativa
    if (jaOrou) {
      toast.info('Oração já registrada hoje!');
      return;
    }

    const toastId = toast.loading('Registrando sua oração...');
    
    try {
      await apiMethods.prayers.register();
      toast.success('Oração de hoje registrada com sucesso!', { id: toastId });
      // Atualizar o estado global para refletir que o usuário orou hoje
      setHasPrayedToday(true);
      // Atualizar o estado local para mudar o texto do botão
      setJaOrou(true);
    } catch (error) {
      console.error("Erro ao registrar oração:", error);
      toast.error('Falha ao registrar. Tente novamente.', { id: toastId });
    }
  }

  if (isLoading) {
    return <div>Carregando...</div>;
  }

  return (
    <div>
      {/* Bloco 1: Membros da Célula e Oikós */}
      <section>
        <h3 style={{ color: '#374151' }}>Membros da sua Célula</h3>
        <div className="space-y-3">
          {membros.map((membro) => (
            <div key={membro.id} className="bg-white text-gray-700 p-4 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">
                  {membro.name?.charAt(0)?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <strong className="truncate">{membro.name}</strong>
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    {(membro?.oikos_relacao_1?.nome || membro?.oikos_1?.nome || membro?.oikos1 || membro?.oikos_relacao_2?.nome || membro?.oikos_2?.nome || membro?.oikos2) ? (
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {(membro.oikos_relacao_1?.nome || membro.oikos_1?.nome || membro.oikos1) && (
                          <span>
                            <span className="font-medium">Oikós 1:</span> {membro.oikos_relacao_1?.nome || membro.oikos_1?.nome || membro.oikos1}
                          </span>
                        )}
                        {(membro.oikos_relacao_2?.nome || membro.oikos_2?.nome || membro.oikos2) && (
                          <span>
                            <span className="font-medium">Oikós 2:</span> {membro.oikos_relacao_2?.nome || membro.oikos_2?.nome || membro.oikos2}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">Oikós não definidos</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <hr />

      {/* Bloco 2: Pedidos de Oração Geral (Placeholder) */}
      <section>
        <h3 style={{ color: '#374151' }}>Pedidos de Oração da Comunidade</h3>
        <p><em style={{ color: '#4B5563' }}>(Funcionalidade em desenvolvimento. Em breve aqui!)</em></p>
      </section>

      <hr />

      {/* Bloco 3: Botão de Ação */}
      <section style={{ textAlign: 'center', padding: '20px' }}>
        <button 
          onClick={handleRegisterPrayer}
          className="bg-gradient-to-r from-gray-800 to-black hover:from-gray-900 hover:to-gray-800 text-white font-semibold py-3 px-8 rounded-lg shadow-lg transform transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-gray-400"
        >
          {jaOrou ? 'Você já orou hoje' : 'Registrar Oração de Hoje'}
        </button>
      </section>
    </div>
  );
}

export default OracaoView;