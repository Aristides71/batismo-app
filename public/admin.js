const socket = io()

socket.on('connect', () => {
  console.log('Conectado ao WebSocket!')
})

socket.on('lista_inscricoes', (lista) => {
  console.log('Recebida lista via socket:', lista.length)
  inscricoes = lista
  render()
  updateCharts()
})

socket.on('nova_inscricao', (nova) => {
  console.log('Nova inscrição recebida:', nova)
  inscricoes.unshift(nova)
  render()
  updateCharts()
})

socket.on('inscricao_removida', (id) => {
  console.log('Inscrição removida:', id)
  inscricoes = inscricoes.filter(i => i.id !== id)
  render()
  updateCharts()
})

socket.on('atualizacao_presenca', ({ id, role, presente }) => {
  console.log('Atualização de presença:', id, role, presente)
  const inscricao = inscricoes.find(i => i.id === id)
  if (inscricao) {
    if (role === 'pai') inscricao.pai.presente = presente
    if (role === 'mae') inscricao.mae.presente = presente
    if (role === 'padrinho') inscricao.padrinho.presente = presente
    if (role === 'madrinha') inscricao.madrinha.presente = presente
    // Não chamamos render() aqui para evitar "pulo" na interface se o usuário estiver clicando,
    // mas atualizamos o array local para que a geração de certificados funcione corretamente.
    // O checkbox já reflete o estado visualmente se foi o próprio usuário que clicou.
    // Se foi outro usuário, talvez devêssemos renderizar, mas vamos manter simples por enquanto.
  }
})

const tbody = document.getElementById('inscricoes-body')
const filtroInput = document.getElementById('filtro')
const contadorEl = document.getElementById('contador')
const btnExportar = document.getElementById('btn-exportar')
const btnPDF = document.getElementById('btn-pdf')
const btnFiltros = document.getElementById('btn-filtros')
const adminEmailInput = document.getElementById('admin-email-input')
const adminEmailAdd = document.getElementById('admin-email-add')
const adminEmailList = document.getElementById('admin-email-list')
const adminPermsSection = document.querySelector('.admin-perms')
const meetingDatesSection = document.querySelector('.meeting-dates-section')
const meetingList = document.getElementById('meeting-list')
const btnAddMeeting = document.getElementById('btn-add-meeting')
const newMeetingDate = document.getElementById('new-meeting-date')
const newMeetingTime = document.getElementById('new-meeting-time')

let currentUserRole = 'admin'

async function carregarDatasReuniao() {
  if (!meetingList) return
  try {
    const res = await fetch('/api/admin/datas')
    const body = await res.json()
    if (res.ok && body.ok) {
      meetingList.innerHTML = ''
      const items = body.items || []
      items.forEach(item => {
        const li = document.createElement('li')
        li.style.display = 'flex'
        li.style.justifyContent = 'space-between'
        li.style.padding = '8px'
        li.style.borderBottom = '1px solid #eee'
        
        const span = document.createElement('span')
        span.textContent = `${formatDateShort(item.meeting_date)} às ${item.meeting_time.slice(0, 5)}`
        
        const btn = document.createElement('button')
        btn.textContent = 'Remover'
        btn.style.marginLeft = '10px'
        btn.onclick = async () => {
          if(!confirm('Remover esta data?')) return
          try {
            await fetch(`/api/admin/datas/${item.id}`, { method: 'DELETE' })
            carregarDatasReuniao()
          } catch(e) { alert('Erro ao remover') }
        }
        
        li.appendChild(span)
        li.appendChild(btn)
        meetingList.appendChild(li)
      })
    }
  } catch (e) { console.error(e) }
}

if (btnAddMeeting) {
  btnAddMeeting.onclick = async () => {
    const d = newMeetingDate.value
    const t = newMeetingTime.value
    if (!d || !t) return alert('Preencha data e hora')
    try {
      const res = await fetch('/api/admin/datas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: d, hora: t })
      })
      if (res.ok) {
        newMeetingDate.value = ''
        carregarDatasReuniao()
      } else {
        alert('Erro ao adicionar')
      }
    } catch (e) { alert('Erro conexao') }
  }
}

