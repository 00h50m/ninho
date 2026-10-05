import type { Metadata, Viewport } from 'next'
import '@/styles/tokens.css'
import '@/styles/app.css'
import { THEME_BOOT } from '@/lib/theme'

export const metadata: Metadata = {
  title: 'Ninho',
  description: 'Sistema operacional da sua casa',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'Ninho', statusBarStyle: 'default' },
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6efe6' },
    { media: '(prefers-color-scheme: dark)', color: '#0f0f0e' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
}
