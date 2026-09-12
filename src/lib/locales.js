export const LANGUAGES = {
  en: { name: "English", labels: { involved: "AI INVOLVED", generated: "AI GENERATED", modified: "AI MODIFIED" } },
  da: { name: "Dansk", labels: { involved: "AI INVOLVERET", generated: "AI-GENERERET", modified: "AI-ÆNDRET" } },
  de: { name: "Deutsch", labels: { involved: "KI BETEILIGT", generated: "KI-GENERIERT", modified: "KI-MODIFIZIERT" } },
  fr: { name: "Français", labels: { involved: "IA IMPLIQUÉE", generated: "IA GÉNÉRÉE", modified: "IA MODIFIÉE" } },
  es: { name: "Español", labels: { involved: "IA INVOLUCRADA", generated: "IA GENERADA", modified: "IA MODIFICADA" } },
  it: { name: "Italiano", labels: { involved: "IA COINVOLTA", generated: "IA GENERATA", modified: "IA MODIFICATA" } },
  nl: { name: "Nederlands", labels: { involved: "AI BETROKKEN", generated: "AI-GEGENEREERD", modified: "AI-AANGEPAST" } },
  pl: { name: "Polski", labels: { involved: "AI UŻYTE", generated: "AI WYGENEROWANE", modified: "AI ZMODYFIKOWANE" } },
};

export function getLabel(level, language = "en") {
  return LANGUAGES[language]?.labels[level] || LANGUAGES.en.labels[level];
}
