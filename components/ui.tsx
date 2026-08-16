import { ReactNode } from 'react';
import { StyleSheet, Text, TextStyle, TouchableOpacity, View, ViewStyle } from 'react-native';

export const colors = {
  ink: '#17322C',
  muted: '#70827A',
  paper: '#F8F7F2',
  white: '#FFFFFF',
  mint: '#DDEFE5',
  sage: '#96B6A1',
  line: '#E5E9E2',
  orange: '#E49358',
  softOrange: '#FBE9D9',
  red: '#C96A51',
};
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 22, paddingTop: 56, paddingBottom: 36 },
  eyebrow: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { color: colors.ink, fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  card: { backgroundColor: colors.white, borderRadius: 22, padding: 18 },
  button: {
    backgroundColor: colors.ink,
    borderRadius: 16,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '800' },
});

export function PrimaryButton({
  children,
  onPress,
  style,
}: {
  children: ReactNode;
  onPress: () => void;
  style?: ViewStyle;
}) {
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={[styles.button, style]}>
      <Text style={styles.buttonText}>{children}</Text>
    </TouchableOpacity>
  );
}
export function SectionLabel({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <Text style={[styles.eyebrow, { marginBottom: 10 }, style]}>{children}</Text>;
}
// Defines the shared color palette, styles, and reusable button and label components.
