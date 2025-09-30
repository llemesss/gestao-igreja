# Guia de Diagnóstico - Erro no Netlify

## Problemas Identificados e Soluções

### 1. ✅ Configuração do netlify.toml (CORRIGIDO)
**Problema:** O `publish` directory estava incorreto
**Solução:** Atualizado para `client/.next`

### 2. 🔍 Variáveis de Ambiente Obrigatórias
Verifique se estas variáveis estão configuradas no Netlify:

```bash
DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require
JWT_SECRET=seu_jwt_secret_aqui
NODE_ENV=production
```

### 3. 🔧 Estrutura de Arquivos
Certifique-se de que a estrutura está correta:
```
System v3/
├── client/                 # Frontend Next.js
│   ├── .next/             # Build output
│   └── package.json
├── netlify/
│   └── functions/         # Netlify Functions
│       ├── auth.ts
│       ├── users.ts
│       ├── cells.ts
│       ├── prayers.ts
│       ├── me.ts
│       └── database/
│           └── connection.ts
├── netlify.toml
└── package.json
```

### 4. 🚨 Erros Comuns no Deploy

#### A. Erro de Build
**Sintoma:** Build falha no Netlify
**Verificar:**
- Se o comando `npm run build` funciona localmente no diretório `client/`
- Se todas as dependências estão no `package.json` do client

#### B. Erro de Netlify Functions
**Sintoma:** Functions retornam 404 ou 500
**Verificar:**
- Se `DATABASE_URL` está configurado
- Se as functions estão compiladas corretamente
- Se os imports estão corretos

#### C. Erro de Conexão com Banco
**Sintoma:** Erro 500 nas APIs
**Verificar:**
- Se o banco Neon está ativo
- Se a string de conexão está correta
- Se as tabelas foram criadas

### 5. 📋 Checklist de Deploy

#### No Netlify Dashboard:
1. **Site Settings > Build & Deploy > Environment Variables:**
   ```
   DATABASE_URL: [sua_string_de_conexao_neon]
   JWT_SECRET: [seu_jwt_secret]
   NODE_ENV: production
   ```

2. **Site Settings > Build & Deploy > Build Settings:**
   - Base directory: `client`
   - Build command: `npm run build`
   - Publish directory: `client/.next`

3. **Site Settings > Functions:**
   - Functions directory: `netlify/functions`

#### No Neon (PostgreSQL):
1. Criar as tabelas necessárias:
```sql
-- Executar no console do Neon
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'member',
    cell_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cells (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    leader_id UUID,
    supervisor_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prayers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    is_answered BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 6. 🔍 Como Verificar os Logs no Netlify

1. Acesse o Netlify Dashboard
2. Vá em **Site Overview > Functions**
3. Clique em uma function para ver os logs
4. Ou vá em **Deploys** para ver logs de build

### 7. 🧪 Teste Local das Functions

Para testar localmente:
```bash
# No diretório raiz do projeto
netlify dev
```

Isso iniciará:
- Frontend em `http://localhost:3000`
- Functions em `http://localhost:8888/.netlify/functions/`

### 8. 📞 URLs de Teste

Após o deploy, teste estas URLs:
```
https://seu-site.netlify.app/.netlify/functions/test
https://seu-site.netlify.app/.netlify/functions/auth
```

### 9. 🔧 Comandos de Diagnóstico

```bash
# Verificar se o build funciona
cd client && npm run build

# Testar functions localmente
netlify dev

# Verificar logs do Netlify
netlify logs
```

### 10. 📝 Próximos Passos

1. **Configurar variáveis de ambiente no Netlify**
2. **Criar tabelas no banco Neon**
3. **Fazer novo deploy**
4. **Testar as functions**
5. **Verificar logs se houver erro**

---

## Contato para Suporte

Se o erro persistir, forneça:
1. URL do site no Netlify
2. Logs de erro específicos
3. Screenshot do erro
4. Configurações de variáveis de ambiente (sem valores sensíveis)