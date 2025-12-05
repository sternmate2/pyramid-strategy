'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RootPage() {
  const router = useRouter()
  
  useEffect(() => {
    router.push('/admin')
  }, [router])
  
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-zinc-400">Redirecting...</div>
    </div>
  )
}
