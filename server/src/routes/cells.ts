import express from 'express';
import { AuthRequest } from '../types';
import pool from '../database/connection';
import { authenticateToken, requireLeaderOrAbove } from '../middleware/auth';

const router = express.Router();

// Debug: Log para verificar se o arquivo está sendo carregado
console.log('🔧 Carregando rotas de células...');
console.log('🔧 Registrando rota POST /:id/members');

// Aplicar autenticação a todas as rotas
router.use(authenticateToken);

// Debug: Middleware para logar todas as requisições nas rotas de células
router.use((req, res, next) => {
  console.log(`🔧 ROTA CÉLULAS: ${req.method} ${req.path}`);
  console.log(`🔧 PARAMS:`, req.params);
  console.log(`🔧 BODY:`, req.body);
  next();
});

// GET /api/cells - Rota inteligente baseada no role
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { userId, role } = req.user!;
    
    let query = '';
    let params: any[] = [];

    switch (role) {
      case 'ADMIN':
      case 'PASTOR':
      case 'COORDENADOR':
        // Ver todas as células
        query = `
          SELECT c.id, c.name, c.supervisor_id, c.created_at, c.updated_at,
                 s.name as supervisor_name,
                 COUNT(DISTINCT u.id) as member_count
          FROM cells c
          LEFT JOIN users s ON c.supervisor_id = s.id
          LEFT JOIN users u ON u.cell_id = c.id AND u.status = 'ACTIVE'
          GROUP BY c.id, c.name, c.supervisor_id, c.created_at, c.updated_at, s.name
          ORDER BY c.name ASC
        `;
        break;

      case 'SUPERVISOR':
        // Ver apenas células que supervisiona
        query = `
          SELECT c.id, c.name, c.supervisor_id, c.created_at, c.updated_at,
                 s.name as supervisor_name,
                 COUNT(DISTINCT u.id) as member_count
          FROM cells c
          LEFT JOIN users s ON c.supervisor_id = s.id
          LEFT JOIN users u ON u.cell_id = c.id AND u.status = 'ACTIVE'
          WHERE c.supervisor_id = ?
          GROUP BY c.id, c.name, c.supervisor_id, c.created_at, c.updated_at, s.name
          ORDER BY c.name ASC
        `;
        params = [userId];
        break;

      case 'LIDER':
        // Ver apenas células que lidera
        query = `
          SELECT c.id, c.name, c.supervisor_id, c.created_at, c.updated_at,
                 s.name as supervisor_name,
                 COUNT(DISTINCT u.id) as member_count
          FROM cells c
          LEFT JOIN users s ON c.supervisor_id = s.id
          LEFT JOIN users u ON u.cell_id = c.id AND u.status = 'ACTIVE'
          WHERE c.id IN (SELECT cell_id FROM cell_leaders WHERE user_id = ?)
          GROUP BY c.id, c.name, c.supervisor_id, c.created_at, c.updated_at, s.name
          ORDER BY c.name ASC
        `;
        params = [userId];
        break;

      case 'MEMBRO':
        // Ver apenas sua própria célula
        query = `
          SELECT c.id, c.name, c.supervisor_id, c.created_at, c.updated_at,
                 s.name as supervisor_name,
                 COUNT(DISTINCT u.id) as member_count
          FROM cells c
          LEFT JOIN users s ON c.supervisor_id = s.id
          LEFT JOIN users u ON u.cell_id = c.id AND u.status = 'ACTIVE'
          WHERE c.id = (SELECT cell_id FROM users WHERE id = ?)
          GROUP BY c.id, c.name, c.supervisor_id, c.created_at, c.updated_at, s.name
          ORDER BY c.name ASC
        `;
        params = [userId];
        break;

      default:
        return res.status(403).json({ error: 'Role não reconhecido' });
    }

    const result = await pool.query(query, params);

    // Buscar líderes para cada célula
    const cellsWithLeaders = await Promise.all(result.rows.map(async (cell: any) => {
      const leadersQuery = `
        SELECT u.id, u.name 
        FROM cell_leaders cl
        JOIN users u ON cl.user_id = u.id
        WHERE cl.cell_id = $1
      `;
      const leadersResult = await pool.query(leadersQuery, [cell.id]);
      
      return {
        id: cell.id,
        name: cell.name,
        supervisor_id: cell.supervisor_id,
        supervisor_name: cell.supervisor_name,
        member_count: parseInt(cell.member_count) || 0,
        leaders: leadersResult.rows.map((leader: any) => ({
          id: leader.id,
          name: leader.name
        })),
        created_at: cell.created_at,
        updated_at: cell.updated_at
      };
    }));

    res.json(cellsWithLeaders);

  } catch (error) {
    console.error('Erro ao listar células:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/cells/:id/members - Adicionar membro a uma célula
router.post('/:id/members', authenticateToken, (req, res, next) => {
  console.log('🔧 Middleware da rota POST /:id/members executado!');
  console.log('🔧 Params:', req.params);
  console.log('🔧 Body:', req.body);
  console.log('🔧 Headers:', req.headers);
  next();
}, requireLeaderOrAbove, async (req: AuthRequest, res) => {
  console.log('🔧 Rota POST /:id/members foi chamada!', req.params, req.body);
  try {
    const { id } = req.params;
    const { user_id } = req.body;
    const { userId, role } = req.user!;

    // Verificar permissão para adicionar membros nesta célula
    let hasPermission = false;

    if (['ADMIN', 'PASTOR', 'COORDENADOR'].includes(role)) {
      hasPermission = true;
    } else if (role === 'SUPERVISOR') {
      const supervisionCheck = await pool.query('SELECT id FROM cells WHERE id = $1 AND supervisor_id = $2', [id, userId]);
      hasPermission = supervisionCheck.rows.length > 0;
    } else if (role === 'LIDER') {
      const leaderCheck = await pool.query('SELECT * FROM cell_leaders WHERE cell_id = $1 AND user_id = $2', [id, userId]);
      hasPermission = leaderCheck.rows.length > 0;
    }

    if (!hasPermission) {
      return res.status(403).json({ error: 'Sem permissão para adicionar membros nesta célula' });
    }

    // Validar dados
    if (!user_id) {
      return res.status(400).json({ error: 'ID do usuário é obrigatório' });
    }

    // Verificar se o usuário existe
    const userCheck = await pool.query(
      'SELECT id, name, role, cell_id FROM users WHERE id = $1',
      [user_id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = userCheck.rows[0];

    // Verificar se o usuário já pertence a uma célula
    if (user.cell_id) {
      return res.status(400).json({ error: 'Usuário já pertence a uma célula' });
    }

    // Verificar se a célula existe
    console.log('🔍 Verificando célula com ID:', id);
    const cellCheck = await pool.query('SELECT id, name FROM cells WHERE id = $1', [id]);
    console.log('🔍 Resultado da consulta:', cellCheck.rows);
    if (cellCheck.rows.length === 0) {
      console.log('❌ Célula não encontrada no banco!');
      return res.status(404).json({ error: 'Célula não encontrada' });
    }
    console.log('✅ Célula encontrada:', cellCheck.rows[0]);

    // Adicionar usuário à célula
    await pool.query('UPDATE users SET cell_id = $1 WHERE id = $2', [id, user_id]);

    res.json({
      message: 'Membro adicionado com sucesso',
      member: {
        id: user.id,
        name: user.name,
        role: user.role
      },
      cell: cellCheck.rows[0]
    });

  } catch (error) {
    console.error('Erro ao adicionar membro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/cells/:id/members - Obter membros de uma célula específica
router.get('/:id/members', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.user!;

    console.log(`🔍 Buscando membros para a Célula ID: ${id}`);
    console.log(`🔍 Usuário solicitante: ${userId}, Role: ${role}`);

    // Validar se o ID foi fornecido
    if (!id || id === 'null' || id === 'undefined') {
      return res.status(400).json({ error: 'ID da célula é obrigatório' });
    }

    // Verificar permissão para ver membros da célula
    let hasPermission = false;

    if (['ADMIN', 'PASTOR', 'COORDENADOR'].includes(role)) {
      hasPermission = true;
    } else if (role === 'SUPERVISOR') {
      const supervisionCheck = await pool.query('SELECT id FROM cells WHERE id = ? AND supervisor_id = ?', [id, userId]);
      hasPermission = supervisionCheck.rows.length > 0;
      console.log(`🔍 Verificação de supervisão: ${supervisionCheck.rows.length > 0}`);
    } else if (role === 'LIDER') {
      const leadershipCheck = await pool.query('SELECT cell_id FROM cell_leaders WHERE cell_id = ? AND user_id = ?', [id, userId]);
      hasPermission = leadershipCheck.rows.length > 0;
      console.log(`🔍 Verificação de liderança: ${leadershipCheck.rows.length > 0}`);
    }

    if (!hasPermission) {
      console.log(`🔍 Sem permissão para ver membros da célula ${id}`);
      return res.status(403).json({ error: 'Sem permissão para ver membros desta célula' });
    }

    // Buscar membros da célula
    const membersQuery = `
      SELECT u.id, u.name, u.email, u.role, u.phone, u.address, u.created_at as joined_at,
             CASE WHEN cl.user_id IS NOT NULL THEN 1 ELSE 0 END as is_leader,
             COALESCE(prayer_stats.prayer_count, 0) as prayer_count,
             prayer_stats.last_prayer_date
      FROM users u
      LEFT JOIN cell_leaders cl ON cl.user_id = u.id AND cl.cell_id = ?
      LEFT JOIN (
        SELECT user_id, 
               COUNT(*) as prayer_count,
               MAX(prayer_date) as last_prayer_date
        FROM daily_prayer_log 
        WHERE prayer_date >= date('now', '-30 days')
        GROUP BY user_id
      ) prayer_stats ON prayer_stats.user_id = u.id
      WHERE u.cell_id = ? AND u.status = 'ACTIVE'
      ORDER BY is_leader DESC, u.name ASC
    `;

    console.log(`🔍 Executando query para buscar membros da célula ${id}`);
    const members = await pool.query(membersQuery, [id, id]);
    console.log(`🔍 Resultado da busca: ${members.rows.length} membros encontrados`);
    
    if (members.rows.length > 0) {
      console.log(`🔍 Primeiros membros encontrados:`, members.rows.slice(0, 2).map(m => ({ id: m.id, name: m.name, cell_id: m.cell_id })));
    }

    res.json(members.rows.map((member: any) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      phone: member.phone,
      address: member.address,
      role: member.role,
      is_leader: member.is_leader === 1,
      prayer_count: member.prayer_count,
      last_prayer: member.last_prayer_date,
      joined_at: member.joined_at
    })));

  } catch (error) {
    console.error('Erro ao buscar membros da célula:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/cells - Criar nova célula (apenas ADMIN)
router.post('/', requireLeaderOrAbove, async (req: AuthRequest, res) => {
  try {
    const { name } = req.body;
    const { role } = req.user!;

    // Verificar se é ADMIN
    if (!['ADMIN', 'PASTOR', 'COORDENADOR'].includes(role)) {
      return res.status(403).json({ error: 'Apenas administradores podem criar células' });
    }

    // Validar dados
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Nome da célula é obrigatório' });
    }

    // Normalizar o nome para verificar duplicatas (tratar 1, 01, 001 como iguais)
    const normalizedName = name.trim().replace(/^0+/, '') || '0';
    
    // Verificar se já existe uma célula com esse nome normalizado
    const existingCellsQuery = `
      SELECT id, name FROM cells 
      WHERE TRIM(name) = $1 
      OR TRIM(name) = $2
    `;
    const existingCell = await pool.query(existingCellsQuery, [normalizedName, name.trim()]);
    
    if (existingCell.rows.length > 0) {
      return res.status(400).json({ 
        error: 'Já existe uma célula com este nome/número (números como 1, 01, 001 são considerados iguais)' 
      });
    }

    // Gerar UUID para a nova célula
    const { v4: uuidv4 } = require('uuid');
    const cellId = uuidv4();

    // Criar a célula
    const result = await pool.query(
      'INSERT INTO cells (id, name) VALUES ($1, $2) RETURNING id, name, created_at, updated_at',
      [cellId, name.trim()]
    );

    const newCell = result.rows[0];

    res.status(201).json({
      message: 'Célula criada com sucesso',
      cell: {
        id: newCell.id,
        name: newCell.name,
        supervisor_id: null,
        supervisor_name: null,
        member_count: 0,
        leaders: [],
        created_at: newCell.created_at,
        updated_at: newCell.updated_at
      }
    });

  } catch (error) {
    console.error('Erro ao criar célula:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/cells/:id/members - Adicionar membro a uma célula
router.post('/:id/members', authenticateToken, (req, res, next) => {
  console.log('🔧 Middleware da rota POST /:id/members executado!');
  console.log('🔧 Params:', req.params);
  console.log('🔧 Body:', req.body);
  console.log('🔧 Headers:', req.headers);
  next();
}, requireLeaderOrAbove, async (req: AuthRequest, res) => {
  console.log('🔧 Rota POST /:id/members foi chamada!', req.params, req.body);
  try {
    const { id } = req.params;
    const { user_id } = req.body;
    const { userId, role } = req.user!;

    // Verificar permissão para adicionar membros nesta célula
    let hasPermission = false;

    if (['ADMIN', 'PASTOR', 'COORDENADOR'].includes(role)) {
      hasPermission = true;
    } else if (role === 'SUPERVISOR') {
      const supervisionCheck = await pool.query('SELECT id FROM cells WHERE id = $1 AND supervisor_id = $2', [id, userId]);
      hasPermission = supervisionCheck.rows.length > 0;
    } else if (role === 'LIDER') {
      const leaderCheck = await pool.query('SELECT * FROM cell_leaders WHERE cell_id = $1 AND user_id = $2', [id, userId]);
      hasPermission = leaderCheck.rows.length > 0;
    }

    if (!hasPermission) {
      return res.status(403).json({ error: 'Sem permissão para adicionar membros nesta célula' });
    }

    // Validar dados
    if (!user_id) {
      return res.status(400).json({ error: 'ID do usuário é obrigatório' });
    }

    // Verificar se o usuário existe
    const userCheck = await pool.query(
      'SELECT id, name, role, cell_id FROM users WHERE id = $1',
      [user_id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = userCheck.rows[0];

    // Verificar se o usuário já pertence a uma célula
    if (user.cell_id) {
      return res.status(400).json({ error: 'Usuário já pertence a uma célula' });
    }

    // Verificar se a célula existe
    const cellCheck = await pool.query('SELECT id, name FROM cells WHERE id = $1', [id]);
    if (cellCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Célula não encontrada' });
    }

    // Adicionar usuário à célula
    await pool.query('UPDATE users SET cell_id = $1 WHERE id = $2', [id, user_id]);

    res.json({
      message: 'Membro adicionado com sucesso',
      member: {
        id: user.id,
        name: user.name,
        role: user.role
      },
      cell: cellCheck.rows[0]
    });

  } catch (error) {
    console.error('Erro ao adicionar membro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/cells/:id/leaders - Designar líder para uma célula
router.post('/:id/leaders', requireLeaderOrAbove, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;
    const { userId, role } = req.user!;

    // Verificar permissão para designar líderes nesta célula
    let hasPermission = false;

    if (['ADMIN', 'PASTOR', 'COORDENADOR'].includes(role)) {
      hasPermission = true;
    } else if (role === 'SUPERVISOR') {
      const supervisionCheck = await pool.query('SELECT id FROM cells WHERE id = $1 AND supervisor_id = $2', [id, userId]);
      hasPermission = supervisionCheck.rows.length > 0;
    }

    if (!hasPermission) {
      return res.status(403).json({ error: 'Sem permissão para designar líderes nesta célula' });
    }

    // Validar dados
    if (!user_id) {
      return res.status(400).json({ error: 'ID do usuário é obrigatório' });
    }

    // Verificar se o usuário existe e está na célula
    const userCheck = await pool.query(
      'SELECT id, name, role, cell_id FROM users WHERE id = $1',
      [user_id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = userCheck.rows[0];

    if (user.cell_id !== id) {
      return res.status(400).json({ error: 'Usuário não pertence a esta célula' });
    }

    // Verificar se já é líder
    const existingLeader = await pool.query(
      'SELECT * FROM cell_leaders WHERE cell_id = $1 AND user_id = $2',
      [id, user_id]
    );

    if (existingLeader.rows.length > 0) {
      return res.status(400).json({ error: 'Usuário já é líder desta célula' });
    }

    // Verificar se o usuário pode ser líder (não pode ser MEMBRO comum)
    if (user.role === 'MEMBRO') {
      // Promover para LIDER se for MEMBRO
      await pool.query('UPDATE users SET role = $1 WHERE id = $2', ['LIDER', user_id]);
    }

    // Designar como líder
    await pool.query(
      'INSERT INTO cell_leaders (cell_id, user_id) VALUES ($1, $2)',
      [id, user_id]
    );

    res.json({
      message: 'Líder designado com sucesso',
      leader: {
        id: user.id,
        name: user.name,
        role: user.role === 'MEMBRO' ? 'LIDER' : user.role
      }
    });

  } catch (error) {
    console.error('Erro ao designar líder:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/cells/:id/leaders/:userId - Remover líder de uma célula
router.delete('/:id/leaders/:userId', requireLeaderOrAbove, async (req: AuthRequest, res) => {
  try {
    const { id, userId: targetUserId } = req.params;
    const { userId, role } = req.user!;

    // Verificar permissão para remover líderes desta célula
    let hasPermission = false;

    if (['ADMIN', 'PASTOR', 'COORDENADOR'].includes(role)) {
      hasPermission = true;
    } else if (role === 'SUPERVISOR') {
      const supervisionCheck = await pool.query('SELECT id FROM cells WHERE id = $1 AND supervisor_id = $2', [id, userId]);
      hasPermission = supervisionCheck.rows.length > 0;
    }

    if (!hasPermission) {
      return res.status(403).json({ error: 'Sem permissão para remover líderes desta célula' });
    }

    // Verificar se é líder da célula
    const leaderCheck = await pool.query(
      'SELECT * FROM cell_leaders WHERE cell_id = $1 AND user_id = $2',
      [id, targetUserId]
    );

    if (leaderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não é líder desta célula' });
    }

    // Verificar quantos líderes a célula tem
    const leadersCount = await pool.query(
      'SELECT COUNT(*) as count FROM cell_leaders WHERE cell_id = $1',
      [id]
    );

    const count = parseInt(leadersCount.rows[0].count);

    // Remover da tabela de líderes
    await pool.query(
      'DELETE FROM cell_leaders WHERE cell_id = $1 AND user_id = $2',
      [id, targetUserId]
    );

    // Se era o único líder e não é supervisor/coordenador/pastor/admin, rebaixar para MEMBRO
    const userInfo = await pool.query('SELECT role FROM users WHERE id = $1', [targetUserId]);
    const userRole = userInfo.rows[0]?.role;

    if (count === 1 && userRole === 'LIDER') {
      await pool.query('UPDATE users SET role = $1 WHERE id = $2', ['MEMBRO', targetUserId]);
    }

    res.json({
      message: 'Líder removido com sucesso'
    });

  } catch (error) {
    console.error('Erro ao remover líder:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/cells/:id/members/:userId - Remover membro de uma célula
router.delete('/:id/members/:userId', requireLeaderOrAbove, async (req: AuthRequest, res) => {
  try {
    const { id, userId: targetUserId } = req.params;
    const { userId, role } = req.user!;

    // Verificar permissão para remover membros desta célula
    let hasPermission = false;

    if (['ADMIN', 'PASTOR', 'COORDENADOR'].includes(role)) {
      hasPermission = true;
    } else if (role === 'SUPERVISOR') {
      const supervisionCheck = await pool.query('SELECT id FROM cells WHERE id = $1 AND supervisor_id = $2', [id, userId]);
      hasPermission = supervisionCheck.rows.length > 0;
    } else if (role === 'LIDER') {
      const leadershipCheck = await pool.query('SELECT cell_id FROM cell_leaders WHERE cell_id = $1 AND user_id = $2', [id, userId]);
      hasPermission = leadershipCheck.rows.length > 0;
    }

    if (!hasPermission) {
      return res.status(403).json({ error: 'Sem permissão para remover membros desta célula' });
    }

    // Verificar se o usuário existe e pertence à célula
    const userCheck = await pool.query(
      'SELECT id, name, role, cell_id FROM users WHERE id = $1',
      [targetUserId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = userCheck.rows[0];

    if (user.cell_id !== id) {
      return res.status(400).json({ error: 'Usuário não pertence a esta célula' });
    }

    // Não permitir remover a si mesmo se for o único líder
    if (targetUserId === userId) {
      const leadersCount = await pool.query(
        'SELECT COUNT(*) as count FROM cell_leaders WHERE cell_id = $1',
        [id]
      );
      const isLeader = await pool.query(
        'SELECT * FROM cell_leaders WHERE cell_id = $1 AND user_id = $2',
        [id, targetUserId]
      );

      if (isLeader.rows.length > 0 && parseInt(leadersCount.rows[0].count) === 1) {
        return res.status(400).json({ error: 'Não é possível remover o único líder da célula' });
      }
    }

    // Remover da liderança se for líder
    await pool.query(
      'DELETE FROM cell_leaders WHERE cell_id = $1 AND user_id = $2',
      [id, targetUserId]
    );

    // Remover da célula (definir cell_id como null)
    await pool.query('UPDATE users SET cell_id = NULL WHERE id = $1', [targetUserId]);

    // Se era líder e não tem outras responsabilidades, rebaixar para MEMBRO
    if (user.role === 'LIDER') {
      // Verificar se ainda é líder de outras células
      const otherLeaderships = await pool.query(
        'SELECT COUNT(*) as count FROM cell_leaders WHERE user_id = $1',
        [targetUserId]
      );

      if (parseInt(otherLeaderships.rows[0].count) === 0) {
        await pool.query('UPDATE users SET role = $1 WHERE id = $2', ['MEMBRO', targetUserId]);
      }
    }

    res.json({
      message: 'Membro removido da célula com sucesso'
    });

  } catch (error) {
    console.error('Erro ao remover membro da célula:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/cells/:id - Atualizar célula (ADMIN, SUPERVISOR ou LÍDER da própria célula)
router.put('/:id', requireLeaderOrAbove, async (req: AuthRequest, res) => {
  const { id } = req.params;
  
  try {
    const { name, description, supervisor_id, leader_ids, secretary_id } = req.body;
    const { role, userId } = req.user!;

    // Log detalhado dos dados recebidos
    console.log('🚨 DADOS RECEBIDOS PARA ATUALIZAR CÉLULA:');
    console.log('🚨 ID da célula:', id);
    console.log('🚨 Body completo:', JSON.stringify(req.body, null, 2));
    console.log('🚨 Usuário:', userId, 'Role:', role);
    console.log('🚨 ========================');

    // Verificar permissões para editar a célula
    let hasPermission = false;

    if (['ADMIN', 'PASTOR', 'COORDENADOR'].includes(role)) {
      hasPermission = true;
    } else if (role === 'SUPERVISOR') {
      // Supervisor pode editar células que supervisiona
      const supervisionCheck = await pool.query('SELECT id FROM cells WHERE id = $1 AND supervisor_id = $2', [id, userId]);
      hasPermission = supervisionCheck.rows.length > 0;
    } else if (role === 'LIDER') {
      // Líder pode editar apenas a célula que lidera
      const leadershipCheck = await pool.query('SELECT cell_id FROM cell_leaders WHERE cell_id = $1 AND user_id = $2', [id, userId]);
      hasPermission = leadershipCheck.rows.length > 0;
    }

    if (!hasPermission) {
      return res.status(403).json({ error: 'Sem permissão para editar esta célula' });
    }

    // Verificar se a célula existe
    const cellCheck = await pool.query('SELECT id, name FROM cells WHERE id = $1', [id]);
    if (cellCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Célula não encontrada' });
    }

    // Construir query de atualização dinamicamente
    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 0;

    // Se o nome foi fornecido, validar e adicionar à atualização
    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: 'Nome da célula é obrigatório' });
      }

      // Normalizar o nome para verificar duplicatas (tratar 1, 01, 001 como iguais)
      const normalizedName = name.trim().replace(/^0+/, '') || '0';
      
      // Verificar se já existe outra célula com esse nome normalizado
      const existingCellsQuery = `
        SELECT id, name FROM cells 
        WHERE (TRIM(name) = $1 OR TRIM(name) = $2)
        AND id != $3
      `;
      const existingCell = await pool.query(existingCellsQuery, [normalizedName, name.trim(), id]);
      
      if (existingCell.rows.length > 0) {
        return res.status(400).json({ 
          error: 'Já existe outra célula com este nome/número (números como 1, 01, 001 são considerados iguais)' 
        });
      }

      paramCount++;
      updates.push(`name = $${paramCount}`);
      params.push(name.trim());
    }

    // Se a descrição foi fornecida, adicionar à atualização
    if (description !== undefined) {
      paramCount++;
      updates.push(`description = $${paramCount}`);
      params.push(description ? description.trim() : null);
    }

    // Se o supervisor_id foi fornecido, validar e adicionar à atualização
    if (supervisor_id !== undefined) {
      if (supervisor_id) {
        // Verificar se o supervisor existe e tem permissão
        const supervisorCheck = await pool.query(
          'SELECT id, role FROM users WHERE id = $1 AND role IN ($2, $3, $4, $5)', 
          [supervisor_id, 'SUPERVISOR', 'COORDENADOR', 'PASTOR', 'ADMIN']
        );
        if (supervisorCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Supervisor não encontrado ou não tem permissão' });
        }
      }
      
      paramCount++;
      updates.push(`supervisor_id = $${paramCount}`);
      params.push(supervisor_id || null);
    }

    // Se o secretary_id foi fornecido, validar e adicionar à atualização
    if (secretary_id !== undefined) {
      if (secretary_id) {
        // Verificar se o secretário existe
        const secretaryCheck = await pool.query(
          'SELECT id FROM users WHERE id = $1', 
          [secretary_id]
        );
        if (secretaryCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Secretário não encontrado' });
        }

        // Verificar se o secretário é membro da célula
        const memberCheck = await pool.query(
          'SELECT id FROM users WHERE id = $1 AND cell_id = $2', 
          [secretary_id, id]
        );
        if (memberCheck.rows.length === 0) {
          return res.status(400).json({ error: 'O secretário deve ser membro da célula' });
        }
      }
      
      paramCount++;
      updates.push(`secretary_id = $${paramCount}`);
      params.push(secretary_id || null);
    }

    // Se há atualizações para fazer
    if (updates.length > 0) {
      paramCount++;
      updates.push(`updated_at = datetime('now')`);
      
      const updateQuery = `UPDATE cells SET ${updates.join(', ')} WHERE id = $${paramCount}`;
      params.push(id);
      
      await pool.query(updateQuery, params);
    }

    // Atualizar líderes da célula se leader_ids foi fornecido
    if (leader_ids !== undefined) {
      console.log('🚨 ATUALIZANDO LÍDERES DA CÉLULA:', leader_ids);
      
      // Primeiro, remover todos os líderes atuais da célula
      await pool.query('DELETE FROM cell_leaders WHERE cell_id = $1', [id]);
      
      // Se há líderes para adicionar
      if (Array.isArray(leader_ids) && leader_ids.length > 0) {
        // Verificar se todos os líderes existem e têm permissão
        for (const leaderId of leader_ids) {
          const leaderCheck = await pool.query(
            'SELECT id, role FROM users WHERE id = $1 AND role IN ($2, $3, $4, $5, $6)', 
            [leaderId, 'LIDER', 'SUPERVISOR', 'COORDENADOR', 'PASTOR', 'ADMIN']
          );
          if (leaderCheck.rows.length === 0) {
            return res.status(400).json({ 
              error: `Líder com ID ${leaderId} não encontrado ou não tem permissão para ser líder` 
            });
          }
        }
        
        // Adicionar os novos líderes
         for (const leaderId of leader_ids) {
           await pool.query(
             'INSERT INTO cell_leaders (cell_id, user_id, created_at) VALUES ($1, $2, datetime(\'now\'))',
             [id, leaderId]
           );
         }
      }
    }

    // Buscar dados atualizados da célula com líderes
    const updatedCellQuery = `
      SELECT c.id, c.name, c.supervisor_id, c.created_at, c.updated_at,
             s.name as supervisor_name,
             COUNT(DISTINCT u.id) as member_count
      FROM cells c
      LEFT JOIN users s ON c.supervisor_id = s.id
      LEFT JOIN users u ON u.cell_id = c.id
      WHERE c.id = $1
      GROUP BY c.id, c.name, c.supervisor_id, c.created_at, c.updated_at, s.name
    `;
    const cellResult = await pool.query(updatedCellQuery, [id]);
    const cell = cellResult.rows[0];

    // Buscar líderes da célula
    const leadersQuery = `
      SELECT u.id, u.name 
      FROM cell_leaders cl
      JOIN users u ON cl.user_id = u.id
      WHERE cl.cell_id = $1
    `;
    const leadersResult = await pool.query(leadersQuery, [id]);

    res.json({
      message: 'Célula atualizada com sucesso',
      cell: {
        id: cell.id,
        name: cell.name,
        supervisor_id: cell.supervisor_id,
        supervisor_name: cell.supervisor_name,
        member_count: parseInt(cell.member_count) || 0,
        leaders: leadersResult.rows.map((leader: any) => ({
          id: leader.id,
          name: leader.name
        })),
        created_at: cell.created_at,
        updated_at: cell.updated_at
      }
    });

  } catch (error) {
    console.error('🚨 FALHA CRÍTICA AO ATUALIZAR CÉLULA:', error);
    console.error('🚨 Stack trace completa:', error instanceof Error ? error.stack : 'Stack não disponível');
    console.error('🚨 Dados da requisição:', { cellId: id, body: req.body, user: req.user?.userId });
    
    // Verificar tipo específico de erro para resposta mais informativa
    if (error instanceof Error) {
      if (error.message.includes('SQLITE_ERROR') || error.message.includes('SqliteError')) {
        console.error('🚨 ERRO DE BANCO DE DADOS SQLite detectado');
        return res.status(500).json({ 
          error: 'Erro de banco de dados', 
          message: 'Falha na operação de atualização da célula' 
        });
      }
      
      if (error.message.includes('not found') || error.message.includes('não encontrado')) {
        return res.status(404).json({ 
          error: 'Célula não encontrada', 
          message: 'A célula especificada não existe' 
        });
      }
    }
    
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Falha inesperada ao atualizar célula'
    });
  }
});

// PUT /api/cells/:id/supervisor - Designar supervisor para uma célula
router.put('/:id/supervisor', requireLeaderOrAbove, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { supervisor_id } = req.body;
    const { role } = req.user!;

    // Apenas ADMIN, PASTOR ou COORDENADOR podem designar supervisores
    if (!['ADMIN', 'PASTOR', 'COORDENADOR'].includes(role)) {
      return res.status(403).json({ error: 'Sem permissão para designar supervisores' });
    }

    // Se supervisor_id for null, remove o supervisor
    if (supervisor_id === null) {
      await pool.query('UPDATE cells SET supervisor_id = NULL WHERE id = $1', [id]);
      return res.json({ message: 'Supervisor removido com sucesso' });
    }

    // Verificar se o usuário existe e pode ser supervisor
    const userCheck = await pool.query(
      'SELECT id, name, role FROM users WHERE id = $1',
      [supervisor_id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = userCheck.rows[0];

    // Verificar se o usuário pode ser supervisor
    if (!['SUPERVISOR', 'COORDENADOR', 'PASTOR', 'ADMIN'].includes(user.role)) {
      return res.status(400).json({ error: 'Usuário não tem permissão para ser supervisor' });
    }

    // Designar supervisor
    await pool.query('UPDATE cells SET supervisor_id = $1 WHERE id = $2', [supervisor_id, id]);

    res.json({
      message: 'Supervisor designado com sucesso',
      supervisor: {
        id: user.id,
        name: user.name,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Erro ao designar supervisor:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Buscar membros da minha célula
router.get('/my-cell-members', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.user!;
    
    // Buscar a célula do usuário
    const userResult = await pool.query(
      'SELECT cell_id FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].cell_id) {
      return res.json([]);
    }

    const cellId = userResult.rows[0].cell_id;

    // Buscar todos os membros da célula (excluindo o próprio usuário)
    const membersResult = await pool.query(`
      SELECT id, name, email, phone, whatsapp, full_name, oikos1, oikos2
      FROM users 
      WHERE cell_id = $1 AND id != $2
      ORDER BY name
    `, [cellId, userId]);

    res.json(membersResult.rows);
  } catch (error) {
    console.error('Erro ao buscar membros da célula:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/cells/members-with-oikos - Buscar membros da célula do usuário com oikos
router.get('/members-with-oikos', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.user!;

    // Buscar dados do usuário para obter o cell_id
    const userResult = await pool.query(`
      SELECT cell_id FROM users WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Usuário não encontrado.' });
    }

    const { cell_id } = userResult.rows[0];

    if (!cell_id) {
      return res.status(200).json([]); // Usuário não pertence a nenhuma célula
    }

    // Buscar membros da célula
    const membersResult = await pool.query(`
      SELECT id, name, oikos1, oikos2
      FROM users 
      WHERE cell_id = $1
      ORDER BY name
    `, [cell_id]);

    // Formatar os dados para incluir apenas name e oikos
    const formattedMembers = membersResult.rows.map((member: any) => {
      const oikos = [];
      if (member.oikos1) oikos.push({ name: member.oikos1 });
      if (member.oikos2) oikos.push({ name: member.oikos2 });
      
      return {
        id: member.id,
        name: member.name,
        oikos: oikos
      };
    });

    res.status(200).json(formattedMembers);

  } catch (error) {
    console.error('Erro ao buscar membros da célula:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// GET /api/cells/:id - Obter detalhes de uma célula específica
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.user!;

    console.log('=== DEBUG GET /cells/:id ===');
    console.log('ID recebido:', id);
    console.log('Tipo do ID:', typeof id);
    console.log('User ID:', userId);
    console.log('User role:', role);

    // Validar se o ID foi fornecido
    if (!id || id === 'null' || id === 'undefined') {
      console.log('ID inválido detectado');
      return res.status(400).json({ error: 'ID da célula é obrigatório' });
    }

    // Verificar permissão para ver a célula
    let hasPermission = false;

    console.log('Verificando permissões...');
    if (['ADMIN', 'PASTOR', 'COORDENADOR'].includes(role)) {
      hasPermission = true;
      console.log('Permissão concedida: role administrativo');
    } else if (role === 'SUPERVISOR') {
      console.log('Verificando supervisão...');
      const supervisionCheck = await pool.query('SELECT id FROM cells WHERE id = $1 AND supervisor_id = $2', [id, userId]);
      hasPermission = supervisionCheck.rows.length > 0;
      console.log('Resultado verificação supervisão:', hasPermission);
    } else if (role === 'LIDER') {
      console.log('Verificando liderança...');
      const leadershipCheck = await pool.query('SELECT cell_id FROM cell_leaders WHERE cell_id = $1 AND user_id = $2', [id, userId]);
      hasPermission = leadershipCheck.rows.length > 0;
      console.log('Resultado verificação liderança:', hasPermission);
    } else if (role === 'MEMBRO') {
      console.log('Verificando membro...');
      const memberCheck = await pool.query('SELECT id FROM users WHERE id = $1 AND cell_id = $2', [userId, id]);
      hasPermission = memberCheck.rows.length > 0;
      console.log('Resultado verificação membro:', hasPermission);
    }

    if (!hasPermission) {
      console.log('Permissão negada');
      return res.status(403).json({ error: 'Sem permissão para ver esta célula' });
    }

    console.log('Executando query da célula...');
    // Buscar detalhes da célula
    const cellQuery = `
      SELECT c.id, c.name, c.supervisor_id, c.created_at, c.updated_at,
             s.name as supervisor_name,
             COUNT(DISTINCT u.id) as member_count
      FROM cells c
      LEFT JOIN users s ON s.id = c.supervisor_id
      LEFT JOIN users u ON u.cell_id = c.id AND u.status = 'ACTIVE'
      WHERE c.id = $1
      GROUP BY c.id, c.name, c.supervisor_id, c.created_at, c.updated_at, s.name
    `;

    const cellResult = await pool.query(cellQuery, [id]);
    console.log('Resultado da query da célula:', cellResult.rows);

    if (cellResult.rows.length === 0) {
      console.log('Célula não encontrada');
      return res.status(404).json({ error: 'Célula não encontrada' });
    }

    const cell = cellResult.rows[0];
    console.log('Dados da célula encontrada:', cell);

    console.log('Executando query dos líderes...');
    // Buscar líderes da célula
    const leadersQuery = `
      SELECT u.id, u.name, u.email
      FROM users u
      INNER JOIN cell_leaders cl ON cl.user_id = u.id
      WHERE cl.cell_id = $1 AND u.status = 'ACTIVE'
      ORDER BY u.name
    `;

    const leadersResult = await pool.query(leadersQuery, [id]);
    console.log('Resultado da query dos líderes:', leadersResult.rows);
    const leaders = leadersResult.rows;

    console.log('Executando query dos membros...');
    // Buscar membros da célula (sem referência à tabela prayers que não existe)
    const membersQuery = `
      SELECT u.id, u.name, u.email, u.phone, u.birth_date, u.role
      FROM users u
      WHERE u.cell_id = $1 AND u.status = 'ACTIVE'
      ORDER BY u.name
    `;

    const membersResult = await pool.query(membersQuery, [id]);
    console.log('Resultado da query dos membros:', membersResult.rows);
    const members = membersResult.rows;

    const response = {
      id: cell.id,
      name: cell.name,
      supervisor_id: cell.supervisor_id,
      supervisor_name: cell.supervisor_name,
      member_count: cell.member_count,
      leaders: leaders,
      members: members, // Adicionando os membros à resposta
      created_at: cell.created_at,
      updated_at: cell.updated_at
    };

    console.log('Resposta final:', response);
    console.log('=== END DEBUG ===');

    res.json(response);

  } catch (error: any) {
    console.error('=== ERRO CAPTURADO ===');
    console.error('Erro completo:', error);
    console.error('Stack trace:', error.stack);
    console.error('Mensagem:', error.message);
    console.error('=== FIM ERRO ===');
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/cells/:id - Excluir célula (apenas ADMIN/PASTOR/COORDENADOR)
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user!;

    console.log('Tentativa de exclusão - ID recebido:', id); // Debug

    // Verificar se o ID é válido
    if (!id || id === 'null' || id === 'undefined') {
      return res.status(400).json({ error: 'ID da célula inválido' });
    }

    // Verificar permissões
    if (!['ADMIN', 'PASTOR', 'COORDENADOR'].includes(role)) {
      return res.status(403).json({ error: 'Sem permissão para excluir células' });
    }

    // Verificar se a célula existe
    const cellCheck = await pool.query('SELECT id FROM cells WHERE id = $1', [id]);
    if (cellCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Célula não encontrada' });
    }

    // Verificar se há membros na célula
    const membersCheck = await pool.query('SELECT COUNT(*) as count FROM users WHERE cell_id = $1', [id]);
    const memberCount = parseInt(membersCheck.rows[0].count);
    
    if (memberCount > 0) {
      return res.status(400).json({ 
        error: `Não é possível excluir a célula. Há ${memberCount} membro(s) vinculado(s) a ela.` 
      });
    }

    // Remover líderes da célula primeiro
    await pool.query('DELETE FROM cell_leaders WHERE cell_id = $1', [id]);

    // Excluir a célula
    await pool.query('DELETE FROM cells WHERE id = $1', [id]);

    res.json({ message: 'Célula excluída com sucesso' });

  } catch (error) {
    console.error('Erro ao excluir célula:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Listar todas as células (para dropdown de admin)
router.get('/list', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { role } = req.user!;
    
    // Verificar se o usuário tem permissão para ver todas as células
    if (!['ADMIN', 'PASTOR', 'COORDENADOR'].includes(role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const result = await pool.query(`
      SELECT id, name
      FROM cells
      ORDER BY name ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao listar células:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});



export default router;