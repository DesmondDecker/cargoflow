import React, { useRef, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Button } from './Button';
import { colors, spacing, typography } from '../theme/theme';

interface Props {
  visible: boolean;
  url: string;
  title: string;
  carrierName: string;
  captureMode: 'auto' | 'review';
  prefillsNumber: boolean;
  onChangeCarrier: () => void;
  captureError?: string | null;
  capturing?: boolean;
  onClose: () => void;
  // Receives the text of the page as currently displayed. The caller sends it
  // to the backend, which parses it and saves it on the container.
  onCapture: (pageText: string) => void;
}

const READ_PAGE_JS = `
  (function () {
    var text = document.body ? document.body.innerText : '';
    window.ReactNativeWebView.postMessage(JSON.stringify({ text: text }));
  })();
  true;
`;

// Keeps only the tracking result: from "BL number <9 chars>" if present,
// otherwise from the first container number, capped so a long page can't
// exceed the backend's size limit.
export function extractTrackingResult(pageText: string): string {
  const bl = pageText.search(/BL number\s*[A-Z0-9]{9}/i);
  const container = pageText.search(/(^|\n)[A-Z]{4}\d{7}(?!\d)/);
  const start = bl >= 0 ? bl : container >= 0 ? container : 0;
  return pageText.slice(start, start + 15000);
}

export function CarrierTrackingModal({ visible, url, title, carrierName, captureMode, prefillsNumber, onChangeCarrier, captureError, capturing, onClose, onCapture }: Props) {
  const webRef = useRef<React.ElementRef<typeof WebView>>(null);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const { text } = JSON.parse(event.nativeEvent.data) as { text?: string };
      if (!text || text.trim().length < 20) {
        setReadError('The page has no tracking result yet. Wait for the result to show on screen, then tap Capture.');
        return;
      }
      setReadError(null);
      onCapture(extractTrackingResult(text));
    } catch {
      setReadError('Could not read the page. Try again once the result is showing.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>{title} · {carrierName}</Text>
          <Button title="Change carrier" variant="outline" onPress={onChangeCarrier} style={styles.closeButton} />
          <Button title="Close" variant="outline" onPress={onClose} style={styles.closeButton} />
        </View>
        <View style={styles.webWrap}>
          <WebView
            ref={webRef}
            source={{ uri: url }}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onMessage={onMessage}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
          />
          {loading ? <ActivityIndicator style={styles.spinner} color={colors.orange} /> : null}
        </View>
        <View style={styles.footer}>
          <Text style={styles.hint}>
            {captureMode === 'auto'
              ? `When the tracking result is showing, tap Capture.${prefillsNumber ? " If the number isn't filled in, type it in the page's search box." : ''}`
              : `Type the container number into ${carrierName}'s page, and when the result is showing tap Capture. You will review what was read before it is saved.`}
          </Text>
          {readError || captureError ? <Text style={styles.error}>{readError || captureError}</Text> : null}
          <Button
            title="Capture tracking from this page"
            onPress={() => webRef.current?.injectJavaScript(READ_PAGE_JS)}
            loading={capturing}
            disabled={capturing}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, gap: spacing.md },
  title: { ...typography.bodyMedium, flex: 1 },
  closeButton: { paddingVertical: 6, paddingHorizontal: spacing.md },
  webWrap: { flex: 1 },
  spinner: { position: 'absolute', top: spacing.lg, alignSelf: 'center' },
  footer: { padding: spacing.md, gap: spacing.sm },
  hint: { ...typography.caption },
  error: { color: colors.urgent },
});
