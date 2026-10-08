export type GpuStatus = "checking" | "ok" | "unsupported" | "no-adapter";

/** Probes WebGPU: API present and an adapter can actually be obtained. */
export async function detectWebGpu(): Promise<GpuStatus> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (!gpu) return "unsupported";
  try {
    return (await gpu.requestAdapter()) ? "ok" : "no-adapter";
  } catch {
    return "no-adapter";
  }
}
