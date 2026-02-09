"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"

export interface BookingRequestFormState {
  customerId: string | null
  averagePalletDays: number
  requestedFloor: string
  ownerOfProduct: string
  skuCount: number
  isSingleType: boolean
  notes: string
  requiresApproval: boolean
  poInfo: string
  isLabellingRequired: boolean
}

export interface BookingRequestDetailsFormMember {
  memberId: string
  name?: string
  email?: string
  teamName?: string
  companyName?: string | null
}

export interface BookingRequestDetailsFormProps {
  form: BookingRequestFormState
  setForm: (updater: (prev: BookingRequestFormState) => BookingRequestFormState) => void
  members: BookingRequestDetailsFormMember[]
  isLoadingMembers: boolean
  isTeamAdmin: boolean
  showClientSelect: boolean
  onSubmit: (e: React.FormEvent) => void
  submitLabel: string
  onCancel?: () => void
  cancelLabel?: string
  isSubmitting?: boolean
  /** When members list is empty (e.g. edit: "No other team members for this client's company.") */
  emptyListMessage?: string
}

export function BookingRequestDetailsForm({
  form,
  setForm,
  members,
  isLoadingMembers,
  isTeamAdmin,
  showClientSelect,
  onSubmit,
  submitLabel,
  onCancel,
  cancelLabel,
  isSubmitting = false,
  emptyListMessage,
}: BookingRequestDetailsFormProps) {
  const defaultEmptyMessage =
    "No partner clients in your team. Add partner company members in My Company to book on their behalf."
  const selectClientOptions =
    form.customerId && !members.some((m) => m.memberId === form.customerId)
      ? [
          {
            memberId: form.customerId,
            name: "Yourself",
            email: "",
            teamName: "",
            companyName: null as string | null,
          },
          ...members,
        ]
      : members

  return (
    <form onSubmit={onSubmit} className="space-y-4 py-2">
      {showClientSelect && (
        <div className="space-y-2">
          <Label>Request on behalf of (select a client from your team)</Label>
          {isLoadingMembers ? (
            <p className="text-sm text-muted-foreground py-2">Loading team members…</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-md border border-dashed p-3">
              {emptyListMessage ?? defaultEmptyMessage}
            </p>
          ) : (
            <Select
              value={form.customerId ?? ""}
              onValueChange={(v) => setForm((p) => ({ ...p, customerId: v || null }))}
              required={showClientSelect}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a client from your team" />
              </SelectTrigger>
              <SelectContent>
                {selectClientOptions.map((m) => (
                  <SelectItem key={m.memberId} value={m.memberId}>
                    {m.name || m.email || "Team member"}
                    {m.teamName ? ` (${m.teamName})` : ""}
                    {m.companyName ? ` · ${m.companyName}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
      {showClientSelect && isTeamAdmin && (
        <div className="space-y-2 rounded-lg border p-4">
          <Label>Approval for this request (on behalf of client)</Label>
          <p className="text-xs text-muted-foreground">
            Pre-approved: request is confirmed without client approval. Requires approval: client must approve before confirmation.
          </p>
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant={form.requiresApproval === false ? "default" : "outline"}
              size="sm"
              onClick={() => setForm((p) => ({ ...p, requiresApproval: false }))}
            >
              Pre-approved
            </Button>
            <Button
              type="button"
              variant={form.requiresApproval !== false ? "default" : "outline"}
              size="sm"
              onClick={() => setForm((p) => ({ ...p, requiresApproval: true }))}
            >
              Requires approval
            </Button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="averagePalletDays">Average days per pallet (storage duration)</Label>
        <Input
          id="averagePalletDays"
          type="number"
          min={1}
          value={form.averagePalletDays}
          onChange={(e) =>
            setForm((p) => ({ ...p, averagePalletDays: parseInt(e.target.value, 10) || 0 }))
          }
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="requestedFloor">Requested floor</Label>
        <Input
          id="requestedFloor"
          type="text"
          placeholder="e.g. Ground, 1, 2"
          value={form.requestedFloor}
          onChange={(e) => setForm((p) => ({ ...p, requestedFloor: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ownerOfProduct">Owner of product</Label>
        <Input
          id="ownerOfProduct"
          type="text"
          placeholder="Company or contact name"
          value={form.ownerOfProduct}
          onChange={(e) => setForm((p) => ({ ...p, ownerOfProduct: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="poInfo">PO (Purchase Order)</Label>
        <Input
          id="poInfo"
          type="text"
          placeholder="PO number or reference (optional)"
          value={form.poInfo}
          onChange={(e) => setForm((p) => ({ ...p, poInfo: e.target.value }))}
        />
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="isLabellingRequired"
          checked={form.isLabellingRequired}
          onCheckedChange={(checked) =>
            setForm((p) => ({ ...p, isLabellingRequired: checked === true }))
          }
        />
        <Label htmlFor="isLabellingRequired" className="font-normal cursor-pointer">
          Labelling required
        </Label>
      </div>
      <div className="space-y-2">
        <Label htmlFor="skuCount">How many SKU / products</Label>
        <Input
          id="skuCount"
          type="number"
          min={1}
          value={form.skuCount}
          onChange={(e) =>
            setForm((p) => ({ ...p, skuCount: parseInt(e.target.value, 10) || 0 }))
          }
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Special message (optional)</Label>
        <Textarea
          id="notes"
          placeholder="Any special instructions or notes for the warehouse…"
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          rows={3}
          className="min-h-[80px] resize-y"
        />
      </div>
      <div className="space-y-2 rounded-lg border p-4">
        <Label>Single product type?</Label>
        <p className="text-xs text-muted-foreground">
          Single type may qualify for discount (e.g. 20% – set by warehouse admin)
        </p>
        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant={form.isSingleType ? "default" : "outline"}
            size="sm"
            onClick={() => setForm((p) => ({ ...p, isSingleType: true }))}
          >
            Yes
          </Button>
          <Button
            type="button"
            variant={!form.isSingleType ? "default" : "outline"}
            size="sm"
            onClick={() => setForm((p) => ({ ...p, isSingleType: false }))}
          >
            No
          </Button>
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        {onCancel && cancelLabel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
        )}
        <Button type="submit" className={onCancel && cancelLabel ? "flex-1" : ""} disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  )
}
