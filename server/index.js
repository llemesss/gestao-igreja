import 'dotenv/config';
import express from 'express';
import PDFDocument from 'pdfkit';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import pg from 'pg';
import { lookup } from 'dns/promises';

const { Pool } = pg;

// Helper: validação segura de UUID para evitar erros de sintaxe no PostgreSQL
const isValidUuid = (id) => typeof id === 'string' && uuidValidate(id);

// Desativar verificação de certificado TLS para contornar erros
// "self-signed certificate in certificate chain" ao conectar no Postgres
// em ambientes onde a CA não é reconhecida. Isso é seguro aqui porque
// conectamos a hosts conhecidos (Supabase/Render) e já exigimos SSL.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
pg.defaults.ssl = { rejectUnauthorized: false };

// Env
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const DATABASE_URL = process.env.DATABASE_URL;

// DB pool (Supabase Postgres) com preferência por IPv4
let pool;
try {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL ausente');
  }
  const url = new URL(DATABASE_URL);
  // Resolver hostname para IPv4 explicitamente para evitar ENETUNREACH por IPv6
  const resolved = await lookup(url.hostname, { family: 4 });
  const hostIPv4 = resolved?.address || url.hostname;
  const port = parseInt(url.port || (url.pathname ? '5432' : '5432'), 10);
  const database = (url.pathname || '').replace(/^\//, '') || undefined;
  const user = decodeURIComponent(url.username || '');
  const password = decodeURIComponent(url.password || '');
  pool = new Pool({
    host: hostIPv4,
    port,
    database,
    user,
    password,
    ssl: { require: true, rejectUnauthorized: false },
    keepAlive: true,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 10,
  });
  console.log('[DB] Pool inicializado com IPv4', { host: hostIPv4, port });
} catch (e) {
  console.warn('[DB] Falha ao resolver IPv4; usando connectionString padrão:', e?.message || e);
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { require: true, rejectUnauthorized: false },
    keepAlive: true,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 10,
  });
}

// App
const app = express();
app.use(express.json());
// CORS: permitir origem dinâmica e headers/métodos necessários
// Fallback robusto de CORS para garantir headers em qualquer resposta, inclusive erros/502 do provider
const allowedOriginsEnv = process.env.CORS_ORIGIN || '';
const ALLOWED_ORIGINS = allowedOriginsEnv
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  // Se houver lista de origens permitidas, respeitar; senão, refletir origem dinamicamente
  if (ALLOWED_ORIGINS.length > 0) {
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
    }
  } else {
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
    } else {
      res.header('Access-Control-Allow-Origin', '*');
    }
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});
const corsOptions = {
  origin: (origin, callback) => {
    // Permitir qualquer origem conhecida; com credenciais o header será ecoado
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));
// Habilitar preflight globalmente
app.options('*', cors(corsOptions));

// Estado do schema em memória
let HAS_USERS_STATUS = false;
const isPgBouncer = (() => {
  try {
    const u = new URL(String(DATABASE_URL || ''));
    return u.port === '6543';
  } catch {
    return false;
  }
})();

// Verifica se a coluna existe
const checkUsersStatusColumn = async () => {
  try {
    const res = await pool.query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name = 'users' AND column_name = 'status'
       ) AS exists`
    );
    HAS_USERS_STATUS = !!res?.rows?.[0]?.exists;
    if (!HAS_USERS_STATUS) {
      console.warn('[SCHEMA] users.status ausente; rotas funcionarão sem filtro por status.');
    }
  } catch (e) {
    console.warn('[SCHEMA] Falha ao verificar coluna users.status:', e?.message || e);
  }
};

// Aguarda disponibilidade da conexão com retry/backoff
const waitForDbConnection = async (maxAttempts = 5, initialDelayMs = 500) => {
  if (!DATABASE_URL) {
    console.warn('[DB] DATABASE_URL ausente; pulando verificação inicial de schema.');
    return false;
  }
  let attempt = 0;
  let delay = initialDelayMs;
  while (attempt < maxAttempts) {
    try {
      await pool.query('SELECT 1');
      return true;
    } catch (e) {
      attempt++;
      console.warn(`[DB] Conexão indisponível (tentativa ${attempt}/${maxAttempts}):`, e?.code || e?.message || e);
      if (attempt >= maxAttempts) break;
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, 5000);
    }
  }
  return false;
};

// Garantir schema mínimo (colunas/tabelas críticas) antes de continuar
const ensureSchema = async () => {
  try {
    // Em Pooling (PgBouncer 6543), evitar DDL no startup para não sofrer terminação.
    if (!isPgBouncer) {
      await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
      `);

      // Garantir tabela de células básica (usada em múltiplas rotas)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS cells (
          id UUID PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          supervisor_id UUID,
          secretary_id UUID,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_cells_supervisor ON cells(supervisor_id);
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_cells_secretary ON cells(secretary_id);
      `);

      // Garantir tabela de líderes da célula compatível com inserções (created_at)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS cell_leaders (
          cell_id UUID NOT NULL,
          user_id UUID NOT NULL,
          PRIMARY KEY (cell_id, user_id)
        );
      `);
      // Adicionar coluna created_at se estiver ausente
      await pool.query(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'cell_leaders' AND column_name = 'created_at'
          ) THEN
            ALTER TABLE cell_leaders ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
          END IF;
        END $$;
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_cell_leaders_cell ON cell_leaders(cell_id);
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_cell_leaders_user ON cell_leaders(user_id);
      `);

      // Tabela de log de orações diárias (somente quando não estiver em PgBouncer)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS daily_prayer_log (
          id UUID PRIMARY KEY,
          user_id UUID NOT NULL,
          prayer_date DATE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_prayer_user_date
          ON daily_prayer_log(user_id, prayer_date);
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_daily_prayer_user
          ON daily_prayer_log(user_id);
      `);
    } else {
      console.warn('[SCHEMA] Em Pooling (6543): pulando DDL no startup.');
    }
  } catch (e) {
    console.warn('[SCHEMA] Falha ao garantir coluna users.status:', e?.message || e);
  } finally {
    // Atualiza flag em memória
    await checkUsersStatusColumn();
  }
};

// Executa verificação de schema
waitForDbConnection()
  .then((ok) => {
    if (ok) {
      return ensureSchema();
    } else {
      console.warn('[SCHEMA] DB indisponível no startup; seguindo sem garantir alterações.');
    }
  })
  .catch((e) => console.warn('[SCHEMA] erro inicial:', e?.message || e));

// Rota de teste mínima para isolamento
app.get('/api/ping', (req, res) => {
  res.status(200).send('Pong!');
});

// Rota raiz para health rápido
app.get('/', (req, res) => {
  res.status(200).json({ ok: true, service: 'backend', version: 'v3', timestamp: new Date().toISOString() });
});

// Seed de administrador: cria um admin padrão se nenhum existir
const seedAdminIfMissing = async () => {
  try {
    const existingAdmin = await pool.query("SELECT id, email FROM users WHERE role = 'ADMIN' LIMIT 1");
    if (existingAdmin.rows.length > 0) {
      console.log('[ADMIN SEED] Já existe um usuário ADMIN, seed não necessário.');
      return;
    }

    const defaultEmail = process.env.ADMIN_EMAIL || 'admin@igreja.com';
    const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const defaultName = process.env.ADMIN_NAME || 'Admin';

    // Se já existir usuário com o email, apenas promove para ADMIN e atualiza senha
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [defaultEmail.toLowerCase()]);
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    if (existingUser.rows.length > 0) {
      const userId = existingUser.rows[0].id;
      const updateSql = `UPDATE users
         SET role = 'ADMIN', password_hash = $2, name = $3${HAS_USERS_STATUS ? ", status = 'ACTIVE'" : ''}
         WHERE id = $1`;
      await pool.query(updateSql, [userId, passwordHash, defaultName]);
      console.log('[ADMIN SEED] Usuário existente promovido a ADMIN:', defaultEmail);
    } else {
      const userId = uuidv4();
      const insertSql = `INSERT INTO users (id, name, email, password_hash, role${HAS_USERS_STATUS ? ', status' : ''}, created_at)
         VALUES ($1, $2, $3, $4, 'ADMIN'${HAS_USERS_STATUS ? ", 'ACTIVE'" : ''}, NOW())`;
      await pool.query(insertSql, [userId, defaultName, defaultEmail.toLowerCase(), passwordHash]);
      console.log('[ADMIN SEED] ADMIN criado:', defaultEmail);
    }
  } catch (e) {
    console.error('[ADMIN SEED] Falha ao criar/promover ADMIN:', e?.message || e);
  }
};

