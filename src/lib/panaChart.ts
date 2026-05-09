// Pana chart — exact digit→pana mapping from spec.
// A "pana" is a 3-digit number; its associated single digit is the last digit
// of the sum of its three digits (e.g. 123 → 1+2+3=6 → digit 6).

export const PANA_CHART: Record<number, string[]> = {
  0: ["550", "668", "244", "299", "226", "488", "677", "118", "334", "000"],
  1: ["100", "119", "155", "227", "335", "344", "399", "588", "669", "111"],
  2: ["200", "110", "228", "255", "336", "499", "660", "688", "778", "222"],
  3: ["300", "166", "229", "337", "355", "445", "599", "779", "788", "333"],
  4: ["400", "112", "220", "266", "338", "446", "455", "699", "889", "444"],
  5: ["500", "113", "122", "177", "339", "366", "447", "799", "889", "555"],
  6: ["600", "114", "123", "258", "456", "357", "269", "799", "889", "666"],
  7: ["700", "115", "133", "188", "223", "377", "459", "367", "899", "777"],
  8: ["800", "116", "224", "233", "288", "440", "466", "558", "577", "888"],
  9: ["900", "117", "144", "199", "225", "333", "388", "559", "577", "999"],
};

export type PanaType = "SINGLE" | "DOUBLE" | "TRIPLE";

export function digitFromPana(pana: string): number {
  const sum = pana.split("").reduce((s, d) => s + Number(d), 0);
  return sum % 10;
}

export function isValidPana(pana: string): boolean {
  if (!/^\d{3}$/.test(pana)) return false;
  const d = digitFromPana(pana);
  return PANA_CHART[d]?.includes(pana) ?? false;
}

export function panaType(pana: string): PanaType {
  const [a, b, c] = pana.split("");
  if (a === b && b === c) return "TRIPLE";
  if (a === b || b === c || a === c) return "DOUBLE";
  return "SINGLE";
}

export const ALL_PANAS: string[] = Array.from(
  new Set(Object.values(PANA_CHART).flat())
);

/** Permutations of a string (small N=3 only). */
function permutations(arr: string[]): string[][] {
  if (arr.length <= 1) return [arr];
  const out: string[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutations(rest)) out.push([arr[i]!, ...p]);
  }
  return out;
}

/** Suggest up to 5 valid panas using the same digits as the (invalid) input. */
export function getSuggestedPanas(input: string): string[] {
  if (!/^\d{3}$/.test(input)) return [];
  const seen = new Set<string>();
  for (const p of permutations(input.split(""))) {
    const s = p.join("");
    if (isValidPana(s)) seen.add(s);
  }
  return Array.from(seen).slice(0, 5);
}

/** All valid panas for a given digit, grouped by type. */
export function getPanasForDigit(d: number): {
  single: string[]; double: string[]; triple: string[];
} {
  const all = PANA_CHART[d] ?? [];
  return {
    single: all.filter((p) => panaType(p) === "SINGLE"),
    double: all.filter((p) => panaType(p) === "DOUBLE"),
    triple: all.filter((p) => panaType(p) === "TRIPLE"),
  };
}

export const PANA_TYPE_BADGE: Record<PanaType, { label: string; className: string }> = {
  SINGLE: { label: "SP", className: "bg-secondary/20 text-secondary border-secondary/40" },
  DOUBLE: { label: "DP", className: "bg-accent/20 text-accent border-accent/40" },
  TRIPLE: { label: "TP", className: "bg-primary/20 text-primary border-primary/40" },
};
