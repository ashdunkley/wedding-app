import { useEffect, useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	TouchableOpacity,
	TextInput,
	Alert,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";
import { getSession } from "../../lib/session";

type PartyMember = {
	id: string;
	name: string;
	attending: boolean;
	is_plus_one: boolean;
};
type Guest = {
	id: string;
	invite_code: string;
	rsvp_status: string;
	party_size: number;
	email: string | null;
	plus_one_allowed: boolean;
	dietary_notes: string | null;
	party_members: PartyMember[];
};

export default function GuestsScreen() {
	const [guests, setGuests] = useState<Guest[]>([]);
	const [loading, setLoading] = useState(true);
	const [isEditor, setIsEditor] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [showAddForm, setShowAddForm] = useState(false);

	const [editNames, setEditNames] = useState("");
	const [editEmail, setEditEmail] = useState("");
	const [editDietary, setEditDietary] = useState("");

	const [newNames, setNewNames] = useState("");
	const [newCode, setNewCode] = useState("");
	const [newEmail, setNewEmail] = useState("");

	const [editPlusOneMember, setEditPlusOneMember] = useState<{
		id: string;
		name: string;
	} | null>(null);
	const [editPlusOneName, setEditPlusOneName] = useState("");
	const [editPlusOneAllowed, setEditPlusOneAllowed] = useState(false);

	const [newPlusOneAllowed, setNewPlusOneAllowed] = useState(false);

	const totalInvited = (guests ?? []).reduce((sum, g) => sum + g.party_size, 0);
	const totalConfirmed = (guests ?? [])
		.filter((g) => g.rsvp_status === "yes")
		.reduce((sum, g) => sum + g.party_size, 0);
	const totalPending = (guests ?? [])
		.filter((g) => g.rsvp_status === "pending")
		.reduce((sum, g) => sum + g.party_size, 0);
	const totalDenied = (guests ?? [])
		.filter((g) => g.rsvp_status === "no")
		.reduce((sum, g) => sum + g.party_size, 0);

	useEffect(() => {
		load();
	}, []);

	async function load() {
		const session = await getSession();
		if (!session) {
			router.replace("/");
			return;
		}
		setIsEditor(session.role === "editor");

		const { data } = await supabase
			.from("guests")
			.select("*, party_members(*)")
			.order("created_at", { ascending: true });

		setGuests(data ?? []);
		setLoading(false);
	}

	function generateCode() {
		return Math.random().toString(36).slice(2, 6);
	}

	async function handleAddGuest() {
		if (!newNames.trim()) {
			Alert.alert("Please add at least one name.");
			return;
		}

		setSaving(true);
		const names = newNames
			.split(",")
			.map((n) => n.trim())
			.filter(Boolean);
		const code = newCode.trim() || generateCode();

		const { data: guestRow, error: guestError } = await supabase
			.from("guests")
			.insert({
				invite_code: code,
				email: newEmail.trim() || null,
				party_size: names.length,
				plus_one_allowed: newPlusOneAllowed,
			})
			.select()
			.single();

		if (guestError || !guestRow) {
			setSaving(false);
			Alert.alert("Error", guestError?.message ?? "Failed to add guest");
			return;
		}

		await supabase.from("party_members").insert(
			names.map((name, i) => ({
				guest_id: guestRow.id,
				name,
				sort_order: i,
				is_plus_one: false,
				attending: true,
			})),
		);

		setSaving(false);
		setNewNames("");
		setNewCode("");
		setNewEmail("");
		setNewPlusOneAllowed(false);
		setShowAddForm(false);
		load();
	}

	function startEdit(guest: Guest) {
		setEditingId(guest.id);
		setEditNames(
			guest.party_members
				.filter((m) => !m.is_plus_one)
				.map((m) => m.name)
				.join(", "),
		);
		setEditEmail(guest.email ?? "");
		setEditDietary(guest.dietary_notes ?? "");
		setEditPlusOneAllowed(guest.plus_one_allowed);

		const plusOne = guest.party_members.find((m) => m.is_plus_one) ?? null;
		setEditPlusOneMember(plusOne);
		setEditPlusOneName(plusOne?.name ?? "");
	}

	async function handleSaveEdit(guestId: string) {
		setSaving(true);
		const names = editNames
			.split(",")
			.map((n) => n.trim())
			.filter(Boolean);

		const { error: guestError } = await supabase
			.from("guests")
			.update({
				email: editEmail.trim() || null,
				dietary_notes: editDietary.trim() || null,
			})
			.eq("id", guestId);

		if (guestError) {
			setSaving(false);
			Alert.alert("Error", guestError.message);
			return;
		}

		await supabase
			.from("party_members")
			.delete()
			.eq("guest_id", guestId)
			.eq("is_plus_one", false);
		await supabase.from("party_members").insert(
			names.map((name, i) => ({
				guest_id: guestId,
				name,
				sort_order: i,
				is_plus_one: false,
				attending: true,
			})),
		);

		setSaving(false);
		setEditingId(null);
		load();
	}

	async function handleDelete(guestId: string) {
		Alert.alert("Delete guest?", "This cannot be undone.", [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Delete",
				style: "destructive",
				onPress: async () => {
					await supabase.from("guests").delete().eq("id", guestId);
					load();
				},
			},
		]);
	}

	async function handleUpdatePlusOneName(memberId: string) {
		if (!editPlusOneName.trim()) return;
		await supabase
			.from("party_members")
			.update({ name: editPlusOneName.trim() })
			.eq("id", memberId);
		load();
	}

	async function handleRemovePlusOne(memberId: string, guestId: string) {
		await supabase.from("party_members").delete().eq("id", memberId);

		const { data: remaining } = await supabase
			.from("party_members")
			.select("attending")
			.eq("guest_id", guestId);
		const attendingCount = (remaining ?? []).filter((m) => m.attending).length;
		await supabase
			.from("guests")
			.update({ party_size: attendingCount })
			.eq("id", guestId);

		setEditPlusOneMember(null);
		setEditPlusOneName("");
		load();
	}

	async function handleTogglePlusOneAllowed(guestId: string) {
		const newValue = !editPlusOneAllowed;
		await supabase
			.from("guests")
			.update({ plus_one_allowed: newValue })
			.eq("id", guestId);
		setEditPlusOneAllowed(newValue);
		load();
	}

	async function handleCreatePlusOne(guestId: string) {
		if (!editPlusOneName.trim()) return;

		const { data: newMember } = await supabase
			.from("party_members")
			.insert({
				guest_id: guestId,
				name: editPlusOneName.trim(),
				is_plus_one: true,
				attending: true,
				sort_order: 99,
			})
			.select()
			.single();

		if (newMember) {
			const { data: allMembers } = await supabase
				.from("party_members")
				.select("attending")
				.eq("guest_id", guestId);
			const attendingCount = (allMembers ?? []).filter(
				(m) => m.attending,
			).length;
			await supabase
				.from("guests")
				.update({ party_size: attendingCount })
				.eq("id", guestId);

			setEditPlusOneMember(newMember);
		}

		load();
	}

	if (loading) {
		return (
			<View style={styles.center}>
				<Text>Loading...</Text>
			</View>
		);
	}

	return (
		<ScrollView style={styles.container} contentContainerStyle={styles.content}>
			<Text style={styles.subtitle}>
				{guests.length} invited parties - {totalInvited} invited guests
			</Text>
			<Text style={styles.subtitle}>{totalConfirmed} attending guests - {totalDenied} not attending invitees</Text>

			{isEditor && (
				<TouchableOpacity
					style={styles.addButton}
					onPress={() => setShowAddForm((prev) => !prev)}
				>
					<Text style={styles.addButtonText}>
						{showAddForm ? "Cancel" : "+ Add guest"}
					</Text>
				</TouchableOpacity>
			)}

			{isEditor && showAddForm && (
				<View style={styles.editRow}>
					<Text style={styles.editLabel}>Names (comma separated)</Text>
					<TextInput
						style={styles.editInput}
						value={newNames}
						onChangeText={setNewNames}
						placeholder="Sarah Jones, Tom Jones"
					/>
					<Text style={styles.editLabel}>Invite code (optional)</Text>
					<TextInput
						style={styles.editInput}
						value={newCode}
						onChangeText={setNewCode}
						placeholder="auto-generated if blank"
					/>
					<Text style={styles.editLabel}>Email (optional)</Text>
					<TextInput
						style={styles.editInput}
						value={newEmail}
						onChangeText={setNewEmail}
						autoCapitalize="none"
					/>
					<View style={styles.plusOneToggleRow}>
						<Text style={styles.editLabel}>Allow a plus one</Text>
						<TouchableOpacity
							onPress={() => setNewPlusOneAllowed((prev) => !prev)}
							style={[styles.toggle, newPlusOneAllowed && styles.toggleOn]}
						>
							<View
								style={[
									styles.toggleKnob,
									newPlusOneAllowed && styles.toggleKnobOn,
								]}
							/>
						</TouchableOpacity>
					</View>
					<TouchableOpacity
						style={styles.saveButton}
						onPress={handleAddGuest}
						disabled={saving}
					>
						<Text style={styles.saveButtonText}>
							{saving ? "Adding..." : "Add guest"}
						</Text>
					</TouchableOpacity>
				</View>
			)}

			<View style={styles.headerRow}>
				<Text style={[styles.headerCell, { flex: 2 }]}>Names</Text>
				<Text style={[styles.headerCell, { flex: 1 }]}>Status</Text>
				<Text
					style={[styles.headerCell, { width: 60, textAlign: "right" }]}
				></Text>
			</View>

			{guests.map((guest) =>
				editingId === guest.id ? (
					<View key={guest.id} style={styles.editRow}>
						<Text style={styles.editLabel}>Names (comma separated)</Text>
						<TextInput
							style={styles.editInput}
							value={editNames}
							onChangeText={setEditNames}
						/>
						<Text style={styles.editLabel}>Email</Text>
						<TextInput
							style={styles.editInput}
							value={editEmail}
							onChangeText={setEditEmail}
							autoCapitalize="none"
						/>
						<Text style={styles.editLabel}>Dietary notes</Text>
						<TextInput
							style={styles.editInput}
							value={editDietary}
							onChangeText={setEditDietary}
						/>
						<View style={styles.plusOneSection}>
							<View style={styles.plusOneToggleRow}>
								<Text style={styles.editLabel}>Allow a plus one</Text>
								<TouchableOpacity
									onPress={() => handleTogglePlusOneAllowed(guest.id)}
									style={[styles.toggle, editPlusOneAllowed && styles.toggleOn]}
								>
									<View
										style={[
											styles.toggleKnob,
											editPlusOneAllowed && styles.toggleKnobOn,
										]}
									/>
								</TouchableOpacity>
							</View>

							{editPlusOneAllowed && (
								<View style={styles.plusOneBox}>
									<Text style={styles.editLabel}>Plus one name</Text>
									<TextInput
										style={styles.editInput}
										value={editPlusOneName}
										onChangeText={setEditPlusOneName}
										placeholder="Leave blank if unknown yet"
									/>
									<View style={styles.editButtonRow}>
										<TouchableOpacity
											style={styles.saveButtonSmall}
											onPress={() =>
												editPlusOneMember
													? handleUpdatePlusOneName(editPlusOneMember.id)
													: handleCreatePlusOne(guest.id)
											}
										>
											<Text style={styles.saveButtonText}>
												{editPlusOneMember ? "Update name" : "Save name"}
											</Text>
										</TouchableOpacity>
										{editPlusOneMember && (
											<TouchableOpacity
												onPress={() =>
													handleRemovePlusOne(editPlusOneMember.id, guest.id)
												}
											>
												<Text style={styles.deleteLink}>Remove</Text>
											</TouchableOpacity>
										)}
									</View>
								</View>
							)}
						</View>
						<View style={styles.editButtonRow}>
							<TouchableOpacity
								style={styles.saveButton}
								onPress={() => handleSaveEdit(guest.id)}
								disabled={saving}
							>
								<Text style={styles.saveButtonText}>
									{saving ? "Saving..." : "Save"}
								</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={styles.cancelButton}
								onPress={() => setEditingId(null)}
							>
								<Text style={styles.cancelButtonText}>Cancel</Text>
							</TouchableOpacity>
						</View>
					</View>
				) : (
					<View key={guest.id}>
						<View style={styles.dataRow}>
							<Text style={[styles.dataCell, { flex: 2 }]} numberOfLines={1}>
								{guest.party_members.map((m) => m.name).join(", ") || "—"}
							</Text>
							<View style={{ flex: 1 }}>
								<StatusBadge status={guest.rsvp_status} />
							</View>
							<TouchableOpacity
								style={{ width: 60 }}
								onPress={() =>
									setExpandedId(expandedId === guest.id ? null : guest.id)
								}
							>
								<Text style={styles.viewLink}>
									{expandedId === guest.id ? "Hide" : "View"}
								</Text>
							</TouchableOpacity>
						</View>

						{expandedId === guest.id && (
							<View style={styles.detailsBox}>
								<DetailLine label="Code" value={guest.invite_code} />
								<DetailLine label="Email" value={guest.email ?? "—"} />
								<DetailLine
									label="Party size"
									value={String(guest.party_size)}
								/>
								<DetailLine
									label="Plus one allowed"
									value={guest.plus_one_allowed ? "Yes" : "No"}
								/>
								<DetailLine
									label="Dietary notes"
									value={guest.dietary_notes ?? "—"}
								/>
								{isEditor && (
									<View style={styles.editButtonRow}>
										<TouchableOpacity onPress={() => startEdit(guest)}>
											<Text style={styles.editLink}>Edit</Text>
										</TouchableOpacity>
										<TouchableOpacity onPress={() => handleDelete(guest.id)}>
											<Text style={styles.deleteLink}>Delete</Text>
										</TouchableOpacity>
									</View>
								)}
							</View>
						)}
					</View>
				),
			)}
		</ScrollView>
	);
}

