type NutritionItem = { quantity: unknown; caloriesPerUnit: number | null };

export function calculateAutonomy(items: NutritionItem[], dailyCalories: number) {
  const totalCalories = items.reduce((sum, item) => sum + Number(item.quantity) * (item.caloriesPerUnit ?? 0), 0);
  return { totalCalories, days: dailyCalories > 0 ? Math.floor(totalCalories / dailyCalories) : 0 };
}