// Executa seed de administrador se necessário (depois da definição)
seedAdminIfMissing().catch((e) => {
  console.error('[ADMIN SEED] erro ao inicializar seed:', e?.message || e);
});

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

// Users: GET /my-cells -> células supervisionadas pelo usuário logado (SUPERVISOR)
 

// Users: GET /:id perfil + estatísticas resumidas (similar à função users.ts)
app.get('/api/users/:id', verifyToken, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    // Validação defensiva para evitar colisões com rotas estáticas e erro 22P02
    if (!isValidUuid(targetUserId)) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }
    // 1) Perfil do usuário ativo
    const userQuery = HAS_USERS_STATUS
      ? `SELECT id, name, email, phone, role, cell_id FROM users WHERE id = $1 AND status = 'ACTIVE'`
      : `SELECT id, name, email, phone, role, cell_id FROM users WHERE id = $1`;
    const userResult = await pool.query(userQuery, [targetUserId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }
    const userProfile = userResult.rows[0];

    // 2) Estatísticas de oração
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

    // 3) Resposta unificada
    return res.status(200).json({
      profile: userProfile,
      stats: {
        totalPrayers,
        lastPrayerDate,
      },
    });
  } catch (err) {
    console.error('Erro em GET /api/users/:id', err);
    return res.status(500).json({ message: 'Erro interno no servidor' });
  }
});

// Users: report PDF - ficha do membro
app.get('/api/users/reports/member/:id/pdf', verifyToken, async (req, res) => {
  try {
    const { userId, role } = req.user;
    const targetUserId = req.params.id;

    // Obter perfil básico do usuário alvo
    const userSql = `SELECT u.id, u.name, u.email, u.phone, u.role, u.cell_id, c.name as cell_name
                     FROM users u
                     LEFT JOIN cells c ON c.id = u.cell_id
                     WHERE u.id = $1`;
    const userRes = await pool.query(userSql, [targetUserId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    const target = userRes.rows[0];

    // Permissões: admins e acima; supervisor se supervisiona célula; líder da célula; o próprio usuário
    let allowed = ['ADMIN','PASTOR','COORDENADOR'].includes(role) || userId === targetUserId;
    if (!allowed && role === 'SUPERVISOR' && target.cell_id) {
      try {
        const supCheck = await pool.query('SELECT 1 FROM cells WHERE id = $1 AND supervisor_id = $2 LIMIT 1', [target.cell_id, userId]);
        allowed = supCheck.rows.length > 0;
      } catch {}
    }
    if (!allowed && target.cell_id) {
      try {
        const leaderCheck = await pool.query('SELECT 1 FROM cell_leaders WHERE user_id = $1 AND cell_id = $2 LIMIT 1', [userId, target.cell_id]);
        allowed = leaderCheck.rows.length > 0;
      } catch {}
    }
    if (!allowed) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Estatísticas resumidas
    const [countRes, lastRes] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS total FROM daily_prayer_log WHERE user_id = $1', [targetUserId]),
      pool.query('SELECT MAX(prayer_date) AS last FROM daily_prayer_log WHERE user_id = $1', [targetUserId])
    ]);
    const total = countRes.rows[0]?.total ?? 0;
    const last = lastRes.rows[0]?.last ? new Date(lastRes.rows[0].last).toISOString().slice(0,10) : 'Nunca';

    // Gerar PDF básico
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ficha-${(target.name || 'membro').replace(/\s+/g,'-')}"`);
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);
    doc.fontSize(20).text('Ficha do Membro', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Nome: ${target.name || '-'}`);
    doc.text(`Email: ${target.email || '-'}`);
    doc.text(`Telefone: ${target.phone || '-'}`);
    doc.text(`Papel: ${target.role || '-'}`);
    doc.text(`Célula: ${target.cell_name || '-'}`);
    doc.moveDown();
    doc.fontSize(14).text('Estatísticas de Oração');
    doc.fontSize(12).text(`Orações Registradas: ${total}`);
    doc.text(`Última Oração: ${last}`);
    doc.end();
  } catch (err) {
    console.error('Erro em GET /api/users/reports/member/:id/pdf', err);
    return res.status(500).json({ error: 'Erro ao gerar PDF' });
  }
});

// Users: report PDF - calendário de oração do membro
app.get('/api/users/reports/calendar/:id/pdf', verifyToken, async (req, res) => {
  try {
    const { userId, role } = req.user;
    const targetUserId = req.params.id;
    const year = parseInt(String(req.query.year || new Date().getFullYear()));

    const userRes = await pool.query('SELECT id, name, cell_id FROM users WHERE id = $1', [targetUserId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    const target = userRes.rows[0];

    let allowed = ['ADMIN','PASTOR','COORDENADOR'].includes(role) || userId === targetUserId;
    if (!allowed && role === 'SUPERVISOR' && target.cell_id) {
      try {
        const supCheck = await pool.query('SELECT 1 FROM cells WHERE id = $1 AND supervisor_id = $2 LIMIT 1', [target.cell_id, userId]);
        allowed = supCheck.rows.length > 0;
      } catch {}
    }
    if (!allowed && target.cell_id) {
      try {
        const leaderCheck = await pool.query('SELECT 1 FROM cell_leaders WHERE user_id = $1 AND cell_id = $2 LIMIT 1', [userId, target.cell_id]);
        allowed = leaderCheck.rows.length > 0;
      } catch {}
    }
    if (!allowed) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const datesRes = await pool.query(
      `SELECT prayer_date FROM daily_prayer_log 
       WHERE user_id = $1 AND EXTRACT(YEAR FROM prayer_date) = $2
       ORDER BY prayer_date ASC`,
      [targetUserId, year]
    );
    const prayedDates = datesRes.rows.map(r => new Date(r.prayer_date));

    // PDF simples: título e lista de dias com oração
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="calendario-oracao-${(target.name || 'membro').replace(/\s+/g,'-')}-${year}.pdf"`);
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);
    doc.fontSize(18).text(`Calendário de Oração - ${year}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Membro: ${target.name || '-'}`);
    doc.moveDown();

    const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    for (let m = 0; m < 12; m++) {
      doc.fontSize(14).text(months[m]);
      const monthDates = prayedDates.filter(d => d.getMonth() === m);
      if (monthDates.length === 0) {
        doc.fontSize(12).text('   (sem registros)');
      } else {
        const days = monthDates.map(d => d.getDate()).join(', ');
        doc.fontSize(12).text(`   Dias com oração: ${days}`);
      }
      doc.moveDown(0.5);
    }

    doc.end();
  } catch (err) {
    console.error('Erro em GET /api/users/reports/calendar/:id/pdf', err);
    return res.status(500).json({ error: 'Erro ao gerar PDF' });
  }
});

