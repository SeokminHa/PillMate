type TFunc = (key: any) => string;

const MEAL_NAME_REVERSE: Record<string, string> = {
  "아침": "breakfast",
  breakfast: "breakfast",
  Breakfast: "breakfast",
  "점심": "lunch",
  lunch: "lunch",
  Lunch: "lunch",
  "저녁": "dinner",
  dinner: "dinner",
  Dinner: "dinner",
};

const BLOCK_NAME_REVERSE: Record<string, string> = {
  "아침": "morningBlock",
  Morning: "morningBlock",
  "오후": "afternoonBlock",
  Afternoon: "afternoonBlock",
  "저녁": "eveningBlock",
  Evening: "eveningBlock",
  "취침 전": "bedtimeBlock",
  Bedtime: "bedtimeBlock",
};

export function translateScheduleLabel(
  entry: { label?: string | null; mealTiming?: string | null } | null | undefined,
  t: TFunc,
): string | null {
  const label = (entry?.label ?? "").trim();
  if (!label) return null;

  if (label.startsWith("meal:")) {
    return t(label.split(":")[1]);
  }
  if (label.startsWith("block:")) {
    return t(label.split(":")[1]);
  }

  if (entry?.mealTiming) {
    const key = MEAL_NAME_REVERSE[label.split(" ")[0]];
    if (key) return t(key);
  } else {
    const key = BLOCK_NAME_REVERSE[label];
    if (key) return t(key);
  }

  return label;
}
