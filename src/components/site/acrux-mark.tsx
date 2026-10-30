import type { SVGProps } from "react";

// The acrux mark: two chamfered halves, rotationally symmetric, meeting at
// their inner corners. 10-unit grid, 2-unit bars. Standalone files live in
// public/brand/; keep the path in sync.
export function AcruxMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 10 10" fill="currentColor" aria-hidden {...props}>
      <path d="M2 0h6l2 2v6H8V2H2ZM8 10H2L0 8V2h2v6h6Z" />
    </svg>
  );
}
