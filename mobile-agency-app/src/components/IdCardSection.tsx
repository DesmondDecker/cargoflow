import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Card } from './Card';
import { Button } from './Button';
import { getIdCardLink, IdSide, removeIdCard, uploadIdCard } from '../api/reportsApi';
import { apiErrorMessage } from '../api/client';
import { Importer } from '../types/api';
import { colors, radius, spacing, typography } from '../theme/theme';

interface Props {
  importerId: string;
  hasFront: boolean;
  hasBack: boolean;
  // Only owners and admins can look at or remove an ID photo; anyone can add one.
  canView: boolean;
  onChanged: (importer: Importer) => void;
}

const SIDE_LABEL: Record<IdSide, string> = { front: 'Front', back: 'Back' };

export function IdCardSection({ importerId, hasFront, hasBack, canView, onChanged }: Props) {
  const [busy, setBusy] = useState<IdSide | null>(null);
  const [viewing, setViewing] = useState<{ side: IdSide; url: string } | null>(null);

  const pick = async (side: IdSide, camera: boolean) => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow access in your phone settings to add the photo.');
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7 };
    const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const type = asset.mimeType === 'image/png' || asset.mimeType === 'image/webp' ? asset.mimeType : 'image/jpeg';

    setBusy(side);
    try {
      onChanged(await uploadIdCard(importerId, side, asset.uri, type));
    } catch (err) {
      Alert.alert('Could not add the photo', apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const choose = (side: IdSide) =>
    Alert.alert(`${SIDE_LABEL[side]} of ID card`, 'Add a photo', [
      { text: 'Take photo', onPress: () => pick(side, true) },
      { text: 'Choose from library', onPress: () => pick(side, false) },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const view = async (side: IdSide) => {
    setBusy(side);
    try {
      const { url } = await getIdCardLink(importerId, side);
      setViewing({ side, url });
    } catch (err) {
      Alert.alert('Could not open the photo', apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const remove = (side: IdSide) =>
    Alert.alert('Remove this photo?', 'It is deleted from storage and cannot be recovered.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setBusy(side);
          try {
            await removeIdCard(importerId, side);
            onChanged({ _id: importerId, name: '', isActive: true, ...{ hasIdCardFront: side === 'front' ? false : hasFront, hasIdCardBack: side === 'back' ? false : hasBack } });
          } catch (err) {
            Alert.alert('Could not remove the photo', apiErrorMessage(err));
          } finally {
            setBusy(null);
          }
        },
      },
    ]);

  const sides: { side: IdSide; has: boolean }[] = [
    { side: 'front', has: hasFront },
    { side: 'back', has: hasBack },
  ];

  return (
    <Card style={styles.stack}>
      <Text style={typography.h3}>ID card photos</Text>
      <Text style={typography.caption}>
        Personal identity documents. They are stored privately and never get a public link. Anyone on the team can add a photo; only owners and admins can view or remove one.
      </Text>
      {sides.map(({ side, has }) => (
        <View key={side} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={typography.bodyMedium}>{SIDE_LABEL[side]}</Text>
            <Text style={has ? styles.on : typography.caption}>{has ? 'On file' : 'Not added'}</Text>
          </View>
          {busy === side ? <ActivityIndicator color={colors.orange} /> : null}
          <Button title={has ? 'Replace' : 'Add'} variant="outline" onPress={() => choose(side)} disabled={busy !== null} style={styles.small} />
          {has && canView ? <Button title="View" variant="outline" onPress={() => view(side)} disabled={busy !== null} style={styles.small} /> : null}
          {has && canView ? <Button title="Remove" variant="outline" onPress={() => remove(side)} disabled={busy !== null} style={styles.small} /> : null}
        </View>
      ))}

      <Modal visible={viewing !== null} animationType="fade" onRequestClose={() => setViewing(null)}>
        <StatusBar style="light" />
        <SafeAreaView style={styles.viewer}>
          <Text style={styles.viewerTitle}>{viewing ? `ID card, ${SIDE_LABEL[viewing.side].toLowerCase()}` : ''}</Text>
          {viewing ? <Image source={{ uri: viewing.url }} style={styles.image} resizeMode="contain" /> : null}
          <Text style={styles.viewerNote}>This link stops working after five minutes.</Text>
          <Button title="Close" onPress={() => setViewing(null)} style={{ margin: spacing.lg }} />
        </SafeAreaView>
      </Modal>
    </Card>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  on: { color: colors.normal, fontWeight: '700', fontSize: 13 },
  small: { paddingVertical: 6, paddingHorizontal: spacing.md },
  viewer: { flex: 1, backgroundColor: '#000' },
  viewerTitle: { color: '#fff', textAlign: 'center', padding: spacing.md, fontWeight: '700' },
  image: { flex: 1, borderRadius: radius.md },
  viewerNote: { color: '#bbb', textAlign: 'center', padding: spacing.sm, fontSize: 12 },
});
