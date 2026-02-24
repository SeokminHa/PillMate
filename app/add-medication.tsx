import { useState } from "react";
import {
  StyleSheet, Text, View, TextInput, Pressable, ScrollView,
  Platform, Alert, KeyboardAvoidingView,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import Colors from "@/constants/colors";
import { useMedications, MEDICATION_COLORS, TimeEntry, DosageUnit, MealTiming } from "@/contexts/MedicationContext";
import { useLanguage } from "@/contexts/LanguageContext";

const DOSAGE_UNITS: { key: DosageUnit; labelKo: string; labelEn: string }[] = [
  { key: 'pill', labelKo: '알', labelEn: 'pill' },
  { key: 'tablet', labelKo: '정', labelEn: 'tablet' },
  { key: 'capsule', labelKo: '캡슐', labelEn: 'capsule' },
  { key: 'gram', labelKo: 'g', labelEn: 'g' },
  { key: 'ml', labelKo: 'ml', labelEn: 'ml' },
  { key: 'drops', labelKo: '방울', labelEn: 'drops' },
  { key: 'spoon', labelKo: '스푼', labelEn: 'spoon' },
];

function formatTimeDisplay(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

export default function AddMedicationScreen() {
  const { addMedication, medications } = useMedications();
  const { t, language } = useLanguage();
  const [name, setName] = useState("");
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [selectedColor, setSelectedColor] = useState(
    MEDICATION_COLORS[medications.length % MEDICATION_COLORS.length]
  );
  const [dosageAmount, setDosageAmount] = useState("1");
  const [dosageUnit, setDosageUnit] = useState<DosageUnit>('pill');
  const [customHour, setCustomHour] = useState("09");
  const [customMinute, setCustomMinute] = useState("00");
  const [showCustomTime, setShowCustomTime] = useState(false);

  const PRESET_TIMES = [
    { label: t('morning'), time: "08:00" },
    { label: t('noon'), time: "12:00" },
    { label: t('afternoon'), time: "15:00" },
    { label: t('evening'), time: "19:00" },
    { label: t('night'), time: "22:00" },
  ];

  const MEAL_OPTIONS: { meal: string; labelKo: string; labelEn: string; time: string }[] = [
    { meal: 'breakfast', labelKo: '아침 식사', labelEn: 'Breakfast', time: '07:30' },
    { meal: 'lunch', labelKo: '점심 식사', labelEn: 'Lunch', time: '12:00' },
    { meal: 'dinner', labelKo: '저녁 식사', labelEn: 'Dinner', time: '18:30' },
  ];

  const MEAL_TIMING_OPTIONS: { key: MealTiming; labelKo: string; labelEn: string }[] = [
    { key: 'before', labelKo: '식전', labelEn: 'Before' },
    { key: 'during', labelKo: '식중', labelEn: 'During' },
    { key: 'after', labelKo: '식후', labelEn: 'After' },
  ];

  const [selectedMeal, setSelectedMeal] = useState<string | null>(null);
  const [selectedMealTiming, setSelectedMealTiming] = useState<MealTiming>('after');

  const togglePresetTime = (time: string, label: string) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    const exists = timeEntries.find(e => e.time === time && !e.mealTiming);
    if (exists) {
      setTimeEntries(prev => prev.filter(e => !(e.time === time && !e.mealTiming)));
    } else {
      setTimeEntries(prev => [...prev, { time, label }]);
    }
  };

  const addCustomTime = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    const h = Math.min(23, Math.max(0, parseInt(customHour) || 0));
    const m = Math.min(59, Math.max(0, parseInt(customMinute) || 0));
    const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    if (timeEntries.find(e => e.time === time)) return;
    setTimeEntries(prev => [...prev, { time, label: formatTimeDisplay(time) }]);
    setShowCustomTime(false);
  };

  const addMealTime = (meal: typeof MEAL_OPTIONS[number]) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    const timingLabel = MEAL_TIMING_OPTIONS.find(o => o.key === selectedMealTiming);
    const mealLabel = language === 'ko' ? meal.labelKo : meal.labelEn;
    const timingText = language === 'ko' ? (timingLabel?.labelKo || '') : (timingLabel?.labelEn || '');

    let adjustedTime = meal.time;
    if (selectedMealTiming === 'before') {
      const [h, min] = meal.time.split(':').map(Number);
      const totalMin = h * 60 + min - 30;
      adjustedTime = `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
    } else if (selectedMealTiming === 'after') {
      const [h, min] = meal.time.split(':').map(Number);
      const totalMin = h * 60 + min + 30;
      adjustedTime = `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
    }

    const label = `${mealLabel} ${timingText}`;
    const exists = timeEntries.find(e => e.label === label);
    if (exists) {
      setTimeEntries(prev => prev.filter(e => e.label !== label));
    } else {
      setTimeEntries(prev => [...prev, { time: adjustedTime, label, mealTiming: selectedMealTiming }]);
    }
  };

  const removeTimeEntry = (index: number) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setTimeEntries(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('nameRequired'), t('nameRequiredMsg'));
      return;
    }
    if (timeEntries.length === 0) {
      Alert.alert(t('scheduleRequired'), t('scheduleRequiredMsg'));
      return;
    }

    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const sortedEntries = [...timeEntries].sort((a, b) => a.time.localeCompare(b.time));

    await addMedication({
      name: name.trim(),
      timesPerDay: sortedEntries.length,
      scheduleTimes: sortedEntries.map(e => e.time),
      timeEntries: sortedEntries,
      dosageAmount,
      dosageUnit,
      color: selectedColor,
    });

    router.back();
  };

  const isValid = name.trim().length > 0 && timeEntries.length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t('addMedicationTitle')}</Text>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={24} color={Colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('medName')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('medNamePlaceholder')}
            placeholderTextColor={Colors.textTertiary}
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="done"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('dosage')}</Text>
          <View style={styles.dosageRow}>
            <TextInput
              style={[styles.input, styles.dosageInput]}
              placeholder={t('dosagePlaceholder')}
              placeholderTextColor={Colors.textTertiary}
              value={dosageAmount}
              onChangeText={setDosageAmount}
              keyboardType="numeric"
              returnKeyType="done"
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.unitScroll} contentContainerStyle={styles.unitScrollContent}>
              {DOSAGE_UNITS.map(unit => (
                <Pressable
                  key={unit.key}
                  onPress={() => {
                    if (Platform.OS !== "web") Haptics.selectionAsync();
                    setDosageUnit(unit.key);
                  }}
                  style={[styles.unitChip, dosageUnit === unit.key && styles.unitChipSelected]}
                >
                  <Text style={[styles.unitChipText, dosageUnit === unit.key && styles.unitChipTextSelected]}>
                    {language === 'ko' ? unit.labelKo : unit.labelEn}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('color')}</Text>
          <View style={styles.colorRow}>
            {MEDICATION_COLORS.map(color => (
              <Pressable
                key={color}
                onPress={() => {
                  if (Platform.OS !== "web") Haptics.selectionAsync();
                  setSelectedColor(color);
                }}
                style={[
                  styles.colorOption,
                  { backgroundColor: color },
                  selectedColor === color && styles.colorOptionSelected,
                ]}
              >
                {selectedColor === color && (
                  <Ionicons name="checkmark" size={16} color="#FFF" />
                )}
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('whenToTake')}</Text>

          <Text style={styles.subLabel}>{t('presetTimes')}</Text>
          <View style={styles.timesGrid}>
            {PRESET_TIMES.map(preset => {
              const isSelected = !!timeEntries.find(e => e.time === preset.time && !e.mealTiming);
              return (
                <Pressable
                  key={preset.time}
                  onPress={() => togglePresetTime(preset.time, preset.label)}
                  style={[styles.timeOption, isSelected && styles.timeOptionSelected]}
                >
                  <Text style={[styles.timeOptionLabel, isSelected && styles.timeOptionLabelSelected]}>
                    {preset.label}
                  </Text>
                  <Text style={[styles.timeOptionTime, isSelected && styles.timeOptionTimeSelected]}>
                    {formatTimeDisplay(preset.time)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('mealTiming')}</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.mealTimingRow}>
            {MEAL_TIMING_OPTIONS.map(opt => (
              <Pressable
                key={opt.key}
                onPress={() => {
                  if (Platform.OS !== "web") Haptics.selectionAsync();
                  setSelectedMealTiming(opt.key);
                }}
                style={[styles.mealTimingChip, selectedMealTiming === opt.key && styles.mealTimingChipSelected]}
              >
                <Text style={[styles.mealTimingText, selectedMealTiming === opt.key && styles.mealTimingTextSelected]}>
                  {language === 'ko' ? opt.labelKo : opt.labelEn}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.mealGrid}>
            {MEAL_OPTIONS.map(meal => {
              const timingLabel = MEAL_TIMING_OPTIONS.find(o => o.key === selectedMealTiming);
              const mealLabel = language === 'ko' ? meal.labelKo : meal.labelEn;
              const timingText = language === 'ko' ? (timingLabel?.labelKo || '') : (timingLabel?.labelEn || '');
              const fullLabel = `${mealLabel} ${timingText}`;
              const isSelected = !!timeEntries.find(e => e.label === fullLabel);
              return (
                <Pressable
                  key={meal.meal}
                  onPress={() => addMealTime(meal)}
                  style={[styles.mealOption, isSelected && styles.mealOptionSelected]}
                >
                  <Ionicons
                    name={meal.meal === 'breakfast' ? 'sunny-outline' : meal.meal === 'lunch' ? 'restaurant-outline' : 'moon-outline'}
                    size={18}
                    color={isSelected ? Colors.primaryDark : Colors.textSecondary}
                  />
                  <Text style={[styles.mealOptionText, isSelected && styles.mealOptionTextSelected]}>
                    {mealLabel}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('customTime')}</Text>
            <View style={styles.dividerLine} />
          </View>

          {!showCustomTime ? (
            <Pressable
              onPress={() => setShowCustomTime(true)}
              style={styles.customTimeButton}
            >
              <Ionicons name="time-outline" size={18} color={Colors.primary} />
              <Text style={styles.customTimeButtonText}>{t('orCustomTime')}</Text>
            </Pressable>
          ) : (
            <View style={styles.customTimeRow}>
              <View style={styles.customTimeInputGroup}>
                <TextInput
                  style={styles.customTimeInput}
                  value={customHour}
                  onChangeText={(v) => setCustomHour(v.replace(/[^0-9]/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="09"
                  placeholderTextColor={Colors.textTertiary}
                />
                <Text style={styles.customTimeSeparator}>:</Text>
                <TextInput
                  style={styles.customTimeInput}
                  value={customMinute}
                  onChangeText={(v) => setCustomMinute(v.replace(/[^0-9]/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="00"
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>
              <Pressable
                onPress={addCustomTime}
                style={({ pressed }) => [styles.addTimeBtn, { opacity: pressed ? 0.8 : 1 }]}
              >
                <Ionicons name="add" size={18} color="#FFF" />
                <Text style={styles.addTimeBtnText}>{t('add')}</Text>
              </Pressable>
              <Pressable onPress={() => setShowCustomTime(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={Colors.textTertiary} />
              </Pressable>
            </View>
          )}
        </View>

        {timeEntries.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('selectedTimes')} ({timeEntries.length})</Text>
            <View style={styles.selectedTimesContainer}>
              {timeEntries.sort((a, b) => a.time.localeCompare(b.time)).map((entry, index) => (
                <View key={index} style={styles.selectedTimeChip}>
                  <View style={styles.selectedTimeInfo}>
                    <Text style={styles.selectedTimeText}>
                      {entry.label || formatTimeDisplay(entry.time)}
                    </Text>
                    {entry.mealTiming && (
                      <Text style={styles.selectedTimeSub}>
                        {formatTimeDisplay(entry.time)}
                      </Text>
                    )}
                  </View>
                  <Pressable onPress={() => removeTimeEntry(index)} hitSlop={8}>
                    <Ionicons name="close-circle" size={20} color={Colors.textTertiary} />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={handleSave}
          disabled={!isValid}
          style={({ pressed }) => [
            styles.saveButton,
            !isValid && styles.saveButtonDisabled,
            { opacity: pressed && isValid ? 0.8 : 1 },
          ]}
        >
          <Ionicons name="checkmark" size={20} color="#FFF" />
          <Text style={styles.saveText}>{t('saveMedication')}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 20,
    gap: 24,
    paddingBottom: 100,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 4,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: Colors.text,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.text,
  },
  subLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dosageRow: {
    gap: 10,
  },
  dosageInput: {
    flex: undefined,
  },
  unitScroll: {
    flexGrow: 0,
  },
  unitScrollContent: {
    gap: 8,
  },
  unitChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  unitChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryBg,
  },
  unitChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  unitChipTextSelected: {
    color: Colors.primaryDark,
    fontFamily: "Inter_600SemiBold",
  },
  colorRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: "#FFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  timesGrid: {
    gap: 8,
  },
  timeOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  timeOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryBg,
  },
  timeOptionLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: Colors.text,
  },
  timeOptionLabelSelected: {
    color: Colors.primaryDark,
    fontFamily: "Inter_600SemiBold",
  },
  timeOptionTime: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  timeOptionTimeSelected: {
    color: Colors.primaryDark,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textTertiary,
  },
  mealTimingRow: {
    flexDirection: "row",
    gap: 8,
  },
  mealTimingChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: "center",
  },
  mealTimingChipSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.warningBg,
  },
  mealTimingText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  mealTimingTextSelected: {
    color: "#92400E",
    fontFamily: "Inter_600SemiBold",
  },
  mealGrid: {
    flexDirection: "row",
    gap: 8,
  },
  mealOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  mealOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryBg,
  },
  mealOptionText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  mealOptionTextSelected: {
    color: Colors.primaryDark,
    fontFamily: "Inter_600SemiBold",
  },
  customTimeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: "dashed",
  },
  customTimeButtonText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.primary,
  },
  customTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  customTimeInputGroup: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
  },
  customTimeInput: {
    flex: 1,
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    textAlign: "center",
    paddingVertical: 12,
  },
  customTimeSeparator: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.textSecondary,
  },
  addTimeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addTimeBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#FFF",
  },
  selectedTimesContainer: {
    gap: 6,
  },
  selectedTimeChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.primaryBg,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary + "30",
  },
  selectedTimeInfo: {
    flex: 1,
  },
  selectedTimeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.primaryDark,
  },
  selectedTimeSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === "web" ? 34 : 20,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    padding: 16,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.textTertiary,
  },
  saveText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#FFF",
  },
});
