import { StyleSheet, Text, View, FlatList, Pressable, Platform, Alert, SectionList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Colors from "@/constants/colors";
import { useMedications, ScheduleItem, TimeBlock, getDoseStatus, DoseStatus } from "@/contexts/MedicationContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { translateScheduleLabel } from "@/lib/schedule-label";
import { getApiUrl } from "@/lib/query-client";
import { fetch as expoFetch } from "expo/fetch";

const BLOCK_ICONS: Record<TimeBlock, keyof typeof Ionicons.glyphMap> = {
  morning: "sunny",
  afternoon: "partly-sunny",
  evening: "moon",
  bedtime: "bed",
};

const BLOCK_COLORS: Record<TimeBlock, string> = {
  morning: "#F59E0B",
  afternoon: "#3B82F6",
  evening: "#8B5CF6",
  bedtime: "#6366F1",
};

const STATUS_CONFIG: Record<DoseStatus, { bg: string; text: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  taken: { bg: Colors.successBg, text: Colors.success, icon: "checkmark-circle", color: Colors.success },
  pending: { bg: Colors.surfaceSecondary, text: Colors.textSecondary, icon: "ellipse-outline", color: Colors.textTertiary },
  overdue: { bg: Colors.warningBg, text: Colors.warning, icon: "alert-circle", color: Colors.warning },
  duplicate: { bg: Colors.dangerBg, text: Colors.danger, icon: "warning", color: Colors.danger },
};

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

function formatActualTime(isoString: string): string {
  const d = new Date(isoString);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayHour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function getCurrentBlock(): TimeBlock {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 21) return 'evening';
  return 'bedtime';
}

interface UndoState {
  logId: string;
  medName: string;
  timer: ReturnType<typeof setTimeout>;
}

function UndoSnackbar({ medName, onUndo, onDismiss }: { medName: string; onUndo: () => void; onDismiss: () => void }) {
  const { t } = useLanguage();

  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.snackbar}>
      <View style={styles.snackbarContent}>
        <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
        <Text style={styles.snackbarText} numberOfLines={1}>
          {medName} - {t('doseTaken')}
        </Text>
      </View>
      <Pressable onPress={onUndo} style={styles.snackbarAction}>
        <Text style={styles.snackbarActionText}>{t('undoAction')}</Text>
      </Pressable>
    </Animated.View>
  );
}

