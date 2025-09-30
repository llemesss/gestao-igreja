# Guia de Deploy no Netlify com Netlify Functions

Este guia explica como fazer o deploy da aplicação no Netlify usando Netlify Functions para o backend e Neon PostgreSQL como banco de dados.

## 📋 Pré-requisitos

1. Conta no [Netlify](https://netlify.com)
2. Conta no [Neon](https://neon.tech) (PostgreSQL serverless)
3. Repositório Git com o código da aplicação

## 🗄️ 1. Configuração do Banco de Dados (Neon)

### 1.1 Criar projeto no Neon
1. Acesse [Neon Console](https://console.neon.tech)
2. Crie um novo projeto
3. Escolha a região mais próxima
4. Anote a **Connection String** fornecida

### 1.2 Executar migrações
Execute as migrações SQL no console do Neon ou usando um cliente PostgreSQL:

```sql
-- Suas tabelas e dados iniciais aqui
-- (copie do seu arquivo de migração existente)
```

## 🚀 2. Deploy no Netlify

### 2.1 Conectar repositório
1. Acesse o [Netlify Dashboard](https://app.netlify.com)
2. Clique em "New site from Git"
3. Conecte seu repositório GitHub/GitLab/Bitbucket
4. Selecione o repositório da aplicação

### 2.2 Configurações de build
- **Base directory**: `client`
- **Build command**: `npm run build`
- **Publish directory**: `client/.next`

### 2.3 Configurar variáveis de ambiente
No painel do Netlify, vá em **Site settings > Environment variables** e adicione:

```
NEXT_PUBLIC_API_URL=https://SEU-SITE.netlify.app/.netlify/functions
DATABASE_URL=postgresql://username:password@host:5432/database_name
JWT_SECRET=seu_jwt_secret_muito_seguro_aqui
NODE_ENV=production
```

**⚠️ Importante**: 
- Substitua `SEU-SITE` pelo nome real do seu site no Netlify
- Use a Connection String real do Neon para `DATABASE_URL`
- Gere um JWT_SECRET seguro (recomendado: 64+ caracteres aleatórios)

## 📁 3. Estrutura do Projeto

O projeto está configurado com:

```
├── client/                 # Frontend Next.js
├── netlify/
│   └── functions/         # Netlify Functions (Backend)
│       ├── auth.ts        # Autenticação
│       ├── users.ts       # Usuários
│       ├── cells.ts       # Células
│       ├── prayers.ts     # Orações
│       ├── me.ts          # Perfil do usuário
│       └── database/
│           └── connection.ts  # Conexão PostgreSQL
├── netlify.toml           # Configuração do Netlify
└── package.json           # Dependências das Functions
```

## 🔧 4. Configurações Importantes

### 4.1 netlify.toml
O arquivo `netlify.toml` já está configurado com:
- Diretório das functions: `netlify/functions`
- Bundler: `esbuild`
- Redirecionamento de `/api/*` para as functions
- Headers de segurança

### 4.2 Dependências
As dependências das Netlify Functions estão no `package.json` da raiz:
- `@netlify/functions`
- `pg` (PostgreSQL client)
- `jsonwebtoken`
- `bcryptjs`
- `uuid`

## 🧪 5. Testando o Deploy

### 5.1 Verificar Functions
Após o deploy, teste os endpoints:
- `https://SEU-SITE.netlify.app/.netlify/functions/auth`
- `https://SEU-SITE.netlify.app/.netlify/functions/users`
- `https://SEU-SITE.netlify.app/.netlify/functions/cells`
- `https://SEU-SITE.netlify.app/.netlify/functions/prayers`
- `https://SEU-SITE.netlify.app/.netlify/functions/me`

### 5.2 Verificar Frontend
- Acesse `https://SEU-SITE.netlify.app`
- Teste login/registro
- Verifique se as chamadas de API funcionam

## 🐛 6. Troubleshooting

### 6.1 Logs das Functions
- Acesse **Functions** no painel do Netlify
- Clique em uma function para ver os logs
- Verifique erros de conexão com o banco

### 6.2 Problemas Comuns

**Erro de conexão com banco:**
- Verifique se `DATABASE_URL` está correta
- Confirme se o IP do Netlify tem acesso ao Neon

**Functions não encontradas:**
- Verifique se o build foi bem-sucedido
- Confirme se `netlify.toml` está na raiz

**CORS errors:**
- As functions já incluem headers CORS
- Verifique se `NEXT_PUBLIC_API_URL` está correto

## 📝 7. Desenvolvimento Local

Para testar localmente com as Netlify Functions:

```bash
# Instalar Netlify CLI
npm install -g netlify-cli

# Executar em modo dev
netlify dev
```

## 🔄 8. Atualizações

Para atualizar a aplicação:
1. Faça push das alterações para o repositório
2. O Netlify fará o redeploy automaticamente
3. Verifique os logs de build no painel

## 📞 9. Suporte

Em caso de problemas:
1. Verifique os logs no painel do Netlify
2. Consulte a [documentação do Netlify Functions](https://docs.netlify.com/functions/overview/)
3. Verifique a [documentação do Neon](https://neon.tech/docs)

---

✅ **Checklist de Deploy:**
- [ ] Banco de dados Neon configurado
- [ ] Repositório conectado no Netlify
- [ ] Variáveis de ambiente configuradas
- [ ] Build bem-sucedido
- [ ] Functions funcionando
- [ ] Frontend acessível
- [ ] Login/registro funcionando
- [ ] APIs respondendo corretamente