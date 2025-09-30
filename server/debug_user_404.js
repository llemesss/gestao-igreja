const Database = require('better-sqlite3');
const path = require('path');

// Caminho para o arquivo do banco SQLite
const dbPath = path.join(__dirname, 'database.sqlite');

// Criar conexão com SQLite
const db = new Database(dbPath, { 
  fileMustExist: false 
});

// Configurar WAL mode para melhor performance
db.pragma('journal_mode = WAL');

// Habilitar foreign keys
db.pragma('foreign_keys = ON');

// Adapter para manter compatibilidade com código PostgreSQL
const pool = {
  query: (text, params = []) => {
    try {
      // Converter query PostgreSQL para SQLite
      let sqliteQuery = text.replace(/\$(\d+)/g, '?');
      
      if (sqliteQuery.trim().toUpperCase().startsWith('SELECT')) {
        const stmt = db.prepare(sqliteQuery);
        const rows = stmt.all(...params);
        return { rows, rowCount: rows.length };
      } else {
        const stmt = db.prepare(sqliteQuery);
        const result = stmt.run(...params);
        return { rows: [], rowCount: result.changes };
      }
    } catch (error) {
      console.error('Erro na query SQLite:', error);
      throw error;
    }
  },
  
  end: () => {
    db.close();
  }
};

async function debugUser404() {
  const userId = '3c26b970-4c26-4d26-8b6b-4b65269f9171';
  
  console.log('🔍 AUDITORIA DO USUÁRIO QUE ESTÁ CAUSANDO ERRO 404');
  console.log('=' .repeat(60));
  console.log(`📋 ID SENDO BUSCADO: ${userId}`);
  console.log('');

  try {
    // 1. Verificar se o usuário existe
    console.log('1️⃣ VERIFICANDO SE O USUÁRIO EXISTE...');
    const userQuery = `
      SELECT 
        id, 
        name, 
        email, 
        status,
        created_at,
        updated_at
      FROM users 
      WHERE id = $1
    `;
    
    const result = await pool.query(userQuery, [userId]);
    
    if (result.rows.length === 0) {
      console.log('❌ RESULTADO: Usuário NÃO ENCONTRADO na tabela users');
      console.log('');
      console.log('🔧 DIAGNÓSTICO: O ID que o frontend está enviando não existe no banco.');
      console.log('💡 POSSÍVEIS CAUSAS:');
      console.log('   - ID foi deletado do banco');
      console.log('   - ID está sendo gerado incorretamente no frontend');
      console.log('   - Problema de sincronização entre frontend e banco');
      
      // Vamos verificar se existem usuários similares
      console.log('');
      console.log('🔍 VERIFICANDO USUÁRIOS EXISTENTES...');
      const allUsersQuery = 'SELECT id, name, email, status FROM users LIMIT 10';
      const allUsers = await pool.query(allUsersQuery);
      
      console.log(`📊 TOTAL DE USUÁRIOS NO BANCO: ${allUsers.rows.length}`);
      allUsers.rows.forEach((user, index) => {
        console.log(`   ${index + 1}. ID: ${user.id} | Nome: ${user.name} | Status: ${user.status}`);
      });
      
    } else {
      const user = result.rows[0];
      console.log('✅ RESULTADO: Usuário ENCONTRADO!');
      console.log('');
      console.log('📋 DADOS DO USUÁRIO:');
      console.log(`   ID: ${user.id}`);
      console.log(`   Nome: ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Status: ${user.status}`);
      console.log(`   Criado em: ${user.created_at}`);
      console.log(`   Atualizado em: ${user.updated_at}`);
      console.log('');
      
      if (user.status !== 'ACTIVE') {
        console.log('❌ PROBLEMA IDENTIFICADO: Status não é ACTIVE');
        console.log(`   Status atual: ${user.status}`);
        console.log('');
        console.log('🔧 SOLUÇÃO: Execute o comando abaixo para reativar o usuário:');
        console.log(`   UPDATE users SET status = 'ACTIVE' WHERE id = '${userId}';`);
      } else {
        console.log('✅ Status está correto (ACTIVE)');
        console.log('');
        console.log('🤔 O problema pode estar em outro lugar...');
        console.log('💡 PRÓXIMOS PASSOS:');
        console.log('   - Verificar middleware de autenticação');
        console.log('   - Verificar logs do servidor backend');
        console.log('   - Verificar se há conflitos de rotas');
      }
    }
    
  } catch (error) {
    console.error('❌ ERRO NA CONSULTA:', error.message);
  } finally {
    await pool.end();
  }
}

debugUser404();