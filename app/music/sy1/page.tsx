import type { Metadata } from "next";
import InstrumentEmbed from "../InstrumentEmbed";

export const metadata: Metadata = {
  title: "SY-1 Polyphonic Synthesizer",
  description:
    "Play the tactile SY-1 polyphonic synthesizer from Stave directly in your browser.",
};

export default function SY1Page() {
  return (
    <InstrumentEmbed
      title="SY-1 Polyphonic Synthesizer"
      source="https://stave-sy1-prototype.plumbmonkeyg.chatgpt.site/"
    />
  );
}
