import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import AuthNavigator from "./AuthNavigator";
import MainTabNavigator from "./MainTabNavigator";
import DepartmentListScreen from "../screens/Main/DepartmentListScreen";
import DepartmentDetailScreen from "../screens/Main/DepartmentDetailScreen";
import DoctorProfileScreen from "../screens/Main/DoctorProfileScreen";
import BookAppointmentScreen from "../screens/Main/BookAppointmentScreen";
import AppointmentDetailScreen from "../screens/Main/AppointmentDetailScreen";
import ServiceDetailScreen from "../screens/Main/ServiceDetailScreen";
import HealthTipDetailScreen from "../screens/Main/HealthTipDetailScreen";
import VideoConsultScreen from "../screens/Main/VideoConsultScreen";
import VideoCallRoomScreen from "../screens/Main/VideoCallRoomScreen";
import CallScreen from "../screens/Main/CallScreen";
import NotificationScreen from "../screens/Main/NotificationScreen";
import ProfileScreen from "../screens/Main/ProfileScreen";
import EditProfileScreen from "../screens/Main/EditProfileScreen";
import MedicalRecordsScreen from "../screens/Main/MedicalRecordsScreen";
import BillingScreen from "../screens/Main/BillingScreen";
import HelpSupportScreen from "../screens/Main/HelpSupportScreen";
import SettingsScreen from "../screens/Main/SettingsScreen";
import SearchScreen from "../screens/Main/SearchScreen";
import DoctorDashboardScreen from "../screens/Main/DoctorDashboardScreen";
import AdminDashboardScreen from "../screens/Main/AdminDashboardScreen";
import SuperAdminDashboardScreen from "../screens/Main/SuperAdminDashboardScreen";
import SplashScreen from "../components/SplashScreen";

import { useAuth } from "../context/AuthContext";
import { navigationRef } from "./navigationRef";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { isAuthenticated, isBootstrapping, userRole } = useAuth();

  if (isBootstrapping) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="AuthFlow" component={AuthNavigator} />
        ) : (
          <>
            {/* Primary Role Destination (first screen in stack is default route) */}
            {userRole === "super_admin" ? (
              <>
                <Stack.Screen name="SuperAdminDashboard" component={SuperAdminDashboardScreen} />
                <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
                <Stack.Screen name="DoctorDashboard" component={DoctorDashboardScreen} />
                <Stack.Screen name="MainTabs" component={MainTabNavigator} />
              </>
            ) : userRole === "admin" ? (
              <>
                <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
                <Stack.Screen name="MainTabs" component={MainTabNavigator} />
                <Stack.Screen name="DoctorDashboard" component={DoctorDashboardScreen} />
              </>
            ) : userRole === "doctor" ? (
              <>
                <Stack.Screen name="DoctorDashboard" component={DoctorDashboardScreen} />
                <Stack.Screen name="MainTabs" component={MainTabNavigator} />
              </>
            ) : (
              <>
                <Stack.Screen name="MainTabs" component={MainTabNavigator} />
              </>
            )}

            {/* Standard App Screens */}
            <Stack.Screen name="SearchScreen" component={SearchScreen} />
            <Stack.Screen name="DepartmentList" component={DepartmentListScreen} />
            <Stack.Screen name="DepartmentDetail" component={DepartmentDetailScreen} />
            <Stack.Screen name="DoctorProfile" component={DoctorProfileScreen} />
            <Stack.Screen name="BookAppointment" component={BookAppointmentScreen} />
            <Stack.Screen name="AppointmentDetail" component={AppointmentDetailScreen} />
            <Stack.Screen name="ServiceDetail" component={ServiceDetailScreen} />
            <Stack.Screen name="HealthTipDetail" component={HealthTipDetailScreen} />
            <Stack.Screen name="VideoConsult" component={VideoConsultScreen} />
            <Stack.Screen name="VideoCallRoom" component={VideoCallRoomScreen} />
            <Stack.Screen name="CallScreen" component={CallScreen} />
            <Stack.Screen name="Notifications" component={NotificationScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="MedicalRecords" component={MedicalRecordsScreen} />
            <Stack.Screen name="Billing" component={BillingScreen} />
            <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
