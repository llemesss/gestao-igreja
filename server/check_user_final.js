const Database = require('better-sqlite3');
const path = require('path');

try {
  // Conectar ao banco de dados SQLite
  const dbPath = path.join(__dirname, '..', 'database.sqlite');
  const db = new Database(dbPath);
  
  console.log('🔍 INVESTIGAÇÃO FINAL - Consulta SQL Direta');
  console.log('='.repeat(50));
  
  // ID do log de erro fornecido pelo usuário
  const targetId = '3c26b970-4c26-4d26-8b6b-4b65269f9171';
  console.log(`📋 Buscando usuário com ID: ${targetId}`);
  
  // Verificar tabelas disponíveis
  console.log('\n📊 Tabelas disponíveis no banco:');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.table(tables);
  
  // Consulta na tabela users (estrutura correta)
  console.log('\n🔎 Consulta SQL Direta na tabela "users":');
  console.log(`SELECT id, name, email, status, cell_id FROM users WHERE id = '${targetId}';`);
  
  try {
    const userQuery = db.prepare('SELECT id, name, email, status, cell_id FROM users WHERE id = ?');
    const user = userQuery.get(targetId);
    
    if (user) {
      console.log('\n✅ RESULTADO - USUÁRIO ENCONTRADO:');
      console.table([user]);
      
      // Analisar o status
      if (user.status === 'ACTIVE') {
        console.log('✅ Status: ATIVO - Usuário está ativo no sistema');
      } else if (user.status === 'INACTIVE') {
        console.log('❌ Status: INATIVO - Este é o problema! Usuário está inativo');
        console.log('\n🔧 SOLUÇÃO: Execute o seguinte comando para reativar:');
        console.log(`UPDATE users SET status = 'ACTIVE' WHERE id = '${targetId}';`);
      }
      
    } else {
      console.log('\n❌ RESULTADO - USUÁRIO NÃO ENCONTRADO');
      console.log('O ID fornecido não existe no banco de dados.');
      
      // Buscar usuários similares
      console.log('\n🔍 Buscando usuários "Lucas" para comparação:');
      const lucasQuery = db.prepare('SELECT id, name, email, status, cell_id FROM users WHERE name LIKE ?');
      const lucasUsers = lucasQuery.all('%Lucas%');
      
      if (lucasUsers.length > 0) {
        console.log('👥 Usuários "Lucas" encontrados:');
        console.table(lucasUsers);
        console.log('\n💡 POSSÍVEL SOLUÇÃO: Use um dos IDs acima no frontend');
      } else {
        console.log('❌ Nenhum usuário "Lucas" encontrado no banco');
      }
    }
    
  } catch (error) {
    console.log('❌ Erro na consulta:', error.message);
  }
  
  // Estatísticas gerais
  console.log('\n📈 Estatísticas do banco:');
  try {
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
    const activeUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE status = ?').get('ACTIVE');
    const inactiveUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE status = ?').get('INACTIVE');
    
    console.log(`Total de usuários: ${totalUsers.count}`);
    console.log(`Usuários ativos: ${activeUsers.count}`);
    console.log(`Usuários inativos: ${inactiveUsers.count}`);
  } catch (error) {
    console.log('❌ Erro ao obter estatísticas:', error.message);
  }
  
  db.close();
  console.log('\n✅ Investigação concluída');
  
} catch (error) {
  console.error('❌ Erro geral:', error);
}