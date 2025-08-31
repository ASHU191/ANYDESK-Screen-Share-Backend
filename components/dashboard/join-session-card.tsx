"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Monitor, ArrowRight } from "lucide-react"
import { authService } from "@/lib/auth"
import { socketService } from "@/lib/socket"

interface JoinSessionCardProps {
  onSessionJoined: (sessionData: any) => void
}

export function JoinSessionCard({ onSessionJoined }: JoinSessionCardProps) {
  const [connectionCode, setConnectionCode] = useState("")
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState("")

  const joinSession = async () => {
    if (!connectionCode.trim()) {
      setError("Please enter a connection code")
      return
    }

    setIsJoining(true)
    setError("")

    try {
      // Validate connection code and get session info
      const sessionData = await authService.validateConnectionCode(connectionCode.trim().toUpperCase())

      // Connect to socket if not already connected
      const socket = socketService.connect()

      // Request connection to the host
      socketService.requestConnection(sessionData.sessionId)

      // Pass session data to parent component
      onSessionJoined({
        ...sessionData,
        connectionCode: connectionCode.trim().toUpperCase(),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join session")
    } finally {
      setIsJoining(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      joinSession()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          Join Remote Session
        </CardTitle>
        <CardDescription>Enter a connection code to connect to someone's computer.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="joinCode">Connection Code</Label>
          <Input
            id="joinCode"
            value={connectionCode}
            onChange={(e) => setConnectionCode(e.target.value.toUpperCase())}
            onKeyPress={handleKeyPress}
            placeholder="Enter 6-character code"
            className="font-mono text-lg tracking-wider"
            maxLength={6}
          />
        </div>

        <Button onClick={joinSession} disabled={isJoining || !connectionCode.trim()} className="w-full">
          {isJoining ? (
            "Connecting..."
          ) : (
            <>
              Join Session
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>

        <div className="text-sm text-muted-foreground">
          <p>You'll need permission from the host to control their computer.</p>
          <p className="mt-1">All connections are encrypted and secure.</p>
        </div>
      </CardContent>
    </Card>
  )
}
