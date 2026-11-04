import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import { AppShell } from '../components/AppShell'

export const metadata: Metadata = {
  title: 'LLM Wiki Enterprise Knowledge Base',
  description: 'An intelligent knowledge base for enterprise material',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" data-theme="dark">
      <body className="min-h-screen antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
