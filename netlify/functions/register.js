// Local do arquivo: netlify/functions/auth/register.js

const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

exports.handler = async function(event) {
  // O navegador envia uma requisição "preflight" OPTIONS primeiro
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      body: '',
    };
  }

  // Validação do método
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const { name, email, password, confirmPassword } = JSON.parse(event.body);

    // --- Validações ---
    if (!name || !email || !password || !confirmPassword) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Todos os campos são obrigatórios' }) };
    }
    if (password !== confirmPassword) {
      return { statusCode: 400, body: JSON.stringify({ error: 'As senhas não coincidem' }) };
    }
    if (password.length < 6) {
      return { statusCode: 400, body: JSON.stringify({ error: 'A senha deve ter pelo menos 6 caracteres' }) };
    }

    // --- Lógica do Banco de Dados ---
    await client.connect();
    
    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return { statusCode: 409, body: JSON.stringify({ error: 'Este email já está cadastrado' }) };
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const userId = uuidv4();

    const insertQuery = `
      INSERT INTO users (id, name, email, password, role, created_at) 
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING id, name, email, role
    `;
    const result = await client.query(insertQuery, [userId, name, email, hashedPassword, 'member', new Date()]);
    const newUser = result.rows[0];

    return {
      statusCode: 201,
      body: JSON.stringify({ message: 'Usuário criado com sucesso!', user: newUser }),
    };

  } catch (error) {
    console.error('Register Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Erro interno do servidor' }),
    };
  } finally {
    await client.end();
  }
};