import * as Application from 'expo-application'
import { Linking, Alert } from 'react-native'
import { supabase } from './supabase'

export async function checkForUpdate() {
  const { data } = await supabase.from('app_version').select('*').eq('id', 1).single()
  if (!data) return

  const currentVersionCode = Application.nativeBuildVersion
    ? parseInt(Application.nativeBuildVersion, 10)
    : 0

  if (data.version_code > currentVersionCode) {
    Alert.alert(
      'Update available',
      data.release_notes || `Version ${data.version_name} is available.`,
      [
        { text: 'Later', style: 'cancel' },
        {
          text: 'Download',
          onPress: () => Linking.openURL(data.apk_url),
        },
      ]
    )
  }
}