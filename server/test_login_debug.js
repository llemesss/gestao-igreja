const axios = require('axios');
const jwt = require('jsonwebtoken');

async function testLogin() {
  try {
    console.log('🔍 Testando login no backend...');
    
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'lucas@igreja.com',
      password: 'lucas123'
    });
    
    console.log('✅ Login Response:');
    console.log(JSON.stringify(loginResponse.data, null, 2));
    
    const token = loginResponse.data.token;
    
    // Decodificar o token JWT para ver o conteúdo
    const decoded = jwt.decode(token);
    console.log('\n🔍 Token JWT decodificado:');
    console.log(JSON.stringify(decoded, null, 2));
    
    // Testar o endpoint /api/me
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

testLogin();