async function carregarUsuarioAtual() {
  try {
    const res = await fetch('/api/me')
    if (!res.ok) {
      window.location.href = '/login.html'
      return
    }
    const body = await res.json().catch(() => ({}))
    if (body && body.ok && body.role) {
      currentUserRole = body.role
    }
    if (currentUserRole !== 'owner') {
      if (adminPermsSection) adminPermsSection.style.display = 'none'
      if (meetingDatesSection) meetingDatesSection.style.display = 'none'
    }
    if (currentUserRole === 'owner') {
      if (meetingDatesSection) meetingDatesSection.style.display = 'block'
      carregarAdmins()
      carregarDatasReuniao()
    }
  } catch (e) {
    window.location.href = '/login.html'
  }
}
const areaFiltros = document.getElementById('area-filtros')
const btnLimparFiltros = document.getElementById('btn-limpar-filtros')
const btnOrdenar = document.getElementById('btn-ordenar')

// Filtros Avançados
const filtroDataInscricao = document.getElementById('filtro-data-inscricao')
const filtroDataReuniao = document.getElementById('filtro-data-reuniao')
const filtroInicio = document.getElementById('filtro-inicio')
const filtroFim = document.getElementById('filtro-fim')
const filtroPresenca = document.getElementById('filtro-presenca')

let inscricoes = []
let dailyChart = null
let monthlyChart = null
let adminEmails = []
let sortAscending = false // Padrão: mais recentes primeiro (false = desc)

function updateCharts() {
  const now = new Date()
  const today = now.toLocaleDateString('pt-BR')
  
  const yesterdayDate = new Date(now)
  yesterdayDate.setDate(now.getDate() - 1)
  const yesterday = yesterdayDate.toLocaleDateString('pt-BR')

  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  // Counts
  let countToday = 0
  let countYesterday = 0
  let countMonth = 0

  inscricoes.forEach(i => {
    if (!i.criadoEm) return
    const date = new Date(i.criadoEm)
    const dateStr = date.toLocaleDateString('pt-BR')
    
    if (dateStr === today) countToday++
    if (dateStr === yesterday) countYesterday++
    
    if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
      countMonth++
    }
  })

  // Update Stats Elements
  const elYesterday = document.getElementById('stat-yesterday')
  const elToday = document.getElementById('stat-today')
  const elMonth = document.getElementById('stat-month')

  if(elYesterday) elYesterday.textContent = countYesterday
  if(elToday) elToday.textContent = countToday
  if(elMonth) elMonth.textContent = countMonth

  // Daily Chart
  const ctxDaily = document.getElementById('chart-daily').getContext('2d')
  if (dailyChart) dailyChart.destroy()
  
  dailyChart = new Chart(ctxDaily, {
    type: 'bar',
    data: {
      labels: ['Ontem', 'Hoje'],
      datasets: [{
        label: 'Inscrições',
        data: [countYesterday, countToday],
        backgroundColor: ['#95a5a6', '#2ecc71'],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } }
      }
    }
  })

  // Monthly Chart
  const ctxMonthly = document.getElementById('chart-monthly').getContext('2d')
  if (monthlyChart) monthlyChart.destroy()
  
  monthlyChart = new Chart(ctxMonthly, {
    type: 'bar',
    data: {
      labels: ['Mês Atual'],
      datasets: [{
        label: 'Total',
        data: [countMonth],
        backgroundColor: ['#3498db'],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } }
      }
    }
  })
}

function formatDate(iso) {
  if (!iso) return ''
  // Se for string yyyy-mm-dd, formata manualmente
  if (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [ano, mes, dia] = iso.split('-')
    return `${dia}/${mes}/${ano}`
  }
  try {
    // dd/mm/yyyy (sem hora, conforme solicitado)
    return new Date(iso).toLocaleDateString('pt-BR')
  } catch {
    return iso
  }
}

function formatDateShort(iso) {
  return formatDate(iso)
}

function normalizar(s) {
  return (s || '').toLowerCase()
}

function getFilterState() {
  return {
    termo: normalizar(filtroInput.value.trim()),
    dataInscricao: filtroDataInscricao.value,
    dataReuniao: filtroDataReuniao.value,
    inicio: filtroInicio.value,
    fim: filtroFim.value,
    presenca: filtroPresenca.value
  }
}

