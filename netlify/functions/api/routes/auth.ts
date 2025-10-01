import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import pool from '../database/connection';
import { User, JWTPayload } from '../types';

export const handler = async (event: any, context: any) => {
	const { httpMethod, path } = event;
	// Netlify Functions: path será algo como '/.netlify/functions/auth' ou '/.netlify/functions/auth/register'
	// Vamos tratar /register e /login
	if (httpMethod === 'POST' && path.endsWith('/register')) {
		try {
			const { name, email, password } = JSON.parse(event.body);
			if (!name || !email || !password) {
				return { statusCode: 400, body: JSON.stringify({ error: 'Nome, email e senha são obrigatórios' }) };
			}
			if (password.length < 6) {
				return { statusCode: 400, body: JSON.stringify({ error: 'Senha deve ter pelo menos 6 caracteres' }) };
			}
			const existingUser = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
			if (existingUser.rows.length > 0) {
				return { statusCode: 400, body: JSON.stringify({ error: 'Email já está em uso' }) };
			}
			const saltRounds = 12;
			const password_hash = await bcrypt.hash(password, saltRounds);
			const userId = uuidv4();
			const result = await pool.query(
				'INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?) RETURNING id, name, email, role',
				[userId, name, email, password_hash, 'MEMBRO']
			);
			const user = result.rows[0];
			const payload: JWTPayload = { userId: user.id, role: user.role };
			const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as any);
			return {
				statusCode: 201,
				body: JSON.stringify({
					message: 'Usuário criado com sucesso',
					user: { id: user.id, name: user.name, email: user.email, role: user.role },
					token
				})
			};
		} catch (error) {
			console.error('Erro no registro:', error);
			return { statusCode: 500, body: JSON.stringify({ error: 'Erro interno do servidor' }) };
		}
	}
	if (httpMethod === 'POST' && path.endsWith('/login')) {
		try {
			const { email, password } = JSON.parse(event.body);
			if (!email || !password) {
				return { statusCode: 400, body: JSON.stringify({ error: 'Email e senha são obrigatórios' }) };
			}
			const result = await pool.query(
				`SELECT u.id, u.name, u.email, u.password_hash, u.role, u.cell_id,
								c.id as cell_table_id, c.name as cell_name
				 FROM users u
				 LEFT JOIN cells c ON u.cell_id = c.id
				 WHERE u.email = ?`,
				[email]
			);
			if (result.rows.length === 0) {
				return { statusCode: 401, body: JSON.stringify({ error: 'Credenciais inválidas' }) };
			}
			const user = result.rows[0];
			const isValidPassword = await bcrypt.compare(password, user.password_hash);
			if (!isValidPassword) {
				return { statusCode: 401, body: JSON.stringify({ error: 'Credenciais inválidas' }) };
			}
			const payload: JWTPayload = { userId: user.id, role: user.role };
			const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as any);
			return {
				statusCode: 200,
				body: JSON.stringify({
					message: 'Login realizado com sucesso',
					user: {
						id: user.id,
						name: user.name,
						email: user.email,
						role: user.role,
						cell_id: user.cell_id,
						cell_name: user.cell_name
					},
					token
				})
			};
		} catch (error) {
			console.error('Erro no login:', error);
			return { statusCode: 500, body: JSON.stringify({ error: 'Erro interno do servidor' }) };
		}
	}
	return { statusCode: 405, body: JSON.stringify({ error: 'Método não permitido' }) };
};