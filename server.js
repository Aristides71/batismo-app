require('dotenv').config()
const express = require('express')
const http = require('http')
const path = require('path')
const { Server } = require('socket.io')
const session = require('express-session')
const { createClient } = require('@supabase/supabase-js')

const app = express()
const server = http.createServer(app)
const io = new Server(server)

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

const MAIN_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
const MAIN_ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || '').trim()

app.use(express.json())
app.use(session({
  secret: 'segredo-paroquia-trindade',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 3600000 } // 1 hora
}))

const requireAuth = (req, res, next) => {
  if (req.session && req.session.authenticated) {
    return next()
  }
  res.redirect('/login.html')
}

const requireOwner = (req, res, next) => {
  if (req.session && req.session.authenticated && req.session.role === 'owner') {
    return next()
  }
  return res.status(403).json({ ok: false, error: 'Apenas o administrador principal pode executar esta ação' })
}

app.post('/login', async (req, res) => {
  const { email, senha } = req.body
  const emailNormalizado = String(email || '').trim().toLowerCase()

  if (!emailNormalizado || !emailNormalizado.includes('@') || !senha) {
    return res.status(400).json({ ok: false, error: 'Informe email e senha válidos' })
  }

  if (MAIN_ADMIN_EMAIL && emailNormalizado === MAIN_ADMIN_EMAIL) {
    if (!MAIN_ADMIN_PASSWORD) {
      return res.status(500).json({ ok: false, error: 'Administrador principal não configurado corretamente' })
    }
    if (senha !== MAIN_ADMIN_PASSWORD) {
      return res.status(401).json({ ok: false, error: 'Senha inválida para o administrador principal' })
    }
    req.session.authenticated = true
    req.session.role = 'owner'
    req.session.email = emailNormalizado
    return res.json({ ok: true, role: 'owner' })
  }

  if (!MAIN_ADMIN_PASSWORD) {
    return res.status(500).json({ ok: false, error: 'Senha de administrador não configurada' })
  }

  if (senha !== MAIN_ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, error: 'Credenciais inválidas' })
  }

  try {
    const { data, error } = await supabase.from('admin_emails').select('email')
    if (error) {
      console.error('Erro ao verificar admins', error)
      return res.status(500).json({ ok: false, error: 'Erro ao verificar autorização' })
    }
    const lista = Array.isArray(data) ? data : []
    if (lista.length === 0) {
      return res.status(403).json({ ok: false, error: 'Nenhum administrador adicional cadastrado' })
    }
    const autorizado = lista.some(a => String(a.email).toLowerCase() === emailNormalizado)
    if (!autorizado) {
      return res.status(403).json({ ok: false, error: 'Usuário não autorizado' })
    }
    req.session.authenticated = true
    req.session.role = 'admin'
    req.session.email = emailNormalizado
    return res.json({ ok: true, role: 'admin' })
  } catch (e) {
    console.error('Erro inesperado no login', e)
    return res.status(500).json({ ok: false, error: 'Erro no servidor' })
  }
})

app.get('/api/me', (req, res) => {
  if (!(req.session && req.session.authenticated)) {
    return res.status(401).json({ ok: false, error: 'Não autenticado' })
  }
  return res.json({
    ok: true,
    email: req.session.email || null,
    role: req.session.role || 'admin'
  })
})

app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.redirect('/admin')
    }
    res.clearCookie('connect.sid')
    res.redirect('/')
  })
})

app.get('/admin', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'private', 'admin.html'))
})

app.use(express.static(path.join(__dirname, 'public')))

// Helpers de Conversão
const dbToFrontend = (row) => ({
  id: row.id, // UUID string
  criadoEm: row.created_at,
  dataReuniao: row.meeting_date,
  batizando: { nome: row.baptized_name },
  pai: { nome: row.father_name, celular: row.contact_phone, presente: row.confirmed_father },
  mae: { nome: row.mother_name, celular: row.contact_phone, presente: row.confirmed_mother },
  padrinho: { nome: row.godfather_name, celular: '', presente: row.confirmed_godfather },
  madrinha: { nome: row.godmother_name, celular: '', presente: row.confirmed_godmother }
})