function passaFiltro(i, f) {
  // Filtro Texto
  if (f.termo) {
    const match = 
      normalizar(i.batizando.nome).includes(f.termo) ||
      normalizar(i.pai.nome).includes(f.termo) ||
      normalizar(i.mae.nome).includes(f.termo) ||
      normalizar(i.padrinho.nome).includes(f.termo) ||
      normalizar(i.madrinha.nome).includes(f.termo)
    if (!match) return false
  }

  // Data Inscrição (exata)
  if (f.dataInscricao) {
    const d = i.criadoEm.split('T')[0]
    if (d !== f.dataInscricao) return false
  }

  // Data Reunião (exata)
  if (f.dataReuniao) {
    if (i.dataReuniao !== f.dataReuniao) return false
  }

  // Período (Inscrição)
  if (f.inicio) {
    if (i.criadoEm.split('T')[0] < f.inicio) return false
  }
  if (f.fim) {
    if (i.criadoEm.split('T')[0] > f.fim) return false
  }

  // Presença
  if (f.presenca === 'completos') {
    // Alterado para mostrar inscrições com PELO MENOS UM presente,
    // pois o filtro "Todos Presentes" (AND) estava ocultando tudo se não estivesse 100% completo.
    const temPresenca = i.pai.presente || i.mae.presente || i.padrinho.presente || i.madrinha.presente
    if (!temPresenca) return false
  }
  if (f.presenca === 'pendentes') {
    const algumFaltou = !i.pai.presente || !i.mae.presente || !i.padrinho.presente || !i.madrinha.presente
    if (!algumFaltou) return false
  }

  return true
}

function getFilteredData() {
  const f = getFilterState()
  const sorted = inscricoes
    .slice()
    .sort((a, b) => {
      const diff = new Date(a.criadoEm) - new Date(b.criadoEm)
      return sortAscending ? diff : -diff
    })
  return sorted.filter(i => passaFiltro(i, f))
}

function render() {
  const dados = getFilteredData()
  contadorEl.textContent = `${dados.length} inscrições`
  tbody.innerHTML = ''
  
  const createNameCell = (person, role, id) => `
    <div class="nome-com-presenca">
      <div class="nome-actions">
        <span>${person.nome}</span>
        ${person.presente ? `<button class="btn-cert-mini" data-id="${id}" data-role="${role}" title="Gerar Certificado Individual">📜</button>` : ''}
      </div>
      <label class="switch" title="Confirmar Presença">
        <input type="checkbox" 
               class="presenca-check" 
               data-id="${id}" 
               data-role="${role}" 
               ${person.presente ? 'checked' : ''}>
        <span class="slider round"></span>
      </label>
    </div>
  `

  const rows = dados.map((i, index) => `
    <tr>
      <td style="text-align: center;">
        <input type="checkbox" class="row-select" value="${i.id}">
      </td>
      <td data-label="ID">${index + 1}</td>
      <td data-label="Data Inscr.">${formatDate(i.criadoEm)}</td>
      <td data-label="Data Reunião">${formatDateShort(i.dataReuniao)}</td>
      <td data-label="Batizando">${i.batizando.nome}</td>
      <td data-label="Pai">${createNameCell(i.pai, 'pai', i.id)}</td>
      <td data-label="Celular Pai">${i.pai.celular}</td>
      <td data-label="Mãe">${createNameCell(i.mae, 'mae', i.id)}</td>
      <td data-label="Celular Mãe">${i.mae.celular}</td>
      <td data-label="Padrinho">${createNameCell(i.padrinho, 'padrinho', i.id)}</td>
      <td data-label="Madrinha">${createNameCell(i.madrinha, 'madrinha', i.id)}</td>
      <td data-label="Ações">
        <button class="btn-excluir" data-id="${i.id}" title="Excluir Inscrição">🗑️</button>
      </td>
    </tr>
  `).join('')
  tbody.innerHTML = rows

  // Event Listeners for Delete Buttons
  document.querySelectorAll('.btn-excluir').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.dataset.id
      if (confirm('Tem certeza que deseja excluir esta inscrição? Esta ação não pode ser desfeita.')) {
        try {
          const res = await fetch(`/api/inscricoes/${id}`, { method: 'DELETE' })
          if (!res.ok) throw new Error('Falha ao excluir')
          // UI update will happen via socket event 'inscricao_removida'
        } catch (err) {
          alert('Erro ao excluir inscrição: ' + err.message)
        }
      }
    })
  })

  document.querySelectorAll('.presenca-check').forEach(chk => {
    chk.addEventListener('change', async (e) => {
      const id = e.target.dataset.id
      const role = e.target.dataset.role
      const presente = e.target.checked
      
      try {
        await fetch('/api/presenca', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, role, presente })
        })
      } catch (err) {
        console.error('Erro ao atualizar presença', err)
        e.target.checked = !presente // Reverte em caso de erro
      }
    })
  })

  // Listeners for Individual Certificates
  document.querySelectorAll('.btn-cert-mini').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const id = e.target.dataset.id
      const role = e.target.dataset.role
      gerarCertificadoIndividual(id, role)
    })
  })
}

