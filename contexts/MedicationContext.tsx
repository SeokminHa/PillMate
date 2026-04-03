import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { scheduleMedicationNotifications, cancelMedicationNotifications } from '@/lib/notifications';

export type DosageUnit = 'tablet' | 'custom';

export type MealTiming = 'before' | 'during' | 'after' | null;

export interface TimeEntry {
  time: string;
  label?: string;
  mealTiming?: MealTiming;
}

export interface Medication {
  id: string;
  name: string;
  timesPerDay: number;
  scheduleTimes: string[];
  timeEntries: TimeEntry[];
  dosageAmount: string;
  dosageUnit: DosageUnit;
  customUnit?: string;
  memo?: string;
  color: string;
  createdAt: string;
}

export interface DoseLog {
  id: string;
  medicationId: string;
  scheduledTime: string;
  takenAt: string;
  photoUri: string;
  date: string;
}

export type TimeBlock = 'morning' | 'afternoon' | 'evening' | 'bedtime';

export function getTimeBlock(time: string): TimeBlock {
  const hour = parseInt(time.split(":")[0], 10);
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'bedtime';
}

export type DoseStatus = 'pending' | 'taken' | 'overdue' | 'duplicate';

export function getDoseStatus(scheduledTime: string, taken: boolean): DoseStatus {
  if (taken) return 'taken';
  const now = new Date();
  const [h, m] = scheduledTime.split(":").map(Number);
  const scheduled = new Date();
  scheduled.setHours(h, m, 0, 0);
  if (now.getTime() - scheduled.getTime() > 60 * 60 * 1000) return 'overdue';
  return 'pending';
}

interface MedicationContextValue {
  medications: Medication[];
  doseLogs: DoseLog[];
  isLoading: boolean;
  addMedication: (med: Omit<Medication, 'id' | 'createdAt'>) => Promise<void>;
  updateMedication: (id: string, med: Partial<Medication>) => Promise<void>;
  deleteMedication: (id: string) => Promise<void>;
  logDose: (medicationId: string, scheduledTime: string, photoUri: string) => Promise<void>;
  undoDose: (logId: string) => Promise<void>;
  quickLogDose: (medicationId: string, scheduledTime: string) => Promise<DoseLog>;
  isDuplicateDose: (medicationId: string, scheduledTime: string) => boolean;
  getLastTakenTime: (medicationId: string) => string | null;
  getTodayLogs: () => DoseLog[];
  getTodaySchedule: () => ScheduleItem[];
  getTodayScheduleByBlock: () => Record<TimeBlock, ScheduleItem[]>;
  getCaregiverSummary: () => { completed: number; pending: number; missed: number; total: number; blockSummaries: { block: TimeBlock; completed: number; total: number }[] };
  getCompletionRate: (days: number) => number;
  getStreak: () => number;
  getWeeklyData: () => { day: string; completed: number; total: number }[];
  reorderMedications: (fromIndex: number, toIndex: number) => Promise<void>;
}

export interface ScheduleItem {
  medication: Medication;
  scheduledTime: string;
  timeEntry?: TimeEntry;
  taken: boolean;
  doseLog?: DoseLog;
}

const MedicationContext = createContext<MedicationContextValue | null>(null);

const MEDICATION_COLORS = [
  '#0D9488', '#3B82F6', '#8B5CF6', '#EC4899',
  '#F59E0B', '#EF4444', '#10B981', '#6366F1',
];

const STORAGE_KEYS = {
  medications: '@pillmate_medications',
  doseLogs: '@pillmate_dose_logs',
};

