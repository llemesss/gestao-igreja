const Database = require('better-sqlite3');
const path = require('path');

try {
  const dbPath = path.join(__dirname, 'database.sqlite');
  const db = new Database(dbPath);
  
  console.log('👥 LISTANDO TODOS OS USUÁRIOS NO BANCO DE DADOS');
  console.log('='.repeat(60));
  
  // Listar todos os usuários
  const allUsers = db.prepare('SELECT id, name, email, role, status, cell_id FROM users ORDER BY name').all();
  
  if (allUsers.length > 0) {
    console.log(`📋 Total de usuários encontrados: ${allUsers.length}`);
    console.table(allUsers);
    
    // Procurar especificamente por "Lucas"
    const lucasUsers = allUsers.filter(user => user.name.toLowerCase().includes('lucas'));
    if (lucasUsers.length > 0) {
      console.log('\n🎯 Usuários com "Lucas" no nome:');
      console.table(lucasUsers);
      
      console.log('\n💡 SOLUÇÃO PARA O FRONTEND:');
      lucasUsers.forEach((user, index) => {
        console.log(`${index + 1}. Use o ID: ${user.id} para o usuário "${user.name}"`);
      });
    }
    
  } else {
    console.log('❌ Nenhum usuário encontrado no banco de dados');
    console.log('\n🔧 Criando usuário de teste...');
    
    // Criar usuário de teste com o ID correto
    const testUserId = '3c26b970-4c26-4d26-8b6b-4b65269f9171';
    const insertQuery = db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, status, cell_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    try {
      insertQuery.run(
        testUserId,
        'Lucas Lemes',
        'lucas@igreja.com',
        'hash123',
        'MEMBRO',
        'ACTIVE',
        null
      );
      
      console.log('✅ Usuário de teste criado com sucesso!');
      console.log(`ID: ${testUserId}`);
      console.log('Nome: Lucas Lemes');
      console.log('Status: ACTIVE');
      
    } catch (error) {
      console.log('❌ Erro ao criar usuário de teste:', error.message);
    }
  }
  
  db.close();
  console.log('\n✅ Listagem concluída');
  
} catch (error) {
  console.error('❌ Erro geral:', error);
}