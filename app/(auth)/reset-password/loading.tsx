export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen animate-pulse">
      <div className="w-full max-w-md space-y-6">
        <div className="h-8 bg-muted rounded w-1/2 mx-auto" />
        <div className="h-64 bg-muted rounded" />
      </div>
    </div>
  )
}