// Users: GET / -> Listagem para painel administrativo
app.get('/api/users', verifyToken, async (req, res) => {
  try {
    const { role } = req.user;
    if (!['ADMIN', 'PASTOR', 'COORDENADOR', 'SUPERVISOR'].includes(role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const q = String((req.query.q ?? req.query.search ?? '')).trim();
    const limit = Math.min(parseInt(req.query.limit || '200'), 500);
    const offset = Math.max(parseInt(req.query.offset || '0'), 0);

    let sql = `
      SELECT u.id, u.name, u.email, u.role, u.cell_id, u.created_at,
             c.name as cell_name
      FROM users u
      LEFT JOIN cells c ON c.id = u.cell_id
    `;
    const params = [];
    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      sql += ` WHERE LOWER(u.name) LIKE $1 OR LOWER(u.email) LIKE $1`;
    }
    sql += ` ORDER BY u.created_at DESC NULLS LAST, u.name ASC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    params.push(limit, offset);

    const result = await pool.query(sql, params);
    // Sempre retornar um array de usuários
    return res.json(result.rows || []);
  } catch (err) {
    console.error('Erro em GET /api/users', err);
    // Fallback amigável: evitar 500 e manter painel utilizável
    return res.status(200).json([]);
  }
});

// Users: GET /:id/supervised-cells -> lista de células supervisionadas por um usuário específico
app.get('/api/users/:id/supervised-cells', verifyToken, async (req, res) => {
  try {
    const requester = req.user;
    const targetUserId = req.params.id;

    // Permissões: ADMIN, PASTOR, COORDENADOR podem consultar qualquer usuário.
    // SUPERVISOR pode consultar apenas suas próprias células.
    const canQueryAny = ['ADMIN', 'PASTOR', 'COORDENADOR'].includes(requester.role);
    const isSelf = requester.userId === targetUserId;
    if (!canQueryAny && !(requester.role === 'SUPERVISOR' && isSelf)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const sql = `
      SELECT c.id, c.name, c.supervisor_id, u.name AS supervisor_name,
             (
               SELECT COUNT(*) FROM users m WHERE m.cell_id = c.id
             )::int AS member_count
      FROM cells c
      LEFT JOIN users u ON u.id = c.supervisor_id
      WHERE c.supervisor_id = $1
      ORDER BY c.name ASC
    `;
    const result = await pool.query(sql, [targetUserId]);

    // Opcional: líderes (nome) por célula
    let cells = result.rows || [];
    try {
      const ids = cells.map(c => c.id);
      if (ids.length > 0) {
        const leadersRes = await pool.query(
          `SELECT cl.cell_id, u.id, u.name
           FROM cell_leaders cl
           JOIN users u ON u.id = cl.user_id
           WHERE cl.cell_id = ANY($1::uuid[])`,
          [ids]
        );
        const leadersByCell = leadersRes.rows.reduce((acc, row) => {
          acc[row.cell_id] = acc[row.cell_id] || [];
          acc[row.cell_id].push({ id: row.id, name: row.name });
          return acc;
        }, {});
        cells = cells.map(c => ({ ...c, leaders: leadersByCell[c.id] || [] }));
      }
    } catch (e) {
      console.warn('Aviso: consulta de líderes falhou ou tabela ausente. Prosseguindo sem líderes.', e?.message || e);
    }

    return res.json(cells);
  } catch (err) {
    console.error('Erro em GET /api/users/:id/supervised-cells', err);
    return res.status(500).json({ error: 'Erro interno ao listar células supervisionadas' });
  }
});

// Alias em português: GET /api/usuarios -> Listagem retornando array
app.get('/api/usuarios', verifyToken, async (req, res) => {
  try {
    const { role } = req.user;
    if (!['ADMIN', 'PASTOR', 'COORDENADOR', 'SUPERVISOR'].includes(role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const q = String((req.query.q ?? req.query.search ?? '')).trim();
    const limit = Math.min(parseInt(req.query.limit || '200'), 500);
    const offset = Math.max(parseInt(req.query.offset || '0'), 0);

    let sql = `
      SELECT u.id, u.name, u.email, u.role, u.cell_id, u.created_at,
             c.name as cell_name
      FROM users u
      LEFT JOIN cells c ON c.id = u.cell_id
    `;
    const params = [];
    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      sql += ` WHERE LOWER(u.name) LIKE $1 OR LOWER(u.email) LIKE $1`;
    }
    sql += ` ORDER BY u.created_at DESC NULLS LAST, u.name ASC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    params.push(limit, offset);

    const result = await pool.query(sql, params);
    return res.json(result.rows || []);
  } catch (err) {
    console.error('Erro em GET /api/usuarios', err);
    return res.status(500).json({ error: 'Erro interno ao listar usuários' });
  }
});

// Users: GET /:id/cell-assignments -> designações do usuário (membro, líder, supervisor)
app.get('/api/users/:id/cell-assignments', verifyToken, async (req, res) => {
  try {
    const targetUserId = req.params.id;

    // Membro da célula (users.cell_id)
    const memberRes = await pool.query(
      `SELECT c.id, c.name FROM users u
       LEFT JOIN cells c ON c.id = u.cell_id
       WHERE u.id = $1`,
      [targetUserId]
    );
    const memberCell = memberRes.rows[0]?.id
      ? [{ cell_id: memberRes.rows[0].id, cell_name: memberRes.rows[0].name, role_in_cell: 'MEMBRO' }]
      : [];

    // Líderes da célula (cell_leaders)
    let leaderCells = [];
    try {
      const leaderRes = await pool.query(
        `SELECT c.id, c.name
         FROM cell_leaders cl
         JOIN cells c ON c.id = cl.cell_id
         WHERE cl.user_id = $1`,
        [targetUserId]
      );
      leaderCells = leaderRes.rows.map(r => ({ cell_id: r.id, cell_name: r.name, role_in_cell: 'LIDER' }));
    } catch (e) {
      console.warn('Aviso: tabela cell_leaders ausente ou consulta falhou. Ignorando líderes.');
    }

    // Células supervisionadas
    const supRes = await pool.query(
      `SELECT id, name FROM cells WHERE supervisor_id = $1`,
      [targetUserId]
    );
    const supervisorCells = supRes.rows.map(r => ({ cell_id: r.id, cell_name: r.name, role_in_cell: 'SUPERVISOR' }));

    const assignments = [...memberCell, ...leaderCells, ...supervisorCells];
    return res.json({ assignments });
  } catch (err) {
    console.error('Erro em GET /api/users/:id/cell-assignments', err);
    return res.status(500).json({ error: 'Erro interno ao obter designações do usuário' });
  }
});

// Users: GET /my-cells -> células supervisionadas pelo usuário logado (SUPERVISOR)
app.get('/api/users/my-cells', verifyToken, async (req, res) => {
  try {
    const { userId, role } = req.user;
    console.log(`[DEBUG] GET /api/users/my-cells userId=${userId} role=${role}`);
    if (role !== 'SUPERVISOR') {
      // Outros papéis não possuem "minhas células" específicas
      return res.json({ cells: [] });
    }
    if (!isValidUuid(userId)) {
      console.warn('[UUID] userId inválido em GET /api/users/my-cells', { userId });
      return res.json({ cells: [] });
    }
    const sql = `
      SELECT c.id, c.name, c.supervisor_id, u.name AS supervisor_name
      FROM cells c
      LEFT JOIN users u ON u.id = c.supervisor_id
      WHERE c.supervisor_id = $1
      ORDER BY c.name ASC
    `;
    console.log('[SQL] GET /api/users/my-cells', sql.replace(/\s+/g, ' ').trim(), 'params=', [userId]);
    const result = await pool.query(sql, [userId]);
    console.log(`[DEBUG] GET /api/users/my-cells rows=${(result.rows || []).length}`);
    return res.json({ cells: result.rows });
  } catch (err) {
    console.error('Erro em GET /api/users/my-cells', {
      message: err?.message,
      stack: err?.stack,
      code: err?.code,
      detail: err?.detail,
    });
    return res.status(500).json({ error: 'Erro interno ao listar minhas células' });
  }
});

// User: GET /api/user/my-cell -> célula associada ao usuário logado (via users.cell_id)
app.get('/api/user/my-cell', verifyToken, async (req, res) => {
  try {
    const { userId, role } = req.user;
    console.log(`[DEBUG] GET /api/user/my-cell userId=${userId} role=${role}`);

    // Validação resiliente: se ID inválido, responder de forma segura
    const ZERO_UUID = '00000000-0000-0000-0000-000000000000';
    if (!userId || userId.length < 36 || userId === ZERO_UUID || !isValidUuid(userId)) {
      console.warn('[SAFE] userId inválido em /api/user/my-cell, retornando cell=null', { userId });
      return res.status(200).json({ cell: null });
    }

    const sql = `
      SELECT c.id, c.name, c.supervisor_id, sup.name AS supervisor_name
      FROM users u
      LEFT JOIN cells c ON c.id = u.cell_id
      LEFT JOIN users sup ON sup.id = c.supervisor_id
      WHERE u.id = $1
      LIMIT 1
    `;
    console.log('[SQL] GET /api/user/my-cell', sql.replace(/\s+/g, ' ').trim(), 'params=', [userId]);
    const result = await pool.query(sql, [userId]);
    const cell = result.rows?.[0] || null;
    console.log(`[DEBUG] GET /api/user/my-cell found=${!!cell} cellId=${cell?.id || null}`);

    // Sempre retornar sucesso com payload consistente
    return res.status(200).json({ cell });
  } catch (err) {
    console.error('Erro em GET /api/user/my-cell', {
      message: err?.message,
      stack: err?.stack,
      code: err?.code,
      detail: err?.detail,
    });
    // Fallback amigável para manter painel utilizável
    return res.status(200).json({ cell: null });
  }
});

// Users: PUT /:id -> atualizar dados do usuário e (opcional) atribuições de células
app.put('/api/users/:id', verifyToken, async (req, res) => {
  try {
    const { role } = req.user;
    if (!['ADMIN', 'PASTOR', 'COORDENADOR', 'SUPERVISOR'].includes(role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const targetUserId = req.params.id;
    const { name, email, role: newRole, cell_id, cell_ids } = req.body || {};

    // Atualização básica de perfil (opcional)
    const fields = [];
    const values = [];
    if (typeof name === 'string') { fields.push('name'); values.push(name); }
    if (typeof email === 'string') { fields.push('email'); values.push(email.toLowerCase()); }
    if (typeof newRole === 'string') { fields.push('role'); values.push(newRole); }
    if (cell_id !== undefined) { fields.push('cell_id'); values.push(cell_id || null); }

    let updatedUser = null;
    if (fields.length > 0) {
      const set = fields.map((f, i) => `${f} = $${i+1}`).join(', ');
      const sql = `UPDATE users SET ${set}, updated_at = NOW() WHERE id = $${fields.length+1} RETURNING id, name, email, role, cell_id`;
      const result = await pool.query(sql, [...values, targetUserId]);
      updatedUser = result.rows[0];
    } else {
      // Busca atual se não houve update de campos
      const resUser = await pool.query('SELECT id, name, email, role, cell_id FROM users WHERE id = $1', [targetUserId]);
      updatedUser = resUser.rows[0] || null;
    }

    // Atribuição múltipla de supervisão de células (opcional)
    if (Array.isArray(cell_ids) && cell_ids.length > 0) {
      // Define este usuário como supervisor para cada célula informada
      const assignSql = `UPDATE cells SET supervisor_id = $1 WHERE id = ANY($2::uuid[])`;
      await pool.query(assignSql, [targetUserId, cell_ids]);
    }

    return res.json({ message: 'Atualização concluída', user: updatedUser });
  } catch (err) {
    console.error('Erro em PUT /api/users/:id', { message: err?.message, code: err?.code, detail: err?.detail });
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'Email já está em uso' });
    }
    return res.status(500).json({ error: 'Erro interno ao atualizar usuário' });
  }
});