function renderAdmins() {
  if (!adminEmailList) return
  adminEmailList.innerHTML = ''
  const items = adminEmails.slice().sort((a, b) => a.localeCompare(b))
  items.forEach(email => {
    const li = document.createElement('li')
    const span = document.createElement('span')
    span.textContent = email
    const btn = document.createElement('button')
    btn.textContent = 'Remover'
    btn.addEventListener('click', async () => {
      if (!confirm(`Remover ${email} da lista de administradores?`)) return
      try {
        const res = await fetch(`/api/admins/${encodeURIComponent(email)}`, { method: 'DELETE' })
        const body = await res.json().catch(() => ({}))
        if (!res.ok || body.ok === false) {
          const msg = body.error || 'Erro ao remover administrador'
          alert(msg)
          return
        }
        adminEmails = adminEmails.filter(e => e !== email)
        renderAdmins()
      } catch (e) {
        alert('Erro ao remover administrador')
      }
    })
    li.appendChild(span)
    li.appendChild(btn)
    adminEmailList.appendChild(li)
  })
}

function getSelectedIds() {
  const checkboxes = document.querySelectorAll('.row-select:checked')
  return Array.from(checkboxes).map(cb => cb.value)
}

function toCSVValue(v) {
  const s = String(v ?? '')
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function exportarCSV() {
  const dados = getFilteredData()
  const cabecalho = [
    'ID',
    'Data/Hora Inscrição',
    'Data Reunião',
    'Batizando',
    'Pai', 'Celular Pai', 'Pai Presente',
    'Mãe', 'Celular Mãe', 'Mãe Presente',
    'Padrinho', 'Celular Padrinho', 'Padrinho Presente',
    'Madrinha', 'Celular Madrinha', 'Madrinha Presente'
  ]
  const linhas = dados.map(i => [
    i.id,
    formatDate(i.criadoEm),
    formatDateShort(i.dataReuniao),
    i.batizando.nome,
    i.pai.nome, i.pai.celular, i.pai.presente ? 'Sim' : 'Não',
    i.mae.nome, i.mae.celular, i.mae.presente ? 'Sim' : 'Não',
    i.padrinho.nome, i.padrinho.celular, i.padrinho.presente ? 'Sim' : 'Não',
    i.madrinha.nome, i.madrinha.celular, i.madrinha.presente ? 'Sim' : 'Não'
  ].map(toCSVValue).join(','))
  
  const csv = [cabecalho.join(','), ...linhas].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'inscricoes.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function getLogoBase64() {
  try {
    const response = await fetch('/logo-trindade.png')
    const blob = await response.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.readAsDataURL(blob)
    })
  } catch (e) {
    console.error('Erro ao carregar logo para PDF', e)
    return null
  }
}

