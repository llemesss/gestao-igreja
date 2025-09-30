const axios = require('axios');

async function testAPI() {
  try {
    // Primeiro fazer login para obter o token
    console.log('🔍 Fazendo login...');
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'lucas@igreja.com',
      password: 'lucas123'
    });
    
    console.log('✅ Login Response:');
    console.log(JSON.stringify(loginResponse.data, null, 2));
    
    const token = loginResponse.data.token;
    
    // Agora testar o endpoint /api/me
    console.log('\n🔍 Testando endpoint /api/me...');
    const meResponse = await axios.get('http://localhost:5000/api/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ /api/me Response:');
    console.log(JSON.stringify(meResponse.data, null, 2));
    
  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
  }
}

testAPI();