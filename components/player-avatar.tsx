type PlayerAvatarProps = {
  name: string;
  sizeClassName?: string;
  className?: string;
};

function getFallbackLabel(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return "選";
  }

  return trimmed.slice(0, 1).toUpperCase();
}

export function PlayerAvatar({
  name,
  sizeClassName = "h-12 w-12",
  className = "",
}: PlayerAvatarProps) {
  return (
    <div
      className={`overflow-hidden rounded-full border border-white/12 bg-white/[0.06] ${sizeClassName} ${className}`}
    >
      <div className="flex h-full w-full items-center justify-center text-sm text-white/50">
        {getFallbackLabel(name)}
      </div>
    </div>
  );
}
