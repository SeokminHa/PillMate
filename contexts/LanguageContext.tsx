import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Language = 'ko' | 'en';

const translations = {
  ko: {
    goodMorning: "좋은 아침이에요",
    goodAfternoon: "좋은 오후에요",
    goodEvening: "좋은 저녁이에요",
    todayProgress: "오늘의 진행 상황",
    dosesTaken: "회 복용 완료",
    allDoneToday: "오늘 모든 약을 복용했어요!",
    noMedsYet: "등록된 약이 없어요",
    addFirstMed: "약을 등록하고 복용을 관리해 보세요",
    addMedication: "약 추가",
    noScheduleToday: "오늘 복용 예정인 약이 없어요",
    done: "완료",
    today: "오늘",
    medications: "내 약",
    history: "기록",
    myMedications: "내 약 목록",
    noMedsAdded: "등록된 약이 없어요",
    tapToAdd: "+ 버튼을 눌러 약을 등록하세요",
    deleteMedication: "약 삭제",
    deleteConfirm: "을(를) 삭제하시겠어요? 복용 기록도 함께 삭제됩니다.",
    cancel: "취소",
    delete: "삭제",
    daily: "일 복용",
    addMedicationTitle: "약 추가하기",
    medName: "약 이름",
    medNamePlaceholder: "예) 비타민 D, 오메가-3...",
    color: "색상",
    whenToTake: "복용 시간",
    selectAll: "해당하는 시간을 모두 선택하세요",
    morning: "아침",
    noon: "점심",
    afternoon: "오후",
    evening: "저녁",
    night: "밤",
    timesPerDay: "회/일",
    saveMedication: "저장하기",
    nameRequired: "이름을 입력해주세요",
    nameRequiredMsg: "약 이름을 입력해주세요.",
    scheduleRequired: "복용 시간을 선택해주세요",
    scheduleRequiredMsg: "최소 한 개의 복용 시간을 선택해주세요.",
    confirmDose: "복용 확인",
    takePhotoOf: "약 사진을 찍어주세요",
    retake: "다시 찍기",
    markAsTaken: "복용 완료",
    saving: "저장 중...",
    cameraAccess: "카메라 접근 필요",
    cameraAccessMsg: "복용 인증을 위해 약 사진을 찍을 수 있도록 카메라 접근을 허용해주세요.",
    allowCamera: "카메라 허용",
    orPickGallery: "또는 갤러리에서 선택",
    loadingCamera: "카메라 로딩 중...",
    error: "오류",
    failedTakePhoto: "사진 촬영에 실패했어요. 다시 시도해주세요.",
    failedSave: "저장에 실패했어요. 다시 시도해주세요.",
    thisWeek: "이번 주",
    dayStreak: "연속 복용",
    thisWeekLabel: "이번 주",
    thisMonth: "이번 달",
    summary: "요약",
    totalDoses: "총 복용",
    photos: "사진",
    noDataYet: "데이터가 없어요",
    addMedsToSee: "약을 등록하고 복용하면 통계를 확인할 수 있어요",
    language: "언어",
    korean: "한국어",
    english: "English",
    settings: "설정",
    customTime: "직접 입력",
    mealTiming: "식사 기준",
    beforeMeal: "식전",
    duringMeal: "식중",
    afterMeal: "식후",
    breakfast: "아침 식사",
    lunch: "점심 식사",
    dinner: "저녁 식사",
    dosage: "복용량",
    dosagePlaceholder: "예) 1",
    pill: "알",
    pills: "알",
    gram: "g",
    liter: "ml",
    tablet: "정",
    capsule: "캡슐",
    drops: "방울",
    spoon: "스푼",
    dosageUnit: "단위",
    presetTimes: "시간 선택",
    orCustomTime: "또는 직접 시간 입력",
    hour: "시",
    minute: "분",
    add: "추가",
    selectedTimes: "선택된 시간",
    amount: "용량",
    monthlyCalendar: "이번 달 복용 달력",
    allMeds: "전체",
    allTaken: "모두 복용",
    partiallyTaken: "일부 복용",
    notTaken: "미복용",
    sun: "일",
    mon: "월",
    tue: "화",
    wed: "수",
    thu: "목",
    fri: "금",
    sat: "토",
    back: "뒤로",
  },
  en: {
    goodMorning: "Good Morning",
    goodAfternoon: "Good Afternoon",
    goodEvening: "Good Evening",
    todayProgress: "Today's Progress",
    dosesTaken: "doses taken",
    allDoneToday: "All done for today!",
    noMedsYet: "No medications yet",
    addFirstMed: "Add your first medication to start tracking",
    addMedication: "Add Medication",
    noScheduleToday: "No medications scheduled today",
    done: "Done",
    today: "Today",
    medications: "Medications",
    history: "History",
    myMedications: "My Medications",
    noMedsAdded: "No medications added",
    tapToAdd: "Tap the + button to add your first medication",
    deleteMedication: "Delete Medication",
    deleteConfirm: "? All dose records will also be deleted.",
    cancel: "Cancel",
    delete: "Delete",
    daily: "x daily",
    addMedicationTitle: "Add Medication",
    medName: "Medication Name",
    medNamePlaceholder: "e.g., Vitamin D, Omega-3...",
    color: "Color",
    whenToTake: "When to take",
    selectAll: "Select all that apply",
    morning: "Morning",
    noon: "Noon",
    afternoon: "Afternoon",
    evening: "Evening",
    night: "Night",
    timesPerDay: "time(s)/day",
    saveMedication: "Save Medication",
    nameRequired: "Name Required",
    nameRequiredMsg: "Please enter a medication name.",
    scheduleRequired: "Schedule Required",
    scheduleRequiredMsg: "Please select at least one time.",
    confirmDose: "Confirm Dose",
    takePhotoOf: "Take a photo of your medication",
    retake: "Retake",
    markAsTaken: "Mark as Taken",
    saving: "Saving...",
    cameraAccess: "Camera Access Needed",
    cameraAccessMsg: "To verify your dose, we need access to your camera to take a photo of your medication.",
    allowCamera: "Allow Camera Access",
    orPickGallery: "Or pick from gallery",
    loadingCamera: "Loading camera...",
    error: "Error",
    failedTakePhoto: "Failed to take photo. Please try again.",
    failedSave: "Failed to save. Please try again.",
    thisWeek: "This Week",
    dayStreak: "Day Streak",
    thisWeekLabel: "This Week",
    thisMonth: "This Month",
    summary: "Summary",
    totalDoses: "Total Doses",
    photos: "Photos",
    noDataYet: "No data yet",
    addMedsToSee: "Add medications and start tracking to see your stats",
    language: "Language",
    korean: "한국어",
    english: "English",
    settings: "Settings",
    customTime: "Custom Time",
    mealTiming: "Meal Timing",
    beforeMeal: "Before Meal",
    duringMeal: "During Meal",
    afterMeal: "After Meal",
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
    dosage: "Dosage",
    dosagePlaceholder: "e.g., 1",
    pill: "pill",
    pills: "pills",
    gram: "g",
    liter: "ml",
    tablet: "tablet",
    capsule: "capsule",
    drops: "drops",
    spoon: "spoon",
    dosageUnit: "Unit",
    presetTimes: "Preset Times",
    orCustomTime: "Or enter custom time",
    hour: "Hour",
    minute: "Min",
    add: "Add",
    selectedTimes: "Selected Times",
    amount: "Amount",
    monthlyCalendar: "Monthly Calendar",
    allMeds: "All",
    allTaken: "All taken",
    partiallyTaken: "Partial",
    notTaken: "Not taken",
    sun: "Sun",
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
    back: "Back",
  },
} as const;

type TranslationKey = keyof typeof translations.ko;

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const LANGUAGE_KEY = '@pillmate_language';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('ko');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_KEY).then(val => {
      if (val === 'en' || val === 'ko') setLanguageState(val);
      setLoaded(true);
    });
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    setLanguageState(lang);
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  }, []);

  const t = useCallback((key: TranslationKey): string => {
    return translations[language][key] || key;
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  if (!loaded) return null;

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
}
