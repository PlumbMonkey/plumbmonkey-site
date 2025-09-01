"use client";
import StickyCTA from './components/StickyCTA';

export default function Home() {
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold">Welcome to PlumbMonkey!</h1>
      <p className="mt-4">This is your Next.js site. Your sticky CTA should appear below!</p>
      <StickyCTA />
    </main>
  );
}