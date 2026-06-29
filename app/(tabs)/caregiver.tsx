import { StyleSheet, Text, View, ScrollView, Platform, Pressable, TextInput, Alert, ActivityIndicator, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import React, { useState, useEffect, useCallback, useRef } from "react";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { fetch } from "expo/fetch";

interface ConnectionData {
  id: string;
  status: string;
  nickname: string | null;
  isRequester: boolean;
  role: "viewer" | "owner";
  requester: { id: string; displayName: string; timezone: string };
  target: { id: string; displayName: string; timezone: string };
}

interface SummaryItem {
  medicationId: string;
  name: string;
  color: string;
  scheduledTime: string;
  block: string;
  taken: boolean;
  status: "taken" | "pending" | "missed";
}

interface UserSummary {
  user: { id: string; displayName: string; timezone: string };
  completed: number;
  pending: number;
  missed: number;
  total: number;
  streak?: number;
  blockSummaries: { block: string; completed: number; total: number }[];
  items: SummaryItem[];
}

interface GroupData {
  id: string;
  name: string;
  createdBy: string;
  isAdmin: boolean;
  members: { id: string; userId: string; displayName: string; role: string; status: string }[];
}

interface GroupDashboard {
  group: { id: string; name: string };
  members: { userId: string; displayName: string; role: string; summary: { completed: number; pending: number; missed: number; total: number; streak: number } }[];
}

interface NudgeData {
  id: string;
  type: string;
  medicationName: string | null;
  message: string | null;
  fromUser: { id: string; displayName: string };
  createdAt: string;
  readAt: string | null;
}

const AVATAR_COLORS = ["#F59E0B", "#3B82F6", "#8B5CF6", "#6366F1", "#10B981", "#EC4899"];

export default function CaregiverScreen() {
  const insets = useSafeAreaInsets();
  const { t, language, setLanguage } = useLanguage();
  const { user, refreshPendingCount, updateProfile, logout } = useAuth();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  const [connections, setConnections] = useState<ConnectionData[]>([]);
  const [summaries, setSummaries] = useState<Record<string, UserSummary>>({});
  const [messages, setMessages] = useState<NudgeData[]>([]);
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [groupDashboards, setGroupDashboards] = useState<Record<string, GroupDashboard>>({});
  const [groupPendingInvites, setGroupPendingInvites] = useState<{ id: string; groupName: string; inviterName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [friendId, setFriendId] = useState("");
  const [sending, setSending] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState(false);
  const [idInput, setIdInput] = useState("");
  const [savingId, setSavingId] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [inviteGroupId, setInviteGroupId] = useState<string | null>(null);
  const [inviteUsername, setInviteUsername] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 2200);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const baseUrl = getApiUrl();
      const res = await fetch(new URL("/api/connections", baseUrl).toString(), { credentials: "include" });
      if (res.ok) {
        const data: ConnectionData[] = await res.json();
        setConnections(data);

        const accepted = data.filter(c => c.status === "accepted");
        const newSummaries: Record<string, UserSummary> = {};
        const results = await Promise.allSettled(
          accepted.map(async (conn) => {
            const other = conn.isRequester ? conn.target : conn.requester;
            const sRes = await fetch(new URL(`/api/summary/${other.id}`, baseUrl).toString(), { credentials: "include" });
            if (!sRes.ok) throw new Error("summary fetch failed");
            return { id: other.id, summary: (await sRes.json()) as UserSummary };
          })
        );
        for (const r of results) {
          if (r.status === "fulfilled") newSummaries[r.value.id] = r.value.summary;
        }
        setSummaries(newSummaries);
      }

      const nRes = await fetch(new URL("/api/nudges", baseUrl).toString(), { credentials: "include" });
      if (nRes.ok) {
        const nData: NudgeData[] = await nRes.json();
        setMessages(nData);
      }

      const gRes = await fetch(new URL("/api/groups", baseUrl).toString(), { credentials: "include" });
      if (gRes.ok) {
        const gData: GroupData[] = await gRes.json();
        setGroups(gData);
        const dashResults = await Promise.allSettled(
          gData.map(async g => {
            const dRes = await fetch(new URL(`/api/groups/${g.id}/dashboard`, baseUrl).toString(), { credentials: "include" });
            if (!dRes.ok) throw new Error("dashboard fetch failed");
            return { id: g.id, dashboard: (await dRes.json()) as GroupDashboard };
          })
        );
        const newDash: Record<string, GroupDashboard> = {};
        for (const r of dashResults) {
          if (r.status === "fulfilled") newDash[r.value.id] = r.value.dashboard;
        }
        setGroupDashboards(newDash);

        const gpRes = await fetch(new URL("/api/groups/pending-invites", baseUrl).toString(), { credentials: "include" });
        if (gpRes.ok) {
          const invData = await gpRes.json();
          setGroupPendingInvites(invData.map((inv: any) => ({
            id: inv.memberId,
            groupName: inv.groupName,
            inviterName: inv.inviterName,
          })));
        }
      }
    } catch (err) {
      console.error("Failed to load connections:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 10000);
    return () => clearInterval(interval);
  }, [loadAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    refreshPendingCount();
    setRefreshing(false);
  }, [loadAll, refreshPendingCount]);

  const handleCopyId = async () => {
    if (user?.username) {
      await Clipboard.setStringAsync(user.username);
      showToast(t("idCopied"));
    }
  };

  const startEditId = () => {
    setIdInput(user?.username || "");
    setEditingId(true);
  };

  const handleSaveId = async () => {
    const next = idInput.trim();
    if (!next) { showToast(t("idEmptyMsg")); return; }
    if (next === user?.username) { setEditingId(false); return; }
    setSavingId(true);
    try {
      await updateProfile({ username: next });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditingId(false);
      showToast(t("idChanged"));
    } catch (err: any) {
      const msg = (err?.message || "").toLowerCase();
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (msg.includes("taken") || msg.includes("409")) showToast(t("idTaken"));
      else showToast(t("error"));
    } finally {
      setSavingId(false);
    }
  };

  const handleSendRequest = async () => {
    const id = friendId.trim();
    if (!id || sending) return;
    setSending(true);
    try {
      await apiRequest("POST", "/api/connections/request", { username: id });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setFriendId("");
      showToast(t("requestSent"));
      loadAll();
    } catch (err: any) {
      const msg = (err?.message || "").toLowerCase();
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (msg.includes("not found")) showToast(t("userNotFound"));
      else if (msg.includes("already connected")) showToast(t("alreadyConnectedMsg"));
      else if (msg.includes("pending")) showToast(t("alreadyRequestedMsg"));
      else if (msg.includes("yourself")) showToast(t("cannotAddSelfMsg"));
      else showToast(t("error"));
    } finally {
      setSending(false);
    }
  };

  const handleRespond = async (connId: string, accept: boolean) => {
    try {
      await apiRequest("POST", "/api/connections/respond", { connectionId: connId, accept });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadAll();
      refreshPendingCount();
    } catch {
      showToast(t("error"));
    }
  };

  const doRemove = useCallback(async (connId: string) => {
    await apiRequest("DELETE", `/api/connections/${connId}`).catch(() => {});
    loadAll();
  }, [loadAll]);

  const handleRemove = (connId: string, label: string) => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(`${label}\n\n${t("disconnectConfirm")}`)) {
        doRemove(connId);
      }
      return;
    }
    Alert.alert(label, t("disconnectConfirm"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("confirm"), style: "destructive", onPress: () => doRemove(connId) },
    ]);
  };

  const handlePillMessage = async (toUserId: string, item: SummaryItem) => {
    const type = item.taken ? "praise" : "reminder";
    const message = item.taken ? t("goodJobMsg") : t("dontForgetMsg");
    try {
      await apiRequest("POST", "/api/nudges", {
        toUserId,
        type,
        medicationName: item.name,
        message,
      });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(t("messageSent"));
    } catch {
      showToast(t("error"));
    }
  };

  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name || creatingGroup) return;
    setCreatingGroup(true);
    try {
      await apiRequest("POST", "/api/groups", { name });
      setNewGroupName("");
      showToast(t("createGroup" as any));
      loadAll();
    } catch {
      showToast(t("error"));
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleDeleteGroup = (groupId: string, groupName: string) => {
    Alert.alert(t("deleteGroup" as any), t("deleteGroupConfirm" as any), [
      { text: t("cancel"), style: "cancel" },
      { text: t("confirm"), style: "destructive", onPress: async () => {
        try {
          await apiRequest("DELETE", `/api/groups/${groupId}`);
          loadAll();
        } catch { showToast(t("error")); }
      }},
    ]);
  };

  const handleGroupInvite = async (groupId: string) => {
    const uname = inviteUsername.trim();
    if (!uname) return;
    try {
      await apiRequest("POST", `/api/groups/${groupId}/invite`, { username: uname });
      setInviteUsername("");
      setInviteGroupId(null);
      showToast(t("requestSent"));
      loadAll();
    } catch (err: any) {
      const msg = (err?.message || "").toLowerCase();
      if (msg.includes("not found")) showToast(t("userNotFound"));
      else if (msg.includes("already")) showToast(t("alreadyConnectedMsg"));
      else if (msg.includes("yourself")) showToast(t("cannotAddSelfMsg"));
      else showToast(t("error"));
    }
  };

  const handleGroupInviteRespond = async (memberId: string, accept: boolean) => {
    try {
      await apiRequest("POST", "/api/groups/invites/respond", { memberId, accept });
      loadAll();
      refreshPendingCount();
    } catch { showToast(t("error")); }
  };

  const handleGroupNudge = async (groupId: string) => {
    try {
      const res = await apiRequest("POST", `/api/groups/${groupId}/nudge`, {});
      const data = await res.json();
      showToast(`${data.sent}${t("groupNudgeSent" as any)}`);
    } catch { showToast(t("error")); }
  };

  const handleRemoveGroupMember = async (groupId: string, memberId: string) => {
    try {
      await apiRequest("DELETE", `/api/groups/${groupId}/members/${memberId}`);
      loadAll();
    } catch { showToast(t("error")); }
  };

  const getTimezoneLabel = (tz: string): string => {
    if (tz === "Asia/Seoul") return "KST";
    if (tz.includes("America/New_York")) return "EST";
    if (tz.includes("America/Los_Angeles")) return "PST";
    if (tz.includes("Europe/London")) return "GMT";
    return tz.split("/").pop() || tz;
  };

  const formatTime = (iso: string): string => {
    try {
      const d = new Date(iso);
      const h = d.getHours().toString().padStart(2, "0");
      const m = d.getMinutes().toString().padStart(2, "0");
      return `${h}:${m}`;
    } catch {
      return "";
    }
  };

  const fallbackMessage = (n: NudgeData): string => {
    if (n.message) return n.message;
    if (n.type === "praise" || n.type === "thumbsup") return t("nudgePraise");
    if (n.type === "reminder" || n.type === "pill") return t("nudgeReminder");
    if (n.type === "heart") return "❤️";
    return "⏰";
  };

  const accepted = connections.filter(c => c.status === "accepted");
  const incoming = connections.filter(c => c.status === "pending" && !c.isRequester);
  const outgoing = connections.filter(c => c.status === "pending" && c.isRequester);

  const sortedFriends = [...accepted].sort((a, b) => {
    const oa = a.isRequester ? a.target.id : a.requester.id;
    const ob = b.isRequester ? b.target.id : b.requester.id;
    const sa = summaries[oa];
    const sb = summaries[ob];
    if (!sa && !sb) return 0;
    if (!sa) return 1;
    if (!sb) return -1;
    if (sa.missed !== sb.missed) return sb.missed - sa.missed;
    return (sa.completed / (sa.total || 1)) - (sb.completed / (sb.total || 1));
  });

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("togetherView")}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 + webBottomInset }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />
        }
      >
        <View style={styles.idCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.idLabel}>{t("myId")}</Text>
            {editingId ? (
              <TextInput
                style={styles.idInput}
                value={idInput}
                onChangeText={setIdInput}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                editable={!savingId}
                testID="edit-id-input"
              />
            ) : (
              <Text style={styles.idValue} testID="my-id-value">{user?.username || "-"}</Text>
            )}
            <Text style={styles.idDesc}>{t("myIdDesc")}</Text>
          </View>
          {editingId ? (
            <View style={styles.idEditActions}>
              <Pressable
                style={({ pressed }) => [styles.copyIdBtn, pressed && { opacity: 0.85 }]}
                onPress={handleSaveId}
                disabled={savingId}
                testID="save-id-button"
              >
                {savingId ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                    <Text style={styles.copyIdBtnText}>{t("save")}</Text>
                  </>
                )}
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.idCancelBtn, pressed && { opacity: 0.85 }]}
                onPress={() => setEditingId(false)}
                disabled={savingId}
              >
                <Text style={styles.idCancelBtnText}>{t("cancel")}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.idEditActions}>
              <Pressable
                style={({ pressed }) => [styles.copyIdBtn, pressed && { opacity: 0.85 }]}
                onPress={handleCopyId}
                testID="copy-id-button"
              >
                <Ionicons name="copy-outline" size={16} color="#fff" />
                <Text style={styles.copyIdBtnText}>{t("copyId")}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.idEditBtn, pressed && { opacity: 0.85 }]}
                onPress={startEditId}
                testID="edit-id-button"
              >
                <Ionicons name="pencil" size={14} color={Colors.primary} />
                <Text style={styles.idEditBtnText}>{t("editId")}</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.addCard}>
          <Text style={styles.addTitle}>{t("addFriend")}</Text>
          <Text style={styles.addDesc}>{t("addFriendDesc")}</Text>
          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput}
              placeholder={t("friendIdPlaceholder")}
              placeholderTextColor={Colors.textTertiary}
              value={friendId}
              onChangeText={setFriendId}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleSendRequest}
              returnKeyType="send"
              testID="friend-id-input"
            />
            <Pressable
              style={({ pressed }) => [
                styles.sendBtn,
                (!friendId.trim() || sending) && styles.sendBtnDisabled,
                pressed && { opacity: 0.85 },
              ]}
              onPress={handleSendRequest}
              disabled={!friendId.trim() || sending}
              testID="send-request-button"
            >
              {sending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="person-add" size={18} color="#fff" />}
            </Pressable>
          </View>
        </View>

        {incoming.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="notifications" size={16} color={Colors.warning} />
              <Text style={styles.sectionTitle}>{t("incomingRequests")}</Text>
              <View style={styles.badge}><Text style={styles.badgeText}>{incoming.length}</Text></View>
            </View>
            {incoming.map(conn => (
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
                    <Text style={styles.requestDesc}>{conn.requester.displayName}{t("wantsToConnect")}</Text>
                  </View>
                </View>
                <View style={styles.requestActions}>
                  <Pressable style={({ pressed }) => [styles.rejectBtn, pressed && { opacity: 0.8 }]} onPress={() => handleRespond(conn.id, false)}>
                    <Text style={styles.rejectBtnText}>{t("reject")}</Text>
                  </Pressable>
                  <Pressable style={({ pressed }) => [styles.approveBtn, pressed && { opacity: 0.8 }]} onPress={() => handleRespond(conn.id, true)} testID={`approve-${conn.id}`}>
                    <Text style={styles.approveBtnText}>{t("approve")}</Text>
                  </Pressable>
                </View>
              </Animated.View>
            ))}
          </View>
        )}

        {messages.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="chatbubble-ellipses" size={16} color={Colors.primary} />
              <Text style={styles.sectionTitle}>{t("receivedMessages")}</Text>
            </View>
            {messages.slice(0, 8).map(n => {
              const isPraise = n.type === "praise" || n.type === "heart" || n.type === "thumbsup";
              return (
                <View key={n.id} style={styles.messageCard}>
                  <View style={[styles.msgAvatar, { backgroundColor: isPraise ? Colors.successBg : Colors.warningBg }]}>
                    <Text style={styles.msgAvatarText}>{n.fromUser.displayName.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.msgFrom}>
                      {n.fromUser.displayName}
                      {n.medicationName ? <Text style={styles.msgMed}>{` · ${n.medicationName}`}</Text> : null}
                    </Text>
                    <Text style={styles.msgText}>{fallbackMessage(n)}</Text>
                  </View>
                  <Text style={styles.msgTime}>{formatTime(n.createdAt)}</Text>
                </View>
              );
            })}
          </View>
        )}

        {sortedFriends.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="people" size={16} color={Colors.primary} />
              <Text style={styles.sectionTitle}>{t("friends")}</Text>
            </View>
            {sortedFriends.map((conn, index) => {
              const other = conn.isRequester ? conn.target : conn.requester;
              const displayName = conn.nickname || other.displayName;
              const tzLabel = getTimezoneLabel(other.timezone);
              const summary = summaries[other.id];
              const progress = summary && summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;
              const statusColor = summary
                ? summary.missed > 0 ? Colors.danger : summary.pending > 0 ? Colors.warning : Colors.success
                : Colors.textTertiary;
              const isCollapsed = collapsed[conn.id];

              return (
                <Animated.View
                  key={conn.id}
                  entering={Platform.OS !== "web" ? FadeInDown.delay(index * 60).springify() : undefined}
                  style={styles.personCard}
                  testID="friend-card"
                >
                  <View style={styles.personHeader}>
                    <View style={styles.personInfo}>
                      <View style={[styles.avatar, { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] + "20" }]}>
                        <Text style={styles.avatarText}>{displayName.charAt(0)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={styles.personName}>{displayName}</Text>
                          {summary?.streak ? (
                            <View style={styles.friendStreak}>
                              <Text style={styles.friendStreakText}>🔥 {summary.streak}</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.personTz}>{other.displayName} · {tzLabel}</Text>
                      </View>
                    </View>
                    <Pressable onPress={() => handleRemove(conn.id, displayName)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
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
                          <Text style={styles.statLabel}>{t("caregiverCompleted")}</Text>
                        </View>
                        <View style={styles.statItem}>
                          <Text style={[styles.statValue, { color: Colors.warning }]}>{summary.pending}</Text>
                          <Text style={styles.statLabel}>{t("caregiverPending")}</Text>
                        </View>
                        <View style={styles.statItem}>
                          <Text style={[styles.statValue, { color: Colors.danger }]}>{summary.missed}</Text>
                          <Text style={styles.statLabel}>{t("caregiverMissed")}</Text>
                        </View>
                      </View>

                      {summary.items.length > 0 && (
                        <>
                          <Pressable
                            style={styles.toggleRow}
                            onPress={() => setCollapsed(prev => ({ ...prev, [conn.id]: !prev[conn.id] }))}
                          >
                            <Text style={styles.toggleText}>{isCollapsed ? t("viewPills") : t("hidePills")}</Text>
                            <Ionicons name={isCollapsed ? "chevron-down" : "chevron-up"} size={16} color={Colors.textSecondary} />
                          </Pressable>

                          {!isCollapsed && (
                            <View style={styles.pillList}>
                              {summary.items.map(item => (
                                <View key={`${item.medicationId}-${item.scheduledTime}`} style={styles.pillRow}>
                                  <View style={[styles.pillDot, { backgroundColor: item.color }]} />
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.pillName} numberOfLines={1}>{item.name}</Text>
                                    <Text style={styles.pillTime}>{item.scheduledTime}</Text>
                                  </View>
                                  <View style={[
                                    styles.statusChip,
                                    { backgroundColor: item.taken ? Colors.successBg : item.status === "missed" ? Colors.dangerBg : Colors.surfaceSecondary },
                                  ]}>
                                    <Text style={[
                                      styles.statusChipText,
                                      { color: item.taken ? Colors.success : item.status === "missed" ? Colors.danger : Colors.textSecondary },
                                    ]}>
                                      {item.taken ? t("pillTaken") : t("pillNotTaken")}
                                    </Text>
                                  </View>
                                  <Pressable
                                    style={({ pressed }) => [
                                      styles.msgBtn,
                                      { backgroundColor: item.taken ? Colors.success : Colors.warning },
                                      pressed && { opacity: 0.85 },
                                    ]}
                                    onPress={() => handlePillMessage(other.id, item)}
                                    testID={`pill-msg-${item.medicationId}`}
                                  >
                                    <Text style={styles.msgBtnText}>
                                      {item.taken ? `👏 ${t("sendGoodJob")}` : `💊 ${t("sendDontForget")}`}
                                    </Text>
                                  </Pressable>
                                </View>
                              ))}
                            </View>
                          )}
                        </>
                      )}
                    </>
                  )}
                </Animated.View>
              );
            })}
          </View>
        )}

        {outgoing.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="paper-plane-outline" size={16} color={Colors.textSecondary} />
              <Text style={[styles.sectionTitle, { color: Colors.textSecondary }]}>{t("outgoingRequests")}</Text>
            </View>
            {outgoing.map(conn => (
              <View key={conn.id} style={styles.pendingCard}>
                <View style={styles.personInfo}>
                  <View style={[styles.avatarSmall, { backgroundColor: Colors.surfaceSecondary }]}>
                    <Ionicons name="hourglass-outline" size={16} color={Colors.textTertiary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pendingName}>{conn.target.displayName}</Text>
                    <Text style={styles.pendingStatus}>{t("waitingApproval")}</Text>
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.cancelReqBtn, pressed && { opacity: 0.8 }]}
                    onPress={() => handleRemove(conn.id, conn.target.displayName)}
                  >
                    <Text style={styles.cancelReqText}>{t("cancelRequest")}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {groupPendingInvites.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="mail-unread" size={16} color={Colors.warning} />
              <Text style={styles.sectionTitle}>{t("groupInvites" as any)}</Text>
              <View style={styles.badge}><Text style={styles.badgeText}>{groupPendingInvites.length}</Text></View>
            </View>
            {groupPendingInvites.map(inv => (
              <View key={inv.id} style={styles.requestCard}>
                <View style={{ marginBottom: 8 }}>
                  <Text style={styles.requestName}>{inv.groupName}</Text>
                  <Text style={styles.requestDesc}>{inv.inviterName}{t("groupInvitedYou" as any)}</Text>
                </View>
                <View style={styles.requestActions}>
                  <Pressable style={({ pressed }) => [styles.rejectBtn, pressed && { opacity: 0.8 }]} onPress={() => handleGroupInviteRespond(inv.id, false)}>
                    <Text style={styles.rejectBtnText}>{t("reject")}</Text>
                  </Pressable>
                  <Pressable style={({ pressed }) => [styles.approveBtn, pressed && { opacity: 0.8 }]} onPress={() => handleGroupInviteRespond(inv.id, true)}>
                    <Text style={styles.approveBtnText}>{t("approve")}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {groups.filter(g => g.members.some(m => m.userId === user?.id && m.status === "accepted")).length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="people-circle" size={16} color={Colors.primary} />
              <Text style={styles.sectionTitle}>{t("myGroups" as any)}</Text>
            </View>
            {groups.filter(g => g.members.some(m => m.userId === user?.id && m.status === "accepted")).map(group => {
              const dash = groupDashboards[group.id];
              const isExpanded = !collapsed[`group-${group.id}`];
              return (
                <View key={group.id} style={styles.personCard}>
                  <Pressable
                    style={styles.personHeader}
                    onPress={() => setCollapsed(prev => ({ ...prev, [`group-${group.id}`]: !prev[`group-${group.id}`] }))}
                  >
                    <View style={styles.personInfo}>
                      <View style={[styles.avatar, { backgroundColor: Colors.primaryBg }]}>
                        <Ionicons name="people" size={20} color={Colors.primary} />
                      </View>
                      <View>
                        <Text style={styles.personName}>{group.name}</Text>
                        <Text style={styles.personTz}>{group.members.filter(m => m.status === "accepted").length} {t("member" as any)}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                      {group.isAdmin && (
                        <Pressable onPress={() => handleDeleteGroup(group.id, group.name)} hitSlop={10}>
                          <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                        </Pressable>
                      )}
                      <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={Colors.textTertiary} />
                    </View>
                  </Pressable>

                  {isExpanded && dash && (
                    <>
                      {dash.members.map(m => {
                        const memberProgress = m.summary.total > 0 ? Math.round((m.summary.completed / m.summary.total) * 100) : 0;
                        const statusColor = m.summary.missed > 0 ? Colors.danger : m.summary.pending > 0 ? Colors.warning : Colors.success;
                        return (
                          <View key={m.userId} style={styles.groupMemberRow}>
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <Text style={styles.pillName}>{m.displayName}</Text>
                                {m.summary.streak > 0 && (
                                  <View style={styles.friendStreak}>
                                    <Text style={styles.friendStreakText}>🔥 {m.summary.streak}</Text>
                                  </View>
                                )}
                              </View>
                              <View style={[styles.progressRow, { marginTop: 4 }]}>
                                <View style={styles.progressBarBg}>
                                  <View style={[styles.progressBarFill, { width: `${memberProgress}%` as any, backgroundColor: statusColor }]} />
                                </View>
                                <Text style={[styles.progressPercent, { color: statusColor }]}>{memberProgress}%</Text>
                              </View>
                            </View>
                            {group.isAdmin && m.userId !== user?.id && (
                              <Pressable
                                onPress={() => {
                                  const mem = group.members.find(gm => gm.userId === m.userId);
                                  if (mem) handleRemoveGroupMember(group.id, mem.id);
                                }}
                                hitSlop={10}
                              >
                                <Ionicons name="close-circle-outline" size={18} color={Colors.textTertiary} />
                              </Pressable>
                            )}
                          </View>
                        );
                      })}
                      <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                        {group.isAdmin && (
                          <Pressable
                            style={({ pressed }) => [styles.groupActionBtn, pressed && { opacity: 0.85 }]}
                            onPress={() => setInviteGroupId(inviteGroupId === group.id ? null : group.id)}
                          >
                            <Ionicons name="person-add-outline" size={14} color={Colors.primary} />
                            <Text style={styles.groupActionText}>{t("inviteToGroup" as any)}</Text>
                          </Pressable>
                        )}
                        <Pressable
                          style={({ pressed }) => [styles.groupActionBtn, { backgroundColor: Colors.warningBg }, pressed && { opacity: 0.85 }]}
                          onPress={() => handleGroupNudge(group.id)}
                        >
                          <Ionicons name="megaphone-outline" size={14} color={Colors.warning} />
                          <Text style={[styles.groupActionText, { color: Colors.warning }]}>{t("groupNudgeAll" as any)}</Text>
                        </Pressable>
                      </View>
                      {inviteGroupId === group.id && (
                        <View style={styles.addRow}>
                          <TextInput
                            style={styles.addInput}
                            placeholder={t("friendIdPlaceholder")}
                            placeholderTextColor={Colors.textTertiary}
                            value={inviteUsername}
                            onChangeText={setInviteUsername}
                            autoCapitalize="none"
                            autoCorrect={false}
                            onSubmitEditing={() => handleGroupInvite(group.id)}
                            returnKeyType="send"
                          />
                          <Pressable
                            style={({ pressed }) => [styles.sendBtn, !inviteUsername.trim() && styles.sendBtnDisabled, pressed && { opacity: 0.85 }]}
                            onPress={() => handleGroupInvite(group.id)}
                            disabled={!inviteUsername.trim()}
                          >
                            <Ionicons name="person-add" size={18} color="#fff" />
                          </Pressable>
                        </View>
                      )}
                    </>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.addCard}>
          <Text style={styles.addTitle}>{t("createGroup" as any)}</Text>
          <Text style={styles.addDesc}>{t("noGroupsDesc" as any)}</Text>
          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput}
              placeholder={t("groupNamePlaceholder" as any)}
              placeholderTextColor={Colors.textTertiary}
              value={newGroupName}
              onChangeText={setNewGroupName}
              onSubmitEditing={handleCreateGroup}
              returnKeyType="done"
            />
            <Pressable
              style={({ pressed }) => [styles.sendBtn, (!newGroupName.trim() || creatingGroup) && styles.sendBtnDisabled, pressed && { opacity: 0.85 }]}
              onPress={handleCreateGroup}
              disabled={!newGroupName.trim() || creatingGroup}
            >
              {creatingGroup
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="add" size={18} color="#fff" />}
            </Pressable>
          </View>
        </View>

        {connections.length === 0 && messages.length === 0 && groups.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="people-outline" size={56} color={Colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>{t("noConnectionsYet")}</Text>
            <Text style={styles.emptySubtitle}>{t("addFriendDesc")}</Text>
          </View>
        )}

        <View style={styles.settingsSection}>
          <Text style={styles.settingsHeader}>{t("settings")}</Text>
          {user && (
            <View style={styles.profileRow}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>{user.displayName.charAt(0)}</Text>
              </View>
              <View>
                <Text style={styles.profileName}>{user.displayName}</Text>
                <Text style={styles.profileUsername}>@{user.username}</Text>
              </View>
            </View>
          )}
          <Pressable
            style={styles.settingsItem}
            onPress={() => setLanguage(language === "ko" ? "en" : "ko")}
            testID="language-toggle"
          >
            <Ionicons name="globe-outline" size={20} color={Colors.textSecondary} />
            <Text style={styles.settingsItemText}>{t("language")}</Text>
            <Text style={styles.settingsItemValue}>{language === "ko" ? "한국어" : "English"}</Text>
          </Pressable>
          <Pressable style={styles.settingsItem} onPress={() => logout()} testID="logout-button">
            <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
            <Text style={[styles.settingsItemText, { color: Colors.danger }]}>{t("logout")}</Text>
          </Pressable>
        </View>
      </ScrollView>

      {toast && (
        <Animated.View
          entering={Platform.OS !== "web" ? FadeIn.duration(150) : undefined}
          style={[styles.toast, { bottom: insets.bottom + 100 + webBottomInset }]}
          pointerEvents="none"
        >
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  title: { fontFamily: "Inter_700Bold", fontSize: 22, color: Colors.text },
  scrollContent: { paddingHorizontal: 20, gap: 16 },

  idCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.primary, borderRadius: 16, padding: 18,
  },
  idLabel: { fontFamily: "Inter_500Medium", fontSize: 12, color: "#FFFFFFCC" },
  idValue: { fontFamily: "Inter_700Bold", fontSize: 24, color: "#FFFFFF", marginTop: 2, letterSpacing: 0.5 },
  idDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: "#FFFFFFCC", marginTop: 4 },
  copyIdBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#FFFFFF33", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
  },
  copyIdBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 12 },
  idEditActions: { gap: 8, alignItems: "flex-end" },
  idEditBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#FFFFFF", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
  },
  idEditBtnText: { color: Colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 12 },
  idCancelBtn: {
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: "#FFFFFF22",
  },
  idCancelBtnText: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 12 },
  idInput: {
    backgroundColor: "#FFFFFF", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.text, marginVertical: 4,
  },

  settingsSection: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginTop: 8, gap: 4,
  },
  settingsHeader: {
    fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.textSecondary,
    marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5,
  },
  profileRow: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border, marginBottom: 4,
  },
  profileAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  profileAvatarText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 18 },
  profileName: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.text },
  profileUsername: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary },
  settingsItem: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12,
  },
  settingsItemText: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 15, color: Colors.text },
  settingsItemValue: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textSecondary },

  addCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16, gap: 4,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  addTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.text },
  addDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginBottom: 8 },
  addRow: { flexDirection: "row", gap: 8 },
  addInput: {
    flex: 1, backgroundColor: Colors.surfaceSecondary, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    fontFamily: "Inter_500Medium", color: Colors.text,
  },
  sendBtn: {
    width: 48, borderRadius: 10, backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.5 },

  section: { gap: 8 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.text, flex: 1 },
  badge: { backgroundColor: Colors.warning, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontFamily: "Inter_700Bold", fontSize: 11, color: "#FFF" },

  requestCard: {
    backgroundColor: Colors.warningBg, borderRadius: 14, padding: 14, gap: 10,
    borderWidth: 1, borderColor: Colors.warning + "30",
  },
  requestInfo: { flexDirection: "row", alignItems: "center", gap: 10 },
  requestName: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.text },
  requestDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  requestActions: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  rejectBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.surface },
  rejectBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.textSecondary },
  approveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.primary },
  approveBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#FFF" },

  messageCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.surface, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  msgAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  msgAvatarText: { fontFamily: "Inter_700Bold", fontSize: 14, color: Colors.text },
  msgFrom: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.text },
  msgMed: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.textSecondary },
  msgText: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  msgTime: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textTertiary },

  personCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: Colors.borderLight, gap: 10,
  },
  personHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  personInfo: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.text },
  avatarSmall: {
    width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.primaryBg,
  },
  avatarSmallText: { fontFamily: "Inter_700Bold", fontSize: 14, color: Colors.text },
  personName: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.text },
  personTz: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textTertiary, marginTop: 1 },

  progressRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  progressBarBg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: Colors.borderLight, overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: 3 },
  progressPercent: { fontFamily: "Inter_700Bold", fontSize: 13, minWidth: 36, textAlign: "right" },

  statsRow: { flexDirection: "row", gap: 6 },
  statItem: { flex: 1, alignItems: "center", backgroundColor: "#f8f9fa", borderRadius: 8, paddingVertical: 8 },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 20 },
  statLabel: { fontFamily: "Inter_400Regular", fontSize: 10, color: Colors.textSecondary, marginTop: 1 },

  toggleRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
    paddingVertical: 6, borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  toggleText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.textSecondary },

  pillList: { gap: 8 },
  pillRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#f8f9fa", borderRadius: 10, padding: 10,
  },
  pillDot: { width: 10, height: 10, borderRadius: 5 },
  pillName: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },
  pillTime: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textTertiary, marginTop: 1 },
  statusChip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusChipText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  msgBtn: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  msgBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#fff" },

  pendingCard: {
    backgroundColor: Colors.surfaceSecondary, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  pendingName: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },
  pendingStatus: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textTertiary },
  cancelReqBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.surface },
  cancelReqText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.textSecondary },

  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 8 },
  emptyIconContainer: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 20, color: Colors.text },
  emptySubtitle: {
    fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textSecondary,
    textAlign: "center", paddingHorizontal: 40,
  },

  friendStreak: {
    backgroundColor: "#FEF3C7", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
  },
  friendStreakText: { fontFamily: "Inter_700Bold", fontSize: 11, color: "#D97706" },
  groupMemberRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#f8f9fa", borderRadius: 10, padding: 10,
  },
  groupActionBtn: {
    flexDirection: "row", alignItems: "center", gap: 4, flex: 1,
    backgroundColor: Colors.primaryBg, borderRadius: 10, paddingVertical: 8, justifyContent: "center",
  },
  groupActionText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.primary },

  toast: {
    position: "absolute", left: 40, right: 40,
    backgroundColor: Colors.text, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16,
    alignItems: "center",
  },
  toastText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#fff" },
});
