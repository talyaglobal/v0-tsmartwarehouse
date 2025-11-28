"use client"

import { useState } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Checkbox } from "@/components/ui/checkbox"
import { Search, Clock, FileText, Download, CheckCircle2, AlertCircle } from "lucide-react"
import { sopTemplates, type SOPTemplate, type SOPCategory } from "@/lib/sop/templates"

const categoryColors: Record<SOPCategory, string> = {
  receiving: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  storage: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  picking: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  shipping: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  safety: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  maintenance: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  incident: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
}

export default function SOPPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<SOPCategory | "all">("all")

  const filteredSOPs = sopTemplates.filter((sop) => {
    const matchesSearch =
      sop.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sop.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === "all" || sop.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const categories: (SOPCategory | "all")[] = [
    "all",
    "receiving",
    "storage",
    "picking",
    "shipping",
    "safety",
    "maintenance",
    "incident",
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Standard Operating Procedures"
        description="Manage and review warehouse operational procedures"
      >
        <Button>
          <FileText className="mr-2 h-4 w-4" />
          Create New SOP
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search procedures..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
              className="capitalize"
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {/* SOP Cards */}
      <div className="grid gap-6">
        {filteredSOPs.map((sop) => (
          <SOPCard key={sop.id} sop={sop} />
        ))}

        {filteredSOPs.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No procedures found matching your criteria
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function SOPCard({ sop }: { sop: SOPTemplate }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle>{sop.name}</CardTitle>
              <Badge className={categoryColors[sop.category]} variant="secondary">
                {sop.category}
              </Badge>
              <Badge variant="outline">v{sop.version}</Badge>
            </div>
            <CardDescription className="mt-1">{sop.description}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {sop.estimatedTotalMinutes} minutes
          </span>
          <span>{sop.steps.length} steps</span>
          <span>Last updated: {sop.lastUpdated}</span>
          <span>Approved by: {sop.approvedBy}</span>
        </div>
      </CardHeader>
      <CardContent>
        {/* Safety Notes */}
        {sop.safetyNotes.length > 0 && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 dark:bg-red-950">
            <div className="flex items-center gap-2 font-medium text-red-800 dark:text-red-200">
              <AlertCircle className="h-4 w-4" />
              Safety Notes
            </div>
            <ul className="mt-2 space-y-1 text-sm text-red-700 dark:text-red-300">
              {sop.safetyNotes.map((note, idx) => (
                <li key={idx}>• {note}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Required Equipment */}
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">Required Equipment</h4>
          <div className="flex flex-wrap gap-2">
            {sop.requiredEquipment.map((item, idx) => (
              <Badge key={idx} variant="secondary">
                {item}
              </Badge>
            ))}
          </div>
        </div>

        {/* Steps Accordion */}
        <Accordion type="single" collapsible className="w-full">
          {sop.steps.map((step) => (
            <AccordionItem key={step.id} value={step.id}>
              <AccordionTrigger>
                <div className="flex items-center gap-3 text-left">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    {step.order}
                  </span>
                  <span>{step.title}</span>
                  <span className="text-xs text-muted-foreground">({step.estimatedMinutes} min)</span>
                  {step.requiresApproval && (
                    <Badge variant="outline" className="ml-2">
                      Requires Approval
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pl-9">
                  <p className="text-sm text-muted-foreground">{step.description}</p>

                  {step.requiredRole && (
                    <p className="text-sm">
                      <span className="font-medium">Required Role:</span>{" "}
                      <Badge variant="secondary" className="capitalize">
                        {step.requiredRole.replace("_", " ")}
                      </Badge>
                    </p>
                  )}

                  <div>
                    <h5 className="text-sm font-medium mb-2">Checklist</h5>
                    <div className="space-y-2">
                      {step.checklistItems.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Checkbox id={`${step.id}-${idx}`} />
                          <label htmlFor={`${step.id}-${idx}`} className="text-sm cursor-pointer">
                            {item}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {step.warningNotes && step.warningNotes.length > 0 && (
                    <div className="rounded bg-amber-50 p-2 dark:bg-amber-950">
                      <div className="flex items-center gap-1 text-sm font-medium text-amber-800 dark:text-amber-200">
                        <AlertCircle className="h-4 w-4" />
                        Warning
                      </div>
                      <ul className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                        {step.warningNotes.map((note, idx) => (
                          <li key={idx}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {step.requiresApproval && (
                    <div className="flex items-center gap-2 rounded bg-blue-50 p-2 text-sm text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                      <CheckCircle2 className="h-4 w-4" />
                      This step requires approval from: {step.approverRole}
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  )
}
