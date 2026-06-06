import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useAccountStore } from '@/store/account';
import { useColors } from '@/store/theme';

export default function LoginScreen() {
  const c = useColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const { blockReason, setBlockReason } = useAccountStore();

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const { token, user } = await api.login(email.trim(), password);
      setBlockReason(null); // Clear any prior block on successful login
      await setAuth(token, user);
    } catch (err: unknown) {
      let message = 'Login failed. Please try again.';
      if (err instanceof Error) {
        const msg = err.message;
        if (msg === 'SUBSCRIPTION_EXPIRED') {
          message = "Your company's subscription has expired. Please contact your administrator to renew access.";
        } else if (msg === 'ACCOUNT_FROZEN') {
          message = 'Your account has been suspended. Please contact your administrator.';
        } else if (msg === 'UNAUTHORIZED' || msg.startsWith('HTTP_401')) {
          message = 'Incorrect email or password.';
        } else if (msg === 'TIMEOUT') {
          message = 'Connection timed out. Please check your network and try again.';
        } else if (msg.startsWith('HTTP_5')) {
          message = 'Server error. Please try again later.';
        }
      }
      Alert.alert('Sign In Failed', message);
    } finally {
      setLoading(false);
    }
  }

  const blockMessage =
    blockReason === 'SUBSCRIPTION_EXPIRED'
      ? "Your company's subscription has expired. Please contact your administrator to renew access."
      : blockReason === 'ACCOUNT_FROZEN'
      ? 'Your account has been suspended. Please contact your administrator.'
      : null;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: c.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Account block banner */}
      {blockMessage && (
        <View
          style={[
            styles.blockBanner,
            {
              backgroundColor: blockReason === 'ACCOUNT_FROZEN' ? c.dangerBg : c.warningBg,
              borderColor: blockReason === 'ACCOUNT_FROZEN' ? c.danger : c.warning,
            },
          ]}
        >
          <Text
            style={[
              styles.blockIcon,
              { color: blockReason === 'ACCOUNT_FROZEN' ? c.danger : c.warning },
            ]}
          >
            {blockReason === 'ACCOUNT_FROZEN' ? '⛔' : '⚠️'}
          </Text>
          <View style={styles.blockTextWrap}>
            <Text
              style={[
                styles.blockTitle,
                { color: blockReason === 'ACCOUNT_FROZEN' ? c.danger : c.warning },
              ]}
            >
              {blockReason === 'ACCOUNT_FROZEN' ? 'Account Suspended' : 'Subscription Expired'}
            </Text>
            <Text
              style={[
                styles.blockBody,
                { color: blockReason === 'ACCOUNT_FROZEN' ? c.danger : c.warning },
              ]}
            >
              {blockMessage}
            </Text>
          </View>
        </View>
      )}

      <View style={[styles.card, { backgroundColor: c.surface }]}>
        <Text style={[styles.title, { color: c.text }]}>InspectHive</Text>
        <Text style={[styles.subtitle, { color: c.textSecondary }]}>Worker Login</Text>

        <TextInput
          style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
          placeholder="Email"
          placeholderTextColor={c.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          returnKeyType="next"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
          placeholder="Password"
          placeholderTextColor={c.textMuted}
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={handleLogin}
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          style={[styles.button, { backgroundColor: c.primary }, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  blockBanner: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  blockIcon: { fontSize: 20, marginTop: 1 },
  blockTextWrap: { flex: 1 },
  blockTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  blockBody: { fontSize: 13, lineHeight: 18 },
  card: {
    borderRadius: 16,
    padding: 28,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
