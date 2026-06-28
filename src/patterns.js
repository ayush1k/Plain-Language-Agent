const commonPatterns = [
  { regex: /\butilize\b/gi, pattern: /\butilize\b/gi, replacement: "use" },
  { regex: /\bimplement\b/gi, pattern: /\bimplement\b/gi, replacement: "do" },
  { regex: /\bfacilitate\b/gi, pattern: /\bfacilitate\b/gi, replacement: "help" },
  { regex: /\bcommence\b/gi, pattern: /\bcommence\b/gi, replacement: "start" },
  { regex: /\bterminate\b/gi, pattern: /\bterminate\b/gi, replacement: "end" },
  { regex: /\bsubsequent\b/gi, pattern: /\bsubsequent\b/gi, replacement: "next" },
  { regex: /\bdemonstrate\b/gi, pattern: /\bdemonstrate\b/gi, replacement: "show" },
  { regex: /\bindicate\b/gi, pattern: /\bindicate\b/gi, replacement: "show" },
  { regex: /\bapproximately\b/gi, pattern: /\bapproximately\b/gi, replacement: "about" },
  { regex: /\bsufficient\b/gi, pattern: /\bsufficient\b/gi, replacement: "enough" },
  { regex: /\bregarding\b/gi, pattern: /\bregarding\b/gi, replacement: "about" },
  { regex: /\bin order to\b/gi, pattern: /\bin order to\b/gi, replacement: "to" },
  { regex: /\bdue to the fact that\b/gi, pattern: /\bdue to the fact that\b/gi, replacement: "because" },
  { regex: /\bin the event that\b/gi, pattern: /\bin the event that\b/gi, replacement: "if" },
  { regex: /\bat this point in time\b/gi, pattern: /\bat this point in time\b/gi, replacement: "now" },
  { regex: /\bfor the purpose of\b/gi, pattern: /\bfor the purpose of\b/gi, replacement: "to" },
  { regex: /\bwith respect to\b/gi, pattern: /\bwith respect to\b/gi, replacement: "about" },
  { regex: /\bin accordance with\b/gi, pattern: /\bin accordance with\b/gi, replacement: "under" },
  { regex: /\bprior to\b/gi, pattern: /\bprior to\b/gi, replacement: "before" },
  { regex: /\bsubsequent to\b/gi, pattern: /\bsubsequent to\b/gi, replacement: "after" },
  { regex: /\bon a monthly basis\b/gi, pattern: /\bon a monthly basis\b/gi, replacement: "monthly" },
  { regex: /\bin the amount of\b/gi, pattern: /\bin the amount of\b/gi, replacement: "for" }
];

const grade6Specific = [
  { regex: /\badminister\b/gi, pattern: /\badminister\b/gi, replacement: "give" },
  { regex: /\bhypertension\b/gi, pattern: /\bhypertension\b/gi, replacement: "high blood pressure" },
  { regex: /\bmyocardial infarction\b/gi, pattern: /\bmyocardial infarction\b/gi, replacement: "heart attack" },
  { regex: /\blaceration\b/gi, pattern: /\blaceration\b/gi, replacement: "cut" },
  { regex: /\bfracture\b/gi, pattern: /\bfracture\b/gi, replacement: "broken bone" },
  { regex: /\binflammation\b/gi, pattern: /\binflammation\b/gi, replacement: "swelling" },
  { regex: /\bmedication\b/gi, pattern: /\bmedication\b/gi, replacement: "medicine" },
  { regex: /\bphysician\b/gi, pattern: /\bphysician\b/gi, replacement: "doctor" },
  { regex: /\bper annum\b/gi, pattern: /\bper annum\b/gi, replacement: "per year" }
];

const grade10Specific = [
  { regex: /\bhereinafter\b/gi, pattern: /\bhereinafter\b/gi, replacement: "from now on" },
  { regex: /\bpursuant to\b/gi, pattern: /\bpursuant to\b/gi, replacement: "under" },
  { regex: /\bnotwithstanding\b/gi, pattern: /\bnotwithstanding\b/gi, replacement: "even though" },
  { regex: /\bwhereas\b/gi, pattern: /\bwhereas\b/gi, replacement: "because" },
  { regex: /\baforementioned\b/gi, pattern: /\baforementioned\b/gi, replacement: "listed above" },
  { regex: /\btherein\b/gi, pattern: /\btherein\b/gi, replacement: "in it" },
  { regex: /\bheretofore\b/gi, pattern: /\bheretofore\b/gi, replacement: "until now" }
];

const grade6 = [
  ...commonPatterns,
  ...grade6Specific,
  ...grade10Specific
];

const grade8 = [
  ...commonPatterns,
  ...grade6Specific
];

const grade10 = [
  ...commonPatterns,
  ...grade10Specific
];

const patterns = {
  grade6,
  grade8,
  grade10
};

export default patterns;

export function getPatternsForStyle(style) {
  if (style === "casual" || style === "creative" || style === "grade6") {
    return patterns.grade6;
  }
  if (style === "formal" || style === "professional" || style === "technical" || style === "business" || style === "grade10") {
    return patterns.grade10;
  }
  return patterns.grade8;
}

export const fillerPatterns = [
  /\bvery very\b/gi,
  /\breally really\b/gi,
  /\bquite quite\b/gi,
  /\bso so\b/gi
];
