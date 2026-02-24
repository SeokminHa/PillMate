import { StyleSheet, Text, View, Pressable, TextInput, ScrollView, ActivityIndicator, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React, { useState, useCallback, useRef } from "react";
import Colors from "@/constants/colors";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest } from "@/lib/query-client";

interface DrugItem {
  itemName?: string;
  entpName?: string;
  efcyQesitm?: string;
  useMethodQesitm?: string;
  atpnWarnQesitm?: string;
  atpnQesitm?: string;
  intrcQesitm?: string;
  seQesitm?: string;
  depositMethodQesitm?: string;
  itemImage?: string;
}

interface DurResults {
  contraindication: any[];
  age: any[];
  pregnancy: any[];
}

function stripHtml(html: string | undefined | null): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function AccordionSection({ title, content, icon, iconColor }: {
  title: string;
  content: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!content) return null;

  return (
    <View style={styles.accordionContainer}>
      <Pressable
        onPress={() => setExpanded(!expanded)}
        style={({ pressed }) => [styles.accordionHeader, { opacity: pressed ? 0.85 : 1 }]}
      >
        <View style={styles.accordionTitleRow}>
          <Ionicons name={icon} size={18} color={iconColor || Colors.primary} />
          <Text style={styles.accordionTitle}>{title}</Text>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={Colors.textSecondary}
        />
      </Pressable>
      {expanded && (
        <View style={styles.accordionBody}>
          <Text style={styles.accordionContent}>{content}</Text>
        </View>
      )}
    </View>
  );
}

