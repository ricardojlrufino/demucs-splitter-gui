import { useState } from "react";
import { loadSetting, saveSetting } from "../lib/backend";

export const FORMAT_LABELS: Record<string, string> = {
  ogg: "OGG Vorbis (alta qualidade, arquivo menor)",
  "ogg-max": "OGG Vorbis (máxima, arquivo grande)",
  mp3: "MP3 (V0, mais compatível)",
  wav: "WAV (sem perdas)",
};

/** Extensão do arquivo para um formato ("ogg-max" também é .ogg). */
export const extOf = (format: string) => (format === "ogg-max" ? "ogg" : format);

/** Formato de exportação escolhido (lembrado entre execuções); cai no melhor disponível se o salvo não existir. */
export function useExportFormat(formats: string[]): [string, (f: string) => void] {
  const [format, setFormat] = useState(() => {
    const saved = loadSetting("exportFormat", "");
    return formats.includes(saved) ? saved : (formats[0] ?? "wav");
  });
  return [
    format,
    (f) => {
      setFormat(f);
      saveSetting("exportFormat", f);
    },
  ];
}

export function FormatSelect({
  formats,
  value,
  onChange,
}: {
  formats: string[];
  value: string;
  onChange: (f: string) => void;
}) {
  return (
    <label className="format">
      Formato
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {formats.map((f) => (
          <option key={f} value={f}>{FORMAT_LABELS[f] ?? f.toUpperCase()}</option>
        ))}
      </select>
    </label>
  );
}
