'use client'
import { useQuery } from '@tanstack/react-query'
import React from 'react'

type Alert = {
  id: string
  symbol: string
  severity: 'low' | 'medium' | 'high'
  message: string
  created_at: string
}

async function fetchAlerts(): Promise<Alert[]> {
  // Placeholder: wire to your API when available
  return [
    { id: '1', symbol: 'SPY', severity: 'medium', message: 'Volume spike', created_at: new Date().toISOString() },
    { id: '2', symbol: 'BTC/USD', severity: 'high', message: 'Price anomaly', created_at: new Date().toISOString() }
  ]
}

export default function AlertsPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ['alerts'], queryFn: fetchAlerts })

  return (
    <div className="min-h-screen grid grid-cols-[260px_1fr]">
      <aside className="bg-[#0b0f1a] border-r border-zinc-800 p-4">
        <div className="font-semibold mb-4">Admin</div>
        <nav className="space-y-2 text-sm">
          <a className="block text-zinc-300 hover:text-white" href="/admin">Dashboard</a>
          <a className="block text-zinc-300 hover:text-white" href="/admin/pyramid">Pyramid Strategy</a>
          <a className="block text-white font-semibold" href="/admin/alerts">Alerts</a>
        </nav>
      </aside>
      <main className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold">Alerts</h1>
          <div className="text-sm text-zinc-400">{isLoading ? 'Loading…' : `${data.length} alerts`}</div>
        </div>
        <div className="overflow-auto border border-zinc-800 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-[#0f1422] text-zinc-300">
              <tr>
                <th className="text-left p-3">Symbol</th>
                <th className="text-left p-3">Severity</th>
                <th className="text-left p-3">Message</th>
                <th className="text-left p-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.map(a => (
                <tr key={a.id} className="border-t border-zinc-800">
                  <td className="p-3">{a.symbol}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs ${a.severity === 'high' ? 'bg-red-500/20 text-red-400' : a.severity === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{a.severity}</span>
                  </td>
                  <td className="p-3">{a.message}</td>
                  <td className="p-3 text-zinc-400">{new Date(a.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}


