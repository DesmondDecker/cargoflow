import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export interface Config {
  baseUrl: string; // e.g. https://api.example.com/api/v1
  apiKey: string;
  senders: string[];
}

const BASE = 'gw_base_url';
const SENDERS = 'gw_senders';
const KEY = 'gw_api_key'; // the API key is the gateway's credential, so it lives in secure storage

export async function loadConfig(): Promise<Config> {
  const [baseUrl, senders, apiKey] = await Promise.all([AsyncStorage.getItem(BASE), AsyncStorage.getItem(SENDERS), SecureStore.getItemAsync(KEY)]);
  return { baseUrl: baseUrl ?? '', senders: senders ? (JSON.parse(senders) as string[]) : [], apiKey: apiKey ?? '' };
}

export async function saveConfig(c: Config): Promise<void> {
  await AsyncStorage.setItem(BASE, c.baseUrl.trim().replace(/\/$/, ''));
  await AsyncStorage.setItem(SENDERS, JSON.stringify(c.senders.map((s) => s.trim()).filter(Boolean)));
  if (c.apiKey) await SecureStore.setItemAsync(KEY, c.apiKey.trim());
  else await SecureStore.deleteItemAsync(KEY);
}
