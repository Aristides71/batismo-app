const socket = io()
const tbody = document.getElementById('inscricoes-body')
const filtroInput = document.getElementById('filtro')
const contadorEl = document.getElementById('contador')
const btnExportar = document.getElementById('btn-exportar')
const btnPDF = document.getElementById('btn-pdf')
const adminEmailInput = document.getElementById('admin-email-input')
const adminEmailAdd = document.getElementById('admin-email-add')
const adminEmailList = document.getElementById('admin-email-list')
const btnFiltros = document.getElementById('btn-filtros')
const areaFiltros = document.getElementById('area-filtros')
const btnLimparFiltros = document.getElementById('btn-limpar-filtros')

// Filtros Avançados
const filtroDataInscricao = document.getElementById('filtro-data-inscricao')
const filtroDataReuniao = document.getElementById('filtro-data-reuniao')
const filtroInicio = document.getElementById('filtro-inicio')
const filtroFim = document.getElementById('filtro-fim')
const filtroSeqIni = document.getElementById('filtro-seq-ini')
const filtroSeqFim = document.getElementById('filtro-seq-fim')
const filtroPresenca = document.getElementById('filtro-presenca')

let inscricoes = []
let dailyChart = null
let monthlyChart = null
let adminEmails = []

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
    seqIni: filtroSeqIni.value,
    seqFim: filtroSeqFim.value,
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

  // Sequência (ID)
  if (f.seqIni) {
    if (i.id < Number(f.seqIni)) return false
  }
  if (f.seqFim) {
    if (i.id > Number(f.seqFim)) return false
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
  return inscricoes
    .slice()
    .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm))
    .filter(i => passaFiltro(i, f))
}

function render() {
  const dados = getFilteredData()
  contadorEl.textContent = `${dados.length} inscrições`
  tbody.innerHTML = ''
  
  const createNameCell = (person, role, id) => `
    <div class="nome-com-presenca">
      <span>${person.nome}</span>
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

  const rows = dados.map(i => `
    <tr>
      <td style="text-align: center;">
        <input type="checkbox" class="row-select" value="${i.id}">
      </td>
      <td data-label="ID">#${i.id}</td>
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
  return Array.from(checkboxes).map(cb => Number(cb.value))
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
  
  dados.sort((a, b) => a.id - b.id)

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

btnFiltros.addEventListener('click', () => {
  areaFiltros.style.display = areaFiltros.style.display === 'none' ? 'flex' : 'none'
})

btnLimparFiltros.addEventListener('click', () => {
  filtroDataInscricao.value = ''
  filtroDataReuniao.value = ''
  filtroInicio.value = ''
  filtroFim.value = ''
  filtroSeqIni.value = ''
  filtroSeqFim.value = ''
  filtroPresenca.value = 'todos'
  render()
})

;[
  filtroInput, filtroDataInscricao, filtroDataReuniao,
  filtroInicio, filtroFim, filtroSeqIni, filtroSeqFim, filtroPresenca
].forEach(el => el.addEventListener('input', render))

btnExportar.addEventListener('click', exportarCSV)
btnPDF.addEventListener('click', exportarPDF)

async function carregarAdmins() {
  if (!adminEmailList) return
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

socket.on('lista_inscricoes', lista => {
  inscricoes = Array.isArray(lista) ? lista.slice() : []
  render()
  updateCharts()
})

socket.on('inscricao_removida', id => {
  inscricoes = inscricoes.filter(i => i.id !== Number(id))
  render()
  updateCharts()
})

socket.on('nova_inscricao', i => {
  inscricoes.push(i)
  render()
  updateCharts()
})

socket.on('atualizacao_presenca', ({ id, role, presente }) => {
  const inscricao = inscricoes.find(i => i.id === id)
  if (inscricao && inscricao[role]) {
    inscricao[role].presente = presente
    render()
  }
})

document.getElementById('check-all').addEventListener('change', (e) => {
  const isChecked = e.target.checked
  document.querySelectorAll('.row-select').forEach(cb => {
    cb.checked = isChecked
  })
})

carregarAdmins()
