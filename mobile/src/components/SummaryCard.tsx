import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing, typography } from '../theme';
import { Summary } from '../api/types';
import { formatMoney } from '../utils/format';

interface Props {
  summary: Summary | null;
  isLoading?: boolean;
}

/**
 * The summary card pinned to the top of the home screen.
 *
 * Shows the headline number (still owed to you) plus the three supporting
 * figures. Overdue is highlighted in red because it needs action.
 */
export function SummaryCard({ summary, isLoading = false }: Props) {
  if (isLoading || !summary) {
    return (
      <View style={[styles.card, styles.placeholder]}>
        <Text style={styles.placeholderText}>Loading your summary…</Text>
      </View>
    );
  }

  const hasOverdue = summary.overdueAmount > 0;

  return (
    <View style={styles.card} testID="summary-card">
      <Text style={styles.eyebrow}>TOTAL OUTSTANDING</Text>
      <Text style={styles.headline} testID="summary-outstanding">
        {formatMoney(summary.totalOutstanding, summary.currency)}
      </Text>

      <View style={styles.divider} />

      <View style={styles.grid}>
        <Stat
          label="Total lent"
          value={formatMoney(summary.totalLent, summary.currency)}
          testID="summary-total-lent"
        />
        <Stat
          label="Repaid"
          value={formatMoney(summary.totalRepaid, summary.currency)}
          tone="success"
          testID="summary-repaid"
        />
        <Stat
          label="Overdue"
          value={formatMoney(summary.overdueAmount, summary.currency)}
          tone={hasOverdue ? 'danger' : 'muted'}
          testID="summary-overdue"
        />
        <Stat
          label="Entries"
          value={String(summary.counts.total)}
          tone="muted"
          testID="summary-count"
        />
      </View>

      {hasOverdue ? (
        <View style={styles.alert} testID="overdue-alert">
          <Text style={styles.alertText}>
            {summary.counts.overdue}{' '}
            {summary.counts.overdue === 1 ? 'entry is' : 'entries are'} overdue — worth{' '}
            {formatMoney(summary.overdueAmount, summary.currency)}.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Stat({
  label,
  value,
  tone = 'default',
  testID,
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'danger' | 'muted';
  testID?: string;
}) {
  const valueColor =
    tone === 'danger'
      ? colors.overdue
      : tone === 'success'
        ? colors.success
        : tone === 'muted'
          ? colors.textMuted
          : colors.text;

  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: valueColor }]} testID={testID}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  placeholder: {
    minHeight: 168,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    ...typography.body,
    color: colors.textMuted,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  headline: {
    ...typography.h1,
    color: colors.text,
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  stat: {
    width: '50%',
    marginBottom: spacing.md,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  statValue: {
    ...typography.h3,
    marginTop: 2,
  },
  alert: {
    backgroundColor: colors.overdueSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  alertText: {
    ...typography.caption,
    color: colors.overdue,
    lineHeight: 18,
  },
});
