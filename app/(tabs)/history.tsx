import { StyleSheet, Text, View, ScrollView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import Colors from "@/constants/colors";
import { useMedications } from "@/contexts/MedicationContext";

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconContainer, { backgroundColor: color + "15" }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function WeeklyChart({ data }: { data: { day: string; completed: number; total: number }[] }) {
  const maxTotal = Math.max(...data.map(d => d.total), 1);

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.sectionTitle}>This Week</Text>
      <View style={styles.chart}>
        {data.map((d, i) => {
          const height = d.total > 0 ? (d.completed / d.total) * 120 : 0;
          const totalHeight = d.total > 0 ? (d.total / maxTotal) * 120 : 4;
          const isToday = i === data.length - 1;

          return (
            <View key={i} style={styles.barContainer}>
              <View style={styles.barWrapper}>
                <View style={[styles.barBg, { height: totalHeight }]} />
                <View
                  style={[
                    styles.barFill,
                    {
                      height: height,
                      backgroundColor: d.completed === d.total && d.total > 0
                        ? Colors.success
                        : Colors.primary,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.barLabel, isToday && styles.barLabelToday]}>
                {d.day}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { medications, getCompletionRate, getStreak, getWeeklyData, doseLogs } = useMedications();
  const weeklyData = getWeeklyData();
  const streak = getStreak();
  const weekRate = getCompletionRate(7);
  const monthRate = getCompletionRate(30);

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 + webBottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        {medications.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="analytics-outline" size={56} color={Colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>No data yet</Text>
            <Text style={styles.emptySubtitle}>
              Add medications and start tracking to see your stats
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.statsRow}>
              <StatCard
                icon="flame"
                label="Day Streak"
                value={`${streak}`}
                color={Colors.accent}
              />
              <StatCard
                icon="trending-up"
                label="This Week"
                value={`${weekRate}%`}
                color={Colors.primary}
              />
              <StatCard
                icon="calendar"
                label="This Month"
                value={`${monthRate}%`}
                color="#8B5CF6"
              />
            </View>

            <WeeklyChart data={weeklyData} />

            <View style={styles.summaryCard}>
              <Text style={styles.sectionTitle}>Summary</Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Ionicons name="medkit" size={18} color={Colors.primary} />
                  <Text style={styles.summaryLabel}>Medications</Text>
                  <Text style={styles.summaryValue}>{medications.length}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.summaryItem}>
                  <Ionicons name="checkmark-done" size={18} color={Colors.success} />
                  <Text style={styles.summaryLabel}>Total Doses</Text>
                  <Text style={styles.summaryValue}>{doseLogs.length}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.summaryItem}>
                  <Ionicons name="camera" size={18} color={Colors.accent} />
                  <Text style={styles.summaryLabel}>Photos</Text>
                  <Text style={styles.summaryValue}>{doseLogs.length}</Text>
                </View>
              </View>
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
    gap: 20,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.text,
  },
  statLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    color: Colors.text,
    marginBottom: 16,
  },
  chartContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  chart: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 140,
  },
  barContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  barWrapper: {
    width: 24,
    height: 120,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  barBg: {
    width: 24,
    borderRadius: 12,
    backgroundColor: Colors.borderLight,
    position: "absolute",
    bottom: 0,
  },
  barFill: {
    width: 24,
    borderRadius: 12,
    minHeight: 4,
  },
  barLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 8,
  },
  barLabelToday: {
    color: Colors.primary,
    fontFamily: "Inter_700Bold",
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  summaryLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: Colors.text,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.borderLight,
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