function DetailLine({ label, value }: { label: string; value: string }) {
	return (
		<View style={styles.detailLine}>
			<Text style={styles.detailLabel}>{label}</Text>
			<Text style={styles.detailValue}>{value}</Text>
		</View>
	);
}

function StatusBadge({ status }: { status: string }) {
	const colors: Record<string, { bg: string; text: string }> = {
		pending: { bg: "#f0e6d8", text: "#8B7355" },
		yes: { bg: "#e0e8dc", text: "#4A5D45" },
		no: { bg: "#f5dede", text: "#7A2E38" },
	};
	const c = colors[status] ?? colors.pending;

	return (
		<View style={[styles.badge, { backgroundColor: c.bg }]}>
			<Text style={[styles.badgeText, { color: c.text }]}>{status}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#FDF8F5" },
	content: { padding: 24, paddingTop: 60, paddingBottom: 60 },
	center: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "#FDF8F5",
	},
	backButton: { marginBottom: 12 },
	backText: { color: "#B15D63", fontSize: 14 },
	title: {
		fontSize: 26,
		fontStyle: "italic",
		color: "#3D0F14",
		textAlign: "center",
		marginBottom: 4,
	},
	subtitle: {
		fontSize: 14,
		color: "#B15D63",
		textAlign: "center",
		marginBottom: 16,
	},
	addButton: {
		backgroundColor: "#7A2E38",
		borderRadius: 999,
		paddingVertical: 10,
		paddingHorizontal: 20,
		marginTop: 20,
		marginBottom: 20,
		maxWidth: 150,
		marginLeft: "auto",
	},
	addButtonText: { color: "white", fontWeight: "600", fontSize: 14 },
	headerRow: {
		flexDirection: "row",
		borderBottomWidth: 2,
		borderBottomColor: "#F0C4CB",
		paddingBottom: 8,
		marginBottom: 4,
	},
	headerCell: { fontSize: 12, fontWeight: "600", color: "#B15D63" },
	dataRow: {
		flexDirection: "row",
		borderBottomWidth: 1,
		borderBottomColor: "#F0C4CB",
		paddingVertical: 12,
		alignItems: "center",
	},
	dataCell: { fontSize: 14, color: "#3D0F14", paddingRight: 8 },
	badge: {
		paddingHorizontal: 8,
		paddingVertical: 2,
		borderRadius: 999,
		alignSelf: "flex-start",
	},
	badgeText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
	viewLink: {
		color: "#4A5D45",
		fontSize: 13,
		textDecorationLine: "underline",
		textAlign: "center",
	},
	editLink: { color: "#4A5D45", fontSize: 13, textDecorationLine: "underline" },
	deleteLink: {
		color: "#B15D63",
		fontSize: 13,
		textDecorationLine: "underline",
	},
	detailsBox: {
		backgroundColor: "white",
		borderRadius: 12,
		padding: 16,
		marginBottom: 10,
	},
	detailLine: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingVertical: 4,
	},
	detailLabel: { fontSize: 13, color: "#B15D63", fontWeight: "600" },
	detailValue: {
		fontSize: 13,
		color: "#3D0F14",
		flexShrink: 1,
		textAlign: "right",
	},
	editRow: {
		backgroundColor: "white",
		borderRadius: 12,
		padding: 16,
		marginBottom: 10,
	},
	editLabel: {
		fontSize: 12,
		fontWeight: "600",
		color: "#3D0F14",
		marginBottom: 4,
		marginTop: 8,
	},
	editInput: {
		borderWidth: 1,
		borderColor: "#F0C4CB",
		borderRadius: 8,
		padding: 10,
		fontSize: 14,
		backgroundColor: "#FDF8F5",
	},
	editButtonRow: { flexDirection: "row", gap: 10, marginTop: 16 },
	saveButton: {
		backgroundColor: "#7A2E38",
		borderRadius: 999,
		paddingVertical: 10,
		paddingHorizontal: 20,
		marginTop: 20,
		marginBottom: 10,
		maxWidth: 150,
		alignSelf: "center",
	},
	saveButtonText: {
		color: "white",
		fontWeight: "600",
		fontSize: 13,
		textAlign: "center",
	},
	cancelButton: {
		backgroundColor: "#7A2E38",
		borderRadius: 999,
		paddingVertical: 10,
		paddingHorizontal: 20,
		marginTop: 20,
		marginBottom: 10,
		maxWidth: 150,
		alignSelf: "center",
	},
	cancelButtonText: { color: "white", fontSize: 13, fontWeight: 600 },
	plusOneSection: { marginTop: 8, marginBottom: 8 },
	plusOneToggleRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginTop: 8,
	},
	toggle: {
		width: 44,
		height: 26,
		borderRadius: 13,
		backgroundColor: "#F0C4CB",
		padding: 3,
		justifyContent: "center",
	},
	toggleOn: { backgroundColor: "#4A5D45" },
	toggleKnob: {
		width: 20,
		height: 20,
		borderRadius: 10,
		backgroundColor: "white",
	},
	toggleKnobOn: { alignSelf: "flex-end" },
	plusOneBox: {
		backgroundColor: "white",
		borderRadius: 8,
		padding: 10,
		marginTop: 8,
		borderWidth: 1,
		borderColor: "#F0C4CB",
	},
	saveButtonSmall: {
		backgroundColor: "#7A2E38",
		borderRadius: 999,
		paddingVertical: 8,
		paddingHorizontal: 16,
	},
});
