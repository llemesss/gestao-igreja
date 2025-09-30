import { Handler } from '@netlify/functions';
import jwt from 'jsonwebtoken';
import pool from './database/connection';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface AuthUser {
  userId: string;
  email: string;
  role: string;
}

// Middleware de autenticação adaptado
const verifyToken = (authHeader?: string): AuthUser | null => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };
  } catch (error) {
    return null;
  }
};

export const handler: Handler = async (event, context) => {
  // Configurar CORS
  const headers = {
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || 'http://localhost:3000',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Verificar autenticação
  const user = verifyToken(event.headers.authorization);
  if (!user) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Token inválido ou ausente' })
    };
  }

  try {
    const path = event.path.replace('/.netlify/functions/prayers', '');
    const method = event.httpMethod;
    const queryParams = event.queryStringParameters || {};

    // POST /log-daily -> Registrar oração diária
    if (path === '/log-daily' && method === 'POST') {
      const { userId } = user;
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // Lógica de UPSERT - verificar se já existe registro para hoje
      const existingRecord = await pool.query(
        'SELECT id FROM daily_prayer_log WHERE user_id = ? AND prayer_date = ?',
        [userId, today]
      );

      if (existingRecord.rows.length > 0) {
        // Atualizar timestamp se já existe
        await pool.query(
          'UPDATE daily_prayer_log SET updated_at = datetime(\'now\') WHERE user_id = ? AND prayer_date = ?',
          [userId, today]
        );
      } else {
        // Criar novo registro se não existe
        const recordId = uuidv4();
        await pool.query(
          'INSERT INTO daily_prayer_log (id, user_id, prayer_date, created_at, updated_at) VALUES (?, ?, ?, datetime(\'now\'), datetime(\'now\'))',
          [recordId, userId, today]
        );
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Oração do dia registrada.'
        })
      };
    }

    // POST / -> Registrar oração de hoje (endpoint legado)
    if (path === '' && method === 'POST') {
      const { userId } = user;
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // Verificar se já orou hoje
      const existingPrayer = await pool.query(
        'SELECT id FROM daily_prayer_log WHERE user_id = ? AND prayer_date = ?',
        [userId, today]
      );

      if (existingPrayer.rows.length > 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Você já registrou sua oração hoje' })
        };
      }

      // Registrar oração
      const prayerId = uuidv4();
      await pool.query(
        'INSERT INTO daily_prayer_log (id, user_id, prayer_date) VALUES (?, ?, ?)',
        [prayerId, userId, today]
      );

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          message: 'Oração registrada com sucesso!',
          prayer: {
            id: prayerId,
            user_id: userId,
            log_date: today,
            created_at: new Date()
          }
        })
      };
    }

    // GET /status-today -> Verificar se o usuário já orou hoje
    if (path === '/status-today' && method === 'GET') {
      const { userId } = user;
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // Verificar se existe registro de oração para hoje
      const existingRecord = await pool.query(
        'SELECT id FROM daily_prayer_log WHERE user_id = ? AND prayer_date = ?',
        [userId, today]
      );

      const hasPrayed = existingRecord.rows.length > 0;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ hasPrayed })
      };
    }

    // GET /stats -> Estatísticas simples para dashboard
    if (path === '/stats' && method === 'GET') {
      const { userId } = user;
      
      // Calcular contagens para semana e mês usando a tabela correta
      const statsQuery = `
        SELECT 
          COUNT(CASE WHEN prayer_date >= date('now', '-7 days') THEN 1 END) as prayersThisWeek,
          COUNT(CASE WHEN prayer_date >= date('now', 'start of month') THEN 1 END) as prayersThisMonth,
          COUNT(CASE WHEN prayer_date = date('now') THEN 1 END) > 0 as prayersToday
        FROM daily_prayer_log 
        WHERE user_id = ?
      `;

      const statsResult = await pool.query(statsQuery, [userId]);
      const stats = statsResult.rows[0];

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          prayersToday: Boolean(stats.prayersToday),
          prayersThisWeek: parseInt(stats.prayersThisWeek) || 0,
          prayersThisMonth: parseInt(stats.prayersThisMonth) || 0
        })
      };
    }

    // GET /my-stats -> Estatísticas pessoais de oração
    if (path === '/my-stats' && method === 'GET') {
      const { userId } = user;
      const days = parseInt(queryParams.days as string) || 30;
      
      // Estatísticas gerais
      const statsQuery = `
        SELECT 
          COUNT(*) as total_prayers,
          COUNT(CASE WHEN prayer_date >= date('now', '-${days} days') THEN 1 END) as recent_prayers,
          COUNT(CASE WHEN prayer_date >= date('now', '-7 days') THEN 1 END) as week_prayers,
          MAX(prayer_date) as last_prayer_date,
          MIN(prayer_date) as first_prayer_date
        FROM daily_prayer_log 
        WHERE user_id = ?
      `;

      const statsResult = await pool.query(statsQuery, [userId]);
      const stats = statsResult.rows[0];

      // Histórico dos últimos dias
      const historyQuery = `
        SELECT prayer_date
        FROM daily_prayer_log 
        WHERE user_id = ? AND prayer_date >= date('now', '-${days} days')
        ORDER BY prayer_date DESC
      `;

      const historyResult = await pool.query(historyQuery, [userId]);

      // Verificar se orou hoje
      const today = new Date().toISOString().split('T')[0];
      const prayedToday = historyResult.rows.some(row => 
        row.prayer_date.toString().split('T')[0] === today
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          stats: {
            total_prayers: parseInt(stats.total_prayers),
            recent_prayers: parseInt(stats.recent_prayers),
            week_prayers: parseInt(stats.week_prayers),
            last_prayer_date: stats.last_prayer_date,
            first_prayer_date: stats.first_prayer_date,
            prayed_today: prayedToday
          },
          history: historyResult.rows.map(row => row.prayer_date)
        })
      };
    }

    // GET /stats/:targetUserId -> Estatísticas de oração de um usuário específico
    if (path.match(/^\/stats\/[a-f0-9-]+$/) && method === 'GET') {
      const targetUserId = path.split('/')[2];
      const { userId, role } = user;
      const days = parseInt(queryParams.days as string) || 30;

      // Verificar permissão para ver estatísticas deste usuário
      let hasPermission = false;

      // Permitir que o usuário veja suas próprias estatísticas
      if (userId === targetUserId) {
        hasPermission = true;
      } else if (['ADMIN', 'PASTOR', 'COORDENADOR'].includes(role)) {
        hasPermission = true;
      } else {
        // Verificar se é líder/supervisor da célula do usuário alvo
        const permissionQuery = `
          SELECT u.cell_id
          FROM users u
          WHERE u.id = ? AND u.status = 'ACTIVE'
        `;
        
        const targetUserResult = await pool.query(permissionQuery, [targetUserId]);
        
        if (targetUserResult.rows.length > 0) {
          const targetUserCellId = targetUserResult.rows[0].cell_id;
          
          if (role === 'SUPERVISOR') {
            const supervisionCheck = await pool.query(
              'SELECT id FROM cells WHERE id = ? AND supervisor_id = ?',
              [targetUserCellId, userId]
            );
            hasPermission = supervisionCheck.rows.length > 0;
          } else if (role === 'LIDER') {
            const leadershipCheck = await pool.query(
              'SELECT cell_id FROM cell_leaders WHERE cell_id = ? AND user_id = ?',
              [targetUserCellId, userId]
            );
            hasPermission = leadershipCheck.rows.length > 0;
          }
        }
      }

      if (!hasPermission) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Sem permissão para ver estatísticas deste usuário' })
        };
      }

      // Buscar informações do usuário alvo
      const userQuery = `
        SELECT u.id, u.name, u.email, u.role, c.name as cell_name
        FROM users u
        LEFT JOIN cells c ON u.cell_id = c.id
        WHERE u.id = ? AND u.status = 'ACTIVE'
      `;

      const userResult = await pool.query(userQuery, [targetUserId]);
      
      if (userResult.rows.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Usuário não encontrado' })
        };
      }

      const targetUser = userResult.rows[0];

      // Lógica de cálculo de datas
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(today.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      // Consultas ao banco de dados
      const [prayedTodayCount, prayersThisWeek, prayersThisMonth, totalPrayers, lastPrayerResult] = await Promise.all([
        pool.query(`
          SELECT COUNT(*) as count
          FROM daily_prayer_log
          WHERE user_id = ? AND DATE(prayer_date) = DATE(?)
        `, [targetUserId, today.toISOString().split('T')[0]]),
        
        pool.query(`
          SELECT COUNT(*) as count
          FROM daily_prayer_log
          WHERE user_id = ? AND prayer_date >= ?
        `, [targetUserId, sevenDaysAgo.toISOString().split('T')[0]]),
        
        pool.query(`
          SELECT COUNT(*) as count
          FROM daily_prayer_log
          WHERE user_id = ? AND prayer_date >= ?
        `, [targetUserId, startOfMonth.toISOString().split('T')[0]]),
        
        pool.query(`
          SELECT COUNT(*) as count
          FROM daily_prayer_log
          WHERE user_id = ?
        `, [targetUserId]),
        
        pool.query(`
          SELECT MAX(prayer_date) as last_prayer
          FROM daily_prayer_log
          WHERE user_id = ?
        `, [targetUserId])
      ]);

      // Histórico dos últimos 7 dias para o gráfico
      const historyQuery = `
        SELECT 
          DATE(prayer_date) as date,
          COUNT(*) as count
        FROM daily_prayer_log 
        WHERE user_id = ? AND prayer_date >= DATE('now', '-7 days')
        GROUP BY DATE(prayer_date)
        ORDER BY DATE(prayer_date) DESC
      `;

      const historyResult = await pool.query(historyQuery, [targetUserId]);

      // Calcular média semanal
      const firstPrayerResult = await pool.query(`
        SELECT MIN(prayer_date) as first_prayer
        FROM daily_prayer_log
        WHERE user_id = ?
      `, [targetUserId]);

      let averagePerWeek = 0;
      if (firstPrayerResult.rows[0]?.first_prayer) {
        const firstPrayer = new Date(firstPrayerResult.rows[0].first_prayer);
        const daysSinceFirst = Math.max(1, Math.floor((today.getTime() - firstPrayer.getTime()) / (1000 * 60 * 60 * 24)));
        const weeksSinceFirst = Math.max(1, daysSinceFirst / 7);
        averagePerWeek = totalPrayers.rows[0].count / weeksSinceFirst;
      }

      // Calcular sequência de dias (streak)
      let streakDays = 0;
      const streakQuery = `
        SELECT prayer_date
        FROM daily_prayer_log
        WHERE user_id = ?
        ORDER BY prayer_date DESC
      `;
      const streakResult = await pool.query(streakQuery, [targetUserId]);
      
      if (streakResult.rows.length > 0) {
        let currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);
        
        for (const row of streakResult.rows) {
          const prayerDate = new Date(row.prayer_date);
          prayerDate.setHours(0, 0, 0, 0);
          
          if (prayerDate.getTime() === currentDate.getTime()) {
            streakDays++;
            currentDate.setDate(currentDate.getDate() - 1);
          } else if (prayerDate.getTime() === currentDate.getTime() + (24 * 60 * 60 * 1000)) {
            streakDays++;
            currentDate.setDate(currentDate.getDate() - 1);
          } else {
            break;
          }
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          total_prayers: parseInt(totalPrayers.rows[0].count) || 0,
          prayers_this_month: parseInt(prayersThisMonth.rows[0].count) || 0,
          prayers_this_week: parseInt(prayersThisWeek.rows[0].count) || 0,
          average_per_week: parseFloat(averagePerWeek.toFixed(1)),
          streak_days: streakDays,
          last_prayer_date: lastPrayerResult.rows[0]?.last_prayer || null,
          prayer_history: historyResult.rows.map(row => ({
            date: row.date,
            count: parseInt(row.count)
          }))
        })
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Rota não encontrada' })
    };

  } catch (error) {
    console.error('Erro na função prayers:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erro interno do servidor' })
    };
  }
};