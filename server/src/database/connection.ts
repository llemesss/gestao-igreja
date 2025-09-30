import Database from 'better-sqlite3';
import path from 'path';

// Caminho para o arquivo do banco SQLite
const dbPath = path.join(__dirname, '../../database.sqlite');

// Criar conexão com SQLite
const db = new Database(dbPath, { 
  fileMustExist: false 
});

// Configurar WAL mode para melhor performance
db.pragma('journal_mode = WAL');

// Habilitar foreign keys
db.pragma('foreign_keys = ON');

// Interface para simular pool do PostgreSQL
interface QueryResult {
  rows: any[];
  rowCount: number;
}

// Adapter para manter compatibilidade com código PostgreSQL
const pool = {
  query: (text: string, params: any[] = []): QueryResult => {
    try {
      // Converter query PostgreSQL para SQLite
      let sqliteQuery = text
        .replace(/\$(\d+)/g, '?') // Substituir $1, $2, etc. por ?
        .replace(/NOW\(\)/g, "datetime('now')") // Substituir NOW() por datetime('now')
        .replace(/SERIAL/g, 'INTEGER') // Substituir SERIAL por INTEGER
        .replace(/UUID/g, 'TEXT') // Substituir UUID por TEXT
        .replace(/TIMESTAMP/g, 'DATETIME') // Substituir TIMESTAMP por DATETIME
        .replace(/ON CONFLICT \([^)]+\) DO NOTHING/g, 'OR IGNORE'); // Substituir ON CONFLICT

      // Se for SELECT, usar all()
      if (sqliteQuery.trim().toUpperCase().startsWith('SELECT')) {
        const stmt = db.prepare(sqliteQuery);
        const rows = stmt.all(params);
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
      console.error('Erro na query SQLite:', error);
      console.error('Query original:', text);
      console.error('Params:', params);
      throw error;
    }
  },

  // Implementação de transação para SQLite
  transaction: (callback: (tx: any) => void): void => {
    const transaction = db.transaction(() => {
      const tx = {
        query: (text: string, params: any[] = []): QueryResult => {
          return pool.query(text, params);
        }
      };
      callback(tx);
    });

    transaction();
  },

  end: () => {
    db.close();
  }
};

export default pool;