"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2 } from "@/components/icons"
import { signUp } from "@/lib/auth/actions"
import { useUIStore } from "@/stores/ui.store"

export default function RegisterPage() {
  const router = useRouter()
  const addNotification = useUIStore((state) => state.addNotification)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    storageType: "",
    acceptTerms: false,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords don't match")
      addNotification({
        type: 'error',
        message: "Passwords don't match",
        duration: 5000,
      })
      setIsLoading(false)
      return
    }

    const formDataToSubmit = new FormData()
    formDataToSubmit.append('email', formData.email)
    formDataToSubmit.append('password', formData.password)
    formDataToSubmit.append('confirmPassword', formData.confirmPassword)
    formDataToSubmit.append('name', formData.name)
    if (formData.phone) formDataToSubmit.append('phone', formData.phone)
    if (formData.storageType) formDataToSubmit.append('storageType', formData.storageType)

    const result = await signUp(formDataToSubmit)
    
    if (result?.error) {
      setError(result.error.message)
      addNotification({
        type: 'error',
        message: result.error.message,
        duration: 5000,
      })
      setIsLoading(false)
    } else {
      // Show success toast
      addNotification({
        type: 'success',
        message: 'Account created successfully. You can now sign in.',
        duration: 5000,
      })
      // Redirect to login after a short delay
      setTimeout(() => {
        router.push('/login')
      }, 500)
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Create an account</CardTitle>
        <CardDescription>Get started with TSmart Warehouse today</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              placeholder="John Doe"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              autoComplete="email"
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="storageType">Storage Interest</Label>
            <Select
              value={formData.storageType}
              onValueChange={(value) => setFormData({ ...formData, storageType: value })}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select storage type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pallet">Pallet Storage</SelectItem>
                <SelectItem value="area-rental">Area Rental (Level 3)</SelectItem>
                <SelectItem value="both">Both Options</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Create password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                autoComplete="new-password"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                autoComplete="new-password"
                disabled={isLoading}
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="terms"
              checked={formData.acceptTerms}
              onCheckedChange={(checked) => setFormData({ ...formData, acceptTerms: checked as boolean })}
              required
              disabled={isLoading}
            />
            <Label htmlFor="terms" className="text-sm">
              I agree to the{" "}
              <Link href="/terms" className="text-primary hover:underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
            </Label>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={isLoading || !formData.acceptTerms}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Account
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
