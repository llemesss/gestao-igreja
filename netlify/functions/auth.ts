import { Handler } from '@netlify/functions';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import pool from './database/connection';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

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

  try {
    const path = event.path.replace('/.netlify/functions/auth', '');
    const method = event.httpMethod;

    // Login
    if (path === '/login' && method === 'POST') {
      const { email, password } = JSON.parse(event.body || '{}');

      if (!email || !password) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Email e senha são obrigatórios' })
        };
      }

      // Buscar usuário
      const result = await pool.query(
        'SELECT id, name, email, password_hash, role, status FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Credenciais inválidas' })
        };
      }

      const user = result.rows[0];

      if (user.status !== 'ACTIVE') {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Usuário inativo' })
        };
      }

      // Verificar senha
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Credenciais inválidas' })
        };
      }

      // Gerar token
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
          }
        })
      };
    }

    // Register
    if (path === '/register' && method === 'POST') {
      const { name, email, password } = JSON.parse(event.body || '{}');

      if (!name || !email || !password) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Nome, email e senha são obrigatórios' })
        };
      }

      // Verificar se usuário já existe
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Email já está em uso' })
        };
      }

      // Hash da senha
      const passwordHash = await bcrypt.hash(password, 10);
      const userId = uuidv4();

      // Criar usuário
      await pool.query(
        `INSERT INTO users (id, name, email, password_hash, role, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'MEMBRO', 'ACTIVE', NOW(), NOW())`,
        [userId, name, email, passwordHash]
      );

      // Gerar token
      const token = jwt.sign(
        { userId, email, role: 'MEMBRO' },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          token,
          user: {
            id: userId,
            name,
            email,
            role: 'MEMBRO'
          }
        })
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Rota não encontrada' })
    };

  } catch (error) {
    console.error('Erro na função auth:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erro interno do servidor' })
    };
  }
};