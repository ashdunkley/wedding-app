import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Drawer } from "expo-router/drawer";
import {
	DrawerContentScrollView,
	DrawerItemList,
	DrawerItem,
} from "expo-router/drawer";
import { router } from "expo-router";
import { View, Text } from "react-native";
import { supabase } from "../../lib/supabase";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function CustomDrawerContent(props: any) {
	const insets = useSafeAreaInsets();

	async function handleLogout() {
		await supabase.auth.signOut();
		router.replace("/");
	}

	return (
		<DrawerContentScrollView
			{...props}
			contentContainerStyle={{ paddingTop: 0 }}
		>
			<View
				style={{
					paddingHorizontal: 24,
					paddingTop: insets.top + 20,
					paddingBottom: 24,
					borderBottomWidth: 1,
					borderBottomColor: "#F0C4CB",
					marginBottom: 8,
				}}
			>
				<Text
					style={{
						fontSize: 22,
						fontStyle: "italic",
						color: "#3D0F14",
						textAlign: "center",
					}}
				>
					Ash & Bekah
				</Text>
				<Text style={{ fontSize: 18, textAlign: "center", marginTop: 4 }}>
					🌿
				</Text>
			</View>

			<DrawerItemList {...props} />

			<View
				style={{
					marginTop: 24,
					paddingTop: 16,
					borderTopWidth: 1,
					borderTopColor: "#F0C4CB",
					marginHorizontal: 12,
				}}
			>
				<DrawerItem
					label="Log out"
					onPress={handleLogout}
					labelStyle={{ color: "#B15D63", fontWeight: "600" }}
				/>
			</View>
		</DrawerContentScrollView>
	);
}

export default function DrawerLayout() {
	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<Drawer
				drawerContent={(props) => <CustomDrawerContent {...props} />}
				screenOptions={{
					headerStyle: {
						backgroundColor: "#FDF8F5",
						elevation: 0,
						shadowOpacity: 0,
						borderBottomWidth: 1,
						borderBottomColor: "#F0C4CB",
					},
					headerTintColor: "#3D0F14",
					headerTitleStyle: {
						fontStyle: "italic",
						fontSize: 20,
						color: "#3D0F14",
					},
					headerTitleAlign: "center",
					drawerStyle: { backgroundColor: "#FDF8F5", width: 260 },
					drawerActiveTintColor: "#7A2E38",
					drawerActiveBackgroundColor: "rgba(240, 196, 203, 0.35)",
					drawerInactiveTintColor: "#3D0F14",
					drawerLabelStyle: {
						fontSize: 15,
						marginLeft: -8,
						textAlign: "center",
					},
					drawerItemStyle: { borderRadius: 10, marginHorizontal: 8 },
				}}
			>
				<Drawer.Screen
					name="dashboard"
					options={{ title: "Dashboard", drawerLabel: "Dashboard" }}
				/>
				<Drawer.Screen
					name="guests"
					options={{ title: "Guest List", drawerLabel: "Guest List" }}
				/>
				<Drawer.Screen
					name="wishlist"
					options={{ title: "Wishlist", drawerLabel: "Wishlist" }}
				/>
				<Drawer.Screen
					name="checklist"
					options={{ title: "Checklist", drawerLabel: "Checklist" }}
				/>
				<Drawer.Screen
					name="budget"
					options={{ title: "Budget", drawerLabel: "Budget" }}
				/>
				<Drawer.Screen
					name="guestbook"
					options={{ title: "Guestbook", drawerLabel: "Guestbook" }}
				/>
				<Drawer.Screen
					name="thank-you"
					options={{
						title: "Thank You Tracker",
						drawerLabel: "Thank You Tracker",
					}}
				/>
			</Drawer>
		</GestureHandlerRootView>
	);
}
