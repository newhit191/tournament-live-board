"use client";

import { useEffect, useState } from "react";

type Track = {
  id: string;
  title: string;
  src: string;
};

type PlayMode = "loop-all" | "shuffle" | "loop-one";

const TRACKS: Track[] = [
  {
    id: "steel-arena",
    title: "鋼鐵擂台稱王",
    src: "/bgm/steel-arena.mp3",
  },
  {
    id: "eternal-flame",
    title: "永不凋零的火",
    src: "/bgm/eternal-flame.mp3",
  },
  {
    id: "iron-axis-momentum",
    title: "Iron Axis Momentum",
    src: "/bgm/iron-axis-momentum.mp3",
  },
  {
    id: "mixkit-dirty-thinkin-989",
    title: "mixkit dirty thinkin 989",
    src: "/bgm/mixkit-dirty-thinkin-989.mp3",
  },
  {
    id: "mixkit-sports-highlights-51",
    title: "mixkit sports highlights 51",
    src: "/bgm/mixkit-sports-highlights-51.mp3",
  },
  {
    id: "three-second-bond",
    title: "三秒羈絆",
    src: "/bgm/three-second-bond.mp3",
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getNextShuffleIndex(currentIndex: number, total: number) {
  if (total <= 1) {
    return currentIndex;
  }

  let nextIndex = currentIndex;

  while (nextIndex === currentIndex) {
    nextIndex = Math.floor(Math.random() * total);
  }

  return nextIndex;
}

export function BackgroundMusicPlayer() {
  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.45);
  const [muted, setMuted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [playMode, setPlayMode] = useState<PlayMode>("loop-all");
  const [errorMessage, setErrorMessage] = useState("");

  const activeTrack = TRACKS[trackIndex] ?? TRACKS[0];

  useEffect(() => {
    const audio = document.getElementById("tlb-bgm-audio") as HTMLAudioElement | null;

    if (!audio) {
      return;
    }

    audio.volume = clamp(volume, 0, 1);
    audio.muted = muted;
    audio.loop = playMode === "loop-one";
  }, [volume, muted, playMode]);

  useEffect(() => {
    const audio = document.getElementById("tlb-bgm-audio") as HTMLAudioElement | null;

    if (!audio) {
      return;
    }

    if (!playing) {
      audio.pause();
      return;
    }

    void audio.play().catch(() => {
      setErrorMessage("瀏覽器擋下自動播放，請再按一次播放。");
    });
  }, [playing, trackIndex]);

  const switchToTrack = (nextIndex: number) => {
    setErrorMessage("");
    setTrackIndex((nextIndex + TRACKS.length) % TRACKS.length);
  };

  const goPrev = () => {
    if (playMode === "shuffle") {
      switchToTrack(getNextShuffleIndex(trackIndex, TRACKS.length));
      return;
    }

    switchToTrack(trackIndex - 1);
  };

  const goNext = () => {
    if (playMode === "shuffle") {
      switchToTrack(getNextShuffleIndex(trackIndex, TRACKS.length));
      return;
    }

    switchToTrack(trackIndex + 1);
  };

  const handleEnded = () => {
    if (playMode === "loop-one") {
      return;
    }

    if (playMode === "shuffle") {
      switchToTrack(getNextShuffleIndex(trackIndex, TRACKS.length));
      return;
    }

    switchToTrack(trackIndex + 1);
  };

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50">
      <div className="pointer-events-auto rounded-2xl border border-white/15 bg-black/60 p-3 shadow-2xl backdrop-blur-xl">
        <audio
          id="tlb-bgm-audio"
          src={activeTrack.src}
          preload="metadata"
          onEnded={handleEnded}
          onError={() => {
            setPlaying(false);
            setErrorMessage(`讀不到音檔：${activeTrack.title}`);
          }}
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="rounded-full border border-white/15 px-3 py-1 text-xs tracking-[0.2em] text-white/80 transition hover:bg-white/10"
          >
            BGM
          </button>

          <button
            type="button"
            onClick={goPrev}
            className="rounded-full border border-white/15 px-2 py-1 text-xs text-white/80 transition hover:bg-white/10"
            aria-label="上一首"
          >
            ◀
          </button>

          <button
            type="button"
            onClick={() => {
              setErrorMessage("");
              setPlaying((current) => !current);
            }}
            className="rounded-full border border-amber-300/35 bg-amber-300/15 px-3 py-1 text-xs tracking-[0.2em] text-amber-100 transition hover:bg-amber-300/25"
          >
            {playing ? "暫停" : "播放"}
          </button>

          <button
            type="button"
            onClick={goNext}
            className="rounded-full border border-white/15 px-2 py-1 text-xs text-white/80 transition hover:bg-white/10"
            aria-label="下一首"
          >
            ▶
          </button>
        </div>

        {expanded ? (
          <div className="mt-3 w-[300px] space-y-2 border-t border-white/10 pt-3">
            <p className="truncate text-xs tracking-[0.22em] text-cyan-200">
              目前播放：{activeTrack.title}
            </p>

            <div className="grid grid-cols-3 gap-2">
              <ModeButton
                active={playMode === "loop-all"}
                label="全循環"
                onClick={() => setPlayMode("loop-all")}
              />
              <ModeButton
                active={playMode === "shuffle"}
                label="隨機"
                onClick={() => setPlayMode("shuffle")}
              />
              <ModeButton
                active={playMode === "loop-one"}
                label="單曲循環"
                onClick={() => setPlayMode("loop-one")}
              />
            </div>

            <label className="mt-2 block text-[11px] tracking-[0.2em] text-white/55">
              音量 {Math.round(volume * 100)}%
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(volume * 100)}
                onChange={(event) => setVolume(Number(event.target.value) / 100)}
                className="mt-2 w-full accent-amber-300"
              />
            </label>

            <button
              type="button"
              onClick={() => setMuted((current) => !current)}
              className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/75 transition hover:bg-white/10"
            >
              {muted ? "取消靜音" : "靜音"}
            </button>

            <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-black/25 p-2">
              {TRACKS.map((track, index) => (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => switchToTrack(index)}
                  className={`block w-full rounded-lg px-2 py-1 text-left text-xs transition ${
                    index === trackIndex
                      ? "bg-amber-300/18 text-amber-100"
                      : "text-white/70 hover:bg-white/8"
                  }`}
                >
                  {index + 1}. {track.title}
                </button>
              ))}
            </div>

            {errorMessage ? (
              <p className="text-[11px] text-amber-200">{errorMessage}</p>
            ) : (
              <p className="text-[11px] text-white/45">
                播放順序已依你提供的 5 首歌設定完成。
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ModeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2 py-1 text-[11px] transition ${
        active
          ? "border-amber-300/40 bg-amber-300/20 text-amber-100"
          : "border-white/15 text-white/70 hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );
}
