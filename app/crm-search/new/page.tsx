"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { createSearchJob } from "@/app/crm-search/actions"

const SEGMENTS = [
  "warehouse_space_owner",
  "warehouse_space_seeker",
  "3pl_operator",
  "customs_broker",
  "freight_forwarder_international",
  "drayage_trucking_local",
  "warehouse_staffing_jobs",
  "warehouse_job_seekers",
  "equipment_vendor",
  "fmcg_distributor",
  "warehouse_real_estate_broker",
  "bonded_warehouse_antrepo",
  "customs_cbp_facility_directory",
] as const

const PORT_HUBS = [
  "NY_NJ",
  "LA_LB",
  "SAVANNAH",
  "HOUSTON",
  "MIAMI",
  "CHICAGO",
  "DALLAS",
  "ATLANTA",
  "SEATTLE_TACOMA",
] as const

export default function CRMSearchCreate() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedSegments, setSelectedSegments] = useState<string[]>([])
  const [portHubs, setPortHubs] = useState<string[]>([])
  const [states, setStates] = useState<string[]>([])
  const [cities, setCities] = useState<string[]>([])
  const [intent, setIntent] = useState<"buyers" | "suppliers" | "both">("both")
  const [excludedDomains, setExcludedDomains] = useState<string>("")
  const [excludedKeywords, setExcludedKeywords] = useState<string>("")
  const [resultsPerQuery, setResultsPerQuery] = useState<number>(20)

  const handleSubmit = () => {
    if (selectedSegments.length === 0) {
      alert("Select at least one segment.")
      return
    }

    startTransition(async () => {
      const response = await createSearchJob({
        segments: selectedSegments,
        geography: {
          portHubs,
          states,
          cities,
        },
        intent,
        exclusions: {
          domains: excludedDomains
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          keywords: excludedKeywords
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        },
        resultsPerQuery,
      })

      if (response.success && response.jobId) {
        router.push(`/crm-search/${response.jobId}`)
        return
      }

      alert(response.error || "Failed to create search job")
    })
  }

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Search Job</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Segments</Label>
            <div className="grid grid-cols-2 gap-2">
              {SEGMENTS.map((segment) => (
                <label key={segment} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selectedSegments.includes(segment)}
                    onCheckedChange={(checked) => {
                      setSelectedSegments((prev) =>
                        checked ? [...prev, segment] : prev.filter((item) => item !== segment)
                      )
                    }}
                  />
                  {segment}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Port Hubs</Label>
            <div className="grid grid-cols-3 gap-2">
              {PORT_HUBS.map((hub) => (
                <label key={hub} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={portHubs.includes(hub)}
                    onCheckedChange={(checked) => {
                      setPortHubs((prev) =>
                        checked ? [...prev, hub] : prev.filter((item) => item !== hub)
                      )
                    }}
                  />
                  {hub}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>States (comma separated)</Label>
              <Input
                value={states.join(", ")}
                onChange={(event) =>
                  setStates(
                    event.target.value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean)
                  )
                }
                placeholder="CA, TX, NJ"
              />
            </div>
            <div className="space-y-2">
              <Label>Cities (comma separated)</Label>
              <Input
                value={cities.join(", ")}
                onChange={(event) =>
                  setCities(
                    event.target.value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean)
                  )
                }
                placeholder="Los Angeles, Houston"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Intent</Label>
              <Input
                value={intent}
                onChange={(event) => setIntent(event.target.value as "buyers" | "suppliers" | "both")}
              />
            </div>
            <div className="space-y-2">
              <Label>Results per query</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={resultsPerQuery}
                onChange={(event) => setResultsPerQuery(Number(event.target.value) || 20)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Exclude Domains (comma separated)</Label>
              <Input
                value={excludedDomains}
                onChange={(event) => setExcludedDomains(event.target.value)}
                placeholder="example.com, yelp.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Exclude Keywords (comma separated)</Label>
              <Input
                value={excludedKeywords}
                onChange={(event) => setExcludedKeywords(event.target.value)}
                placeholder="jobs, careers"
              />
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={isPending}>
            Create Search Job
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
