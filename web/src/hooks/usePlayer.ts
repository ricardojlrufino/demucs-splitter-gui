import { useCallback, useEffect, useRef, useState } from "react";
import { MultiPlayer, type Range } from "../audio/player";

/** Wraps a MultiPlayer, polling its clock on animation frames. */
export function usePlayer(ctx: AudioContext, buffers: AudioBuffer[], range: Range | null) {
  const ref = useRef<MultiPlayer | null>(null);
  if (!ref.current) ref.current = new MultiPlayer(ctx);
  const player = ref.current;
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoopState] = useState(false);

  useEffect(() => {
    player.setTracks(buffers);
    setTime(0);
    setPlaying(false);
  }, [player, buffers]);

  useEffect(() => {
    player.range = range;
  }, [player, range]);

  useEffect(() => {
    player.onStop = () => setPlaying(false);
    let raf = 0;
    const tick = () => {
      setTime(player.time);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      player.onStop = undefined;
    };
  }, [player]);

  useEffect(() => () => player.dispose(), [player]);

  const toggle = useCallback(async () => {
    if (player.playing) {
      player.pause();
      setPlaying(false);
    } else {
      await player.play();
      setPlaying(player.playing);
    }
  }, [player]);

  const stop = useCallback(() => {
    player.stop();
    setPlaying(false);
    setTime(player.time);
  }, [player]);

  const seek = useCallback(
    (t: number) => {
      player.seek(t);
      setTime(t);
    },
    [player],
  );

  const skip = useCallback((d: number) => seek(player.time + d), [player, seek]);

  const setLoop = useCallback(
    (v: boolean) => {
      player.loop = v;
      setLoopState(v);
    },
    [player],
  );

  return { player, time, playing, loop, toggle, stop, seek, skip, setLoop, duration: player.duration };
}
