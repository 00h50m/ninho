// Testes: o lembrete de água (pop-up) não aparece no meio dos testes. Embrulha o navegador para
// cada contexto novo já começar com o pop-up "silenciado hoje".
module.exports = browser => {
  const orig = browser.newContext.bind(browser)
  browser.newContext = async (...a) => {
    const ctx = await orig(...a)
    await ctx.addInitScript(() => {
      try {
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
        localStorage.setItem('ninho.aguaPop', JSON.stringify({ shown: Date.now(), muted: today }))
      } catch { /* sem armazenamento */ }
    })
    return ctx
  }
  return browser
}
