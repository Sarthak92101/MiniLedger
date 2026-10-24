import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { AddEntryScreen } from './src/screens/AddEntryScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { colors, spacing, typography } from './src/theme';

export type RootStackParamList = {
  Home: undefined;
  AddEntry: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function AuthenticatedApp() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home">
        {({ navigation }) => (
          <HomeScreen
            onAddEntry={() => navigation.navigate('AddEntry')}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="AddEntry" options={{ presentation: 'modal' }}>
        {({ navigation }) => (
          <AddEntryScreen
            onDone={() => navigation.goBack()}
            onCancel={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function Root() {
  const { token, isRestoring } = useAuth();

  if (isRestoring) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      {token ? <AuthenticatedApp /> : <LoginScreen />}
    </NavigationContainer>
  );
}

function SplashScreen() {
  return (
    <View style={styles.splash}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>₹</Text>
      </View>
      <Text style={styles.logoTitle}>MiniLedger</Text>
      <ActivityIndicator color={colors.primary} style={styles.spinner} />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  logoText: {
    fontSize: 30,
    color: colors.textInverse,
    fontWeight: '700',
  },
  logoTitle: {
    ...typography.h2,
    color: colors.text,
  },
  spinner: {
    marginTop: spacing.xl,
  },
});
