import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL ausente');
    process.exit(1);
  }
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { require: true, rejectUnauthorized: false },
  });

  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@igreja.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const res = await pool.query(
      "SELECT email, password_hash FROM users WHERE email = $1 LIMIT 1",
      [adminEmail.toLowerCase()]
    );
    if (res.rows.length === 0) {
      console.error('Usuário ADMIN não encontrado:', adminEmail);
      process.exit(2);
    }
    const { email, password_hash } = res.rows[0];
    const ok = await bcrypt.compare(adminPassword, password_hash);
    console.log(JSON.stringify({ email, passwordOk: ok }));
  } catch (e) {
    console.error('Erro ao verificar ADMIN:', e?.message || e);
    process.exit(3);
  } finally {
    await pool.end();
  }
}

main();