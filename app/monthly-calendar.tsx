import { useState, useMemo } from "react";
import {
  StyleSheet, Text, View, Pressable, ScrollView, Platform,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React from "react";
import Colors from "@/constants/colors";
import { useMedications, Medication } from "@/contexts/MedicationContext";
import { useLanguage } from "@/contexts/LanguageContext";

function getDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

type DayStatus = 'all' | 'partial' | 'none' | 'future' | 'empty';

export default function MonthlyCalendarScreen() {
  const insets = useSafeAreaInsets();
  const { medications, doseLogs } = useMedications();
  const { t, language } = useLanguage();
  const [selectedMedId, setSelectedMedId] = useState<string | null>(null);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startDayOfWeek = firstDayOfMonth.getDay();

  const monthName = firstDayOfMonth.toLocaleDateString(
    language === 'ko' ? 'ko-KR' : 'en-US',
    { year: 'numeric', month: 'long' }
  );

  const weekDays = [t('sun'), t('mon'), t('tue'), t('wed'), t('thu'), t('fri'), t('sat')];

  const filteredMeds = selectedMedId
    ? medications.filter(m => m.id === selectedMedId)
    : medications;

  const calendarData = useMemo(() => {
    const data: { day: number; status: DayStatus }[] = [];
    const todayStr = getDateString(now);

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dateStr = getDateString(date);

      if (dateStr > todayStr) {
        data.push({ day: d, status: 'future' });
        continue;
      }

      let totalDoses = 0;
      let takenDoses = 0;

      for (const med of filteredMeds) {
        const medCreatedDate = getDateString(new Date(med.createdAt));
        if (dateStr >= medCreatedDate) {
          totalDoses += med.timesPerDay;
          const medLogs = doseLogs.filter(
            l => l.date === dateStr && l.medicationId === med.id
          );
          takenDoses += Math.min(medLogs.length, med.timesPerDay);
        }
      }

      if (totalDoses === 0) {
        data.push({ day: d, status: 'future' });
      } else if (takenDoses === totalDoses) {
        data.push({ day: d, status: 'all' });
      } else if (takenDoses > 0) {
        data.push({ day: d, status: 'partial' });
      } else {
        data.push({ day: d, status: 'none' });
      }
    }

    return data;
  }, [filteredMeds, doseLogs, year, month, daysInMonth]);

  const calendarGrid: ({ day: number; status: DayStatus } | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarGrid.push(null);
  }
  for (const item of calendarData) {
    calendarGrid.push(item);
  }
  while (calendarGrid.length % 7 !== 0) {
    calendarGrid.push(null);
  }

  const rows: (typeof calendarGrid)[] = [];
  for (let i = 0; i < calendarGrid.length; i += 7) {
    rows.push(calendarGrid.slice(i, i + 7));
  }

  const renderDayCell = (item: { day: number; status: DayStatus } | null) => {
    if (!item) return <View style={styles.dayCell} />;

    const isToday = item.day === now.getDate();

    return (
      <View style={[styles.dayCell, isToday && styles.dayCellToday]}>
        <Text style={[styles.dayNumber, isToday && styles.dayNumberToday]}>
          {item.day}
        </Text>
        {item.status === 'all' && (
          <Text style={styles.statusEmoji}>😊</Text>
        )}
        {item.status === 'partial' && (
          <View style={styles.partialDot}>
            <Text style={styles.statusEmojiSmall}>🔶</Text>
          </View>
        )}
        {item.status === 'none' && (
          <Text style={styles.statusEmoji}>😢</Text>
        )}
        {item.status === 'future' && (
          <View style={styles.futureDot} />
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>{t('monthlyCalendar')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.medFilter}
        >
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") Haptics.selectionAsync();
              setSelectedMedId(null);
            }}
            style={[styles.medChip, !selectedMedId && styles.medChipSelected]}
          >
            <Ionicons name="apps" size={14} color={!selectedMedId ? "#FFF" : Colors.textSecondary} />
            <Text style={[styles.medChipText, !selectedMedId && styles.medChipTextSelected]}>
              {t('allMeds')}
            </Text>
          </Pressable>
          {medications.map(med => (
            <Pressable
              key={med.id}
              onPress={() => {
                if (Platform.OS !== "web") Haptics.selectionAsync();
                setSelectedMedId(med.id);
              }}
              style={[
                styles.medChip,
                selectedMedId === med.id && { backgroundColor: med.color, borderColor: med.color },
              ]}
            >
              <View style={[styles.medChipDot, { backgroundColor: med.color }]} />
              <Text style={[
                styles.medChipText,
                selectedMedId === med.id && styles.medChipTextSelected,
              ]}>
                {med.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.calendarCard}>
          <Text style={styles.monthTitle}>{monthName}</Text>

          <View style={styles.weekHeader}>
            {weekDays.map((day, i) => (
              <View key={i} style={styles.weekDayCell}>
                <Text style={[
                  styles.weekDayText,
                  i === 0 && styles.weekDaySun,
                  i === 6 && styles.weekDaySat,
                ]}>
                  {day}
                </Text>
              </View>
            ))}
          </View>

          {rows.map((row, rowIdx) => (
            <View key={rowIdx} style={styles.weekRow}>
              {row.map((cell, cellIdx) => (
                <React.Fragment key={cellIdx}>
                  {renderDayCell(cell)}
                </React.Fragment>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <Text style={styles.legendEmoji}>😊</Text>
            <Text style={styles.legendText}>{t('allTaken')}</Text>
          </View>
          <View style={styles.legendItem}>
            <Text style={styles.legendEmoji}>🔶</Text>
            <Text style={styles.legendText}>{t('partiallyTaken')}</Text>
          </View>
          <View style={styles.legendItem}>
            <Text style={styles.legendEmoji}>😢</Text>
            <Text style={styles.legendText}>{t('notTaken')}</Text>
          </View>
        </View>
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.text,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  medFilter: {
    gap: 8,
    paddingVertical: 4,
  },
  medChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  medChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  medChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  medChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  medChipTextSelected: {
    color: "#FFF",
    fontFamily: "Inter_600SemiBold",
  },
  calendarCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  monthTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.text,
    textAlign: "center",
    marginBottom: 16,
  },
  weekHeader: {
    flexDirection: "row",
    marginBottom: 8,
  },
  weekDayCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
  },
  weekDayText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.textTertiary,
  },
  weekDaySun: {
    color: Colors.danger,
  },
  weekDaySat: {
    color: "#3B82F6",
  },
  weekRow: {
    flexDirection: "row",
  },
  dayCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    minHeight: 52,
    gap: 2,
  },
  dayCellToday: {
    backgroundColor: Colors.primaryBg,
    borderRadius: 12,
  },
  dayNumber: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.text,
  },
  dayNumberToday: {
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  statusEmoji: {
    fontSize: 16,
  },
  statusEmojiSmall: {
    fontSize: 12,
  },
  partialDot: {
    alignItems: "center",
  },
  futureDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderLight,
    marginTop: 2,
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendEmoji: {
    fontSize: 16,
  },
  legendText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
  },
});
