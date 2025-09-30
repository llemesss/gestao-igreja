import { Router } from 'express';
import { authenticateToken, requireLeaderOrAbove } from '../middleware/auth';
import pool from '../database/connection';
import { AuthRequest } from '../types';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Aplicar autenticação a todas as rotas
router.use(authenticateToken);

// POST /api/prayers/log-daily - Registrar oração diária (novo endpoint simplificado)
router.post('/log-daily', async (req: AuthRequest, res) => {
  try {
    const { userId } = req.user!;
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

    res.json({
      success: true,
      message: 'Oração do dia registrada.'
    });

  } catch (error: any) {
    console.error('Erro ao registrar oração diária:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao registrar a oração.'
    });
  }
});

// POST /api/prayers - Registrar oração de hoje (endpoint legado)
router.post('/', async (req: AuthRequest, res) => {
  console.log('🙏 === INÍCIO REGISTRO DE ORAÇÃO ===');
  console.log('🙏 Dados recebidos:', req.body);
  console.log('🙏 Usuário autenticado:', req.user);
  
  try {
    const { userId } = req.user!;
    console.log('🙏 User ID extraído:', userId);
    
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    console.log('🙏 Data de hoje:', today);

    // Verificar se já orou hoje
    console.log('🙏 Verificando se já orou hoje...');
    const existingPrayer = await pool.query(
      'SELECT id FROM daily_prayer_log WHERE user_id = ? AND prayer_date = ?',
      [userId, today]
    );
    console.log('🙏 Resultado da verificação:', existingPrayer.rows);

    if (existingPrayer.rows.length > 0) {
      console.log('🙏 Usuário já orou hoje, retornando erro 400');
      return res.status(400).json({ error: 'Você já registrou sua oração hoje' });
    }

    // Registrar oração
    console.log('🙏 Registrando nova oração...');
    const prayerId = uuidv4();
    console.log('🙏 Prayer ID gerado:', prayerId);
    
    const insertResult = await pool.query(
      'INSERT INTO daily_prayer_log (id, user_id, prayer_date) VALUES (?, ?, ?)',
      [prayerId, userId, today]
    );
    console.log('🙏 Resultado da inserção:', insertResult);

    console.log('🙏 Oração registrada com sucesso!');
    res.status(201).json({
      message: 'Oração registrada com sucesso!',
      prayer: {
        id: prayerId,
        user_id: userId,
        log_date: today,
        created_at: new Date()
      }
    });

  } catch (error: any) {
    console.error('🙏 ❌ ERRO DETALHADO AO REGISTRAR ORAÇÃO:');
    console.error('🙏 ❌ Tipo do erro:', typeof error);
    console.error('🙏 ❌ Nome do erro:', error?.name);
    console.error('🙏 ❌ Mensagem do erro:', error?.message);
    console.error('🙏 ❌ Stack trace:', error?.stack);
    console.error('🙏 ❌ Erro completo:', error);
    
    // Tratamento específico para diferentes tipos de erro
    if (error?.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      console.error('🙏 ❌ ERRO DE FOREIGN KEY: Usuário não existe no banco de dados');
      return res.status(400).json({ 
        error: 'Usuário não encontrado. Faça login novamente.',
        code: 'USER_NOT_FOUND'
      });
    }
    
    if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      console.error('🙏 ❌ ERRO DE UNIQUE: Usuário já orou hoje');
      return res.status(400).json({ 
        error: 'Você já registrou sua oração hoje',
        code: 'ALREADY_PRAYED_TODAY'
      });
    }
    
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
  
  console.log('🙏 === FIM REGISTRO DE ORAÇÃO ===');
});

// GET /api/prayers/status-today - Verificar se o usuário já orou hoje
router.get('/status-today', async (req: AuthRequest, res) => {
  try {
    const { userId } = req.user!;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Verificar se existe registro de oração para hoje
    const existingRecord = await pool.query(
      'SELECT id FROM daily_prayer_log WHERE user_id = ? AND prayer_date = ?',
      [userId, today]
    );

    const hasPrayed = existingRecord.rows.length > 0;

    res.status(200).json({ hasPrayed });

  } catch (error: any) {
    console.error('Erro ao verificar status de oração:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao verificar status de oração.'
    });
  }
});

