import { StyleSheet, Text, View, ScrollView, Platform, TouchableOpacity, TextInput, Alert, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import React, { useState, useEffect, useCallback } from "react";
import * as Clipboard from "expo-clipboard";
import Colors from "@/constants/colors";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { fetch } from "expo/fetch";
import { TimeBlock } from "@/contexts/MedicationContext";

const BLOCK_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  morning: "sunny",
  afternoon: "partly-sunny",
  evening: "moon",
  bedtime: "bed",
};

const BLOCK_COLORS: Record<string, string> = {
  morning: "#F59E0B",
  afternoon: "#3B82F6",
  evening: "#8B5CF6",
  bedtime: "#6366F1",
};

const NUDGE_TYPES = [
  { type: "heart", emoji: "❤️" },
  { type: "pill", emoji: "💊" },
  { type: "time", emoji: "⏰" },
  { type: "thumbsup", emoji: "👍" },
];

interface ConnectionData {
  id: string;
  status: string;
  nickname: string | null;
  isRequester: boolean;
  requester: { id: string; displayName: string; timezone: string };
  target: { id: string; displayName: string; timezone: string };
}

interface UserSummary {
  user: { id: string; displayName: string; timezone: string };
  completed: number;
  pending: number;
  missed: number;
  total: number;
  blockSummaries: { block: string; completed: number; total: number }[];
}

