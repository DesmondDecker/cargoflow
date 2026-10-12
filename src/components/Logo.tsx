import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/theme';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  showTagline?: boolean;
  showPoweredBy?: boolean;
  light?: boolean; // for dark backgrounds
}

const SIZES = {
  small: { mark: 32, markFont: 16, word: 16, tagline: 8 },
  medium: { mark: 56, markFont: 28, word: 26, tagline: 9 },
  large: { mark: 84, markFont: 42, word: 38, tagline: 11 },
};

/**
 * The icon mark is a rounded orange badge with a stylized "C" — an
 * approximation of the CargoFlow brand mark done in plain Views (no SVG
 * dependency needed), since a rounded badge with a bold letterform gets
 * close enough for an in-app lockup without adding a new native library.
 */
function IconMark({ dimension, fontSize }: { dimension: number; fontSize: number }) {
  return (
    <View
      style={[
        styles.mark,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension * 0.28,
        },
      ]}
    >
      <Text style={[styles.markLetter, { fontSize }]}>C</Text>
    </View>
  );
}

export function Logo({ size = 'medium', showTagline = false, showPoweredBy = false, light = false }: LogoProps) {
  const s = SIZES[size];
  return (
    <View style={styles.row}>
      <IconMark dimension={s.mark} fontSize={s.markFont} />
      <View style={styles.wordWrap}>
        <View style={styles.wordRow}>
          <Text style={[styles.wordCargo, { fontSize: s.word, color: light ? colors.white : colors.navy }]}>Cargo</Text>
          <Text style={[styles.wordFlow, { fontSize: s.word }]}>Flow</Text>
        </View>
        {showTagline ? (
          <Text style={[styles.tagline, { fontSize: s.tagline, color: light ? 'rgba(255,255,255,0.7)' : colors.textSecondary }]}>
            CONTAINERS · DOCUMENTS · DRIVERS · DELIVERY
          </Text>
        ) : null}
        {showPoweredBy ? (
          <Text style={[styles.poweredBy, { color: light ? 'rgba(255,255,255,0.55)' : colors.textMuted }]}>
            Powered by Summit Technologies
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  mark: {
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  markLetter: { color: colors.navy, fontWeight: '900' },
  wordWrap: { justifyContent: 'center' },
  wordRow: { flexDirection: 'row', alignItems: 'baseline' },
  wordCargo: { fontWeight: '800', letterSpacing: -0.5 },
  wordFlow: { fontWeight: '800', letterSpacing: -0.5, color: colors.orange },
  tagline: { fontWeight: '600', letterSpacing: 0.8, marginTop: 2 },
  poweredBy: { fontSize: 10, marginTop: 3, fontStyle: 'italic' },
});
