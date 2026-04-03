import { StyleSheet, Text, View, FlatList, Pressable, Platform, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import React, { useState, useEffect, useRef, useCallback } from "react";
import Colors from "@/constants/colors";
import { useMedications, ScheduleItem, TimeBlock, getDoseStatus, DoseStatus } from "@/contexts/MedicationContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";

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

function formatRelativeTime(isoString: string, t: (key: any) => string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t('justNow');
  if (minutes < 60) return `${minutes}${t('minutesAgo')}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}${t('hoursAgo')}`;
  return t('todayAt');
}

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
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

function MedicationCard({ item, onQuickLog, isDuplicate }: { item: ScheduleItem; onQuickLog: (item: ScheduleItem) => void; isDuplicate: boolean }) {
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

  const displayTime = item.timeEntry?.label || formatTime(item.scheduledTime);
  const mealLabel = item.timeEntry?.mealTiming === 'before' ? t('beforeMeal')
    : item.timeEntry?.mealTiming === 'after' ? t('afterMeal')
    : item.timeEntry?.mealTiming === 'during' ? t('duringMeal')
    : null;

  const statusLabel = status === 'duplicate' ? t('statusDuplicate')
    : status === 'taken' ? t('statusTaken')
    : status === 'overdue' ? t('missedRecovery')
    : t('notTakenYet');

  return (
    <Pressable
      onPress={() => {
        if (!item.taken) onQuickLog(item);
      }}
      style={({ pressed }) => [
        styles.medCard,
        { borderLeftColor: item.medication.color, borderLeftWidth: 4 },
        item.taken && styles.medCardTaken,
        pressed && !item.taken && { transform: [{ scale: 0.98 }] },
      ]}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardNameRow}>
          <Text style={[styles.medName, item.taken && styles.medNameTaken]}>
            {item.medication.name}
          </Text>
          {mealLabel && (
            <View style={styles.mealBadge}>
              <Text style={styles.mealBadgeText}>{mealLabel}</Text>
            </View>
          )}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
          <Ionicons name={config.icon} size={16} color={config.color} />
          <Text style={[styles.statusText, { color: config.text }]}>{statusLabel}</Text>
        </View>
      </View>

      <View style={styles.cardBottom}>
        <View style={styles.cardDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={14} color={Colors.textTertiary} />
            <Text style={styles.detailText}>{displayTime}</Text>
            {dosageInfo ? (
              <>
                <Text style={styles.detailDot}>·</Text>
                <Text style={styles.detailText}>{dosageInfo}</Text>
              </>
            ) : null}
          </View>
          {lastTaken && (
            <View style={styles.detailRow}>
              <Ionicons name="checkmark-done-outline" size={14} color={Colors.textTertiary} />
              <Text style={styles.detailText}>
                {t('lastTaken')}: {formatRelativeTime(lastTaken, t)}
              </Text>
            </View>
          )}
        </View>

        {!item.taken && (
          <View style={[styles.tapIndicator, status === 'overdue' && { backgroundColor: Colors.warningBg }]}>
            <Ionicons
              name={status === 'overdue' ? "alert-circle" : "add-circle"}
              size={28}
              color={status === 'overdue' ? Colors.warning : Colors.primary}
            />
          </View>
        )}
      </View>
    </Pressable>
  );
}

function TimeBlockSection({ block, items, onQuickLog, index, doseLogs }: {
  block: TimeBlock;
  items: ScheduleItem[];
  onQuickLog: (item: ScheduleItem) => void;
  index: number;
  doseLogs: any[];
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

  const today = new Date().toISOString().split('T')[0];

  return (
    <Animated.View
      entering={Platform.OS !== "web" ? FadeInDown.delay(index * 100).springify() : undefined}
      style={styles.blockSection}
    >
      <View style={styles.blockHeader}>
        <View style={styles.blockTitleRow}>
          <View style={[styles.blockIconContainer, { backgroundColor: BLOCK_COLORS[block] + "15" }]}>
            <Ionicons name={BLOCK_ICONS[block]} size={18} color={BLOCK_COLORS[block]} />
          </View>
          <Text style={styles.blockTitle}>{blockLabels[block]}</Text>
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
            isDuplicate={duplicateCount > 1}
          />
        );
      })}
    </Animated.View>
  );
}

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const { medications, doseLogs, getTodaySchedule, getTodayScheduleByBlock, quickLogDose, undoDose, isDuplicateDose } = useMedications();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [undoState, setUndoState] = useState<UndoState | null>(null);

  const schedule = getTodaySchedule();
  const blockSchedule = getTodayScheduleByBlock();
  const taken = schedule.filter(s => s.taken).length;
  const total = schedule.length;
  const progress = total === 0 ? 0 : Math.round((taken / total) * 100);

  const now = new Date();
  const baseGreeting = now.getHours() < 12 ? t('goodMorning') : now.getHours() < 18 ? t('goodAfternoon') : t('goodEvening');
  const greeting = user ? `${baseGreeting}, ${user.displayName}` : baseGreeting;
  const dateLocale = language === 'ko' ? 'ko-KR' : 'en-US';
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const handleQuickLog = useCallback(async (item: ScheduleItem) => {
    if (isDuplicateDose(item.medication.id, item.scheduledTime)) {
      const displayTime = item.timeEntry?.label || formatTime(item.scheduledTime);
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
  }, [quickLogDose, undoState]);

  const handleUndo = useCallback(async () => {
    if (!undoState) return;
    clearTimeout(undoState.timer);
    await undoDose(undoState.logId);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setUndoState(null);
  }, [undoState, undoDose]);

  const blockOrder: TimeBlock[] = ['morning', 'afternoon', 'evening', 'bedtime'];
  const activeBlocks = blockOrder.filter(b => blockSchedule[b].length > 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.dateText}>
            {now.toLocaleDateString(dateLocale, { weekday: "long", month: "long", day: "numeric" })}
          </Text>
        </View>
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
          <FlatList
            data={activeBlocks}
            keyExtractor={(item) => item}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!!activeBlocks.length}
            ListHeaderComponent={() => (
              <>
                {progress === 100 ? (
                  <View style={styles.successCard}>
                    <View style={styles.successIconContainer}>
                      <Ionicons name="checkmark-circle" size={56} color={Colors.success} />
                    </View>
                    <Text style={styles.successTitle}>{t('allDoneSuccess')}</Text>
                    <View style={styles.successProgressRow}>
                      <Text style={styles.successCount}>{taken}/{total}</Text>
                      <Text style={styles.successLabel}>{t('caregiverCompleted')}</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.progressCard}>
                    <View style={styles.progressInfo}>
                      <Text style={styles.progressLabel}>{t('overallProgress')}</Text>
                      <Text style={styles.progressValue}>
                        <Text style={styles.progressHighlight}>{taken}</Text>
                        <Text style={styles.progressTotal}> / {total}</Text>
                      </Text>
                    </View>
                    <View style={styles.progressBarContainer}>
                      <View style={styles.progressBarBg}>
                        <View style={[
                          styles.progressBarFill,
                          { width: `${progress}%` as any },
                        ]} />
                      </View>
                      <Text style={styles.progressPercent}>
                        {progress}%
                      </Text>
                    </View>
                  </View>
                )}
              </>
            )}
            renderItem={({ item: block, index }) => (
              <TimeBlockSection
                block={block}
                items={blockSchedule[block]}
                onQuickLog={handleQuickLog}
                index={index}
                doseLogs={doseLogs}
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
    paddingVertical: 16,
  },
  greeting: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: Colors.text,
  },
  dateText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: 20,
    gap: 16,
  },
  progressCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 4,
  },
  progressInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 12,
  },
  progressLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.text,
  },
  progressValue: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  progressHighlight: {
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
    fontSize: 22,
  },
  progressTotal: {
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    fontSize: 16,
  },
  progressBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.borderLight,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  progressPercent: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: Colors.primary,
    minWidth: 40,
    textAlign: "right",
  },
  successCard: {
    backgroundColor: Colors.successBg,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.success + "30",
    marginBottom: 4,
    gap: 12,
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.success + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.success,
    textAlign: "center",
  },
  successProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  successCount: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: Colors.success,
  },
  successLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.success,
  },
  blockSection: {
    gap: 8,
  },
  blockHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  blockTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  blockIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  blockTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.text,
  },
  blockCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  blockCountDone: {
    backgroundColor: Colors.successBg,
  },
  blockCountText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  blockCountTextDone: {
    color: Colors.success,
  },
  medCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  medCardTaken: {
    opacity: 0.65,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  medName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: Colors.text,
  },
  medNameTaken: {
    color: Colors.textTertiary,
  },
  mealBadge: {
    backgroundColor: Colors.primaryBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  mealBadgeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.primaryDark,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  cardDetails: {
    flex: 1,
    gap: 4,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textTertiary,
  },
  detailDot: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textTertiary,
  },
  tapIndicator: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryBg,
    alignItems: "center",
    justifyContent: "center",
  },
  snackbar: {
    position: "absolute",
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: "#1A1A1A",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
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
    gap: 10,
    flex: 1,
  },
  snackbarText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "#FFF",
    flex: 1,
  },
  snackbarAction: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    marginLeft: 8,
  },
  snackbarActionText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
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
