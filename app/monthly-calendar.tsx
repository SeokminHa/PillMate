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

function getStatusEmoji(status: DayStatus): string {
  if (status === 'all') return '😊';
  if (status === 'partial') return '🔶';
  if (status === 'none') return '😢';
  return '';
}

export default function MonthlyCalendarScreen() {
  const insets = useSafeAreaInsets();
  const { medications, doseLogs } = useMedications();
  const { t, language } = useLanguage();
  const [selectedMedId, setSelectedMedId] = useState<string | null>(null);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const now = new Date();
  const todayStr = getDateString(now);

  const [selectedDay, setSelectedDay] = useState<number | null>(now.getDate());

  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();

  const goToPrevMonth = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
    setSelectedDay(null);
  };

  const goToNextMonth = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
    setSelectedDay(null);
  };

  const goToToday = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setSelectedDay(now.getDate());
  };

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
  const lastDayOfMonth = new Date(viewYear, viewMonth + 1, 0);
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

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(viewYear, viewMonth, d);
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
  }, [filteredMeds, doseLogs, viewYear, viewMonth, daysInMonth, todayStr]);

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

  const selectedDayDetail = useMemo(() => {
    if (selectedDay === null || selectedMedId !== null) return null;

    const date = new Date(viewYear, viewMonth, selectedDay);
    const dateStr = getDateString(date);

    if (dateStr > todayStr) return null;

    return medications.map(med => {
      const medCreatedDate = getDateString(new Date(med.createdAt));
      if (dateStr < medCreatedDate) return null;

      const medLogs = doseLogs.filter(
        l => l.date === dateStr && l.medicationId === med.id
      );
      const taken = Math.min(medLogs.length, med.timesPerDay);
      const total = med.timesPerDay;

      let status: DayStatus;
      if (taken === total) status = 'all';
      else if (taken > 0) status = 'partial';
      else status = 'none';

      return { med, taken, total, status };
    }).filter(Boolean) as { med: Medication; taken: number; total: number; status: DayStatus }[];
  }, [selectedDay, selectedMedId, viewYear, viewMonth, medications, doseLogs, todayStr]);

  const handleDayPress = (item: { day: number; status: DayStatus }) => {
    if (item.status === 'future') return;
    if (Platform.OS !== "web") Haptics.selectionAsync();
    if (selectedMedId !== null) return;
    setSelectedDay(prev => prev === item.day ? null : item.day);
  };

  const renderDayCell = (item: { day: number; status: DayStatus } | null) => {
    if (!item) return <View style={styles.dayCell} />;

    const isToday = isCurrentMonth && item.day === now.getDate();
    const isSelected = selectedDay === item.day && selectedMedId === null;
    const isTappable = item.status !== 'future' && selectedMedId === null;

    return (
      <Pressable
        onPress={() => handleDayPress(item)}
        disabled={!isTappable}
        style={[
          styles.dayCell,
          isToday && styles.dayCellToday,
          isSelected && styles.dayCellSelected,
        ]}
      >
        <Text style={[
          styles.dayNumber,
          isToday && styles.dayNumberToday,
          isSelected && styles.dayNumberSelected,
        ]}>
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
      </Pressable>
    );
  };

  const selectedDateLabel = useMemo(() => {
    if (selectedDay === null) return '';
    const date = new Date(viewYear, viewMonth, selectedDay);
    return date.toLocaleDateString(
      language === 'ko' ? 'ko-KR' : 'en-US',
      { month: 'long', day: 'numeric', weekday: 'short' }
    );
  }, [selectedDay, viewYear, viewMonth, language]);

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
              setSelectedDay(null);
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
                setSelectedDay(null);
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
          <View style={styles.monthNav}>
            <Pressable
              onPress={goToPrevMonth}
              hitSlop={12}
              style={({ pressed }) => [styles.navBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="chevron-back" size={22} color={Colors.text} />
            </Pressable>
            <Text style={styles.monthTitle}>
              {monthName}
            </Text>
            <Pressable
              onPress={goToNextMonth}
              hitSlop={12}
              style={({ pressed }) => [styles.navBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="chevron-forward" size={22} color={Colors.text} />
            </Pressable>
          </View>
          {!isCurrentMonth && (
            <Pressable
              onPress={goToToday}
              style={({ pressed }) => [styles.todayBtn, { opacity: pressed ? 0.8 : 1 }]}
            >
              <Ionicons name="today-outline" size={16} color="#FFF" />
              <Text style={styles.todayBtnText}>{t('today')}</Text>
            </Pressable>
          )}

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

        {selectedDay !== null && selectedMedId === null && selectedDayDetail && (
          <View style={styles.dayDetailCard}>
            <Text style={styles.dayDetailTitle}>{selectedDateLabel}</Text>
            {selectedDayDetail.length === 0 ? (
              <Text style={styles.dayDetailEmpty}>{t('noDoses')}</Text>
            ) : (
              <View style={styles.dayDetailList}>
                {selectedDayDetail.map(({ med, taken, total, status }) => (
                  <View key={med.id} style={styles.dayDetailRow}>
                    <View style={styles.dayDetailLeft}>
                      <Text style={styles.dayDetailEmoji}>{getStatusEmoji(status)}</Text>
                      <View style={[styles.dayDetailDot, { backgroundColor: med.color }]} />
                      <Text style={styles.dayDetailMedName} numberOfLines={1}>{med.name}</Text>
                    </View>
                    <Text style={[
                      styles.dayDetailCount,
                      status === 'all' && styles.dayDetailCountAll,
                      status === 'none' && styles.dayDetailCountNone,
                    ]}>
                      {taken}{t('of')}{total}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

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
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  monthTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.text,
    textAlign: "center",
  },
  todayBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "center",
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 12,
  },
  todayBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "#FFF",
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
    borderRadius: 12,
  },
  dayCellToday: {
    backgroundColor: Colors.primaryBg,
  },
  dayCellSelected: {
    backgroundColor: "#E0E7FF",
    borderWidth: 2,
    borderColor: Colors.primary,
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
  dayNumberSelected: {
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
  dayDetailCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 12,
  },
  dayDetailTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: Colors.text,
  },
  dayDetailEmpty: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: "center",
    paddingVertical: 12,
  },
  dayDetailList: {
    gap: 10,
  },
  dayDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 12,
    padding: 12,
    paddingHorizontal: 14,
  },
  dayDetailLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  dayDetailEmoji: {
    fontSize: 18,
  },
  dayDetailDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dayDetailMedName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  dayDetailCount: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  dayDetailCountAll: {
    color: Colors.success,
  },
  dayDetailCountNone: {
    color: Colors.danger,
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