async function exportarPDF() {
  if (!window.jspdf) {
    alert('Erro: Biblioteca PDF não carregada. Recarregue a página.')
    return
  }
  
  const { jsPDF } = window.jspdf
  const doc = new jsPDF('l', 'mm', 'a4') // Landscape
  
  // Verifica plugin autotable
  if (typeof doc.autoTable !== 'function') {
    alert('Erro: Plugin AutoTable não carregado.')
    return
  }

  const logoData = await getLogoBase64()
  let startY = 25

  if (logoData) {
    const img = new Image()
    img.src = logoData
    const ratio = img.width / img.height
    const pdfH = 25
    const pdfW = pdfH * ratio
    doc.addImage(logoData, 'PNG', 14, 10, pdfW, pdfH)
    const textX = 14 + pdfW + 5
    doc.setFontSize(16)
    doc.text('Paróquia Santíssima Trindade', textX, 18)
    doc.setFontSize(12)
    doc.text('Relatório de Inscrições - Batismo', textX, 25)
    doc.setFontSize(10)
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, textX, 30)
    startY = 40
  } else {
    doc.text('Relatório de Inscrições - Batismo', 14, 15)
    doc.setFontSize(10)
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 20)
  }
  
  // Selection Logic
  const selectedIds = getSelectedIds()
  let dados = getFilteredData()
  
  if (selectedIds.length > 0) {
    dados = dados.filter(i => selectedIds.includes(i.id))
  }

  if (dados.length === 0) {
    alert('Nenhuma inscrição encontrada para gerar o relatório.')
    return
  }
  
  dados.sort((a, b) => String(a.id).localeCompare(String(b.id)))

  const tableData = dados.map(i => [
    i.id,
    formatDateShort(i.criadoEm),
    formatDateShort(i.dataReuniao),
    i.batizando.nome,
    i.pai.nome,
    i.mae.nome,
    i.padrinho.nome,
    i.madrinha.nome
  ])

  doc.autoTable({
    head: [['ID', 'Inscrição', 'Reunião', 'Batizando', 'Pai', 'Mãe', 'Padrinho', 'Madrinha']],
    body: tableData,
    startY: startY,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [41, 128, 185] },
    didParseCell: function(data) {
      if (data.section === 'body') {
        const i = dados[data.row.index]
        const col = data.column.index
        let presente = false
        let isPersonColumn = false
        
        if (col === 4) { isPersonColumn = true; presente = i.pai.presente }
        if (col === 5) { isPersonColumn = true; presente = i.mae.presente }
        if (col === 6) { isPersonColumn = true; presente = i.padrinho.presente }
        if (col === 7) { isPersonColumn = true; presente = i.madrinha.presente }
        
        if (isPersonColumn) {
          if (presente) {
            data.cell.styles.textColor = [39, 174, 96]
            data.cell.styles.fontStyle = 'bold'
          } else {
            data.cell.styles.textColor = [192, 57, 43]
          }
        }
      }
    }
  })

  const blob = doc.output('blob')
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
}

if (btnFiltros && areaFiltros) {
  btnFiltros.addEventListener('click', () => {
    areaFiltros.style.display = areaFiltros.style.display === 'none' ? 'flex' : 'none'
  })
}

if (btnLimparFiltros) {
  btnLimparFiltros.addEventListener('click', () => {
    if (filtroDataInscricao) filtroDataInscricao.value = ''
    if (filtroDataReuniao) filtroDataReuniao.value = ''
    if (filtroInicio) filtroInicio.value = ''
    if (filtroFim) filtroFim.value = ''
    if (filtroPresenca) filtroPresenca.value = 'todos'
    render()
  })
}

;[
  filtroInput, filtroDataInscricao, filtroDataReuniao,
  filtroInicio, filtroFim, filtroPresenca
].forEach(el => {
  if (el) el.addEventListener('input', render)
})

if (btnExportar) btnExportar.addEventListener('click', exportarCSV)
if (btnPDF) btnPDF.addEventListener('click', exportarPDF)

if (btnOrdenar) {
  btnOrdenar.addEventListener('click', () => {
    sortAscending = !sortAscending
    btnOrdenar.textContent = sortAscending
      ? 'Ordenar: Mais Antigas'
      : 'Ordenar: Recentes'
    render()
  })
}

async function carregarAdmins() {
  if (!adminEmailList || currentUserRole !== 'owner') return
  try {
    const res = await fetch('/api/admins')
    const body = await res.json()
    if (!res.ok || body.ok === false) {
      adminEmails = []
      renderAdmins()
      return
    }
    adminEmails = Array.isArray(body.items) ? body.items : []
    renderAdmins()
  } catch (e) {
    adminEmails = []
    renderAdmins()
  }
}

if (adminEmailAdd && adminEmailInput) {
  adminEmailAdd.addEventListener('click', async () => {
    const email = adminEmailInput.value.trim()
    if (!email) {
      alert('Informe um e-mail')
      return
    }
    try {
      const res = await fetch('/api/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || body.ok === false) {
        const msg = body.error || 'Erro ao adicionar administrador'
        alert(msg)
        return
      }
      if (!adminEmails.includes(email.toLowerCase())) {
        adminEmails.push(email.toLowerCase())
      }
      adminEmailInput.value = ''
      renderAdmins()
    } catch (e) {
      alert('Erro ao adicionar administrador')
    }
  })
}

