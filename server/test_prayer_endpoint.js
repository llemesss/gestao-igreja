const axios = require('axios');

async function testPrayerEndpoint() {
  try {
    console.log('🔍 Fazendo login...');
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'lucas@igreja.com',
      password: 'lucas123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login realizado com sucesso');
    
    console.log('🙏 Testando endpoint POST /api/prayers/log-daily...');
    const prayerResponse = await axios.post('http://localhost:5000/api/prayers/log-daily', {}, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Resposta do endpoint:');
    console.log(JSON.stringify(prayerResponse.data, null, 2));
    
  } catch (error) {
    console.error('❌ Erro capturado:');
    console.error('Status:', error.response?.status);
    console.error('Data:', JSON.stringify(error.response?.data, null, 2));
    console.error('Message:', error.message);
  }
}

testPrayerEndpoint();