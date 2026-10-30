export default function AmbientBackground() {
  return <div aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-[var(--bg)]" />;
}