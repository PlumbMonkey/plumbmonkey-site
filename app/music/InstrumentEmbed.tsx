type InstrumentEmbedProps = {
  title: string;
  source: string;
};

/**
 * Wraps a standalone Stave instrument in a React route so it inherits the site
 * chrome. `source` must name index.html explicitly rather than ending in a
 * directory slash: `next dev` serves public/ by exact path and does not resolve
 * a directory to its index, so "/music/stave/dm2/" 404'd into the not-found
 * page — which, being a Next route, rendered a second NavBar inside the frame.
 * The instrument pages themselves skip their own bar when framed (site-nav.js).
 */
export default function InstrumentEmbed({ title, source }: InstrumentEmbedProps) {
  return (
    <main className="min-h-screen bg-[#d7d0c4] pt-16">
      <iframe
        src={source}
        title={title}
        className="block h-[calc(100svh-4rem)] min-h-[680px] w-full border-0"
        allow="autoplay; midi"
      />
      <p className="sr-only">
        If the instrument does not load,{" "}
        <a href={source} target="_blank" rel="noopener noreferrer">
          open {title} directly
        </a>
        .
      </p>
    </main>
  );
}
