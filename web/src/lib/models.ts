export type StemId = "drums" | "bass" | "other" | "vocals" | "guitar" | "piano";

export interface ModelVariant {
  /** Nome do modelo no Demucs (`-n`). */
  id: string;
  label: string;
  description: string;
  sizeMb: number;
  stems: StemId[];
}

export const MODELS: readonly ModelVariant[] = [
  {
    id: "htdemucs",
    label: "Standard",
    description: "4 pistas — equilíbrio entre velocidade e qualidade",
    sizeMb: 84,
    stems: ["drums", "bass", "other", "vocals"],
  },
  {
    id: "htdemucs_6s",
    label: "6-Stem",
    description: "6 pistas — adiciona guitarra e piano",
    sizeMb: 84,
    stems: ["drums", "bass", "other", "vocals", "guitar", "piano"],
  },
  {
    id: "htdemucs_ft",
    label: "Fine-Tuned",
    description: "4 pistas — melhor qualidade, porém bem mais lento",
    sizeMb: 333,
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
