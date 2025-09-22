import express from 'express';
import pool from '../database/connection';
import { authenticateToken } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = express.Router();

// Aplicar autenticação a todas as rotas
router.use(authenticateToken);

// GET /api/me - Obter dados do perfil do usuário logado
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { userId } = req.user!;

    const query = `
      SELECT 
        u.id, u.name, u.email, u.role, u.cell_id,
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
      WHERE u.id = ?
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = result.rows[0];

    // Remover password_hash da resposta
    const { password_hash, ...userProfile } = user;

    res.json({
      message: 'Perfil obtido com sucesso',
      user: userProfile
    });

  } catch (error) {
    console.error('Erro ao obter perfil do usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/me - Atualizar dados do perfil do usuário logado
router.put('/', async (req: AuthRequest, res) => {
  try {
    const { userId } = req.user!;
    const {
      name, full_name, phone, whatsapp, gender,
      birth_city, birth_state, birth_date,
      address, address_number, neighborhood, zip_code, address_reference,
      father_name, mother_name, marital_status, spouse_name,
      education_level, profession, conversion_date, transfer_info,
      has_children, oikos1, oikos2
    } = req.body;

    // Construir query de atualização dinamicamente
    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 0;

    const fields = {
      name, full_name, phone, whatsapp, gender,
      birth_city, birth_state, birth_date,
      address, address_number, neighborhood, zip_code, address_reference,
      father_name, mother_name, marital_status, spouse_name,
      education_level, profession, conversion_date, transfer_info,
      has_children, oikos1, oikos2
    };

    // Adicionar campos que foram fornecidos
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        paramCount++;
        updates.push(`${key} = ?`);
        params.push(value);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    // Adicionar updated_at
    updates.push('updated_at = datetime(\'now\')');
    
    // Adicionar userId para WHERE
    paramCount++;
    params.push(userId);

    const query = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = ?
    `;

    await pool.query(query, params);

    // Buscar dados atualizados
    const updatedUserQuery = `
      SELECT 
        u.id, u.name, u.email, u.role, u.cell_id,
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
      WHERE u.id = ?
    `;

    const updatedResult = await pool.query(updatedUserQuery, [userId]);
    const updatedUser = updatedResult.rows[0];

    // Remover password_hash da resposta
    const { password_hash, ...userProfile } = updatedUser;

    res.json({
      message: 'Perfil atualizado com sucesso',
      user: userProfile
    });

  } catch (error) {
    console.error('Erro ao atualizar perfil do usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;