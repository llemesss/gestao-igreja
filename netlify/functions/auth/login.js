// Comando para TRAE: Sobrescrever o arquivo 'netlify/functions/auth/login.js' com este conteúdo.

const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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

  const client = new Client({ 
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    const { email, password } = JSON.parse(event.body);

    if (!email || !password) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email e senha são obrigatórios' }) };
    }
    
    await client.connect();
    
    const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Credenciais inválidas' }) };
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
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
      }),
    };

  } catch (error) {
    console.error('Login Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Ocorreu um erro interno.' }),
    };
  } finally {
    await client.end();
  }
};