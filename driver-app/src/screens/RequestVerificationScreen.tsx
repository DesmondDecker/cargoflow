import React, { useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { requestVerification, uploadFile } from '../api/driverApi';
import { apiErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { MainStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme/theme';

export function RequestVerificationScreen({ navigation }: NativeStackScreenProps<MainStackParamList, 'RequestVerification'>) {
  const { driver, setDriver } = useAuth();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [location, setLocation] = useState(driver?.location ?? '');
  const [years, setYears] = useState(driver?.yearsExperience !== undefined ? String(driver.yearsExperience) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (camera: boolean) => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow access in Settings to add a photo of your driving licence.');
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7 };
    const result = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  const submit = async () => {
    if (!photoUri) return;
    setBusy(true);
    setError(null);
    try {
      const licenseDocumentUrl = await uploadFile('license_document', photoUri, 'image/jpeg');
      const yearsNum = years.trim() === '' ? undefined : Number(years);
      const updated = await requestVerification({
        licenseDocumentUrl,
        location: location.trim() || undefined,
        yearsExperience: yearsNum !== undefined && Number.isFinite(yearsNum) ? Math.round(yearsNum) : undefined,
      });
      setDriver(updated);
      navigation.goBack();
    } catch (err) {
      setError(apiErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.stack}>
        <Text style={typography.h1}>Request verification</Text>
        <Text style={typography.caption}>Send a clear photo of your driving licence. A CargoFlow admin reviews it, and once you are verified agencies can assign jobs to you. You need at least one vehicle added first.</Text>
        {photoUri ? <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" /> : null}
        <View style={styles.row}>
          <Button title="Take photo" variant="outline" onPress={() => pick(true)} disabled={busy} style={styles.half} />
          <Button title="Choose photo" variant="outline" onPress={() => pick(false)} disabled={busy} style={styles.half} />
        </View>
        <Field label="Where you are based (optional)" value={location} onChangeText={setLocation} />
        <Field label="Years driving containers (optional)" value={years} onChangeText={setYears} keyboardType="number-pad" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Submit for review" onPress={submit} loading={busy} disabled={!photoUri} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  photo: { width: '100%', height: 200, borderRadius: radius.md, backgroundColor: colors.border },
  error: { color: colors.urgent },
});
