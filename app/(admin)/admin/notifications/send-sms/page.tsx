/**
 * Admin - Send SMS Page
 * Interface for sending SMS notifications
 */

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { sendSMS, sendBulkSMS } from "@/features/notifications/actions"
import { Loader2, Send, Plus, Trash2, CheckCircle, XCircle } from "lucide-react"

export default function SendSMSPage() {
  // Single SMS state
  const [singlePhone, setSinglePhone] = useState("")
  const [singleMessage, setSingleMessage] = useState("")
  const [singleFrom, setSingleFrom] = useState("TALYA SMART")
  const [singleLoading, setSingleLoading] = useState(false)
  const [singleResult, setSingleResult] = useState<any>(null)

  // Bulk SMS state
  const [bulkMessages, setBulkMessages] = useState<Array<{ to: string; message: string }>>([
    { to: "", message: "" },
  ])
  const [bulkFrom, setBulkFrom] = useState("TALYA SMART")
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkResult, setBulkResult] = useState<any>(null)

  // Handle single SMS send
  const handleSingleSend = async () => {
    if (!singlePhone || !singleMessage) {
      setSingleResult({ success: false, error: "Phone number and message are required" })
      return
    }

    setSingleLoading(true)
    setSingleResult(null)

    try {
      const result = await sendSMS(singlePhone, singleMessage, singleFrom)
      setSingleResult(result)

      if (result.success) {
        // Clear form on success
        setSinglePhone("")
        setSingleMessage("")
      }
    } catch (error) {
      setSingleResult({ success: false, error: "Failed to send SMS" })
    } finally {
      setSingleLoading(false)
    }
  }

  // Handle bulk SMS send
  const handleBulkSend = async () => {
    // Filter out empty messages
    const validMessages = bulkMessages.filter((msg) => msg.to && msg.message)

    if (validMessages.length === 0) {
      setBulkResult({ success: false, error: "At least one valid message is required" })
      return
    }

    setBulkLoading(true)
    setBulkResult(null)

    try {
      const result = await sendBulkSMS(validMessages, bulkFrom)
      setBulkResult(result)

      if (result.success) {
        // Clear form on success
        setBulkMessages([{ to: "", message: "" }])
      }
    } catch (error) {
      setBulkResult({ success: false, error: "Failed to send bulk SMS" })
    } finally {
      setBulkLoading(false)
    }
  }

  // Add new message to bulk list
  const addBulkMessage = () => {
    setBulkMessages([...bulkMessages, { to: "", message: "" }])
  }

  // Remove message from bulk list
  const removeBulkMessage = (index: number) => {
    setBulkMessages(bulkMessages.filter((_, i) => i !== index))
  }

  // Update bulk message
  const updateBulkMessage = (index: number, field: "to" | "message", value: string) => {
    const updated = [...bulkMessages]
    updated[index][field] = value
    setBulkMessages(updated)
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Send SMS Notifications</h1>
        <p className="text-muted-foreground mt-2">
          Send SMS notifications to users via NetGSM
        </p>
      </div>

      <Tabs defaultValue="single" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="single">Single SMS</TabsTrigger>
          <TabsTrigger value="bulk">Bulk SMS</TabsTrigger>
        </TabsList>

        {/* Single SMS Tab */}
        <TabsContent value="single">
          <Card>
            <CardHeader>
              <CardTitle>Send Single SMS</CardTitle>
              <CardDescription>
                Send an SMS message to a single recipient
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="single-phone">Phone Number</Label>
                  <Input
                    id="single-phone"
                    placeholder="5416393028"
                    value={singlePhone}
                    onChange={(e) => setSinglePhone(e.target.value)}
                    maxLength={11}
                  />
                  <p className="text-xs text-muted-foreground">
                    Format: 5XXXXXXXXX (10 digits, Turkish mobile)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="single-message">Message</Label>
                  <Textarea
                    id="single-message"
                    placeholder="Your message here..."
                    value={singleMessage}
                    onChange={(e) => setSingleMessage(e.target.value)}
                    maxLength={160}
                    rows={4}
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Max 160 characters</span>
                    <Badge variant={singleMessage.length > 160 ? "destructive" : "secondary"}>
                      {singleMessage.length}/160
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="single-from">Sender Name (Optional)</Label>
                  <Input
                    id="single-from"
                    placeholder="TALYA SMART"
                    value={singleFrom}
                    onChange={(e) => setSingleFrom(e.target.value)}
                    maxLength={11}
                  />
                  <p className="text-xs text-muted-foreground">
                    Max 11 characters (must be registered with NetGSM)
                  </p>
                </div>
              </div>

              {singleResult && (
                <Alert variant={singleResult.success ? "default" : "destructive"}>
                  <div className="flex items-start gap-2">
                    {singleResult.success ? (
                      <CheckCircle className="h-4 w-4 mt-0.5" />
                    ) : (
                      <XCircle className="h-4 w-4 mt-0.5" />
                    )}
                    <AlertDescription>
                      {singleResult.success
                        ? `SMS sent successfully! Message ID: ${singleResult.messageId}`
                        : `Error: ${singleResult.error}`}
                    </AlertDescription>
                  </div>
                </Alert>
              )}

              <Button
                onClick={handleSingleSend}
                disabled={singleLoading || !singlePhone || !singleMessage}
                className="w-full"
              >
                {singleLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send SMS
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bulk SMS Tab */}
        <TabsContent value="bulk">
          <Card>
            <CardHeader>
              <CardTitle>Send Bulk SMS</CardTitle>
              <CardDescription>
                Send SMS messages to multiple recipients (max 100)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bulk-from">Sender Name (Optional)</Label>
                  <Input
                    id="bulk-from"
                    placeholder="TALYA SMART"
                    value={bulkFrom}
                    onChange={(e) => setBulkFrom(e.target.value)}
                    maxLength={11}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Messages ({bulkMessages.length}/100)</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addBulkMessage}
                      disabled={bulkMessages.length >= 100}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Message
                    </Button>
                  </div>

                  {bulkMessages.map((msg, index) => (
                    <Card key={index}>
                      <CardContent className="pt-6 space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor={`bulk-phone-${index}`}>
                                Phone Number {index + 1}
                              </Label>
                              <Input
                                id={`bulk-phone-${index}`}
                                placeholder="5416393028"
                                value={msg.to}
                                onChange={(e) =>
                                  updateBulkMessage(index, "to", e.target.value)
                                }
                                maxLength={11}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor={`bulk-message-${index}`}>Message</Label>
                              <Textarea
                                id={`bulk-message-${index}`}
                                placeholder="Your message here..."
                                value={msg.message}
                                onChange={(e) =>
                                  updateBulkMessage(index, "message", e.target.value)
                                }
                                maxLength={160}
                                rows={3}
                              />
                              <Badge
                                variant={msg.message.length > 160 ? "destructive" : "secondary"}
                              >
                                {msg.message.length}/160
                              </Badge>
                            </div>
                          </div>

                          {bulkMessages.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeBulkMessage(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {bulkResult && (
                <Alert variant={bulkResult.success ? "default" : "destructive"}>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      {bulkResult.success ? (
                        <CheckCircle className="h-4 w-4 mt-0.5" />
                      ) : (
                        <XCircle className="h-4 w-4 mt-0.5" />
                      )}
                      <AlertDescription>
                        {bulkResult.success
                          ? `Bulk SMS sent successfully! ${bulkResult.results?.length || 0} messages sent.`
                          : `Error: ${bulkResult.error}`}
                      </AlertDescription>
                    </div>

                    {bulkResult.results && bulkResult.results.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {bulkResult.results.map((result: any, index: number) => (
                          <div
                            key={index}
                            className="flex items-center justify-between text-sm"
                          >
                            <span>{result.to}</span>
                            {result.success ? (
                              <Badge variant="default">Sent</Badge>
                            ) : (
                              <Badge variant="destructive">Failed</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Alert>
              )}

              <Button
                onClick={handleBulkSend}
                disabled={bulkLoading || bulkMessages.length === 0}
                className="w-full"
              >
                {bulkLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Bulk SMS ({bulkMessages.filter((m) => m.to && m.message).length})
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>SMS Guidelines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <ul className="list-disc list-inside space-y-1">
            <li>Phone numbers must be in format: 5XXXXXXXXX (10 digits)</li>
            <li>Messages are limited to 160 characters per SMS</li>
            <li>Turkish characters (ç, ğ, ı, ö, ş, ü) are supported</li>
            <li>Sender name must be registered with NetGSM</li>
            <li>Maximum 100 messages per bulk request</li>
            <li>All SMS sends are logged for audit purposes</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

