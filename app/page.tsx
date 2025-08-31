"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Monitor, Shield, Zap, Users } from "lucide-react"
import { authService } from "@/lib/auth"

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    if (authService.isAuthenticated()) {
      router.push("/dashboard")
    }
  }, [router])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor className="h-8 w-8 text-accent" />
            <h1 className="text-2xl font-bold text-foreground">RemoteDesk</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/auth/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/auth/register">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-bold text-foreground mb-6 text-balance">
            Secure Remote Desktop Access
          </h2>
          <p className="text-xl text-muted-foreground mb-8 text-pretty">
            Connect to any computer, anywhere in the world. Fast, secure, and completely free. Built with modern web
            technologies for the best remote desktop experience.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/register">
              <Button size="lg" className="text-lg px-8">
                Start Free Session
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button size="lg" variant="outline" className="text-lg px-8 bg-transparent">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h3 className="text-3xl font-bold text-foreground mb-4">Why Choose RemoteDesk?</h3>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Professional-grade remote desktop software with enterprise security and consumer simplicity.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="text-center">
              <Shield className="h-12 w-12 text-accent mx-auto mb-4" />
              <CardTitle>End-to-End Encrypted</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                All connections use WebRTC with DTLS-SRTP encryption for maximum security.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Zap className="h-12 w-12 text-accent mx-auto mb-4" />
              <CardTitle>Lightning Fast</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                Peer-to-peer connections ensure minimal latency and maximum performance.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Users className="h-12 w-12 text-accent mx-auto mb-4" />
              <CardTitle>Easy to Use</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                Simple connection codes make it easy to connect without complex setup.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Monitor className="h-12 w-12 text-accent mx-auto mb-4" />
              <CardTitle>Cross-Platform</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                Works on Windows, Mac, and Linux with our desktop agent application.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-muted py-16">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-3xl font-bold text-foreground mb-4">Ready to Get Started?</h3>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of users who trust RemoteDesk for their remote access needs. No credit card required.
          </p>
          <Link href="/auth/register">
            <Button size="lg" className="text-lg px-8">
              Create Free Account
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground">© 2024 RemoteDesk. Open source remote desktop software.</p>
        </div>
      </footer>
    </div>
  )
}
