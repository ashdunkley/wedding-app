import { useState } from "react";
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	StyleSheet,
	Alert,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { registerForPushNotifications } from "../lib/notifications";

export default function LoginScreen() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);

	async function handleLogin() {
		if (!email.trim() || !password.trim()) {
			Alert.alert("Please enter both email and password");
			return;
		}

		setLoading(true);

		const { error } = await supabase.auth.signInWithPassword({
			email: email.trim(),
			password,
		});

		setLoading(false);

		if (error) {
			Alert.alert("Login failed", "Incorrect email or password");
			return;
		}

		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (user) {
			const { data: profile } = await supabase
				.from("profiles")
				.select("id")
				.eq("auth_user_id", user.id)
				.single();
			if (profile) {
				await registerForPushNotifications(profile.id);
			}
		}

		router.replace("(drawer)/dashboard");
	}

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Ash & Bekah</Text>
			<Text style={styles.subtitle}>Editor Login</Text>

			<TextInput
				style={styles.input}
				value={email}
				onChangeText={setEmail}
				placeholder="Email"
				autoCapitalize="none"
				keyboardType="email-address"
				autoFocus
			/>

			<TextInput
				style={styles.input}
				value={password}
				onChangeText={setPassword}
				placeholder="Password"
				secureTextEntry
			/>

			<TouchableOpacity
				style={styles.button}
				onPress={handleLogin}
				disabled={loading}
			>
				<Text style={styles.buttonText}>
					{loading ? "Logging in..." : "Log in"}
				</Text>
			</TouchableOpacity>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#FDF8F5",
		justifyContent: "center",
		padding: 24,
	},
	title: {
		fontSize: 32,
		fontStyle: "italic",
		color: "#3D0F14",
		textAlign: "center",
		marginBottom: 8,
	},
	subtitle: {
		fontSize: 16,
		color: "#B15D63",
		textAlign: "center",
		marginBottom: 32,
	},
	input: {
		borderWidth: 1,
		borderColor: "#F0C4CB",
		borderRadius: 8,
		padding: 14,
		fontSize: 16,
		backgroundColor: "white",
		marginBottom: 16,
		color: '#3D0F14'
	},
	button: {
		backgroundColor: "#7A2E38",
		borderRadius: 999,
		padding: 16,
		alignItems: "center",
		marginTop: 8,
	},
	buttonText: {
		color: "white",
		fontWeight: "bold",
		fontSize: 16,
	},
});
