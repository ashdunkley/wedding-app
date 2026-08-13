import { useEffect, useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	TouchableOpacity,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";
import { getSession } from "../../lib/session";
import { Link } from "expo-router";

export default function DashboardScreen() {
	const [name, setName] = useState("");
	const [loading, setLoading] = useState(true);
	const [stats, setStats] = useState({
		totalInvited: 0,
		totalConfirmed: 0,
		totalPending: 0,
		wishlistClaimed: 0,
		wishlistTotal: 0,
		checklistDone: 0,
		checklistTotal: 0,
		budgetEstimated: 0,
		budgetActual: 0,
		thankYouSent: 0,
		thankYouTotal: 0,
		photoCount: 0,
		messageCount: 0,
	});

	useEffect(() => {
		load();
	}, []);

	async function load() {
		const session = await getSession();
		if (!session) {
			router.replace("/");
			return;
		}
		setName(session.name);

		const { data: guests } = await supabase
			.from("guests")
			.select("party_size, rsvp_status");
		const totalInvited = (guests ?? []).reduce(
			(sum, g) => sum + g.party_size,
			0,
		);
		const totalConfirmed = (guests ?? [])
			.filter((g) => g.rsvp_status === "yes")
			.reduce((sum, g) => sum + g.party_size, 0);
		const totalPending = (guests ?? [])
			.filter((g) => g.rsvp_status === "pending")
			.reduce((sum, g) => sum + g.party_size, 0);

		const { data: wishlistItems } = await supabase
			.from("wishlist_items")
			.select("claimed_by");
		const wishlistTotal = wishlistItems?.length ?? 0;
		const wishlistClaimed = (wishlistItems ?? []).filter(
			(i) => i.claimed_by,
		).length;

		const { data: checklistItems } = await supabase
			.from("checklist_items")
			.select("done");
		const checklistTotal = checklistItems?.length ?? 0;
		const checklistDone = (checklistItems ?? []).filter((i) => i.done).length;

		const { data: budgetItems } = await supabase
			.from("budget_items")
			.select("estimated_cost, actual_cost");
		const budgetEstimated = (budgetItems ?? []).reduce(
			(sum, i) => sum + (i.estimated_cost ?? 0),
			0,
		);
		const budgetActual = (budgetItems ?? []).reduce(
			(sum, i) => sum + (i.actual_cost ?? 0),
			0,
		);

		const { data: thankYouEntries } = await supabase
			.from("thank_you_tracker")
			.select("sent");
		const thankYouTotal = thankYouEntries?.length ?? 0;
		const thankYouSent = (thankYouEntries ?? []).filter((e) => e.sent).length;

		const { count: photoCount } = await supabase
			.from("photos")
			.select("*", { count: "exact", head: true });
		const { count: messageCount } = await supabase
			.from("guestbook_messages")
			.select("*", { count: "exact", head: true });

		setStats({
			totalInvited,
			totalConfirmed,
			totalPending,
			wishlistClaimed,
			wishlistTotal,
			checklistDone,
			checklistTotal,
			budgetEstimated,
			budgetActual,
			thankYouSent,
			thankYouTotal,
			photoCount: photoCount ?? 0,
			messageCount: messageCount ?? 0,
		});
		setLoading(false);
	}

	if (loading) {
		return (
			<View style={styles.center}>
				<Text>Loading...</Text>
			</View>
		);
	}

	const daysUntilWedding = Math.ceil(
		(new Date("2026-10-26").getTime() - new Date().getTime()) /
			(1000 * 60 * 60 * 24),
	);

	return (
		<ScrollView style={styles.container} contentContainerStyle={styles.content}>
			<Text style={styles.title}>Welcome, {name}</Text>
			<Text style={styles.flourish}>🌿</Text>

			{daysUntilWedding > 0 && (
				<View style={styles.countdownCard}>
					<Text style={styles.countdownNumber}>{daysUntilWedding}</Text>
					<Text style={styles.countdownLabel}>days to go</Text>
				</View>
			)}

			<Text style={styles.sectionLabel}>Guests</Text>
			<View style={styles.statsGrid}>
				<StatCard
					label="Invited"
					value={stats.totalInvited}
					href="/(drawer)/guests"
				/>
				<StatCard
					label="Confirmed"
					value={stats.totalConfirmed}
					color="#4A5D45"
					href="/(drawer)/guests"
				/>
				<StatCard
					label="Awaiting reply"
					value={stats.totalPending}
					color="#8B7355"
					href="/(drawer)/guests"
				/>
			</View>

			<Text style={styles.sectionLabel}>Wishlist</Text>
			<View style={styles.statsGrid}>
				<StatCard
					label="Claimed"
					value={`${stats.wishlistClaimed}/${stats.wishlistTotal}`}
					href="/(drawer)/wishlist"
				/>
			</View>

			<Text style={styles.sectionLabel}>Checklist</Text>
			<View style={styles.statsGrid}>
				<StatCard
					label="Done"
					value={`${stats.checklistDone}/${stats.checklistTotal}`}
					href="/(drawer)/checklist"
				/>
			</View>

			<Text style={styles.sectionLabel}>Budget</Text>
			<View style={styles.statsGrid}>
				<StatCard
					label="Estimated"
					value={`£${stats.budgetEstimated.toFixed(0)}`}
					href="/(drawer)/budget"
				/>
				<StatCard
					label="Actual"
					value={`£${stats.budgetActual.toFixed(0)}`}
					href="/(drawer)/budget"
				/>
			</View>

			<Text style={styles.sectionLabel}>Thank You Cards</Text>
			<View style={styles.statsGrid}>
				<StatCard
					label="Sent"
					value={`${stats.thankYouSent}/${stats.thankYouTotal}`}
					href="/(drawer)/thank-you"
				/>
			</View>

			<Text style={styles.sectionLabel}>Guestbook</Text>
			<View style={styles.statsGrid}>
				<StatCard
					label="Photos"
					value={stats.photoCount}
					href="/(drawer)/guestbook"
				/>
				<StatCard
					label="Messages"
					value={stats.messageCount}
					href="/(drawer)/guestbook"
				/>
			</View>
		</ScrollView>
	);
}

function StatCard({
	label,
	value,
	color,
	href,
}: {
	label: string;
	value: string | number;
	color?: string;
	href: string;
}) {
	return (
		<Link href={href} asChild>
			<TouchableOpacity style={styles.statCard}>
				<Text style={[styles.statValue, color ? { color } : null]}>
					{value}
				</Text>
				<Text style={styles.statLabel}>{label}</Text>
			</TouchableOpacity>
		</Link>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#FDF8F5" },
	content: { padding: 24, paddingBottom: 60 },
	center: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "#FDF8F5",
	},
	title: {
		fontSize: 26,
		fontStyle: "italic",
		color: "#3D0F14",
		textAlign: "center",
		marginBottom: 4,
	},
	flourish: { fontSize: 20, textAlign: "center", marginBottom: 20 },
	countdownCard: {
		backgroundColor: "#7A2E38",
		borderRadius: 16,
		padding: 20,
		alignItems: "center",
		marginBottom: 24,
	},
	countdownNumber: { fontSize: 36, fontWeight: "bold", color: "white" },
	countdownLabel: { fontSize: 13, color: "#F0C4CB", marginTop: 2 },
	sectionLabel: {
		fontSize: 13,
		fontWeight: "600",
		color: "#7A2E38",
		marginTop: 16,
		marginBottom: 8,
	},
	statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
	statCard: {
		backgroundColor: "white",
		borderRadius: 14,
		borderWidth: 1,
		borderColor: "#F0C4CB",
		padding: 14,
		minWidth: "30%",
		flex: 1,
		alignItems: "center",
	},
	statValue: {
		fontSize: 20,
		fontStyle: "italic",
		color: "#7A2E38",
		marginBottom: 2,
	},
	statLabel: { fontSize: 11, color: "#B15D63", textAlign: "center" },
});
