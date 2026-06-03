import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #0a0c10 0%, #12151c 48%, #050608 100%)",
          borderRadius: 40,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 118,
            height: 118,
            borderRadius: 36,
            background: "linear-gradient(160deg, #3ee8a8 0%, #22c58a 55%, #14966a 100%)",
            boxShadow: "0 18px 40px rgba(34, 197, 138, 0.35)",
          }}
        >
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M6.6 3.8c-.6.3-1.1.9-1.3 1.5L3.8 8.2c-.3.7-.1 1.5.5 2l2.1 2.1c3.1 3.1 5.6 5.6 8.7 8.7l2.1 2.1c.5.6 1.3.8 2 .5l2.9-1.5c.6-.3 1.2-.8 1.5-1.3l1.1-2.3c.2-.5 0-1-.4-1.3l-3.5-2.6c-.4-.3-.9-.3-1.3-.1l-1.5.7c-1 .4-2.2 0-2.9-.9L10.3 9.4c-.7-.7-1.3-1.9-.9-2.9l.7-1.5c.2-.4.2-.9-.1-1.3L7.9 3.1c-.3-.5-.8-.7-1.3-.5l-2.3 1.1z"
              fill="#050608"
            />
          </svg>
        </div>
      </div>
    ),
    { ...size },
  );
}
