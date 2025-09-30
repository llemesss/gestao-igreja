import { Pool } from 'pg';

// Configuração do banco de dados baseada no ambiente
const isProduction = process.env.NODE_ENV === 'production';
const DATABASE_URL = process.env.DATABASE_URL;

let pool: Pool;

if (isProduction && DATABASE_URL) {
  // Produção: usar PostgreSQL (Neon)
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
} else {
  // Desenvolvimento: usar SQLite (fallback para compatibilidade)
  // Nota: Em Netlify Functions, sempre usaremos PostgreSQL
  throw new Error('DATABASE_URL é obrigatório para Netlify Functions');
}

// Interface para resultados de query
interface QueryResult {
  rows: any[];
  rowCount: number;
}

// Adapter para manter compatibilidade com o código existente
const dbAdapter = {
  query: async (text: string, params: any[] = []): Promise<QueryResult> => {
    try {
      const result = await pool.query(text, params);
      return {
        rows: result.rows,
        rowCount: result.rowCount || 0
      };
    } catch (error) {
      console.error('Erro na query PostgreSQL:', error);
      console.error('Query:', text);
      console.error('Params:', params);
      throw error;
    }
  },

  // Implementação de transação para PostgreSQL
  transaction: async (callback: (tx: any) => Promise<void>): Promise<void> => {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const tx = {
        query: async (text: string, params: any[] = []): Promise<QueryResult> => {
          const result = await client.query(text, params);
          return {
            rows: result.rows,
            rowCount: result.rowCount || 0
          };
        }
      };
      
      await callback(tx);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  end: async () => {
    await pool.end();
  }
};

export default dbAdapter;