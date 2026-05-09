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

export function digitFromPana(pana: string): number {
  const sum = pana.split("").reduce((s, d) => s + Number(d), 0);
  return sum % 10;
}

export function isValidPana(pana: string): boolean {
  if (!/^\d{3}$/.test(pana)) return false;
  const d = digitFromPana(pana);
  return PANA_CHART[d]?.includes(pana) ?? false;
}

export function panaType(pana: string): "SINGLE" | "DOUBLE" | "TRIPLE" {
  const [a, b, c] = pana.split("");
  if (a === b && b === c) return "TRIPLE";
  if (a === b || b === c || a === c) return "DOUBLE";
  return "SINGLE";
}

export const ALL_PANAS: string[] = Array.from(
  new Set(Object.values(PANA_CHART).flat())
);
