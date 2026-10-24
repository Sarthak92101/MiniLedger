import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LoanFilter } from '../api/types';
import { colors, radius, spacing, typography } from '../theme';

const FILTERS: { key: LoanFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'repaid', label: 'Repaid' },
];

interface Props {
  value: LoanFilter;
  onChange: (filter: LoanFilter) => void;
  overdueCount?: number;
}

export function FilterTabs({ value, onChange, overdueCount = 0 }: Props) {
  return (
    <View style={styles.row}>
      {FILTERS.map((filter) => {
        const selected = filter.key === value;
        const label =
          filter.key === 'overdue' && overdueCount > 0
            ? `Overdue (${overdueCount})`
            : filter.label;

        return (
          <Pressable
            key={filter.key}
            onPress={() => onChange(filter.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            testID={`filter-${filter.key}`}
            style={[
              styles.tab,
              selected && styles.tabSelected,
              filter.key === 'overdue' && overdueCount > 0 && !selected && styles.tabOverdue,
            ]}
          >
            <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabOverdue: {
    borderColor: colors.overdue,
    backgroundColor: colors.overdueSoft,
  },
  tabText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  tabTextSelected: {
    color: colors.textInverse,
  },
});
