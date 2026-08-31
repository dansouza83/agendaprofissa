import type { Metadata } from "next";
import { TourVideoClient } from "./tour-video-client";
import "./tour-video.css";
import "./phone-modern.css";

export const metadata: Metadata = {
  title: "Demonstração visual — Agenda Profissa",
  robots: { index: false, follow: false },
};

export default function TourVideoPage() {
  return <TourVideoClient />;
}
