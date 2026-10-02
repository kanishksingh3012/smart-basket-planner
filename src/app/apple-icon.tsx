import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon: the app's orange tile. */
export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#fc8019", color: "#2a1203", fontSize: 96, fontWeight: 700 }}>B</div>,
    size,
  );
}
