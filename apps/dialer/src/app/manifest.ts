import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Web Dialer",
    short_name: "Dialer",
    description: "Outbound dialer for local lead calling",
    start_url: "/",
    display: "standalone",
    background_color: "#050608",
    theme_color: "#050608",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
