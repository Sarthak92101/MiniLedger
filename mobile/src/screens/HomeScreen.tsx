import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { api, ApiRequestError } from '../api/client';
import { Loan, LoanFilter, Summary } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { absoluteUrl } from '../config';
import { EmptyState } from '../components/EmptyState';
import { EntryItem } from '../components/EntryItem';
import { FilterTabs } from '../components/FilterTabs';
import { SummaryCard } from '../components/SummaryCard';
import { colors, radius, spacing, typography } from '../theme';

interface Props {
  onAddEntry: () => void;
}

export function HomeScreen({ onAddEntry }: Props) {
  const { token, user, logout } = useAuth();

  const [loans, setLoans] = useState<Loan[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filter, setFilter] = useState<LoanFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyLoanId, setBusyLoanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewReceipt, setPreviewReceipt] = useState<Loan | null>(null);

  const load = useCallback(
    async (showSpinner = true, signal?: AbortSignal) => {
      if (!token) return;
      if (showSpinner) setIsLoading(true);

      try {
        const [loansResponse, summaryResponse] = await Promise.all([
          api.listLoans(token, filter, signal),
          api.summary(token, signal),
        ]);
        setLoans(loansResponse.loans);
        setSummary(summaryResponse.summary);
        setError(null);
      } catch (err) {
        if (signal?.aborted) return;
        setError(
          err instanceof ApiRequestError ? err.message : 'Could not load your entries',
        );
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [token, filter],
  );

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      void load(true, controller.signal);
      return () => controller.abort();
    }, [load]),
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    void load(false);
  }, [load]);

  const handleMarkRepaid = useCallback(
    async (loan: Loan) => {
      if (!token) return;
      setBusyLoanId(loan.id);
      try {
        await api.markRepaid(token, loan.id);
        await load(false);
      } catch (err) {
        setError(err instanceof ApiRequestError ? err.message : 'Could not update the entry');
      } finally {
        setBusyLoanId(null);
      }
    },
    [token, load],
  );

  const handleUndoRepay = useCallback(
    async (loan: Loan) => {
      if (!token) return;
      setBusyLoanId(loan.id);
      try {
        await api.markUnrepaid(token, loan.id);
        await load(false);
      } catch (err) {
        setError(err instanceof ApiRequestError ? err.message : 'Could not update the entry');
      } finally {
        setBusyLoanId(null);
      }
    },
    [token, load],
  );

  const renderItem = useCallback(
    ({ item }: { item: Loan }) => (
      <EntryItem
        loan={item}
        busy={busyLoanId === item.id}
        onMarkRepaid={handleMarkRepaid}
        onUndoRepay={handleUndoRepay}
        onOpenReceipt={(loan) => setPreviewReceipt(loan)}
      />
    ),
    [busyLoanId, handleMarkRepaid, handleUndoRepay],
  );

  const overdueCount = summary?.counts.overdue ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>MiniLedger</Text>
          <Text style={styles.subtitle}>{user?.phone}</Text>
        </View>
        <Pressable
          onPress={logout}
          style={styles.logout}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Text style={styles.logoutText}>Sign out</Text>
        </Pressable>
      </View>

      <FlatList
        data={loans}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View>
            <SummaryCard summary={summary} isLoading={isLoading} />

            {error ? (
              <View style={styles.errorBox} testID="home-error">
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <FilterTabs value={filter} onChange={setFilter} overdueCount={overdueCount} />

            {isLoading && loans.length === 0 ? (
              <ActivityIndicator color={colors.primary} style={styles.loader} />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              title={filter === 'all' ? 'No entries yet' : `No ${filter} entries`}
              message={
                filter === 'all'
                  ? 'Add the first loan you have given to a friend and MiniLedger will keep track of it.'
                  : 'Try a different filter to see your other entries.'
              }
              actionLabel={filter === 'all' ? 'Add an entry' : undefined}
              onAction={filter === 'all' ? onAddEntry : undefined}
            />
          ) : null
        }
        ListFooterComponent={
          loans.length > 0 ? (
            <Text style={styles.footer}>
              {loans.length} {loans.length === 1 ? 'entry' : 'entries'} · pull down to refresh
            </Text>
          ) : null
        }
      />

      <View style={styles.fabWrapper} pointerEvents="box-none">
        <Text
          style={styles.fab}
          onPress={onAddEntry}
          accessibilityRole="button"
          accessibilityLabel="Add a new entry"
          testID="add-entry-fab"
        >
          +
        </Text>
      </View>

      <Modal
        visible={previewReceipt !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewReceipt(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPreviewReceipt(null)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>
              Receipt — {previewReceipt?.friendName}
            </Text>
            {previewReceipt?.receiptUrl ? (
              <Image
                source={{
                  uri: absoluteUrl(previewReceipt.receiptUrl) ?? undefined,
                  headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                }}
                style={styles.modalImage}
                resizeMode="contain"
                testID="receipt-preview-image"
              />
            ) : null}
            <Pressable
              onPress={() => setPreviewReceipt(null)}
              style={styles.modalClose}
              accessibilityRole="button"
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...typography.h2,
    color: colors.text,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  logout: {
    padding: spacing.sm,
  },
  logoutText: {
    ...typography.label,
    color: colors.primary,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 110,
  },
  loader: {
    marginVertical: spacing.xl,
  },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
  },
  footer: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  fabWrapper: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primary,
    color: colors.textInverse,
    fontSize: 32,
    lineHeight: 58,
    textAlign: 'center',
    overflow: 'hidden',
    shadowColor: '#0B1220',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 18, 32, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  modalImage: {
    width: '100%',
    height: 320,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  modalClose: {
    marginTop: spacing.lg,
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  modalCloseText: {
    ...typography.label,
    color: colors.primary,
  },
});
