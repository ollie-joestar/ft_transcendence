import { useEffect, useRef, useState } from "react";

export function useBackgroundMusic(src: string, volume = 0.35) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = volume;
    audioRef.current = audio;

    // browsers block autoplay until the user interacts with the page
    // we try anyway lol.  if it's blocked we just stay silent until they click
    audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => {});

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [src, volume]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => {});
    }
  };

  return { playing, toggle };
}
