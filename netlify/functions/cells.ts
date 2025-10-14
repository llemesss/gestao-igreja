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
    'Access-Control-Allow-Origin': '*',
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
    const path = event.path.replace('/.netlify/functions/cells', '');
    const method = event.httpMethod;

    // GET / -> Listar células baseado no role
    if (path === '' && method === 'GET') {
      const { userId, role } = user;
      
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
            WHERE c.supervisor_id = $1
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
            WHERE c.id IN (SELECT cell_id FROM cell_leaders WHERE user_id = $1)
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
            WHERE c.id = (SELECT cell_id FROM users WHERE id = $1)
            GROUP BY c.id, c.name, c.supervisor_id, c.created_at, c.updated_at, s.name
            ORDER BY c.name ASC
          `;
          params = [userId];
          break;

        default:
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Role não reconhecido' })
          };
      }

      const result = await pool.query(query, params);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.rows)
      };
    }

    // GET /:id -> Obter célula específica
    if (path.match(/^\/[a-f0-9-]+$/) && method === 'GET') {
      const cellId = path.substring(1);
      
      const result = await pool.query(`
        SELECT c.id, c.name, c.supervisor_id, c.created_at, c.updated_at,
               s.name as supervisor_name
        FROM cells c
        LEFT JOIN users s ON c.supervisor_id = s.id
        WHERE c.id = $1
      `, [cellId]);

      if (result.rows.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Célula não encontrada' })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.rows[0])
      };
    }

    // GET /my-cell/members -> Obter membros da própria célula do usuário
    if (path === '/my-cell/members' && method === 'GET') {
      const { userId } = user;
      // Buscar a célula do usuário autenticado
      const userCellRes = await pool.query(
        'SELECT cell_id FROM users WHERE id = $1',
        [userId]
      );

      if (userCellRes.rows.length === 0 || !userCellRes.rows[0].cell_id) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Célula do usuário não encontrada' })
        };
      }

      const cellId = userCellRes.rows[0].cell_id;

      const result = await pool.query(
        `SELECT u.id, u.name, u.email, u.role, u.phone, u.whatsapp,
                u.birth_date, u.gender, u.marital_status,
                u.oikos1, u.oikos2, u.created_at
         FROM users u
         WHERE u.cell_id = $1
         ORDER BY u.name ASC`,
        [cellId]
      );
      // Padronizar payload com objetos aninhados para Oikós e manter compatibilidade
      const rows = (result.rows || []).map((r: any) => {
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
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(rows)
      };
    }

    // GET /:id/members -> Obter membros da célula especificada
    // Permite acesso se o usuário for membro da célula OU líder da célula
    if (path.match(/^\/[a-f0-9-]+\/members$/) && method === 'GET') {
      const requestedCellId = path.split('/')[1];
      const { userId } = user;

      // Verificar se usuário é membro da célula
      const userCellRes = await pool.query(
        'SELECT cell_id FROM users WHERE id = $1',
        [userId]
      );
      const userCellId = userCellRes.rows[0]?.cell_id;

      // Verificar se usuário é líder da célula
      const leaderRes = await pool.query(
        'SELECT 1 FROM cell_leaders WHERE user_id = $1 AND cell_id = $2 LIMIT 1',
        [userId, requestedCellId]
      );
      const isLeaderOfCell = leaderRes.rows.length > 0;

      if (!isLeaderOfCell && userCellId !== requestedCellId) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Acesso negado: permitido apenas para membros ou líderes da própria célula' })
        };
      }

      const result = await pool.query(
        `SELECT u.id, u.name, u.email, u.role, u.phone, u.whatsapp,
                u.birth_date, u.gender, u.marital_status,
                u.oikos1, u.oikos2, u.created_at
         FROM users u
         WHERE u.cell_id = $1
         ORDER BY u.name ASC`,
        [requestedCellId]
      );
      // Padronizar payload com objetos aninhados para Oikós e manter compatibilidade
      const rows = (result.rows || []).map((r: any) => {
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
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(rows)
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Rota não encontrada' })
    };

  } catch (error) {
    console.error('Erro na função cells:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erro interno do servidor' })
    };
  }
};