import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { useAuth } from '../auth/AuthContext';
import { colors, radius, spacing, typography } from '../theme';
import { validateOtp, validatePhone } from '../utils/format';

type Stage = 'phone' | 'otp';

/**
 * Two-step phone + OTP login.
 *
 * The OTP is not sent by SMS in this build — the backend prints it to the
 * server log, so the screen tells the developer exactly where to look.
 */
export function LoginScreen() {
  const { requestOtp, verifyOtp, isSubmitting, error, clearError } = useAuth();

  const [stage, setStage] = useState<Stage>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);

  const handleRequestOtp = async () => {
    const validationError = validatePhone(phone);
    setPhoneError(validationError);
    if (validationError) return;

    clearError();
    try {
      await requestOtp(phone.trim());
      setStage('otp');
    } catch {
      // The error is surfaced from context.
    }
  };

  const handleVerify = async () => {
    const validationError = validateOtp(otp);
    setOtpError(validationError);
    if (validationError) return;

    const ok = await verifyOtp(phone.trim(), otp.trim());
    if (ok) {
      setOtp('');
      setStage('phone');
    }
  };

  const handleBack = () => {
    setStage('phone');
    setOtp('');
    setOtpError(null);
    clearError();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>₹</Text>
            </View>
            <Text style={styles.title}>MiniLedger</Text>
            <Text style={styles.subtitle}>
              Keep track of the money you lend to friends.
            </Text>
          </View>

          {stage === 'phone' ? (
            <View>
              <TextField
                label="Phone number"
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  setPhoneError(null);
                }}
                placeholder="9876543210"
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                error={phoneError}
                testID="phone-input"
              />

              {error ? (
                <View style={styles.errorBox} testID="login-error">
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Button
                label="Send OTP"
                onPress={handleRequestOtp}
                loading={isSubmitting}
                testID="send-otp-button"
              />

              <View style={styles.hintBox}>
                <Text style={styles.hintTitle}>Mock OTP</Text>
                <Text style={styles.hintText}>
                  This build does not send SMS. The one-time code is printed to the
                  API server log — look for the line starting with{' '}
                  <Text style={styles.mono}>[mock-otp]</Text>.
                </Text>
              </View>
            </View>
          ) : (
            <View>
              <Text style={styles.otpHeading}>Enter the code</Text>
              <Text style={styles.otpSub}>
                We sent a 6-digit code to {phone.trim()}
              </Text>

              <TextField
                label="OTP"
                value={otp}
                onChangeText={(text) => {
                  setOtp(text.replace(/\D/g, '').slice(0, 8));
                  setOtpError(null);
                }}
                placeholder="123456"
                keyboardType="number-pad"
                maxLength={8}
                autoFocus
                error={otpError}
                testID="otp-input"
              />

              {error ? (
                <View style={styles.errorBox} testID="login-error">
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Button
                label="Verify and continue"
                onPress={handleVerify}
                loading={isSubmitting}
                testID="verify-otp-button"
              />

              <Button
                label="Use a different number"
                onPress={handleBack}
                variant="ghost"
                style={styles.backButton}
                testID="change-phone-button"
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
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
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  brand: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  logoText: {
    fontSize: 30,
    color: colors.textInverse,
    fontWeight: '700',
  },
  title: {
    ...typography.h1,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  otpHeading: {
    ...typography.h2,
    color: colors.text,
  },
  otpSub: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
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
  hintBox: {
    marginTop: spacing.xl,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  hintTitle: {
    ...typography.label,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  hintText: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
  mono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: colors.primary,
  },
  backButton: {
    marginTop: spacing.md,
  },
});
