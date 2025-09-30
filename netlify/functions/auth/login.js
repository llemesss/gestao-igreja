// Função serverless para login de usuários na Netlify
// Conecta ao banco Neon PostgreSQL, valida credenciais e retorna JWT

const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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

  // 2. Obter email e senha do corpo da requisição
  let email, password;
  
  try {
    const body = JSON.parse(event.body);
    email = body.email;
    password = body.password;
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

  if (!email || !password) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Email and password are required' }),
    };
  }

  // 3. Conectar ao banco de dados Neon
  const client = new Client({
    connectionString: process.env.DATABASE_URL, // Variável de ambiente do Neon
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();

    // 4. Encontrar o usuário pelo email
    const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      // Usuário não encontrado
      return {
        statusCode: 401, // Unauthorized - mais seguro que 404
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Invalid credentials' }),
      };
    }

    // 5. Comparar a senha enviada com a senha hasheada no banco
    const passwordIsValid = bcrypt.compareSync(password, user.password);

    if (!passwordIsValid) {
      // Senha incorreta
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Invalid credentials' }),
      };
    }

    // 6. Gerar o Token JWT
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        role: user.role,
        cellId: user.cell_id
      },
      process.env.JWT_SECRET, // Variável de ambiente com seu segredo JWT
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    // 7. Retornar sucesso com o token e dados do usuário
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          cellId: user.cell_id
        }
      }),
    };

  } catch (error) {
    console.error('Login Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'An internal server error occurred' }),
    };
  } finally {
    await client.end();
  }
};