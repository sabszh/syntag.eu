export const LANGUAGES = {
  en: { name: "English", labels: { involved: "AI", generated: "AI GENERATED", modified: "AI MODIFIED" } },
  da: { name: "Dansk", labels: { involved: "AI", generated: "AI-GENERERET", modified: "AI-ÆNDRET" } },
  de: { name: "Deutsch", labels: { involved: "AI", generated: "KI-GENERIERT", modified: "KI-MODIFIZIERT" } },
  fr: { name: "Français", labels: { involved: "AI", generated: "IA GÉNÉRÉE", modified: "IA MODIFIÉE" } },
  es: { name: "Español", labels: { involved: "AI", generated: "IA GENERADA", modified: "IA MODIFICADA" } },
  it: { name: "Italiano", labels: { involved: "AI", generated: "IA GENERATA", modified: "IA MODIFICATA" } },
  nl: { name: "Nederlands", labels: { involved: "AI", generated: "AI-GEGENEREERD", modified: "AI-AANGEPAST" } },
  pl: { name: "Polski", labels: { involved: "AI", generated: "AI WYGENEROWANE", modified: "AI ZMODYFIKOWANE" } },
};

export function getLabel(level, language = "en") {
  return LANGUAGES[language]?.labels[level] || LANGUAGES.en.labels[level];
}
