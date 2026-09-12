import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** The favicon is the mark, drawn from the same geometry rather than a checked-in file. */
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", background: "#17181e", width: "100%", height: "100%" }}>
        <svg width="32" height="32" viewBox="0 0 24 24">
          <mask id="l">
            <rect width="24" height="24" fill="#000" />
            <rect x="0" y="0" width="10.55" height="24" fill="#fff" />
          </mask>
          <mask id="r">
            <rect width="24" height="24" fill="#000" />
            <rect x="13.45" y="0" width="10.55" height="24" fill="#fff" />
          </mask>
          <circle cx="12" cy="12" r="7.4" fill="none" stroke="#dcdce3" strokeWidth="2.8" mask="url(#l)" />
          <circle cx="12" cy="12" r="7.4" fill="#dcdce3" mask="url(#r)" />
          <rect x="11.1" y="3" width="1.8" height="18" rx="0.9" fill="#d9457e" />
        </svg>
      </div>
    ),
    size,
  );
}
