const bcrypt = require('bcryptjs');
const pool = require('./src/database/connection').default;

async function checkPassword() {
  try {
    console.log('🔍 Verificando senha do usuário...');
    
    // Buscar o usuário no banco
    const result = await pool.query(
      'SELECT id, name, email, password_hash, role FROM users WHERE email = ?',
      ['lucas@igreja.com']
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Usuário não encontrado');
      return;
    }
    
    const user = result.rows[0];
    console.log('✅ Usuário encontrado:');
    console.log('- ID:', user.id);
    console.log('- Nome:', user.name);
    console.log('- Email:', user.email);
    console.log('- Role:', user.role);
    console.log('- Password Hash:', user.password_hash);
    
    // Testar diferentes senhas
    const testPasswords = ['123456', 'admin123', 'password', 'lucas123'];
    
    console.log('\n🔍 Testando senhas...');
    for (const password of testPasswords) {
      const isValid = await bcrypt.compare(password, user.password_hash);
      console.log(`- "${password}": ${isValid ? '✅ VÁLIDA' : '❌ INVÁLIDA'}`);
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    process.exit(0);
  }
}

checkPassword();