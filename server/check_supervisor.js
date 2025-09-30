const bcrypt = require('bcryptjs');
const pool = require('./src/database/connection').default;

async function checkSupervisorPassword() {
  try {
    console.log('🔍 Verificando senha do supervisor...');
    
    const result = await pool.query(
      'SELECT id, name, email, password_hash, role FROM users WHERE email = ?',
      ['supervisor.funcional@test.com']
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
    
    const isValid = await bcrypt.compare('supervisor123', user.password_hash);
    console.log('🔍 Senha "supervisor123":', isValid ? '✅ VÁLIDA' : '❌ INVÁLIDA');
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    process.exit(0);
  }
}

checkSupervisorPassword();