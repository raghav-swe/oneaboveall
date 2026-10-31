export default function PageHeader({
  eyebrow,
  title,
  live = false,
}: {
  eyebrow: string;
  title: string;
  live?: boolean;
}) {
  return (
    <header className="pb-2 pt-1">
      <div className="eyebrow flex items-center gap-2">
        {live && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-oaa-red opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-oaa-red" />
          </span>
        )}
        {eyebrow}
      </div>
      <h1 className="mt-3 bg-gradient-to-b from-white to-oaa-muted bg-clip-text font-display text-4xl font-semibold leading-[1.05] tracking-tight text-transparent md:text-6xl">
        {title}
      </h1>
    </header>
  );
}