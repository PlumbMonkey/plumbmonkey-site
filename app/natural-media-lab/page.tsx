import type { Metadata } from "next";
import NaturalMediaLab from "./NaturalMediaLab";

export const metadata: Metadata = {
  title: "The Art Room",
  description:
    "A free browser-based painting studio inspired by pencil, charcoal, ink, watercolor, and other natural media.",
};

export default function NaturalMediaLabPage() {
  return <NaturalMediaLab />;
}
