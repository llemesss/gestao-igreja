const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

console.log('🔍 VERIFICANDO LOCALIZAÇÃO DO BANCO DE DADOS');
console.log('='.repeat(50));

// Verificar diferentes caminhos possíveis
const possiblePaths = [
  path.join(__dirname, '..', 'database.sqlite'),
  path.join(__dirname, 'database.sqlite'),
  path.join(__dirname, '..', '..', 'database.sqlite'),
  path.join(__dirname, 'src', 'database.sqlite')
];

console.log('📂 Caminhos verificados:');
possiblePaths.forEach((dbPath, index) => {
  const exists = fs.existsSync(dbPath);
  console.log(`${index + 1}. ${dbPath} - ${exists ? '✅ EXISTE' : '❌ NÃO EXISTE'}`);
  
  if (exists) {
    try {
      const db = new Database(dbPath);
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      console.log(`   Tabelas encontradas: ${tables.map(t => t.name).join(', ')}`);
      
      if (tables.some(t => t.name === 'users')) {
        const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
        console.log(`   Total de usuários: ${userCount.count}`);
      }
      
      db.close();
    } catch (error) {
      console.log(`   ❌ Erro ao acessar: ${error.message}`);
    }
  }
});

// Verificar o caminho usado pelo connection.ts
console.log('\n🔧 Caminho usado pelo connection.ts:');
const connectionPath = path.join(__dirname, '..', 'database.sqlite');
console.log(`Caminho: ${connectionPath}`);
console.log(`Existe: ${fs.existsSync(connectionPath) ? '✅ SIM' : '❌ NÃO'}`);

// Tentar criar o banco manualmente se não existir
if (!fs.existsSync(connectionPath)) {
  console.log('\n🔨 Criando banco de dados manualmente...');
  try {
    const db = new Database(connectionPath);
    
    // Criar tabela users
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('MEMBRO', 'LIDER', 'SUPERVISOR', 'COORDENADOR', 'PASTOR', 'ADMIN')),
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
        cell_id TEXT,
        full_name TEXT,
        phone TEXT,
        whatsapp TEXT,
        gender TEXT CHECK (gender IN ('MALE', 'FEMALE')),
        birth_city TEXT,
        birth_state TEXT,
        birth_date DATE,
        age_group TEXT,
        address TEXT,
        address_number TEXT,
        neighborhood TEXT,
        zip_code TEXT,
        address_reference TEXT,
        father_name TEXT,
        mother_name TEXT,
        marital_status TEXT CHECK (marital_status IN ('SINGLE', 'MARRIED', 'OTHER')),
        spouse_name TEXT,
        education_level TEXT CHECK (education_level IN ('BASIC', 'FUNDAMENTAL', 'HIGH_SCHOOL', 'UNIVERSITY', 'OTHER')),
        education_course TEXT,
        profession TEXT,
        conversion_date DATE,
        previous_church TEXT,
        transfer_info TEXT,
        has_children BOOLEAN DEFAULT 0,
        oikos1 TEXT,
        oikos2 TEXT,
        created_at DATETIME DEFAULT (datetime('now')),
        updated_at DATETIME DEFAULT (datetime('now'))
      )
    `);
    
    console.log('✅ Tabela users criada com sucesso');
    
    // Inserir usuário de teste
    const userId = '3c26b970-4c26-4d26-8b6b-4b65269f9171';
    db.prepare(`
      INSERT OR REPLACE INTO users (id, name, email, password_hash, role, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, 'Lucas Lemes', 'lucas@igreja.com', 'hash123', 'MEMBRO', 'INACTIVE');
    
    console.log('✅ Usuário de teste inserido com status INACTIVE');
    
    db.close();
    
  } catch (error) {
    console.log('❌ Erro ao criar banco:', error.message);
  }
}

console.log('\n✅ Verificação concluída');