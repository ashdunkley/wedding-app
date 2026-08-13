import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const supabaseUrl = 'https://gkczwnualykugtgqzylb.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrY3p3bnVhbHlrdWd0Z3F6eWxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwNjkwOTIsImV4cCI6MjEwMDY0NTA5Mn0.mzk0WumLCvQG6rDBFJeu-dUnkyFr9bTgBWl_ulLsbps'


export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})