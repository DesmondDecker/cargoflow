import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { flushQueue } from './queue';

// Replays the queue whenever the phone regains a connection or the app comes
// back to the foreground. Returns a function that stops listening.
export function startSync(onFlushed?: () => void): () => void {
  const run = async () => {
    const { synced, failed } = await flushQueue();
    if ((synced > 0 || failed > 0) && onFlushed) onFlushed();
  };

  const unsubNet = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) run();
  });
  const appSub = AppState.addEventListener('change', (s) => {
    if (s === 'active') run();
  });
  run();

  return () => {
    unsubNet();
    appSub.remove();
  };
}
