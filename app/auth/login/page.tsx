"use client"

import Link from "next/link"
import { LoginForm } from "@/components/auth/login-form"
import { Monitor } from "lucide-react"

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <Monitor className="h-8 w-8 text-accent" />
            <span className="text-2xl font-bold text-foreground">RemoteDesk</span>
          </Link>
        </div>

        <LoginForm />

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/auth/register" className="text-accent hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