function getDateString(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

export function MedicationProvider({ children }: { children: ReactNode }) {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [doseLogs, setDoseLogs] = useState<DoseLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [medsJson, logsJson] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.medications),
        AsyncStorage.getItem(STORAGE_KEYS.doseLogs),
      ]);
      if (medsJson) {
        const parsed = JSON.parse(medsJson);
        const migrated = parsed.map((m: any) => {
          let unit = m.dosageUnit || 'tablet';
          let customUnit = m.customUnit || '';
          if (['pill', 'capsule'].includes(unit)) unit = 'tablet';
          if (['gram', 'ml', 'drops', 'spoon'].includes(unit)) {
            customUnit = unit === 'gram' ? 'g' : unit === 'ml' ? 'ml' : unit === 'drops' ? (m._lang === 'ko' ? '방울' : 'drops') : (m._lang === 'ko' ? '스푼' : 'spoon');
            unit = 'custom';
          }
          return {
            ...m,
            timeEntries: m.timeEntries || m.scheduleTimes.map((t: string) => ({ time: t })),
            dosageAmount: m.dosageAmount || '1',
            dosageUnit: unit,
            customUnit,
            memo: m.memo || '',
          };
        });
        setMedications(migrated);
      }
      if (logsJson) setDoseLogs(JSON.parse(logsJson));
    } catch (e) {
      console.error('Failed to load data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const saveMedications = async (meds: Medication[]) => {
    await AsyncStorage.setItem(STORAGE_KEYS.medications, JSON.stringify(meds));
  };

  const saveDoseLogs = async (logs: DoseLog[]) => {
    await AsyncStorage.setItem(STORAGE_KEYS.doseLogs, JSON.stringify(logs));
  };

  const addMedication = useCallback(async (med: Omit<Medication, 'id' | 'createdAt'>) => {
    const newMed: Medication = {
      ...med,
      id: Crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const updated = [...medications, newMed];
    setMedications(updated);
    await saveMedications(updated);
    scheduleMedicationNotifications(
      newMed.id,
      newMed.name,
      newMed.scheduleTimes,
      `${newMed.name} 복용할 시간이에요!`,
    ).catch(() => {});
  }, [medications]);

  const updateMedication = useCallback(async (id: string, updates: Partial<Medication>) => {
    const updated = medications.map(m => m.id === id ? { ...m, ...updates } : m);
    setMedications(updated);
    await saveMedications(updated);
    const updatedMed = updated.find(m => m.id === id);
    if (updatedMed) {
      scheduleMedicationNotifications(
        updatedMed.id,
        updatedMed.name,
        updatedMed.scheduleTimes,
        `${updatedMed.name} 복용할 시간이에요!`,
      ).catch(() => {});
    }
  }, [medications]);

  const deleteMedication = useCallback(async (id: string) => {
    cancelMedicationNotifications(id).catch(() => {});
    const updatedMeds = medications.filter(m => m.id !== id);
    const updatedLogs = doseLogs.filter(l => l.medicationId !== id);
    setMedications(updatedMeds);
    setDoseLogs(updatedLogs);
    await Promise.all([saveMedications(updatedMeds), saveDoseLogs(updatedLogs)]);
  }, [medications, doseLogs]);

  const logDose = useCallback(async (medicationId: string, scheduledTime: string, photoUri: string) => {
    const newLog: DoseLog = {
      id: Crypto.randomUUID(),
      medicationId,
      scheduledTime,
      takenAt: new Date().toISOString(),
      photoUri,
      date: getDateString(),
    };
    const updated = [...doseLogs, newLog];
    setDoseLogs(updated);
    await saveDoseLogs(updated);
  }, [doseLogs]);

  const undoDose = useCallback(async (logId: string) => {
    const updated = doseLogs.filter(l => l.id !== logId);
    setDoseLogs(updated);
    await saveDoseLogs(updated);
  }, [doseLogs]);

  const quickLogDose = useCallback(async (medicationId: string, scheduledTime: string): Promise<DoseLog> => {
    const newLog: DoseLog = {
      id: Crypto.randomUUID(),
      medicationId,
      scheduledTime,
      takenAt: new Date().toISOString(),
      photoUri: '',
      date: getDateString(),
    };
    const updated = [...doseLogs, newLog];
    setDoseLogs(updated);
    await saveDoseLogs(updated);
    return newLog;
  }, [doseLogs]);

  const isDuplicateDose = useCallback((medicationId: string, scheduledTime: string): boolean => {
    const today = getDateString();
    return doseLogs.some(l => l.date === today && l.medicationId === medicationId && l.scheduledTime === scheduledTime);
  }, [doseLogs]);

  const getLastTakenTime = useCallback((medicationId: string): string | null => {
    const medLogs = doseLogs.filter(l => l.medicationId === medicationId).sort((a, b) => b.takenAt.localeCompare(a.takenAt));
    return medLogs.length > 0 ? medLogs[0].takenAt : null;
  }, [doseLogs]);

  const getTodayLogs = useCallback(() => {
    const today = getDateString();
    return doseLogs.filter(l => l.date === today);
  }, [doseLogs]);

  const getTodaySchedule = useCallback((): ScheduleItem[] => {
    const today = getDateString();
    const todayLogs = doseLogs.filter(l => l.date === today);
    const items: ScheduleItem[] = [];

    for (const med of medications) {
      for (const entry of med.timeEntries) {
        const log = todayLogs.find(l => l.medicationId === med.id && l.scheduledTime === entry.time);
        items.push({
          medication: med,
          scheduledTime: entry.time,
          timeEntry: entry,
          taken: !!log,
          doseLog: log,
        });
      }
    }

    items.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
    return items;
  }, [medications, doseLogs]);

  const getTodayScheduleByBlock = useCallback((): Record<TimeBlock, ScheduleItem[]> => {
    const schedule = getTodaySchedule();
    const blocks: Record<TimeBlock, ScheduleItem[]> = {
      morning: [],
      afternoon: [],
      evening: [],
      bedtime: [],
    };
    for (const item of schedule) {
      const block = getTimeBlock(item.scheduledTime);
      blocks[block].push(item);
    }
    return blocks;
  }, [getTodaySchedule]);

  const getCaregiverSummary = useCallback(() => {
    const schedule = getTodaySchedule();
    const completed = schedule.filter(s => s.taken).length;
    const total = schedule.length;
    const missed = schedule.filter(s => {
      if (s.taken) return false;
      const [h, m] = s.scheduledTime.split(":").map(Number);
      const scheduled = new Date();
      scheduled.setHours(h, m, 0, 0);
      return new Date().getTime() - scheduled.getTime() > 60 * 60 * 1000;
    }).length;
    const pending = total - completed - missed;

    const blockOrder: TimeBlock[] = ['morning', 'afternoon', 'evening', 'bedtime'];
    const byBlock = getTodayScheduleByBlock();
    const blockSummaries = blockOrder
      .filter(b => byBlock[b].length > 0)
      .map(b => ({
        block: b,
        completed: byBlock[b].filter(s => s.taken).length,
        total: byBlock[b].length,
      }));

    return { completed, pending, missed, total, blockSummaries };
  }, [getTodaySchedule, getTodayScheduleByBlock]);

  const getCompletionRate = useCallback((days: number): number => {
    if (medications.length === 0) return 0;
    const now = new Date();
    let totalDoses = 0;
    let takenDoses = 0;

    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = getDateString(date);
      const dayLogs = doseLogs.filter(l => l.date === dateStr);

      for (const med of medications) {
        const medCreatedDate = getDateString(new Date(med.createdAt));
        if (dateStr >= medCreatedDate) {
          totalDoses += med.timesPerDay;
          const medLogs = dayLogs.filter(l => l.medicationId === med.id);
          takenDoses += Math.min(medLogs.length, med.timesPerDay);
        }
      }
    }

    return totalDoses === 0 ? 0 : Math.round((takenDoses / totalDoses) * 100);
  }, [medications, doseLogs]);

  const getStreak = useCallback((): number => {
    if (medications.length === 0) return 0;
    let streak = 0;
    const now = new Date();

    for (let i = 0; i < 365; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = getDateString(date);
      const dayLogs = doseLogs.filter(l => l.date === dateStr);
      let allTaken = true;

      for (const med of medications) {
        const medCreatedDate = getDateString(new Date(med.createdAt));
        if (dateStr >= medCreatedDate) {
          const medLogs = dayLogs.filter(l => l.medicationId === med.id);
          if (medLogs.length < med.timesPerDay) {
            allTaken = false;
            break;
          }
        }
      }

      if (i === 0 && !allTaken) continue;

      if (allTaken && medications.some(m => dateStr >= getDateString(new Date(m.createdAt)))) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }

    return streak;
  }, [medications, doseLogs]);

  const getWeeklyData = useCallback(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const data: { day: string; completed: number; total: number }[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = getDateString(date);
      const dayLogs = doseLogs.filter(l => l.date === dateStr);
      let total = 0;
      let completed = 0;

      for (const med of medications) {
        const medCreatedDate = getDateString(new Date(med.createdAt));
        if (dateStr >= medCreatedDate) {
          total += med.timesPerDay;
          completed += Math.min(dayLogs.filter(l => l.medicationId === med.id).length, med.timesPerDay);
        }
      }

      data.push({ day: days[date.getDay()], completed, total });
    }

    return data;
  }, [medications, doseLogs]);

  const reorderMedications = useCallback(async (fromIndex: number, toIndex: number) => {
    const updated = [...medications];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setMedications(updated);
    await saveMedications(updated);
  }, [medications]);

  const value = useMemo(() => ({
    medications,
    doseLogs,
    isLoading,
    addMedication,
    updateMedication,
    deleteMedication,
    logDose,
    undoDose,
    quickLogDose,
    isDuplicateDose,
    getLastTakenTime,
    getTodayLogs,
    getTodaySchedule,
    getTodayScheduleByBlock,
    getCaregiverSummary,
    getCompletionRate,
    getStreak,
    getWeeklyData,
    reorderMedications,
  }), [medications, doseLogs, isLoading, addMedication, updateMedication, deleteMedication, logDose, undoDose, quickLogDose, isDuplicateDose, getLastTakenTime, getTodayLogs, getTodaySchedule, getTodayScheduleByBlock, getCaregiverSummary, getCompletionRate, getStreak, getWeeklyData, reorderMedications]);

  return (
    <MedicationContext.Provider value={value}>
      {children}
    </MedicationContext.Provider>
  );
}

export function useMedications() {
  const context = useContext(MedicationContext);
  if (!context) {
    throw new Error('useMedications must be used within a MedicationProvider');
  }
  return context;
}

export { MEDICATION_COLORS };
