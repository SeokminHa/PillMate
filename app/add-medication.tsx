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
import { useMedications, MEDICATION_COLORS } from "@/contexts/MedicationContext";

const PRESET_TIMES = [
  { label: "Morning", time: "08:00" },
  { label: "Noon", time: "12:00" },
  { label: "Afternoon", time: "15:00" },
  { label: "Evening", time: "19:00" },
  { label: "Night", time: "22:00" },
];

function TimePickerButton({ label, time, selected, onPress }: {
  label: string; time: string; selected: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.timeOption, selected && styles.timeOptionSelected]}
    >
      <Text style={[styles.timeOptionLabel, selected && styles.timeOptionLabelSelected]}>
        {label}
      </Text>
      <Text style={[styles.timeOptionTime, selected && styles.timeOptionTimeSelected]}>
        {formatTimeDisplay(time)}
      </Text>
    </Pressable>
  );
}

function formatTimeDisplay(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

export default function AddMedicationScreen() {
  const { addMedication, medications } = useMedications();
  const [name, setName] = useState("");
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [selectedColor, setSelectedColor] = useState(
    MEDICATION_COLORS[medications.length % MEDICATION_COLORS.length]
  );

  const toggleTime = (time: string) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setSelectedTimes(prev =>
      prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Name Required", "Please enter a medication name.");
      return;
    }
    if (selectedTimes.length === 0) {
      Alert.alert("Schedule Required", "Please select at least one time to take this medication.");
      return;
    }

    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    await addMedication({
      name: name.trim(),
      timesPerDay: selectedTimes.length,
      scheduleTimes: selectedTimes.sort(),
      color: selectedColor,
    });

    router.back();
  };

  const isValid = name.trim().length > 0 && selectedTimes.length > 0;

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
          <Text style={styles.title}>Add Medication</Text>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={24} color={Colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Medication Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Vitamin D, Omega-3..."
            placeholderTextColor={Colors.textTertiary}
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="done"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Color</Text>
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
          <Text style={styles.sectionLabel}>When to take</Text>
          <Text style={styles.sectionHint}>Select all that apply</Text>
          <View style={styles.timesGrid}>
            {PRESET_TIMES.map(preset => (
              <TimePickerButton
                key={preset.time}
                label={preset.label}
                time={preset.time}
                selected={selectedTimes.includes(preset.time)}
                onPress={() => toggleTime(preset.time)}
              />
            ))}
          </View>
        </View>

        {selectedTimes.length > 0 && (
          <View style={styles.summarySection}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
            <Text style={styles.summaryText}>
              {selectedTimes.length} time{selectedTimes.length > 1 ? "s" : ""} per day
            </Text>
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
          <Text style={styles.saveText}>Save Medication</Text>
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
  sectionHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textTertiary,
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
    gap: 10,
  },
  timeOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
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
  summarySection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.primaryBg,
    padding: 14,
    borderRadius: 12,
  },
  summaryText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.primaryDark,
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
