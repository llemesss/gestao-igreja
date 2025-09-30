// Função serverless para registro de usuários na Netlify
// Conecta ao banco Neon PostgreSQL, valida dados e cria novo usuário

const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

exports.handler = async function(event) {
  // 1. Validar o método da requisição
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
      },
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  // Tratar requisições OPTIONS (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
      },
      body: ''
    };
  }

  // 2. Obter dados do corpo da requisição
  let name, email, password, confirmPassword;
  
  try {
    const body = JSON.parse(event.body);
    name = body.name;
    email = body.email;
    password = body.password;
    confirmPassword = body.confirmPassword;
  } catch (error) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Invalid JSON in request body' }),
    };
  }

  // 3. Validar dados obrigatórios
  if (!name || !email || !password || !confirmPassword) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Nome, email, senha e confirmação de senha são obrigatórios' }),
    };
  }

  // 4. Validar se as senhas coincidem
  if (password !== confirmPassword) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'As senhas não coincidem' }),
    };
  }

  // 5. Validar formato do email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Formato de email inválido' }),
    };
  }

  // 6. Validar força da senha
  if (password.length < 6) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'A senha deve ter pelo menos 6 caracteres' }),
    };
  }

  // 7. Conectar ao banco de dados Neon
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();

    // 8. Verificar se o email já existe
    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (existingUser.rows.length > 0) {
      return {
        statusCode: 409, // Conflict
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Este email já está cadastrado' }),
      };
    }

    // 9. Hash da senha
    const saltRounds = 10;
    const hashedPassword = bcrypt.hashSync(password, saltRounds);

    // 10. Gerar ID único para o usuário
    const userId = uuidv4();

    // 11. Inserir novo usuário no banco
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

    // 12. Gerar token JWT para o usuário recém-criado
    const token = jwt.sign(
      { 
        userId: newUser.id, 
        email: newUser.email,
        role: newUser.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    // 13. Retornar sucesso com o token e dados do usuário
    return {
      statusCode: 201, // Created
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
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
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Este email já está cadastrado' }),
      };
    }

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Erro interno do servidor' }),
    };
  } finally {
    await client.end();
  }
};