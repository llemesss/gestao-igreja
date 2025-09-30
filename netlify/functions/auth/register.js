// Comando para TRAE: Sobrescrever o arquivo 'netlify/functions/auth/register.js' com este conteúdo.

const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

exports.handler = async function(event) {
  // --- Bloco de Configuração de CORS ---
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };

  // Resposta para a requisição "preflight" do navegador
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204, // No Content
      headers,
      body: '',
    };
  }
  // --- Fim do Bloco de CORS ---

  // Validação do método
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }
  
  try {
    // Obter dados do corpo da requisição
    const { name, email, password, confirmPassword } = JSON.parse(event.body);

    // Validar dados obrigatórios
    if (!name || !email || !password || !confirmPassword) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Nome, email, senha e confirmação de senha são obrigatórios' }),
      };
    }

    // Validar se as senhas coincidem
    if (password !== confirmPassword) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'As senhas não coincidem' }),
      };
    }

    // Validar formato do email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Formato de email inválido' }),
      };
    }

    // Validar força da senha
    if (password.length < 6) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'A senha deve ter pelo menos 6 caracteres' }),
      };
    }

    // Conectar ao banco de dados Neon
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });

    await client.connect();

    // Verificar se o email já existe
    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (existingUser.rows.length > 0) {
      return {
        statusCode: 409, // Conflict
        headers,
        body: JSON.stringify({ error: 'Este email já está cadastrado' }),
      };
    }

    // Hash da senha
    const saltRounds = 10;
    const hashedPassword = bcrypt.hashSync(password, saltRounds);

    // Gerar ID único para o usuário
    const userId = uuidv4();

    // Inserir novo usuário no banco
    const insertQuery = `
      INSERT INTO users (id, name, email, password, role, created_at) 
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING id, name, email, role, created_at
    `;
    
    const result = await client.query(insertQuery, [
      userId,
      name,
      email,
      hashedPassword,
      'member', // Role padrão
      new Date()
    ]);

    const newUser = result.rows[0];

    // Gerar token JWT para o usuário recém-criado
    const token = jwt.sign(
      { 
        userId: newUser.id, 
        email: newUser.email,
        role: newUser.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    // Retornar sucesso com o token e dados do usuário
    return {
      statusCode: 201, // Created
      headers,
      body: JSON.stringify({ 
        message: 'Usuário criado com sucesso',
        token,
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          createdAt: newUser.created_at
        }
      }),
    };

  } catch (error) {
    console.error('Register Error:', error);
    
    // Verificar se é erro de constraint única (email duplicado)
    if (error.code === '23505') {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: 'Este email já está cadastrado' }),
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erro interno do servidor' }),
    };
  } finally {
    await client.end();
  }
};