import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import cellRoutes from './routes/cells';
import prayerRoutes from './routes/prayers';
import meRoutes from './routes/me';

// Carregar variáveis de ambiente
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 5000;

console.log('🔧 Configurando middlewares...');

// Middlewares de parsing PRIMEIRO
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Middleware de log removido para reduzir poluição no terminal

console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('🔧 Configurando rotas...');

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/cells', cellRoutes);
app.use('/api/prayers', prayerRoutes);
app.use('/api/me', meRoutes);

// ==========================================================
// ROTA DE TESTE GLOBAL PARA ISOLAMENTO DO PROBLEMA
app.get('/api/ping', (req, res) => {
  console.log('[BACKEND GLOBAL TEST] A rota /api/ping foi chamada com sucesso!');
  res.status(200).send('Pong! O servidor está vivo e respondendo.');
});
// ==========================================================

// Rota de health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Sistema de Gestão de Igreja API',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Middleware de tratamento de erros 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Rota não encontrada',
    path: req.originalUrl,
    method: req.method
  });
});

// Middleware de tratamento de erros globais
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Erro não tratado:', err);
  
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Erro interno do servidor' 
      : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

export default app;