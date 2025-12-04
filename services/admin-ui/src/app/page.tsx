export default function Page() {
  return (
    <div className="min-h-screen grid grid-cols-[260px_1fr]">
      <aside className="bg-[#0b0f1a] border-r border-zinc-800 p-4">
        <div className="font-semibold mb-4">Admin</div>
        <nav className="space-y-2 text-sm">
          <a className="block text-zinc-300 hover:text-white" href="/admin">Dashboard</a>
          <a className="block text-zinc-300 hover:text-white" href="/admin/alerts">Alerts</a>
        </nav>
      </aside>
      <main className="p-6">
        <h1 className="text-xl font-semibold mb-4">Dashboard</h1>
        <div className="text-sm text-zinc-400">Welcome to the administration console.</div>
      </main>
    </div>
  )
}


