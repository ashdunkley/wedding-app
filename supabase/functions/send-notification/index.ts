import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
	const payload = await req.json();

	const supabaseAdmin = createClient(
		Deno.env.get("SUPABASE_URL")!,
		Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
	);

	let title = "";
	let body = "";

	// Webhook payloads include `type`, `table`, `record`, `old_record`
	if (payload.table === "guests" && payload.type === "UPDATE") {
		if (
			payload.record.rsvp_status === "yes" &&
			payload.old_record?.rsvp_status !== "yes"
		) {

			const { data: members } = await supabaseAdmin
				.from("party_members")
				.select("name")
				.eq("guest_id", payload.record.id);

			const names = (members ?? [])
				.map((m: { name: string }) => m.name)
				.join(" & ");
			title = "New RSVP! 🎉";
			body = `${names || "Someone"} just confirmed they're coming!`;
		}
	} else if (payload.table === "guests" && payload.type === "UPDATE_NO") {
		const { data: members } = await supabaseAdmin
			.from("party_members")
			.select("name")
			.eq("guest_id", payload.record.id);
		
		const names = (members ?? [])
			.map((m: { name: string }) => m.name)
			.join(" & ");
		title = "RSVP update";
		body = `${names || "Someone"} can't make it 😢`;
	} else if (payload.table === "wishlist_items" && payload.type === "UPDATE") {
		if (payload.record.claimed_by && !payload.old_record?.claimed_by) {
			title = "Wishlist claimed! 🎁";
			body = `${payload.record.claimed_by} claimed "${payload.record.item}"`;
		}
	} else if (
		payload.table === "guestbook_messages" &&
		payload.type === "INSERT"
	) {
		title = "New message! 💌";
		body = `${payload.record.uploader_name || "Someone"} left a message in your guestbook`;
	} else if (payload.table === "photos" && payload.type === "INSERT") {
		title = "New photo! 📸";
		body = `${payload.record.uploader_name || "Someone"} shared a photo`;
	}

	if (!title) {
		return new Response(JSON.stringify({ skipped: true }), { status: 200 });
	}

	const { data: profiles } = await supabaseAdmin
		.from("profiles")
		.select("push_token")
		.not("push_token", "is", null);

	const tokens = (profiles ?? []).map((p) => p.push_token).filter(Boolean);

	if (tokens.length === 0) {
		return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
	}

	const messages = tokens.map((token) => ({
		to: token,
		sound: "default",
		title,
		body,
	}));

	const response = await fetch("https://exp.host/--/api/v2/push/send", {
		method: "POST",
		headers: { Accept: "application/json", "Content-Type": "application/json" },
		body: JSON.stringify(messages),
	});

	const result = await response.json();
	return new Response(JSON.stringify({ sent: tokens.length, result }), {
		status: 200,
	});
});
