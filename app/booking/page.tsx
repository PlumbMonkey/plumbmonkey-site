import type { Metadata } from "next";
import BookingClient from "./BookingClient";

export const metadata: Metadata = {
  title: "Book a Production Slot | Plumbmonkey",
  description: "Secure your production slot with Plumbmonkey. Select your package and pay via Stripe.",
  robots: { index: false, follow: false },
};

export default function BookingPage() {
  return <BookingClient />;
}
