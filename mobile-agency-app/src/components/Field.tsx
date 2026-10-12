import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme/theme';

interface FieldProps extends TextInputProps {
  label: string;
  error?: string;
}

// For any password-type field (secureTextEntry) this renders an eye icon
// that toggles the input between masked and plain text, so a user can check
// what they actually typed — mistyped agency passwords are a common source
// of "Something went wrong" on Join/Login and are otherwise invisible.
export function Field({ label, error, style, secureTextEntry, ...rest }: FieldProps) {
  const [revealed, setRevealed] = useState(false);
  const isPasswordField = !!secureTextEntry;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          placeholderTextColor={colors.textMuted}
          style={[
            styles.input,
            isPasswordField ? styles.inputWithIcon : undefined,
            error ? styles.inputError : undefined,
            style,
          ]}
          secureTextEntry={isPasswordField ? !revealed : secureTextEntry}
          {...rest}
        />
        {isPasswordField ? (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            style={styles.iconButton}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
          >
            <Ionicons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.lg },
  label: { ...typography.label, marginBottom: spacing.xs, textTransform: 'uppercase' },
  inputRow: { position: 'relative', justifyContent: 'center' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.white,
  },
  inputWithIcon: { paddingRight: spacing.xxl },
  inputError: { borderColor: colors.urgent },
  iconButton: { position: 'absolute', right: spacing.md },
  error: { ...typography.caption, color: colors.urgent, marginTop: spacing.xs },
});
