'use client'

import * as React from 'react'

export type Theme = 'light' | 'dark' | 'system'

export interface UseThemeProps {
  theme?: string
  setTheme: (theme: string) => void
  resolvedTheme?: 'light' | 'dark'
  systemTheme?: 'light' | 'dark'
  themes: string[]
}

const ThemeContext = React.createContext<UseThemeProps>({
  theme: 'system',
  setTheme: () => {},
  resolvedTheme: 'light',
  systemTheme: 'light',
  themes: ['light', 'dark', 'system'],
})

export interface ThemeProviderProps {
  children: React.ReactNode
  attribute?: 'class' | 'data-theme'
  defaultTheme?: string
  enableSystem?: boolean
  storageKey?: string
  themes?: string[]
  value?: Record<string, string>
  disableTransitionOnChange?: boolean
}

export function ThemeProvider({
  children,
  attribute = 'class',
  defaultTheme = 'system',
  enableSystem = true,
  storageKey = 'theme',
  themes = ['light', 'dark', 'system'],
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<string>(defaultTheme)
  const [resolvedTheme, setResolvedTheme] = React.useState<'light' | 'dark'>('light')
  const [systemTheme, setSystemTheme] = React.useState<'light' | 'dark'>('light')

  const getSystemTheme = React.useCallback((): 'light' | 'dark' => {
    if (typeof window === 'undefined') return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }, [])

  const applyTheme = React.useCallback(
    (targetTheme: string) => {
      if (typeof window === 'undefined') return

      const d = document.documentElement
      const effectiveTheme: 'light' | 'dark' =
        targetTheme === 'system' ? getSystemTheme() : targetTheme === 'dark' ? 'dark' : 'light'

      setResolvedTheme(effectiveTheme)

      if (attribute === 'class') {
        d.classList.remove('light', 'dark')
        d.classList.add(effectiveTheme)
      } else {
        d.setAttribute(attribute, effectiveTheme)
      }

      d.style.colorScheme = effectiveTheme
    },
    [attribute, getSystemTheme]
  )

  // Initialize theme from storage or system on mount
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      const initial = saved || defaultTheme
      setThemeState(initial)
      applyTheme(initial)
      setSystemTheme(getSystemTheme())
    } catch {
      applyTheme(defaultTheme)
    }
  }, [defaultTheme, storageKey, applyTheme, getSystemTheme])

  // Listen for OS system theme changes
  React.useEffect(() => {
    if (!enableSystem || typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      const currentSys = mediaQuery.matches ? 'dark' : 'light'
      setSystemTheme(currentSys)
      try {
        const currentSaved = localStorage.getItem(storageKey) || defaultTheme
        if (currentSaved === 'system') {
          applyTheme('system')
        }
      } catch {
        applyTheme('system')
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [enableSystem, storageKey, defaultTheme, applyTheme])

  // Listen for storage changes across tabs
  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const handleStorage = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        setThemeState(e.newValue)
        applyTheme(e.newValue)
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [storageKey, applyTheme])

  const setTheme = React.useCallback(
    (newTheme: string) => {
      setThemeState(newTheme)
      try {
        localStorage.setItem(storageKey, newTheme)
      } catch {}
      applyTheme(newTheme)
    },
    [storageKey, applyTheme]
  )

  const contextValue = React.useMemo(
    () => ({
      theme,
      setTheme,
      resolvedTheme,
      systemTheme,
      themes,
    }),
    [theme, setTheme, resolvedTheme, systemTheme, themes]
  )

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return React.useContext(ThemeContext)
}
