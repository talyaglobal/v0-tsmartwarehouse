export default function Loading() {
  return (
    <div className="min-h-screen animate-pulse">
      <div className="h-20 bg-muted" />
      <div className="space-y-6 p-6">
        <div className="h-96 bg-muted rounded" />
        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-muted rounded" />
          ))}
        </div>
      </div>
    </div>
  )
}

