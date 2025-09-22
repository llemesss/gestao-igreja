import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import pool from './connection';
import initDatabase from './init';

async function seedDatabase() {
  try {
    console.log('🌱 Iniciando seed do banco de dados...');

    // Primeiro, inicializar o banco (criar tabelas)
    await initDatabase();

    // Criar usuário admin de teste
    const adminId = uuidv4();
    const hashedPassword = await bcrypt.hash('admin123', 10);

    pool.query(`
      INSERT OR IGNORE INTO users (id, name, email, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `, [adminId, 'Administrador', 'admin@igreja.com', hashedPassword, 'ADMIN']);

    // Criar usuário pastor de teste
    const pastorId = uuidv4();
    const pastorPassword = await bcrypt.hash('pastor123', 10);

    pool.query(`
      INSERT OR IGNORE INTO users (id, name, email, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `, [pastorId, 'Pastor João', 'pastor@igreja.com', pastorPassword, 'PASTOR']);

    // Criar usuário líder de teste
    const liderId = uuidv4();
    const liderPassword = await bcrypt.hash('lider123', 10);

    pool.query(`
      INSERT OR IGNORE INTO users (id, name, email, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `, [liderId, 'Líder Maria', 'lider@igreja.com', liderPassword, 'LIDER']);

    // Criar usuário membro de teste
    const membroId = uuidv4();
    const membroPassword = await bcrypt.hash('membro123', 10);

    pool.query(`
      INSERT OR IGNORE INTO users (id, name, email, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `, [membroId, 'Membro José', 'membro@igreja.com', membroPassword, 'MEMBRO']);

    console.log('✅ Seed concluído com sucesso!');
    console.log('\n📋 Usuários criados:');
    console.log('👑 Admin: admin@igreja.com / admin123');
    console.log('⛪ Pastor: pastor@igreja.com / pastor123');
    console.log('👥 Líder: lider@igreja.com / lider123');
    console.log('👤 Membro: membro@igreja.com / membro123');

  } catch (error) {
    console.error('❌ Erro no seed:', error);
  }
}

// Executar seed se chamado diretamente
if (require.main === module) {
  seedDatabase();
}

export default seedDatabase;