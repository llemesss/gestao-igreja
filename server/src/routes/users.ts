import express from 'express';
import pool from '../database/connection';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { UserRole } from '../types';

const router = express.Router();

// Aplicar autenticação a todas as rotas
router.use(authenticateToken);

// GET /api/users - Listar todos os usuários (apenas ADMIN)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { role, cell_id, search } = req.query;
    
    let query = `
      SELECT u.id, u.name, u.email, u.role, u.cell_id, u.created_at, u.updated_at,
             c.name as cell_name
      FROM users u
      LEFT JOIN cells c ON u.cell_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 0;

    // Filtros
    if (role) {
      paramCount++;
      query += ` AND u.role = $${paramCount}`;
      params.push(role);
    }

    if (cell_id) {
      paramCount++;
      query += ` AND u.cell_id = $${paramCount}`;
      params.push(cell_id);
    }

    if (search) {
      paramCount++;
      query += ` AND (u.name ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    query += ' ORDER BY u.name ASC';

    const result = await pool.query(query, params);

    res.json({
      users: result.rows.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        cell_id: user.cell_id,
        cell_name: user.cell_name,
        created_at: user.created_at,
        updated_at: user.updated_at
      }))
    });

  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/users/:id - Atualizar usuário (apenas ADMIN)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, cell_id } = req.body;

    // Validar role
    const validRoles: UserRole[] = ['MEMBRO', 'LIDER', 'SUPERVISOR', 'COORDENADOR', 'PASTOR', 'ADMIN'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: 'Role inválido' });
    }

    // Verificar se usuário existe
    const userExists = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userExists.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Verificar se email já está em uso por outro usuário
    if (email) {
      const emailExists = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, id]);
      if (emailExists.rows.length > 0) {
        return res.status(400).json({ error: 'Email já está em uso' });
      }
    }

    // Verificar se célula existe (se fornecida)
    if (cell_id) {
      const cellExists = await pool.query('SELECT id FROM cells WHERE id = $1', [cell_id]);
      if (cellExists.rows.length === 0) {
        return res.status(400).json({ error: 'Célula não encontrada' });
      }
    }

    // Construir query de atualização dinamicamente
    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 0;

    if (name) {
      paramCount++;
      updates.push(`name = $${paramCount}`);
      params.push(name);
    }

    if (email) {
      paramCount++;
      updates.push(`email = $${paramCount}`);
      params.push(email);
    }

    if (role) {
      paramCount++;
      updates.push(`role = $${paramCount}`);
      params.push(role);
    }

    if (cell_id !== undefined) {
      paramCount++;
      updates.push(`cell_id = $${paramCount}`);
      params.push(cell_id || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    paramCount++;
    const query = `
      UPDATE users 
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING id, name, email, role, cell_id, updated_at
    `;
    params.push(id);

    const result = await pool.query(query, params);
    const updatedUser = result.rows[0];

    res.json({
      message: 'Usuário atualizado com sucesso',
      user: updatedUser
    });

  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/users/:id - Desativar usuário (apenas ADMIN)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se usuário existe
    const userExists = await pool.query('SELECT id, name FROM users WHERE id = $1', [id]);
    if (userExists.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Por enquanto, vamos apenas remover o usuário
    // Em produção, você pode querer apenas marcar como inativo
    await pool.query('DELETE FROM users WHERE id = $1', [id]);

    res.json({
      message: 'Usuário removido com sucesso'
    });

  } catch (error) {
    console.error('Erro ao remover usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;