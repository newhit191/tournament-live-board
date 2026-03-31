type LiveArenaBackdropProps = {
  active: boolean;
};

export function LiveArenaBackdrop({ active }: LiveArenaBackdropProps) {
  return (
    <>
      <div
        aria-hidden="true"
        className={`arena-backdrop ${active ? "arena-backdrop-active" : ""}`}
      >
        <div className="arena-shell" />
        <div className="arena-shell-glass" />
        <div className="arena-core-glow" />
        <div className="arena-ring arena-ring-outer" />
        <div className="arena-ring arena-ring-inner" />
        <div className="arena-center-bowl" />
        <div className="arena-rail-track" />
        <div className="arena-rail-track arena-rail-track-secondary" />
        <div className="arena-gear-ring arena-gear-ring-a" />
        <div className="arena-gear-ring arena-gear-ring-b" />
        <div className="arena-energy-track" />
        <div className="arena-rail-runner arena-rail-runner-a" />
        <div className="arena-rail-runner arena-rail-runner-b" />
        <div className="arena-top arena-top-a" />
        <div className="arena-top arena-top-b" />
      </div>

      <div className={`arena-impact-layer ${active ? "arena-impact-layer-active" : ""}`}>
        <div className="arena-clash-flash arena-clash-flash-a" />
        <div className="arena-clash-flash arena-clash-flash-b" />
        <div className="arena-clash-spark arena-clash-spark-a" />
        <div className="arena-clash-spark arena-clash-spark-b" />
      </div>
    </>
  );
}
