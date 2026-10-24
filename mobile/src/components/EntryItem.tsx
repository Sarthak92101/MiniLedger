import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Loan } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { absoluteUrl } from '../config';
import { colors, radius, shadow, spacing, typography } from '../theme';
import { formatDate, formatMoney } from '../utils/format';

interface Props {
  loan: Loan;
  onMarkRepaid: (loan: Loan) => void;
  onUndoRepay?: (loan: Loan) => void;
  onOpenReceipt?: (loan: Loan) => void;
  busy?: boolean;
}

/**
 * A single ledger entry.
 *
 * Overdue entries are highlighted with a red accent rail, a red amount and an
 * explicit "N days overdue" badge so they are impossible to miss.
 */
export function EntryItem({ loan, onMarkRepaid, onUndoRepay, onOpenReceipt, busy }: Props) {
  const { token } = useAuth();
  const isRepaid = loan.status === 'repaid';
  const receipt = absoluteUrl(loan.receiptUrl);

  return (
    <View
      style={[styles.card, loan.isOverdue && styles.cardOverdue, isRepaid && styles.cardRepaid]}
      testID={loan.isOverdue ? 'entry-overdue' : 'entry'}
    >
      <View style={[styles.rail, loan.isOverdue && styles.railOverdue]} />

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <View style={styles.titleBlock}>
            <Text style={[styles.name, isRepaid && styles.nameRepaid]} numberOfLines={1}>
              {loan.friendName}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {isRepaid
                ? `Repaid${loan.repaidAt ? ` on ${formatDate(loan.repaidAt.slice(0, 10))}` : ''}`
                : `Due ${formatDate(loan.dueDate)}`}
            </Text>
          </View>

          <Text style={[styles.amount, loan.isOverdue && styles.amountOverdue]}>
            {formatMoney(loan.amount, 'INR')}
          </Text>
        </View>

        {loan.note ? (
          <Text style={styles.note} numberOfLines={2}>
            {loan.note}
          </Text>
        ) : null}

        <View style={styles.badgeRow}>
          {loan.isOverdue ? (
            <View style={styles.badgeOverdue} testID="overdue-badge">
              <Text style={styles.badgeOverdueText}>
                {loan.daysOverdue} {loan.daysOverdue === 1 ? 'day' : 'days'} overdue
              </Text>
            </View>
          ) : null}

          {!loan.isOverdue && !isRepaid ? (
            <View style={styles.badgeNeutral}>
              <Text style={styles.badgeNeutralText}>
                {loan.daysUntilDue === 0
                  ? 'Due today'
                  : `Due in ${loan.daysUntilDue} ${loan.daysUntilDue === 1 ? 'day' : 'days'}`}
              </Text>
            </View>
          ) : null}

          {isRepaid ? (
            <View style={styles.badgeSuccess}>
              <Text style={styles.badgeSuccessText}>Repaid</Text>
            </View>
          ) : null}

          {receipt ? (
            <Pressable
              onPress={() => onOpenReceipt?.(loan)}
              style={styles.receiptChip}
              accessibilityRole="button"
              accessibilityLabel="View receipt"
            >
              <Image
                source={{
                  uri: receipt,
                  headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                }}
                style={styles.receiptThumb}
              />
              <Text style={styles.receiptText}>Receipt</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.actions}>
          {isRepaid ? (
            <Pressable
              onPress={() => onUndoRepay?.(loan)}
              disabled={busy}
              style={styles.actionSecondary}
              accessibilityRole="button"
              testID="undo-repay-button"
            >
              <Text style={styles.actionSecondaryText}>Mark as pending</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => onMarkRepaid(loan)}
              disabled={busy}
              style={styles.actionPrimary}
              accessibilityRole="button"
              testID="mark-repaid-button"
            >
              <Text style={styles.actionPrimaryText}>Mark as repaid</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...shadow.card,
  },
  cardOverdue: {
    backgroundColor: colors.overdueSoft,
  },
  cardRepaid: {
    opacity: 0.72,
  },
  rail: {
    width: 4,
    backgroundColor: 'transparent',
  },
  railOverdue: {
    backgroundColor: colors.overdue,
  },
  body: {
    flex: 1,
    padding: spacing.md,
    paddingLeft: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  titleBlock: {
    flex: 1,
    marginRight: spacing.md,
  },
  name: {
    ...typography.h3,
    color: colors.text,
  },
  nameRepaid: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  amount: {
    ...typography.h3,
    color: colors.text,
  },
  amountOverdue: {
    color: colors.overdue,
  },
  note: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  badgeOverdue: {
    backgroundColor: colors.overdue,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  badgeOverdueText: {
    ...typography.caption,
    color: colors.textInverse,
  },
  badgeNeutral: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  badgeNeutralText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  badgeSuccess: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  badgeSuccessText: {
    ...typography.caption,
    color: colors.success,
  },
  receiptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    gap: spacing.xs + 2,
  },
  receiptThumb: {
    width: 16,
    height: 16,
    borderRadius: 4,
    backgroundColor: colors.surfaceAlt,
  },
  receiptText: {
    ...typography.caption,
    color: colors.primary,
  },
  actions: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  actionPrimary: {
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionPrimaryText: {
    ...typography.caption,
    color: colors.textInverse,
  },
  actionSecondary: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionSecondaryText: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
