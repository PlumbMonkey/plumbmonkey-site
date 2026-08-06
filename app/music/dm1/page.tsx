import type { Metadata } from "next";
import InstrumentEmbed from "../InstrumentEmbed";

export const metadata: Metadata = {
  title: "DM-2 Rhythm Machine",
  description:
    "Build and perform beats with the tactile DM-2 rhythm machine from Stave.",
};

export default function DM1Page() {
  return (
    <InstrumentEmbed
      title="DM-2 Rhythm Machine"
      source="/music/stave/dm2/index.html"
    />
  );
}
