import { redirect } from "next/navigation"

export default function AdminWarehouseFloorPlanPage({
  params,
}: {
  params: { id: string }
}) {
  redirect(`/dashboard/warehouses/${params.id}/floor-plan`)
}
