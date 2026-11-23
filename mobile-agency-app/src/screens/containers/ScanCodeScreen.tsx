import React, { useRef, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { resolveCode } from '../../api/containerApi';
import { apiErrorMessage } from '../../api/client';
import { ContainersStackParamList } from '../../navigation/types';
import { colors, radius, spacing, typography } from '../../theme/theme';

type Props = NativeStackScreenProps<ContainersStackParamList, 'ScanCode'>;

// Container numbers are printed as barcodes or QR codes (sometimes inside a
// URL). If the scanned text contains a container number, that is what is
// looked up; otherwise the text itself is (a bill of lading number, say).
export function extractCode(raw: string): string {
  const text = raw.trim().toUpperCase();
  const container = text.replace(/[\s-]/g, '').match(/[A-Z]{4}\d{7}/);
  return container ? container[0] : text.slice(0, 40);
}

export function ScanCodeScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const handled = useRef(false);

  const again = () => {
    handled.current = false;
    setBusy(false);
  };

  const onScanned = async ({ data }: { data: string }) => {
    if (handled.current) return;
    handled.current = true;
    setBusy(true);
    const code = extractCode(data);
    try {
      const found = await resolveCode(code);
      if (found.type === 'container' && found.id) {
        navigation.replace('ContainerCaseFile', { containerId: found.id, containerNumber: found.containerNumber });
        return;
      }
      if (found.type === 'bill_of_lading') {
        Alert.alert('Bill of lading found', `${found.blNumber} is on file. Search for it on the Containers list to see its containers.`, [{ text: 'OK', onPress: () => navigation.goBack() }]);
        return;
      }
      if (found.type === 'external_tracking' && found.publicTrackingUrl) {
        Alert.alert('Not one of your containers', `${code} is not in this agency${found.carrierName ? `, but it looks like a ${found.carrierName} container` : ''}.`, [
          { text: 'Open carrier tracking', onPress: () => Linking.openURL(found.publicTrackingUrl!) },
          { text: 'Scan again', onPress: again },
        ]);
        return;
      }
      Alert.alert('No match', `${code} is not a container or bill of lading in this agency.`, [{ text: 'Scan again', onPress: again }, { text: 'Close', style: 'cancel', onPress: () => navigation.goBack() }]);
    } catch (err) {
      Alert.alert('Could not look that up', apiErrorMessage(err), [{ text: 'Scan again', onPress: again }]);
    }
  };

  if (!permission) return <View style={styles.center} />;
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={[typography.h2, { textAlign: 'center' }]}>Camera access needed</Text>
        <Text style={[typography.caption, { textAlign: 'center', marginVertical: spacing.md }]}>CargoFlow uses the camera to read container and bill of lading codes.</Text>
        <Button title="Allow camera" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <CameraView
        style={styles.fill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'code93', 'datamatrix', 'pdf417', 'itf14', 'ean13'] }}
        onBarcodeScanned={busy ? undefined : onScanned}
      />
      <View style={styles.frame} pointerEvents="none" />
      <View style={styles.hint}><Text style={styles.hintText}>{busy ? 'Looking it up…' : 'Point the camera at a container or bill of lading code'}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background },
  frame: { position: 'absolute', top: '30%', left: '12%', right: '12%', height: '22%', borderWidth: 3, borderColor: colors.orange, borderRadius: radius.md },
  hint: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' },
  hintText: { color: '#fff', backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 8, paddingHorizontal: 16, borderRadius: radius.pill, overflow: 'hidden' },
});