// Função para carregar e emitir inscrições
const carregarInscricoes = async () => {
  const { data, error } = await supabase
    .from('registrations')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Erro ao carregar:', error)
    return []
  }
  return data.map(dbToFrontend)
}

io.on('connection', async socket => {
  const lista = await carregarInscricoes()
  socket.emit('lista_inscricoes', lista)
})

app.get('/api/datas-reuniao', async (req, res) => {
  try {
    const hoje = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('meeting_dates')
      .select('meeting_date, meeting_time')
      .gte('meeting_date', hoje)
      .eq('is_active', true)
      .order('meeting_date', { ascending: true })

    if (error) {
      console.error('Erro ao buscar datas:', error)
      return res.status(500).json({ ok: false, error: 'Erro ao buscar datas disponíveis' })
    }
    return res.json({ ok: true, items: data || [] })
  } catch (e) {
    console.error('Erro inesperado datas:', e)
    return res.status(500).json({ ok: false, error: 'Erro no servidor' })
  }
})

app.get('/api/admin/datas', requireOwner, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('meeting_dates')
      .select('*')
      .order('meeting_date', { ascending: true })
    if (error) throw error
    return res.json({ ok: true, items: data || [] })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ ok: false, error: 'Erro ao listar datas' })
  }
})

app.post('/api/admin/datas', requireOwner, async (req, res) => {
  const { data, hora } = req.body
  if (!data || !hora) return res.status(400).json({ ok: false, error: 'Informe data e hora' })
  try {
    const { error } = await supabase.from('meeting_dates').insert({
      meeting_date: data,
      meeting_time: hora,
      is_active: true
    })
    if (error) throw error
    return res.status(201).json({ ok: true })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ ok: false, error: 'Erro ao criar data' })
  }
})

app.delete('/api/admin/datas/:id', requireOwner, async (req, res) => {
  try {
    const { error } = await supabase.from('meeting_dates').delete().eq('id', req.params.id)
    if (error) throw error
    return res.json({ ok: true })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ ok: false, error: 'Erro ao remover data' })
  }
})

app.post('/api/inscricoes', async (req, res) => {
  const {
    batizandoNome,
    paiNome,
    paiCelular,
    maeNome,
    maeCelular,
    padrinhoNome,
    madrinhaNome,
    dataReuniao
  } = req.body

  if (!batizandoNome || !paiNome || !maeNome || !padrinhoNome || !madrinhaNome) {
    return res.status(400).json({ ok: false, error: 'Campos obrigatórios ausentes' })
  }

  if (!paiCelular && !maeCelular) {
    return res.status(400).json({ ok: false, error: 'Informe pelo menos um número de celular (Pai ou Mãe)' })
  }

  const payload = {
    baptized_name: batizandoNome,
    father_name: paiNome,
    mother_name: maeNome,
    godfather_name: padrinhoNome,
    godmother_name: madrinhaNome,
    contact_phone: paiCelular || maeCelular,
    meeting_date: dataReuniao || new Date().toISOString().split('T')[0],
    confirmed_father: false,
    confirmed_mother: false,
    confirmed_godfather: false,
    confirmed_godmother: false
  }

  const { data, error } = await supabase
    .from('registrations')
    .insert(payload)
    .select()
    .single()

  if (error) {
    console.error('Erro ao salvar inscrição:', error)
    // Retorna mensagem mais específica se possível, ou genérica
    if (error.code === '23503') { // Foreign key violation code no Postgres
       return res.status(400).json({ ok: false, error: 'Data de reunião inválida ou não encontrada' })
    }
    return res.status(500).json({ ok: false, error: 'Erro ao salvar no banco: ' + (error.message || 'Erro desconhecido') })
  }

  const novo = dbToFrontend(data)
  io.emit('nova_inscricao', novo)
  res.status(201).json({ ok: true })
})

