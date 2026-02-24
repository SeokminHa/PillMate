import { StyleSheet, Text, View, FlatList, Pressable, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import React from "react";
import Colors from "@/constants/colors";
import { useMedications, Medication } from "@/contexts/MedicationContext";
import { useLanguage } from "@/contexts/LanguageContext";

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

function MedicationCard({ item, index }: { item: Medication; index: number }) {
  const { deleteMedication } = useMedications();
  const { t } = useLanguage();

  const handleDelete = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      t('deleteMedication'),
      `"${item.name}"${t('deleteConfirm')}`,
      [
        { text: t('cancel'), style: "cancel" },
        {
          text: t('delete'),
          style: "destructive",
          onPress: () => deleteMedication(item.id),
        },
      ]
    );
  };

  const unitLabel = item.dosageUnit === 'custom' ? (item.customUnit || '') : t('tablet');
  const dosageText = item.dosageAmount ? `${item.dosageAmount} ${unitLabel}` : '';

  return (
    <Animated.View entering={Platform.OS !== "web" ? FadeInDown.delay(index * 60).springify() : undefined}>
      <View style={styles.medCard}>
        <View style={[styles.medColorDot, { backgroundColor: item.color }]} />
        <View style={styles.medInfo}>
          <Text style={styles.medName}>{item.name}</Text>
          <Text style={styles.medSchedule}>
            {item.timesPerDay}x {t('daily')}
            {dosageText ? ` · ${dosageText}` : ''}
          </Text>
          {item.memo ? (
            <Text style={styles.medMemo} numberOfLines={1}>{item.memo}</Text>
          ) : null}
          <View style={styles.timesRow}>
            {(item.timeEntries || []).map((entry, i) => (
              <View key={i} style={styles.timeBadge}>
                <Text style={styles.timeBadgeText}>
                  {entry.label || formatTime(entry.time)}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <Pressable
          onPress={handleDelete}
          hitSlop={12}
          style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}
        >
          <Ionicons name="trash-outline" size={20} color={Colors.danger} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

export default function MedicationsScreen() {
  const insets = useSafeAreaInsets();
  const { medications } = useMedications();
  const { t } = useLanguage();

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('myMedications')}</Text>
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/add-medication");
          }}
          style={({ pressed }) => [
            styles.addButton,
            { opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] },
          ]}
        >
          <Ionicons name="add" size={24} color="#FFF" />
        </Pressable>
      </View>

      <FlatList
        data={medications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!!medications.length}
        renderItem={({ item, index }) => <MedicationCard item={item} index={index} />}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="medical-outline" size={56} color={Colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>{t('noMedsAdded')}</Text>
            <Text style={styles.emptySubtitle}>{t('tapToAdd')}</Text>
          </View>
        )}
      />
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
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  medCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  medColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 14,
  },
  medInfo: {
    flex: 1,
  },
  medName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.text,
  },
  medSchedule: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  medMemo: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textTertiary,
    fontStyle: "italic",
    marginTop: 2,
  },
  timesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  timeBadge: {
    backgroundColor: Colors.primaryBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timeBadgeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.primaryDark,
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