function DurWarningCard({ title, items, icon }: {
  title: string;
  items: any[];
  icon: keyof typeof Ionicons.glyphMap;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!items || items.length === 0) return null;

  return (
    <View style={styles.durContainer}>
      <Pressable
        onPress={() => setExpanded(!expanded)}
        style={({ pressed }) => [styles.durHeader, { opacity: pressed ? 0.85 : 1 }]}
      >
        <View style={styles.accordionTitleRow}>
          <Ionicons name={icon} size={18} color={Colors.danger} />
          <Text style={styles.durTitle}>{title}</Text>
          <View style={styles.durBadge}>
            <Text style={styles.durBadgeText}>{items.length}</Text>
          </View>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={Colors.textSecondary}
        />
      </Pressable>
      {expanded && (
        <View style={styles.durBody}>
          {items.map((item, i) => (
            <View key={i} style={styles.durItem}>
              <Text style={styles.durItemName}>
                {item.MIXTURE_ITEM_NAME || item.ITEM_NAME || item.itemName || "-"}
              </Text>
              {(item.PROHBT_CONTENT || item.INGR_NAME) && (
                <Text style={styles.durItemDetail}>
                  {stripHtml(item.PROHBT_CONTENT || item.INGR_NAME)}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function DrugResultCard({ drug, dur, t }: {
  drug: DrugItem;
  dur: DurResults | null;
  t: (key: any) => string;
}) {
  const sections = [
    { key: "efficacy", field: "efcyQesitm", icon: "fitness" as const, color: Colors.primary },
    { key: "usage", field: "useMethodQesitm", icon: "time" as const, color: "#6366F1" },
    { key: "precautions", field: "atpnQesitm", icon: "warning" as const, color: Colors.warning },
    { key: "sideEffects", field: "seQesitm", icon: "alert-circle" as const, color: Colors.danger },
    { key: "interactions", field: "intrcQesitm", icon: "git-merge" as const, color: "#8B5CF6" },
    { key: "storage", field: "depositMethodQesitm", icon: "cube" as const, color: Colors.textSecondary },
  ];

  const hasDur = dur && (
    (dur.contraindication?.length > 0) ||
    (dur.age?.length > 0) ||
    (dur.pregnancy?.length > 0)
  );

  return (
    <View style={styles.resultCard}>
      <View style={styles.resultHeader}>
        <View style={styles.resultTitleRow}>
          <Ionicons name="medical" size={20} color={Colors.primary} />
          <Text style={styles.resultName} numberOfLines={2}>{drug.itemName || "-"}</Text>
        </View>
        {drug.entpName && (
          <Text style={styles.resultManufacturer}>
            {t("manufacturer")}: {drug.entpName}
          </Text>
        )}
      </View>

      {sections.map(({ key, field, icon, color }) => (
        <AccordionSection
          key={key}
          title={t(key as any)}
          content={stripHtml((drug as any)[field])}
          icon={icon}
          iconColor={color}
        />
      ))}

      {hasDur && (
        <View style={styles.durSection}>
          <View style={styles.durSectionHeader}>
            <Ionicons name="shield" size={18} color={Colors.danger} />
            <Text style={styles.durSectionTitle}>{t("durWarnings")}</Text>
          </View>
          <DurWarningCard
            title={t("durContraindication")}
            items={dur!.contraindication}
            icon="close-circle"
          />
          <DurWarningCard
            title={t("durAge")}
            items={dur!.age}
            icon="person"
          />
          <DurWarningCard
            title={t("durPregnancy")}
            items={dur!.pregnancy}
            icon="heart"
          />
        </View>
      )}

      {dur && !hasDur && (
        <View style={styles.noDurBox}>
          <Ionicons name="shield-checkmark" size={18} color={Colors.success} />
          <Text style={styles.noDurText}>{t("noDurWarnings")}</Text>
        </View>
      )}
    </View>
  );
}

export default function DrugInfoScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DrugItem[]>([]);
  const [durData, setDurData] = useState<DurResults | null>(null);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const doSearch = useCallback(async (searchName: string) => {
    if (!searchName.trim()) return;

    setLoading(true);
    setSearched(true);
    setResults([]);
    setDurData(null);

    try {
      const [drugRes, durRes] = await Promise.all([
        apiRequest("GET", `/api/drug/search?name=${encodeURIComponent(searchName.trim())}`),
        apiRequest("GET", `/api/drug/dur?name=${encodeURIComponent(searchName.trim())}`),
      ]);

      const drugData = await drugRes.json();
      const durResult = await durRes.json();

      setResults(drugData.items || []);
      setDurData(durResult);
    } catch (err) {
      console.error("Drug search failed:", err);
      setResults([]);
      setDurData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback(() => {
    if (query.trim()) {
      doSearch(query);
    }
  }, [query, doSearch]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("drugInfo")}</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={18} color={Colors.textTertiary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={t("drugSearchPlaceholder")}
            placeholderTextColor={Colors.textTertiary}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(""); setResults([]); setSearched(false); }} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
            </Pressable>
          )}
        </View>
        <Pressable
          onPress={handleSearch}
          style={({ pressed }) => [styles.searchBtn, { opacity: pressed ? 0.8 : 1 }]}
        >
          <Ionicons name="search" size={20} color="#FFF" />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {loading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>{t("searching")}</Text>
          </View>
        )}

        {!loading && searched && results.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={56} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>{t("noResults")}</Text>
            <Text style={styles.emptySubtitle}>{t("tryDifferentName")}</Text>
          </View>
        )}

        {!loading && !searched && (
          <View style={styles.emptyState}>
            <Ionicons name="flask-outline" size={56} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>{t("searchDrugInfo")}</Text>
            <Text style={styles.emptySubtitle}>{t("tapToSearch")}</Text>
          </View>
        )}

        {!loading && results.map((drug, i) => (
          <DrugResultCard key={i} drug={drug} dur={durData} t={t} />
        ))}
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
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.text,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 12,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    height: 46,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.text,
    height: 46,
  },
  searchBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  loadingBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    color: Colors.text,
    marginTop: 8,
  },
  emptySubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  resultCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: "hidden",
  },
  resultHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  resultTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  resultName: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: Colors.text,
    flex: 1,
  },
  resultManufacturer: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  accordionContainer: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  accordionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  accordionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.text,
  },
  accordionBody: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 0,
  },
  accordionContent: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  durSection: {
    padding: 16,
    gap: 8,
  },
  durSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  durSectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: Colors.danger,
  },
  durContainer: {
    backgroundColor: Colors.dangerBg,
    borderRadius: 12,
    overflow: "hidden",
  },
  durHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  durTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.danger,
  },
  durBadge: {
    backgroundColor: Colors.danger,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  durBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    color: "#FFF",
  },
  durBody: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  durItem: {
    backgroundColor: "#FFF",
    borderRadius: 8,
    padding: 10,
  },
  durItemName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.text,
  },
  durItemDetail: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  noDurBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 16,
    padding: 12,
    backgroundColor: Colors.successBg,
    borderRadius: 10,
  },
  noDurText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.success,
  },
});
