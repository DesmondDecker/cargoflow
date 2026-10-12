import React, { useRef, useState } from 'react';
import { Dimensions, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { colors, spacing, typography } from '../../theme/theme';
import { ONBOARDING_SLIDES } from '../../data/onboardingSlides';
import { markOnboardingComplete } from '../../utils/onboardingStorage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (newIndex !== index) setIndex(newIndex);
  };

  const goNext = () => {
    if (index < ONBOARDING_SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: SCREEN_WIDTH * (index + 1), animated: true });
    } else {
      finish();
    }
  };

  const finish = async () => {
    await markOnboardingComplete();
    onDone();
  };

  const isLast = index === ONBOARDING_SLIDES.length - 1;

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.header}>
        <Logo size="small" />
        <Text style={styles.skip} onPress={finish}>
          Skip
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
      >
        {ONBOARDING_SLIDES.map((slide, i) => (
          <View key={i} style={[styles.slide, { width: SCREEN_WIDTH }]}>
            <View style={styles.iconWrap}>
              <Text style={styles.icon}>{slide.icon}</Text>
            </View>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.description}>{slide.description}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {ONBOARDING_SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <Button title={isLast ? 'Get Started' : 'Next'} onPress={goNext} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  skip: { ...typography.bodyMedium, color: colors.textSecondary },
  slide: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl, paddingTop: spacing.xl },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 30,
    backgroundColor: colors.attentionBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  icon: { fontSize: 56 },
  title: { ...typography.h1, textAlign: 'center', marginBottom: spacing.md },
  description: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: spacing.xl },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.orange, width: 24 },
});
