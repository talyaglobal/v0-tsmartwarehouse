"use client"

import { useState, useEffect } from "react"
import { WarehouseCard } from "@/components/marketplace/warehouse-card"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Heart, Loader2 } from "lucide-react"
import type { WarehouseSearchResult } from "@/types/marketplace"

interface Favorite {
  id: string
  warehouse_id: string
  notes?: string
  created_at: string
  warehouses?: {
    id: string
    name: string
    address: string
    city: string
    photos: string[]
  }
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseSearchResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFavorites()
  }, [])

  const fetchFavorites = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/v1/favorites")
      const data = await response.json()

      if (data.success) {
        setFavorites(data.data || [])

        // Fetch full warehouse details for each favorite
        const warehouseIds = data.data.map((f: Favorite) => f.warehouse_id)
        if (warehouseIds.length > 0) {
          const warehousePromises = warehouseIds.map((id: string) =>
            fetch(`/api/v1/warehouses/public/search?limit=1&warehouse_id=${id}`)
              .then((res) => res.json())
              .then((data) => data.data?.warehouses?.[0])
              .catch(() => null)
          )

          const warehouseData = await Promise.all(warehousePromises)
          setWarehouses(warehouseData.filter(Boolean))
        }
      }
    } catch (error) {
      console.error("Error fetching favorites:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveFavorite = async (warehouseId: string) => {
    try {
      const response = await fetch(`/api/v1/favorites?warehouse_id=${warehouseId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setFavorites((prev) => prev.filter((f) => f.warehouse_id !== warehouseId))
        setWarehouses((prev) => prev.filter((w) => w.id !== warehouseId))
      }
    } catch (error) {
      console.error("Error removing favorite:", error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">My Favorites</h1>
        <p className="text-muted-foreground">
          {favorites.length} {favorites.length === 1 ? "warehouse" : "warehouses"} saved
        </p>
      </div>

      {favorites.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Heart className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No favorites yet</h2>
            <p className="text-muted-foreground mb-4">
              Start exploring warehouses and save your favorites
            </p>
            <Button asChild>
              <a href="/find-warehouses">Browse Warehouses</a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {warehouses.map((warehouse) => {
            const favorite = favorites.find((f) => f.warehouse_id === warehouse.id)
            return (
              <div key={warehouse.id} className="relative">
                <WarehouseCard warehouse={warehouse} viewMode="grid" />
                {favorite?.notes && (
                  <div className="mt-2 p-2 bg-muted rounded-md text-sm">
                    <p className="text-muted-foreground italic">"{favorite.notes}"</p>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => handleRemoveFavorite(warehouse.id)}
                >
                  <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

