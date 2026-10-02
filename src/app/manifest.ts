import type { MetadataRoute } from "next";

/** Lets the app be added to a phone's home screen and open full-screen, without browser bars. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Smart Basket Planner",
    short_name: "Basket Planner",
    start_url: "/",
    display: "standalone",
    background_color: "#faf7f4",
    theme_color: "#fc8019",
    icons: [{ src: "/apple-icon", sizes: "180x180", type: "image/png" }],
  };
}
