"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Copy, RefreshCw, Clock } from "lucide-react"
import { authService } from "@/lib/auth"

export function ConnectionCodeCard() {
  const [connectionCode, setConnectionCode] = useState("")
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState("")

  const generateCode = async () => {
    setIsGenerating(true)
    setError("")

    try {
      const result = await authService.generateConnectionCode()
      setConnectionCode(result.code)
      setExpiresAt(result.expiresAt)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate code")
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(connectionCode)
    } catch (err) {
      console.error("Failed to copy to clipboard:", err)
    }
  }

  const formatExpiryTime = (expiryString: string) => {
    const expiry = new Date(expiryString)
    const now = new Date()
    const diffMs = expiry.getTime() - now.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins <= 0) return "Expired"
    return `${diffMins} minutes remaining`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Generate Connection Code
        </CardTitle>
        <CardDescription>
          Create a temporary code for others to connect to your computer via the desktop agent.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label>Connection Code</Label>
          <div className="flex gap-2">
            <Input
              value={connectionCode}
              readOnly
              placeholder="Click generate to create a code"
              className="font-mono text-lg tracking-wider"
            />
            <Button variant="outline" size="icon" onClick={copyToClipboard} disabled={!connectionCode}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {expiresAt && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {formatExpiryTime(expiresAt)}
          </div>
        )}

        <Button onClick={generateCode} disabled={isGenerating} className="w-full">
          {isGenerating ? "Generating..." : "Generate New Code"}
        </Button>

        <div className="text-sm text-muted-foreground">
          <p>Share this code with someone who has the RemoteDesk desktop agent installed.</p>
          <p className="mt-1">Codes expire after 5 minutes for security.</p>
        </div>
      </CardContent>
    </Card>
  )
}
