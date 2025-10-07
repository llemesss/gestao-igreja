import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import pg from 'pg';

const { Pool } = pg;

// Env
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const DATABASE_URL = process.env.DATABASE_URL;

// DB pool (Supabase Postgres)
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// App
const app = express();
app.use(express.json());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

// Auth middleware
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token inválido ou ausente' });
  }
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { userId: decoded.userId, email: decoded.email, role: decoded.role };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

// Health
app.get('/api/health', async (req, res) => {
  try {
    const ping = await pool.query('SELECT 1');
    const dbOk = !!ping?.rows?.length;
    return res.json({ ok: true, db: dbOk, timestamp: new Date().toISOString() });
  } catch (e) {
    console.error('Health DB check failed:', e);
    return res.json({ ok: true, db: false, timestamp: new Date().toISOString() });
  }
});

// Auth routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }
    const result = await pool.query(
      'SELECT id, name, email, password_hash, role FROM users WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Erro em /api/auth/login:', err);
    return res.status(500).json({ error: 'Erro interno ao efetuar login' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const start = Date.now();
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    }
    const emailOk = /.+@.+\..+/.test(email);
    if (!emailOk) {
      return res.status(400).json({ error: 'Email inválido' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres' });
    }

    console.log('[REGISTER] Tentativa', { email, nameLen: String(name).length });

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      console.log('[REGISTER] conflito de email', { email });
      return res.status(409).json({ error: 'Email já está em uso' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    const insertSql = `INSERT INTO users (id, name, email, password_hash, role, created_at)
                       VALUES ($1, $2, $3, $4, 'MEMBRO', NOW())`;
    await pool.query(insertSql, [userId, name, email.toLowerCase(), passwordHash]);

    const token = jwt.sign({ userId, email: email.toLowerCase(), role: 'MEMBRO' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    console.log('[REGISTER] sucesso', { email, ms: Date.now() - start });
    return res.status(201).json({ token, user: { id: userId, name, email: email.toLowerCase(), role: 'MEMBRO' } });
  } catch (err) {
    console.error('Erro em /api/auth/register:', {
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
      constraint: err?.constraint,
      stack: err?.stack,
    });
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'Email já está em uso' });
    }
    return res.status(500).json({ error: 'Erro interno ao registrar usuário' });
  }
});

// Users: GET /:id perfil + estatísticas resumidas (similar à função users.ts)
app.get('/api/users/:id', verifyToken, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const userQuery = `
      SELECT id, name, email, phone, role, cell_id
      FROM users
      WHERE id = $1 AND status = 'ACTIVE'
    `;
    const userResult = await pool.query(userQuery, [targetUserId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'Usuário não encontrado ou inativo' });
    }
    const userProfile = userResult.rows[0];

    const today = new Date(); today.setHours(0,0,0,0);
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(today.getDate() - 7); sevenDaysAgo.setHours(0,0,0,0);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [prayedTodayCount, prayersThisWeek, prayersThisMonth, totalPrayers, lastPrayerResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) as count FROM daily_prayer_log WHERE user_id = $1 AND prayer_date::date = $2::date`, [targetUserId, today.toISOString().split('T')[0]]),
      pool.query(`SELECT COUNT(*) as count FROM daily_prayer_log WHERE user_id = $1 AND prayer_date >= $2`, [targetUserId, sevenDaysAgo.toISOString().split('T')[0]]),
      pool.query(`SELECT COUNT(*) as count FROM daily_prayer_log WHERE user_id = $1 AND prayer_date >= $2`, [targetUserId, startOfMonth.toISOString().split('T')[0]]),
      pool.query(`SELECT COUNT(*) as count FROM daily_prayer_log WHERE user_id = $1`, [targetUserId]),
      pool.query(`SELECT prayer_date FROM daily_prayer_log WHERE user_id = $1 ORDER BY prayer_date DESC LIMIT 1`, [targetUserId])
    ]);

    return res.json({
      user: userProfile,
      stats: {
        prayedToday: parseInt(prayedTodayCount.rows[0]?.count || '0'),
        thisWeek: parseInt(prayersThisWeek.rows[0]?.count || '0'),
        thisMonth: parseInt(prayersThisMonth.rows[0]?.count || '0'),
        total: parseInt(totalPrayers.rows[0]?.count || '0'),
        lastPrayerDate: lastPrayerResult.rows[0]?.prayer_date || null,
      }
    });
  } catch (err) {
    console.error('Erro em GET /api/users/:id', err);
    return res.status(500).json({ error: 'Erro interno ao obter usuário' });
  }
});

// Me: GET perfil
app.get('/api/me', verifyToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const query = `
      SELECT u.id, u.name, u.email, u.role, u.cell_id,
             u.full_name, u.phone, u.whatsapp, u.gender,
             u.birth_city, u.birth_state, u.birth_date,
             u.address, u.address_number, u.neighborhood, u.zip_code, u.address_reference,
             u.father_name, u.mother_name, u.marital_status, u.spouse_name,
             u.education_level, u.profession, u.conversion_date, u.transfer_info,
             u.has_children, u.oikos1, u.oikos2,
             u.created_at, u.updated_at,
             c.name as cell_name
      FROM users u
      LEFT JOIN cells c ON u.cell_id = c.id
      WHERE u.id = $1
    `;
    const result = await pool.query(query, [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    const { password_hash, ...cleanUserProfile } = result.rows[0];
    // Checar se é secretário
    const secretaryRes = await pool.query('SELECT COUNT(*) as count FROM cells WHERE secretary_id = $1', [userId]);
    const isCellSecretary = parseInt(secretaryRes.rows[0].count) > 0;
    return res.json({ message: 'Perfil obtido com sucesso', user: { ...cleanUserProfile, isCellSecretary } });
  } catch (err) {
    console.error('Erro em GET /api/me', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Me: PUT perfil
app.put('/api/me', verifyToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const fields = req.body || {};
    const allowed = [
      'name','full_name','phone','whatsapp','gender','birth_city','birth_state','birth_date',
      'address','address_number','neighborhood','zip_code','address_reference',
      'father_name','mother_name','marital_status','spouse_name','education_level','profession',
      'conversion_date','transfer_info','has_children','oikos1','oikos2'
    ];
    const entries = Object.entries(fields).filter(([k]) => allowed.includes(k));
    if (entries.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo válido para atualizar' });
    }
    // Build query
    const setClauses = entries.map(([k], i) => `${k} = $${i+1}`).join(', ');
    const values = entries.map(([,v]) => v);
    values.push(userId);
    const sql = `UPDATE users SET ${setClauses}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`;
    const updateRes = await pool.query(sql, values);
    const updated = updateRes.rows[0];
    const { password_hash, ...userProfile } = updated;
    return res.json({ message: 'Perfil atualizado com sucesso', user: userProfile });
  } catch (err) {
    console.error('Erro em PUT /api/me', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Prayers: registrar oração diária
app.post('/api/prayers/register', verifyToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const today = new Date().toISOString().split('T')[0];
    await pool.query(
      `INSERT INTO daily_prayer_log (id, user_id, prayer_date) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, prayer_date) DO NOTHING`,
      [uuidv4(), userId, today]
    );
    return res.json({ message: 'Oração registrada' });
  } catch (err) {
    console.error('Erro em POST /api/prayers/register', err);
    return res.status(500).json({ error: 'Erro ao registrar oração' });
  }
});

// Prayers: status de hoje (compatível com frontend)
app.get('/api/prayers/status-today', verifyToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const today = new Date().toISOString().split('T')[0];
    const existing = await pool.query(
      'SELECT id FROM daily_prayer_log WHERE user_id = $1 AND prayer_date = $2 LIMIT 1',
      [userId, today]
    );
    return res.json({ hasPrayed: existing.rows.length > 0 });
  } catch (err) {
    console.error('Erro em GET /api/prayers/status-today', err);
    return res.status(500).json({ error: 'Erro ao verificar status de oração' });
  }
});

// Prayers: estatísticas simples para dashboard (compatível com frontend)
app.get('/api/prayers/stats', verifyToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const statsQuery = `
      SELECT 
        COUNT(CASE WHEN prayer_date >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as "prayersThisWeek",
        COUNT(CASE WHEN prayer_date >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as "prayersThisMonth",
        COUNT(CASE WHEN prayer_date = CURRENT_DATE THEN 1 END) > 0 as "prayersToday"
      FROM daily_prayer_log 
      WHERE user_id = $1
    `;
    const result = await pool.query(statsQuery, [userId]);
    const row = result.rows[0] || {};
    return res.json({
      prayersToday: Boolean(row.prayersToday),
      prayersThisWeek: parseInt(row.prayersThisWeek || 0),
      prayersThisMonth: parseInt(row.prayersThisMonth || 0)
    });
  } catch (err) {
    console.error('Erro em GET /api/prayers/stats', err);
    return res.status(500).json({ error: 'Erro ao obter estatísticas de oração' });
  }
});

// Prayers: endpoint legado para registro (POST /api/prayers)
app.post('/api/prayers', verifyToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const today = new Date().toISOString().split('T')[0];
    const exists = await pool.query(
      'SELECT id FROM daily_prayer_log WHERE user_id = $1 AND prayer_date = $2',
      [userId, today]
    );
    if (exists.rows.length > 0) {
      return res.status(200).json({ message: 'Oração do dia já registrada.' });
    }
    await pool.query(
      `INSERT INTO daily_prayer_log (id, user_id, prayer_date) VALUES ($1, $2, $3)`,
      [uuidv4(), userId, today]
    );
    return res.status(201).json({ message: 'Oração registrada com sucesso!' });
  } catch (err) {
    console.error('Erro em POST /api/prayers', err);
    return res.status(500).json({ error: 'Erro ao registrar oração' });
  }
});

// Prayers: minhas estatísticas
app.get('/api/prayers/my-stats', verifyToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const days = parseInt(req.query.days || '7');
    const since = new Date(); since.setDate(since.getDate() - days);
    const countRes = await pool.query(
      `SELECT COUNT(*) as count FROM daily_prayer_log WHERE user_id = $1 AND prayer_date >= $2`,
      [userId, since.toISOString().split('T')[0]]
    );
    return res.json({ count: parseInt(countRes.rows[0].count || '0'), days });
  } catch (err) {
    console.error('Erro em GET /api/prayers/my-stats', err);
    return res.status(500).json({ error: 'Erro ao obter estatísticas' });
  }
});

// Cells: listar células (simplificado)
app.get('/api/cells', verifyToken, async (req, res) => {
  try {
    const { userId, role } = req.user;
    let query = '';
    let params = [];

    switch (role) {
      case 'ADMIN':
      case 'PASTOR':
      case 'COORDENADOR':
        query = `
          SELECT c.id, c.name, c.supervisor_id, c.created_at, c.updated_at,
                 s.name as supervisor_name
          FROM cells c
          LEFT JOIN users s ON c.supervisor_id = s.id
          ORDER BY c.name ASC
        `;
        break;
      case 'SUPERVISOR':
        query = `
          SELECT c.id, c.name, c.supervisor_id, c.created_at, c.updated_at,
                 s.name as supervisor_name
          FROM cells c
          LEFT JOIN users s ON c.supervisor_id = s.id
          WHERE c.supervisor_id = $1
          ORDER BY c.name ASC
        `;
        params = [userId];
        break;
      case 'LIDER':
      case 'MEMBRO':
        query = `
          SELECT c.id, c.name, c.supervisor_id, c.created_at, c.updated_at,
                 s.name as supervisor_name
          FROM cells c
          LEFT JOIN users s ON c.supervisor_id = s.id
          WHERE c.id = (SELECT cell_id FROM users WHERE id = $1)
          ORDER BY c.name ASC
        `;
        params = [userId];
        break;
      default:
        return res.status(403).json({ error: 'Role não reconhecido' });
    }

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('Erro em GET /api/cells', err);
    return res.status(500).json({ error: 'Erro ao listar células' });
  }
});

// Cells: membros da célula especificada
// Permite acesso se o usuário for membro da célula OU líder designado da célula
app.get('/api/cells/:id/members', verifyToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const requestedCellId = req.params.id;

    // Verificar se usuário é membro da célula solicitada
    const userCellRes = await pool.query('SELECT cell_id FROM users WHERE id = $1', [userId]);
    const userCellId = userCellRes.rows[0]?.cell_id;

    // Verificar se usuário é líder designado da célula solicitada
    let isLeaderOfCell = false;
    try {
      const leaderRes = await pool.query(
        'SELECT 1 FROM cell_leaders WHERE user_id = $1 AND cell_id = $2 LIMIT 1',
        [userId, requestedCellId]
      );
      isLeaderOfCell = leaderRes.rows.length > 0;
    } catch (e) {
      // Se a tabela não existir ou der erro, mantém a regra básica por membership
      console.warn('Aviso: consulta a cell_leaders falhou ou tabela ausente. Permitindo apenas membros da própria célula.');
    }

    if (!isLeaderOfCell && userCellId !== requestedCellId) {
      return res.status(403).json({ error: 'Acesso negado: permitido apenas para membros ou líderes da própria célula' });
    }

    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.phone, u.whatsapp,
              u.birth_date, u.age_group, u.gender, u.marital_status,
              u.oikos1, u.oikos2, u.created_at
       FROM users u
       WHERE u.cell_id = $1
       ORDER BY u.name ASC`,
      [requestedCellId]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error('Erro em GET /api/cells/:id/members', err);
    return res.status(500).json({ error: 'Erro ao listar membros da célula' });
  }
});

// Cells: membros da minha célula
app.get('/api/cells/my-cell/members', verifyToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const userCellRes = await pool.query('SELECT cell_id FROM users WHERE id = $1', [userId]);
    const cellId = userCellRes.rows[0]?.cell_id;
    if (!cellId) return res.status(404).json({ error: 'Célula do usuário não encontrada' });
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.phone, u.whatsapp,
              u.birth_date, u.age_group, u.gender, u.marital_status,
              u.oikos1, u.oikos2, u.created_at
       FROM users u
       WHERE u.cell_id = $1
       ORDER BY u.name ASC`,
      [cellId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('Erro em GET /api/cells/my-cell/members', err);
    return res.status(500).json({ error: 'Erro ao listar membros' });
  }
});

// Start
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});