const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');
const path = require('path');

async function createTestUsers() {
  let db;
  try {
    console.log('🚀 Criando usuários de teste...');

    // Conectar ao banco SQLite
    const dbPath = path.join(__dirname, 'database.sqlite');
    db = new Database(dbPath);

    // Criar usuário Lucas
    const lucasId = uuidv4();
    const lucasPassword = await bcrypt.hash('lucas123', 10);
    
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(lucasId, 'Lucas Lemes', 'lucas@igreja.com', lucasPassword, 'MEMBRO');

    console.log('✅ Usuário Lucas criado: lucas@igreja.com / lucas123');

    // Criar usuário Igor
    const igorId = uuidv4();
    const igorPassword = await bcrypt.hash('igor123', 10);
    
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(igorId, 'Igor Silva', 'igor@igreja.com', igorPassword, 'LIDER');

    console.log('✅ Usuário Igor criado: igor@igreja.com / igor123');

    // Criar algumas células de teste
    const celula1Id = uuidv4();
    const celula2Id = uuidv4();
    
    db.prepare(`
      INSERT INTO cells (id, name, created_at, updated_at)
      VALUES (?, ?, datetime('now'), datetime('now'))
    `).run(celula1Id, 'Célula 01');

    db.prepare(`
      INSERT INTO cells (id, name, created_at, updated_at)
      VALUES (?, ?, datetime('now'), datetime('now'))
    `).run(celula2Id, 'Célula 02');

    console.log('✅ Células criadas: Célula 01, Célula 02');

    // Associar Lucas à Célula 01
    db.prepare(`
      UPDATE users SET cell_id = ? WHERE id = ?
    `).run(celula1Id, lucasId);

    // Associar Igor à Célula 02 como líder
    db.prepare(`
      UPDATE users SET cell_id = ? WHERE id = ?
    `).run(celula2Id, igorId);

    console.log('✅ Usuários associados às células');

    console.log('\n📋 Resumo dos usuários criados:');
    console.log('👑 Admin: admin@igreja.com / admin123 (ADMIN)');
    console.log('👤 Lucas: lucas@igreja.com / lucas123 (MEMBRO - Célula 01)');
    console.log('👑 Igor: igor@igreja.com / igor123 (LIDER - Célula 02)');

  } catch (error) {
    console.error('❌ Erro ao criar usuários de teste:', error);
  } finally {
    if (db) {
      db.close();
    }
    process.exit(0);
  }
}

createTestUsers();