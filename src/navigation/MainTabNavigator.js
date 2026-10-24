import React from "react";
import { Platform } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import HomeScreen from "../screens/Main/HomeScreen";
import DepartmentListScreen from "../screens/Main/DepartmentListScreen";
import AppointmentScreen from "../screens/Main/AppointmentScreen";
import VideoConsultScreen from "../screens/Main/VideoConsultScreen";
import COLORS from "../constants/colors";
import { useLanguage } from "../context/LanguageContext";

const Tab = createBottomTabNavigator();

const ICONS = {
  Home: "home",
  Department: "grid",
  Appointment: "calendar",
  VideoConsult: "videocam",
};

export default function MainTabNavigator() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  // Ensure bottom inset accommodates gesture pills / Android navigation bars
  const bottomInset = insets.bottom > 0 ? insets.bottom : (Platform.OS === "android" ? 12 : 10);
  const tabHeight = 60 + bottomInset;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          height: tabHeight,
          paddingBottom: bottomInset,
          paddingTop: 8,
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          elevation: 10,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          marginTop: 2,
        },
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons
            name={focused ? ICONS[route.name] : `${ICONS[route.name]}-outline`}
            size={22}
            color={color}
          />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: t.home }} />
      <Tab.Screen
        name="Department"
        component={DepartmentListScreen}
        options={{ tabBarLabel: t.departments }}
      />
      <Tab.Screen
        name="Appointment"
        component={AppointmentScreen}
        options={{ tabBarLabel: t.appointment }}
      />
      <Tab.Screen
        name="VideoConsult"
        component={VideoConsultScreen}
        options={{ tabBarLabel: t.videoConsult }}
      />
    </Tab.Navigator>
  );
}
