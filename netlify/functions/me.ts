import { Handler } from '@netlify/functions';
import jwt from 'jsonwebtoken';
import pool from './database/connection';

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
    const path = event.path.replace('/.netlify/functions/me', '');
    const method = event.httpMethod;

    // GET / -> Obter dados do perfil do usuário logado
    if (path === '' && method === 'GET') {
      const { userId } = user;

      const query = `
        SELECT 
          u.id, u.name, u.email, u.role, u.cell_id,
          u.full_name, u.phone, u.whatsapp, u.gender, 
          u.birth_city, u.birth_state, u.birth_date,
          u.address, u.address_number, u.neighborhood, u.zip_code, u.address_reference,
          u.father_name, u.mother_name, u.marital_status, u.spouse_name,
          u.education_level, u.profession,
          u.conversion_date, u.transfer_info,
          u.has_children, u.oikos1, u.oikos2,
          u.created_at, u.updated_at,
          c.name as cell_name
        FROM users u
        LEFT JOIN cells c ON u.cell_id = c.id
        WHERE u.id = $1 AND u.status = 'ACTIVE'
      `;

      const result = await pool.query(query, [userId]);

      if (result.rows.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Usuário não encontrado' })
        };
      }

      const userProfile = result.rows[0];

      // Verificar se o usuário é secretário de alguma célula
      const secretaryQuery = `
        SELECT COUNT(*) as count
        FROM cells
        WHERE secretary_id = $1
      `;
      const secretaryResult = await pool.query(secretaryQuery, [userId]);
      const isCellSecretary = parseInt(secretaryResult.rows[0].count) > 0;

      // Remover password_hash da resposta
      const { password_hash, ...cleanUserProfile } = userProfile;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: 'Perfil obtido com sucesso',
          user: {
            ...cleanUserProfile,
            isCellSecretary
          }
        })
      };
    }

    // PUT / -> Atualizar dados do perfil do usuário logado
    if (path === '' && method === 'PUT') {
      const { userId } = user;
      const body = JSON.parse(event.body || '{}');
      
      const {
        name, full_name, phone, whatsapp, gender,
        birth_city, birth_state, birth_date,
        address, address_number, neighborhood, zip_code, address_reference,
        father_name, mother_name, marital_status, spouse_name,
        education_level, education_course, profession, conversion_date, transfer_info,
        has_children, oikos1_name, oikos2_name
      } = body;

      // Construir query de atualização dinamicamente
      const updates: string[] = [];
      const params: any[] = [];

      const fields = {
        name, full_name, phone, whatsapp, gender,
        birth_city, birth_state, birth_date,
        address, address_number, neighborhood, zip_code, address_reference,
        father_name, mother_name, marital_status, spouse_name,
        education_level, education_course, profession, conversion_date, transfer_info,
        has_children, 
        oikos1: oikos1_name, 
        oikos2: oikos2_name
      };

      // Adicionar campos que foram fornecidos
      let paramIndex = 1;
      Object.entries(fields).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          updates.push(`${key} = $${paramIndex}`);
          params.push(value);
          paramIndex++;
        }
      });

      if (updates.length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Nenhum campo para atualizar' })
        };
      }

      // Adicionar updated_at
      updates.push('updated_at = NOW()');
      
      // Adicionar userId para WHERE
      params.push(userId);

      const query = `
        UPDATE users 
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
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
        WHERE u.id = $1
      `;

      const updatedResult = await pool.query(updatedUserQuery, [userId]);
      const updatedUser = updatedResult.rows[0];

      // Remover password_hash da resposta
      const { password_hash, ...userProfile } = updatedUser;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: 'Perfil atualizado com sucesso',
          user: userProfile
        })
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Rota não encontrada' })
    };

  } catch (error) {
    console.error('Erro na função me:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erro interno do servidor' })
    };
  }
};