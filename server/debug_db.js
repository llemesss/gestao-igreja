const Database = require('better-sqlite3');
const path = require('path');

// Caminho para o arquivo do banco SQLite
const dbPath = path.join(__dirname, 'database.sqlite');

console.log('🔍 PASSO 1: Verificação do Banco de Dados');
console.log('=====================================');
console.log('📍 Caminho do banco:', dbPath);

try {
  // Conectar ao banco
  const db = new Database(dbPath, { fileMustExist: false });
  
  // Verificar se o arquivo existe
  const fs = require('fs');
  if (!fs.existsSync(dbPath)) {
    console.log('❌ PROBLEMA CRÍTICO: Arquivo do banco de dados não existe!');
    console.log('📝 Solução: Execute npm run seed para criar o banco');
    process.exit(1);
  }
  
  console.log('✅ Banco de dados encontrado');
  
  // Primeiro, vamos ver todos os usuários
  console.log('\n📋 Todos os usuários no banco:');
  const allUsers = db.prepare('SELECT id, name, email, role, cell_id FROM users ORDER BY role, name').all();
  console.table(allUsers);
  
  // Verificar especificamente membros
  console.log('\n👥 Usuários com role MEMBRO:');
  const members = db.prepare('SELECT id, name, email, role, cell_id FROM users WHERE role = ?').all('MEMBRO');
  if (members.length === 0) {
    console.log('❌ PROBLEMA ENCONTRADO: Não há usuários com role MEMBRO no banco!');
    console.log('📝 Isso explica por que não consegue ver a célula - não há membros cadastrados!');
  } else {
    console.table(members);
    
    // Verificar se algum membro tem cell_id
    const membersWithCell = members.filter(m => m.cell_id);
    console.log('\n🏠 Membros com célula associada:', membersWithCell.length);
    if (membersWithCell.length === 0) {
      console.log('❌ PROBLEMA: Nenhum membro tem célula associada!');
    }
  }
  
  // Verificar células existentes
  console.log('\n🏠 Células existentes:');
  const cells = db.prepare('SELECT id, name, supervisor_id FROM cells').all();
  console.table(cells);
  
  // Verificar líderes de células
  console.log('\n👑 Líderes de células:');
  const leaders = db.prepare('SELECT * FROM cell_leaders').all();
  console.table(leaders);
  
  db.close();
  
} catch (error) {
  console.error('❌ Erro na consulta:', error);
}