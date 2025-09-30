# 🚀 Guia de Deploy - Sistema de Gestão de Igreja

Este guia te ajudará a fazer o deploy do sistema completo usando **Netlify** (frontend) e **Vercel** (backend) com banco de dados **Neon**.

## 📋 Pré-requisitos

- Conta no [Netlify](https://netlify.com)
- Conta no [Vercel](https://vercel.com)
- Conta no [Neon](https://neon.tech) (PostgreSQL)
- Repositório Git (GitHub, GitLab, etc.)

## 🗄️ 1. Configurar Banco de Dados (Neon)

### 1.1 Criar Projeto no Neon
1. Acesse [neon.tech](https://neon.tech) e faça login
2. Clique em "Create Project"
3. Escolha um nome para o projeto (ex: "church-management")
4. Selecione a região mais próxima
5. Clique em "Create Project"

### 1.2 Obter String de Conexão
1. No dashboard do Neon, vá em "Connection Details"
2. Copie a **Connection String** (formato: `postgresql://username:password@host/database`)
3. Guarde essa string, você precisará dela

### 1.3 Executar Migrations
1. No seu projeto local, atualize o arquivo `server/.env`:
   ```env
   DATABASE_URL=sua_connection_string_do_neon_aqui
   ```
2. Execute as migrations:
   ```bash
   cd server
   npm run seed
   ```

## 🖥️ 2. Deploy do Backend (Vercel)

### 2.1 Preparar o Código
1. Certifique-se que o arquivo `server/vercel.json` existe (já criado)
2. Commit e push do código para seu repositório Git

### 2.2 Deploy no Vercel
1. Acesse [vercel.com](https://vercel.com) e faça login
2. Clique em "New Project"
3. Conecte seu repositório Git
4. Configure o projeto:
   - **Framework Preset**: Other
   - **Root Directory**: `server`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### 2.3 Configurar Variáveis de Ambiente
No dashboard do Vercel, vá em "Settings" > "Environment Variables" e adicione:

```env
DATABASE_URL=sua_connection_string_do_neon
JWT_SECRET=seu_jwt_secret_super_seguro_aqui
JWT_EXPIRES_IN=7d
NODE_ENV=production
CORS_ORIGIN=https://seu-frontend.netlify.app
```

### 2.4 Deploy
1. Clique em "Deploy"
2. Aguarde o build completar
3. Anote a URL do seu backend (ex: `https://seu-backend.vercel.app`)

## 🌐 3. Deploy do Frontend (Netlify)

### 3.1 Configurar Variáveis de Ambiente
1. Atualize o arquivo `client/.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=https://seu-backend.vercel.app/api
   ```

### 3.2 Build Local (Teste)
```bash
cd client
npm run build
```

### 3.3 Deploy no Netlify
1. Acesse [netlify.com](https://netlify.com) e faça login
2. Clique em "New site from Git"
3. Conecte seu repositório Git
4. Configure o build:
   - **Base directory**: `client`
   - **Build command**: `npm run build`
   - **Publish directory**: `client/out`

### 3.4 Configurar Variáveis de Ambiente
No dashboard do Netlify, vá em "Site settings" > "Environment variables" e adicione:
```env
NEXT_PUBLIC_API_URL=https://seu-backend.vercel.app/api
```

### 3.5 Deploy
1. Clique em "Deploy site"
2. Aguarde o build completar
3. Seu site estará disponível na URL fornecida pelo Netlify

## 🔧 4. Configurações Finais

### 4.1 Atualizar CORS no Backend
1. No Vercel, atualize a variável `CORS_ORIGIN` com a URL real do Netlify:
   ```env
   CORS_ORIGIN=https://seu-site.netlify.app
   ```

### 4.2 Testar o Sistema
1. Acesse seu site no Netlify
2. Teste o login e funcionalidades
3. Verifique se não há erros no console

## 📝 5. Comandos Úteis

### Rebuild do Frontend
```bash
cd client
npm run build
```

### Rebuild do Backend
```bash
cd server
npm run build
```

### Logs do Vercel
```bash
vercel logs
```

## 🔍 6. Troubleshooting

### Erro de CORS
- Verifique se `CORS_ORIGIN` no backend está correto
- Certifique-se que não há `/` no final da URL

### Erro 404 nas Rotas
- Verifique se o arquivo `netlify.toml` está na raiz do projeto
- Confirme se as redirects estão configuradas

### Erro de Conexão com Banco
- Verifique se a `DATABASE_URL` está correta
- Teste a conexão localmente primeiro

### Build Falha
- Verifique se todas as dependências estão no `package.json`
- Confirme se não há erros de TypeScript

## 🎉 Pronto!

Seu sistema está agora rodando em produção! 

- **Frontend**: https://seu-site.netlify.app
- **Backend**: https://seu-backend.vercel.app
- **Banco**: Neon PostgreSQL

## 📞 Suporte

Se encontrar problemas, verifique:
1. Logs do Netlify e Vercel
2. Console do navegador
3. Variáveis de ambiente
4. Conexão com o banco de dados