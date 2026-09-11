import React from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { colors } from '../theme';

import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import VotersScreen from '../screens/VotersScreen';
import VoterDetailScreen from '../screens/VoterDetailScreen';
import HouseholdsScreen from '../screens/HouseholdsScreen';
import HouseholdDetailScreen from '../screens/HouseholdDetailScreen';
import HouseholdFormScreen from '../screens/HouseholdFormScreen';
import SurveyWizardScreen from '../screens/SurveyWizardScreen';
import TurnoutScreen from '../screens/TurnoutScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import MoreScreen from '../screens/MoreScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const header = {
  headerStyle: { backgroundColor: colors.primary },
  headerTintColor: colors.white,
  headerTitleStyle: { fontWeight: '700' },
  headerTitleAlign: 'left',
  headerShadowVisible: false,
};

const TAB_ICONS = { Home: 'home', Voters: 'user', Families: 'users', PollDay: 'check-square', More: 'menu' };

// Logo + two-tone "Neta360" wordmark, matching the brand logo's colours.
function BrandTitle() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Image source={require('../../assets/logo.png')} style={{ width: 28, height: 28, marginRight: 8 }} resizeMode="contain" />
      <Text style={{ fontSize: 20, fontWeight: '800', lineHeight: 28 }}>
        <Text style={{ color: '#3FA85E' }}>Neta</Text>
        <Text style={{ color: '#FD7118' }}>360</Text>
      </Text>
    </View>
  );
}

function Tabs() {
  const { pending } = useSync();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...header,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarIcon: ({ color, size }) => <Feather name={TAB_ICONS[route.name]} size={size} color={color} />,
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} options={{ headerTitle: () => <BrandTitle />, tabBarLabel: 'Home' }} />
      <Tab.Screen name="Voters" component={VotersScreen} />
      <Tab.Screen name="Families" component={HouseholdsScreen} />
      <Tab.Screen name="PollDay" component={TurnoutScreen} options={{ title: 'Poll day', tabBarLabel: 'Poll day' }} />
      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{ tabBarBadge: pending ? pending : undefined }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }}>
        <Image
          source={require('../../assets/splash-brand.png')}
          style={{ width: 220, height: 220 * (300 / 1137), marginBottom: 24 }}
          resizeMode="contain"
        />
        <ActivityIndicator color={colors.white} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={header}>
        {!session ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
            <Stack.Screen name="VoterDetail" component={VoterDetailScreen} options={{ title: 'Voter' }} />
            <Stack.Screen name="HouseholdDetail" component={HouseholdDetailScreen} options={{ title: 'Family' }} />
            <Stack.Screen name="HouseholdForm" component={HouseholdFormScreen} options={{ title: 'Family' }} />
            <Stack.Screen name="SurveyWizard" component={SurveyWizardScreen} options={{ title: 'Survey' }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Messages' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
