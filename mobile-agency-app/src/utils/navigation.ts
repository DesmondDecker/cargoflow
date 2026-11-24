// Opens a container's case file in the Containers tab from a screen that
// lives in a different tab (Tracking, Finance). The typed navigators can't
// express a cross-tab jump, so this narrows to the one call it needs.
type TabNavigator = { navigate: (name: string, params?: object) => void };

export function openCaseFile(navigation: { getParent: () => unknown }, containerId: string, containerNumber?: string): void {
  (navigation.getParent() as TabNavigator | undefined)?.navigate('Containers', {
    screen: 'ContainerCaseFile',
    params: { containerId, containerNumber },
  });
}

// Opens any screen of the Containers tab (e.g. AddContainer) from another tab.
export function openContainersScreen(navigation: { getParent: () => unknown }, screen: string, params?: object): void {
  (navigation.getParent() as TabNavigator | undefined)?.navigate('Containers', { screen, params });
}

// Opens a screen in the More tab (for example the customs form) from a screen in another tab.
export function openMoreScreen(navigation: { getParent: () => unknown }, screen: string, params?: object): void {
  (navigation.getParent() as TabNavigator | undefined)?.navigate('More', { screen, params });
}

export function openTab(navigation: { getParent: () => unknown }, tab: 'Tracking' | 'Customs'): void {
  (navigation.getParent() as TabNavigator | undefined)?.navigate(tab);
}

export function openCustomsScreen(navigation: { getParent: () => unknown }, screen: string, params?: object): void {
  (navigation.getParent() as TabNavigator | undefined)?.navigate('Customs', { screen, params });
}
