import { jwtDecode } from "jwt-decode"

export interface User {
  id: number
  email: string
  firstName: string
  lastName: string
}

export interface AuthResponse {
  token: string
  user: User
  message: string
}

export interface Session {
  id: number
  connectionCode: string
  status: "pending" | "active" | "ended" | "rejected"
  createdAt: string
  startedAt?: string
  endedAt?: string
  durationSeconds?: number
  hostUser: User
  guestUser?: User
  isHost: boolean
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

class AuthService {
  private token: string | null = null

  constructor() {
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("auth_token")
    }
  }

  async register(email: string, password: string, firstName: string, lastName: string): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, firstName, lastName }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Registration failed")
    }

    const data = await response.json()
    this.setToken(data.token)
    return data
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Login failed")
    }

    const data = await response.json()
    this.setToken(data.token)
    return data
  }

  async generateConnectionCode(): Promise<{ code: string; expiresAt: string }> {
    const response = await fetch(`${API_BASE_URL}/api/connection/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to generate connection code")
    }

    return response.json()
  }

  async validateConnectionCode(code: string): Promise<{ sessionId: number; hostUser: User }> {
    const response = await fetch(`${API_BASE_URL}/api/connection/validate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Invalid connection code")
    }

    return response.json()
  }

  async getSessions(): Promise<{ sessions: Session[] }> {
    const response = await fetch(`${API_BASE_URL}/api/sessions`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to fetch sessions")
    }

    return response.json()
  }

  setToken(token: string) {
    this.token = token
    if (typeof window !== "undefined") {
      localStorage.setItem("auth_token", token)
    }
  }

  getToken(): string | null {
    return this.token
  }

  getCurrentUser(): User | null {
    if (!this.token) return null

    try {
      const decoded = jwtDecode<{ id: number; email: string }>(this.token)
      // Note: JWT only contains id and email, we'll need to fetch full user data if needed
      return {
        id: decoded.id,
        email: decoded.email,
        firstName: "",
        lastName: "",
      }
    } catch {
      return null
    }
  }

  isAuthenticated(): boolean {
    if (!this.token) return false

    try {
      const decoded = jwtDecode<{ exp: number }>(this.token)
      return decoded.exp * 1000 > Date.now()
    } catch {
      return false
    }
  }

  logout() {
    this.token = null
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token")
    }
  }
}

export const authService = new AuthService()
