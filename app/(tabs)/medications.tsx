import { StyleSheet, Text, View, Pressable, Alert, Platform, PanResponder, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring, runOnJS } from "react-native-reanimated";
import React, { useState, useRef, useCallback, useMemo } from "react";
import Colors from "@/constants/colors";
import { useMedications, Medication } from "@/contexts/MedicationContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { translateScheduleLabel } from "@/lib/schedule-label";

const CARD_HEIGHT = 90;
const CARD_GAP = 12;
const ITEM_HEIGHT = CARD_HEIGHT + CARD_GAP;

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

function StaticMedicationCard({ item, index }: {
  item: Medication;
  index: number;
}) {
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

  const handleEdit = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: "/add-medication", params: { editId: item.id } });
  };

  return (
    <Animated.View entering={Platform.OS !== "web" ? FadeInDown.delay(index * 60).springify() : undefined}>
      <Pressable
        onPress={handleEdit}
        style={({ pressed }) => [styles.medCard, { opacity: pressed ? 0.85 : 1 }]}
      >
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
                  {translateScheduleLabel(entry, t) || formatTime(entry.time)}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.medActions}>
          <Pressable
            onPress={handleDelete}
            hitSlop={12}
            style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}
          >
            <Ionicons name="trash-outline" size={20} color={Colors.danger} />
          </Pressable>
          <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

function DraggableList({ medications, reorderMedications }: {
  medications: Medication[];
  reorderMedications: (from: number, to: number) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [currentOrder, setCurrentOrder] = useState<number[]>([]);
  const dragY = useRef(0);
  const startY = useRef(0);
  const startIndex = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);

  const orderRef = useRef<number[]>([]);

  const startDrag = useCallback((index: number) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const initialOrder = medications.map((_, i) => i);
    setCurrentOrder(initialOrder);
    orderRef.current = initialOrder;
    setDraggingIndex(index);
    startIndex.current = index;
    setDragOffset(0);
  }, [medications]);

  const createPanResponder = useCallback((index: number) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        startY.current = 0;
        dragY.current = 0;
        startDrag(index);
      },
      onPanResponderMove: (_, gestureState) => {
        dragY.current = gestureState.dy;
        setDragOffset(gestureState.dy);

        const currentPos = index + Math.round(gestureState.dy / ITEM_HEIGHT);
        const clampedPos = Math.max(0, Math.min(medications.length - 1, currentPos));

        if (clampedPos !== startIndex.current) {
          const newOrder = medications.map((_, i) => i);
          const movedItem = newOrder.splice(index, 1)[0];
          newOrder.splice(clampedPos, 0, movedItem);
          
          if (JSON.stringify(newOrder) !== JSON.stringify(orderRef.current)) {
            if (Platform.OS !== "web") Haptics.selectionAsync();
            orderRef.current = newOrder;
            setCurrentOrder(newOrder);
          }
        }
      },
      onPanResponderRelease: () => {
        const finalPos = index + Math.round(dragY.current / ITEM_HEIGHT);
        const clampedPos = Math.max(0, Math.min(medications.length - 1, finalPos));
        
        setDraggingIndex(null);
        setDragOffset(0);
        setCurrentOrder([]);
        orderRef.current = [];

        if (clampedPos !== index) {
          reorderMedications(index, clampedPos);
        }
      },
      onPanResponderTerminate: () => {
        setDraggingIndex(null);
        setDragOffset(0);
        setCurrentOrder([]);
        orderRef.current = [];
      },
    });
  }, [medications, reorderMedications, startDrag]);

  const panResponders = useMemo(() => {
    return medications.map((_, index) => createPanResponder(index));
  }, [medications, createPanResponder]);

  const getItemStyle = useCallback((index: number) => {
    if (draggingIndex === null) return {};
    
    if (index === draggingIndex) {
      return {
        transform: [{ translateY: dragOffset }],
        zIndex: 999,
        elevation: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      };
    }

    if (currentOrder.length > 0) {
      const originalPos = index;
      const newPos = currentOrder.indexOf(index);
      if (newPos !== originalPos) {
        const diff = (newPos - originalPos) * ITEM_HEIGHT;
        return {
          transform: [{ translateY: diff }],
        };
      }
    }

    return {};
  }, [draggingIndex, dragOffset, currentOrder]);

  const unitLabel = useCallback((item: Medication) => {
    return item.dosageUnit === 'custom' ? (item.customUnit || '') : t('tablet');
  }, [t]);

  return (
    <View style={styles.reorderList}>
      {medications.map((item, index) => {
        const dosageText = item.dosageAmount ? `${item.dosageAmount} ${unitLabel(item)}` : '';
        const isDragging = draggingIndex === index;
        
        return (
          <View
            key={item.id}
            style={[
              styles.reorderCardWrapper,
              getItemStyle(index),
            ]}
          >
            <View style={[
              styles.medCard,
              isDragging && styles.medCardDragging,
            ]}>
              <View
                {...panResponders[index].panHandlers}
                style={styles.dragHandle}
              >
                <Ionicons name="reorder-three" size={24} color={isDragging ? Colors.primary : Colors.textSecondary} />
              </View>
              <View style={[styles.medColorDot, { backgroundColor: item.color }]} />
              <View style={styles.medInfo}>
                <Text style={styles.medName}>{item.name}</Text>
                <Text style={styles.medSchedule}>
                  {item.timesPerDay}x {t('daily')}
                  {dosageText ? ` · ${dosageText}` : ''}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function MedicationsScreen() {
  const insets = useSafeAreaInsets();
  const { medications, reorderMedications } = useMedications();
  const { t } = useLanguage();
  const [isReordering, setIsReordering] = useState(false);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t('myMedications')}</Text>
          {medications.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{medications.length}</Text>
            </View>
          )}
        </View>
        <View style={styles.headerButtons}>
          {medications.length > 1 && (
            <Pressable
              onPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsReordering(!isReordering);
              }}
              style={({ pressed }) => [
                styles.reorderButton,
                isReordering && styles.reorderButtonActive,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Ionicons
                name={isReordering ? "checkmark" : "reorder-three-outline"}
                size={22}
                color={isReordering ? "#FFF" : Colors.primary}
              />
            </Pressable>
          )}
          {!isReordering && (
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
          )}
        </View>
      </View>

      {isReordering ? (
        <View style={[styles.listContent, { paddingBottom: insets.bottom + 90 }]}>
          <DraggableList
            medications={medications}
            reorderMedications={reorderMedications}
          />
        </View>
      ) : (
        <Animated.FlatList
          data={medications}
          keyExtractor={(item: Medication) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 90 }]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!medications.length}
          renderItem={({ item, index }: { item: Medication; index: number }) => (
            <StaticMedicationCard
              item={item}
              index={index}
            />
          )}
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: Colors.text,
  },
  countBadge: {
    backgroundColor: Colors.primary,
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  countText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: "#FFF",
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  reorderButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  reorderButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  listContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  reorderList: {
    gap: 12,
  },
  reorderCardWrapper: {
    zIndex: 1,
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
  medCardDragging: {
    backgroundColor: Colors.primaryBg,
    borderColor: Colors.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  dragHandle: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  medColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 14,
  },
  medActions: {
    alignItems: "center",
    gap: 8,
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
  settingsSection: {
    marginTop: 32,
    gap: 2,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  profileRow: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  profileInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarText: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.primary,
  },
  profileName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.text,
  },
  profileUsername: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  settingsItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  settingsItemText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: Colors.text,
    flex: 1,
  },
  settingsItemValue: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
