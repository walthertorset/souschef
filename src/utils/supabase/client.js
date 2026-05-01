import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return {} // Return empty object during build to avoid crashing, but it will fail at runtime if keys are missing
  }

  return createBrowserClient(url, key)
}
