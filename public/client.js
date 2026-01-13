document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('inscricao-form')
  const statusEl = document.getElementById('status')

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
