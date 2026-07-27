import type { Metadata } from "next";
import InstrumentEmbed from "../InstrumentEmbed";

export const metadata: Metadata = {
  title: "DM-1 Rhythm Machine",
  description:
    "Build and perform beats with the tactile DM-1 rhythm machine from Stave.",
};

export default function DM1Page() {
  return (
    <InstrumentEmbed
      title="DM-1 Rhythm Machine"
      source="https://stave-sy1-prototype.plumbmonkeyg.chatgpt.site/dm1"
    />
  );
}
