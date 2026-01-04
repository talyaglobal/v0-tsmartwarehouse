"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SearchFilters } from "@/components/marketplace/search-filters"
import { WarehouseCard } from "@/components/marketplace/warehouse-card"
import { BookingSearchForm } from "@/components/home/booking-search-form"
import { Card, CardContent } from "@/components/ui/card"
import { Warehouse as WarehouseIcon, LayoutGrid, List } from "@/components/icons"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { useUser } from "@/lib/hooks/use-user"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { WarehouseSearchParams, WarehouseSearchResult } from "@/types/marketplace"

export default function FindWarehousesPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useUser()
  const [warehouses, setWarehouses] = useState<WarehouseSearchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid")
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Build search filters from URL params
  const buildFiltersFromParams = (): Partial<WarehouseSearchParams> => {
    const filters: Partial<WarehouseSearchParams> = {
      city: searchParams.get("location") || undefined,
      type: (searchParams.get("type") as "pallet" | "area-rental") || undefined,
      quantity: searchParams.get("palletCount") 
        ? parseInt(searchParams.get("palletCount")!) 
        : searchParams.get("areaSqFt")
        ? parseInt(searchParams.get("areaSqFt")!)
        : undefined,
      start_date: searchParams.get("startDate") || undefined,
      end_date: searchParams.get("endDate") || undefined,
      warehouse_type: searchParams.get("warehouse_type")?.split(",").filter(Boolean),
      storage_type: searchParams.get("storage_type")?.split(",").filter(Boolean),
      temperature_types: searchParams.get("temperature_types")?.split(",").filter(Boolean),
      amenities: searchParams.get("amenities")?.split(",").filter(Boolean),
      min_price: searchParams.get("min_price") ? parseFloat(searchParams.get("min_price")!) : undefined,
      max_price: searchParams.get("max_price") ? parseFloat(searchParams.get("max_price")!) : undefined,
      min_rating: searchParams.get("min_rating") ? parseFloat(searchParams.get("min_rating")!) : undefined,
      sort_by: (searchParams.get("sort_by") as any) || "distance",
      sort_order: (searchParams.get("sort_order") as "asc" | "desc") || "asc",
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!) : 1,
      limit: 20,
    }
    return filters
  }

  const [filters, setFilters] = useState<Partial<WarehouseSearchParams>>(buildFiltersFromParams())

  // Extract initial values for BookingSearchForm
  const initialLocation = searchParams.get("location") || ""
  const initialStorageType = (searchParams.get("type") as "pallet" | "area-rental") || "pallet"
  const initialStartDate = searchParams.get("startDate") || ""
  const initialEndDate = searchParams.get("endDate") || ""
  const initialPalletCount = searchParams.get("palletCount") ? parseInt(searchParams.get("palletCount")!) : undefined
  const initialAreaSqFt = searchParams.get("areaSqFt") ? parseInt(searchParams.get("areaSqFt")!) : undefined

  // Update filters when URL params change
  useEffect(() => {
    setFilters(buildFiltersFromParams())
    setPage(searchParams.get("page") ? parseInt(searchParams.get("page")!) : 1)
  }, [searchParams])

  // Fetch warehouses with filters
  useEffect(() => {
    const fetchWarehouses = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        
        // Add all filter params
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            if (Array.isArray(value)) {
              if (value.length > 0) {
                params.set(key, value.join(","))
              }
            } else {
              params.set(key, String(value))
            }
          }
        })

        const url = `/api/v1/warehouses/public/search?${params.toString()}`
        const response = await fetch(url)
        const data = await response.json()

        if (data.success && data.data) {
          setWarehouses(data.data.warehouses || [])
          setTotal(data.data.total || 0)
          setPage(data.data.page || 1)
          setTotalPages(data.data.total_pages || 1)
        } else {
          setWarehouses([])
          setTotal(0)
        }
      } catch (error) {
        console.error("[find-warehouses] Failed to fetch warehouses:", error)
        setWarehouses([])
        setTotal(0)
      } finally {
        setLoading(false)
      }
    }

    fetchWarehouses()
  }, [filters])

  const handleFiltersChange = (newFilters: Partial<WarehouseSearchParams>) => {
    setFilters({ ...filters, ...newFilters, page: 1 })
    // Update URL params
    const params = new URLSearchParams()
    Object.entries({ ...filters, ...newFilters }).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          if (value.length > 0) params.set(key, value.join(","))
        } else {
          params.set(key, String(value))
        }
      }
    })
    router.push(`/find-warehouses?${params.toString()}`)
  }

  const handleClearFilters = () => {
    setFilters({ page: 1, limit: 20 })
    router.push("/find-warehouses")
  }

  const handleSortChange = (sortBy: string) => {
    handleFiltersChange({ sort_by: sortBy as any, page: 1 })
  }

  const handlePageChange = (newPage: number) => {
    handleFiltersChange({ page: newPage })
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <WarehouseIcon className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">TSmart Warehouse</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/#services" className="text-sm font-medium hover:text-primary transition-colors">
              Services
            </Link>
            <Link href="/#pricing" className="text-sm font-medium hover:text-primary transition-colors">
              Pricing
            </Link>
            <Link href="/#facility" className="text-sm font-medium hover:text-primary transition-colors">
              Facility
            </Link>
            <Link href="/#contact" className="text-sm font-medium hover:text-primary transition-colors">
              Contact
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            {user ? (
              <Link href="/dashboard">
                <Button variant="ghost">Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost">Sign In</Button>
                </Link>
                <Link href="/register">
                  <Button>Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Search Form Section */}
        <section className="bg-gradient-to-br from-primary/10 via-background to-background py-4 border-b">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto">
              <BookingSearchForm
                initialValues={{
                  location: initialLocation,
                  storageType: initialStorageType,
                  startDate: initialStartDate,
                  endDate: initialEndDate,
                  palletCount: initialPalletCount,
                  areaSqFt: initialAreaSqFt,
                }}
                showSubmitButton={true}
                compact={true}
              />
            </div>
          </div>
        </section>

        <div className="container mx-auto px-4 py-8">
          <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
            {/* Left Sidebar - Filters */}
            <aside className="lg:sticky lg:top-4 lg:self-start">
              <SearchFilters
                filters={filters}
                onFiltersChange={handleFiltersChange}
                onClear={handleClearFilters}
              />
            </aside>

            {/* Right Content - Warehouse List/Grid */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xl font-bold">
                  {total} warehouse{total !== 1 ? "s" : ""} found
                </p>
                <div className="flex items-center gap-4">
                  {/* Sort Options */}
                  <Select
                    value={filters.sort_by || "distance"}
                    onValueChange={handleSortChange}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="distance">Distance</SelectItem>
                      <SelectItem value="price">Price</SelectItem>
                      <SelectItem value="rating">Rating</SelectItem>
                      <SelectItem value="availability">Availability</SelectItem>
                      <SelectItem value="name">Name</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex gap-0 rounded-md border overflow-hidden">
                    <button
                      onClick={() => setViewMode("list")}
                      className={`px-3 py-1.5 text-sm flex items-center gap-2 transition-colors ${
                        viewMode === "list"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background hover:bg-muted"
                      }`}
                    >
                      <List className="h-4 w-4" />
                      List
                    </button>
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`px-3 py-1.5 text-sm flex items-center gap-2 transition-colors ${
                        viewMode === "grid"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background hover:bg-muted"
                      }`}
                    >
                      <LayoutGrid className="h-4 w-4" />
                      Grid
                    </button>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Loading warehouses...</p>
                </div>
              ) : warehouses.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No warehouses found matching your criteria.</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Try adjusting your filters or search location.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className={viewMode === "grid" 
                    ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    : "space-y-4"
                  }>
                    {warehouses.map((warehouse) => (
                      <WarehouseCard
                        key={warehouse.id}
                        warehouse={warehouse}
                        viewMode={viewMode}
                        searchParams={{
                          type: filters.type,
                          palletCount: filters.type === "pallet" && filters.quantity ? filters.quantity.toString() : undefined,
                          areaSqFt: filters.type === "area-rental" && filters.quantity ? filters.quantity.toString() : undefined,
                          startDate: filters.start_date,
                          endDate: filters.end_date,
                        }}
                      />
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-6">
                      <Button
                        variant="outline"
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {page} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page >= totalPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}


