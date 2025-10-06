# Deploy Guide (Render + Supabase)

This guide explains how to deploy the backend on Render (Express) and use Supabase Postgres as the database, while the Next.js client consumes the API via `NEXT_PUBLIC_API_URL`.

## Backend (Render)

1. Ensure the `server/` directory exists with `package.json` and `index.js`.
2. Push your repo to GitHub.
3. Create a new Web Service on Render:
   - Select your repository.
   - Root directory: `server`.
   - Build Command: none (Node only)
   - Start Command: `npm start`.
   - Environment: Node 18+.
4. Set environment variables on Render:
   - `DATABASE_URL`: Supabase Postgres connection string.
   - `JWT_SECRET`: any secure string.
   - `JWT_EXPIRES_IN`: e.g. `7d`.
   - `CORS_ORIGIN`: your client origin (e.g. `https://your-client.onrender.com`).

After deploy, your API base will be `https://<service-name>.onrender.com/api`.

## Database (Supabase)

Use Supabase Project → Settings → Database to obtain the `DATABASE_URL`. Make sure your schema tables exist (`users`, `cells`, `daily_prayer_log`, etc.).

## Frontend (Next.js)

Deploy the Next.js frontend on Render as a Web Service.

- Root directory: `client`
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Environment: Node 18+

Set `NEXT_PUBLIC_API_URL` pointing to your Render backend base. For local dev, you can keep `http://localhost:5000/api`.

Example `.env.local` in `client/`:

```
NEXT_PUBLIC_API_URL=https://your-service.onrender.com/api
```

The client automatically uses this base URL via `src/lib/api.ts`.

## Notes

- Authentication uses JWT signed by the backend. Tokens are saved and sent via the client axios instance.
- CORS is enabled with `CORS_ORIGIN`. Adjust as needed.
- If you plan to migrate to Supabase Auth later, we can adapt the server to verify Supabase JWTs and move registration to Supabase.

## Optional: render.yaml

You can commit the provided `render.yaml` at the repository root to define both services (frontend and backend) for one-click deploy on Render. Set environment variables in Render dashboard for the keys marked with `sync: false`.