app.post('/api/presenca', async (req, res) => {
  const { id, role, presente } = req.body
  
  // Mapear role do frontend para coluna do banco
  const map = {
    'pai': 'confirmed_father',
    'mae': 'confirmed_mother',
    'padrinho': 'confirmed_godfather',
    'madrinha': 'confirmed_godmother'
  }
  
  const coluna = map[role]
  if (!coluna) return res.status(400).json({ ok: false, error: 'Role inválida' })

  const { error } = await supabase
    .from('registrations')
    .update({ [coluna]: !!presente })
    .eq('id', id)

  if (error) {
    console.error(error)
    return res.status(500).json({ ok: false, error: 'Erro ao atualizar' })
  }

  io.emit('atualizacao_presenca', { id, role, presente: !!presente })
  return res.json({ ok: true })
})

app.delete('/api/inscricoes/:id', requireAuth, async (req, res) => {
  const id = req.params.id // Agora é UUID string, não Number
  
  const { error } = await supabase
    .from('registrations')
    .delete()
    .eq('id', id)

  if (error) {
    console.error(error)
    return res.status(500).json({ ok: false, error: 'Erro ao deletar' })
  }

  io.emit('inscricao_removida', id)
  return res.json({ ok: true })
})

app.get('/api/admins', requireOwner, async (req, res) => {
  try {
    const { data, error } = await supabase.from('admin_emails').select('email').order('email', { ascending: true })
    if (error) {
      console.error('Erro ao listar admins', error)
      return res.status(500).json({ ok: false, error: 'Erro ao carregar administradores' })
    }
    const lista = Array.isArray(data) ? data.map(a => a.email) : []
    return res.json({ ok: true, items: lista })
  } catch (e) {
    console.error('Erro inesperado ao listar admins', e)
    return res.status(500).json({ ok: false, error: 'Erro no servidor' })
  }
})

app.post('/api/admins', requireOwner, async (req, res) => {
  const { email } = req.body
  if (!email || !String(email).includes('@')) {
    return res.status(400).json({ ok: false, error: 'E-mail inválido' })
  }
  try {
    const normalized = String(email).trim().toLowerCase()
    const { error } = await supabase.from('admin_emails').insert({ email: normalized })
    if (error) {
      if (String(error.message).toLowerCase().includes('duplicate') || String(error.code) === '23505') {
        return res.status(409).json({ ok: false, error: 'E-mail já é administrador' })
      }
      console.error('Erro ao adicionar admin', error)
      return res.status(500).json({ ok: false, error: 'Erro ao adicionar administrador' })
    }
    return res.status(201).json({ ok: true })
  } catch (e) {
    console.error('Erro inesperado ao adicionar admin', e)
    return res.status(500).json({ ok: false, error: 'Erro no servidor' })
  }
})

app.delete('/api/admins/:email', requireOwner, async (req, res) => {
  const email = req.params.email
  if (!email) {
    return res.status(400).json({ ok: false, error: 'E-mail inválido' })
  }
  try {
    const { error } = await supabase.from('admin_emails').delete().eq('email', email)
    if (error) {
      console.error('Erro ao remover admin', error)
      return res.status(500).json({ ok: false, error: 'Erro ao remover administrador' })
    }
    return res.json({ ok: true })
  } catch (e) {
    console.error('Erro inesperado ao remover admin', e)
    return res.status(500).json({ ok: false, error: 'Erro no servidor' })
  }
})

const PORT = process.env.PORT || 3000
const os = require('os')
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT} com Supabase conectado`)
  const interfaces = os.networkInterfaces()
  console.log('--- Endereços para acesso na rede ---')
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`Acesse no celular/outros PCs: http://${iface.address}:${PORT}/admin`)
      }
    }
  }
  console.log('-------------------------------------')
})
