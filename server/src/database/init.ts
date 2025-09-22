import fs from 'fs';
import path from 'path';
import pool from './connection';

async function initDatabase() {
  try {
    console.log('🗄️  Inicializando banco de dados SQLite...');

    // Ler o arquivo de schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Dividir o schema em comandos individuais
    const commands = schema
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0);

    // Executar cada comando
    for (const command of commands) {
      if (command.trim()) {
        try {
          pool.query(command);
          console.log('✅ Comando executado:', command.substring(0, 50) + '...');
        } catch (error) {
          console.error('❌ Erro ao executar comando:', command.substring(0, 50) + '...');
          console.error('Erro:', error);
        }
      }
    }

    console.log('✅ Banco de dados inicializado com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error);
    throw error;
  }
}

// Executar inicialização se chamado diretamente
if (require.main === module) {
  initDatabase()
    .then(() => {
      console.log('🎉 Inicialização concluída!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Falha na inicialização:', error);
      process.exit(1);
    });
}

export default initDatabase;