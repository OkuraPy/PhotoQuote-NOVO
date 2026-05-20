import React, { useEffect, useState } from 'react';
import { TextInput, StyleProp, TextStyle } from 'react-native';
import { colors } from '../../theme';

interface DecimalInputProps {
  value: number;
  onChangeValue: (n: number) => void;
  style?: StyleProp<TextStyle>;
  placeholder?: string;
}

function formatNum(n: number): string {
  return !n ? '' : String(n);
}

/**
 * Numeric TextInput that keeps its own text buffer, so the user can type
 * intermediate values like "6." or "6.50" without them being stripped by an
 * eager parseFloat/String round-trip (the bug in the old line-item editors).
 * Resyncs when `value` changes from the outside (e.g. AI replaces the items).
 */
export default function DecimalInput({ value, onChangeValue, style, placeholder }: DecimalInputProps) {
  const [text, setText] = useState(() => formatNum(value));

  useEffect(() => {
    const parsed = parseFloat(text);
    const current = isNaN(parsed) ? 0 : parsed;
    if (current !== value) {
      setText(formatNum(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <TextInput
      style={style}
      value={text}
      keyboardType="numeric"
      placeholder={placeholder}
      placeholderTextColor={colors.textTertiary}
      onChangeText={(t) => {
        // Keep only digits and a single decimal point.
        const clean = t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
        setText(clean);
        const n = parseFloat(clean);
        onChangeValue(isNaN(n) ? 0 : n);
      }}
    />
  );
}
