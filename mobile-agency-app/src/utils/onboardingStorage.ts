import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'cargoflow_onboarding_complete';

export async function hasCompletedOnboarding(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY)) === 'true';
}

export async function markOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(KEY, 'true');
}
