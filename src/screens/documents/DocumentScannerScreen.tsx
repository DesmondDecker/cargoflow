import React, { useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy'; // expo-file-system v19+'s new default API is object-oriented (File/Directory) and doesn't have readAsStringAsync/EncodingType — the legacy import keeps this simple one-off base64 read working as-is
import * as Print from 'expo-print';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { colors, radius, spacing, typography } from '../../theme/theme';
import { requestUploadUrl, uploadFileToPresignedUrl, registerDocument } from '../../api/documentApi';
import { apiErrorMessage } from '../../api/client';
import { ContainersStackParamList, DashboardStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ContainersStackParamList | DashboardStackParamList, 'DocumentScanner'>;

/**
 * Multi-page document capture: take a photo per page with the camera,
 * reorder/remove pages, then assemble everything into a single PDF and
 * upload that — much closer to "scan a 5-page B/L" than a single gallery
 * photo. What this does NOT do (would need a native document-scanner SDK
 * beyond Expo's managed workflow, or a paid third-party library):
 * automatic edge detection, perspective correction, or auto-cropping.
 * Pages are uploaded exactly as the camera captured them.
 */
export function DocumentScannerScreen({ route, navigation }: Props) {
  const { containerId, importerId, blId, documentType } = route.params;
  const [pages, setPages] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);

  const capturePage = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'CargoFlow needs camera access to scan a document.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false });
    if (!result.canceled && result.assets?.[0]) {
      setPages((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const removePage = (index: number) => {
    setPages((prev) => prev.filter((_, i) => i !== index));
  };

  const finishAndUpload = async () => {
    if (pages.length === 0) {
      Alert.alert('No pages captured', 'Capture at least one page before finishing.');
      return;
    }
    setProcessing(true);
    try {
      // Build a simple HTML document with one full-bleed image per page,
      // then let expo-print render it to an actual multi-page PDF.
      const pageImages = await Promise.all(
        pages.map(async (uri) => {
          const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
          return `data:image/jpeg;base64,${base64}`;
        })
      );
      const html = `
        <html><head><style>
          @page { margin: 0; }
          body { margin: 0; }
          .page { page-break-after: always; width: 100%; }
          .page img { width: 100%; display: block; }
        </style></head><body>
          ${pageImages.map((src) => `<div class="page"><img src="${src}" /></div>`).join('')}
        </body></html>
      `;
      const { uri: pdfUri } = await Print.printToFileAsync({ html, base64: false });

      const fileName = `${documentType.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
      const { uploadUrl, fileKey } = await requestUploadUrl(fileName, 'application/pdf', containerId);
      await uploadFileToPresignedUrl(uploadUrl, pdfUri, 'application/pdf');
      await registerDocument({
        documentType,
        importerId,
        blId,
        containerId,
        fileKey,
        mimeType: 'application/pdf',
        pageCount: pages.length,
      });

      Alert.alert('Document Uploaded', `${documentType} saved (${pages.length} page${pages.length > 1 ? 's' : ''}).`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Upload failed', apiErrorMessage(err));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scan {documentType}</Text>
        <Text style={styles.headerSubtitle}>
          {pages.length === 0 ? 'Capture the first page' : `${pages.length} page${pages.length > 1 ? 's' : ''} captured`}
        </Text>
      </View>

      <FlatList
        data={pages}
        keyExtractor={(_, i) => String(i)}
        numColumns={3}
        contentContainerStyle={styles.grid}
        renderItem={({ item, index }) => (
          <View style={styles.thumbWrap}>
            <Image source={{ uri: item }} style={styles.thumb} />
            <Text style={styles.pageNumber}>Page {index + 1}</Text>
            <Pressable style={styles.removeButton} onPress={() => removePage(index)}>
              <Text style={styles.removeButtonText}>✕</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No pages yet — tap "Capture Page" below.</Text>}
      />

      <View style={styles.footer}>
        <Button title="📷 Capture Page" variant="outline" onPress={capturePage} style={styles.captureButton} />
        <Button
          title={processing ? 'Preparing PDF…' : `Finish & Upload (${pages.length})`}
          onPress={finishAndUpload}
          loading={processing}
          disabled={pages.length === 0}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  headerTitle: { ...typography.h2 },
  headerSubtitle: { ...typography.body, color: colors.textSecondary, marginTop: 2 },
  grid: { padding: spacing.lg, paddingTop: 0, flexGrow: 1 },
  thumbWrap: { width: '31%', marginRight: '3.5%', marginBottom: spacing.md },
  thumb: { width: '100%', aspectRatio: 0.75, borderRadius: radius.sm, backgroundColor: colors.border },
  pageNumber: { ...typography.caption, textAlign: 'center', marginTop: 4 },
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.urgent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xxl },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.white, gap: spacing.sm },
  captureButton: { marginBottom: spacing.xs },
});
