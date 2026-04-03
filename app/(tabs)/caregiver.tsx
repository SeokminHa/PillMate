import { StyleSheet, Text, View, ScrollView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import React from "react";
import Colors from "@/constants/colors";
import { useMedications, TimeBlock } from "@/contexts/MedicationContext";
import { useLanguage } from "@/contexts/LanguageContext";

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

export default function CaregiverScreen() {
  const insets = useSafeAreaInsets();
  const { medications, getCaregiverSummary } = useMedications();
  const { t } = useLanguage();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  const summary = getCaregiverSummary();
  const progress = summary.total === 0 ? 0 : Math.round((summary.completed / summary.total) * 100);

  const blockLabels: Record<TimeBlock, string> = {
    morning: t('morningBlock'),
    afternoon: t('afternoonBlock'),
    evening: t('eveningBlock'),
    bedtime: t('bedtimeBlock'),
  };

  const overallMessage = summary.missed > 0
    ? t('caregiverSomeMissed')
    : summary.pending > 0
    ? t('caregiverSomePending')
    : summary.total > 0
    ? t('caregiverAllDone')
    : '';

  const overallColor = summary.missed > 0
    ? Colors.danger
    : summary.pending > 0
    ? Colors.warning
    : Colors.success;

  const overallIcon: keyof typeof Ionicons.glyphMap = summary.missed > 0
    ? "alert-circle"
    : summary.pending > 0
    ? "time"
    : "checkmark-circle";

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('caregiverTitle')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 + webBottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        {medications.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="people-outline" size={56} color={Colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>{t('noMedsRegistered')}</Text>
            <Text style={styles.emptySubtitle}>{t('addMedsToStart')}</Text>
          </View>
        ) : (
          <>
            <Animated.View entering={Platform.OS !== "web" ? FadeInDown.springify() : undefined} style={styles.overallCard}>
              <View style={[styles.overallIconContainer, { backgroundColor: overallColor + "15" }]}>
                <Ionicons name={overallIcon} size={32} color={overallColor} />
              </View>
              <Text style={[styles.overallMessage, { color: overallColor }]}>
                {overallMessage}
              </Text>
              <View style={styles.overallProgressContainer}>
                <View style={styles.progressBarBg}>
                  <View style={[
                    styles.progressBarFill,
                    { width: `${progress}%` as any, backgroundColor: overallColor },
                  ]} />
                </View>
                <Text style={[styles.progressPercent, { color: overallColor }]}>
                  {progress}%
                </Text>
              </View>
            </Animated.View>

            <View style={styles.statsRow}>
              <View style={[styles.statCard, { borderBottomColor: Colors.success, borderBottomWidth: 3 }]}>
                <Text style={[styles.statValue, { color: Colors.success }]}>{summary.completed}</Text>
                <Text style={styles.statLabel}>{t('caregiverCompleted')}</Text>
              </View>
              <View style={[styles.statCard, { borderBottomColor: Colors.warning, borderBottomWidth: 3 }]}>
                <Text style={[styles.statValue, { color: Colors.warning }]}>{summary.pending}</Text>
                <Text style={styles.statLabel}>{t('caregiverPending')}</Text>
              </View>
              <View style={[styles.statCard, { borderBottomColor: Colors.danger, borderBottomWidth: 3 }]}>
                <Text style={[styles.statValue, { color: Colors.danger }]}>{summary.missed}</Text>
                <Text style={styles.statLabel}>{t('caregiverMissed')}</Text>
              </View>
            </View>

            <View style={styles.blockList}>
              {summary.blockSummaries.map((bs, index) => {
                const allDone = bs.completed === bs.total;
                const hasMissed = bs.completed < bs.total;
                const blockColor = BLOCK_COLORS[bs.block];

                return (
                  <Animated.View
                    key={bs.block}
                    entering={Platform.OS !== "web" ? FadeInDown.delay(index * 80).springify() : undefined}
                    style={styles.blockCard}
                  >
                    <View style={styles.blockCardLeft}>
                      <View style={[styles.blockIconContainer, { backgroundColor: blockColor + "15" }]}>
                        <Ionicons name={BLOCK_ICONS[bs.block]} size={20} color={blockColor} />
                      </View>
                      <View>
                        <Text style={styles.blockName}>{blockLabels[bs.block]}</Text>
                        <Text style={styles.blockCount}>
                          {bs.completed} / {bs.total} {t('blockCompleted')}
                        </Text>
                      </View>
                    </View>
                    <View style={[
                      styles.blockStatusBadge,
                      { backgroundColor: allDone ? Colors.successBg : Colors.warningBg },
                    ]}>
                      <Ionicons
                        name={allDone ? "checkmark-circle" : "time"}
                        size={18}
                        color={allDone ? Colors.success : Colors.warning}
                      />
                    </View>
                  </Animated.View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: Colors.text,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 16,
  },
  overallCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 12,
  },
  overallIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  overallMessage: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    textAlign: "center",
  },
  overallProgressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
    marginTop: 4,
  },
  progressBarBg: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.borderLight,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 5,
  },
  progressPercent: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    minWidth: 45,
    textAlign: "right",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  statValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
  },
  statLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  blockList: {
    gap: 10,
  },
  blockCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  blockCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  blockIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  blockName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.text,
  },
  blockCount: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  blockStatusBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
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
    paddingHorizontal: 40,
  },
});