document.getElementById('check-all').addEventListener('change', (e) => {
  const isChecked = e.target.checked
  document.querySelectorAll('.row-select').forEach(cb => {
    cb.checked = isChecked
  })
})

// Inicia verificação de usuário
carregarUsuarioAtual()

// Carregar inscrições via HTTP (backup do Socket)
async function carregarInscricoesHTTP() {
  try {
    const res = await fetch('/api/inscricoes')
    if (res.status === 401) {
      window.location.href = '/login.html'
      return
    }
    const body = await res.json()
    if (res.ok && body.ok && Array.isArray(body.items)) {
      console.log('Inscrições carregadas via HTTP:', body.items.length)
      inscricoes = body.items
      render()
      updateCharts()
      if (inscricoes.length === 0) {
        document.getElementById('inscricoes-body').innerHTML = '<tr><td colspan="12" style="text-align:center; padding: 20px;">Nenhuma inscrição encontrada.</td></tr>'
      }
    } else {
      console.error('Erro ao carregar inscrições:', body.error)
    }
  } catch (e) {
    console.error('Erro ao carregar via HTTP:', e)
  }
}
carregarInscricoesHTTP()

const btnCertificados = document.getElementById('btn-certificados')

// Função helper para desenhar cantos ornamentais
function drawOrnamentalCorner(doc, x, y, angle) {
  doc.saveGraphicsState()
  doc.translate(x, y)
  doc.rotate(angle)
  doc.setLineWidth(0.5)
  doc.setDrawColor(115, 102, 255) // Roxo principal
  
  // Desenhar um padrão de "folhas" ou curvas simples
  const scale = 0.8
  
  // Linha principal do canto
  doc.lines([[25 * scale, 0], [0, 25 * scale]], 0, 0, [1, 1]) // Escala simples não funciona bem em lines, fazendo manual
  
  // Curvas decorativas (Bézier cúbico simulado)
  // Partindo de (0,0)
  doc.setLineWidth(1)
  doc.lines([[30, 0]], 0, 0) // Linha horiz
  doc.lines([[0, 30]], 0, 0) // Linha vert
  
  // Detalhe interno
  doc.setLineWidth(0.5)
  doc.setDrawColor(240, 100, 150) // Rosa
  doc.lines([[20, 5], [5, 20]], 5, 5)
  
  // Círculo decorativo no vértice
  doc.circle(5, 5, 2, 'S')
  
  doc.restoreGraphicsState()
}

