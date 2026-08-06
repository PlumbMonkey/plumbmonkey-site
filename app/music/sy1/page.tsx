import type { Metadata } from "next";
import InstrumentEmbed from "../InstrumentEmbed";

export const metadata: Metadata = {
  title: "SY-2 Polyphonic Synthesizer",
  description:
    "Play the tactile SY-2 polyphonic synthesizer from Stave directly in your browser.",
};

export default function SY1Page() {
  return (
    <InstrumentEmbed
      title="SY-2 Polyphonic Synthesizer"
      source="/music/stave/index.html"
    />
  );
}
