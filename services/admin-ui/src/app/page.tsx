export default function Page() {
  return (
    <div className="min-h-screen grid grid-cols-[260px_1fr]">
      <aside className="bg-[#0b0f1a] border-r border-zinc-800 p-4">
        <div className="font-semibold mb-4">Admin</div>
        <nav className="space-y-2 text-sm">
          <a className="block text-white font-semibold" href="/admin">Dashboard</a>
          <a className="block text-zinc-300 hover:text-white" href="/admin/pyramid">Pyramid Strategy</a>
          <a className="block text-zinc-300 hover:text-white" href="/admin/alerts">Alerts</a>
        </nav>
      </aside>
      <main className="p-6">
        <h1 className="text-xl font-semibold mb-4">Dashboard</h1>
        <div className="text-sm text-zinc-400 mb-6">Welcome to the administration console.</div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a href="/admin/pyramid" className="bg-[#0f1422] border border-zinc-800 rounded-lg p-6 hover:border-zinc-700 transition-colors">
            <h2 className="text-lg font-semibold mb-2">📊 Pyramid Strategy</h2>
            <p className="text-sm text-zinc-400">Monitor SPXL pyramid trading strategy with real-time levels, positions, and performance metrics.</p>
          </a>
          
          <a href="/admin/alerts" className="bg-[#0f1422] border border-zinc-800 rounded-lg p-6 hover:border-zinc-700 transition-colors">
            <h2 className="text-lg font-semibold mb-2">🔔 Alerts</h2>
            <p className="text-sm text-zinc-400">View system alerts and notifications for volume spikes and price anomalies.</p>
          </a>
        </div>
      </main>
    </div>
  )
}