async function gerarPDFCertificados(pessoasParaCertificado) {
  if (!window.jspdf) {
    alert('ERRO CRÍTICO: Biblioteca PDF não foi carregada pelo navegador. Por favor, recarregue a página e verifique sua conexão.')
    return
  }

  try {
    const { jsPDF } = window.jspdf
    const doc = new jsPDF('l', 'mm', 'a4') // Landscape
    const width = doc.internal.pageSize.getWidth()
    const height = doc.internal.pageSize.getHeight()

    // Carregamento do logo com timeout para não travar
    let logoData = null
    try {
      const logoPromise = getLogoBase64()
      const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 3000)) // 3s timeout
      logoData = await Promise.race([logoPromise, timeoutPromise])
    } catch (err) {
      console.warn('Logo não carregou, gerando sem logo:', err)
    }

    pessoasParaCertificado.forEach((pessoa, index) => {
      if (index > 0) doc.addPage()

      try {
        // --- Bordas e Cantos Decorativos ---
        // Borda Externa Simples
        doc.setDrawColor(115, 102, 255) // Roxo
        doc.setLineWidth(1)
        doc.rect(8, 8, width - 16, height - 16)
        
        // Borda Interna Dupla
        doc.setDrawColor(100, 100, 100)
        doc.setLineWidth(0.5)
        doc.rect(12, 12, width - 24, height - 24)
        doc.rect(14, 14, width - 28, height - 28)

        // Cantos Ornamentais Simplificados (Sem rotação complexa para evitar erros)
        const cornerSize = 20
        doc.setDrawColor(115, 102, 255)
        doc.setLineWidth(1)

        // Superior Esquerdo
        doc.line(14, 14 + cornerSize, 14, 14)
        doc.line(14, 14, 14 + cornerSize, 14)
        doc.circle(14 + 5, 14 + 5, 2)

        // Superior Direito
        doc.line(width - 14 - cornerSize, 14, width - 14, 14)
        doc.line(width - 14, 14, width - 14, 14 + cornerSize)
        doc.circle(width - 14 - 5, 14 + 5, 2)

        // Inferior Direito
        doc.line(width - 14, height - 14 - cornerSize, width - 14, height - 14)
        doc.line(width - 14, height - 14, width - 14 - cornerSize, height - 14)
        doc.circle(width - 14 - 5, height - 14 - 5, 2)

        // Inferior Esquerdo
        doc.line(14 + cornerSize, height - 14, 14, height - 14)
        doc.line(14, height - 14, 14, height - 14 - cornerSize)
        doc.circle(14 + 5, height - 14 - 5, 2)

        // --- Logo ---
        let yPos = 35
        if (logoData && typeof logoData === 'string' && logoData.startsWith('data:image')) {
          try {
            const imgProps = doc.getImageProperties(logoData)
            const imgWidth = 25
            const imgHeight = (imgProps.height * imgWidth) / imgProps.width
            const xPos = (width - imgWidth) / 2
            doc.addImage(logoData, 'PNG', xPos, 18, imgWidth, imgHeight)
            yPos = 18 + imgHeight + 8
          } catch (e) {
            console.warn('Erro ao desenhar logo na página:', e)
          }
        }

        // --- Títulos ---
        doc.setFont('times', 'bold')
        doc.setFontSize(24)
        doc.setTextColor(50, 50, 50)
        doc.text('Paróquia Santíssima Trindade', width / 2, yPos, { align: 'center' })
        
        yPos += 16
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(40)
        doc.setTextColor(115, 102, 255) // Cor primária
        doc.text('CERTIFICADO', width / 2, yPos, { align: 'center' })

        yPos += 10
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(14)
        doc.setTextColor(100, 100, 100)
        doc.text('DE PREPARAÇÃO PARA O BATISMO', width / 2, yPos, { align: 'center' })

        // --- Corpo do Texto ---
        yPos += 25
        doc.setFont('times', 'normal')
        doc.setFontSize(18)
        doc.setTextColor(0, 0, 0)
        doc.text('Certificamos que', width / 2, yPos, { align: 'center' })

        yPos += 15
        // Usar apenas bold se bolditalic falhar em algumas versões
        doc.setFont('times', 'bold') 
        doc.setFontSize(32)
        doc.text(pessoa.nome, width / 2, yPos, { align: 'center' })
        
        // Linha decorativa abaixo do nome
        doc.setDrawColor(150, 150, 150)
        doc.setLineWidth(0.5)
        doc.line(width / 2 - 80, yPos + 3, width / 2 + 80, yPos + 3)

        yPos += 16
        doc.setFont('times', 'normal')
        doc.setFontSize(16)
        // Texto com vínculo explícito da data
        doc.text(`participou do curso de preparação de Pais e Padrinhos para o Batismo,`, width / 2, yPos, { align: 'center' })
        yPos += 8
        doc.text(`realizado em ${pessoa.data}`, width / 2, yPos, { align: 'center' })
        
        yPos += 12
        doc.text(`referente ao batismo do(a) batizando(a) ${pessoa.batizando}`, width / 2, yPos, { align: 'center' })

        yPos += 10
        doc.setFontSize(14)
        doc.text('Validade: 01 ano', width / 2, yPos, { align: 'center' })

        // --- Assinaturas ---
        const sigY = height - 35 // Baixado para evitar sobreposição
        const leftX = width / 4 + 10
        const rightX = (width / 4) * 3 - 10

        doc.setLineWidth(0.5)
        doc.setDrawColor(0, 0, 0)
        doc.setFontSize(12)
        doc.setFont('times', 'normal')

        // Assinatura Pároco (Esquerda)
        doc.line(leftX - 40, sigY, leftX + 40, sigY)
        doc.text('Pároco', leftX, sigY + 6, { align: 'center' })

        // Assinatura Coordenador (Direita)
        doc.line(rightX - 40, sigY, rightX + 40, sigY)
        doc.text('Coordenador(a) da Pastoral', rightX, sigY + 6, { align: 'center' })
      } catch (pageErr) {
        console.error('Erro ao gerar página do certificado:', pageErr)
        alert(`Erro ao gerar página do certificado para ${pessoa.nome}. Detalhes: ${pageErr.message}`)
      }
    })

    // Salvar diretamente para garantir que o usuário receba o arquivo
    doc.save('certificados-batismo.pdf')
    
  } catch (e) {
    console.error('Erro fatal na geração do PDF:', e)
    alert('Ocorreu um erro ao criar o arquivo PDF. Verifique o console do navegador para mais detalhes.')
  }
}

