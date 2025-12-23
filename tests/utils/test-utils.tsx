import React, { type ReactElement } from 'react'
import { render as baseRender, type RenderOptions } from '@testing-library/react'
import { ThemeProvider } from 'next-themes'

// Custom render function that includes providers
function AllTheProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      {children}
    </ThemeProvider>
  )
}

// Custom render function
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => baseRender(ui, { wrapper: AllTheProviders, ...options })

// Re-export everything from @testing-library/react (including screen)
export * from '@testing-library/react'
// Export our custom render (this overrides the default render from the wildcard export)
export { customRender as render }

