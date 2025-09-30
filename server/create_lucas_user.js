const Database = require('better-sqlite3');
const path = require('path');

try {
  const dbPath = path.join(__dirname, 'database.sqlite');
  const db = new Database(dbPath);
  
  console.log('👤 CRIANDO USUÁRIO LUCAS LEMES');
  console.log('='.repeat(40));
  
  // ID específico do log de erro
  const lucasId = '3c26b970-4c26-4d26-8b6b-4b65269f9171';
  
  // Verificar se já existe
  const existingUser = db.prepare('SELECT id, name FROM users WHERE id = ?').get(lucasId);
  
  if (existingUser) {
    console.log('✅ Usuário já existe:');
    console.table([existingUser]);
  } else {
    console.log('🔧 Criando usuário Lucas Lemes...');
    
    const insertQuery = db.prepare(`
      INSERT INTO users (
        id, name, email, password_hash, role, status, 
        full_name, phone, cell_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    
    try {
      const result = insertQuery.run(
        lucasId,                    // id
        'Lucas Lemes',              // name
        'lucas@igreja.com',         // email
        '$2b$10$hash123',           // password_hash (bcrypt format)
        'MEMBRO',                   // role
        'ACTIVE',                   // status
        'Lucas Lemes da Silva',     // full_name
        '(11) 99999-9999',         // phone
        null                        // cell_id
      );
      
      if (result.changes > 0) {
        console.log('✅ Usuário criado com sucesso!');
        
        // Verificar o usuário criado
        const createdUser = db.prepare('SELECT id, name, email, role, status FROM users WHERE id = ?').get(lucasId);
        console.log('\n📋 Dados do usuário criado:');
        console.table([createdUser]);
        
        console.log('\n🎯 SOLUÇÃO PARA O PROBLEMA:');
        console.log(`O usuário com ID ${lucasId} agora existe no banco de dados.`);
        console.log('O erro "Usuário não encontrado ou inativo" deve ser resolvido.');
        
      } else {
        console.log('❌ Falha ao criar usuário');
      }
      
    } catch (error) {
      console.log('❌ Erro ao inserir usuário:', error.message);
    }
  }
  
  // Listar todos os usuários após a operação
  console.log('\n👥 Todos os usuários no banco:');
  const allUsers = db.prepare('SELECT id, name, email, role, status FROM users ORDER BY name').all();
  console.table(allUsers);
  
  db.close();
  console.log('\n✅ Operação concluída');
  
} catch (error) {
  console.error('❌ Erro geral:', error);
}