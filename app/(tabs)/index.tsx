import { StyleSheet, Text, View, FlatList, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import React from "react";
import Colors from "@/constants/colors";
import { useMedications, ScheduleItem } from "@/contexts/MedicationContext";

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

function ProgressRing({ progress }: { progress: number }) {
  const size = 80;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View style={{ position: "absolute" }}>
        <View style={{
          width: size, height: size, borderRadius: size / 2,
          borderWidth: strokeWidth, borderColor: Colors.borderLight,
        }} />
      </View>
      <View style={{ position: "absolute" }}>
        <View style={{
          width: size, height: size, borderRadius: size / 2,
          borderWidth: strokeWidth, borderColor: Colors.primary,
          borderTopColor: progress >= 25 ? Colors.primary : "transparent",
          borderRightColor: progress >= 50 ? Colors.primary : "transparent",
          borderBottomColor: progress >= 75 ? Colors.primary : "transparent",
          borderLeftColor: progress >= 100 ? Colors.primary : "transparent",
          transform: [{ rotate: "-90deg" }],
        }} />
      </View>
      <Text style={{ fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.primary }}>
        {progress}%
      </Text>
    </View>
  );
}

function ScheduleCard({ item, index }: { item: ScheduleItem; index: number }) {
  const handleTake = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push({
      pathname: "/take-photo",
      params: {
        medicationId: item.medication.id,
        medicationName: item.medication.name,
        scheduledTime: item.scheduledTime,
        color: item.medication.color,
      },
    });
  };

  return (
    <Animated.View entering={Platform.OS !== "web" ? FadeInDown.delay(index * 80).springify() : undefined}>
      <View style={[styles.scheduleCard, item.taken && styles.scheduleCardTaken]}>
        <View style={[styles.colorStrip, { backgroundColor: item.medication.color }]} />
        <View style={styles.cardContent}>
          <View style={styles.cardInfo}>
            <Text style={[styles.medName, item.taken && styles.medNameTaken]}>
              {item.medication.name}
            </Text>
            <View style={styles.timeRow}>
              <Ionicons name="time-outline" size={14} color={Colors.textTertiary} />
              <Text style={styles.timeText}>{formatTime(item.scheduledTime)}</Text>
            </View>
          </View>
          {item.taken ? (
            <View style={styles.takenBadge}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
              <Text style={styles.takenText}>Done</Text>
            </View>
          ) : (
            <Pressable
              onPress={handleTake}
              style={({ pressed }) => [
                styles.takeButton,
                { opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] },
              ]}
            >
              <Ionicons name="camera" size={18} color="#FFF" />
            </Pressable>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const { medications, getTodaySchedule, isLoading } = useMedications();
  const schedule = getTodaySchedule();
  const taken = schedule.filter(s => s.taken).length;
  const total = schedule.length;
  const progress = total === 0 ? 0 : Math.round((taken / total) * 100);

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good Morning" : now.getHours() < 18 ? "Good Afternoon" : "Good Evening";

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.dateText}>
            {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </Text>
        </View>
      </View>

      {medications.length > 0 ? (
        <FlatList
          data={schedule}
          keyExtractor={(item) => `${item.medication.id}-${item.scheduledTime}`}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 90 }]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!schedule.length}
          ListHeaderComponent={() => (
            <View style={styles.summaryCard}>
              <View style={styles.summaryInfo}>
                <Text style={styles.summaryTitle}>Today's Progress</Text>
                <Text style={styles.summaryCount}>
                  <Text style={styles.summaryHighlight}>{taken}</Text> / {total} doses taken
                </Text>
                {progress === 100 && (
                  <View style={styles.completeBadge}>
                    <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                    <Text style={styles.completeText}>All done for today!</Text>
                  </View>
                )}
              </View>
              <ProgressRing progress={progress} />
            </View>
          )}
          renderItem={({ item, index }) => <ScheduleCard item={item} index={index} />}
          ListEmptyComponent={() => (
            <View style={styles.emptySchedule}>
              <Ionicons name="checkmark-done-circle" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No medications scheduled today</Text>
            </View>
          )}
        />
      ) : (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="medkit-outline" size={56} color={Colors.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>No medications yet</Text>
          <Text style={styles.emptySubtitle}>
            Add your first medication to start tracking
          </Text>
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
            <Text style={styles.addFirstText}>Add Medication</Text>
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
  listContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  summaryCard: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  summaryInfo: {
    flex: 1,
    marginRight: 16,
  },
  summaryTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.text,
  },
  summaryCount: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  summaryHighlight: {
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
    fontSize: 18,
  },
  completeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  completeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.success,
  },
  scheduleCard: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  scheduleCardTaken: {
    opacity: 0.7,
  },
  colorStrip: {
    width: 4,
  },
  cardContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  cardInfo: {
    flex: 1,
  },
  medName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.text,
  },
  medNameTaken: {
    textDecorationLine: "line-through",
    color: Colors.textTertiary,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  timeText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textTertiary,
  },
  takenBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.successBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  takenText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.success,
  },
  takeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
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
