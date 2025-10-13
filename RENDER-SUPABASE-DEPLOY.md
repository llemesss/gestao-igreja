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
   - `DATABASE_URL`: Supabase Postgres connection string.
   - `JWT_SECRET`: any secure string.
   - `JWT_EXPIRES_IN`: e.g. `7d`.
   - `CORS_ORIGIN`: your client origin(s), comma‑separated if multiple (e.g. `https://church-frontend.onrender.com`).

   Notes:
   - Prefer the URL with `?sslmode=require` (SSL enabled). Example:
     `postgresql://postgres:<password>@<host>:5432/postgres?sslmode=require`
   - If hitting connection limits, use Supabase Connection Pooling (PgBouncer) on port `6543`:
     `postgresql://postgres:<password>@<host>:6543/postgres?sslmode=require`
   - The server binds to `process.env.PORT` (Render defaults to `10000`). No need to set it manually.

After deploy, your API base will be `https://church-backend.onrender.com/api` (ajuste conforme o nome do serviço).

## Database (Supabase)

Use Supabase Project → Settings → Database to obtain the `DATABASE_URL`. Make sure your schema tables exist (`users`, `cells`, `daily_prayer_log`, etc.).

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