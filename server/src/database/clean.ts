import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import pool from './connection';
import initDatabase from './init';

async function cleanDatabase() {
  try {
    console.log('🧹 Limpando banco de dados...');

    // Primeiro, inicializar o banco (criar tabelas)
    await initDatabase();

    // Limpar todos os dados
    pool.query('DELETE FROM prayer_logs');
    pool.query('DELETE FROM cell_leaders');
    pool.query('UPDATE users SET cell_id = NULL');
    pool.query('DELETE FROM cells');
    pool.query('DELETE FROM users');

    // Criar apenas o usuário admin
    const adminId = uuidv4();
    const hashedPassword = await bcrypt.hash('admin123', 10);

    pool.query(`
      INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `, [adminId, 'Administrador', 'admin@igreja.com', hashedPassword, 'ADMIN']);

    console.log('✅ Limpeza concluída com sucesso!');
    console.log('\n📋 Usuário mantido:');
    console.log('👑 Admin: admin@igreja.com / admin123');
    console.log('\n🗑️ Removidos:');
    console.log('- Todas as células');
    console.log('- Todos os membros (exceto admin)');
    console.log('- Todos os líderes de células');
    console.log('- Todos os logs de oração');

  } catch (error) {
    console.error('❌ Erro na limpeza:', error);
  }
}

// Executar limpeza se chamado diretamente
if (require.main === module) {
  cleanDatabase();
}

export default cleanDatabase;