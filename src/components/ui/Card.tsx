import React from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors, spacing, radii, shadows } from '../../theme';

type CardVariant = 'default' | 'elevated' | 'outlined';

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  noPadding?: boolean;
}

export default function Card({
  children,
  variant = 'default',
  onPress,
  style,
  noPadding = false,
}: CardProps) {
  const cardStyle = [
    styles.base,
    variant === 'elevated' && shadows.md,
    variant === 'outlined' && styles.outlined,
    variant === 'default' && shadows.sm,
    !noPadding && styles.padded,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={cardStyle}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.bgPrimary,
    borderRadius: radii.xl,
  },
  padded: {
    padding: spacing.lg,
  },
  outlined: {
    borderWidth: 1,
    borderColor: colors.border,
  },
});
