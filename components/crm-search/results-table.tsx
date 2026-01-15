"use client"

import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { updateResultStatus } from "@/app/crm-search/actions"
import { Badge } from "@/components/ui/badge"

interface ResultRow {
  id: string
  title: string
  url: string
  domain: string
  classification_segment: string | null
  score: number
  status: string
  extracted_emails: string[]
  extracted_phones: string[]
}

export function ResultsTable({ results }: { results: ResultRow[] }) {
  const [isPending, startTransition] = useTransition()

  const handleUpdate = (id: string, status: "approved" | "rejected" | "reviewed") => {
    startTransition(async () => {
      await updateResultStatus({ resultId: id, status })
    })
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Company</TableHead>
          <TableHead>Segment</TableHead>
          <TableHead>Score</TableHead>
          <TableHead>Contact Signals</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {results.map((result) => (
          <TableRow key={result.id}>
            <TableCell className="space-y-1">
              <div className="font-medium">{result.title}</div>
              <div className="text-xs text-muted-foreground">{result.domain}</div>
            </TableCell>
            <TableCell>
              {result.classification_segment ? (
                <Badge variant="outline">{result.classification_segment}</Badge>
              ) : (
                "-"
              )}
            </TableCell>
            <TableCell>{result.score}</TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {result.extracted_emails.length} emails / {result.extracted_phones.length} phones
            </TableCell>
            <TableCell className="text-xs">
              <a href={result.url} target="_blank" rel="noreferrer" className="text-primary underline">
                View source
              </a>
            </TableCell>
            <TableCell className="space-x-2">
              <Button
                size="sm"
                disabled={isPending}
                onClick={() => handleUpdate(result.id, "approved")}
              >
                Create
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => handleUpdate(result.id, "reviewed")}
              >
                Review
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={() => handleUpdate(result.id, "rejected")}
              >
                Skip
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
