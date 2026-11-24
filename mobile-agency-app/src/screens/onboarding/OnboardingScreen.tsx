import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, NativeScrollEvent, NativeSyntheticEvent, ScrollView, ScrollViewInstance, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { colors, radius, spacing, typography } from '../../theme/theme';
import { ONBOARDING_SLIDES } from '../../data/onboardingSlides';
import { markOnboardingComplete } from '../../utils/onboardingStorage';

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const entrance = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const artworkSize = Math.min(184, Math.max(136, screenHeight * 0.23));
  const iconContainerSize = artworkSize * 0.7;

  useEffect(() => {
    const appear = Animated.timing(entrance, { toValue: 1, duration: 500, useNativeDriver: true });
    const drift = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ]),
    );
    appear.start();
    drift.start();
    return () => {
      appear.stop();
      drift.stop();
    };
  }, [entrance, float]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newIndex = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
    if (newIndex !== index) setIndex(newIndex);
  };

  const goNext = () => {
    if (index < ONBOARDING_SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: screenWidth * (index + 1), animated: true });
    } else {
      finish();
    }
  };

  const finish = async () => {
    try {
      await markOnboardingComplete();
      onDone();
    } catch (error) {
      console.error('Could not save onboarding status', error);
      Alert.alert('Could not save your progress', 'Please try again.');
    }
  };

  const isLast = index === ONBOARDING_SLIDES.length - 1;
  const entranceStyle = {
    opacity: entrance,
    transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
  };
  const floatStyle = { transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) }] };

  return (
    <Screen scroll={false} padded={false} safeAreaEdges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.page}>
        <View style={styles.header}>
          <Logo size="small" />
          <Text style={styles.stepCount}>{String(index + 1).padStart(2, '0')} / {String(ONBOARDING_SLIDES.length).padStart(2, '0')}</Text>
          <Text style={styles.skip} onPress={finish} accessibilityRole="button">Skip</Text>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((index + 1) / ONBOARDING_SLIDES.length) * 100}%` }]} />
        </View>

        <Animated.View style={[styles.guide, entranceStyle]}>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            onMomentumScrollEnd={onScroll}
          >
            {ONBOARDING_SLIDES.map((slide, slideIndex) => (
              <ScrollView
                key={slide.title}
                style={[styles.slide, { width: screenWidth }]}
                contentContainerStyle={styles.slideContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                <Animated.View style={[styles.artwork, { width: artworkSize, height: artworkSize }, floatStyle]}>
                  <View style={[styles.artHalo, { width: artworkSize, height: artworkSize, borderRadius: artworkSize / 2 }]} />
                  <View style={[styles.iconWrap, { width: iconContainerSize, height: iconContainerSize, borderRadius: iconContainerSize * 0.28 }]}>
                    <Text style={[styles.icon, { fontSize: iconContainerSize * 0.44 }]}>{slide.icon}</Text>
                  </View>
                  <View style={styles.artBadge}>
                    <Ionicons name="checkmark" size={16} color={colors.white} />
                  </View>
                </Animated.View>
                <Text style={styles.eyebrow}>YOUR CARGOFLOW GUIDE · {slideIndex + 1}</Text>
                <Text style={styles.title}>{slide.title}</Text>
                <Text style={styles.description}>{slide.description}</Text>
              </ScrollView>
            ))}
          </ScrollView>
        </Animated.View>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {ONBOARDING_SLIDES.map((slide, dotIndex) => (
              <View key={slide.title} style={[styles.dot, dotIndex === index && styles.dotActive]} />
            ))}
          </View>
          <Button title={isLast ? 'Get Started' : 'Continue'} onPress={goNext} />
          <Text style={styles.footerNote}>Your shipments, documents and operations — together.</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  stepCount: { ...typography.label, color: colors.orangeDark, marginLeft: 'auto', marginRight: spacing.lg },
  skip: { ...typography.bodyMedium, color: colors.textSecondary, paddingVertical: spacing.sm },
  progressTrack: { height: 3, backgroundColor: colors.border, marginTop: spacing.md, marginHorizontal: spacing.lg, borderRadius: radius.pill, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.orange, borderRadius: radius.pill },
  guide: { flex: 1, justifyContent: 'center' },
  slide: { flex: 1 },
  slideContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  artwork: { width: 184, height: 184, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl },
  artHalo: { position: 'absolute', width: 184, height: 184, borderRadius: 92, backgroundColor: colors.orangeBg },
  iconWrap: { width: 128, height: 128, borderRadius: 36, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.orangeBorder },
  icon: {},
  artBadge: { position: 'absolute', right: 12, bottom: 14, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.normal, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.background },
  eyebrow: { ...typography.label, color: colors.orangeDark, textAlign: 'center', marginBottom: spacing.sm, letterSpacing: 0.8 },
  title: { ...typography.h1, textAlign: 'center', marginBottom: spacing.md },
  description: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 23, maxWidth: 330 },
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  dot: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.orange, width: 24 },
  footerNote: { ...typography.caption, textAlign: 'center', fontSize: 11, marginTop: spacing.md },
});
