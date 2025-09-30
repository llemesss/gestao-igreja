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

const requireAdmin = (user: AuthUser): boolean => {
  return ['ADMIN', 'PASTOR', 'COORDENADOR'].includes(user.role);
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
    const path = event.path.replace('/.netlify/functions/users', '');
    const method = event.httpMethod;

    // GET /my-cells -> Obter células do usuário logado
    if (path === '/my-cells' && method === 'GET') {
      const { userId, role } = user;
      
      let cells = [];
      
      switch (role) {
        case 'ADMIN':
        case 'PASTOR':
        case 'COORDENADOR':
          // Ver todas as células
          const allCellsResult = await pool.query(`
            SELECT c.id, c.name, c.supervisor_id, c.created_at, c.updated_at,
                   s.name as supervisor_name,
                   COUNT(DISTINCT u.id) as member_count
            FROM cells c
            LEFT JOIN users s ON c.supervisor_id = s.id
            LEFT JOIN users u ON u.cell_id = c.id AND u.status = 'ACTIVE'
            GROUP BY c.id, c.name, c.supervisor_id, c.created_at, c.updated_at, s.name
            ORDER BY c.name
          `);
          cells = allCellsResult.rows;
          break;
          
        case 'SUPERVISOR':
          // Ver células supervisionadas
          const supervisedCellsResult = await pool.query(`
            SELECT c.id, c.name, c.supervisor_id, c.created_at, c.updated_at,
                   s.name as supervisor_name,
                   COUNT(DISTINCT u.id) as member_count
            FROM cells c
            LEFT JOIN users s ON c.supervisor_id = s.id
            LEFT JOIN users u ON u.cell_id = c.id AND u.status = 'ACTIVE'
            WHERE c.supervisor_id = ?
            GROUP BY c.id, c.name, c.supervisor_id, c.created_at, c.updated_at, s.name
            ORDER BY c.name
          `, [userId]);
          cells = supervisedCellsResult.rows;
          break;
          
        case 'LIDER':
          // Ver células que lidera
          const ledCellsResult = await pool.query(`
            SELECT c.id, c.name, c.supervisor_id, c.created_at, c.updated_at,
                   s.name as supervisor_name,
                   COUNT(DISTINCT u.id) as member_count
            FROM cells c
            LEFT JOIN users s ON c.supervisor_id = s.id
            LEFT JOIN users u ON u.cell_id = c.id AND u.status = 'ACTIVE'
            INNER JOIN cell_leaders cl ON c.id = cl.cell_id
            WHERE cl.user_id = ?
            GROUP BY c.id, c.name, c.supervisor_id, c.created_at, c.updated_at, s.name
            ORDER BY c.name
          `, [userId]);
          cells = ledCellsResult.rows;
          break;
          
        case 'MEMBRO':
          // Ver apenas sua própria célula
          const memberCellResult = await pool.query(`
            SELECT c.id, c.name, c.supervisor_id, c.created_at, c.updated_at,
                   s.name as supervisor_name,
                   COUNT(DISTINCT u.id) as member_count
            FROM cells c
            LEFT JOIN users s ON c.supervisor_id = s.id
            LEFT JOIN users u ON u.cell_id = c.id AND u.status = 'ACTIVE'
            INNER JOIN users me ON me.cell_id = c.id
            WHERE me.id = ?
            GROUP BY c.id, c.name, c.supervisor_id, c.created_at, c.updated_at, s.name
          `, [userId]);
          cells = memberCellResult.rows;
          break;
          
        default:
          cells = [];
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(cells)
      };
    }

    // GET / -> Listar todos os usuários (Admin)
    if (path === '' && method === 'GET') {
      if (!requireAdmin(user)) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Acesso negado' })
        };
      }

      const result = await pool.query(`
        SELECT u.id, u.name, u.email, u.role, u.status, u.cell_id, u.created_at,
               c.name as cell_name
        FROM users u
        LEFT JOIN cells c ON u.cell_id = c.id
        ORDER BY u.name
      `);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.rows)
      };
    }

    // GET /:id -> Obter usuário específico
    if (path.match(/^\/[a-f0-9-]+$/) && method === 'GET') {
      const userId = path.substring(1);
      
      const result = await pool.query(`
        SELECT u.id, u.name, u.email, u.role, u.status, u.cell_id, u.created_at,
               u.full_name, u.phone, u.whatsapp, u.gender, u.birth_city, u.birth_state,
               u.birth_date, u.age_group, u.address, u.address_number, u.neighborhood,
               u.zip_code, u.address_reference, u.father_name, u.mother_name,
               u.marital_status, u.spouse_name, u.education_level, u.education_course,
               u.profession, u.conversion_date, u.previous_church, u.transfer_info,
               u.has_children, u.oikos1, u.oikos2,
               c.name as cell_name
        FROM users u
        LEFT JOIN cells c ON u.cell_id = c.id
        WHERE u.id = ?
      `, [userId]);

      if (result.rows.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Usuário não encontrado' })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.rows[0])
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Rota não encontrada' })
    };

  } catch (error) {
    console.error('Erro na função users:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erro interno do servidor' })
    };
  }
};