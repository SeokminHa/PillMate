import { useState, useRef } from "react";
import {
  StyleSheet, Text, View, TextInput, Pressable, ScrollView,
  Platform, KeyboardAvoidingView,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import Colors from "@/constants/colors";
import { useMedications, MEDICATION_COLORS, TimeEntry, DosageUnit, MealTiming } from "@/contexts/MedicationContext";
import { useLanguage } from "@/contexts/LanguageContext";

function formatTimeDisplay(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

export default function AddMedicationScreen() {
  const { addMedication, updateMedication, medications } = useMedications();
  const { t, language } = useLanguage();
  const params = useLocalSearchParams<{ editId?: string }>();
  const editingMed = params.editId ? medications.find(m => m.id === params.editId) : undefined;
  const isEditing = !!editingMed;

  const [name, setName] = useState(editingMed?.name || "");
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(editingMed?.timeEntries || []);
  const [selectedColor, setSelectedColor] = useState(
    editingMed?.color || MEDICATION_COLORS[medications.length % MEDICATION_COLORS.length]
  );
  const [dosageAmount, setDosageAmount] = useState(editingMed?.dosageAmount || "1");
  const [dosageUnit, setDosageUnit] = useState<DosageUnit>(editingMed?.dosageUnit || 'tablet');
  const [customUnitText, setCustomUnitText] = useState(editingMed?.customUnit || "");
  const [memo, setMemo] = useState(editingMed?.memo || "");
  const [customHour, setCustomHour] = useState("09");
  const [customMinute, setCustomMinute] = useState("00");
  const [showCustomTime, setShowCustomTime] = useState(false);
  const [selectedMealTiming, setSelectedMealTiming] = useState<MealTiming>('after');
  const [validationError, setValidationError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const [showAdvancedTime, setShowAdvancedTime] = useState(false);

  const TIME_BLOCKS: { key: string; labelKey: 'morningBlock' | 'afternoonBlock' | 'eveningBlock' | 'bedtimeBlock'; time: string; icon: string }[] = [
    { key: 'morning', labelKey: 'morningBlock', time: '08:00', icon: 'sunny-outline' },
    { key: 'afternoon', labelKey: 'afternoonBlock', time: '13:00', icon: 'partly-sunny-outline' },
    { key: 'evening', labelKey: 'eveningBlock', time: '19:00', icon: 'moon-outline' },
    { key: 'bedtime', labelKey: 'bedtimeBlock', time: '22:00', icon: 'bed-outline' },
  ];

  const MEAL_OPTIONS: { meal: string; labelKey: 'breakfast' | 'lunch' | 'dinner'; time: string }[] = [
    { meal: 'breakfast', labelKey: 'breakfast', time: '07:30' },
    { meal: 'lunch', labelKey: 'lunch', time: '12:00' },
    { meal: 'dinner', labelKey: 'dinner', time: '18:30' },
  ];

  const MEAL_TIMING_OPTIONS: { key: MealTiming; labelKey: 'beforeMeal' | 'duringMeal' | 'afterMeal' }[] = [
    { key: 'before', labelKey: 'beforeMeal' },
    { key: 'during', labelKey: 'duringMeal' },
    { key: 'after', labelKey: 'afterMeal' },
  ];

  const togglePresetTime = (time: string, label: string) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    if (validationError) setValidationError(null);
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
    const mealLabel = t(meal.labelKey);
    const timingText = timingLabel ? t(timingLabel.labelKey) : '';

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
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setValidationError(t('nameRequiredMsg'));
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (timeEntries.length === 0) {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setValidationError(t('scheduleRequiredMsg'));
      return;
    }
    if (dosageUnit === 'custom' && !customUnitText.trim()) {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setValidationError(t('unitRequiredMsg'));
      return;
    }

    setValidationError(null);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const sortedEntries = [...timeEntries].sort((a, b) => a.time.localeCompare(b.time));

    const medData = {
      name: name.trim(),
      timesPerDay: sortedEntries.length,
      scheduleTimes: sortedEntries.map(e => e.time),
      timeEntries: sortedEntries,
      dosageAmount,
      dosageUnit,
      customUnit: dosageUnit === 'custom' ? customUnitText : undefined,
      memo: memo.trim() || undefined,
      color: selectedColor,
    };

    if (isEditing && editingMed) {
      await updateMedication(editingMed.id, medData);
    } else {
      await addMedication(medData);
    }

    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        indicatorStyle="default"
      >
        <View style={styles.header}>
          <Text style={styles.title}>{isEditing ? t('editMedicationTitle') : t('addMedicationTitle')}</Text>
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
            onChangeText={(v) => { setName(v); if (validationError) setValidationError(null); }}
            autoFocus
            returnKeyType="done"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('dosage')}</Text>
          <View style={styles.dosageRow}>
            <TextInput
              style={[styles.input, styles.dosageAmountInput]}
              placeholder={t('dosagePlaceholder')}
              placeholderTextColor={Colors.textTertiary}
              value={dosageAmount}
              onChangeText={setDosageAmount}
              keyboardType="numeric"
              returnKeyType="done"
            />
            <Pressable
              onPress={() => {
                if (Platform.OS !== "web") Haptics.selectionAsync();
                setDosageUnit('tablet');
              }}
              style={[styles.unitChip, dosageUnit === 'tablet' && styles.unitChipSelected]}
            >
              <Text style={[styles.unitChipText, dosageUnit === 'tablet' && styles.unitChipTextSelected]}>
                {t('tablet')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (Platform.OS !== "web") Haptics.selectionAsync();
                setDosageUnit('custom');
              }}
              style={[styles.unitChip, dosageUnit === 'custom' && styles.unitChipSelected]}
            >
              <Text style={[styles.unitChipText, dosageUnit === 'custom' && styles.unitChipTextSelected]}>
                {t('customUnit')}
              </Text>
            </Pressable>
          </View>
          {dosageUnit === 'custom' && (
            <TextInput
              style={styles.input}
              placeholder={t('customUnitPlaceholder')}
              placeholderTextColor={Colors.textTertiary}
              value={customUnitText}
              onChangeText={setCustomUnitText}
              returnKeyType="done"
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('memo')}</Text>
          <TextInput
            style={[styles.input, styles.memoInput]}
            placeholder={t('memoPlaceholder')}
            placeholderTextColor={Colors.textTertiary}
            value={memo}
            onChangeText={setMemo}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
            returnKeyType="default"
          />
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

          <View style={styles.timeBlockGrid}>
            {TIME_BLOCKS.map(item => {
              const isSelected = !!timeEntries.find(e => e.time === item.time && !e.mealTiming);
              return (
                <Pressable
                  key={item.key}
                  onPress={() => togglePresetTime(item.time, t(item.labelKey))}
                  style={[styles.timeBlockChip, isSelected && styles.timeBlockChipSelected]}
                >
                  <Ionicons
                    name={item.icon as any}
                    size={20}
                    color={isSelected ? Colors.primaryDark : Colors.textSecondary}
                  />
                  <Text style={[styles.timeBlockText, isSelected && styles.timeBlockTextSelected]}>
                    {t(item.labelKey)}
                  </Text>
                  <Text style={[styles.timeBlockTime, isSelected && { color: Colors.primaryDark }]}>
                    {formatTimeDisplay(item.time)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => setShowAdvancedTime(!showAdvancedTime)}
            style={styles.advancedToggle}
          >
            <Ionicons name={showAdvancedTime ? "chevron-up" : "chevron-down"} size={16} color={Colors.textSecondary} />
            <Text style={styles.advancedToggleText}>{t('exactTimeToggle')}</Text>
          </Pressable>

          {showAdvancedTime && (
            <>
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
                      {t(opt.labelKey)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.mealGrid}>
                {MEAL_OPTIONS.map(meal => {
                  const timingLabel = MEAL_TIMING_OPTIONS.find(o => o.key === selectedMealTiming);
                  const mealLabel = t(meal.labelKey);
                  const timingText = timingLabel ? t(timingLabel.labelKey) : '';
                  const fullLabel = `${mealLabel} ${timingText}`;
                  const isSelected = !!timeEntries.find(e => e.label === fullLabel);
                  return (
                    <Pressable
                      key={meal.meal}
                      onPress={() => addMealTime(meal)}
                      style={[styles.mealChip, isSelected && styles.mealChipSelected]}
                    >
                      <Text style={[styles.mealChipText, isSelected && styles.mealChipTextSelected]}>
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
                  <Ionicons name="time-outline" size={16} color={Colors.primary} />
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
            </>
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
        {validationError && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={Colors.danger} />
            <Text style={styles.errorText}>{validationError}</Text>
          </View>
        )}
        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [
            styles.saveButton,
            { opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Ionicons name="checkmark" size={20} color="#FFF" />
          <Text style={styles.saveText}>{isEditing ? t('updateMedication') : t('saveMedication')}</Text>
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
  memoInput: {
    minHeight: 72,
    paddingTop: 14,
  },
  dosageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dosageAmountInput: {
    flex: 1,
    minWidth: 60,
  },
  unitChip: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
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
  timeBlockGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  timeBlockChip: {
    width: "47%" as any,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  timeBlockChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryBg,
  },
  timeBlockText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },
  timeBlockTextSelected: {
    color: Colors.primaryDark,
  },
  timeBlockTime: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textTertiary,
  },
  advancedToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
  },
  advancedToggleText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
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
    fontSize: 12,
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
    fontSize: 13,
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
  mealChip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  mealChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryBg,
  },
  mealChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  mealChipTextSelected: {
    color: Colors.primaryDark,
    fontFamily: "Inter_600SemiBold",
  },
  customTimeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: "dashed",
  },
  customTimeButtonText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
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
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  selectedTimeInfo: {
    gap: 2,
  },
  selectedTimeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.primaryDark,
  },
  selectedTimeSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    gap: 10,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "#DC2626",
    flex: 1,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
  },
  saveText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#FFF",
  },
});
