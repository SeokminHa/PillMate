import { StyleSheet, Text, View, ScrollView, Platform, Pressable, TextInput, Alert, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import React, { useState, useEffect, useCallback } from "react";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { fetch } from "expo/fetch";

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

const PRESET_NUDGES = [
  { type: "reminder", emoji: "💊", labelKey: "nudgeReminder" as const },
  { type: "praise", emoji: "👍", labelKey: "nudgePraise" as const },
  { type: "heart", emoji: "❤️", labelKey: "sendNudge" as const },
  { type: "time", emoji: "⏰", labelKey: "sendNudge" as const },
];

interface ConnectionData {
  id: string;
  status: string;
  nickname: string | null;
  isRequester: boolean;
  role: "viewer" | "owner";
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
  const { t } = useLanguage();
  const { user } = useAuth();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  const [connections, setConnections] = useState<ConnectionData[]>([]);
  const [summaries, setSummaries] = useState<Record<string, UserSummary>>({});
  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [nudgeFeedback, setNudgeFeedback] = useState<{ id: string; emoji: string } | null>(null);

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

        const viewerAccepted = data.filter(c => c.role === 'viewer' && c.status === 'accepted');
        const newSummaries: Record<string, UserSummary> = {};
        for (const conn of viewerAccepted) {
          const targetId = conn.target.id;
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
    } catch {
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
      });
      Alert.alert('', t('requestSent'));
      setInputCode('');
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

  const handleRespond = async (connId: string, accept: boolean) => {
    try {
      await apiRequest('POST', '/api/connections/respond', { connectionId: connId, accept });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadConnections();
    } catch {}
  };

  const handleDisconnect = (connId: string, label: string) => {
    Alert.alert(label, t('disconnectConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('confirm'),
        style: 'destructive',
        onPress: async () => {
          await apiRequest('DELETE', `/api/connections/${connId}`).catch(() => {});
          loadConnections();
        },
      },
    ]);
  };

  const handleNudge = async (toUserId: string, type: string, emoji: string) => {
    try {
      await apiRequest('POST', '/api/nudges', { toUserId, type });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNudgeFeedback({ id: toUserId, emoji });
      setTimeout(() => setNudgeFeedback(null), 2500);
    } catch {}
  };

  const getTimezoneLabel = (tz: string): string => {
    if (tz === 'Asia/Seoul') return 'KST';
    if (tz.includes('America/New_York')) return 'EST';
    if (tz.includes('America/Los_Angeles')) return 'PST';
    if (tz.includes('Europe/London')) return 'GMT';
    return tz.split('/').pop() || tz;
  };

  const viewerConnections = connections.filter(c => c.role === 'viewer');
  const ownerConnections = connections.filter(c => c.role === 'owner');

  const acceptedViewer = viewerConnections.filter(c => c.status === 'accepted');
  const pendingViewer = viewerConnections.filter(c => c.status === 'pending');
  const rejectedViewer = viewerConnections.filter(c => c.status === 'rejected');
  const pendingOwner = ownerConnections.filter(c => c.status === 'pending');
  const acceptedOwner = ownerConnections.filter(c => c.status === 'accepted');

  const sortedViewer = [...acceptedViewer].sort((a, b) => {
    const sa = summaries[a.target.id];
    const sb = summaries[b.target.id];
    if (!sa && !sb) return 0;
    if (!sa) return 1;
    if (!sb) return -1;
    const missedA = sa.missed;
    const missedB = sb.missed;
    if (missedA !== missedB) return missedB - missedA;
    return (sa.completed / (sa.total || 1)) - (sb.completed / (sb.total || 1));
  });

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
          <Pressable
            style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.8 }]}
            onPress={handleGenerateInvite}
            testID="generate-invite"
          >
            <Ionicons name="share-outline" size={18} color={Colors.primary} />
            <Text style={styles.actionButtonText}>{t('generateInvite')}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.8 }]}
            onPress={() => setShowConnect(!showConnect)}
            testID="enter-code-toggle"
          >
            <Ionicons name="link-outline" size={18} color={Colors.primary} />
            <Text style={styles.actionButtonText}>{t('enterInviteCode')}</Text>
          </Pressable>
        </View>

        {showInvite && inviteCode && (
          <Animated.View entering={Platform.OS !== "web" ? FadeInDown.springify() : undefined} style={styles.inviteCard}>
            <Text style={styles.inviteLabel}>{t('inviteCode')}</Text>
            <Text style={styles.inviteCodeText}>{inviteCode}</Text>
            <Text style={styles.inviteDesc}>{t('inviteCodeDesc')}</Text>
            <Pressable style={({ pressed }) => [styles.copyButton, pressed && { opacity: 0.8 }]} onPress={handleCopyCode}>
              <Ionicons name="copy-outline" size={16} color="#fff" />
              <Text style={styles.copyButtonText}>{t('copyCode')}</Text>
            </Pressable>
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
            <Pressable
              style={({ pressed }) => [
                styles.connectButton,
                !inputCode.trim() && styles.connectButtonDisabled,
                pressed && { opacity: 0.85 },
              ]}
              onPress={handleAcceptInvite}
              disabled={!inputCode.trim()}
              testID="accept-invite-button"
            >
              <Text style={styles.connectButtonText}>{t('acceptInvite')}</Text>
            </Pressable>
          </Animated.View>
        )}

        {pendingOwner.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="notifications" size={16} color={Colors.warning} />
              <Text style={styles.sectionTitle}>{t('viewRequestTitle')}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingOwner.length}</Text>
              </View>
            </View>
            {pendingOwner.map((conn) => (
              <Animated.View
                key={conn.id}
                entering={Platform.OS !== "web" ? FadeInDown.springify() : undefined}
                style={styles.requestCard}
              >
                <View style={styles.requestInfo}>
                  <View style={styles.avatarSmall}>
                    <Text style={styles.avatarSmallText}>{conn.requester.displayName.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.requestName}>{conn.requester.displayName}</Text>
                    <Text style={styles.requestDesc}>{conn.requester.displayName}{t('viewRequestDesc')}</Text>
                  </View>
                </View>
                <View style={styles.requestActions}>
                  <Pressable
                    style={({ pressed }) => [styles.rejectBtn, pressed && { opacity: 0.8 }]}
                    onPress={() => handleRespond(conn.id, false)}
                  >
                    <Text style={styles.rejectBtnText}>{t('reject')}</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.approveBtn, pressed && { opacity: 0.8 }]}
                    onPress={() => handleRespond(conn.id, true)}
                  >
                    <Text style={styles.approveBtnText}>{t('approve')}</Text>
                  </Pressable>
                </View>
              </Animated.View>
            ))}
          </View>
        )}

        {sortedViewer.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="eye" size={16} color={Colors.primary} />
              <Text style={styles.sectionTitle}>{t('peopleICanView')}</Text>
            </View>
            {sortedViewer.map((conn, index) => {
              const person = conn.target;
              const displayName = conn.nickname || person.displayName;
              const tzLabel = getTimezoneLabel(person.timezone);
              const summary = summaries[person.id];
              const progress = summary && summary.total > 0
                ? Math.round((summary.completed / summary.total) * 100)
                : 0;

              const statusColor = summary
                ? summary.missed > 0 ? Colors.danger
                : summary.pending > 0 ? Colors.warning
                : Colors.success
                : Colors.textTertiary;

              return (
                <Animated.View
                  key={conn.id}
                  entering={Platform.OS !== "web" ? FadeInDown.delay(index * 60).springify() : undefined}
                  style={styles.personCard}
                >
                  <View style={styles.personHeader}>
                    <View style={styles.personInfo}>
                      <View style={[styles.avatar, { backgroundColor: BLOCK_COLORS[['morning', 'afternoon', 'evening', 'bedtime'][index % 4]] + '20' }]}>
                        <Text style={styles.avatarText}>{displayName.charAt(0)}</Text>
                      </View>
                      <View>
                        <Text style={styles.personName}>{displayName}</Text>
                        <Text style={styles.personTz}>({tzLabel})</Text>
                      </View>
                    </View>
                    <Pressable
                      onPress={() => handleDisconnect(conn.id, t('removeAccess'))}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="close-circle-outline" size={20} color={Colors.textTertiary} />
                    </Pressable>
                  </View>

                  {summary && (
                    <>
                      <View style={styles.progressRow}>
                        <View style={styles.progressBarBg}>
                          <View style={[styles.progressBarFill, { width: `${progress}%` as any, backgroundColor: statusColor }]} />
                        </View>
                        <Text style={[styles.progressPercent, { color: statusColor }]}>{progress}%</Text>
                      </View>

                      <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                          <Text style={[styles.statValue, { color: Colors.success }]}>{summary.completed}</Text>
                          <Text style={styles.statLabel}>{t('caregiverCompleted')}</Text>
                        </View>
                        <View style={styles.statItem}>
                          <Text style={[styles.statValue, { color: Colors.warning }]}>{summary.pending}</Text>
                          <Text style={styles.statLabel}>{t('caregiverPending')}</Text>
                        </View>
                        <View style={styles.statItem}>
                          <Text style={[styles.statValue, { color: Colors.danger }]}>{summary.missed}</Text>
                          <Text style={styles.statLabel}>{t('caregiverMissed')}</Text>
                        </View>
                      </View>

                      {summary.blockSummaries.length > 0 && (
                        <View style={styles.blocksRow}>
                          {summary.blockSummaries.map(bs => (
                            <View key={bs.block} style={styles.blockItem}>
                              <Ionicons name={BLOCK_ICONS[bs.block] || "time"} size={14} color={BLOCK_COLORS[bs.block] || '#666'} />
                              <Text style={styles.blockItemText}>
                                {blockLabels[bs.block]} {bs.completed}/{bs.total}
                              </Text>
                              {bs.completed === bs.total && (
                                <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
                              )}
                            </View>
                          ))}
                        </View>
                      )}
                    </>
                  )}

                  <View style={styles.nudgeRow}>
                    {PRESET_NUDGES.map(n => (
                      <Pressable
                        key={n.type}
                        style={({ pressed }) => [styles.nudgeButton, pressed && { transform: [{ scale: 0.9 }] }]}
                        onPress={() => handleNudge(person.id, n.type, n.emoji)}
                      >
                        <Text style={styles.nudgeEmoji}>{n.emoji}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {nudgeFeedback && nudgeFeedback.id === person.id && (
                    <Animated.View entering={FadeIn.duration(200)} style={styles.nudgeFeedbackBar}>
                      <Text style={styles.nudgeFeedbackText}>
                        {nudgeFeedback.emoji} {t('nudgeSentTo')} {displayName}
                      </Text>
                    </Animated.View>
                  )}
                </Animated.View>
              );
            })}
          </View>
        )}

        {(pendingViewer.length > 0 || rejectedViewer.length > 0) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="hourglass" size={16} color={Colors.textSecondary} />
              <Text style={[styles.sectionTitle, { color: Colors.textSecondary }]}>{t('pendingApproval')}</Text>
            </View>
            {pendingViewer.map(conn => (
              <View key={conn.id} style={styles.pendingCard}>
                <View style={styles.personInfo}>
                  <View style={[styles.avatarSmall, { backgroundColor: Colors.surfaceSecondary }]}>
                    <Ionicons name="hourglass-outline" size={16} color={Colors.textTertiary} />
                  </View>
                  <View>
                    <Text style={styles.pendingName}>{conn.target.displayName}</Text>
                    <Text style={styles.pendingStatus}>{t('pendingApproval')}</Text>
                  </View>
                </View>
              </View>
            ))}
            {rejectedViewer.map(conn => (
              <View key={conn.id} style={styles.pendingCard}>
                <View style={styles.personInfo}>
                  <View style={[styles.avatarSmall, { backgroundColor: Colors.dangerBg }]}>
                    <Ionicons name="close-circle-outline" size={16} color={Colors.danger} />
                  </View>
                  <View>
                    <Text style={styles.pendingName}>{conn.target.displayName}</Text>
                    <Text style={[styles.pendingStatus, { color: Colors.danger }]}>{t('rejected')}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {acceptedOwner.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="eye-off" size={16} color={Colors.textSecondary} />
              <Text style={styles.sectionTitle}>{t('peopleWhoCanViewMe')}</Text>
            </View>
            {acceptedOwner.map(conn => (
              <View key={conn.id} style={styles.viewerCard}>
                <View style={styles.personInfo}>
                  <View style={[styles.avatarSmall, { backgroundColor: Colors.primaryBg }]}>
                    <Text style={styles.avatarSmallText}>{conn.requester.displayName.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.viewerName}>{conn.requester.displayName}</Text>
                    <Text style={styles.viewerLabel}>{t('viewerLabel')}</Text>
                  </View>
                  <Pressable
                    onPress={() => handleDisconnect(conn.id, t('revokeAccess'))}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-circle-outline" size={20} color={Colors.textTertiary} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {connections.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="people-outline" size={56} color={Colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>{t('noConnectionsYet')}</Text>
            <Text style={styles.emptySubtitle}>{t('noConnectionsDesc')}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  title: { fontFamily: "Inter_700Bold", fontSize: 22, color: Colors.text },
  scrollContent: { paddingHorizontal: 20, gap: 16 },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.surface, borderRadius: 12, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.primary + '30',
  },
  actionButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.primary },
  inviteCard: {
    backgroundColor: Colors.primary + '08', borderRadius: 14, padding: 20,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.primary + '20',
  },
  inviteLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary, marginBottom: 6 },
  inviteCodeText: { fontFamily: "Inter_700Bold", fontSize: 32, color: Colors.primary, letterSpacing: 6 },
  inviteDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginTop: 6 },
  copyButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary,
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, marginTop: 12,
  },
  copyButtonText: { color: '#fff', fontFamily: "Inter_600SemiBold", fontSize: 13 },
  expiresText: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textTertiary, marginTop: 6 },
  connectCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 16, gap: 10,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  codeInput: {
    backgroundColor: '#f5f5f5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, fontFamily: "Inter_600SemiBold", textAlign: 'center', color: '#333', letterSpacing: 3,
  },
  connectButton: {
    backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  connectButtonDisabled: { opacity: 0.5 },
  connectButtonText: { color: '#fff', fontFamily: "Inter_600SemiBold", fontSize: 14 },
  section: { gap: 8 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.text, flex: 1,
  },
  badge: {
    backgroundColor: Colors.warning, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2,
  },
  badgeText: { fontFamily: "Inter_700Bold", fontSize: 11, color: "#FFF" },
  requestCard: {
    backgroundColor: Colors.warningBg, borderRadius: 14, padding: 14, gap: 10,
    borderWidth: 1, borderColor: Colors.warning + '30',
  },
  requestInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  requestName: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.text },
  requestDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  requestActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  rejectBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
    backgroundColor: Colors.surfaceSecondary,
  },
  rejectBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.textSecondary },
  approveBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
    backgroundColor: Colors.primary,
  },
  approveBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#FFF" },
  personCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: Colors.borderLight, gap: 10,
  },
  personHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  personInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.text },
  avatarSmall: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primaryBg,
  },
  avatarSmallText: { fontFamily: "Inter_700Bold", fontSize: 14, color: Colors.text },
  personName: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.text },
  personTz: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textTertiary },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressBarBg: {
    flex: 1, height: 6, borderRadius: 3, backgroundColor: Colors.borderLight, overflow: 'hidden',
  },
  progressBarFill: { height: '100%', borderRadius: 3 },
  progressPercent: { fontFamily: "Inter_700Bold", fontSize: 13, minWidth: 36, textAlign: 'right' },
  statsRow: { flexDirection: 'row', gap: 6 },
  statItem: {
    flex: 1, alignItems: 'center', backgroundColor: '#f8f9fa', borderRadius: 8, paddingVertical: 8,
  },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 20 },
  statLabel: { fontFamily: "Inter_400Regular", fontSize: 10, color: Colors.textSecondary, marginTop: 1 },
  blocksRow: { gap: 4 },
  blockItem: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4,
    paddingHorizontal: 10, backgroundColor: '#f8f9fa', borderRadius: 6,
  },
  blockItemText: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.text, flex: 1 },
  nudgeRow: {
    flexDirection: 'row', gap: 8, justifyContent: 'center',
    paddingTop: 6, borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  nudgeButton: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#f0f0f0',
    alignItems: 'center', justifyContent: 'center',
  },
  nudgeEmoji: { fontSize: 18 },
  nudgeFeedbackBar: {
    backgroundColor: Colors.successBg, borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 10, alignItems: 'center',
  },
  nudgeFeedbackText: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.success },
  pendingCard: {
    backgroundColor: Colors.surfaceSecondary, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  pendingName: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },
  pendingStatus: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textTertiary },
  viewerCard: {
    backgroundColor: Colors.surface, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  viewerName: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },
  viewerLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textTertiary },
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
