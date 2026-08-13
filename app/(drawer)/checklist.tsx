import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Switch } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { getSession } from '../../lib/session'

type ChecklistItem = {
  id: string
  task: string
  done: boolean
  assigned_to: string | null
  due_date: string | null
  notes: string | null
  priority: number
  category_id: string | null
}

type Category = { id: string; name: string, sort_order: number }

export default function ChecklistScreen() {
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditor, setIsEditor] = useState(false)
  const [hideDone, setHideDone] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [newTask, setNewTask] = useState('')
  const [newAssignedTo, setNewAssignedTo] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [newCategoryId, setNewCategoryId] = useState<string | null>(null)

  const [editTask, setEditTask] = useState('')
  const [editAssignedTo, setEditAssignedTo] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null)

  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

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

    const { data, error } = await supabase.from('checklist_items').select('*').order('priority')
    setItems(data ?? [])

    const { data: cats, error: catsError } = await supabase.from('checklist_categories').select('*').order('sort_order')
    setCategories(cats ?? [])

    setLoading(false)
  }

  async function handleAddCategory() {
    if (!newCategoryName.trim()) return
    const { data } = await supabase
      .from('checklist_categories')
      .insert({ name: newCategoryName.trim() })
      .select()
      .single()
    if (data) {
      setCategories((prev) => [...prev, data])
      setNewCategoryId(data.id)
    }
    setNewCategoryName('')
    setAddingCategory(false)
  }

  async function handleAdd() {
    if (!newTask.trim()) {
      Alert.alert('Please enter a task.')
      return
    }
    setSaving(true)

    const maxPriority = items.length > 0 ? Math.max(...items.map((i) => i.priority)) : 0

    const { data: newItem, error } = await supabase
      .from('checklist_items')
      .insert({
        task: newTask.trim(),
        assigned_to: newAssignedTo.trim() || null,
        due_date: newDueDate || null,
        notes: newNotes.trim() || null,
        category_id: newCategoryId,
        priority: maxPriority + 1,
      })
      .select()
      .single()

    setSaving(false)
    if (error) {
      Alert.alert('Error', error.message)
      return
    }

    setItems((prev) => [...prev, newItem])
    setNewTask('')
    setNewAssignedTo('')
    setNewDueDate('')
    setNewNotes('')
    setNewCategoryId(null)
    setShowAddForm(false)
  }

  async function handleToggle(item: ChecklistItem) {
    const newDone = !item.done
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: newDone } : i)))
    const { error } = await supabase.from('checklist_items').update({ done: newDone }).eq('id', item.id)
    if (error) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: item.done } : i)))
    }
  }

  function startEdit(item: ChecklistItem) {
    setEditingId(item.id)
    setEditTask(item.task)
    setEditAssignedTo(item.assigned_to ?? '')
    setEditDueDate(item.due_date ?? '')
    setEditNotes(item.notes ?? '')
    setEditCategoryId(item.category_id)
  }

  async function handleSaveEdit(id: string) {
    if (!editTask.trim()) return
    setSaving(true)

    const { error } = await supabase
      .from('checklist_items')
      .update({
        task: editTask.trim(),
        assigned_to: editAssignedTo.trim() || null,
        due_date: editDueDate || null,
        notes: editNotes.trim() || null,
        category_id: editCategoryId,
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
    Alert.alert('Delete this task?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('checklist_items').delete().eq('id', id)
          load()
        },
      },
    ])
  }

  const sortedItems = [...items].sort((a, b) => a.priority - b.priority)
  const doneFiltered = hideDone ? sortedItems.filter((i) => !i.done) : sortedItems
  const visibleItems =
    categoryFilter === 'all' ? doneFiltered : doneFiltered.filter((i) => (i.category_id ?? 'none') === categoryFilter)

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]))

  const grouped = new Map<string, ChecklistItem[]>()
  for (const item of visibleItems) {
    const key = item.category_id ?? 'none'
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(item)
  }
  const orderedGroupKeys = [...categories.map((c) => c.id), 'none'].filter((key) => grouped.has(key))

  async function handleMove(item: ChecklistItem, direction: 'up' | 'down') {
    const key = item.category_id ?? 'none'
    const categoryItems = visibleItems
      .filter((i) => (i.category_id ?? 'none') === key)
      .sort((a, b) => a.priority - b.priority)

    const index = categoryItems.findIndex((i) => i.id === item.id)
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= categoryItems.length) return

    const other = categoryItems[swapIndex]
    const itemPriority = item.priority
    const otherPriority = other.priority

    setItems((prev) =>
      prev.map((i) => {
        if (i.id === item.id) return { ...i, priority: otherPriority }
        if (i.id === other.id) return { ...i, priority: itemPriority }
        return i
      })
    )

    await supabase.from('checklist_items').update({ priority: otherPriority }).eq('id', item.id)
    await supabase.from('checklist_items').update({ priority: itemPriority }).eq('id', other.id)
  }

  function isOverdue(item: ChecklistItem) {
    if (!item.due_date || item.done) return false
    return new Date(item.due_date) < new Date(new Date().toDateString())
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>Loading...</Text>
      </View>
    )
  }

  const doneCount = items.filter((i) => i.done).length

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.subtitle}>{doneCount} of {items.length} done</Text>

      <View style={styles.filterRow}>
        <View style={styles.hideDoneRow}>
          <Text style={styles.editLabel}>Hide done</Text>
          <Switch value={hideDone} onValueChange={setHideDone} trackColor={{ true: '#4A5D45' }} />
        </View>

        {isEditor && (
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAddForm((prev) => !prev)}>
            <Text style={styles.addButtonText}>{showAddForm ? 'Cancel' : '+ Add task'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
        <TouchableOpacity
          onPress={() => setCategoryFilter('all')}
          style={[styles.categoryPill, categoryFilter === 'all' && styles.categoryPillActive]}
        >
          <Text style={categoryFilter === 'all' ? styles.categoryPillTextActive : styles.categoryPillText}>All</Text>
        </TouchableOpacity>
        {categories.map((c) => (
          <TouchableOpacity
            key={c.id}
            onPress={() => setCategoryFilter(c.id)}
            style={[styles.categoryPill, categoryFilter === c.id && styles.categoryPillActive]}
          >
            <Text style={categoryFilter === c.id ? styles.categoryPillTextActive : styles.categoryPillText}>
              {c.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isEditor && showAddForm && (
        <View style={styles.formBox}>
          <Text style={styles.editLabel}>Task</Text>
          <TextInput style={styles.editInput} value={newTask} onChangeText={setNewTask} />

          <Text style={styles.editLabel}>Assigned to</Text>
          <TextInput style={styles.editInput} value={newAssignedTo} onChangeText={setNewAssignedTo} />

          <Text style={styles.editLabel}>Due date (YYYY-MM-DD)</Text>
          <TextInput style={styles.editInput} value={newDueDate} onChangeText={setNewDueDate} placeholder="2026-09-01" />

          <Text style={styles.editLabel}>Notes</Text>
          <TextInput style={styles.editInput} value={newNotes} onChangeText={setNewNotes} />

          <Text style={styles.editLabel}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            <TouchableOpacity
              onPress={() => setNewCategoryId(null)}
              style={[styles.categoryPill, !newCategoryId && styles.categoryPillActive]}
            >
              <Text style={!newCategoryId ? styles.categoryPillTextActive : styles.categoryPillText}>None</Text>
            </TouchableOpacity>
            {categories.map((c) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => setNewCategoryId(c.id)}
                style={[styles.categoryPill, newCategoryId === c.id && styles.categoryPillActive]}
              >
                <Text style={newCategoryId === c.id ? styles.categoryPillTextActive : styles.categoryPillText}>
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {addingCategory ? (
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <TextInput
                style={[styles.editInput, { flex: 1 }]}
                value={newCategoryName}
                onChangeText={setNewCategoryName}
                placeholder="New category name"
              />
              <TouchableOpacity style={styles.saveButtonSmall} onPress={handleAddCategory}>
                <Text style={styles.saveButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setAddingCategory(true)}>
              <Text style={styles.smallActionText}>+ New category</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.saveButton} onPress={handleAdd} disabled={saving}>
            <Text style={styles.saveButtonText}>{saving ? 'Adding...' : 'Add task'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {orderedGroupKeys.map((key) => (
        <View key={key}>
          <Text style={styles.categoryHeading}>{key === 'none' ? 'Uncategorized' : categoryMap.get(key)}</Text>
          {grouped.get(key)!.map((item) => {
            const categoryItems = grouped.get(key)!
            const localIdx = categoryItems.findIndex((i) => i.id === item.id)

            return editingId === item.id ? (
              <View key={item.id} style={styles.formBox}>
                <Text style={styles.editLabel}>Task</Text>
                <TextInput style={styles.editInput} value={editTask} onChangeText={setEditTask} />
                <Text style={styles.editLabel}>Assigned to</Text>
                <TextInput style={styles.editInput} value={editAssignedTo} onChangeText={setEditAssignedTo} />
                <Text style={styles.editLabel}>Due date (YYYY-MM-DD)</Text>
                <TextInput style={styles.editInput} value={editDueDate} onChangeText={setEditDueDate} />
                <Text style={styles.editLabel}>Notes</Text>
                <TextInput style={styles.editInput} value={editNotes} onChangeText={setEditNotes} />
                <View style={styles.editButtonRow}>
                  <TouchableOpacity style={styles.saveButton} onPress={() => handleSaveEdit(item.id)} disabled={saving}>
                    <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelButton} onPress={() => setEditingId(null)}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View key={item.id} style={[styles.taskRow, item.done && styles.taskRowDone]}>
                <View style={styles.arrowColumn}>
                  <TouchableOpacity onPress={() => handleMove(item, 'up')} disabled={localIdx === 0}>
                    <Text style={[styles.arrow, localIdx === 0 && styles.arrowDisabled]}>▲</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleMove(item, 'down')}
                    disabled={localIdx === categoryItems.length - 1}
                  >
                    <Text style={[styles.arrow, localIdx === categoryItems.length - 1 && styles.arrowDisabled]}>▼</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={() => handleToggle(item)} style={styles.checkbox}>
                  {item.done && <View style={styles.checkboxFill} />}
                </TouchableOpacity>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.taskText, item.done && styles.taskTextDone]}>{item.task}</Text>
                  {(item.assigned_to || item.due_date) && (
                    <Text style={[styles.taskMeta, isOverdue(item) && styles.taskMetaOverdue]}>
                      {item.assigned_to}
                      {item.assigned_to && item.due_date && ' · '}
                      {item.due_date && `Due ${new Date(item.due_date).toLocaleDateString('en-GB')}`}
                      {isOverdue(item) && ' ⚠'}
                    </Text>
                  )}
                  {item.notes && <Text style={styles.taskNotes}>{item.notes}</Text>}
                </View>

                {isEditor && (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
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
          })}
        </View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF8F5' },
  content: { padding: 24, paddingBottom: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF8F5' },
  subtitle: { fontSize: 14, color: '#B15D63', marginBottom: 12 },
  filterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  hideDoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addButton: { backgroundColor: '#7A2E38', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16 },
  addButtonText: { color: 'white', fontWeight: '600', fontSize: 13 },
  categoryScroll: { marginBottom: 16 },
  categoryPill: {
    borderWidth: 1,
    borderColor: '#F0C4CB',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginRight: 8,
    backgroundColor: 'white',
  },
  categoryPillActive: { backgroundColor: '#7A2E38', borderColor: '#7A2E38' },
  categoryPillText: { fontSize: 13, color: '#3D0F14' },
  categoryPillTextActive: { fontSize: 13, color: 'white', fontWeight: '600' },
  categoryHeading: { fontSize: 14, fontWeight: '600', color: '#7A2E38', marginTop: 16, marginBottom: 8 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#F0C4CB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  taskRowDone: { opacity: 0.55 },
  arrowColumn: { alignItems: 'center' },
  arrow: { fontSize: 12, color: '#4A5D45', paddingVertical: 2 },
  arrowDisabled: { color: '#ccc' },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#7A2E38',
    marginTop: 12,
    marginHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxFill: { width: 12, height: 12, borderRadius: 3, backgroundColor: '#7A2E38' },
  taskText: { fontSize: 14, color: '#3D0F14' },
  taskTextDone: { textDecorationLine: 'line-through' },
  taskMeta: { fontSize: 12, color: '#B15D63', marginTop: 2 },
  taskMetaOverdue: { color: '#7A2E38', fontWeight: '600' },
  taskNotes: { fontSize: 12, color: '#3D0F14', fontStyle: 'italic', marginTop: 2 },
  editLink: { color: '#4A5D45', fontSize: 13, textDecorationLine: 'underline' },
  deleteLink: { color: '#B15D63', fontSize: 13, textDecorationLine: 'underline' },
  smallActionText: { color: '#4A5D45', fontSize: 13, textDecorationLine: 'underline', marginBottom: 8 },
  formBox: { backgroundColor: 'white', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#F0C4CB' },
  editLabel: { fontSize: 12, fontWeight: '600', color: '#3D0F14', marginBottom: 4, marginTop: 8 },
  editInput: { borderWidth: 1, borderColor: '#F0C4CB', borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#FDF8F5' },
  editButtonRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  saveButton: { backgroundColor: '#7A2E38', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 20, marginTop: 12 },
  saveButtonSmall: { backgroundColor: '#7A2E38', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16 },
  saveButtonText: { color: 'white', fontWeight: '600', fontSize: 13 },
  cancelButton: { borderWidth: 1, borderColor: '#F0C4CB', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16, marginTop: 12, justifyContent: 'center' },
  cancelButtonText: { color: '#B15D63', fontSize: 13, fontWeight: 600, },
})