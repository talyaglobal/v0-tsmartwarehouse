import { createClient } from "@/lib/supabase/server"
import { SettingsForm } from "@/components/settings/settings-form"

export const metadata = {
  title: "Settings | T Smart Warehouse",
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user?.id).single()

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      <SettingsForm profile={profile} email={user?.email || ""} />
    </div>
  )
}
