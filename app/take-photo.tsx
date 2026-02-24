import { useState, useRef } from "react";
import {
  StyleSheet, Text, View, Pressable, Platform, Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React from "react";
import Colors from "@/constants/colors";
import { useMedications } from "@/contexts/MedicationContext";
import { useLanguage } from "@/contexts/LanguageContext";

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

export default function TakePhotoScreen() {
  const { medicationId, medicationName, scheduledTime, color } = useLocalSearchParams<{
    medicationId: string;
    medicationName: string;
    scheduledTime: string;
    color: string;
  }>();
  const insets = useSafeAreaInsets();
  const { logDose } = useMedications();
  const { t } = useLanguage();
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const takePhoto = async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.7 });
      if (photo?.uri) {
        setPhotoUri(photo.uri);
      }
    } catch (e) {
      console.error("Failed to take photo:", e);
      Alert.alert(t('error'), t('failedTakePhoto'));
    }
  };

  const pickFromGallery = async () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const confirmDose = async () => {
    if (!photoUri || !medicationId || !scheduledTime) return;
    setIsSaving(true);
    try {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      await logDose(medicationId, scheduledTime, photoUri);
      router.back();
    } catch (e) {
      console.error("Failed to log dose:", e);
      Alert.alert(t('error'), t('failedSave'));
    } finally {
      setIsSaving(false);
    }
  };

  const retakePhoto = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setPhotoUri(null);
  };

  if (!permission) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.loadingText}>{t('loadingCamera')}</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top + webTopInset }]}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.closeBtn, { top: insets.top + webTopInset + 16 }]}
        >
          <Ionicons name="close" size={24} color={Colors.text} />
        </Pressable>
        <View style={styles.permissionContainer}>
          <View style={styles.permissionIcon}>
            <Ionicons name="camera-outline" size={56} color={Colors.textTertiary} />
          </View>
          <Text style={styles.permissionTitle}>{t('cameraAccess')}</Text>
          <Text style={styles.permissionText}>{t('cameraAccessMsg')}</Text>
          <Pressable
            onPress={requestPermission}
            style={({ pressed }) => [styles.permissionButton, { opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={styles.permissionButtonText}>{t('allowCamera')}</Text>
          </Pressable>
          <Pressable
            onPress={pickFromGallery}
            style={({ pressed }) => [styles.galleryFallback, { opacity: pressed ? 0.8 : 1 }]}
          >
            <Ionicons name="images-outline" size={18} color={Colors.primary} />
            <Text style={styles.galleryFallbackText}>{t('orPickGallery')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (photoUri) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <View style={styles.previewHeader}>
          <Pressable onPress={retakePhoto} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </Pressable>
          <Text style={styles.previewTitle}>{t('confirmDose')}</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.previewContent}>
          <View style={[styles.medBanner, { backgroundColor: color || Colors.primary }]}>
            <Ionicons name="medical" size={20} color="#FFF" />
            <Text style={styles.medBannerText}>{medicationName}</Text>
            <Text style={styles.medBannerTime}>{formatTime(scheduledTime || "")}</Text>
          </View>

          <View style={styles.photoPreview}>
            <Image source={{ uri: photoUri }} style={styles.previewImage} contentFit="cover" />
          </View>

          <View style={styles.previewActions}>
            <Pressable
              onPress={retakePhoto}
              style={({ pressed }) => [styles.retakeButton, { opacity: pressed ? 0.8 : 1 }]}
            >
              <Ionicons name="camera-reverse" size={20} color={Colors.primary} />
              <Text style={styles.retakeText}>{t('retake')}</Text>
            </Pressable>
            <Pressable
              onPress={confirmDose}
              disabled={isSaving}
              style={({ pressed }) => [
                styles.confirmButton,
                { opacity: (pressed || isSaving) ? 0.8 : 1 },
              ]}
            >
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
              <Text style={styles.confirmText}>
                {isSaving ? t('saving') : t('markAsTaken')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back">
        <View style={[styles.cameraOverlay, { paddingTop: insets.top + webTopInset }]}>
          <View style={styles.cameraHeader}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.cameraBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="close" size={24} color="#FFF" />
            </Pressable>
            <View style={styles.cameraHeaderInfo}>
              <Text style={styles.cameraTitle}>{medicationName}</Text>
              <Text style={styles.cameraSubtitle}>{t('takePhotoOf')}</Text>
            </View>
            <View style={{ width: 44 }} />
          </View>

          <View style={styles.cameraBottom}>
            <Pressable
              onPress={pickFromGallery}
              style={({ pressed }) => [styles.galleryBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="images" size={24} color="#FFF" />
            </Pressable>

            <Pressable
              onPress={takePhoto}
              style={({ pressed }) => [
                styles.shutterOuter,
                { transform: [{ scale: pressed ? 0.9 : 1 }] },
              ]}
            >
              <View style={styles.shutterInner} />
            </Pressable>

            <View style={{ width: 44 }} />
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
  },
  loadingText: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: Colors.textSecondary,
  },
  closeBtn: {
    position: "absolute",
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  permissionContainer: {
    alignItems: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  permissionIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  permissionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.text,
  },
  permissionText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  permissionButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  permissionButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#FFF",
  },
  galleryFallback: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
  },
  galleryFallbackText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.primary,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: "space-between",
  },
  cameraHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  cameraBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraHeaderInfo: {
    flex: 1,
    alignItems: "center",
  },
  cameraTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: "#FFF",
  },
  cameraSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
  },
  cameraBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 40,
    paddingBottom: 50,
  },
  galleryBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FFF",
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.background,
  },
  previewTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    color: Colors.text,
  },
  previewContent: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 20,
    gap: 20,
  },
  medBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 14,
  },
  medBannerText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#FFF",
    flex: 1,
  },
  medBannerTime: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
  },
  photoPreview: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: Colors.surfaceSecondary,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  previewActions: {
    flexDirection: "row",
    gap: 12,
  },
  retakeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.surfaceSecondary,
    paddingVertical: 16,
    borderRadius: 14,
  },
  retakeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.primary,
  },
  confirmButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.success,
    paddingVertical: 16,
    borderRadius: 14,
  },
  confirmText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#FFF",
  },
});
