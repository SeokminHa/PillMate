import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import Colors from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';

export default function AuthScreen() {
  const { login, register } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert(t('error'), t('allFieldsRequired'));
      return;
    }
    if (mode === 'register' && !displayName.trim()) {
      Alert.alert(t('error'), t('allFieldsRequired'));
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(username.trim(), password.trim());
      } else {
        await register(username.trim(), password.trim(), displayName.trim());
      }
    } catch (err: any) {
      Alert.alert(t('error'), mode === 'login' ? t('loginFailed') : t('registerFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset + 40 }]}>
      <View style={styles.header}>
        <Ionicons name="medical" size={48} color={Colors.primary} />
        <Text style={styles.title}>PillMate</Text>
        <Text style={styles.subtitle}>
          {language === 'ko' ? '약 복용을 쉽고 확실하게' : 'Simple & clear medication tracking'}
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('username')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('usernamePlaceholder')}
            placeholderTextColor="#999"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            testID="username-input"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('password')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('passwordPlaceholder')}
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            testID="password-input"
          />
        </View>

        {mode === 'register' && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('displayNameLabel')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('displayNamePlaceholder')}
              placeholderTextColor="#999"
              value={displayName}
              onChangeText={setDisplayName}
              testID="displayname-input"
            />
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          testID="auth-submit"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {mode === 'login' ? t('login') : t('register')}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchMode}
          onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          <Text style={styles.switchText}>
            {mode === 'login' ? t('noAccount') : t('hasAccount')}
          </Text>
          <Text style={styles.switchLink}>
            {mode === 'login' ? t('register') : t('login')}
          </Text>
        </TouchableOpacity>

        <View style={styles.demoInfo}>
          <Text style={styles.demoText}>
            {language === 'ko' ? '데모 계정: demo / 1234' : 'Demo: demo / 1234'}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.langToggle}
        onPress={() => setLanguage(language === 'ko' ? 'en' : 'ko')}
      >
        <Ionicons name="globe-outline" size={18} color="#666" />
        <Text style={styles.langText}>{language === 'ko' ? 'English' : '한국어'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
    color: Colors.primary,
    marginTop: 12,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#666',
    marginTop: 8,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#333',
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    color: '#333',
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
  },
  switchMode: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  switchText: {
    color: '#666',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  switchLink: {
    color: Colors.primary,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  demoInfo: {
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#e8f4f8',
    borderRadius: 8,
  },
  demoText: {
    color: '#0D9488',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  langToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 32,
  },
  langText: {
    color: '#666',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
});
