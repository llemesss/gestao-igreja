import { Router } from 'express';
import { authenticateToken, requireLeaderOrAbove } from '../middleware/auth';
import pool from '../database/connection';
import { AuthRequest } from '../types';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Aplicar autenticação a todas as rotas
router.use(authenticateToken);

// POST /api/prayers - Registrar oração de hoje
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { userId } = req.user!;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Verificar se já orou hoje
    const existingPrayer = await pool.query(
      'SELECT id FROM prayer_logs WHERE user_id = $1 AND log_date = $2',
      [userId, today]
    );

    if (existingPrayer.rows.length > 0) {
      return res.status(400).json({ error: 'Você já registrou sua oração hoje' });
    }

    // Registrar oração
    const prayerId = uuidv4();
    await pool.query(
      'INSERT INTO prayer_logs (id, user_id, log_date) VALUES ($1, $2, $3)',
      [prayerId, userId, today]
    );

    res.status(201).json({
      message: 'Oração registrada com sucesso!',
      prayer: {
        id: prayerId,
        user_id: userId,
        log_date: today,
        created_at: new Date()
      }
    });

  } catch (error) {
    console.error('Erro ao registrar oração:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/prayers/my-stats - Estatísticas pessoais de oração
router.get('/my-stats', async (req: AuthRequest, res) => {
  try {
    const { userId } = req.user!;
    const { days = 30 } = req.query;

    const daysNumber = parseInt(days as string) || 30;
    
    // Estatísticas gerais - Corrigido para SQLite
    const statsQuery = `
      SELECT 
        COUNT(*) as total_prayers,
        COUNT(CASE WHEN log_date >= date('now', '-${daysNumber} days') THEN 1 END) as recent_prayers,
        COUNT(CASE WHEN log_date >= date('now', '-7 days') THEN 1 END) as week_prayers,
        MAX(log_date) as last_prayer_date,
        MIN(log_date) as first_prayer_date
      FROM prayer_logs 
      WHERE user_id = ?
    `;

    const statsResult = await pool.query(statsQuery, [userId]);
    const stats = statsResult.rows[0];

    // Histórico dos últimos dias - Corrigido para SQLite
    const historyQuery = `
      SELECT log_date
      FROM prayer_logs 
      WHERE user_id = ? AND log_date >= date('now', '-${daysNumber} days')
      ORDER BY log_date DESC
    `;

    const historyResult = await pool.query(historyQuery, [userId]);

    // Verificar se orou hoje
    const today = new Date().toISOString().split('T')[0];
    const prayedToday = historyResult.rows.some(row => 
      row.log_date.toString().split('T')[0] === today
    );

    res.json({
      stats: {
        total_prayers: parseInt(stats.total_prayers),
        recent_prayers: parseInt(stats.recent_prayers),
        week_prayers: parseInt(stats.week_prayers),
        last_prayer_date: stats.last_prayer_date,
        first_prayer_date: stats.first_prayer_date,
        prayed_today: prayedToday
      },
      history: historyResult.rows.map(row => row.log_date)
    });

  } catch (error) {
    console.error('Erro ao buscar estatísticas de oração:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/prayers/stats/:userId - Estatísticas de oração de um usuário específico (para líderes)
router.get('/stats/:targetUserId', requireLeaderOrAbove, async (req: AuthRequest, res) => {
  try {
    const { targetUserId } = req.params;
    const { userId, role } = req.user!;
    const { days = 30 } = req.query;

    const daysNumber = parseInt(days as string) || 30;

    // Verificar permissão para ver estatísticas deste usuário
    let hasPermission = false;

    if (['ADMIN', 'PASTOR', 'COORDENADOR'].includes(role)) {
      hasPermission = true;
    } else {
      // Verificar se é líder/supervisor da célula do usuário alvo
      const permissionQuery = `
        SELECT u.cell_id
        FROM users u
        WHERE u.id = $1
      `;
      
      const targetUserResult = await pool.query(permissionQuery, [targetUserId]);
      
      if (targetUserResult.rows.length > 0) {
        const targetUserCellId = targetUserResult.rows[0].cell_id;
        
        if (role === 'SUPERVISOR') {
          const supervisionCheck = await pool.query(
            'SELECT id FROM cells WHERE id = $1 AND supervisor_id = $2',
            [targetUserCellId, userId]
          );
          hasPermission = supervisionCheck.rows.length > 0;
        } else if (role === 'LIDER') {
          const leadershipCheck = await pool.query(
            'SELECT cell_id FROM cell_leaders WHERE cell_id = $1 AND user_id = $2',
            [targetUserCellId, userId]
          );
          hasPermission = leadershipCheck.rows.length > 0;
        }
      }
    }

    if (!hasPermission) {
      return res.status(403).json({ error: 'Sem permissão para ver estatísticas deste usuário' });
    }

    // Buscar informações do usuário alvo
    const userQuery = `
      SELECT u.id, u.name, u.email, u.role, c.name as cell_name
      FROM users u
      LEFT JOIN cells c ON u.cell_id = c.id
      WHERE u.id = $1
    `;

    const userResult = await pool.query(userQuery, [targetUserId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const targetUser = userResult.rows[0];

    // Estatísticas de oração
    const statsQuery = `
      SELECT 
        COUNT(*) as total_prayers,
        COUNT(CASE WHEN log_date >= date('now', '-${daysNumber} days') THEN 1 END) as recent_prayers,
        COUNT(CASE WHEN log_date >= date('now', '-7 days') THEN 1 END) as week_prayers,
        MAX(log_date) as last_prayer_date,
        MIN(log_date) as first_prayer_date
      FROM prayer_logs 
      WHERE user_id = $1
    `;

    const statsResult = await pool.query(statsQuery, [targetUserId]);
    const stats = statsResult.rows[0];

    // Histórico dos últimos dias
    const historyQuery = `
      SELECT log_date
      FROM prayer_logs 
      WHERE user_id = $1 AND log_date >= date('now', '-${daysNumber} days')
      ORDER BY log_date DESC
    `;

    const historyResult = await pool.query(historyQuery, [targetUserId]);

    // Verificar se orou hoje
    const today = new Date().toISOString().split('T')[0];
    const prayedToday = historyResult.rows.some(row => 
      row.log_date.toISOString().split('T')[0] === today
    );

    res.json({
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        cell_name: targetUser.cell_name
      },
      stats: {
        total_prayers: parseInt(stats.total_prayers),
        recent_prayers: parseInt(stats.recent_prayers),
        week_prayers: parseInt(stats.week_prayers),
        last_prayer_date: stats.last_prayer_date,
        first_prayer_date: stats.first_prayer_date,
        prayed_today: prayedToday
      },
      history: historyResult.rows.map(row => row.log_date)
    });

  } catch (error) {
    console.error('Erro ao buscar estatísticas de oração do usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;