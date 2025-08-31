"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { ConnectionCodeCard } from "@/components/dashboard/connection-code-card"
import { JoinSessionCard } from "@/components/dashboard/join-session-card"
import { SessionHistoryCard } from "@/components/dashboard/session-history-card"
import { RemoteSessionViewer } from "@/components/remote-session/remote-session-viewer"
import { authService } from "@/lib/auth"

export default function DashboardPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [activeSession, setActiveSession] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      router.push("/auth/login")
      return
    }
    setIsAuthenticated(true)
  }, [router])

  const handleSessionJoined = (sessionData: any) => {
    setActiveSession(sessionData)
  }

  const handleSessionEnd = () => {
    setActiveSession(null)
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />

      <main className="container mx-auto px-4 py-8">
        {activeSession ? (
          <RemoteSessionViewer sessionData={activeSession} onSessionEnd={handleSessionEnd} />
        ) : (
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <ConnectionCodeCard />
              <JoinSessionCard onSessionJoined={handleSessionJoined} />
            </div>

            <div>
              <SessionHistoryCard />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
