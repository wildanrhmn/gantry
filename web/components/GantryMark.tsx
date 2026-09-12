/**
 * The Gantry mark.
 *
 * One circle, cut in two by the reader. On the left it is hollow, on the right it is solid:
 * the same swap before and after the hook has priced it. The bar is the gantry it passes.
 *
 * Two circles and a rule, no path data, so it stays exact at any size.
 */
export function GantryMark({
  size = 24,
  className,
  tone = "currentColor",
  reader,
}: {
  size?: number;
  className?: string;
  tone?: string;
  /** The bar, when it should read as the accent rather than part of the mark. */
  reader?: string;
}) {
  // Masks are global to the document, so the id has to vary with what is drawn.
  const id = `gm-${size}-${tone}-${reader ?? "t"}`.replace(/[^a-zA-Z0-9-]/g, "");

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <mask id={`${id}-l`}>
        <rect width="24" height="24" fill="#000" />
        <rect x="0" y="0" width="10.55" height="24" fill="#fff" />
      </mask>
      <mask id={`${id}-r`}>
        <rect width="24" height="24" fill="#000" />
        <rect x="13.45" y="0" width="10.55" height="24" fill="#fff" />
      </mask>

      {/* before it is read */}
      <circle
        cx="12"
        cy="12"
        r="7.4"
        fill="none"
        stroke={tone}
        strokeWidth="2.8"
        mask={`url(#${id}-l)`}
      />
      {/* after */}
      <circle cx="12" cy="12" r="7.4" fill={tone} mask={`url(#${id}-r)`} />
      {/* the reader */}
      <rect x="11.1" y="3" width="1.8" height="18" rx="0.9" fill={reader ?? tone} />
    </svg>
  );
}
