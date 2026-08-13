import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { getSession } from '../../lib/session'

type FeaturedPhoto = { id: string; storage_path: string } | null

type Message = {
  id: string
  uploader_name: string | null
  message: string
  hidden: boolean
  created_at: string
  featured_photo: FeaturedPhoto
}

type Photo = {
  id: string
  storage_path: string
  uploader_name: string | null
  hidden: boolean
  uploaded_at: string
}

export default function GuestbookScreen() {
  const [messages, setMessages] = useState<Message[]>([])
  const [photos, setPhotos] = useState<Photo[]>([])
  const [tab, setTab] = useState<'messages' | 'photos'>('messages')
  const [loading, setLoading] = useState(true)
  const [isEditor, setIsEditor] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const session = await getSession()
    if (!session) {
      router.replace('/')
      return
    }
    setIsEditor(session.role === 'editor')

    const { data: msgs } = await supabase
      .from('guestbook_messages')
      .select('*, featured_photo:featured_photo_id(id, storage_path)')
      .order('created_at', { ascending: false })
    setMessages(msgs ?? [])

    const { data: pics } = await supabase.from('photos').select('*').order('uploaded_at', { ascending: false })
    setPhotos(pics ?? [])

    setLoading(false)
  }

  function photoUrl(path: string) {
    return supabase.storage.from('wedding-photos').getPublicUrl(path).data.publicUrl
  }

  async function handleToggleMessage(msg: Message) {
    setBusyId(msg.id)
    await supabase.from('guestbook_messages').update({ hidden: !msg.hidden }).eq('id', msg.id)
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, hidden: !m.hidden } : m)))
    setBusyId(null)
  }

  async function handleDeleteMessage(id: string) {
    Alert.alert('Delete this message?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('guestbook_messages').delete().eq('id', id)
          setMessages((prev) => prev.filter((m) => m.id !== id))
        },
      },
    ])
  }

  async function handleTogglePhoto(photo: Photo) {
    setBusyId(photo.id)
    await supabase.from('photos').update({ hidden: !photo.hidden }).eq('id', photo.id)
    setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, hidden: !p.hidden } : p)))
    setBusyId(null)
  }

  async function handleDeletePhoto(id: string) {
    Alert.alert('Delete this photo?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('photos').delete().eq('id', id)
          setPhotos((prev) => prev.filter((p) => p.id !== id))
        },
      },
    ])
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>Loading...</Text>
      </View>
    )
  }

  const visibleMessageCount = messages.filter((m) => !m.hidden).length
  const visiblePhotoCount = photos.filter((p) => !p.hidden).length

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.tabRow}>
        <TouchableOpacity
          onPress={() => setTab('messages')}
          style={[styles.tabButton, tab === 'messages' && styles.tabButtonActive]}
        >
          <Text style={tab === 'messages' ? styles.tabTextActive : styles.tabText}>
            Messages ({visibleMessageCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setTab('photos')}
          style={[styles.tabButton, tab === 'photos' && styles.tabButtonActive]}
        >
          <Text style={tab === 'photos' ? styles.tabTextActive : styles.tabText}>
            Photos ({visiblePhotoCount})
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'messages' &&
        (messages.length === 0 ? (
          <Text style={styles.emptyText}>No messages yet.</Text>
        ) : (
          messages.map((msg) => (
            <View key={msg.id} style={[styles.card, msg.hidden && styles.cardHidden]}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {msg.featured_photo && (
                  <Image source={{ uri: photoUrl(msg.featured_photo.storage_path) }} style={styles.thumb} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.messageText}>{msg.message}</Text>
                  <Text style={styles.messageMeta}>
                    — {msg.uploader_name || 'Anonymous'} · {new Date(msg.created_at).toLocaleDateString('en-GB')}
                    {msg.hidden && ' · Hidden'}
                  </Text>
                </View>
              </View>
              {isEditor && (
                <View style={styles.cardActions}>
                  <TouchableOpacity onPress={() => handleToggleMessage(msg)} disabled={busyId === msg.id}>
                    <Text style={styles.editLink}>{msg.hidden ? 'Show' : 'Hide'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteMessage(msg.id)} disabled={busyId === msg.id}>
                    <Text style={styles.deleteLink}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        ))}

      {tab === 'photos' &&
        (photos.length === 0 ? (
          <Text style={styles.emptyText}>No photos yet.</Text>
        ) : (
          <View style={styles.photoGrid}>
            {photos.map((photo) => (
              <View key={photo.id} style={[styles.photoCard, photo.hidden && styles.cardHidden]}>
                <Image source={{ uri: photoUrl(photo.storage_path) }} style={styles.photoImage} />
                <Text style={styles.photoMeta} numberOfLines={1}>
                  {photo.uploader_name || 'Anonymous'}
                  {photo.hidden && ' · Hidden'}
                </Text>
                {isEditor && (
                  <View style={styles.photoActions}>
                    <TouchableOpacity onPress={() => handleTogglePhoto(photo)} disabled={busyId === photo.id}>
                      <Text style={styles.editLinkSmall}>{photo.hidden ? 'Show' : 'Hide'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeletePhoto(photo.id)} disabled={busyId === photo.id}>
                      <Text style={styles.deleteLinkSmall}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>
        ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF8F5' },
  content: { padding: 24, paddingBottom: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF8F5' },
  tabRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  tabButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, backgroundColor: '#F0C4CB' },
  tabButtonActive: { backgroundColor: '#7A2E38' },
  tabText: { fontSize: 13, color: '#7A2E38', fontWeight: '600' },
  tabTextActive: { fontSize: 13, color: 'white', fontWeight: '600' },
  emptyText: { color: '#B15D63', textAlign: 'center', marginTop: 20 },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0C4CB',
    padding: 14,
    marginBottom: 10,
  },
  cardHidden: { opacity: 0.5 },
  thumb: { width: 60, height: 60, borderRadius: 8 },
  messageText: { fontSize: 14, fontStyle: 'italic', color: '#3D0F14', marginBottom: 4 },
  messageMeta: { fontSize: 12, color: '#B15D63' },
  cardActions: { flexDirection: 'row', gap: 14, marginTop: 10 },
  editLink: { color: '#4A5D45', fontSize: 13, textDecorationLine: 'underline' },
  deleteLink: { color: '#B15D63', fontSize: 13, textDecorationLine: 'underline' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoCard: {
    width: '31%',
    backgroundColor: 'white',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F0C4CB',
    padding: 6,
  },
  photoImage: { width: '100%', aspectRatio: 1, borderRadius: 8, marginBottom: 4 },
  photoMeta: { fontSize: 10, color: '#B15D63', marginBottom: 4 },
  photoActions: { flexDirection: 'row', gap: 8 },
  editLinkSmall: { color: '#4A5D45', fontSize: 11, textDecorationLine: 'underline' },
  deleteLinkSmall: { color: '#B15D63', fontSize: 11, textDecorationLine: 'underline' },
})