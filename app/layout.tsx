import "../styles/globals.css";
import NavBar from "./components/NavBar";

export const metadata = {
  title: "plumbmonkey",
  description: "Video editing services — transparent pricing & booking",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full bg-zinc-950 text-zinc-50">
      <body className="min-h-screen antialiased">
        <NavBar />
        {children}
      </body>
    </html>
  );
}

