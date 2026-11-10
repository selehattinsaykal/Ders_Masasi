export type Theme = 'sistem' | 'acik' | 'koyu'

export function getTheme(): Theme {
  const t = localStorage.getItem('tema')
  return t === 'acik' || t === 'koyu' ? t : 'sistem'
}

export function isDark(): boolean {
  return document.documentElement.classList.contains('dark')
}

export function applyTheme(theme: Theme): void {
  localStorage.setItem('tema', theme)
  const dark = theme === 'koyu' || (theme === 'sistem' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#10142a' : '#2747d4')
}
