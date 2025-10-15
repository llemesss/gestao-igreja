# Deploy Guide (Render + Supabase)

This guide explains how to deploy the backend on Render (Express) and use Supabase Postgres as the database, while the Next.js client consumes the API via `NEXT_PUBLIC_API_URL`.

## Backend (Render)

1. Ensure the `server/` directory exists with `package.json` and `index.js`.
2. Push your repo to GitHub.
3. Create a new Web Service on Render (backend):
   - Select your repository.
   - Root directory: `server`.
   - Build Command: `npm install && npx prisma generate`
   - Start Command: `npm start`
   - Health Check Path: `/api/health`
   - Environment: Node 18+ (ou 20)
4. Set environment variables on Render (backend):
   - `DATABASE_URL`: Supabase Postgres connection string (use Connection Pooler).
   - `JWT_SECRET`: any secure string.
   - `JWT_EXPIRES_IN`: e.g. `7d`.
   - `CORS_ORIGIN`: your client origin(s), comma‑separated if multiple (e.g. `https://church-frontend.onrender.com`).

   Notes:
   - Use Pooler URLs com `?sslmode=require` (SSL habilitado).
   - Session Pooler (recomendado para Render): porta `6544`
     `postgresql://postgres:<SENHA>@<host-pooler>:6544/postgres?sslmode=require`
   - Transaction Pooler: porta `6543`
     `postgresql://postgres:<SENHA>@<host-pooler>:6543/postgres?sslmode=require`
   - Conexão direta: porta `5432` (evite se estiver em rede apenas IPv4)
     `postgresql://postgres:<SENHA>@<host-db>:5432/postgres?sslmode=require`
   - Observação: no Supabase, `6543` = Transaction Pooler e `6544` = Session Pooler.
   - O servidor usa `process.env.PORT` (Render padrão `10000`). Não é necessário definir manualmente.

   Prisma:
   - Garanta que `schema.prisma` aponte para `env("DATABASE_URL")` no datasource.
   - Se usar Transaction Pooler com Prisma e houver erros de prepared statements, defina `PRISMA_DISABLE_PREPARED_STATEMENTS=1` no backend.

After deploy, your API base will be `https://church-backend.onrender.com/api` (ajuste conforme o nome do serviço).

## Database (Supabase)

Use Supabase Project → Settings → Database → Connection string para obter a `DATABASE_URL` do Pooler (Shared Pooler). Copie a URL do Session Pooler (porta `6544`) ou Transaction Pooler (porta `6543`). Garanta que o usuário seja `postgres` e a senha seja a senha atual do banco.

If you see `ECONNREFUSED` in Render logs:
- Confirm `DATABASE_URL` is set and correct (host, port, db name, password).
- Ensure `sslmode=require` is present.
- Consider switching to Connection Pooling (`6543`).
- Supabase has no IP allowlist by default; if using another provider, allow outbound traffic from Render.

## Frontend (Next.js)

Deploy the Next.js frontend on Render as a Web Service.

- Root directory: `client`
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Environment: Node 18+

Set `NEXT_PUBLIC_API_URL` pointing to your Render backend base (ex.: `https://church-backend.onrender.com/api`). For local dev, keep `http://localhost:5000/api`.

Example `.env.local` in `client/`:

```
NEXT_PUBLIC_API_URL=https://church-backend.onrender.com/api
```

The client automatically uses this base URL via `src/lib/api.ts`.

## Notes

- Authentication uses JWT signed by the backend. Tokens are saved and sent via the client axios instance.
- CORS is enabled with `CORS_ORIGIN`. Adjust as needed.
- Health endpoints: `GET /` returns a JSON with `ok: true`; `GET /api/health` pings the database and reports status.
- If you plan to migrate to Supabase Auth later, we can adapt the server to verify Supabase JWTs and move registration to Supabase.

## Optional: render.yaml

You can commit the provided `render.yaml` at the repository root to define both services (frontend and backend) for one-click deploy on Render. It already includes:

- Backend service `church-backend` with `healthCheckPath: /api/health`.
- Frontend service `church-frontend` with `NEXT_PUBLIC_API_URL` pointing to the backend.

Set environment variables in Render dashboard for the keys marked with `sync: false`.