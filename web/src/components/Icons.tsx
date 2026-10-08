const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "currentColor",
  "aria-hidden": true,
} as const;

export const PlayIcon = () => (
  <svg {...base}><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>
);

export const PauseIcon = () => (
  <svg {...base}><rect x="6" y="5" width="4" height="14" rx="1.2" /><rect x="14" y="5" width="4" height="14" rx="1.2" /></svg>
);

export const StopIcon = () => (
  <svg {...base}><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
);

/** Rewind: two left-pointing triangles */
export const BackIcon = () => (
  <svg {...base}>
    <path d="M11.5 7.2v9.6a.8.8 0 0 1-1.25.66l-6.9-4.8a.8.8 0 0 1 0-1.32l6.9-4.8a.8.8 0 0 1 1.25.66z" />
    <path d="M20.5 7.2v9.6a.8.8 0 0 1-1.25.66l-6.9-4.8a.8.8 0 0 1 0-1.32l6.9-4.8a.8.8 0 0 1 1.25.66z" />
  </svg>
);

export const ForwardIcon = () => (
  <svg {...base}>
    <path d="M12.5 7.2v9.6a.8.8 0 0 0 1.25.66l6.9-4.8a.8.8 0 0 0 0-1.32l-6.9-4.8a.8.8 0 0 0-1.25.66z" />
    <path d="M3.5 7.2v9.6a.8.8 0 0 0 1.25.66l6.9-4.8a.8.8 0 0 0 0-1.32l-6.9-4.8A.8.8 0 0 0 3.5 7.2z" />
  </svg>
);

export const LoopIcon = () => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 2l4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="M7 22l-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </svg>
);

export const DownloadIcon = () => (
  <svg {...base} width={15} height={15} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12" />
    <path d="M7 11l5 5 5-5" />
    <path d="M5 20h14" />
  </svg>
);
