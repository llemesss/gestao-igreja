# Sistema de Gestão de Igreja

## Visão do Projeto
Aplicativo web moderno, rápido e intuitivo para a gestão de membros e células de uma igreja, com foco principal na experiência em dispositivos móveis.

## Filosofia Principal
- Mobile-First
- Design Minimalista
- Funcionalidade Focada no Perfil do Usuário (Role)

## Stack de Tecnologia
- **Frontend**: Next.js com TypeScript
- **Backend**: Node.js com Express.js e TypeScript
- **Banco de Dados**: PostgreSQL (Neon)
- **Estilização**: Tailwind CSS
- **Autenticação**: JWT (JSON Web Tokens)

## Estrutura do Projeto
```
System v3/
├── client/          # Frontend (Next.js)
├── server/          # Backend (Node.js/Express)
└── README.md
```

## Roles do Sistema
- **MEMBRO**: Usuário padrão, acesso à oração diária
- **LIDER**: Líder de célula
- **SUPERVISOR**: Supervisor de células
- **COORDENADOR**: Coordenador geral
- **PASTOR**: Pastor da igreja
- **ADMIN**: Administrador do sistema

## Como Executar
1. Clone o repositório
2. Configure as variáveis de ambiente
3. Execute o backend: `cd server && npm run dev`
4. Execute o frontend: `cd client && npm run dev`