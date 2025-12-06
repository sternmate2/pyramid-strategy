'use client'
import { useQuery } from '@tanstack/react-query'
import React from 'react'

type StrategyStatus = {
  symbol: string
  highestPrice: number
  lastPrice: number | null
  latestDbPrice: number | null
  latestDbTimestamp: string | null
  latestDbSource: string | null
  levels: {
    levelsBelow: Record<string, { level: number; price: number; percentage: number }>
    levelsAbove: Record<string, { level: number; price: number; percentage: number }>
    levelStates: {
      below: Record<string, any>
      above: Record<string, any>
    }
  }
  positions: Array<{
    id: number
    symbol: string
    price: number
    units: number
    total_value: number
    threshold_level: number
    position_type: string
    status: string
    is_anchor: boolean
    created_at: string
  }>
  stats: {
    total_positions: string
    active_positions: string
    closed_positions: string
    active_value: string
    total_profit: string
  }
  anchorLevel: number | null
  buyCounts: Record<string, number>
}

async function fetchPyramidStatus(): Promise<StrategyStatus> {
  const res = await fetch('/api/v1/pyramid-strategy/SPXL/status')
  if (!res.ok) throw new Error('Failed to fetch')
  const json = await res.json()
  return json.data
}

export default function PyramidPage() {
  const { data, isLoading, error } = useQuery({ 
    queryKey: ['pyramid-status'], 
    queryFn: fetchPyramidStatus,
    refetchInterval: 5000 // Refresh every 5 seconds
  })

  if (isLoading) {
    return (
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <Sidebar />
        <main className="p-6">
          <div className="text-zinc-400">Loading...</div>
        </main>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <Sidebar />
        <main className="p-6">
          <div className="text-red-400">Error loading pyramid strategy data</div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen grid grid-cols-[260px_1fr]">
      <Sidebar />
      <main className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold mb-2">Pyramid Strategy Dashboard</h1>
          <div className="text-sm text-zinc-400">Real-time monitoring for {data.symbol}</div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard 
            title="Current Price" 
            value={data.lastPrice ? `$${data.lastPrice.toFixed(2)}` : 'Market Closed'}
            subtitle={data.lastPrice ? 'Real-time' : 'No real-time data'}
          />
          <MetricCard 
            title="Latest DB Price" 
            value={data.latestDbPrice ? `$${data.latestDbPrice.toFixed(2)}` : 'N/A'}
            subtitle={data.latestDbPrice ? (
              `${data.latestDbSource === 'daily' ? '📊 Daily' : '⏰ Intraday'} ${data.latestDbTimestamp ? new Date(data.latestDbTimestamp).toLocaleDateString() : ''}`
            ) : 'No data'}
          />
          <MetricCard 
            title="Highest Price" 
            value={`$${data.highestPrice.toFixed(2)}`}
            subtitle="All-time high"
          />
          <MetricCard 
            title="Anchor Level" 
            value={data.anchorLevel?.toString() || 'None'}
            subtitle={data.anchorLevel ? 'Active anchor' : 'No anchor set'}
          />
        </div>

        {/* Position Stats */}
        <div className="bg-[#0f1422] border border-zinc-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Position Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <div className="text-2xl font-bold text-emerald-400">{data.stats.active_positions}</div>
              <div className="text-sm text-zinc-400">Active Positions</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{data.stats.total_positions}</div>
              <div className="text-sm text-zinc-400">Total Positions</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-400">{data.stats.closed_positions}</div>
              <div className="text-sm text-zinc-400">Closed Positions</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-400">${parseFloat(data.stats.active_value).toFixed(2)}</div>
              <div className="text-sm text-zinc-400">Active Value</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${parseFloat(data.stats.total_profit) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                ${parseFloat(data.stats.total_profit).toFixed(2)}
              </div>
              <div className="text-sm text-zinc-400">Total P&L</div>
            </div>
          </div>
        </div>

        {/* Levels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Levels Below */}
          <div className="bg-[#0f1422] border border-zinc-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 text-emerald-400">Levels Below (Buy Triggers)</h2>
            <div className="space-y-2">
              {Object.values(data.levels.levelsBelow).map((level) => {
                const buyCount = data.buyCounts[level.level] || 0
                const hasState = data.levels.levelStates.below[level.level]
                return (
                  <div key={level.level} className="flex items-center justify-between p-2 bg-zinc-900/50 rounded">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">
                        {level.level}
                      </div>
                      <div>
                        <div className="font-semibold">${level.price.toFixed(2)}</div>
                        <div className="text-xs text-zinc-400">{level.percentage}%</div>
                      </div>
                    </div>
                    <div className="text-right">
                      {buyCount > 0 && (
                        <div className="text-sm">
                          <span className="text-emerald-400">{buyCount}x bought</span>
                        </div>
                      )}
                      {hasState && (
                        <div className="text-xs text-zinc-500">Active</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Levels Above */}
          <div className="bg-[#0f1422] border border-zinc-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 text-blue-400">Levels Above (Price Targets)</h2>
            <div className="space-y-2">
              {Object.values(data.levels.levelsAbove).map((level) => (
                <div key={level.level} className="flex items-center justify-between p-2 bg-zinc-900/50 rounded">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-sm">
                      {level.level}
                    </div>
                    <div>
                      <div className="font-semibold">${level.price.toFixed(2)}</div>
                      <div className="text-xs text-zinc-400">+{level.percentage}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Open Positions */}
        {data.positions.length > 0 && (
          <div className="bg-[#0f1422] border border-zinc-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Open Positions</h2>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-zinc-300 border-b border-zinc-800">
                  <tr>
                    <th className="text-left p-3">Level</th>
                    <th className="text-left p-3">Price</th>
                    <th className="text-right p-3">Units</th>
                    <th className="text-right p-3">Value</th>
                    <th className="text-left p-3">Type</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Opened</th>
                  </tr>
                </thead>
                <tbody>
                  {data.positions.map((pos) => (
                    <tr key={pos.id} className="border-t border-zinc-800">
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${pos.is_anchor ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-700 text-zinc-300'}`}>
                          L{pos.threshold_level} {pos.is_anchor && '⚓'}
                        </span>
                      </td>
                      <td className="p-3 font-mono">${pos.price.toFixed(2)}</td>
                      <td className="p-3 text-right font-mono">{pos.units}</td>
                      <td className="p-3 text-right font-mono">${pos.total_value.toFixed(2)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs ${pos.position_type === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                          {pos.position_type}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-400">
                          {pos.status}
                        </span>
                      </td>
                      <td className="p-3 text-zinc-400 text-xs">
                        {new Date(pos.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {data.positions.length === 0 && (
          <div className="bg-[#0f1422] border border-zinc-800 rounded-lg p-12 text-center">
            <div className="text-zinc-500 text-lg">No open positions</div>
            <div className="text-zinc-600 text-sm mt-2">Waiting for price to trigger buy levels</div>
          </div>
        )}
      </main>
    </div>
  )
}

function Sidebar() {
  return (
    <aside className="bg-[#0b0f1a] border-r border-zinc-800 p-4">
      <div className="font-semibold mb-4">Admin</div>
      <nav className="space-y-2 text-sm">
        <a className="block text-zinc-300 hover:text-white" href="/admin">Dashboard</a>
        <a className="block text-white font-semibold" href="/admin/pyramid">Pyramid Strategy</a>
        <a className="block text-zinc-300 hover:text-white" href="/admin/alerts">Alerts</a>
      </nav>
    </aside>
  )
}

function MetricCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="bg-[#0f1422] border border-zinc-800 rounded-lg p-6">
      <div className="text-sm text-zinc-400 mb-1">{title}</div>
      <div className="text-3xl font-bold mb-1">{value}</div>
      <div className="text-xs text-zinc-500">{subtitle}</div>
    </div>
  )
}

