import { Router } from 'express';
import pool from '../database/connection';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { AuthRequest } from '../types';
import puppeteer from 'puppeteer';

const router = Router();

// Middleware para garantir que o usuário está autenticado em todas as rotas
router.use(requireAuth);

// GET /api/users/my-cells -> Obter células do usuário logado (DEVE VIR ANTES DAS ROTAS COM PARÂMETROS)
router.get('/my-cells', async (req: AuthRequest, res) => {
  try {
    const { userId, role } = req.user!;
    
    let cells = [];
    
    switch (role) {
      case 'ADMIN':
      case 'PASTOR':
      case 'COORDENADOR':
        // Ver todas as células
        const allCellsResult = await pool.query(`
          SELECT c.id, c.name, c.supervisor_id, c.created_at, c.updated_at,
                 s.name as supervisor_name,
                 COUNT(DISTINCT u.id) as member_count
          FROM cells c
          LEFT JOIN users s ON c.supervisor_id = s.id
          LEFT JOIN users u ON u.cell_id = c.id AND u.status = 'ACTIVE'
          GROUP BY c.id, c.name, c.supervisor_id, c.created_at, c.updated_at, s.name
          ORDER BY c.name
        `);
        cells = allCellsResult.rows;
        break;
        
      case 'SUPERVISOR':
        // Ver células supervisionadas
        const supervisedCellsResult = await pool.query(`
          SELECT c.id, c.name, c.supervisor_id, c.created_at, c.updated_at,
                 s.name as supervisor_name,
                 COUNT(DISTINCT u.id) as member_count
          FROM cells c
          LEFT JOIN users s ON c.supervisor_id = s.id
          LEFT JOIN users u ON u.cell_id = c.id AND u.status = 'ACTIVE'
          WHERE c.supervisor_id = ?
          GROUP BY c.id, c.name, c.supervisor_id, c.created_at, c.updated_at, s.name
          ORDER BY c.name
        `, [userId]);
        cells = supervisedCellsResult.rows;
        break;
        
      case 'LIDER':
        // Ver células que lidera
        const ledCellsResult = await pool.query(`
          SELECT c.id, c.name, c.supervisor_id, c.created_at, c.updated_at,
                 s.name as supervisor_name,
                 COUNT(DISTINCT u.id) as member_count
          FROM cells c
          LEFT JOIN users s ON c.supervisor_id = s.id
          LEFT JOIN users u ON u.cell_id = c.id AND u.status = 'ACTIVE'
          INNER JOIN cell_leaders cl ON c.id = cl.cell_id
          WHERE cl.user_id = ?
          GROUP BY c.id, c.name, c.supervisor_id, c.created_at, c.updated_at, s.name
          ORDER BY c.name
        `, [userId]);
        cells = ledCellsResult.rows;
        break;
        
      case 'MEMBRO':
        // Ver apenas sua própria célula
        const memberCellResult = await pool.query(`
          SELECT c.id, c.name, c.supervisor_id, c.created_at, c.updated_at,
                 s.name as supervisor_name,
                 COUNT(DISTINCT u.id) as member_count
          FROM cells c
          LEFT JOIN users s ON c.supervisor_id = s.id
          LEFT JOIN users u ON u.cell_id = c.id AND u.status = 'ACTIVE'
          INNER JOIN users me ON me.cell_id = c.id
          WHERE me.id = ?
          GROUP BY c.id, c.name, c.supervisor_id, c.created_at, c.updated_at, s.name
        `, [userId]);
        cells = memberCellResult.rows;
        break;
        
      default:
        cells = [];
    }
    
    res.status(200).json(cells);
  } catch (error) {
    console.error('Erro ao buscar células do usuário:', error);
    res.status(500).json({ message: 'Erro ao buscar células do usuário' });
  }
});

