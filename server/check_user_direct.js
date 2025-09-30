const Database = require('better-sqlite3');
const path = require('path');

try {
  // Conectar ao banco de dados SQLite
  const dbPath = path.join(__dirname, '..', 'database.sqlite');
  const db = new Database(dbPath);
  
  console.log('🔍 INVESTIGAÇÃO FINAL - Consulta SQL Direta');
  console.log('='.repeat(50));
  
  // ID do log de erro
  const targetId = '3c26b970-4c26-4d26-8b6b-4b65269f9171';
  console.log(`📋 Buscando usuário com ID: ${targetId}`);
  
  // Primeira tentativa: tabela "users" (SQLite direto)
  console.log('\n🔎 Tentativa 1: Tabela "users"');
  try {
    const userQuery = db.prepare('SELECT id, name, email, status, cell_id FROM users WHERE id = ?');
    const user = userQuery.get(targetId);
    
    if (user) {
      console.log('✅ USUÁRIO ENCONTRADO na tabela "users":');
      console.table([user]);
    } else {
      console.log('❌ Usuário NÃO encontrado na tabela "users"');
    }
  } catch (error) {
    console.log('❌ Erro na tabela "users":', error.message);
  }
  
  // Segunda tentativa: tabela "User" (Prisma style)
  console.log('\n🔎 Tentativa 2: Tabela "User"');
  try {
    const userQuery = db.prepare('SELECT id, name, email, status, "cellId" FROM "User" WHERE id = ?');
    const user = userQuery.get(targetId);
    
    if (user) {
      console.log('✅ USUÁRIO ENCONTRADO na tabela "User":');
      console.table([user]);
    } else {
      console.log('❌ Usuário NÃO encontrado na tabela "User"');
    }
  } catch (error) {
    console.log('❌ Erro na tabela "User":', error.message);
  }
  
  // Verificar todas as tabelas disponíveis
  console.log('\n📊 Tabelas disponíveis no banco:');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.table(tables);
  
  // Buscar qualquer usuário com nome "Lucas" para comparação
  console.log('\n🔍 Buscando todos os usuários "Lucas" para comparação:');
  try {
    const lucasQuery = db.prepare('SELECT id, name, email, status, cell_id FROM users WHERE name LIKE ?');
    const lucasUsers = lucasQuery.all('%Lucas%');
    
    if (lucasUsers.length > 0) {
      console.log('👥 Usuários "Lucas" encontrados:');
      console.table(lucasUsers);
    } else {
      console.log('❌ Nenhum usuário "Lucas" encontrado');
    }
  } catch (error) {
    console.log('❌ Erro ao buscar usuários Lucas:', error.message);
  }
  
  db.close();
  console.log('\n✅ Investigação concluída');
  
} catch (error) {
  console.error('❌ Erro geral:', error);
}