export default function CaregiverScreen() {
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  const [connections, setConnections] = useState<ConnectionData[]>([]);
  const [summaries, setSummaries] = useState<Record<string, UserSummary>>({});
  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [nudgeSending, setNudgeSending] = useState<string | null>(null);

  const blockLabels: Record<string, string> = {
    morning: t('morningBlock'),
    afternoon: t('afternoonBlock'),
    evening: t('eveningBlock'),
    bedtime: t('bedtimeBlock'),
  };

  const loadConnections = useCallback(async () => {
    try {
      const baseUrl = getApiUrl();
      const res = await fetch(new URL('/api/connections', baseUrl).toString(), { credentials: 'include' });
      if (res.ok) {
        const data: ConnectionData[] = await res.json();
        setConnections(data);

        const accepted = data.filter(c => c.status === 'accepted');
        const newSummaries: Record<string, UserSummary> = {};
        for (const conn of accepted) {
          const targetId = conn.isRequester ? conn.target.id : conn.requester.id;
          try {
            const sRes = await fetch(new URL(`/api/summary/${targetId}`, baseUrl).toString(), { credentials: 'include' });
            if (sRes.ok) {
              newSummaries[targetId] = await sRes.json();
            }
          } catch {}
        }
        setSummaries(newSummaries);
      }
    } catch (err) {
      console.error('Failed to load connections:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const handleGenerateInvite = async () => {
    try {
      const res = await apiRequest('POST', '/api/invites');
      const data = await res.json();
      setInviteCode(data.code);
      setShowInvite(true);
    } catch (err) {
      Alert.alert(t('error'), 'Failed to generate invite code');
    }
  };

  const handleCopyCode = async () => {
    if (inviteCode) {
      await Clipboard.setStringAsync(inviteCode);
      Alert.alert('', t('codeCopied'));
    }
  };

  const handleAcceptInvite = async () => {
    if (!inputCode.trim()) return;
    try {
      await apiRequest('POST', '/api/invites/accept', {
        code: inputCode.trim().toUpperCase(),
        nickname: nickname.trim() || null,
      });
      Alert.alert('', t('connectionSuccess'));
      setInputCode('');
      setNickname('');
      setShowConnect(false);
      loadConnections();
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('Invalid')) Alert.alert(t('error'), t('invalidCode'));
      else if (msg.includes('expired')) Alert.alert(t('error'), t('codeExpired'));
      else if (msg.includes('used')) Alert.alert(t('error'), t('codeUsed'));
      else Alert.alert(t('error'), msg);
    }
  };

  const handleDisconnect = (connId: string) => {
    Alert.alert(t('disconnect'), t('disconnectConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('disconnect'),
        style: 'destructive',
        onPress: async () => {
          try {
            await apiRequest('DELETE', `/api/connections/${connId}`);
            loadConnections();
          } catch {}
        },
      },
    ]);
  };

  const handleNudge = async (toUserId: string, type: string) => {
    setNudgeSending(toUserId);
    try {
      await apiRequest('POST', '/api/nudges', { toUserId, type });
      Alert.alert('', t('nudgeSent'));
    } catch {}
    setNudgeSending(null);
  };

  const acceptedConnections = connections.filter(c => c.status === 'accepted');

  const getTimezoneLabel = (tz: string): string => {
    if (tz === 'Asia/Seoul') return 'KST';
    if (tz.includes('America/New_York')) return 'EST';
    if (tz.includes('America/Los_Angeles')) return 'PST';
    if (tz.includes('Europe/London')) return 'GMT';
    return tz.split('/').pop() || tz;
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('caregiverView')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 + webBottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleGenerateInvite}
            testID="generate-invite"
          >
            <Ionicons name="share-outline" size={20} color={Colors.primary} />
            <Text style={styles.actionButtonText}>{t('generateInvite')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setShowConnect(!showConnect)}
            testID="enter-code-toggle"
          >
            <Ionicons name="link-outline" size={20} color={Colors.primary} />
            <Text style={styles.actionButtonText}>{t('enterInviteCode')}</Text>
          </TouchableOpacity>
        </View>

        {showInvite && inviteCode && (
          <Animated.View entering={Platform.OS !== "web" ? FadeInDown.springify() : undefined} style={styles.inviteCard}>
            <Text style={styles.inviteLabel}>{t('inviteCode')}</Text>
            <Text style={styles.inviteCodeText}>{inviteCode}</Text>
            <Text style={styles.inviteDesc}>{t('inviteCodeDesc')}</Text>
            <TouchableOpacity style={styles.copyButton} onPress={handleCopyCode}>
              <Ionicons name="copy-outline" size={18} color="#fff" />
              <Text style={styles.copyButtonText}>{t('copyCode')}</Text>
            </TouchableOpacity>
            <Text style={styles.expiresText}>{t('expiresIn')}</Text>
          </Animated.View>
        )}

        {showConnect && (
          <Animated.View entering={Platform.OS !== "web" ? FadeInDown.springify() : undefined} style={styles.connectCard}>
            <TextInput
              style={styles.codeInput}
              placeholder={t('enterCodePlaceholder')}
              placeholderTextColor="#999"
              value={inputCode}
              onChangeText={setInputCode}
              autoCapitalize="characters"
              maxLength={6}
              testID="invite-code-input"
            />
            <TextInput
              style={styles.codeInput}
              placeholder={t('nicknamePlaceholder')}
              placeholderTextColor="#999"
              value={nickname}
              onChangeText={setNickname}
              testID="nickname-input"
            />
            <TouchableOpacity
              style={[styles.connectButton, !inputCode.trim() && styles.connectButtonDisabled]}
              onPress={handleAcceptInvite}
              disabled={!inputCode.trim()}
              testID="accept-invite-button"
            >
              <Text style={styles.connectButtonText}>{t('acceptInvite')}</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {acceptedConnections.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="people-outline" size={56} color={Colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>{t('noConnections')}</Text>
            <Text style={styles.emptySubtitle}>{t('connectToStart')}</Text>
          </View>
        ) : (
          <View style={styles.personList}>
            <Text style={styles.sectionTitle}>{t('myConnections')}</Text>
            {acceptedConnections.map((conn, index) => {
              const otherPerson = conn.isRequester ? conn.target : conn.requester;
              const displayName = conn.nickname || otherPerson.displayName;
              const tzLabel = getTimezoneLabel(otherPerson.timezone);
              const summary = summaries[otherPerson.id];
              const progress = summary && summary.total > 0
                ? Math.round((summary.completed / summary.total) * 100)
                : 0;

              const statusColor = summary
                ? summary.missed > 0 ? Colors.danger
                : summary.pending > 0 ? Colors.warning
                : Colors.success
                : Colors.textTertiary;

              const statusText = summary
                ? summary.total === summary.completed
                  ? t('caregiverAllDone')
                  : summary.missed > 0
                    ? t('caregiverSomeMissed')
                    : t('caregiverSomePending')
                : '';

              return (
                <Animated.View
                  key={conn.id}
                  entering={Platform.OS !== "web" ? FadeInDown.delay(index * 80).springify() : undefined}
                  style={styles.personCard}
                >
                  <View style={styles.personHeader}>
                    <View style={styles.personInfo}>
                      <View style={[styles.avatarCircle, { backgroundColor: BLOCK_COLORS[['morning', 'afternoon', 'evening', 'bedtime'][index % 4]] + '20' }]}>
                        <Text style={styles.avatarText}>{displayName.charAt(0)}</Text>
                      </View>
                      <View>
                        <Text style={styles.personName}>{displayName}</Text>
                        <Text style={styles.personTimezone}>({tzLabel})</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDisconnect(conn.id)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="close-circle-outline" size={22} color={Colors.textTertiary} />
                    </TouchableOpacity>
                  </View>

                  {summary && (
                    <>
                      <View style={styles.personStatusRow}>
                        <Ionicons
                          name={summary.completed === summary.total ? "checkmark-circle" : summary.missed > 0 ? "alert-circle" : "time"}
                          size={18}
                          color={statusColor}
                        />
                        <Text style={[styles.personStatusText, { color: statusColor }]}>
                          {statusText}
                        </Text>
                      </View>

                      <View style={styles.personProgressRow}>
                        <View style={styles.personProgressBarBg}>
                          <View style={[styles.personProgressFill, { width: `${progress}%` as any, backgroundColor: statusColor }]} />
                        </View>
                        <Text style={[styles.personProgressPercent, { color: statusColor }]}>{progress}%</Text>
                      </View>

                      <View style={styles.personStats}>
                        <View style={styles.personStatItem}>
                          <Text style={[styles.personStatValue, { color: Colors.success }]}>{summary.completed}</Text>
                          <Text style={styles.personStatLabel}>{t('caregiverCompleted')}</Text>
                        </View>
                        <View style={styles.personStatItem}>
                          <Text style={[styles.personStatValue, { color: Colors.warning }]}>{summary.pending}</Text>
                          <Text style={styles.personStatLabel}>{t('caregiverPending')}</Text>
                        </View>
                        <View style={styles.personStatItem}>
                          <Text style={[styles.personStatValue, { color: Colors.danger }]}>{summary.missed}</Text>
                          <Text style={styles.personStatLabel}>{t('caregiverMissed')}</Text>
                        </View>
                      </View>

                      {summary.blockSummaries.length > 0 && (
                        <View style={styles.personBlocks}>
                          {summary.blockSummaries.map(bs => (
                            <View key={bs.block} style={styles.personBlockItem}>
                              <Ionicons name={BLOCK_ICONS[bs.block] || "time"} size={16} color={BLOCK_COLORS[bs.block] || '#666'} />
                              <Text style={styles.personBlockText}>
                                {blockLabels[bs.block]} {bs.completed}/{bs.total}
                              </Text>
                              {bs.completed === bs.total && (
                                <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                              )}
                            </View>
                          ))}
                        </View>
                      )}
                    </>
                  )}

                  <View style={styles.nudgeRow}>
                    <Text style={styles.nudgeLabel}>{t('sendNudge')}:</Text>
                    {NUDGE_TYPES.map(n => (
                      <TouchableOpacity
                        key={n.type}
                        style={styles.nudgeButton}
                        onPress={() => handleNudge(otherPerson.id, n.type)}
                        disabled={nudgeSending === otherPerson.id}
                      >
                        <Text style={styles.nudgeEmoji}>{n.emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </Animated.View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingVertical: 16 },
  title: { fontFamily: "Inter_700Bold", fontSize: 26, color: Colors.text },
  scrollContent: { paddingHorizontal: 20, gap: 16 },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.surface, borderRadius: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: Colors.primary + '30',
  },
  actionButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.primary },
  inviteCard: {
    backgroundColor: Colors.primary + '08', borderRadius: 16, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.primary + '20',
  },
  inviteLabel: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.textSecondary, marginBottom: 8 },
  inviteCodeText: { fontFamily: "Inter_700Bold", fontSize: 36, color: Colors.primary, letterSpacing: 6 },
  inviteDesc: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary, marginTop: 8 },
  copyButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary,
    borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10, marginTop: 16,
  },
  copyButtonText: { color: '#fff', fontFamily: "Inter_600SemiBold", fontSize: 14 },
  expiresText: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textTertiary, marginTop: 8 },
  connectCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 20, gap: 12,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  codeInput: {
    backgroundColor: '#f5f5f5', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, fontFamily: "Inter_500Medium", textAlign: 'center', color: '#333',
  },
  connectButton: {
    backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  connectButtonDisabled: { opacity: 0.5 },
  connectButtonText: { color: '#fff', fontFamily: "Inter_600SemiBold", fontSize: 16 },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold", fontSize: 18, color: Colors.text, marginBottom: 4,
  },
  personList: { gap: 12 },
  personCard: {
    backgroundColor: Colors.surface, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: Colors.borderLight, gap: 14,
  },
  personHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  personInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarCircle: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.text },
  personName: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.text },
  personTimezone: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textTertiary, marginTop: 1 },
  personStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  personStatusText: { fontFamily: "Inter_500Medium", fontSize: 14 },
  personProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  personProgressBarBg: {
    flex: 1, height: 8, borderRadius: 4, backgroundColor: Colors.borderLight, overflow: 'hidden',
  },
  personProgressFill: { height: '100%', borderRadius: 4 },
  personProgressPercent: { fontFamily: "Inter_700Bold", fontSize: 14, minWidth: 40, textAlign: 'right' },
  personStats: { flexDirection: 'row', gap: 8 },
  personStatItem: {
    flex: 1, alignItems: 'center', backgroundColor: '#f8f9fa', borderRadius: 10, paddingVertical: 10,
  },
  personStatValue: { fontFamily: "Inter_700Bold", fontSize: 22 },
  personStatLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  personBlocks: { gap: 6 },
  personBlockItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6,
    paddingHorizontal: 12, backgroundColor: '#f8f9fa', borderRadius: 8,
  },
  personBlockText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.text, flex: 1 },
  nudgeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  nudgeLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary },
  nudgeButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#f0f0f0',
    alignItems: 'center', justifyContent: 'center',
  },
  nudgeEmoji: { fontSize: 20 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8 },
  emptyIconContainer: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 20, color: Colors.text },
  emptySubtitle: {
    fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textSecondary,
    textAlign: 'center', paddingHorizontal: 40,
  },
});
