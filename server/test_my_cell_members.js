const axios = require('axios');

async function testMyCellMembers() {
  try {
    console.log('🔍 Fazendo login...');
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'lucas@igreja.com',
      password: 'lucas123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login realizado com sucesso');
    
    console.log('👥 Testando endpoint GET /api/cells/my-cell-members...');
    const membersResponse = await axios.get('http://localhost:5000/api/cells/my-cell-members', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Resposta do endpoint:');
    console.log(`   - Status: ${membersResponse.status}`);
    console.log(`   - Membros encontrados: ${membersResponse.data.length}`);
    console.log('   - Dados:', JSON.stringify(membersResponse.data, null, 2));
    
  } catch (error) {
    console.error('❌ Erro capturado:');
    console.error('Status:', error.response?.status);
    console.error('Data:', JSON.stringify(error.response?.data, null, 2));
    console.error('Message:', error.message);
  }
}

testMyCellMembers();