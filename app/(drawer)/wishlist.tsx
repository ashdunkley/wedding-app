"use client";

import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";
import { useEffect, useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	TouchableOpacity,
	TextInput,
	Alert,
	Image,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";
import { getSession } from "../../lib/session";

type Item = {
	id: string;
	item: string;
	link: string | null;
	price: number | null;
	image_url: string | null;
	notes: string | null;
	group_id: string | null;
	claimed_by: string | null;
};

type PartyMemberOption = { id: string; name: string };

export default function WishlistScreen() {
	const [items, setItems] = useState<Item[]>([]);
	const [loading, setLoading] = useState(true);
	const [isEditor, setIsEditor] = useState(false);
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [expandedAltId, setExpandedAltId] = useState<string | null>(null);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [showAddForm, setShowAddForm] = useState(false);

	const [partyMembers, setPartyMembers] = useState<PartyMemberOption[]>([]);
	const [claimPickerFor, setClaimPickerFor] = useState<string | null>(null);
	const [claimSearch, setClaimSearch] = useState("");
	const [selectedClaimants, setSelectedClaimants] = useState<Set<string>>(
		new Set(),
	);

	const [addingAltFor, setAddingAltFor] = useState<string | null>(null);
	const [altName, setAltName] = useState("");
	const [altPrice, setAltPrice] = useState("");

	const [editingAltId, setEditingAltId] = useState<string | null>(null);
	const [editAltName, setEditAltName] = useState("");
	const [editAltPrice, setEditAltPrice] = useState("");

	const [newItem, setNewItem] = useState("");
	const [newPrice, setNewPrice] = useState("");
	const [newLink, setNewLink] = useState("");

	const [editItem, setEditItem] = useState("");
	const [editPrice, setEditPrice] = useState("");
	const [editLink, setEditLink] = useState("");
	const [editNotes, setEditNotes] = useState("");

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
			.from("wishlist_items")
			.select("*")
			.order("created_at", { ascending: true });
		setItems(data ?? []);

		const { data: members } = await supabase
			.from("party_members")
			.select("id, name")
			.order("name");
		setPartyMembers(members ?? []);

		setLoading(false);
	}

	const groups = new Map<string, Item[]>();
	for (const item of items) {
		const key = item.group_id ?? item.id;
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key)!.push(item);
	}
	const displayGroups = Array.from(groups.values()).map((group) => {
		const claimedIndex = group.findIndex((i) => i.claimed_by);
		if (claimedIndex > 0) {
			const reordered = [...group];
			const [claimed] = reordered.splice(claimedIndex, 1);
			reordered.unshift(claimed);
			return reordered;
		}
		return group;
	});

	async function handleAdd() {
		if (!newItem.trim()) {
			Alert.alert("Please enter an item name.");
			return;
		}
		setSaving(true);

		const { error } = await supabase.from("wishlist_items").insert({
			item: newItem.trim(),
			price: newPrice.trim() ? parseFloat(newPrice) : null,
			link: newLink.trim() || null,
		});

		setSaving(false);
		if (error) {
			Alert.alert("Error", error.message);
			return;
		}

		setNewItem("");
		setNewPrice("");
		setNewLink("");
		setShowAddForm(false);
		load();
	}

	function startEdit(item: Item) {
		setEditingId(item.id);
		setExpandedId(null);
		setEditItem(item.item);
		setEditPrice(item.price?.toString() ?? "");
		setEditLink(item.link ?? "");
		setEditNotes(item.notes ?? "");
	}

	async function handleSaveEdit(id: string) {
		if (!editItem.trim()) return;
		setSaving(true);

		const { error } = await supabase
			.from("wishlist_items")
			.update({
				item: editItem.trim(),
				price: editPrice.trim() ? parseFloat(editPrice) : null,
				link: editLink.trim() || null,
				notes: editNotes.trim() || null,
			})
			.eq("id", id);

		setSaving(false);
		if (error) {
			Alert.alert("Error", error.message);
			return;
		}

		setEditingId(null);
		load();
	}

	async function handleDelete(id: string) {
		Alert.alert("Delete this item?", undefined, [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Delete",
				style: "destructive",
				onPress: async () => {
					await supabase.from("wishlist_items").delete().eq("id", id);
					load();
				},
			},
		]);
	}

	function openClaimPicker(item: Item) {
		setClaimPickerFor(item.id);
		setClaimSearch("");
		setSelectedClaimants(
			new Set(
				item.claimed_by
					? item.claimed_by.split(" & ").map((n) => n.trim())
					: [],
			),
		);
	}

	function toggleClaimant(name: string) {
		setSelectedClaimants((prev) => {
			const next = new Set(prev);
			if (next.has(name)) next.delete(name);
			else next.add(name);
			return next;
		});
	}

	async function handleUpdateClaim(itemId: string) {
		setSaving(true);
		const names = Array.from(selectedClaimants);
		const claimedBy = names.length > 0 ? names.join(" & ") : null;

		const { error } = await supabase
			.from("wishlist_items")
			.update({
				claimed_by: claimedBy,
				claimed_at: claimedBy ? new Date().toISOString() : null,
			})
			.eq("id", itemId);

		if (!error) {
			const selectedIds = partyMembers
				.filter((m) => names.includes(m.name))
				.map((m) => m.id);
			await supabase
				.from("wishlist_claimants")
				.delete()
				.eq("wishlist_item_id", itemId);
			if (selectedIds.length > 0) {
				await supabase.from("wishlist_claimants").insert(
					selectedIds.map((id) => ({
						wishlist_item_id: itemId,
						party_member_id: id,
					})),
				);
			}
		}

		setSaving(false);
		setClaimPickerFor(null);
		load();
	}

	function renderClaimPicker(itemId: string) {
		return (
			<View style={styles.claimPicker}>
				<TextInput
					style={styles.formInput}
					value={claimSearch}
					onChangeText={setClaimSearch}
					placeholder="Search guests..."
				/>
				<ScrollView style={{ maxHeight: 150, marginTop: 8 }}>
					{partyMembers
						.filter((m) =>
							m.name.toLowerCase().includes(claimSearch.toLowerCase()),
						)
						.map((m) => (
							<TouchableOpacity
								key={m.id}
								onPress={() => toggleClaimant(m.name)}
								style={[
									styles.claimOption,
									selectedClaimants.has(m.name) && styles.claimOptionSelected,
								]}
							>
								<Text
									style={
										selectedClaimants.has(m.name)
											? styles.claimOptionTextSelected
											: styles.claimOptionText
									}
								>
									{selectedClaimants.has(m.name) ? "✓ " : ""}
									{m.name}
								</Text>
							</TouchableOpacity>
						))}
				</ScrollView>
				<View style={styles.editButtonRow}>
					<TouchableOpacity
						style={styles.saveButton}
						onPress={() => handleUpdateClaim(itemId)}
						disabled={saving}
					>
						<Text style={styles.saveButtonText}>
							{saving ? "Saving..." : "Save claim"}
						</Text>
					</TouchableOpacity>
					<TouchableOpacity
						style={styles.cancelButton}
						onPress={() => setClaimPickerFor(null)}
					>
						<Text style={styles.cancelButtonText}>Cancel</Text>
					</TouchableOpacity>
				</View>
			</View>
		);
	}

	async function handleAddAlternative(mainItem: Item) {
		if (!altName.trim()) return;
		setSaving(true);

		let groupId = mainItem.group_id;
		if (!groupId) {
			groupId = uuidv4();
			await supabase
				.from("wishlist_items")
				.update({ group_id: groupId })
				.eq("id", mainItem.id);
		}

		await supabase.from("wishlist_items").insert({
			item: altName.trim(),
			price: altPrice.trim() ? parseFloat(altPrice) : null,
			group_id: groupId,
		});

		setSaving(false);
		setAddingAltFor(null);
		setAltName("");
		setAltPrice("");
		load();
	}

	function startEditAlt(alt: Item) {
		setEditingAltId(alt.id);
		setEditAltName(alt.item);
		setEditAltPrice(alt.price?.toString() ?? "");
	}

	async function handleSaveAltEdit(id: string) {
		if (!editAltName.trim()) return;
		setSaving(true);

		const { error } = await supabase
			.from("wishlist_items")
			.update({
				item: editAltName.trim(),
				price: editAltPrice.trim() ? parseFloat(editAltPrice) : null,
			})
			.eq("id", id);

		setSaving(false);
		if (error) {
			Alert.alert("Error", error.message);
			return;
		}

		setEditingAltId(null);
		load();
	}

	async function handleDeleteAlt(id: string) {
		Alert.alert("Delete this alternative?", undefined, [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Delete",
				style: "destructive",
				onPress: async () => {
					await supabase.from("wishlist_items").delete().eq("id", id);
					load();
				},
			},
		]);
	}

	if (loading) {
		return (
			<View style={styles.center}>
				<Text>Loading...</Text>
			</View>
		);
	}

	const claimedCount = displayGroups.filter((g) =>
		g.some((i) => i.claimed_by),
	).length;

	return (
		<ScrollView style={styles.container} contentContainerStyle={styles.content}>
			
			<Text style={styles.subtitle}>
				{displayGroups.length} items · {claimedCount} claimed
			</Text>

			{isEditor && (
				<TouchableOpacity
					style={styles.addButton}
					onPress={() => setShowAddForm((prev) => !prev)}
				>
					<Text style={styles.addButtonText}>
						{showAddForm ? "Cancel" : "+ Add item"}
					</Text>
				</TouchableOpacity>
			)}

			{isEditor && showAddForm && (
				<View style={styles.formBox}>
					<Text style={styles.formLabel}>Item name</Text>
					<TextInput
						style={styles.formInput}
						value={newItem}
						onChangeText={setNewItem}
					/>
					<Text style={styles.formLabel}>Price (£)</Text>
					<TextInput
						style={styles.formInput}
						value={newPrice}
						onChangeText={setNewPrice}
						keyboardType="decimal-pad"
					/>
					<Text style={styles.formLabel}>Link</Text>
					<TextInput
						style={styles.formInput}
						value={newLink}
						onChangeText={setNewLink}
						autoCapitalize="none"
					/>
					<TouchableOpacity
						style={styles.saveButton}
						onPress={handleAdd}
						disabled={saving}
					>
						<Text style={styles.saveButtonText}>
							{saving ? "Adding..." : "Add item"}
						</Text>
					</TouchableOpacity>
				</View>
			)}

			{displayGroups.map((group) => {
				const mainItem = group[0];
				const alternatives = group.slice(1);

				return (
					<View key={mainItem.id} style={styles.groupCard}>
						{editingId === mainItem.id ? (
							<View style={styles.formBox}>
								<Text style={styles.formLabel}>Item name</Text>
								<TextInput
									style={styles.formInput}
									value={editItem}
									onChangeText={setEditItem}
								/>
								<Text style={styles.formLabel}>Price (£)</Text>
								<TextInput
									style={styles.formInput}
									value={editPrice}
									onChangeText={setEditPrice}
									keyboardType="decimal-pad"
								/>
								<Text style={styles.formLabel}>Link</Text>
								<TextInput
									style={styles.formInput}
									value={editLink}
									onChangeText={setEditLink}
									autoCapitalize="none"
								/>
								<Text style={styles.formLabel}>Notes</Text>
								<TextInput
									style={styles.formInput}
									value={editNotes}
									onChangeText={setEditNotes}
								/>
								<View style={styles.editButtonRow}>
									<TouchableOpacity
										style={styles.saveButton}
										onPress={() => handleSaveEdit(mainItem.id)}
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
							<>
								<View style={styles.itemRow}>
									{mainItem.image_url && (
										<Image
											source={{ uri: mainItem.image_url }}
											style={styles.itemImage}
										/>
									)}
									<View style={{ flex: 1 }}>
										<Text style={styles.itemName}>{mainItem.item}</Text>
										<Text style={styles.itemMeta}>
											{mainItem.price
												? `£${mainItem.price.toFixed(2)}`
												: "No price set"}
											{mainItem.claimed_by &&
												` · Claimed by ${mainItem.claimed_by}`}
											{alternatives.length > 0 &&
												` · ${alternatives.length} alternative${alternatives.length === 1 ? "" : "s"}`}
										</Text>
									</View>
									<TouchableOpacity
										onPress={() =>
											setExpandedId(
												expandedId === mainItem.id ? null : mainItem.id,
											)
										}
									>
										<Text style={styles.viewLink}>
											{expandedId === mainItem.id ? "Hide" : "View"}
										</Text>
									</TouchableOpacity>
								</View>

								{expandedId === mainItem.id && (
									<View style={styles.detailsBox}>
										{mainItem.notes && (
											<Text style={styles.detailText}>{mainItem.notes}</Text>
										)}

										{isEditor && claimPickerFor !== mainItem.id && (
											<TouchableOpacity
												onPress={() => openClaimPicker(mainItem)}
												style={styles.smallActionButton}
											>
												<Text style={styles.smallActionText}>
													{mainItem.claimed_by
														? "Change claim"
														: "Mark as claimed"}
												</Text>
											</TouchableOpacity>
										)}
										{claimPickerFor === mainItem.id &&
											renderClaimPicker(mainItem.id)}

										{alternatives.length > 0 && (
											<View style={{ marginTop: 8 }}>
												<Text style={styles.altHeading}>Alternatives</Text>
												{alternatives.map((alt) =>
													editingAltId === alt.id ? (
														<View key={alt.id} style={styles.altEditBox}>
															<Text style={styles.formLabel}>Item name</Text>
															<TextInput
																style={styles.formInput}
																value={editAltName}
																onChangeText={setEditAltName}
															/>
															<Text style={styles.formLabel}>Price (£)</Text>
															<TextInput
																style={styles.formInput}
																value={editAltPrice}
																onChangeText={setEditAltPrice}
																keyboardType="decimal-pad"
															/>
															<View style={styles.editButtonRow}>
																<TouchableOpacity
																	style={styles.saveButton}
																	onPress={() => handleSaveAltEdit(alt.id)}
																	disabled={saving}
																>
																	<Text style={styles.saveButtonText}>
																		{saving ? "Saving..." : "Save"}
																	</Text>
																</TouchableOpacity>
																<TouchableOpacity
																	style={styles.cancelButton}
																	onPress={() => setEditingAltId(null)}
																>
																	<Text style={styles.cancelButtonText}>
																		Cancel
																	</Text>
																</TouchableOpacity>
															</View>
														</View>
													) : (
														<View key={alt.id} style={styles.altItemCard}>
															<View style={styles.itemRow}>
																{alt.image_url && (
																	<Image
																		source={{ uri: alt.image_url }}
																		style={styles.itemImage}
																	/>
																)}
																<View style={{ flex: 1 }}>
																	<Text style={styles.itemName}>
																		{alt.item}
																	</Text>
																	<Text style={styles.itemMeta}>
																		{alt.price
																			? `£${alt.price.toFixed(2)}`
																			: "No price set"}
																		{alt.claimed_by &&
																			` · Claimed by ${alt.claimed_by}`}
																	</Text>
																</View>
																<TouchableOpacity
																	onPress={() =>
																		setExpandedAltId(
																			expandedAltId === alt.id ? null : alt.id,
																		)
																	}
																>
																	<Text style={styles.viewLink}>
																		{expandedAltId === alt.id ? "Hide" : "View"}
																	</Text>
																</TouchableOpacity>
															</View>

															{expandedAltId === alt.id && (
																<View style={styles.altDetailsBox}>
																	{alt.notes && (
																		<Text style={styles.detailText}>
																			{alt.notes}
																		</Text>
																	)}

																	{isEditor && claimPickerFor !== alt.id && (
																		<TouchableOpacity
																			onPress={() => openClaimPicker(alt)}
																			style={styles.smallActionButton}
																		>
																			<Text style={styles.smallActionText}>
																				{alt.claimed_by
																					? "Change claim"
																					: "Mark as claimed"}
																			</Text>
																		</TouchableOpacity>
																	)}
																	{claimPickerFor === alt.id &&
																		renderClaimPicker(alt.id)}

																	{isEditor && (
																		<View style={styles.editButtonRow}>
																			<TouchableOpacity
																				onPress={() => startEditAlt(alt)}
																			>
																				<Text style={styles.editLink}>
																					Edit
																				</Text>
																			</TouchableOpacity>
																			<TouchableOpacity
																				onPress={() => handleDeleteAlt(alt.id)}
																			>
																				<Text style={styles.deleteLink}>
																					Delete
																				</Text>
																			</TouchableOpacity>
																		</View>
																	)}
																</View>
															)}
														</View>
													),
												)}
											</View>
										)}

										{isEditor && addingAltFor !== mainItem.id && (
											<TouchableOpacity
												onPress={() => setAddingAltFor(mainItem.id)}
												style={styles.smallActionButton}
											>
												<Text style={styles.smallActionText}>
													+ Add alternative
												</Text>
											</TouchableOpacity>
										)}

										{addingAltFor === mainItem.id && (
											<View style={{ marginTop: 8 }}>
												<Text style={styles.formLabel}>Alternative name</Text>
												<TextInput
													style={styles.formInput}
													value={altName}
													onChangeText={setAltName}
												/>
												<Text style={styles.formLabel}>Price (£)</Text>
												<TextInput
													style={styles.formInput}
													value={altPrice}
													onChangeText={setAltPrice}
													keyboardType="decimal-pad"
												/>
												<View style={styles.editButtonRow}>
													<TouchableOpacity
														style={styles.saveButton}
														onPress={() => handleAddAlternative(mainItem)}
														disabled={saving}
													>
														<Text style={styles.saveButtonText}>
															{saving ? "Saving..." : "Save"}
														</Text>
													</TouchableOpacity>
													<TouchableOpacity
														style={styles.cancelButton}
														onPress={() => setAddingAltFor(null)}
													>
														<Text style={styles.cancelButtonText}>Cancel</Text>
													</TouchableOpacity>
												</View>
											</View>
										)}

										{isEditor && (
											<View style={styles.editButtonRow}>
												<TouchableOpacity onPress={() => startEdit(mainItem)}>
													<Text style={styles.editLink}>Edit</Text>
												</TouchableOpacity>
												<TouchableOpacity
													onPress={() => handleDelete(mainItem.id)}
												>
													<Text style={styles.deleteLink}>Delete</Text>
												</TouchableOpacity>
											</View>
										)}
									</View>
								)}
							</>
						)}
					</View>
				);
			})}
		</ScrollView>
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
		alignItems: "center",
		marginBottom: 16,
		maxWidth: 150,
		marginLeft: "auto",
	},
	addButtonText: {
		color: "white",
		fontWeight: "600",
		fontSize: 14,
		paddingLeft: 14,
		paddingRight: 14,
	},
	groupCard: {
		backgroundColor: "white",
		borderRadius: 12,
		marginBottom: 10,
		borderWidth: 1,
		borderColor: "#F0C4CB",
		overflow: "hidden",
	},
	itemRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
	itemImage: { width: 44, height: 44, borderRadius: 8 },
	itemName: {
		fontSize: 15,
		fontWeight: "600",
		color: "#3D0F14",
		marginBottom: 2,
	},
	itemMeta: { fontSize: 12, color: "#B15D63" },
	viewLink: { color: "#4A5D45", fontSize: 13, textDecorationLine: "underline" },
	detailsBox: {
		padding: 14,
		borderTopWidth: 1,
		borderTopColor: "#F0C4CB",
		backgroundColor: "#FDF8F5",
	},
	detailText: {
		fontSize: 13,
		color: "#3D0F14",
		marginBottom: 8,
		fontStyle: "italic",
	},
	altHeading: {
		fontSize: 12,
		fontWeight: "600",
		color: "#3D0F14",
		marginBottom: 4,
	},
	altItemCard: {
		backgroundColor: "white",
		borderRadius: 10,
		borderWidth: 1,
		borderColor: "#F0C4CB",
		marginBottom: 8,
		overflow: "hidden",
	},
	altDetailsBox: {
		padding: 12,
		borderTopWidth: 1,
		borderTopColor: "#F0C4CB",
		backgroundColor: "#FDF8F5",
	},
	altEditBox: {
		backgroundColor: "white",
		borderRadius: 8,
		padding: 10,
		marginBottom: 6,
		borderWidth: 1,
		borderColor: "#F0C4CB",
	},
	smallActionButton: { marginBottom: 8 },
	smallActionText: {
		color: "#4A5D45",
		fontSize: 13,
		textDecorationLine: "underline",
	},
	claimPicker: { marginBottom: 10 },
	claimOption: { padding: 10, borderRadius: 8 },
	claimOptionSelected: { backgroundColor: "rgba(240, 196, 203, 0.35)" },
	claimOptionText: { fontSize: 14, color: "#3D0F14" },
	claimOptionTextSelected: {
		fontSize: 14,
		color: "#3D0F14",
		fontWeight: "600",
	},
	editLink: { color: "#4A5D45", fontSize: 13, textDecorationLine: "underline" },
	deleteLink: {
		color: "#B15D63",
		fontSize: 13,
		textDecorationLine: "underline",
	},
	formBox: { padding: 14 },
	formLabel: {
		fontSize: 12,
		fontWeight: "600",
		color: "#3D0F14",
		marginBottom: 4,
		marginTop: 8,
	},
	formInput: {
		borderWidth: 1,
		borderColor: "#F0C4CB",
		borderRadius: 8,
		padding: 10,
		fontSize: 14,
		backgroundColor: "white",
	},
	editButtonRow: { flexDirection: "row", gap: 10, marginTop: 12 },
	saveButton: {
		backgroundColor: "#7A2E38",
		borderRadius: 999,
		paddingVertical: 10,
		paddingHorizontal: 20,
		maxWidth: 150,
	},
	saveButtonText: { color: "white", fontWeight: "600", fontSize: 13 },
	cancelButton: {
		borderWidth: 1,
		borderColor: "#F0C4CB",
		borderRadius: 999,
		paddingVertical: 10,
		paddingHorizontal: 20,
		maxWidth: 150,
	},
	cancelButtonText: { color: "#B15D63", fontSize: 13 },
});
