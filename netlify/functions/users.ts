import { Handler } from '@netlify/functions';
import jwt from 'jsonwebtoken';
import pool from './database/connection';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface AuthUser {
  userId: string;
  email: string;
  role: string;
}

// Autenticação via JWT
const verifyToken = (authHeader?: string): AuthUser | null => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return { userId: decoded.userId, email: decoded.email, role: decoded.role };
  } catch {
    return null;
  }
};

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const requester = verifyToken(event.headers.authorization);
  if (!requester) {
    return { statusCode: 401, headers, body: JSON.stringify({ message: 'Token inválido ou ausente' }) };
  }

  try {
    const path = event.path.replace('/.netlify/functions/users', '');
    const method = event.httpMethod;

    // ROTA ÚNICA: GET /:id -> Perfil do usuário + estatísticas de oração
    if (method === 'GET' && /^\/[a-f0-9-]+$/.test(path)) {
      const targetUserId = path.slice(1);

      // Perfil (apenas usuários ativos)
      const userQuery = `
        SELECT id, name, email, phone, role, cell_id, status
        FROM users
        WHERE id = $1 AND status = 'ACTIVE'
      `;
      const userResult = await pool.query(userQuery, [targetUserId]);
      if (userResult.rows.length === 0) {
        return { statusCode: 404, headers, body: JSON.stringify({ message: 'Usuário não encontrado' }) };
      }
      const userProfile = userResult.rows[0];

      // Estatísticas de oração
      const [countResult, lastResult] = await Promise.all([
        pool.query(
          'SELECT COUNT(*)::int AS total_prayers FROM daily_prayer_log WHERE user_id = $1',
          [targetUserId]
        ),
        pool.query(
          'SELECT MAX(prayer_date) AS last_prayer_date FROM daily_prayer_log WHERE user_id = $1',
          [targetUserId]
        )
      ]);

      const totalPrayers = countResult.rows[0]?.total_prayers ?? 0;
      const lastPrayerDate = lastResult.rows[0]?.last_prayer_date ?? null;

      const responseData = {
        profile: userProfile,
        stats: {
          totalPrayers,
          lastPrayerDate
        }
      };

      return { statusCode: 200, headers, body: JSON.stringify(responseData) };
    }

    // Qualquer outra rota resulta em 404
    return { statusCode: 404, headers, body: JSON.stringify({ message: 'Rota não encontrada' }) };
  } catch (error) {
    console.error(`Erro fatal em users:`, error);
    return { statusCode: 500, headers, body: JSON.stringify({ message: 'Erro interno no servidor' }) };
  }
};