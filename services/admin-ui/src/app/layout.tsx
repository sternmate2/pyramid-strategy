import './globals.css'
import React from 'react'
import Providers from './providers'

export const metadata = {
  title: 'Admin UI',
  description: 'Administration console'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0f1422] text-zinc-200">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}


