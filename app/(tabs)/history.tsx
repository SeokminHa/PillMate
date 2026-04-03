import { StyleSheet, Text, View, ScrollView, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import Colors from "@/constants/colors";
import { useMedications } from "@/contexts/MedicationContext";
import { useLanguage } from "@/contexts/LanguageContext";

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { medications, getCompletionRate, getStreak, doseLogs, getWeeklyData } = useMedications();
  const { t, language, setLanguage } = useLanguage();
  const streak = getStreak();
  const weekRate = getCompletionRate(7);
  const monthRate = getCompletionRate(30);
  const weeklyData = getWeeklyData();

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  const maxCompleted = Math.max(...weeklyData.map(d => d.total), 1);

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('history')}</Text>
        <View style={styles.langToggle}>
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") Haptics.selectionAsync();
              setLanguage('ko');
            }}
            style={[styles.langBtn, language === 'ko' && styles.langBtnActive]}
          >
            <Text style={[styles.langBtnText, language === 'ko' && styles.langBtnTextActive]}>
              {t('korean')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") Haptics.selectionAsync();
              setLanguage('en');
            }}
            style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
          >
            <Text style={[styles.langBtnText, language === 'en' && styles.langBtnTextActive]}>
              {t('english')}
            </Text>
          </Pressable>
        </View>
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
            <Text style={styles.emptyTitle}>{t('noDataYet')}</Text>
            <Text style={styles.emptySubtitle}>{t('addMedsToSee')}</Text>
          </View>
        ) : (
          <>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: Colors.accent + "15" }]}>
                  <Ionicons name="flame" size={20} color={Colors.accent} />
                </View>
                <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{streak}</Text>
                <Text style={styles.statLabel} numberOfLines={1}>{t('dayStreak')}</Text>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: Colors.primary + "15" }]}>
                  <Ionicons name="trending-up" size={20} color={Colors.primary} />
                </View>
                <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{weekRate}%</Text>
                <Text style={styles.statLabel} numberOfLines={1}>{t('thisWeekLabel')}</Text>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: "#8B5CF6" + "15" }]}>
                  <Ionicons name="calendar" size={20} color="#8B5CF6" />
                </View>
                <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{monthRate}%</Text>
                <Text style={styles.statLabel} numberOfLines={1}>{t('thisMonth')}</Text>
              </View>
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.sectionTitle}>{t('thisWeek')}</Text>
              <View style={styles.chartContainer}>
                {weeklyData.map((day, i) => {
                  const barHeight = day.total > 0 ? (day.completed / maxCompleted) * 80 : 0;
                  const isToday = i === weeklyData.length - 1;
                  return (
                    <View key={i} style={styles.chartBarCol}>
                      <View style={styles.chartBarWrapper}>
                        <View style={[
                          styles.chartBarBg,
                          { height: day.total > 0 ? (day.total / maxCompleted) * 80 : 4 },
                        ]} />
                        <View style={[
                          styles.chartBarFill,
                          { height: barHeight || 2 },
                          day.completed === day.total && day.total > 0 && { backgroundColor: Colors.success },
                        ]} />
                      </View>
                      <Text style={[styles.chartDayLabel, isToday && styles.chartDayLabelToday]}>
                        {day.day}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <Pressable
              onPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/monthly-calendar");
              }}
              style={({ pressed }) => [styles.navCard, { opacity: pressed ? 0.85 : 1 }]}
            >
              <View style={styles.navCardLeft}>
                <Ionicons name="calendar" size={20} color="#8B5CF6" />
                <Text style={styles.navCardLabel}>{t('monthlyCalendar')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
            </Pressable>

            <Pressable
              onPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/photo-archive");
              }}
              style={({ pressed }) => [styles.navCard, { opacity: pressed ? 0.85 : 1 }]}
            >
              <View style={styles.navCardLeft}>
                <Ionicons name="camera" size={20} color={Colors.accent} />
                <Text style={styles.navCardLabel}>{t('photos')}</Text>
              </View>
              <View style={styles.navCardRight}>
                <Text style={styles.navCardValue}>{doseLogs.filter(l => !!l.photoUri).length}</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
              </View>
            </Pressable>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: Colors.text,
  },
  langToggle: {
    flexDirection: "row",
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
    padding: 3,
  },
  langBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  langBtnActive: {
    backgroundColor: Colors.primary,
  },
  langBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  langBtnTextActive: {
    color: "#FFF",
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 16,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  statValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: Colors.text,
  },
  statLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
    textAlign: "center",
  },
  chartCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.text,
    marginBottom: 16,
  },
  chartContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 100,
    paddingHorizontal: 4,
  },
  chartBarCol: {
    alignItems: "center",
    flex: 1,
    gap: 6,
  },
  chartBarWrapper: {
    width: 20,
    height: 80,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  chartBarBg: {
    position: "absolute",
    bottom: 0,
    width: 20,
    borderRadius: 4,
    backgroundColor: Colors.borderLight,
  },
  chartBarFill: {
    width: 20,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  chartDayLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.textTertiary,
  },
  chartDayLabelToday: {
    color: Colors.primary,
    fontFamily: "Inter_700Bold",
  },
  navCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  navCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  navCardLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.text,
  },
  navCardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  navCardValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.text,
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
