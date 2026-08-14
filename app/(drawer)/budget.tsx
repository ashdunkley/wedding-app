import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Switch } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { getSession } from '../../lib/session'

type BudgetItem = {
  id: string
  category: string
  estimated_cost: number | null
  actual_cost: number | null
  paid: boolean
  notes: string | null
}

export default function BudgetScreen() {
  const [items, setItems] = useState<BudgetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditor, setIsEditor] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [newCategory, setNewCategory] = useState('')
  const [newEstimated, setNewEstimated] = useState('')
  const [newActual, setNewActual] = useState('')
  const [newPaid, setNewPaid] = useState(false)
  const [newNotes, setNewNotes] = useState('')

  const [editCategory, setEditCategory] = useState('')
  const [editEstimated, setEditEstimated] = useState('')
  const [editActual, setEditActual] = useState('')
  const [editPaid, setEditPaid] = useState(false)
  const [editNotes, setEditNotes] = useState('')

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

    const { data } = await supabase.from('budget_items').select('*').order('created_at')
    setItems(data ?? [])
    setLoading(false)
  }

  async function handleAdd() {
    if (!newCategory.trim()) {
      Alert.alert('Please enter a category.')
      return
    }
    setSaving(true)

    const { error } = await supabase.from('budget_items').insert({
      category: newCategory.trim(),
      estimated_cost: newEstimated.trim() ? parseFloat(newEstimated) : null,
      actual_cost: newActual.trim() ? parseFloat(newActual) : null,
      paid: newPaid,
      notes: newNotes.trim() || null,
    })

    setSaving(false)
    if (error) {
      Alert.alert('Error', error.message)
      return
    }

    setNewCategory('')
    setNewEstimated('')
    setNewActual('')
    setNewPaid(false)
    setNewNotes('')
    setShowAddForm(false)
    load()
  }

  function startEdit(item: BudgetItem) {
    setEditingId(item.id)
    setEditCategory(item.category)
    setEditEstimated(item.estimated_cost?.toString() ?? '')
    setEditActual(item.actual_cost?.toString() ?? '')
    setEditPaid(item.paid)
    setEditNotes(item.notes ?? '')
  }

  async function handleSaveEdit(id: string) {
    if (!editCategory.trim()) return
    setSaving(true)

    const { error } = await supabase
      .from('budget_items')
      .update({
        category: editCategory.trim(),
        estimated_cost: editEstimated.trim() ? parseFloat(editEstimated) : null,
        actual_cost: editActual.trim() ? parseFloat(editActual) : null,
        paid: editPaid,
        notes: editNotes.trim() || null,
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
    Alert.alert('Delete this budget item?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('budget_items').delete().eq('id', id)
          load()
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

  const totalEstimated = items.reduce((sum, i) => sum + (i.estimated_cost ?? 0), 0)
  const totalActual = items.reduce((sum, i) => sum + (i.actual_cost ?? 0), 0)
  const totalPaid = items.filter((i) => i.paid).reduce((sum, i) => sum + (i.actual_cost ?? i.estimated_cost ?? 0), 0)
  const variance = totalActual - totalEstimated

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.statsGrid}>
        <StatCard label="Estimated" value={`£${totalEstimated.toFixed(2)}`} />
        <StatCard label="Actual" value={`£${totalActual.toFixed(2)}`} />
        <StatCard
          label="Variance"
          value={`${variance >= 0 ? '+' : ''}£${variance.toFixed(2)}`}
          color={variance > 0 ? '#7A2E38' : '#4A5D45'}
        />
        <StatCard label="Paid so far" value={`£${totalPaid.toFixed(2)}`} />
      </View>

      {isEditor && (
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddForm((prev) => !prev)}>
          <Text style={styles.addButtonText}>{showAddForm ? 'Cancel' : '+ Add item'}</Text>
        </TouchableOpacity>
      )}

      {isEditor && showAddForm && (
        <View style={styles.formBox}>
          <Text style={styles.editLabel}>Category</Text>
          <TextInput style={styles.editInput} value={newCategory} onChangeText={setNewCategory} placeholder="e.g. Venue" placeholderTextColor="#B15D63" />

          <Text style={styles.editLabel}>Estimated cost (£)</Text>
          <TextInput style={styles.editInput} value={newEstimated} onChangeText={setNewEstimated} keyboardType="decimal-pad" />

          <Text style={styles.editLabel}>Actual cost (£)</Text>
          <TextInput style={styles.editInput} value={newActual} onChangeText={setNewActual} keyboardType="decimal-pad" />

          <Text style={styles.editLabel}>Notes</Text>
          <TextInput style={styles.editInput} value={newNotes} onChangeText={setNewNotes} />

          <View style={styles.paidRow}>
            <Text style={styles.editLabel}>Paid</Text>
            <Switch value={newPaid} onValueChange={setNewPaid} trackColor={{ true: '#4A5D45' }} />
          </View>

          <TouchableOpacity style={[styles.saveButton, { marginTop: 12 }]} onPress={handleAdd} disabled={saving}>
            <Text style={styles.saveButtonText}>{saving ? 'Adding...' : 'Add item'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {items.map((item) =>
        editingId === item.id ? (
          <View key={item.id} style={styles.formBox}>
            <Text style={styles.editLabel}>Category</Text>
            <TextInput style={styles.editInput} value={editCategory} onChangeText={setEditCategory} />

            <Text style={styles.editLabel}>Estimated cost (£)</Text>
            <TextInput style={styles.editInput} value={editEstimated} onChangeText={setEditEstimated} keyboardType="decimal-pad" />

            <Text style={styles.editLabel}>Actual cost (£)</Text>
            <TextInput style={styles.editInput} value={editActual} onChangeText={setEditActual} keyboardType="decimal-pad" />

            <Text style={styles.editLabel}>Notes</Text>
            <TextInput style={styles.editInput} value={editNotes} onChangeText={setEditNotes} />

            <View style={styles.paidRow}>
              <Text style={styles.editLabel}>Paid</Text>
              <Switch value={editPaid} onValueChange={setEditPaid} trackColor={{ true: '#4A5D45' }} />
            </View>

            <View style={[styles.editButtonRow, { alignItems: 'center' }]}>
              <TouchableOpacity style={styles.saveButton} onPress={() => handleSaveEdit(item.id)} disabled={saving}>
                <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setEditingId(null)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View key={item.id} style={styles.itemCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemCategory}>{item.category}</Text>
              <Text style={styles.itemMeta}>
                Est. {item.estimated_cost != null ? `£${item.estimated_cost.toFixed(2)}` : '—'}
                {'  ·  '}
                Actual {item.actual_cost != null ? `£${item.actual_cost.toFixed(2)}` : '—'}
              </Text>
              <Text style={[styles.itemPaid, item.paid && styles.itemPaidTrue]}>
                {item.paid ? '✓ Paid' : 'Not paid'}
              </Text>
              {item.notes && <Text style={styles.itemNotes}>{item.notes}</Text>}
            </View>
            {isEditor && (
              <View style={{ gap: 8 }}>
                <TouchableOpacity onPress={() => startEdit(item)}>
                  <Text style={styles.editLink}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)}>
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

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF8F5' },
  content: { padding: 24, paddingBottom: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF8F5' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 20 },
  statCard: {
    backgroundColor: 'white',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F0C4CB',
    padding: 14,
    width: '46%',
    alignItems: 'center',
  },
  statValue: { fontSize: 20, fontStyle: 'italic', color: '#7A2E38', marginBottom: 2 },
  statLabel: { fontSize: 11, color: '#B15D63', textAlign: 'center' },
  addButton: { backgroundColor: '#7A2E38', borderRadius: 999, paddingVertical: 10, alignItems: 'center', marginBottom: 16 },
  addButtonText: { color: 'white', fontWeight: '600', fontSize: 14 },
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
  itemCategory: { fontSize: 15, fontWeight: '600', color: '#3D0F14', marginBottom: 4 },
  itemMeta: { fontSize: 12, color: '#B15D63', marginBottom: 4 },
  itemPaid: { fontSize: 12, color: '#B15D63', fontWeight: '600' },
  itemPaidTrue: { color: '#4A5D45' },
  itemNotes: { fontSize: 12, color: '#3D0F14', fontStyle: 'italic', marginTop: 4 },
  editLink: { color: '#4A5D45', fontSize: 13, textDecorationLine: 'underline' },
  deleteLink: { color: '#B15D63', fontSize: 13, textDecorationLine: 'underline' },
  formBox: { backgroundColor: 'white', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#F0C4CB' },
  editLabel: { fontSize: 12, fontWeight: '600', color: '#3D0F14', marginBottom: 4, marginTop: 8 },
  editInput: { borderWidth: 1, borderColor: '#F0C4CB', borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#FDF8F5' },
  paidRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  editButtonRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  saveButton: { backgroundColor: '#7A2E38', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 20 },
  saveButtonText: { color: 'white', fontWeight: '600', fontSize: 13 },
  cancelButton: { borderWidth: 1, borderColor: '#B15D63', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 20 },
  cancelButtonText: { color: '#7A2E38', fontSize: 13, fontWeight: '600' },
})