// GET /api/prayers/stats - Estatísticas simples para dashboard
router.get('/stats', async (req: AuthRequest, res) => {
  try {
    const { userId } = req.user!;
    
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

    res.json({
      prayersToday: Boolean(stats.prayersToday),
      prayersThisWeek: parseInt(stats.prayersThisWeek) || 0,
      prayersThisMonth: parseInt(stats.prayersThisMonth) || 0
    });

  } catch (error) {
    console.error('Erro ao buscar estatísticas de oração:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erro ao buscar estatísticas de oração.' 
    });
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
        COUNT(CASE WHEN prayer_date >= date('now', '-${daysNumber} days') THEN 1 END) as recent_prayers,
        COUNT(CASE WHEN prayer_date >= date('now', '-7 days') THEN 1 END) as week_prayers,
        MAX(prayer_date) as last_prayer_date,
        MIN(prayer_date) as first_prayer_date
      FROM daily_prayer_log 
      WHERE user_id = ?
    `;

    const statsResult = await pool.query(statsQuery, [userId]);
    const stats = statsResult.rows[0];

    // Histórico dos últimos dias - Corrigido para SQLite
    const historyQuery = `
      SELECT prayer_date
      FROM daily_prayer_log 
      WHERE user_id = ? AND prayer_date >= date('now', '-${daysNumber} days')
      ORDER BY prayer_date DESC
    `;

    const historyResult = await pool.query(historyQuery, [userId]);

    // Verificar se orou hoje
    const today = new Date().toISOString().split('T')[0];
    const prayedToday = historyResult.rows.some(row => 
      row.prayer_date.toString().split('T')[0] === today
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
      history: historyResult.rows.map(row => row.prayer_date)
    });

  } catch (error) {
    console.error('Erro ao buscar estatísticas de oração:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/prayers/stats/:userId - Estatísticas de oração de um usuário específico (para líderes ou próprio usuário)
router.get('/stats/:targetUserId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { targetUserId } = req.params;
    const { userId, role } = req.user!;
    const { days = 30 } = req.query;

    const daysNumber = parseInt(days as string) || 30;

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
      return res.status(403).json({ error: 'Sem permissão para ver estatísticas deste usuário' });
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
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const targetUser = userResult.rows[0];

    // Lógica de cálculo de datas robusta
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Zera a hora para comparar apenas a data

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Consultas ao banco de dados usando Promise.all para executar em paralelo
    const [prayedTodayCount, prayersThisWeek, prayersThisMonth, totalPrayers, lastPrayerResult] = await Promise.all([
      // Verifica se orou hoje
      pool.query(`
        SELECT COUNT(*) as count
        FROM daily_prayer_log
        WHERE user_id = ? AND DATE(prayer_date) = DATE(?)
      `, [targetUserId, today.toISOString().split('T')[0]]),
      
      // Conta as orações na semana
      pool.query(`
        SELECT COUNT(*) as count
        FROM daily_prayer_log
        WHERE user_id = ? AND prayer_date >= ?
      `, [targetUserId, sevenDaysAgo.toISOString().split('T')[0]]),
      
      // Conta as orações no mês
      pool.query(`
        SELECT COUNT(*) as count
        FROM daily_prayer_log
        WHERE user_id = ? AND prayer_date >= ?
      `, [targetUserId, startOfMonth.toISOString().split('T')[0]]),
      
      // Total de orações
      pool.query(`
        SELECT COUNT(*) as count
        FROM daily_prayer_log
        WHERE user_id = ?
      `, [targetUserId]),
      
      // Última oração
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

    // Calcular média semanal (total / número de semanas desde a primeira oração)
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
          // Se perdeu um dia, mas ainda está na sequência de ontem
          streakDays++;
          currentDate.setDate(currentDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Retornar dados no formato esperado pelo frontend
    res.json({
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
    });

  } catch (error) {
    console.error('Erro ao buscar estatísticas de oração do usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;