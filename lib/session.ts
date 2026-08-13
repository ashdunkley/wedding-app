import { supabase } from './supabase'

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, role')
    .eq('auth_user_id', session.user.id)
    .single()

  if (!profile) return null

  return { userId: session.user.id, profileId: profile.id, name: profile.name, role: profile.role as 'editor' | 'viewer' }
}