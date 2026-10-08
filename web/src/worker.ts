import initWasm, {
  get_model_registry,
  separate,
  validate_model_weights,
} from "./wasm/demucs_wasm.js";

let wasmReady: Promise<unknown>;

self.onmessage = async (e: MessageEvent) => {
  const { type, id, ...data } = e.data;

  try {
    switch (type) {
      case "init": {
        wasmReady = initWasm({ module_or_path: data.wasmUrl });
        await wasmReady;
        self.postMessage({ id, type: "init", registry: get_model_registry() });
        break;
      }

      case "validate": {
        await wasmReady;
        const result = validate_model_weights(data.bytes, data.modelId);
        self.postMessage({ id, type: "validate", result });
        break;
      }

      case "separate": {
        await wasmReady;
        const onProgress = (event: Record<string, unknown>) => {
          self.postMessage({ type: "progress", event });
        };
        const result = await separate(
          data.modelBytes,
          data.modelId,
          data.stems,
          data.left,
          data.right,
          data.sampleRate,
          onProgress,
        );
        // Read getters before take_audio() consumes the result
        const stemNames: string[] = result.stem_names();
        const nSamples = result.n_samples;
        const numStems = result.num_stems;
        const audio = result.take_audio();
        self.postMessage(
          { id, type: "separate", audio, stemNames, nSamples, numStems },
          { transfer: [audio.buffer] },
        );
        break;
      }
    }
  } catch (err) {
    self.postMessage({
      id,
      type: "error",
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
