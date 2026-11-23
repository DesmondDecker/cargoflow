import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

// Device-local app preferences. Every value here is actually read somewhere:
//   defaultContainerFilter -> ContainersListScreen's starting filter
//   showCarrierBreakdown   -> DashboardScreen's "by shipping line" card
export type ContainerFilter = 'all' | 'urgent' | 'attention' | 'normal';

interface PrefsState {
  loaded: boolean;
  defaultContainerFilter: ContainerFilter;
  showCarrierBreakdown: boolean;
  load: () => Promise<void>;
  set: (patch: Partial<Pick<PrefsState, 'defaultContainerFilter' | 'showCarrierBreakdown'>>) => Promise<void>;
}

const KEY = 'cargoflow_app_prefs';

export const usePrefsStore = create<PrefsState>((set, get) => ({
  loaded: false,
  defaultContainerFilter: 'all',
  showCarrierBreakdown: true,
  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PrefsState>;
        set({
          defaultContainerFilter: parsed.defaultContainerFilter ?? 'all',
          showCarrierBreakdown: parsed.showCarrierBreakdown ?? true,
        });
      }
    } catch {
      // Unreadable stored prefs: keep the defaults.
    }
    set({ loaded: true });
  },
  set: async (patch) => {
    set(patch);
    const { defaultContainerFilter, showCarrierBreakdown } = get();
    await AsyncStorage.setItem(KEY, JSON.stringify({ defaultContainerFilter, showCarrierBreakdown }));
  },
}));
