"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield, Clock, Network, Key } from "lucide-react"

export function SecuritySettings() {
  const [settings, setSettings] = useState({
    requireApproval: true,
    sessionTimeout: 60,
    allowedIPs: "",
    twoFactorEnabled: false,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")

  const handleSave = async () => {
    setIsLoading(true)
    setMessage("")

    try {
      // Implementation would save to backend
      await new Promise((resolve) => setTimeout(resolve, 1000)) // Simulate API call
      setMessage("Security settings updated successfully")
    } catch (error) {
      setMessage("Failed to update security settings")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Settings
          </CardTitle>
          <CardDescription>Configure security options for your remote desktop sessions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {message && (
            <Alert>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Require Connection Approval</Label>
                <p className="text-sm text-muted-foreground">Manually approve each connection request</p>
              </div>
              <Switch
                checked={settings.requireApproval}
                onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, requireApproval: checked }))}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Session Timeout (minutes)
              </Label>
              <Input
                type="number"
                min="5"
                max="480"
                value={settings.sessionTimeout}
                onChange={(e) => setSettings((prev) => ({ ...prev, sessionTimeout: Number.parseInt(e.target.value) }))}
              />
              <p className="text-sm text-muted-foreground">Automatically end sessions after this duration</p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Network className="h-4 w-4" />
                Allowed IP Addresses
              </Label>
              <Input
                placeholder="192.168.1.0/24, 10.0.0.0/8 (optional)"
                value={settings.allowedIPs}
                onChange={(e) => setSettings((prev) => ({ ...prev, allowedIPs: e.target.value }))}
              />
              <p className="text-sm text-muted-foreground">
                Restrict connections to specific IP ranges (leave empty for no restrictions)
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Two-Factor Authentication
                </Label>
                <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
              </div>
              <Switch
                checked={settings.twoFactorEnabled}
                onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, twoFactorEnabled: checked }))}
              />
            </div>
          </div>

          <Button onClick={handleSave} disabled={isLoading} className="w-full">
            {isLoading ? "Saving..." : "Save Security Settings"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Connection Security</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• End-to-end encryption via WebRTC DTLS-SRTP</li>
                <li>• Temporary connection codes (5-minute expiry)</li>
                <li>• IP-based rate limiting</li>
                <li>• Session audit logging</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Data Protection</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• No data stored on servers</li>
                <li>• Peer-to-peer connections only</li>
                <li>• Automatic session cleanup</li>
                <li>• Failed attempt monitoring</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
