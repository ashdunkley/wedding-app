import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Switch } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { getSession } from '../../lib/session'

type PartyMemberOption = { id: string; name: string }

type Entry = {
  id: string
  guest_name: string
  reason: string | null
  sent: boolean
  card_generated: boolean
  thank_you_code: string | null
  party_member_id: string | null
}

function buildReason(giftItem: string, attendedOnly: boolean): string {
  if (attendedOnly || !giftItem.trim()) {
    return 'Thank you so much for celebrating with us!'
  }
  return `Thank you so much for the ${giftItem.trim()}!`
}

function generateCode() {
  return Math.random().toString(36).slice(2, 8)
}

export default function ThankYouScreen() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [partyMembers, setPartyMembers] = useState<PartyMemberOption[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditor, setIsEditor] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [nameInput, setNameInput] = useState('')
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [giftItem, setGiftItem] = useState('')
  const [attendedOnly, setAttendedOnly] = useState(false)

  const [editName, setEditName] = useState('')
  const [editGiftItem, setEditGiftItem] = useState('')
  const [editAttendedOnly, setEditAttendedOnly] = useState(false)
  const [editSent, setEditSent] = useState(false)

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

    const { data } = await supabase.from('thank_you_tracker').select('*').order('created_at', { ascending: true })
    setEntries(data ?? [])

    const { data: members } = await supabase.from('party_members').select('id, name').order('name')
    setPartyMembers(members ?? [])

    setLoading(false)
  }

  const filteredMembers =
    nameInput.trim() && !selectedMemberId
      ? partyMembers.filter((m) => m.name.toLowerCase().includes(nameInput.toLowerCase()))
      : []

  async function handleAdd() {
    if (!nameInput.trim()) {
      Alert.alert('Enter a name.')
      return
    }
    setSaving(true)

    const { data: entry, error } = await supabase
      .from('thank_you_tracker')
      .insert({
        guest_name: nameInput.trim(),
        party_member_id: selectedMemberId,
        reason: buildReason(giftItem, attendedOnly),
        thank_you_code: generateCode(),
        sent: false,
        card_generated: false,
      })
      .select()
      .single()

    setSaving(false)
    if (error) {
      Alert.alert('Error', error.message)
      return
    }

    setEntries((prev) => [...prev, entry])
    setNameInput('')
    setSelectedMemberId(null)
    setGiftItem('')
    setAttendedOnly(false)
    setShowAddForm(false)
  }

  function startEdit(entry: Entry) {
    setEditingId(entry.id)
    setEditName(entry.guest_name)
    const match = entry.reason?.match(/for the (.+)!$/)
    setEditGiftItem(match ? match[1] : '')
    setEditAttendedOnly(!match)
    setEditSent(entry.sent)
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim()) return
    setSaving(true)

    const { error } = await supabase
      .from('thank_you_tracker')
      .update({
        guest_name: editName.trim(),
        reason: buildReason(editGiftItem, editAttendedOnly),
        sent: editSent,
        sent_date: editSent ? new Date().toISOString().split('T')[0] : null,
      })
      .eq('id', id)

    setSaving(false)
    if (error) {
      Alert.alert('Error', error.message)
      return
    }

    setEditingId(null)
    load()
  }

  async function handleDelete(id: string) {
    Alert.alert('Delete this entry?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('thank_you_tracker').delete().eq('id', id)
          setEntries((prev) => prev.filter((e) => e.id !== id))
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

  const sentCount = entries.filter((e) => e.sent).length

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.subtitle}>{entries.length} entries · {sentCount} sent</Text>

      {isEditor && (
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddForm((prev) => !prev)}>
          <Text style={styles.addButtonText}>{showAddForm ? 'Cancel' : '+ Add entry'}</Text>
        </TouchableOpacity>
      )}

      {isEditor && showAddForm && (
        <View style={styles.formBox}>
          <Text style={styles.editLabel}>Name</Text>
          <TextInput
            style={styles.editInput}
            value={nameInput}
            onChangeText={(text) => {
              setNameInput(text)
              setSelectedMemberId(null)
            }}
            placeholder="Start typing a name..."
          />
          {filteredMembers.length > 0 && (
            <View style={styles.suggestionsBox}>
              {filteredMembers.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  onPress={() => {
                    setSelectedMemberId(m.id)
                    setNameInput(m.name)
                  }}
                  style={styles.suggestionRow}
                >
                  <Text style={styles.suggestionText}>{m.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.paidRow}>
            <Text style={styles.editLabel}>Just attended, no gift</Text>
            <Switch value={attendedOnly} onValueChange={setAttendedOnly} trackColor={{ true: '#4A5D45' }} />
          </View>

          {!attendedOnly && (
            <>
              <Text style={styles.editLabel}>Gift item</Text>
              <TextInput
                style={styles.editInput}
                value={giftItem}
                onChangeText={setGiftItem}
                placeholder="e.g. motorbike helmet"
              />
            </>
          )}

          <Text style={styles.previewText}>Preview: "{buildReason(giftItem, attendedOnly)}"</Text>

          <TouchableOpacity style={[styles.saveButton, { marginTop: 12 }]} onPress={handleAdd} disabled={saving}>
            <Text style={styles.saveButtonText}>{saving ? 'Adding...' : 'Add entry'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {entries.map((entry) =>
        editingId === entry.id ? (
          <View key={entry.id} style={styles.formBox}>
            <Text style={styles.editLabel}>Name</Text>
            <TextInput style={styles.editInput} value={editName} onChangeText={setEditName} />

            <View style={styles.paidRow}>
              <Text style={styles.editLabel}>Just attended, no gift</Text>
              <Switch value={editAttendedOnly} onValueChange={setEditAttendedOnly} trackColor={{ true: '#4A5D45' }} />
            </View>

            {!editAttendedOnly && (
              <>
                <Text style={styles.editLabel}>Gift item</Text>
                <TextInput style={styles.editInput} value={editGiftItem} onChangeText={setEditGiftItem} />
              </>
            )}

            <Text style={styles.previewText}>Preview: "{buildReason(editGiftItem, editAttendedOnly)}"</Text>

            <View style={styles.paidRow}>
              <Text style={styles.editLabel}>Card sent</Text>
              <Switch value={editSent} onValueChange={setEditSent} trackColor={{ true: '#4A5D45' }} />
            </View>

            <View style={[styles.editButtonRow, { alignItems: 'center' }]}>
              <TouchableOpacity style={styles.saveButton} onPress={() => handleSaveEdit(entry.id)} disabled={saving}>
                <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setEditingId(null)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View key={entry.id} style={styles.itemCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{entry.guest_name}</Text>
              <Text style={styles.itemMeta}>
                {entry.reason}
                {entry.sent && ' · ✓ Sent'}
                {entry.card_generated && !entry.sent && ' · Card generated'}
              </Text>
            </View>
            {isEditor && (
              <View style={{ gap: 8 }}>
                <TouchableOpacity onPress={() => startEdit(entry)}>
                  <Text style={styles.editLink}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(entry.id)}>
                  <Text style={styles.deleteLink}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF8F5' },
  content: { padding: 24, paddingBottom: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF8F5' },
  subtitle: { fontSize: 14, color: '#B15D63', marginBottom: 16 },
  addButton: { backgroundColor: '#7A2E38', borderRadius: 999, paddingVertical: 10, marginBottom: 16, minWidth: 100, alignSelf: 'center', alignItems: 'center' },
  addButtonText: { color: 'white', fontWeight: '600', fontSize: 14, paddingHorizontal: 12 },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0C4CB',
    padding: 14,
    marginBottom: 10,
    justifyContent: 'space-between',
  },
  itemName: { fontSize: 15, fontWeight: '600', color: '#3D0F14', marginBottom: 4 },
  itemMeta: { fontSize: 12, color: '#B15D63' },
  editLink: { color: '#4A5D45', fontSize: 13, textDecorationLine: 'underline' },
  deleteLink: { color: '#B15D63', fontSize: 13, textDecorationLine: 'underline' },
  formBox: { backgroundColor: 'white', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#F0C4CB' },
  editLabel: { fontSize: 12, fontWeight: '600', color: '#3D0F14', marginBottom: 4, marginTop: 8 },
  editInput: { borderWidth: 1, borderColor: '#F0C4CB', borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#FDF8F5' },
  suggestionsBox: { borderWidth: 1, borderColor: '#F0C4CB', borderRadius: 8, marginTop: 4, maxHeight: 150 },
  suggestionRow: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#F0C4CB' },
  suggestionText: { fontSize: 14, color: '#3D0F14' },
  paidRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  previewText: { fontSize: 13, color: '#4A5D45', fontStyle: 'italic', marginTop: 20, marginBottom: 8, alignSelf: 'center' },
  editButtonRow: { flexDirection: 'row', gap: 10, marginTop: 20,  },
  saveButton: { backgroundColor: '#7A2E38', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 20, maxWidth: 100, minWidth: 100, marginVertical: 12, alignItems:'center', alignSelf: 'center' },
  saveButtonText: { color: 'white', fontWeight: '600', fontSize: 13, alignSelf: 'center' },
  cancelButton: { borderWidth: 1, borderColor: '#B15D63', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 20, minWidth: 100 },
  cancelButtonText: { color: '#7A2E38', fontSize: 13, fontWeight: '600', paddingHorizontal: 12 },
})