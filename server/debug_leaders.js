const Database = require('better-sqlite3');
const path = require('path');

// Caminho para o arquivo do banco SQLite
const dbPath = path.join(__dirname, 'database.sqlite');

console.log('🔍 DEBUG: Consulta de Líderes');
console.log('============================');

try {
  // Conectar ao banco
  const db = new Database(dbPath, { fileMustExist: false });
  
  // Simular o pool adapter do connection.ts
  const pool = {
    query: (text, params = []) => {
      try {
        console.log('📝 Query original:', text);
        console.log('📝 Params originais:', params);
        
        // Converter query PostgreSQL para SQLite
        let sqliteQuery = text
          .replace(/\$(\d+)/g, '?') // Substituir $1, $2, etc. por ?
          .replace(/NOW\(\)/g, "datetime('now')") // Substituir NOW() por datetime('now')
          .replace(/SERIAL/g, 'INTEGER') // Substituir SERIAL por INTEGER
          .replace(/UUID/g, 'TEXT') // Substituir UUID por TEXT
          .replace(/TIMESTAMP/g, 'DATETIME') // Substituir TIMESTAMP por DATETIME
          .replace(/ON CONFLICT \([^)]+\) DO NOTHING/g, 'OR IGNORE'); // Substituir ON CONFLICT

        console.log('📝 Query convertida:', sqliteQuery);
        console.log('📝 Params finais:', params);

        // Se for SELECT, usar all()
        if (sqliteQuery.trim().toUpperCase().startsWith('SELECT')) {
          const stmt = db.prepare(sqliteQuery);
          const rows = stmt.all(params);
          console.log('📊 Resultado:', rows);
          return { rows, rowCount: rows.length };
        }
        
        // Se for INSERT/UPDATE/DELETE, usar run()
        const stmt = db.prepare(sqliteQuery);
        const result = stmt.run(params);
        
        return { 
          rows: result.lastInsertRowid ? [{ id: result.lastInsertRowid }] : [], 
          rowCount: result.changes 
        };
      } catch (error) {
        console.error('❌ Erro na query SQLite:', error);
        console.error('Query original:', text);
        console.error('Params:', params);
        throw error;
      }
    }
  };

  // Primeiro, vamos ver todas as células
  console.log('\n📋 Todas as células no banco:');
  const allCells = db.prepare('SELECT id, name FROM cells ORDER BY name').all();
  console.table(allCells);

  // Vamos ver todos os líderes
  console.log('\n👥 Todos os líderes no banco:');
  const allLeaders = db.prepare(`
    SELECT cl.cell_id, cl.user_id, u.name as user_name, c.name as cell_name
    FROM cell_leaders cl
    JOIN users u ON cl.user_id = u.id
    JOIN cells c ON cl.cell_id = c.id
    ORDER BY c.name, u.name
  `).all();
  console.table(allLeaders);

  // Agora vamos testar a consulta exata do código
  console.log('\n🔍 Testando consulta de líderes do código:');
  
  if (allCells.length > 0) {
    const testCellId = allCells[0].id;
    console.log(`🎯 Testando com cell_id: ${testCellId}`);
    
    const leadersQuery = `
      SELECT u.id, u.name 
      FROM cell_leaders cl
      JOIN users u ON cl.user_id = u.id
      WHERE cl.cell_id = $1
    `;
    
    const result = pool.query(leadersQuery, [testCellId]);
    console.log('📊 Resultado da consulta de líderes:', result);
  }

  // Testar com o ID específico da API
  console.log('\n🎯 Testando com ID específico da API:');
  const apiCellId = '9bd924f9-81f7-494f-9a6d-57f625209795';
  
  const leadersQuery = `
    SELECT u.id, u.name 
    FROM cell_leaders cl
    JOIN users u ON cl.user_id = u.id
    WHERE cl.cell_id = $1
  `;
  
  const result = pool.query(leadersQuery, [apiCellId]);
  console.log('📊 Resultado para ID da API:', result);

  db.close();

} catch (error) {
  console.error('❌ Erro:', error);
}