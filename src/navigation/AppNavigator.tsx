import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, FileText, Receipt, Users } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { LoadingScreen } from '../components/LoadingScreen';
import { colors, typography } from '../theme';

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
import TeamScreen from '../screens/TeamScreen';
import ProjectMembersScreen from '../screens/ProjectMembersScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: typography.weights.medium,
        },
        tabBarStyle: {
          paddingTop: 4,
          backgroundColor: colors.bgPrimary,
          borderTopWidth: 0.5,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => <Home size={22} color={color} />,
        }}
      />
      <Tab.Screen
        name="Estimates"
        component={EstimatesListScreen}
        options={{
          tabBarLabel: 'Estimates',
          tabBarIcon: ({ color }) => <FileText size={22} color={color} />,
        }}
      />
      <Tab.Screen
        name="Invoices"
        component={InvoicesListScreen}
        options={{
          tabBarLabel: 'Invoices',
          tabBarIcon: ({ color }) => <Receipt size={22} color={color} />,
        }}
      />
      <Tab.Screen
        name="Clients"
        component={ClientsScreen}
        options={{
          tabBarLabel: 'Clients',
          tabBarIcon: ({ color }) => <Users size={22} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="NewProject" component={NewProjectScreen} />
            <Stack.Screen name="AddClient" component={AddClientScreen} />
            <Stack.Screen name="PhotoUpload" component={PhotoUploadScreen} />
            <Stack.Screen name="EstimatePreview" component={EstimatePreviewScreen} />
            <Stack.Screen name="EstimateDetail" component={EstimateDetailScreen} />
            <Stack.Screen name="InvoiceDetail" component={InvoiceDetailScreen} />
            <Stack.Screen name="CompanyProfile" component={CompanyProfileScreen} />
            <Stack.Screen name="Team" component={TeamScreen} />
            <Stack.Screen name="ProjectMembers" component={ProjectMembersScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