function getDadosPessoa(id, role) {
  const inscricao = inscricoes.find(i => i.id === id)
  if (!inscricao) return null

  let pessoa = null
  let papelStr = ''

  if (role === 'pai') { pessoa = inscricao.pai; papelStr = 'Pai' }
  else if (role === 'mae') { pessoa = inscricao.mae; papelStr = 'Mãe' }
  else if (role === 'padrinho') { pessoa = inscricao.padrinho; papelStr = 'Padrinho' }
  else if (role === 'madrinha') { pessoa = inscricao.madrinha; papelStr = 'Madrinha' }

  if (!pessoa) return null

  // Formata a data da reunião ou usa a data atual se não houver
  let dataReuniaoStr = 'Data não informada'
  if (inscricao.dataReuniao) {
    dataReuniaoStr = formatDateShort(inscricao.dataReuniao)
  } else {
     dataReuniaoStr = new Date().toLocaleDateString('pt-BR')
  }

  const batizando = inscricao.batizando.nome || 'Batizando'

  return {
    nome: pessoa.nome,
    papel: papelStr,
    batizando: batizando,
    data: dataReuniaoStr,
    presente: pessoa.presente
  }
}

async function gerarCertificadoIndividual(id, role) {
  if (!window.jspdf) {
    alert('Erro: Biblioteca PDF não carregada. Tente recarregar a página.')
    return
  }

  const dados = getDadosPessoa(id, role)
  if (!dados) {
    alert('Dados não encontrados.')
    return
  }
  
  if (!dados.presente) {
    if(!confirm(`A presença de ${dados.nome} não está confirmada ("Não"). Deseja gerar o certificado mesmo assim?`)) {
      return
    }
  }

  await gerarPDFCertificados([dados])
}

async function gerarCertificados() {
  if (!window.jspdf) {
    alert('Erro: Biblioteca PDF não carregada. Tente recarregar a página.')
    return
  }

  // Lógica de seleção igual ao exportarPDF
  const selectedIds = getSelectedIds()
  let dados = getFilteredData()
  
  if (selectedIds.length > 0) {
    dados = dados.filter(i => selectedIds.includes(i.id))
  }

  if (dados.length === 0) {
    alert('Nenhuma inscrição encontrada para gerar certificados.')
    return
  }

  // Coletar pessoas presentes
  const pessoasParaCertificado = []
  
  dados.forEach(inscricao => {
    // Formata a data da reunião ou usa a data atual se não houver
    let dataReuniaoStr = 'Data não informada'
    if (inscricao.dataReuniao) {
      dataReuniaoStr = formatDateShort(inscricao.dataReuniao)
    } else {
       dataReuniaoStr = new Date().toLocaleDateString('pt-BR')
    }

    const batizando = inscricao.batizando.nome || 'Batizando'

    const checkAndAdd = (pessoa, papel) => {
      // Verifica se a pessoa existe, tem nome e PRESENÇA MARCADA
      if (pessoa && pessoa.nome && pessoa.presente) {
        pessoasParaCertificado.push({
          nome: pessoa.nome,
          papel: papel,
          batizando: batizando,
          data: dataReuniaoStr
        })
      }
    }

    checkAndAdd(inscricao.pai, 'Pai')
    checkAndAdd(inscricao.mae, 'Mãe')
    checkAndAdd(inscricao.padrinho, 'Padrinho')
    checkAndAdd(inscricao.madrinha, 'Madrinha')
  })

  if (pessoasParaCertificado.length === 0) {
    alert('Nenhuma pessoa com presença confirmada ("Sim") encontrada nas inscrições selecionadas/listadas.')
    return
  }

  if (!confirm(`Serão gerados ${pessoasParaCertificado.length} certificados. Deseja continuar?`)) return

  await gerarPDFCertificados(pessoasParaCertificado)
}

if (btnCertificados) {
  btnCertificados.addEventListener('click', gerarCertificados)
}