const express = require('express')
const http = require('http')
const path = require('path')
const { Server } = require('socket.io')
const session = require('express-session')

const app = express()
const server = http.createServer(app)
const io = new Server(server)

app.use(express.json())
app.use(session({
  secret: 'segredo-paroquia-trindade',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 3600000 } // 1 hora
}))

// Auth Middleware
const requireAuth = (req, res, next) => {
  if (req.session && req.session.authenticated) {
    return next()
  }
  res.redirect('/login.html')
}

app.post('/login', (req, res) => {
  const { email, senha } = req.body
  // Validação simples de email e senha
  // Email deve conter @ e senha deve ser 'trindade'
  const emailValido = email && email.includes('@') && email.toLowerCase().includes('admin')
  
  if (emailValido && senha === 'trindade') {
    req.session.authenticated = true
    return res.json({ ok: true })
  }
  res.status(401).json({ ok: false, error: 'Credenciais inválidas' })
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

const inscricoes = []
let seq = 1

io.on('connection', socket => {
  socket.emit('lista_inscricoes', inscricoes)
})

app.post('/api/inscricoes', (req, res) => {
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

  if (
    !batizandoNome ||
    !paiNome ||
    !maeNome ||
    !padrinhoNome ||
    !madrinhaNome
  ) {
    return res.status(400).json({ ok: false, error: 'Campos obrigatórios ausentes' })
  }

  const inscricao = {
    id: seq++,
    criadoEm: new Date().toISOString(),
    dataReuniao: dataReuniao || '',
    batizando: { nome: batizandoNome },
    pai: { nome: paiNome, celular: paiCelular || '', presente: false },
    mae: { nome: maeNome, celular: maeCelular || '', presente: false },
    padrinho: { nome: padrinhoNome, celular: '', presente: false },
    madrinha: { nome: madrinhaNome, celular: '', presente: false }
  }

  inscricoes.push(inscricao)
  io.emit('nova_inscricao', inscricao)
  res.status(201).json({ ok: true })
})

app.post('/api/presenca', (req, res) => {
  const { id, role, presente } = req.body
  const inscricao = inscricoes.find(i => i.id === Number(id))

  if (inscricao && inscricao[role]) {
    inscricao[role].presente = !!presente
    io.emit('atualizacao_presenca', { id: inscricao.id, role, presente: inscricao[role].presente })
    return res.json({ ok: true })
  }
  res.status(404).json({ ok: false, error: 'Inscrição não encontrada' })
})

app.delete('/api/inscricoes/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  const index = inscricoes.findIndex(i => i.id === id)

  if (index !== -1) {
    inscricoes.splice(index, 1)
    io.emit('inscricao_removida', id)
    return res.json({ ok: true })
  }
  res.status(404).json({ ok: false, error: 'Inscrição não encontrada' })
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`)
  console.log('AVISO: Dados armazenados em memória. Reiniciar o servidor apagará as inscrições.')
})