// GET /api/users -> Listar todos os usuários (Admin)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const result = pool.query(`
      SELECT 
        u.id, u.name, u.email, u.role, u.cell_id, u.status,
        u.created_at, u.updated_at,
        c.name as cell_name
      FROM users u
      LEFT JOIN cells c ON u.cell_id = c.id
      WHERE u.status = 'ACTIVE'
      ORDER BY u.name
    `);
    
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ message: 'Erro ao listar usuários' });
  }
});

// GET /api/users/:id -> Obter detalhes de um usuário específico
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar dados do usuário
    const userResult = pool.query(`
      SELECT 
        u.*, 
        c.name as cell_name
      FROM users u
      LEFT JOIN cells c ON u.cell_id = c.id
      WHERE u.id = ?
    `, [id]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    const user = userResult.rows[0];

    // Se for supervisor, buscar células supervisionadas
    if (user.role === 'SUPERVISOR') {
      const supervisedCellsResult = pool.query(`
        SELECT id, name 
        FROM cells 
        WHERE supervisor_id = ?
      `, [id]);
      
      user.supervisedCells = supervisedCellsResult.rows;
    }

    res.status(200).json(user);
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({ message: 'Erro ao buscar usuário' });
  }
});

// PUT /api/users/:id -> Atualizar um usuário (Admin)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id: targetUserId } = req.params;
    const { name, email, role, cell_id, cell_ids } = req.body;

    // Log dos dados recebidos para debug
    console.log('DADOS RECEBIDOS PARA SALVAR:', {
      targetUserId,
      name,
      email,
      role,
      cell_id,
      cell_ids,
      cell_ids_type: typeof cell_ids,
      cell_ids_is_array: Array.isArray(cell_ids),
      req_body_complete: req.body
    });

    // Validação de campos obrigatórios
    if (!name || !email || !role) {
      return res.status(400).json({ 
        message: 'Campos obrigatórios não fornecidos',
        missing_fields: {
          name: !name,
          email: !email,
          role: !role
        }
      });
    }

    // Verificar se o usuário existe
    const userCheck = pool.query('SELECT id, name, email FROM users WHERE id = ?', [targetUserId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    const currentUser = userCheck.rows[0];
    console.log('Usuário atual no banco:', currentUser);

    pool.transaction((tx) => {
      // 1. Atualiza os dados principais do usuário
      tx.query(`
        UPDATE users 
        SET name = ?, email = ?, role = ?, cell_id = ?, updated_at = datetime('now')
        WHERE id = ?
      `, [name, email, role, cell_id || null, targetUserId]);

      // 2. Lógica específica para a role de SUPERVISOR
      if (role === 'SUPERVISOR' && Array.isArray(cell_ids)) {
        console.log('Processando células supervisionadas:', cell_ids);
        
        // Remove as associações de supervisor antigas deste usuário
        tx.query(`
          UPDATE cells 
          SET supervisor_id = NULL 
          WHERE supervisor_id = ?
        `, [targetUserId]);

        // Adiciona as novas associações, se houver alguma
        if (cell_ids.length > 0) {
          // Converte IDs para string se necessário (compatibilidade)
          const cellIdsAsStrings = cell_ids.map(id => String(id));
          console.log('IDs das células convertidos:', cellIdsAsStrings);
          
          const placeholders = cellIdsAsStrings.map(() => '?').join(',');
          tx.query(`
            UPDATE cells 
            SET supervisor_id = ? 
            WHERE id IN (${placeholders})
          `, [targetUserId, ...cellIdsAsStrings]);
        }
      }
    });

    // Buscar o usuário atualizado
    const updatedUserResult = pool.query(`
      SELECT 
        u.*, 
        c.name as cell_name
      FROM users u
      LEFT JOIN cells c ON u.cell_id = c.id
      WHERE u.id = ?
    `, [targetUserId]);

    console.log('Usuário atualizado com sucesso:', updatedUserResult.rows[0]);
    res.status(200).json(updatedUserResult.rows[0]);

  } catch (error) {
    // O erro detalhado aparecerá aqui no terminal!
    console.error(`Erro ao atualizar usuário ${req.params.id}:`, error);
    if (error instanceof Error) {
      console.error('Stack trace completo:', error.stack);
    }
    res.status(500).json({ message: 'Erro interno no servidor' });
  }
});

// GET /api/users/my-cells -> Obter células do usuário logado
router.get('/my-cells', async (req: AuthRequest, res) => {
  try {
    const { userId, role } = req.user!;
    
    let cells = [];
    
    switch (role) {
      case 'ADMIN':
      case 'PASTOR':
      case 'COORDENADOR':
        // Ver todas as células
        const allCellsResult = await pool.query(`
          SELECT c.id, c.name, c.supervisor_id, c.created_at, c.updated_at,
                 s.name as supervisor_name,
                 COUNT(DISTINCT u.id) as member_count
          FROM cells c
          LEFT JOIN users s ON c.supervisor_id = s.id
          LEFT JOIN users u ON u.cell_id = c.id AND u.status = 'ACTIVE'
          GROUP BY c.id, c.name, c.supervisor_id, c.created_at, c.updated_at, s.name
          ORDER BY c.name
        `);
        cells = allCellsResult.rows;
        break;
        
      case 'SUPERVISOR':
        // Ver células supervisionadas
        const supervisedCellsResult = await pool.query(`
          SELECT c.id, c.name, c.supervisor_id, c.created_at, c.updated_at,
                 s.name as supervisor_name,
                 COUNT(DISTINCT u.id) as member_count
          FROM cells c
          LEFT JOIN users s ON c.supervisor_id = s.id
          LEFT JOIN users u ON u.cell_id = c.id AND u.status = 'ACTIVE'
          WHERE c.supervisor_id = ?
          GROUP BY c.id, c.name, c.supervisor_id, c.created_at, c.updated_at, s.name
          ORDER BY c.name
        `, [userId]);
        cells = supervisedCellsResult.rows;
        break;
        
      case 'LIDER':
        // Ver células que lidera
        const ledCellsResult = await pool.query(`
          SELECT c.id, c.name, c.supervisor_id, c.created_at, c.updated_at,
                 s.name as supervisor_name,
                 COUNT(DISTINCT u.id) as member_count
          FROM cells c
          LEFT JOIN users s ON c.supervisor_id = s.id
          LEFT JOIN users u ON u.cell_id = c.id AND u.status = 'ACTIVE'
          INNER JOIN cell_leaders cl ON c.id = cl.cell_id
          WHERE cl.user_id = ?
          GROUP BY c.id, c.name, c.supervisor_id, c.created_at, c.updated_at, s.name
          ORDER BY c.name
        `, [userId]);
        cells = ledCellsResult.rows;
        break;
        
      case 'MEMBRO':
        // Ver apenas sua própria célula
        const memberCellResult = await pool.query(`
          SELECT c.id, c.name, c.supervisor_id, c.created_at, c.updated_at,
                 s.name as supervisor_name,
                 COUNT(DISTINCT u.id) as member_count
          FROM cells c
          LEFT JOIN users s ON c.supervisor_id = s.id
          LEFT JOIN users u ON u.cell_id = c.id AND u.status = 'ACTIVE'
          INNER JOIN users me ON me.cell_id = c.id
          WHERE me.id = ?
          GROUP BY c.id, c.name, c.supervisor_id, c.created_at, c.updated_at, s.name
        `, [userId]);
        cells = memberCellResult.rows;
        break;
        
      default:
        cells = [];
    }
    
    res.status(200).json(cells);
  } catch (error) {
    console.error('Erro ao buscar células do usuário:', error);
    res.status(500).json({ message: 'Erro ao buscar células do usuário' });
  }
});

// GET /api/users/:id/supervised-cells -> Obter células supervisionadas por um usuário
router.get('/:id/supervised-cells', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se o usuário existe e é supervisor
    const userResult = pool.query(`
      SELECT id, name, role 
      FROM users 
      WHERE id = ? AND role = 'SUPERVISOR'
    `, [id]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'Supervisor não encontrado' });
    }

    // Buscar células supervisionadas
    const supervisedCellsResult = pool.query(`
      SELECT id, name 
      FROM cells 
      WHERE supervisor_id = ?
      ORDER BY name
    `, [id]);
    
    res.status(200).json(supervisedCellsResult.rows);
  } catch (error) {
    console.error('Erro ao buscar células supervisionadas:', error);
    res.status(500).json({ message: 'Erro ao buscar células supervisionadas' });
  }
});

// Adicione aqui outras rotas como PATCH para status ou DELETE, se necessário

// GET /api/users/reports/member/:id/pdf -> Gerar PDF da ficha do membro
router.get('/reports/member/:id/pdf', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.user!;
    
    // Buscar dados do membro
    const memberResult = pool.query(`
      SELECT 
        u.*, 
        c.name as cell_name,
        c.supervisor_id,
        s.name as supervisor_name
      FROM users u
      LEFT JOIN cells c ON u.cell_id = c.id
      LEFT JOIN users s ON c.supervisor_id = s.id
      WHERE u.id = ? AND u.status = 'ACTIVE'
    `, [id]);

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ message: 'Membro não encontrado' });
    }

    const member = memberResult.rows[0];

    // Verificar permissões - só pode gerar PDF se for:
    // 1. O próprio usuário
    // 2. Admin/Pastor/Coordenador
    // 3. Supervisor da célula do membro
    // 4. Líder da mesma célula
    if (userId !== member.id && 
        !['ADMIN', 'PASTOR', 'COORDENADOR'].includes(role) &&
        userId !== member.supervisor_id) {
      
      // Verificar se é líder da mesma célula
      const userResult = pool.query('SELECT cell_id, role FROM users WHERE id = ?', [userId]);
      const currentUser = userResult.rows[0];
      
      if (!currentUser || 
          currentUser.cell_id !== member.cell_id || 
          currentUser.role !== 'LIDER') {
        return res.status(403).json({ message: 'Sem permissão para gerar este relatório' });
      }
    }

    // Gerar HTML da ficha
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Ficha Cadastral - ${member.name}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px; 
              line-height: 1.6;
              color: #333;
            }
            .header { 
              text-align: center; 
              margin-bottom: 30px; 
              border-bottom: 2px solid #2563eb;
              padding-bottom: 20px;
            }
            .header h1 { 
              color: #2563eb; 
              margin: 0;
              font-size: 24px;
            }
            .section { 
              margin-bottom: 25px; 
              page-break-inside: avoid;
            }
            .section h2 { 
              color: #2563eb; 
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 5px;
              margin-bottom: 15px;
            }
            .field { 
              margin-bottom: 10px; 
              display: flex;
              align-items: center;
            }
            .field strong { 
              min-width: 150px; 
              color: #374151;
            }
            .field span { 
              color: #6b7280;
            }
            .grid { 
              display: grid; 
              grid-template-columns: 1fr 1fr; 
              gap: 20px; 
            }
            @media print {
              body { margin: 0; }
              .header { page-break-after: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Ficha Cadastral</h1>
            <p>Sistema de Gestão de Igreja</p>
            <p>Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
          </div>
          
          <div class="section">
            <h2>Informações Pessoais</h2>
            <div class="grid">
              <div>
                <div class="field">
                  <strong>Nome:</strong>
                  <span>${member.name || 'Não informado'}</span>
                </div>
                <div class="field">
                  <strong>Nome Completo:</strong>
                  <span>${member.full_name || 'Não informado'}</span>
                </div>
                <div class="field">
                  <strong>Email:</strong>
                  <span>${member.email || 'Não informado'}</span>
                </div>
                <div class="field">
                  <strong>Telefone:</strong>
                  <span>${member.phone || 'Não informado'}</span>
                </div>
                <div class="field">
                  <strong>WhatsApp:</strong>
                  <span>${member.whatsapp || 'Não informado'}</span>
                </div>
              </div>
              <div>
                <div class="field">
                  <strong>Gênero:</strong>
                  <span>${member.gender || 'Não informado'}</span>
                </div>
                <div class="field">
                  <strong>Data de Nascimento:</strong>
                  <span>${member.birth_date ? new Date(member.birth_date).toLocaleDateString('pt-BR') : 'Não informado'}</span>
                </div>
                <div class="field">
                  <strong>Cidade de Nascimento:</strong>
                  <span>${member.birth_city || 'Não informado'}</span>
                </div>
                <div class="field">
                  <strong>Estado de Nascimento:</strong>
                  <span>${member.birth_state || 'Não informado'}</span>
                </div>
                <div class="field">
                  <strong>Estado Civil:</strong>
                  <span>${member.marital_status || 'Não informado'}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="section">
            <h2>Endereço</h2>
            <div class="field">
              <strong>Endereço:</strong>
              <span>${member.address || 'Não informado'}</span>
            </div>
            <div class="grid">
              <div>
                <div class="field">
                  <strong>Número:</strong>
                  <span>${member.address_number || 'Não informado'}</span>
                </div>
                <div class="field">
                  <strong>Bairro:</strong>
                  <span>${member.neighborhood || 'Não informado'}</span>
                </div>
              </div>
              <div>
                <div class="field">
                  <strong>CEP:</strong>
                  <span>${member.zip_code || 'Não informado'}</span>
                </div>
                <div class="field">
                  <strong>Referência:</strong>
                  <span>${member.address_reference || 'Não informado'}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="section">
            <h2>Informações Familiares</h2>
            <div class="grid">
              <div>
                <div class="field">
                  <strong>Nome do Pai:</strong>
                  <span>${member.father_name || 'Não informado'}</span>
                </div>
                <div class="field">
                  <strong>Nome da Mãe:</strong>
                  <span>${member.mother_name || 'Não informado'}</span>
                </div>
              </div>
              <div>
                <div class="field">
                  <strong>Nome do Cônjuge:</strong>
                  <span>${member.spouse_name || 'Não informado'}</span>
                </div>
                <div class="field">
                  <strong>Tem Filhos:</strong>
                  <span>${member.has_children ? 'Sim' : 'Não'}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="section">
            <h2>Informações Profissionais e Educacionais</h2>
            <div class="grid">
              <div>
                <div class="field">
                  <strong>Nível de Educação:</strong>
                  <span>${member.education_level || 'Não informado'}</span>
                </div>
              </div>
              <div>
                <div class="field">
                  <strong>Profissão:</strong>
                  <span>${member.profession || 'Não informado'}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="section">
            <h2>Informações Ministeriais</h2>
            <div class="grid">
              <div>
                <div class="field">
                  <strong>Função:</strong>
                  <span>${member.role || 'Não informado'}</span>
                </div>
                <div class="field">
                  <strong>Célula:</strong>
                  <span>${member.cell_name || 'Não designado'}</span>
                </div>
              </div>
              <div>
                <div class="field">
                  <strong>Data de Conversão:</strong>
                  <span>${member.conversion_date ? new Date(member.conversion_date).toLocaleDateString('pt-BR') : 'Não informado'}</span>
                </div>
                <div class="field">
                  <strong>Informações de Transferência:</strong>
                  <span>${member.transfer_info || 'Não informado'}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="section">
            <h2>Oikos (Rede de Relacionamentos)</h2>
            <div class="grid">
              <div>
                <div class="field">
                  <strong>Oikos 1:</strong>
                  <span>${member.oikos1 || 'Não informado'}</span>
                </div>
              </div>
              <div>
                <div class="field">
                  <strong>Oikos 2:</strong>
                  <span>${member.oikos2 || 'Não informado'}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="section">
            <h2>Informações do Sistema</h2>
            <div class="grid">
              <div>
                <div class="field">
                  <strong>Cadastrado em:</strong>
                  <span>${new Date(member.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
              <div>
                <div class="field">
                  <strong>Última atualização:</strong>
                  <span>${new Date(member.updated_at).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    // Gerar PDF com Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      }
    });
    
    await browser.close();

    // Configurar headers para download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ficha-${member.name.replace(/[^a-zA-Z0-9]/g, '-')}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Erro ao gerar PDF da ficha:', error);
    res.status(500).json({ message: 'Erro ao gerar PDF da ficha' });
  }
});

// GET /api/users/reports/calendar/:id/pdf -> Gerar PDF do calendário de oração
router.get('/reports/calendar/:id/pdf', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { year } = req.query;
    const { userId, role } = req.user!;
    
    const currentYear = year ? parseInt(year as string) : new Date().getFullYear();
    
    // Buscar dados do usuário
    const userResult = pool.query(`
      SELECT 
        u.name, u.email, 
        c.name as cell_name
      FROM users u
      LEFT JOIN cells c ON u.cell_id = c.id
      WHERE u.id = ? AND u.status = 'ACTIVE'
    `, [id]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    const user = userResult.rows[0];

    // Verificar permissões (mesmo critério da ficha)
    if (userId.toString() !== id && !['ADMIN', 'PASTOR', 'COORDENADOR'].includes(role)) {
      return res.status(403).json({ message: 'Sem permissão para gerar este calendário' });
    }

    // Buscar dados de oração do usuário
    const prayerResult = pool.query(`
      SELECT prayer_date
      FROM daily_prayer_log
      WHERE user_id = ? AND strftime('%Y', prayer_date) = ?
      ORDER BY prayer_date
    `, [id, currentYear.toString()]);

    const prayedDates = prayerResult.rows.map(row => row.prayer_date);

    // Gerar calendário HTML
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    let calendarHtml = '';

    for (let month = 0; month < 12; month++) {
      const firstDay = new Date(currentYear, month, 1);
      const lastDay = new Date(currentYear, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      const startingDayOfWeek = firstDay.getDay();

      calendarHtml += `
        <div class="month">
          <h3>${months[month]} ${currentYear}</h3>
          <table class="calendar-table">
            <thead>
              <tr>
                ${weekDays.map(day => `<th>${day}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
      `;

      let currentWeek = '<tr>';
      
      // Adicionar células vazias no início
      for (let i = 0; i < startingDayOfWeek; i++) {
        currentWeek += '<td class="empty"></td>';
      }

      // Adicionar dias do mês
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${currentYear}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const hasPrayed = prayedDates.includes(dateStr);
        const dayOfWeek = (startingDayOfWeek + day - 1) % 7;

        currentWeek += `<td class="day ${hasPrayed ? 'prayed' : ''}">${day}</td>`;

        if (dayOfWeek === 6) {
          currentWeek += '</tr>';
          calendarHtml += currentWeek;
          currentWeek = '<tr>';
        }
      }

      // Completar a última semana se necessário
      const remainingCells = 7 - ((startingDayOfWeek + daysInMonth) % 7);
      if (remainingCells < 7) {
        for (let i = 0; i < remainingCells; i++) {
          currentWeek += '<td class="empty"></td>';
        }
        currentWeek += '</tr>';
        calendarHtml += currentWeek;
      }

      calendarHtml += `
            </tbody>
          </table>
        </div>
      `;
    }

    const totalPrayedDays = prayedDates.length;
    const totalDaysInYear = new Date(currentYear, 11, 31).getDate() === 31 ? 366 : 365;
    const prayerPercentage = ((totalPrayedDays / totalDaysInYear) * 100).toFixed(1);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Calendário de Oração ${currentYear} - ${user.name}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px; 
              line-height: 1.4;
              color: #333;
            }
            .header { 
              text-align: center; 
              margin-bottom: 30px; 
              border-bottom: 2px solid #16a34a;
              padding-bottom: 20px;
            }
            .header h1 { 
              color: #16a34a; 
              margin: 0;
              font-size: 28px;
            }
            .user-info {
              margin: 20px 0;
              text-align: center;
              background: #f0fdf4;
              padding: 15px;
              border-radius: 8px;
            }
            .stats {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 20px;
              margin-bottom: 30px;
              text-align: center;
            }
            .stat-card {
              background: #f8fafc;
              padding: 15px;
              border-radius: 8px;
              border: 1px solid #e2e8f0;
            }
            .stat-number {
              font-size: 24px;
              font-weight: bold;
              color: #16a34a;
            }
            .calendar-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
              margin-bottom: 20px;
            }
            .month {
              page-break-inside: avoid;
            }
            .month h3 {
              text-align: center;
              color: #16a34a;
              margin-bottom: 10px;
              font-size: 16px;
            }
            .calendar-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
            }
            .calendar-table th {
              background: #16a34a;
              color: white;
              padding: 5px;
              text-align: center;
              font-size: 10px;
            }
            .calendar-table td {
              border: 1px solid #e2e8f0;
              padding: 8px;
              text-align: center;
              width: 14.28%;
              height: 30px;
              vertical-align: middle;
            }
            .calendar-table td.empty {
              background: #f8fafc;
            }
            .calendar-table td.day {
              background: #ffffff;
              cursor: pointer;
            }
            .calendar-table td.prayed {
              background: #dcfce7;
              color: #166534;
              font-weight: bold;
            }
            .legend {
              display: flex;
              justify-content: center;
              gap: 30px;
              margin-top: 20px;
              font-size: 14px;
            }
            .legend-item {
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .legend-color {
              width: 20px;
              height: 20px;
              border: 1px solid #ccc;
            }
            @media print {
              body { margin: 0; }
              .calendar-grid { grid-template-columns: repeat(4, 1fr); }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Calendário de Oração ${currentYear}</h1>
            <p>Sistema de Gestão de Igreja</p>
          </div>
          
          <div class="user-info">
            <h2>${user.name}</h2>
            ${user.cell_name ? `<p><strong>Célula:</strong> ${user.cell_name}</p>` : ''}
            <p>Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
          </div>

          <div class="stats">
            <div class="stat-card">
              <div class="stat-number">${totalPrayedDays}</div>
              <div>Dias de Oração</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${totalDaysInYear}</div>
              <div>Total de Dias</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${prayerPercentage}%</div>
              <div>Frequência</div>
            </div>
          </div>

          <div class="calendar-grid">
            ${calendarHtml}
          </div>

          <div class="legend">
            <div class="legend-item">
              <div class="legend-color" style="background: #ffffff; border: 1px solid #e2e8f0;"></div>
              <span>Dia sem oração</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background: #dcfce7;"></div>
              <span>Dia com oração</span>
            </div>
          </div>
        </body>
      </html>
    `;

    // Gerar PDF com Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '15mm',
        right: '15mm',
        bottom: '15mm',
        left: '15mm'
      }
    });
    
    await browser.close();

    // Configurar headers para download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="calendario-oracao-${user.name.replace(/[^a-zA-Z0-9]/g, '-')}-${currentYear}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Erro ao gerar PDF do calendário:', error);
    res.status(500).json({ message: 'Erro ao gerar PDF do calendário' });
  }
});

export default router;