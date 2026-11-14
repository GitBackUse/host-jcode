import { createFileRoute } from "@tanstack/react-router";
import { Studio } from "@/components/Studio";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JCode Studio — AI app builder with your Gemini key" },
      { name: "description", content: "Describe an app and JCode writes, previews and ships it. Free, in your browser, powered by your own Gemini key." },
      { property: "og:title", content: "JCode Studio — AI app builder" },
      { property: "og:description", content: "Describe an app, get working code with live preview. Bring your own Gemini key." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Studio,
});

