export type CalorieSettings = { adult: number; senior: number; teenager: number; child: number; preschool: number; infant: number };
export type HouseholdMember = { id: string; name: string; age: number };
export type MacroTargets = { proteinPct: number; carbsPct: number; fatPct: number };
export type Macros = { protein: number; carbs: number; fat: number };

export const defaultCalorieSettings: CalorieSettings = { adult: 2400, senior: 2200, teenager: 2400, child: 1800, preschool: 1300, infant: 800 };
export const defaultMacroTargets: MacroTargets = { proteinPct: 20, carbsPct: 50, fatPct: 30 };

export function ageBand(age: number) { if (age < 2) return "infant" as const; if (age < 6) return "preschool" as const; if (age < 13) return "child" as const; if (age < 18) return "teenager" as const; if (age < 60) return "adult" as const; return "senior" as const; }
export function dailyCaloriesForMember(age: number, settings: CalorieSettings) { return settings[ageBand(age)]; }
export function householdDailyCalories(members: HouseholdMember[], settings: CalorieSettings) { return members.reduce((total, member) => total + dailyCaloriesForMember(member.age, settings), 0); }

export function dailyMacroTargets(dailyCalories: number, targets: MacroTargets = defaultMacroTargets): Macros {
  return {
    protein: dailyCalories * targets.proteinPct / 400,
    carbs: dailyCalories * targets.carbsPct / 400,
    fat: dailyCalories * targets.fatPct / 900,
  };
}

const kcalPerUnit: Record<string, number> = {
  Arroz: 3600, Pasta: 3500, Avena: 3800, Harina: 3640, Cuscús: 3760, "Patata deshidratada": 3500, Sal: 0, Azúcar: 3870,
  "Aceite de oliva": 8840, "Aceite de girasol": 8840, Vinagre: 200, "Salsa de soja": 600, Especias: 2500, Levadura: 3250,
  "Leche UHT": 620, "Leche en polvo": 4960, "Bebida vegetal UHT": 450, "Queso curado/envasado": 4000,
  "Lentejas secas": 3500, "Garbanzos secos": 3640, "Judías secas": 3370, "Legumbres secas variadas": 3500, "Legumbres cocidas": 900, "Tomate triturado": 180, "Tomate frito": 700,
  Atún: 1200, "Sardinas/caballa": 2000, "Carne en conserva": 1800, "Verduras en conserva": 250, Maíz: 860, Pimientos: 300, "Judías verdes": 250, Aceitunas: 1450, Caldo: 100,
  "Frutos secos": 6000, Semillas: 5500, "Crema de cacahuete": 5900, "Fruta deshidratada": 3000, Miel: 3040, Mermelada: 2500, Cacao: 2300, Cereales: 3800, "Chocolate negro": 5500, "Galletas/crackers": 4500, Café: 0, "Café/té": 0, "Pan tostado/biscotes": 4000,
};

export function estimatedCalories(name: string, quantity: number) { return (kcalPerUnit[name] ?? 1000) * quantity; }

// Valores medios por la unidad que se almacena en el catálogo (kg, litro, lata o unidad).
// Sirven para planificación; la etiqueta nutricional del producto concreto siempre tiene prioridad.
const macroPerUnit: Record<string, Macros> = {
  Arroz: { protein: 70, carbs: 790, fat: 7 }, Pasta: { protein: 130, carbs: 720, fat: 15 }, Avena: { protein: 130, carbs: 600, fat: 70 }, Harina: { protein: 100, carbs: 760, fat: 10 }, Cuscús: { protein: 130, carbs: 770, fat: 5 }, "Patata deshidratada": { protein: 80, carbs: 780, fat: 5 }, Azúcar: { protein: 0, carbs: 1000, fat: 0 },
  "Aceite de oliva": { protein: 0, carbs: 0, fat: 1000 }, "Aceite de girasol": { protein: 0, carbs: 0, fat: 1000 }, "Leche UHT": { protein: 32, carbs: 48, fat: 32 }, "Leche en polvo": { protein: 260, carbs: 380, fat: 260 },
  "Lentejas secas": { protein: 250, carbs: 600, fat: 10 }, "Garbanzos secos": { protein: 210, carbs: 620, fat: 60 }, "Judías secas": { protein: 220, carbs: 600, fat: 15 }, "Legumbres secas variadas": { protein: 230, carbs: 610, fat: 20 }, "Legumbres cocidas": { protein: 50, carbs: 140, fat: 10 },
  Atún: { protein: 260, carbs: 0, fat: 100 }, "Sardinas/caballa": { protein: 220, carbs: 0, fat: 150 }, "Carne en conserva": { protein: 250, carbs: 20, fat: 150 }, "Verduras en conserva": { protein: 15, carbs: 50, fat: 2 }, Maíz: { protein: 30, carbs: 150, fat: 15 },
  "Frutos secos": { protein: 200, carbs: 160, fat: 500 }, Semillas: { protein: 180, carbs: 200, fat: 450 }, "Crema de cacahuete": { protein: 250, carbs: 200, fat: 500 }, "Fruta deshidratada": { protein: 20, carbs: 700, fat: 5 }, Miel: { protein: 0, carbs: 820, fat: 0 }, Cereales: { protein: 90, carbs: 750, fat: 50 }, "Chocolate negro": { protein: 80, carbs: 450, fat: 420 }, "Galletas/crackers": { protein: 70, carbs: 650, fat: 180 }, "Pan tostado/biscotes": { protein: 120, carbs: 700, fat: 80 },
};

export function estimatedMacros(name: string, quantity: number): Macros {
  const kcal = estimatedCalories(name, 1);
  const known = macroPerUnit[name];
  if (known) return { protein: known.protein * quantity, carbs: known.carbs * quantity, fat: known.fat * quantity };
  return { protein: kcal * quantity * 0.08 / 4, carbs: kcal * quantity * 0.55 / 4, fat: kcal * quantity * 0.37 / 9 };
}
