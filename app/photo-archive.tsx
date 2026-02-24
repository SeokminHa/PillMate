import { useState, useMemo } from "react";
import {
  StyleSheet, Text, View, Pressable, ScrollView, Image, Platform, Modal,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React from "react";
import Colors from "@/constants/colors";
import { useMedications, Medication, DoseLog } from "@/contexts/MedicationContext";
import { useLanguage } from "@/contexts/LanguageContext";

function formatDate(dateStr: string, lang: string): string {
  const d = new Date(dateStr);
  if (lang === 'ko') {
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateTime(isoStr: string, lang: string): string {
  const d = new Date(isoStr);
  const hour = d.getHours();
  const min = String(d.getMinutes()).padStart(2, '0');
  if (lang === 'ko') {
    const ampm = hour >= 12 ? '오후' : '오전';
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${d.getMonth() + 1}/${d.getDate()} ${ampm} ${h12}:${min}`;
  }
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${d.getMonth() + 1}/${d.getDate()} ${h12}:${min} ${ampm}`;
}

export default function PhotoArchiveScreen() {
  const insets = useSafeAreaInsets();
  const { medications, doseLogs } = useMedications();
  const { t, language } = useLanguage();
  const [selectedMedId, setSelectedMedId] = useState<string | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const medMap = useMemo(() => {
    const map: Record<string, Medication> = {};
    for (const m of medications) map[m.id] = m;
    return map;
  }, [medications]);

  const filteredLogs = useMemo(() => {
    let logs = doseLogs.filter(l => l.photoUri);
    if (selectedMedId) {
      logs = logs.filter(l => l.medicationId === selectedMedId);
    }
    logs.sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime());
    return logs;
  }, [doseLogs, selectedMedId]);

  const groupedLogs = useMemo(() => {
    const groups: { date: string; logs: DoseLog[] }[] = [];
    let currentDate = '';
    for (const log of filteredLogs) {
      if (log.date !== currentDate) {
        currentDate = log.date;
        groups.push({ date: currentDate, logs: [log] });
      } else {
        groups[groups.length - 1].logs.push(log);
      }
    }
    return groups;
  }, [filteredLogs]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>{t('photoArchive')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.medFilter}
        style={styles.medFilterScroll}
      >
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") Haptics.selectionAsync();
            setSelectedMedId(null);
          }}
          style={[styles.medChip, !selectedMedId && styles.medChipSelected]}
        >
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

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {filteredLogs.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="images-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>{t('noPhotosYet')}</Text>
          </View>
        ) : (
          groupedLogs.map(group => (
            <View key={group.date} style={styles.dateGroup}>
              <Text style={styles.dateHeader}>
                {formatDate(group.date, language)}
              </Text>
              <View style={styles.photoGrid}>
                {group.logs.map(log => {
                  const med = medMap[log.medicationId];
                  return (
                    <Pressable
                      key={log.id}
                      onPress={() => setPreviewUri(log.photoUri)}
                      style={styles.photoCard}
                    >
                      <Image source={{ uri: log.photoUri }} style={styles.photoThumb} />
                      <View style={styles.photoInfo}>
                        {med && (
                          <View style={styles.photoMedRow}>
                            <View style={[styles.photoMedDot, { backgroundColor: med.color }]} />
                            <Text style={styles.photoMedName} numberOfLines={1}>{med.name}</Text>
                          </View>
                        )}
                        <Text style={styles.photoTime}>
                          {formatDateTime(log.takenAt, language)}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={!!previewUri} transparent animationType="fade">
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setPreviewUri(null)}
        >
          <View style={styles.modalContent}>
            {previewUri && (
              <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain" />
            )}
            <Pressable
              onPress={() => setPreviewUri(null)}
              style={styles.closeBtn}
            >
              <Ionicons name="close-circle" size={36} color="#FFF" />
            </Pressable>
          </View>
        </Pressable>
      </Modal>
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
  medFilterScroll: {
    flexGrow: 0,
    marginBottom: 8,
  },
  medFilter: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  medChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
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
  scrollContent: {
    paddingHorizontal: 16,
    gap: 20,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.textTertiary,
  },
  dateGroup: {
    gap: 10,
  },
  dateHeader: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.text,
  },
  photoGrid: {
    gap: 10,
  },
  photoCard: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  photoThumb: {
    width: 72,
    height: 72,
    backgroundColor: Colors.surfaceSecondary,
  },
  photoInfo: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "center",
    gap: 6,
  },
  photoMedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  photoMedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  photoMedName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  photoTime: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  previewImage: {
    width: "90%",
    height: "70%",
  },
  closeBtn: {
    position: "absolute",
    top: 60,
    right: 20,
  },
});
