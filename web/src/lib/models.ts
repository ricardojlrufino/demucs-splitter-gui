export type StemId = "drums" | "bass" | "other" | "vocals" | "guitar" | "piano";

export interface ModelVariant {
  /** Nome do modelo no Demucs (`-n`). */
  id: string;
  label: string;
  description: string;
  stems: StemId[];
}

export const MODELS: readonly ModelVariant[] = [
  {
    id: "htdemucs",
    label: "Standard",
    description: "4 pistas",
    stems: ["drums", "bass", "other", "vocals"],
  },
  {
    id: "htdemucs_6s",
    label: "6-Stem",
    description: "6 pistas, com guitarra e piano",
    stems: ["drums", "bass", "other", "vocals", "guitar", "piano"],
  },
  {
    id: "htdemucs_ft",
    label: "Fine-Tuned",
    description: "4 pistas, melhor qualidade (mais lento)",
    stems: ["drums", "bass", "other", "vocals"],
  },
];

export const STEM_LABELS: Record<StemId, string> = {
  drums: "Bateria",
  bass: "Baixo",
  other: "Outros",
  vocals: "Vocais",
  guitar: "Guitarra",
  piano: "Piano",
};

export type Device = "auto" | "cuda" | "cpu" | "mps";