function MedicationCard({ item, onQuickLog, onUndoTaken, isDuplicate }: {
  item: ScheduleItem;
  onQuickLog: (item: ScheduleItem) => void;
  onUndoTaken: (item: ScheduleItem) => void;
  isDuplicate: boolean;
}) {
  const { t } = useLanguage();
  const { getLastTakenTime } = useMedications();
  const rawStatus = getDoseStatus(item.scheduledTime, item.taken);
  const status: DoseStatus = item.taken && isDuplicate ? 'duplicate' : rawStatus;
  const config = STATUS_CONFIG[status];
  const lastTaken = getLastTakenTime(item.medication.id);

  const unitLabel = item.medication.dosageUnit === 'custom' ? (item.medication.customUnit || '') : t('tablet');
  const dosageInfo = item.medication.dosageAmount
    ? `${item.medication.dosageAmount} ${unitLabel}`
    : '';

  const displayTime = translateScheduleLabel(item.timeEntry, t) || formatTime(item.scheduledTime);
  const mealLabel = item.timeEntry?.mealTiming === 'before' ? t('beforeMeal')
    : item.timeEntry?.mealTiming === 'after' ? t('afterMeal')
    : item.timeEntry?.mealTiming === 'during' ? t('duringMeal')
    : null;

  const actionLabel = status === 'overdue' ? t('takeNowAction') : t('takeNow');

  return (
    <Pressable
      onPress={() => {
        if (item.taken) onUndoTaken(item);
      }}
      style={({ pressed }) => [
        styles.medCard,
        { borderLeftColor: item.medication.color, borderLeftWidth: 4 },
        item.taken && styles.medCardTaken,
        pressed && item.taken && { opacity: 0.7 },
      ]}
    >
      <View style={styles.cardRow}>
        <View style={[styles.medColorDot, { backgroundColor: item.medication.color }]} />
        <View style={styles.cardInfo}>
          <View style={styles.cardNameRow}>
            <Text style={[styles.medName, item.taken && styles.medNameTaken]} numberOfLines={1}>
              {item.medication.name}
            </Text>
            {dosageInfo ? <Text style={styles.dosageInline}>{dosageInfo}</Text> : null}
            {mealLabel && <Text style={styles.mealInline}>{mealLabel}</Text>}
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={12} color={Colors.textTertiary} />
            <Text style={styles.detailText}>{displayTime}</Text>
            {lastTaken && item.taken && (
              <>
                <Text style={styles.detailDot}>·</Text>
                <Ionicons name="checkmark" size={12} color={Colors.success} />
                <Text style={[styles.detailText, { color: Colors.success }]}>
                  {formatActualTime(lastTaken)}
                </Text>
              </>
            )}
          </View>
        </View>

        {item.taken ? (
          <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
            <Ionicons name={config.icon} size={14} color={config.color} />
          </View>
        ) : (
          <Pressable
            onPress={() => onQuickLog(item)}
            style={({ pressed }) => [
              styles.takeButton,
              status === 'overdue' && styles.takeButtonOverdue,
              pressed && { transform: [{ scale: 0.95 }], opacity: 0.9 },
            ]}
          >
            <Ionicons
              name={status === 'overdue' ? "alert-circle" : "checkmark-circle"}
              size={16}
              color="#FFF"
            />
            <Text style={styles.takeButtonText}>{actionLabel}</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

function TimeBlockSection({ block, items, onQuickLog, onUndoTaken, onBulkLog, index, doseLogs, isCurrentBlock }: {
  block: TimeBlock;
  items: ScheduleItem[];
  onQuickLog: (item: ScheduleItem) => void;
  onUndoTaken: (item: ScheduleItem) => void;
  onBulkLog: (items: ScheduleItem[]) => void;
  index: number;
  doseLogs: any[];
  isCurrentBlock: boolean;
}) {
  const { t } = useLanguage();
  const blockLabels: Record<TimeBlock, string> = {
    morning: t('morningBlock'),
    afternoon: t('afternoonBlock'),
    evening: t('eveningBlock'),
    bedtime: t('bedtimeBlock'),
  };

  const completedCount = items.filter(i => i.taken).length;
  const allDone = completedCount === items.length;
  const pendingItems = items.filter(i => !i.taken);
  const today = new Date().toISOString().split('T')[0];

  return (
    <Animated.View
      entering={Platform.OS !== "web" ? FadeInDown.delay(index * 80).springify() : undefined}
      style={[styles.blockSection, isCurrentBlock && styles.blockSectionCurrent]}
    >
      <View style={styles.blockHeader}>
        <View style={styles.blockTitleRow}>
          <View style={[
            styles.blockIconContainer,
            { backgroundColor: BLOCK_COLORS[block] + "15" },
            isCurrentBlock && { backgroundColor: BLOCK_COLORS[block] + "25" },
          ]}>
            <Ionicons name={BLOCK_ICONS[block]} size={16} color={BLOCK_COLORS[block]} />
          </View>
          <Text style={[styles.blockTitle, isCurrentBlock && { color: BLOCK_COLORS[block] }]}>
            {blockLabels[block]}
          </Text>
          {isCurrentBlock && <View style={styles.currentDot} />}
        </View>
        <View style={[styles.blockCountBadge, allDone && styles.blockCountDone]}>
          <Text style={[styles.blockCountText, allDone && styles.blockCountTextDone]}>
            {completedCount}/{items.length}
          </Text>
          {allDone && <Ionicons name="checkmark" size={12} color={Colors.success} />}
        </View>
      </View>
      {items.map((item) => {
        const duplicateCount = doseLogs.filter(
          l => l.date === today && l.medicationId === item.medication.id && l.scheduledTime === item.scheduledTime
        ).length;
        return (
          <MedicationCard
            key={`${item.medication.id}-${item.scheduledTime}`}
            item={item}
            onQuickLog={onQuickLog}
            onUndoTaken={onUndoTaken}
            isDuplicate={duplicateCount > 1}
          />
        );
      })}
      {pendingItems.length > 1 && (
        <Pressable
          onPress={() => onBulkLog(pendingItems)}
          style={({ pressed }) => [
            styles.bulkButton,
            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Ionicons name="checkmark-done" size={16} color={Colors.primary} />
          <Text style={styles.bulkButtonText}>{t('bulkCheckIn')}</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const { medications, doseLogs, getTodaySchedule, getTodayScheduleByBlock, quickLogDose, undoDose, isDuplicateDose } = useMedications();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const [streak, setStreak] = useState(0);

  const fetchStreak = useCallback(async () => {
    if (!user) return;
    try {
      const baseUrl = getApiUrl();
      const res = await expoFetch(new URL(`/api/summary/${user.id}`, baseUrl).toString(), { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setStreak(data.streak || 0);
      }
    } catch {}
  }, [user]);

  useEffect(() => { fetchStreak(); }, [fetchStreak]);

  const MILESTONES = [100, 60, 30, 14, 7] as const;
  const milestoneKeys: Record<number, string> = {
    7: 'streakMilestone7', 14: 'streakMilestone14', 30: 'streakMilestone30',
    60: 'streakMilestone60', 100: 'streakMilestone100',
  };

  const checkMilestone = useCallback((newStreak: number) => {
    for (const m of MILESTONES) {
      if (newStreak === m) {
        Alert.alert(t('streakMilestoneTitle' as any), t(milestoneKeys[m] as any));
        break;
      }
    }
  }, [t]);

  const schedule = getTodaySchedule();
  const blockSchedule = getTodayScheduleByBlock();
  const taken = schedule.filter(s => s.taken).length;
  const total = schedule.length;
  const remaining = total - taken;
  const progress = total === 0 ? 0 : Math.round((taken / total) * 100);
  const currentBlock = getCurrentBlock();

  const now = new Date();
  const hour = now.getHours();
  const isStart = taken === 0 && total > 0;
  const greeting = isStart
    ? t('friendlyStart')
    : t('greeting');
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const medProgress = useMemo(() => {
    const medMap: Record<string, { name: string; taken: number; total: number; color: string }> = {};
    for (const s of schedule) {
      const id = s.medication.id;
      if (!medMap[id]) {
        medMap[id] = { name: s.medication.name, taken: 0, total: 0, color: s.medication.color };
      }
      medMap[id].total++;
      if (s.taken) medMap[id].taken++;
    }
    return Object.values(medMap);
  }, [schedule]);

  const handleQuickLog = useCallback(async (item: ScheduleItem) => {
    if (isDuplicateDose(item.medication.id, item.scheduledTime)) {
      const displayTime = translateScheduleLabel(item.timeEntry, t) || formatTime(item.scheduledTime);
      Alert.alert(
        t('duplicateWarning'),
        `${item.medication.name} (${displayTime})\n\n${t('duplicateMessage')}`,
        [
          { text: t('cancel'), style: "cancel" },
          {
            text: t('duplicateOverride'),
            style: "destructive",
            onPress: async () => {
              await doQuickLog(item);
            },
          },
        ]
      );
      return;
    }
    await doQuickLog(item);
  }, [isDuplicateDose, quickLogDose, undoDose, t]);

  const doQuickLog = useCallback(async (item: ScheduleItem) => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (undoState) {
      clearTimeout(undoState.timer);
      setUndoState(null);
    }

    const log = await quickLogDose(item.medication.id, item.scheduledTime);
    const timer = setTimeout(() => setUndoState(null), 5000);
    setUndoState({ logId: log.id, medName: item.medication.name, timer });

    setTimeout(async () => {
      if (!user) return;
      try {
        const baseUrl = getApiUrl();
        const res = await expoFetch(new URL(`/api/summary/${user.id}`, baseUrl).toString(), { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const newStreak = data.streak || 0;
          setStreak(newStreak);
          checkMilestone(newStreak);
        }
      } catch {}
    }, 500);
  }, [quickLogDose, undoState, fetchStreak, checkMilestone]);

  const handleUndoTaken = useCallback(async (item: ScheduleItem) => {
    Alert.alert(
      t('undoTakenTitle'),
      t('undoTakenMessage'),
      [
        { text: t('cancel'), style: "cancel" },
        {
          text: t('confirm'),
          onPress: async () => {
            const today = new Date().toISOString().split('T')[0];
            const log = doseLogs.find(
              l => l.date === today && l.medicationId === item.medication.id && l.scheduledTime === item.scheduledTime
            );
            if (log) {
              await undoDose(log.id);
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          },
        },
      ]
    );
  }, [doseLogs, undoDose, t]);

  const handleUndo = useCallback(async () => {
    if (!undoState) return;
    clearTimeout(undoState.timer);
    await undoDose(undoState.logId);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setUndoState(null);
  }, [undoState, undoDose]);

  const handleBulkLog = useCallback(async (pendingItems: ScheduleItem[]) => {
    Alert.alert(
      t('bulkCheckIn'),
      t('bulkCheckInConfirm'),
      [
        { text: t('cancel'), style: "cancel" },
        {
          text: t('confirm'),
          onPress: async () => {
            if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            for (const item of pendingItems) {
              await quickLogDose(item.medication.id, item.scheduledTime);
            }
          },
        },
      ]
    );
  }, [quickLogDose, t]);

  const blockOrder: TimeBlock[] = ['morning', 'afternoon', 'evening', 'bedtime'];
  const activeBlocks = blockOrder.filter(b => blockSchedule[b].length > 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{greeting}</Text>
        </View>
        {streak > 0 && (
          <View style={styles.streakBadge}>
            <Text style={styles.streakIcon}>🔥</Text>
            <Text style={styles.streakText}>{streak}{t('streakDays' as any)}</Text>
          </View>
        )}
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/add-medication");
          }}
          style={({ pressed }) => [styles.addButton, { opacity: pressed ? 0.8 : 1 }]}
        >
          <Ionicons name="add" size={24} color="#FFF" />
        </Pressable>
      </View>

      {medications.length > 0 ? (
        <>
          <View style={styles.stickyProgress}>
            {progress === 100 ? (
              <View style={styles.successBar}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                <Text style={styles.successBarText}>{t('allDoneSuccess')}</Text>
                <Text style={styles.successBarCount}>{taken}/{total}</Text>
              </View>
            ) : (
              <View style={styles.progressCard}>
                <View style={styles.progressTopRow}>
                  <Text style={styles.progressLabel}>{taken}/{total} {t('completedOf')}</Text>
                  {remaining > 0 && (
                    <Text style={styles.remainingLabel}>{remaining}{t('remainingCount')}</Text>
                  )}
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${progress}%` as any }]} />
                </View>
                {medProgress.length > 0 && (
                  <View style={styles.medProgressRow}>
                    {medProgress.map((mp) => (
                      <View key={mp.name} style={styles.medProgressItem}>
                        <View style={[styles.medProgressDot, { backgroundColor: mp.color }]} />
                        <Text style={[
                          styles.medProgressText,
                          mp.taken === mp.total && { color: Colors.success },
                        ]}>
                          {mp.name} {mp.taken}/{mp.total}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>

          <FlatList
            data={activeBlocks}
            keyExtractor={(item) => item}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!!activeBlocks.length}
            renderItem={({ item: block, index }) => (
              <TimeBlockSection
                block={block}
                items={blockSchedule[block]}
                onQuickLog={handleQuickLog}
                onUndoTaken={handleUndoTaken}
                onBulkLog={handleBulkLog}
                index={index}
                doseLogs={doseLogs}
                isCurrentBlock={block === currentBlock}
              />
            )}
            ListEmptyComponent={() => (
              <View style={styles.emptySchedule}>
                <Ionicons name="checkmark-done-circle" size={48} color={Colors.textTertiary} />
                <Text style={styles.emptyText}>{t('noScheduleToday')}</Text>
              </View>
            )}
          />
          {undoState && (
            <UndoSnackbar
              medName={undoState.medName}
              onUndo={handleUndo}
              onDismiss={() => setUndoState(null)}
            />
          )}
        </>
      ) : (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="medkit-outline" size={56} color={Colors.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>{t('noMedsYet')}</Text>
          <Text style={styles.emptySubtitle}>{t('addFirstMed')}</Text>
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/add-medication");
            }}
            style={({ pressed }) => [
              styles.addFirstButton,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Ionicons name="add" size={20} color="#FFF" />
            <Text style={styles.addFirstText}>{t('addMedication')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  greeting: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.text,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 8,
    gap: 4,
  },
  streakIcon: {
    fontSize: 14,
  },
  streakText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: "#D97706",
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stickyProgress: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  progressCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 8,
  },
  progressTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.text,
  },
  remainingLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.warning,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.borderLight,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  medProgressRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  medProgressItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  medProgressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  medProgressText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textSecondary,
  },
  successBar: {
    backgroundColor: Colors.successBg,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.success + "30",
  },
  successBarText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.success,
    flex: 1,
  },
  successBarCount: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: Colors.success,
  },
  listContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  blockSection: {
    gap: 6,
  },
  blockSectionCurrent: {
    backgroundColor: Colors.primaryBg + "40",
    marginHorizontal: -12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  blockHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
  },
  blockTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  blockIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  blockTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.text,
  },
  currentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  blockCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  blockCountDone: {
    backgroundColor: Colors.successBg,
  },
  blockCountText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  blockCountTextDone: {
    color: Colors.success,
  },
  medCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  medCardTaken: {
    opacity: 0.6,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  medColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  cardNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  medName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.text,
  },
  medNameTaken: {
    color: Colors.textTertiary,
  },
  dosageInline: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  mealInline: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.primaryDark,
    backgroundColor: Colors.primaryBg,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: "hidden",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textTertiary,
  },
  detailDot: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textTertiary,
  },
  statusBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  takeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  takeButtonOverdue: {
    backgroundColor: Colors.warning,
  },
  takeButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: "#FFF",
  },
  bulkButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.primary + "40",
    backgroundColor: Colors.primaryBg,
    borderStyle: "dashed" as any,
  },
  bulkButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.primary,
  },
  snackbar: {
    position: "absolute",
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: "#1A1A1A",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  snackbarContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  snackbarText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "#FFF",
    flex: 1,
  },
  snackbarAction: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    marginLeft: 8,
  },
  snackbarActionText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: "#FFF",
  },
  emptySchedule: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textTertiary,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 20,
    color: Colors.text,
  },
  emptySubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  addFirstButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 16,
  },
  addFirstText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#FFF",
  },
});
