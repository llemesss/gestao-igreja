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
        const response = await api.get('/cells/members-with-oikos');
        setMembros(response.data);
      } catch (error) {
        console.error("Erro ao buscar membros da célula:", error);
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
      await api.post('/prayers/log-daily');
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
        <ul className="space-y-2">
          {membros.map(membro => (
            <li key={membro.id} className="bg-white text-gray-700 p-3 rounded-lg border border-gray-200">
              <strong>{membro.name}</strong>
              {membro.oikos && membro.oikos.length > 0 && (
                <small style={{ marginLeft: '10px' }}>
                  (Oikós: {membro.oikos.map(o => o.name).join(', ')})
                </small>
              )}
            </li>
          ))}
        </ul>
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