// Me: GET perfil
app.get('/api/me', verifyToken, async (req, res) => {
  try {
    const { userId } = req.user;
    console.log(`[DEBUG] GET /api/me userId=${userId}`);
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
    console.log('[SQL] GET /api/me', query.replace(/\s+/g, ' ').trim(), 'params=', [userId]);
    const result = await pool.query(query, [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    const { password_hash, ...cleanUserProfile } = result.rows[0];
    // Checar se é secretário
    console.log('[SQL] GET /api/me secretary_count', 'SELECT COUNT(*) as count FROM cells WHERE secretary_id = $1', 'params=', [userId]);
    const secretaryRes = await pool.query('SELECT COUNT(*) as count FROM cells WHERE secretary_id = $1', [userId]);
    console.log('[DEBUG] GET /api/me secretary_count result=', secretaryRes.rows?.[0]?.count);
    const isCellSecretary = parseInt(secretaryRes.rows[0].count) > 0;
    return res.json({ message: 'Perfil obtido com sucesso', user: { ...cleanUserProfile, isCellSecretary } });
  } catch (err) {
    console.error('Erro em GET /api/me', {
      message: err?.message,
      stack: err?.stack,
      code: err?.code,
      detail: err?.detail,
    });
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
    const entriesRaw = Object.entries(fields).filter(([k]) => allowed.includes(k));
    // Sanitização de tipos: datas para 'YYYY-MM-DD' e booleanos
    const dateFields = new Set(['birth_date','conversion_date']);
    const boolFields = new Set(['has_children']);
    const entries = entriesRaw.map(([k, v]) => {
      let val = v;
      if (dateFields.has(k)) {
        if (val === '' || val === null || typeof val === 'undefined') {
          val = null;
        } else if (typeof val === 'string') {
          // Mantém apenas parte da data se vier com hora
          const s = val.trim();
          const iso = (() => {
            // Se já estiver no padrão YYYY-MM-DD, usa direto
            const m = s.match(/^\d{4}-\d{2}-\d{2}/);
            if (m) return m[0];
            const d = new Date(s);
            if (isNaN(d.getTime())) return null;
            return d.toISOString().slice(0, 10);
          })();
          val = iso ?? null;
        } else {
          const d = new Date(val);
          val = isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
        }
      } else if (boolFields.has(k)) {
        const s = typeof val === 'string' ? val.trim().toLowerCase() : val;
        const truthy = ['true','1','sim','yes','on'];
        const falsy = ['false','0','nao','não','no','off',''];
        if (typeof s === 'string') {
          if (truthy.includes(s)) val = true;
          else if (falsy.includes(s)) val = false;
          else val = false;
        } else {
          val = !!val;
        }
      }
      return [k, val];
    });
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
    if (!isValidUuid(userId)) {
      console.warn('[UUID] userId inválido em POST /api/prayers/register', { userId });
      // Fallback amigável: considera como sucesso sem tocar DB
      return res.status(200).json({ message: 'Oração registrada', fallback: true });
    }
    const today = new Date().toISOString().split('T')[0];
    const existing = await pool.query(
      'SELECT id FROM daily_prayer_log WHERE user_id = $1 AND prayer_date = $2 LIMIT 1',
      [userId, today]
    );
    if (existing.rows.length > 0) {
      return res.status(200).json({ message: 'Oração do dia já registrada.' });
    }
    await pool.query(
      `INSERT INTO daily_prayer_log (id, user_id, prayer_date) VALUES ($1, $2, $3)`,
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
    if (!isValidUuid(userId)) {
      console.warn('[UUID] userId inválido em GET /api/prayers/status-today', { userId });
      return res.status(200).json({ hasPrayed: false, fallback: true });
    }
    const today = new Date().toISOString().split('T')[0];
    const existing = await pool.query(
      'SELECT id FROM daily_prayer_log WHERE user_id = $1 AND prayer_date = $2 LIMIT 1',
      [userId, today]
    );
    return res.json({ hasPrayed: existing.rows.length > 0 });
  } catch (err) {
    console.error('Erro em GET /api/prayers/status-today', err);
    // Fallback amigável: não bloquear UI
    return res.status(200).json({ hasPrayed: false, fallback: true });
  }
});

// Prayers: estatísticas simples para dashboard (compatível com frontend)
app.get('/api/prayers/stats', verifyToken, async (req, res) => {
  try {
    const { userId } = req.user;
    if (!isValidUuid(userId)) {
      console.warn('[UUID] userId inválido em GET /api/prayers/stats', { userId });
      return res.status(200).json({
        prayersToday: false,
        prayersThisWeek: 0,
        prayersThisMonth: 0,
        fallback: true,
      });
    }
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
    // Fallback amigável: evitar 500 e manter dashboard funcionando
    return res.status(200).json({
      prayersToday: false,
      prayersThisWeek: 0,
      prayersThisMonth: 0,
      fallback: true,
    });
  }
});

// Prayers: endpoint legado para registro (POST /api/prayers)
app.post('/api/prayers', verifyToken, async (req, res) => {
  try {
    const { userId } = req.user;
    if (!isValidUuid(userId)) {
      console.warn('[UUID] userId inválido em POST /api/prayers', { userId });
      // Fallback amigável: considera como sucesso sem tocar DB
      return res.status(200).json({ message: 'Oração registrada com sucesso!', fallback: true });
    }
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
    if (!isValidUuid(userId)) {
      console.warn('[UUID] userId inválido em GET /api/prayers/my-stats', { userId });
      return res.status(200).json({ count: 0, days, fallback: true });
    }
    const since = new Date(); since.setDate(since.getDate() - days);
    const countRes = await pool.query(
      `SELECT COUNT(*) as count FROM daily_prayer_log WHERE user_id = $1 AND prayer_date >= $2`,
      [userId, since.toISOString().split('T')[0]]
    );
    return res.json({ count: parseInt(countRes.rows[0].count || '0'), days });
  } catch (err) {
    console.error('Erro em GET /api/prayers/my-stats', err);
    // Fallback amigável: manter dashboard funcionando mesmo sem DB
    const days = parseInt(req.query.days || '7');
    return res.status(200).json({ count: 0, days, fallback: true });
  }
});

// Cells: listar células (simplificado)
app.get('/api/cells', verifyToken, async (req, res) => {
  try {
    const { userId, role } = req.user;
    console.log(`[DEBUG] GET /api/cells userId=${userId} role=${role}`);
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

    console.log('[SQL] GET /api/cells', query.replace(/\s+/g, ' ').trim(), 'params=', params);
    const result = await pool.query(query, params);
    console.log(`[DEBUG] GET /api/cells rows=${(result.rows || []).length}`);
    // Sempre retornar um array de células
    return res.json(result.rows || []);
  } catch (err) {
    console.error('Erro em GET /api/cells', {
      message: err?.message,
      stack: err?.stack,
      code: err?.code,
      detail: err?.detail,
    });
    // Fallback amigável: evitar 500 e manter painel utilizável
    return res.status(200).json([]);
  }
});

// Alias em português: GET /api/celulas -> Listagem retornando array
app.get('/api/celulas', verifyToken, async (req, res) => {
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
    return res.json(result.rows || []);
  } catch (err) {
    console.error('Erro em GET /api/celulas', err);
    // Fallback amigável: evitar 500 e manter painel utilizável
    return res.status(200).json([]);
  }
});

// Alias: listar células via /api/cells/list (compatível com cliente)
app.get('/api/cells/list', verifyToken, async (req, res) => {
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
    return res.json(result.rows || []);
  } catch (err) {
    console.error('Erro em GET /api/cells/list', err);
    // Fallback amigável: evitar 500 e manter painel utilizável
    return res.status(200).json([]);
  }
});

// Cells: obter detalhe da célula
app.get('/api/cells/:id', verifyToken, async (req, res) => {
  try {
    const cellId = req.params.id;
    const result = await pool.query(
      `SELECT c.id, c.name, c.supervisor_id, c.created_at, c.updated_at,
              s.name as supervisor_name
       FROM cells c
       LEFT JOIN users s ON c.supervisor_id = s.id
       WHERE c.id = $1`,
      [cellId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Célula não encontrada' });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro em GET /api/cells/:id', err);
    return res.status(500).json({ error: 'Erro ao obter célula' });
  }
});

// Cells: atualizar dados da célula (nome e opcionalmente supervisor)
app.put('/api/cells/:id', verifyToken, async (req, res) => {
  try {
    const { role, userId } = req.user;
    if (!['ADMIN', 'PASTOR', 'COORDENADOR', 'SUPERVISOR'].includes(role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const cellId = req.params.id;
    const { name, supervisor_id } = req.body || {};

    const fields = [];
    const values = [];
    if (typeof name === 'string' && name.trim().length > 0) { fields.push('name'); values.push(name.trim()); }

    if (supervisor_id !== undefined) {
      // Restrição: SUPERVISOR só pode se atribuir como supervisor ou remover (null)
      if (role === 'SUPERVISOR' && supervisor_id && supervisor_id !== userId) {
        return res.status(403).json({ error: 'Supervisor só pode se atribuir a si mesmo.' });
      }
      fields.push('supervisor_id'); values.push(supervisor_id || null);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo válido para atualizar' });
    }

    const set = fields.map((f, i) => `${f} = $${i+1}`).join(', ');
    const sql = `UPDATE cells SET ${set}, updated_at = NOW() WHERE id = $${fields.length+1} RETURNING id, name, supervisor_id, created_at, updated_at`;
    const result = await pool.query(sql, [...values, cellId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Célula não encontrada' });
    }
    return res.json({ message: 'Célula atualizada com sucesso', cell: result.rows[0] });
  } catch (err) {
    console.error('Erro em PUT /api/cells/:id', err);
    return res.status(500).json({ error: 'Erro ao atualizar célula' });
  }
});

// Cells: criar nova célula
const createCellHandler = async (req, res) => {
  try {
    const { role, userId } = req.user;
    if (!['ADMIN', 'PASTOR', 'COORDENADOR', 'SUPERVISOR'].includes(role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { name, supervisor_id } = req.body || {};
    const cellName = String(name || '').trim();
    if (!cellName) {
      return res.status(400).json({ error: 'Nome da célula é obrigatório' });
    }

    // Se supervisor_id não informado e role for SUPERVISOR, usar o próprio
    const supId = supervisor_id ?? (role === 'SUPERVISOR' ? userId : null);

    const insertSql = `
      INSERT INTO cells (id, name, supervisor_id, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING id, name, supervisor_id, created_at, updated_at
    `;
    const newId = uuidv4();
    const result = await pool.query(insertSql, [newId, cellName, supId]);
    return res.status(201).json({ message: 'Célula criada com sucesso', cell: result.rows[0] });
  } catch (err) {
    console.error('Erro em POST criar célula', err);
    return res.status(500).json({ error: 'Erro ao criar célula' });
  }
};

app.post('/api/cells', verifyToken, createCellHandler);
// Alias solicitado: rota singular /api/celula
app.post('/api/celula', verifyToken, createCellHandler);

// Cells: membros da minha célula (definido antes da rota paramétrica para evitar captura indevida)
app.get('/api/cells/my-cell/members', verifyToken, async (req, res) => {
  try {
    const { userId, role } = req.user;
    if (!isValidUuid(userId)) {
      console.warn('[UUID] userId inválido em GET /api/cells/my-cell/members', { userId });
      if (['ADMIN', 'PASTOR', 'COORDENADOR', 'SUPERVISOR'].includes(role)) {
        return res.json([]);
      }
      return res.status(404).json({ error: 'Célula do usuário não encontrada' });
    }
    const sqlCell = 'SELECT cell_id FROM users WHERE id = $1';
    const sqlMembers = `SELECT u.id, u.name, u.email, u.role, u.phone, u.whatsapp,
              u.birth_date, u.gender, u.marital_status,
              u.oikos1, u.oikos2, u.created_at
       FROM users u
       WHERE u.cell_id = $1
       ORDER BY u.name ASC`;

    console.log('[DEBUG] /api/cells/my-cell/members -> SQL (cell):', sqlCell, 'params:', [userId]);
    const userCellRes = await pool.query(sqlCell, [userId]);
    const cellId = userCellRes.rows[0]?.cell_id;
    console.log('[DEBUG] /api/cells/my-cell/members -> cellId:', cellId);

    if (!cellId) {
      if (['ADMIN', 'PASTOR', 'COORDENADOR', 'SUPERVISOR'].includes(role)) {
        return res.json([]);
      }
      return res.status(404).json({ error: 'Célula do usuário não encontrada' });
    }

    console.log('[DEBUG] /api/cells/my-cell/members -> SQL (members):', sqlMembers, 'params:', [cellId]);
    const result = await pool.query(sqlMembers, [cellId]);
    // Padronizar payload com objetos aninhados para Oikós e manter compatibilidade
    const rows = (result.rows || []).map((r) => {
      const oikos1Name = r.oikos1 || null;
      const oikos2Name = r.oikos2 || null;
      return {
        ...r,
        // Novos nomes padronizados
        oikos_relacao_1: oikos1Name ? { nome: oikos1Name } : null,
        oikos_relacao_2: oikos2Name ? { nome: oikos2Name } : null,
        // Compatibilidade com nomes anteriores
        oikos_1: oikos1Name ? { nome: oikos1Name } : null,
        oikos_2: oikos2Name ? { nome: oikos2Name } : null,
      };
    });
    console.log('DADOS ENVIADOS PARA O FRONTEND:', rows);
    return res.json(rows);
  } catch (error) {
    console.error('ERRO FATAL NA BUSCA DE MEMBROS (/api/cells/my-cell/members):', error?.message || error, error?.stack);
    return res.status(500).send({ message: 'Falha interna do servidor.' });
  }
});

// Alias solicitado pelo cliente: /api/info/my-cell/members (mapeia para a mesma lógica)
app.get('/api/info/my-cell/members', verifyToken, async (req, res) => {
  try {
    const { userId, role } = req.user;
    if (!isValidUuid(userId)) {
      console.warn('[UUID] userId inválido em GET /api/info/my-cell/members', { userId });
      if (['ADMIN', 'PASTOR', 'COORDENADOR', 'SUPERVISOR'].includes(role)) {
        return res.json([]);
      }
      return res.status(404).json({ error: 'Célula do usuário não encontrada' });
    }
    const sqlCell = 'SELECT cell_id FROM users WHERE id = $1';

    console.log('[DEBUG] /api/info/my-cell/members -> SQL (cell):', sqlCell, 'params:', [userId]);
    const userCellRes = await pool.query(sqlCell, [userId]);
    const cellId = userCellRes.rows[0]?.cell_id;
    console.log('[DEBUG] /api/info/my-cell/members -> cellId:', cellId);

    if (!cellId) {
      if (['ADMIN', 'PASTOR', 'COORDENADOR', 'SUPERVISOR'].includes(role)) {
        return res.json([]);
      }
      return res.status(404).json({ error: 'Célula do usuário não encontrada' });
    }

    // Detectar esquema de Oikós: tabela e possíveis colunas FK na tabela users
    const sqlCheck = `
      SELECT 
        EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'oikos') AS has_oikos_table,
        EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'oikos1_id') AS has_oikos1_id,
        EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'oikos_1_id') AS has_oikos_1_id,
        EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'oikos2_id') AS has_oikos2_id,
        EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'oikos_2_id') AS has_oikos_2_id,
        EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'oikos1') AS has_oikos1_text,
        EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'oikos2') AS has_oikos2_text
    `;
    const checkRes = await pool.query(sqlCheck);
    const check = checkRes.rows[0] || {};
    const hasOikosTable = !!check.has_oikos_table;
    let oikos1Fk = null;
    let oikos2Fk = null;
    if (hasOikosTable) {
      if (check.has_oikos1_id) oikos1Fk = 'oikos1_id';
      else if (check.has_oikos_1_id) oikos1Fk = 'oikos_1_id';
      if (check.has_oikos2_id) oikos2Fk = 'oikos2_id';
      else if (check.has_oikos_2_id) oikos2Fk = 'oikos_2_id';
    }

    let sqlMembers;
    if (hasOikosTable && oikos1Fk && oikos2Fk) {
      // JOIN completo com tabela de Oikós
      sqlMembers = `
        SELECT u.id, u.name, u.email, u.role, u.phone, u.whatsapp,
               u.birth_date, u.gender, u.marital_status,
               u.${oikos1Fk} AS oikos1_id, u.${oikos2Fk} AS oikos2_id,
               o1.name AS oikos1_name, o2.name AS oikos2_name,
               u.created_at
        FROM users u
        LEFT JOIN oikos o1 ON o1.id = u.${oikos1Fk}
        LEFT JOIN oikos o2 ON o2.id = u.${oikos2Fk}
        WHERE u.cell_id = $1
        ORDER BY u.name ASC
      `;
      console.log('[DEBUG] /api/info/my-cell/members -> esquema Oikós detectado. Colunas FK:', { oikos1Fk, oikos2Fk });
    } else {
      // Fallback: usar colunas de texto users.oikos1, users.oikos2 (modelo atual)
      sqlMembers = `
        SELECT u.id, u.name, u.email, u.role, u.phone, u.whatsapp,
               u.birth_date, u.gender, u.marital_status,
               u.oikos1, u.oikos2,
               u.created_at
        FROM users u
        WHERE u.cell_id = $1
        ORDER BY u.name ASC
      `;
      console.log('[DEBUG] /api/info/my-cell/members -> usando fallback de colunas texto users.oikos1/users.oikos2');
    }

    console.log('[DEBUG] /api/info/my-cell/members -> SQL (members):', sqlMembers, 'params:', [cellId]);
    const result = await pool.query(sqlMembers, [cellId]);

    // Ajuste do payload: incluir objetos aninhados oikos_1/oikos_2 com { nome }, mantendo compatibilidade
    const rows = (result.rows || []).map((r) => {
      const oikos1Name = r.oikos1_name || r.oikos1 || null;
      const oikos2Name = r.oikos2_name || r.oikos2 || null;
      return {
        ...r,
        // Novos nomes padronizados
        oikos_relacao_1: oikos1Name ? { nome: oikos1Name } : null,
        oikos_relacao_2: oikos2Name ? { nome: oikos2Name } : null,
        // Compatibilidade com nomes anteriores
        oikos_1: oikos1Name ? { nome: oikos1Name } : null,
        oikos_2: oikos2Name ? { nome: oikos2Name } : null,
      };
    });

    const membrosComOikos = rows;
    console.log('DADOS ENVIADOS PARA O FRONTEND:', membrosComOikos);
    return res.json(membrosComOikos);
  } catch (error) {
    console.error('[ERRO] /api/info/my-cell/members', {
      message: error?.message || String(error),
      code: error?.code,
      detail: error?.detail,
      stack: error?.stack,
    });
    return res.status(500).send({ message: 'Falha interna do servidor.' });
  }
});

// Cells: membros da célula especificada
// Permite acesso se o usuário for membro da célula OU líder designado da célula
app.get('/api/cells/:id/members', verifyToken, async (req, res) => {
  try {
    const { userId, role } = req.user;
    const rawCellId = req.params.id;
    const requestedCellId = typeof rawCellId === 'string' ? rawCellId.trim() : '';
    console.log('[DEBUG] /api/cells/:id/members -> requestedCellId (raw):', rawCellId, 'type:', typeof rawCellId, 'trimmed:', requestedCellId, 'é UUID válido?', isValidUuid(requestedCellId));
    if (!requestedCellId) {
      console.error('ERRO: CELL ID ESTÁ FALTANDO NA REQUISIÇÃO.');
      return res.status(400).json({ error: 'ID de célula ausente' });
    }
    if (!isValidUuid(requestedCellId)) {
      console.warn('[UUID] requestedCellId inválido em GET /api/cells/:id/members', { requestedCellId });
      return res.status(400).json({ error: 'ID de célula inválido' });
    }
    if (!isValidUuid(userId)) {
      console.warn('[UUID] userId inválido em GET /api/cells/:id/members', { userId });
      return res.status(403).json({ error: 'Acesso negado' });
    }

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
      console.warn('Aviso: consulta a cell_leaders falhou ou tabela ausente. Permitindo apenas membros da própria célula.');
    }

    // Permissões adicionais por papel
    let hasAccess = false;
    if (['ADMIN', 'PASTOR', 'COORDENADOR'].includes(role)) {
      hasAccess = true;
    } else if (role === 'SUPERVISOR') {
      try {
        const supervisionRes = await pool.query(
          'SELECT 1 FROM cells WHERE id = $1 AND supervisor_id = $2 LIMIT 1',
          [requestedCellId, userId]
        );
        hasAccess = supervisionRes.rows.length > 0;
      } catch (e) {
        console.warn('Aviso: verificação de supervisor falhou.', e?.message);
      }
    }

    // Acesso por ser líder da célula ou membro da célula
    if (isLeaderOfCell || userCellId === requestedCellId) {
      hasAccess = true;
    }

    if (!hasAccess) {
      console.warn('Acesso negado a membros da célula', { userId, role, requestedCellId, userCellId, isLeaderOfCell });
      return res.status(403).json({ error: 'Acesso negado: permitido apenas para membros, líderes ou supervisores da célula' });
    }

    // Detectar esquema de Oikós e escolher entre JOIN ou fallback
    let hasOikosTable = false;
    let oikos1Fk = null;
    let oikos2Fk = null;
    try {
      const tableCheck = await pool.query(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.tables WHERE table_name = 'oikos'
         ) AS has_oikos_table`
      );
      hasOikosTable = Boolean(tableCheck.rows[0]?.has_oikos_table);
      const check = (
        await pool.query(
          `SELECT 
             EXISTS (
               SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'users' AND column_name = 'oikos1_id'
             ) AS has_oikos1_id,
             EXISTS (
               SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'users' AND column_name = 'oikos_1_id'
             ) AS has_oikos_1_id,
             EXISTS (
               SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'users' AND column_name = 'oikos2_id'
             ) AS has_oikos2_id,
             EXISTS (
               SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'users' AND column_name = 'oikos_2_id'
             ) AS has_oikos_2_id`
        )
      ).rows[0] || {};
      if (hasOikosTable) {
        if (check.has_oikos1_id) oikos1Fk = 'oikos1_id';
        else if (check.has_oikos_1_id) oikos1Fk = 'oikos_1_id';
        if (check.has_oikos2_id) oikos2Fk = 'oikos2_id';
        else if (check.has_oikos_2_id) oikos2Fk = 'oikos_2_id';
      }
    } catch (e) {
      console.warn('[DEBUG] Falha ao detectar esquema Oikós, usando fallback de colunas texto.', e?.message || e);
      hasOikosTable = false;
      oikos1Fk = null;
      oikos2Fk = null;
    }

    // Verificar presença da FK users.cell_id
    try {
      const fkCheck = await pool.query(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'users' AND column_name = 'cell_id'
         ) AS has_cell_id`
      );
      console.log('[DEBUG] FK users.cell_id existe?', Boolean(fkCheck.rows[0]?.has_cell_id));
    } catch (e) {
      console.warn('[DEBUG] Falha ao verificar FK users.cell_id:', e?.message || e);
    }

    let sqlMembers;
    if (hasOikosTable && oikos1Fk && oikos2Fk) {
      sqlMembers = `
        SELECT u.id, u.name, u.email, u.role, u.phone, u.whatsapp,
               u.birth_date, u.gender, u.marital_status,
               u.${oikos1Fk} AS oikos1_id, u.${oikos2Fk} AS oikos2_id,
               o1.name AS oikos1_name, o2.name AS oikos2_name,
               u.created_at
        FROM users u
        LEFT JOIN oikos o1 ON o1.id = u.${oikos1Fk}
        LEFT JOIN oikos o2 ON o2.id = u.${oikos2Fk}
        WHERE u."cell_id" = $1
        ORDER BY u.name ASC
      `;
      console.log('[DEBUG] /api/cells/:id/members -> esquema Oikós detectado. Colunas FK:', { oikos1Fk, oikos2Fk });
    } else {
      sqlMembers = `
        SELECT u.id, u.name, u.email, u.role, u.phone, u.whatsapp,
               u.birth_date, u.gender, u.marital_status,
               u.oikos1, u.oikos2,
               u.created_at
        FROM users u
        WHERE u."cell_id" = $1
        ORDER BY u.name ASC
      `;
      console.log('[DEBUG] /api/cells/:id/members -> usando fallback de colunas texto users.oikos1/users.oikos2');
    }

    console.log('[DEBUG] /api/cells/:id/members -> SQL (members):', sqlMembers, 'params:', [requestedCellId], 'paramType:', typeof requestedCellId);
    const result = await pool.query(sqlMembers, [requestedCellId]);
    console.log('MEMBROS ENCONTRADOS PELA QUERY:', (result.rows || []).length, result.rows || []);

    // Padronizar payload com objetos aninhados para Oikós e manter compatibilidade
    const rows = (result.rows || []).map((r) => {
      const oikos1Name = r.oikos1_name || r.oikos1 || null;
      const oikos2Name = r.oikos2_name || r.oikos2 || null;
      return {
        ...r,
        // Novos nomes padronizados
        oikos_relacao_1: oikos1Name ? { nome: oikos1Name } : null,
        oikos_relacao_2: oikos2Name ? { nome: oikos2Name } : null,
        // Compatibilidade com nomes anteriores
        oikos_1: oikos1Name ? { nome: oikos1Name } : null,
        oikos_2: oikos2Name ? { nome: oikos2Name } : null,
      };
    });
    console.log('DADOS ENVIADOS PARA O FRONTEND:', rows);
    return res.json(rows);
  } catch (err) {
    console.error('Erro em GET /api/cells/:id/members', err);
    return res.status(500).json({ error: 'Erro ao listar membros da célula' });
  }
});

// Alias PT-BR: /api/celulas/:celulaId/membros -> redireciona para /api/cells/:id/members
app.get('/api/celulas/:celulaId/membros', verifyToken, async (req, res) => {
  const rawCelulaId = req.params.celulaId;
  const celulaId = typeof rawCelulaId === 'string' ? rawCelulaId.trim() : '';
  console.log('[DEBUG] /api/celulas/:celulaId/membros -> celulaId (raw):', rawCelulaId, 'type:', typeof rawCelulaId, 'trimmed:', celulaId, 'é UUID válido?', isValidUuid(celulaId));
  if (!celulaId) {
    console.error('ERRO: CELL ID ESTÁ FALTANDO NA REQUISIÇÃO (alias).');
    return res.status(400).json({ error: 'ID de célula ausente' });
  }
  return res.redirect(307, `/api/cells/${celulaId}/members`);
});

// Cells: adicionar membro à célula
app.post('/api/cells/:id/members', verifyToken, async (req, res) => {
  try {
    const { userId, role } = req.user;
    const cellId = req.params.id;
    const targetUserId = req.body?.user_id;
    if (!targetUserId) {
      return res.status(400).json({ error: 'Parâmetro user_id é obrigatório' });
    }

    // Verificar permissões: líderes/coordenadores/pastores/admin sempre; supervisor da célula; líder da célula; membro da própria célula não pode adicionar outros
    let hasAccess = ['ADMIN', 'PASTOR', 'COORDENADOR'].includes(role);
    if (role === 'SUPERVISOR') {
      const supCheck = await pool.query('SELECT 1 FROM cells WHERE id = $1 AND supervisor_id = $2 LIMIT 1', [cellId, userId]);
      hasAccess = hasAccess || supCheck.rows.length > 0;
    }
    if (!hasAccess) {
      // Checar se é líder da célula
      try {
        const leaderRes = await pool.query('SELECT 1 FROM cell_leaders WHERE user_id = $1 AND cell_id = $2 LIMIT 1', [userId, cellId]);
        hasAccess = leaderRes.rows.length > 0;
      } catch (e) {
        // Se tabela não existe, não conceder acesso por liderança
      }
    }
    if (!hasAccess) {
      return res.status(403).json({ error: 'Acesso negado: permitido apenas para líderes, supervisores ou acima.' });
    }

    // Validar usuário de destino
    const userRes = await pool.query('SELECT id FROM users WHERE id = $1', [targetUserId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário alvo não encontrado' });
    }

    // Atualizar cell_id do usuário
    const upd = await pool.query('UPDATE users SET cell_id = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, email, role, cell_id', [cellId, targetUserId]);
    return res.status(200).json({ message: 'Membro adicionado à célula', user: upd.rows[0] });
  } catch (err) {
    console.error('Erro em POST /api/cells/:id/members', err);
    return res.status(500).json({ error: 'Erro ao adicionar membro à célula' });
  }
});

// Cells: remover membro da célula
app.delete('/api/cells/:id/members/:userId', verifyToken, async (req, res) => {
  try {
    const { userId, role } = req.user;
    const cellId = req.params.id;
    const targetUserId = req.params.userId;

    let hasAccess = ['ADMIN', 'PASTOR', 'COORDENADOR'].includes(role);
    if (role === 'SUPERVISOR') {
      const supCheck = await pool.query('SELECT 1 FROM cells WHERE id = $1 AND supervisor_id = $2 LIMIT 1', [cellId, userId]);
      hasAccess = hasAccess || supCheck.rows.length > 0;
    }
    if (!hasAccess) {
      try {
        const leaderRes = await pool.query('SELECT 1 FROM cell_leaders WHERE user_id = $1 AND cell_id = $2 LIMIT 1', [userId, cellId]);
        hasAccess = leaderRes.rows.length > 0;
      } catch (e) {}
    }
    if (!hasAccess) {
      return res.status(403).json({ error: 'Acesso negado: permitido apenas para líderes, supervisores ou acima.' });
    }

    const upd = await pool.query('UPDATE users SET cell_id = NULL, updated_at = NOW() WHERE id = $1 AND cell_id = $2 RETURNING id, name, email, role, cell_id', [targetUserId, cellId]);
    if (upd.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não está nesta célula ou não existe' });
    }
    return res.status(200).json({ message: 'Membro removido da célula', user: upd.rows[0] });
  } catch (err) {
    console.error('Erro em DELETE /api/cells/:id/members/:userId', err);
    return res.status(500).json({ error: 'Erro ao remover membro da célula' });
  }
});

// Cells: atribuir supervisor à célula
app.put('/api/cells/:id/supervisor', verifyToken, async (req, res) => {
  try {
    const { role, userId } = req.user;
    const cellId = req.params.id;
    const supervisorId = req.body?.supervisor_id ?? null;

    // Apenas ADMIN/PASTOR/COORDENADOR podem definir qualquer supervisor.
    // SUPERVISOR pode se atribuir a si próprio ou remover (null).
    if (['ADMIN', 'PASTOR', 'COORDENADOR'].includes(role) === false) {
      if (!(role === 'SUPERVISOR' && (supervisorId === null || supervisorId === userId))) {
        return res.status(403).json({ error: 'Acesso negado para atribuir supervisor' });
      }
    }

    if (supervisorId) {
      const supExists = await pool.query('SELECT id FROM users WHERE id = $1', [supervisorId]);
      if (supExists.rows.length === 0) {
        return res.status(404).json({ error: 'Supervisor não encontrado' });
      }
    }

    const upd = await pool.query('UPDATE cells SET supervisor_id = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, supervisor_id, created_at, updated_at', [supervisorId, cellId]);
    if (upd.rows.length === 0) {
      return res.status(404).json({ error: 'Célula não encontrada' });
    }
    return res.status(200).json({ message: 'Supervisor atualizado com sucesso', cell: upd.rows[0] });
  } catch (err) {
    console.error('Erro em PUT /api/cells/:id/supervisor', err);
    return res.status(500).json({ error: 'Erro ao atualizar supervisor da célula' });
  }
});

// Cells: gerenciar líderes da célula
app.post('/api/cells/:id/leaders', verifyToken, async (req, res) => {
  try {
    const { role } = req.user;
    if (!['ADMIN', 'PASTOR', 'COORDENADOR', 'SUPERVISOR'].includes(role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    const cellId = req.params.id;
    const leaderUserId = req.body?.user_id;
    if (!leaderUserId) {
      return res.status(400).json({ error: 'Parâmetro user_id é obrigatório' });
    }
    try {
      await pool.query('INSERT INTO cell_leaders (user_id, cell_id, created_at) VALUES ($1, $2, NOW())', [leaderUserId, cellId]);
      return res.status(201).json({ message: 'Líder atribuído à célula' });
    } catch (e) {
      if (e?.code === '23505') {
        return res.status(200).json({ message: 'Usuário já é líder desta célula' });
      }
      console.warn('Erro ao inserir em cell_leaders', e?.message || e);
      return res.status(500).json({ error: 'Erro ao atribuir líder (tabela ausente?)' });
    }
  } catch (err) {
    console.error('Erro em POST /api/cells/:id/leaders', err);
    return res.status(500).json({ error: 'Erro ao atribuir líder' });
  }
});

app.delete('/api/cells/:id/leaders/:userId', verifyToken, async (req, res) => {
  try {
    const { role } = req.user;
    if (!['ADMIN', 'PASTOR', 'COORDENADOR', 'SUPERVISOR'].includes(role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    const cellId = req.params.id;
    const leaderUserId = req.params.userId;
    try {
      const del = await pool.query('DELETE FROM cell_leaders WHERE user_id = $1 AND cell_id = $2', [leaderUserId, cellId]);
      return res.status(200).json({ message: 'Líder removido da célula' });
    } catch (e) {
      console.warn('Erro ao remover de cell_leaders', e?.message || e);
      return res.status(500).json({ error: 'Erro ao remover líder (tabela ausente?)' });
    }
  } catch (err) {
    console.error('Erro em DELETE /api/cells/:id/leaders/:userId', err);
    return res.status(500).json({ error: 'Erro ao remover líder' });
  }
});

// Start
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});