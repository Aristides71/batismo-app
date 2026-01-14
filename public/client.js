document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('inscricao-form')
  const statusEl = document.getElementById('status')
  const selectData = document.getElementById('dataReuniao')

  // Carregar datas disponíveis
  try {
    const res = await fetch('/api/datas-reuniao')
    if (res.ok) {
      const data = await res.json()
      if (data.ok && Array.isArray(data.items)) {
        selectData.innerHTML = '<option value="">Selecione uma data...</option>'
        if (data.items.length === 0) {
          selectData.innerHTML = '<option value="">Nenhuma data disponível</option>'
        } else {
          data.items.forEach(item => {
            const dateObj = new Date(item.meeting_date)
            // Ajuste fuso horário se necessário, mas date string YYYY-MM-DD é segura se usada como string
            // Vamos formatar para PT-BR visualmente
            const dataFormatada = dateObj.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
            const opt = document.createElement('option')
            opt.value = item.meeting_date
            opt.textContent = `${dataFormatada} às ${item.meeting_time.slice(0, 5)}`
            selectData.appendChild(opt)
          })
        }
      }
    } else {
      selectData.innerHTML = '<option value="">Erro ao carregar datas</option>'
    }
  } catch (e) {
    console.error(e)
    selectData.innerHTML = '<option value="">Erro de conexão</option>'
  }

  form.addEventListener('submit', async e => {
    e.preventDefault()
    statusEl.textContent = ''

    const payload = {
      batizandoNome: document.getElementById('batizandoNome').value.trim(),
      paiNome: document.getElementById('paiNome').value.trim(),
      paiCelular: document.getElementById('paiCelular').value.trim(),
      maeNome: document.getElementById('maeNome').value.trim(),
      maeCelular: document.getElementById('maeCelular').value.trim(),
      padrinhoNome: document.getElementById('padrinhoNome').value.trim(),
      madrinhaNome: document.getElementById('madrinhaNome').value.trim(),
      dataReuniao: document.getElementById('dataReuniao').value
    }

    try {
      const res = await fetch('/api/inscricoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Erro ao enviar')
      }
      statusEl.textContent = 'Inscrição enviada com sucesso'
      statusEl.classList.remove('erro')
      statusEl.classList.add('ok')
      form.reset()
    } catch (err) {
      statusEl.textContent = err.message
      statusEl.classList.remove('ok')
      statusEl.classList.add('erro')
    }
  })
})
