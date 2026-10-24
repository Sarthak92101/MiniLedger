import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { api, ApiRequestError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { colors, radius, spacing, typography } from '../theme';
import {
  addDaysIso,
  formatDate,
  todayIso,
  validateAmount,
  validateDueDate,
  validateFriendName,
  validateNote,
} from '../utils/format';

interface Props {
  onDone: () => void;
  onCancel: () => void;
}

interface Errors {
  friendName?: string | null;
  amount?: string | null;
  dueDate?: string | null;
  note?: string | null;
  form?: string | null;
}

/**
 * Form for recording a new loan: friend, amount, due date and an optional
 * receipt photo.
 */
export function AddEntryScreen({ onDone, onCancel }: Props) {
  const { token } = useAuth();

  const [friendName, setFriendName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(addDaysIso(todayIso(), 14));
  const [note, setNote] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [receiptName, setReceiptName] = useState<string | null>(null);
  const [receiptMimeType, setReceiptMimeType] = useState<string | null>(null);

  const [errors, setErrors] = useState<Errors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const setError = (key: keyof Errors, message: string | null) =>
    setErrors((prev) => ({ ...prev, [key]: message }));

  const validate = (): boolean => {
    const next: Errors = {
      friendName: validateFriendName(friendName),
      amount: validateAmount(amount),
      dueDate: validateDueDate(dueDate),
      note: validateNote(note),
    };
    setErrors(next);
    return !next.friendName && !next.amount && !next.dueDate && !next.note;
  };

  const handlePickImage = async (fromCamera: boolean) => {
    try {
      const permission = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permission needed',
          fromCamera
            ? 'Camera access is required to photograph a receipt.'
            : 'Photo library access is required to attach a receipt.',
        );
        return;
      }

      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.7,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.7,
          });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      setReceiptUri(asset.uri);
      setReceiptName(asset.fileName ?? asset.uri.split('/').pop() ?? 'receipt.jpg');
      setReceiptMimeType(asset.mimeType === 'image/heif' ? 'image/heic' : asset.mimeType ?? null);
    } catch {
      setError('form', 'Could not open the image picker.');
    }
  };

  const handleSubmit = async () => {
    if (!token) return;
    if (!validate()) return;

    setIsSubmitting(true);
    setError('form', null);

    try {
      let receiptUrl: string | null = null;

      if (receiptUri) {
        const sourceName = (receiptName ?? receiptUri).split('?')[0].toLowerCase();
        const inferredType = receiptMimeType ?? (sourceName.endsWith('.png')
          ? 'image/png'
          : sourceName.endsWith('.webp')
            ? 'image/webp'
            : sourceName.endsWith('.heic') || sourceName.endsWith('.heif')
              ? 'image/heic'
              : 'image/jpeg');
        const upload = await api.uploadReceipt(token, {
          uri: receiptUri,
          name: receiptName ?? 'receipt.jpg',
          type: inferredType,
        });
        receiptUrl = upload.receiptUrl;
      }

      await api.createLoan(token, {
        friendName: friendName.trim(),
        // Preserve decimal text so the API can convert it to integer paise
        // without a floating-point round trip.
        amount: amount.trim(),
        dueDate: dueDate.trim(),
        note: note.trim() || null,
        receiptUrl,
      });

      onDone();
    } catch (err) {
      setError(
        'form',
        err instanceof ApiRequestError ? err.message : 'Could not save the entry',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (event.type === 'dismissed' || !date) return;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    setDueDate(`${year}-${month}-${day}`);
    setError('dueDate', null);
  };

  const presets = [
    { label: 'Today', value: todayIso() },
    { label: '1 week', value: addDaysIso(todayIso(), 7) },
    { label: '1 month', value: addDaysIso(todayIso(), 30) },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <TextField
            label="Friend name"
            value={friendName}
            onChangeText={(text) => {
              setFriendName(text);
              setError('friendName', null);
            }}
            placeholder="Who did you lend money to?"
            autoCapitalize="words"
            maxLength={120}
            error={errors.friendName}
            testID="friend-name-input"
          />

          <TextField
            label="Amount"
            value={amount}
            onChangeText={(text) => {
              setAmount(text);
              setError('amount', null);
            }}
            placeholder="0.00"
            keyboardType="decimal-pad"
            error={errors.amount}
            hint="How much did you lend?"
            testID="amount-input"
          />

          <View style={styles.dueDateBlock}>
            <TextField
              label="Due date"
              value={dueDate}
              onChangeText={(text) => {
                setDueDate(text);
                setError('dueDate', null);
              }}
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              error={errors.dueDate}
              testID="due-date-input"
            />

            <View style={styles.presetRow}>
              {presets.map((preset) => (
                <Pressable
                  key={preset.label}
                  onPress={() => {
                    setDueDate(preset.value);
                    setError('dueDate', null);
                  }}
                  style={styles.preset}
                  accessibilityRole="button"
                >
                  <Text style={styles.presetText}>{preset.label}</Text>
                </Pressable>
              ))}
            </View>

            <Button
              label={`Pick a date${
                validateDueDate(dueDate) === null ? ` (${formatDate(dueDate)})` : ''
              }`}
              onPress={() => setShowDatePicker((prev) => !prev)}
              variant="secondary"
              style={styles.dateButton}
              testID="pick-date-button"
            />

            {showDatePicker ? (
              <DateTimePicker
                value={parseDueDate(dueDate)}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                minimumDate={new Date()}
                onChange={handleDateChange}
              />
            ) : null}
          </View>

          <TextField
            label="Note (optional)"
            value={note}
            onChangeText={(text) => {
              setNote(text);
              setError('note', null);
            }}
            placeholder="What was it for?"
            multiline
            maxLength={500}
            error={errors.note}
            testID="note-input"
          />

          <Text style={styles.sectionLabel}>Receipt (optional)</Text>

          {receiptUri ? (
            <View style={styles.previewBox}>
              <Image source={{ uri: receiptUri }} style={styles.preview} />
              <View style={styles.previewMeta}>
                <Text style={styles.previewName} numberOfLines={1}>
                  {receiptName ?? 'receipt.jpg'}
                </Text>
              <Pressable
                onPress={() => {
                  setReceiptUri(null);
                  setReceiptName(null);
                  setReceiptMimeType(null);
                }}
                accessibilityRole="button"
              >
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.receiptButtons}>
              <Button
                label="Choose photo"
                onPress={() => handlePickImage(false)}
                variant="secondary"
                style={styles.receiptButton}
                testID="choose-receipt-button"
              />
              <Button
                label="Take photo"
                onPress={() => handlePickImage(true)}
                variant="secondary"
                style={styles.receiptButton}
                testID="take-receipt-button"
              />
            </View>
          )}

          {errors.form ? (
            <View style={styles.errorBox} testID="add-entry-error">
              <Text style={styles.errorText}>{errors.form}</Text>
            </View>
          ) : null}

          <Button
            label="Save entry"
            onPress={handleSubmit}
            loading={isSubmitting}
            style={styles.submit}
            testID="save-entry-button"
          />
          <Button
            label="Cancel"
            onPress={onCancel}
            variant="ghost"
            style={styles.cancel}
            testID="cancel-button"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Parses `YYYY-MM-DD` into a local Date, falling back to today. */
function parseDueDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  dueDateBlock: {
    marginBottom: spacing.sm,
  },
  presetRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  preset: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  presetText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  dateButton: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing.sm + 2,
  },
  receiptButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  receiptButton: {
    flex: 1,
  },
  previewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  preview: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  previewMeta: {
    flex: 1,
  },
  previewName: {
    ...typography.caption,
    color: colors.text,
  },
  removeText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
  },
  submit: {
    marginTop: spacing.sm,
  },
  cancel: {
    marginTop: spacing.xs,
  },
});
