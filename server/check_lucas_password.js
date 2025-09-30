const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');

async function checkAndUpdateLucasPassword() {
  let db;
  try {
    console.log('🔍 Verificando senha do usuário Lucas...');

    // Conectar ao banco SQLite
    const dbPath = path.join(__dirname, 'database.sqlite');
    db = new Database(dbPath);

    // Buscar usuário Lucas
    const user = db.prepare('SELECT id, name, email, password_hash FROM users WHERE email = ?').get('lucas@igreja.com');
    
    if (!user) {
      console.log('❌ Usuário Lucas não encontrado');
      return;
    }

    console.log('✅ Usuário encontrado:', user.name, '-', user.email);

    // Testar senhas comuns
    const testPasswords = ['lucas123', 'admin123', '123456', 'password'];
    
    for (const password of testPasswords) {
      const isValid = await bcrypt.compare(password, user.password_hash);
      if (isValid) {
        console.log(`✅ Senha atual: ${password}`);
        return;
      }
    }

    console.log('❌ Nenhuma das senhas testadas funcionou');
    console.log('🔧 Atualizando senha para "lucas123"...');

    // Atualizar senha para lucas123
    const newPasswordHash = await bcrypt.hash('lucas123', 10);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newPasswordHash, user.id);

    console.log('✅ Senha atualizada com sucesso!');
    console.log('📋 Credenciais: lucas@igreja.com / lucas123');

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    if (db) {
      db.close();
    }
    process.exit(0);
  }
}

checkAndUpdateLucasPassword();