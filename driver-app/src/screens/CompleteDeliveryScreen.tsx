import React, { useRef, useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import SignatureScreen, { SignatureViewRef } from 'react-native-signature-canvas';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { performAction } from '../offline/actions';
import { apiErrorMessage } from '../api/client';
import { MainStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme/theme';

type Props = NativeStackScreenProps<MainStackParamList, 'CompleteDelivery'>;

export function CompleteDeliveryScreen({ route, navigation }: Props) {
  const { jobId } = route.params;
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [scrollLocked, setScrollLocked] = useState(false);
  const sigRef = useRef<SignatureViewRef>(null);

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera needed', 'Allow camera access in Settings to photograph the delivered container.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  const getGps = async (): Promise<{ lat: number; lng: number } | null> => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return null;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch {
      return null;
    }
  };

  const submit = async () => {
    if (!photoUri) return;
    setBusy(true);
    setError(null);
    try {
      setStep('Getting location…');
      const gps = await getGps();
      setStep('Sending…');
      const { queued } = await performAction({
        kind: 'complete',
        jobId,
        photoUri,
        signatureDataUrl: signature ?? undefined,
        gps,
        notes: notes.trim() || undefined,
      });
      if (queued) {
        Alert.alert('Saved on this phone', 'You are offline. The delivery, photo and signature will be sent automatically when you are back online. Keep the app installed until then.');
      }
      navigation.popToTop();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
      setStep('');
    }
  };

  return (
    <Screen scrollEnabled={!scrollLocked}>
      <View style={styles.stack}>
        <Text style={typography.h1}>Complete delivery</Text>
        <Text style={typography.caption}>A photo of the delivered container is required. The receiver's signature and your location are recorded as proof.</Text>

        <Card style={styles.stack}>
          <Text style={typography.h3}>1. Delivery photo</Text>
          {photoUri ? <Image source={{ uri: photoUri }} style={styles.photo} /> : null}
          <Button title={photoUri ? 'Retake photo' : 'Take photo'} variant={photoUri ? 'outline' : 'primary'} onPress={takePhoto} disabled={busy} />
        </Card>

        <Card style={styles.stack}>
          <Text style={typography.h3}>2. Receiver signature (optional)</Text>
          {signature ? (
            <>
              <Image source={{ uri: signature }} style={styles.signaturePreview} resizeMode="contain" />
              <Button title="Clear signature" variant="outline" onPress={() => setSignature(null)} disabled={busy} />
            </>
          ) : (
            <View style={styles.pad}>
              <SignatureScreen
                ref={sigRef}
                onOK={(sig: string) => setSignature(sig)}
                onBegin={() => setScrollLocked(true)}
                onEnd={() => setScrollLocked(false)}
                descriptionText="Sign above"
                clearText="Clear"
                confirmText="Save signature"
                webStyle={`.m-signature-pad--footer {margin-top: 4px;} body,html {height: 100%;}`}
              />
            </View>
          )}
        </Card>

        <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline placeholder="Receiver's name, condition of container, anything the agency should know" style={styles.notes} />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {busy ? <Text style={typography.caption}>{step}</Text> : null}
        <Button title="Submit delivery" onPress={submit} loading={busy} disabled={!photoUri} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  photo: { width: '100%', height: 220, borderRadius: radius.md, backgroundColor: colors.border },
  pad: { height: 260, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden' },
  signaturePreview: { width: '100%', height: 140, backgroundColor: colors.white },
  notes: { minHeight: 80, textAlignVertical: 'top' },
  error: { color: colors.urgent },
});
