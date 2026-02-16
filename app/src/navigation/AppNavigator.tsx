import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { LoadingScreen } from '../components/LoadingScreen';

// Screens
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import DashboardScreen from '../screens/DashboardScreen';
import NewProjectScreen from '../screens/NewProjectScreen';
import PhotoUploadScreen from '../screens/PhotoUploadScreen';
import EstimatePreviewScreen from '../screens/EstimatePreviewScreen';
import ClientsScreen from '../screens/ClientsScreen';
import AddClientScreen from '../screens/AddClientScreen';
import EstimatesListScreen from '../screens/EstimatesListScreen';
import EstimateDetailScreen from '../screens/EstimateDetailScreen';
import InvoicesListScreen from '../screens/InvoicesListScreen';
import InvoiceDetailScreen from '../screens/InvoiceDetailScreen';
import CompanyProfileScreen from '../screens/CompanyProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1a73e8',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => <TabIcon emoji="🏠" color={color} />,
        }}
      />
      <Tab.Screen
        name="Estimates"
        component={EstimatesListScreen}
        options={{
          tabBarLabel: 'Estimates',
          tabBarIcon: ({ color }) => <TabIcon emoji="📋" color={color} />,
        }}
      />
      <Tab.Screen
        name="Invoices"
        component={InvoicesListScreen}
        options={{
          tabBarLabel: 'Invoices',
          tabBarIcon: ({ color }) => <TabIcon emoji="💰" color={color} />,
        }}
      />
      <Tab.Screen
        name="Clients"
        component={ClientsScreen}
        options={{
          tabBarLabel: 'Clients',
          tabBarIcon: ({ color }) => <TabIcon emoji="👥" color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

function TabIcon({ emoji }: { emoji: string; color: string }) {
  return <Text style={{ fontSize: 24 }}>{emoji}</Text>;
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        {!user ? (
          // Auth Stack - Not authenticated
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
          </>
        ) : (
          // Main Stack - Authenticated
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="NewProject" component={NewProjectScreen} />
            <Stack.Screen name="AddClient" component={AddClientScreen} />
            <Stack.Screen name="PhotoUpload" component={PhotoUploadScreen} />
            <Stack.Screen name="EstimatePreview" component={EstimatePreviewScreen} />
            <Stack.Screen name="EstimateDetail" component={EstimateDetailScreen} />
            <Stack.Screen name="InvoiceDetail" component={InvoiceDetailScreen} />
            <Stack.Screen name="CompanyProfile" component={CompanyProfileScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
