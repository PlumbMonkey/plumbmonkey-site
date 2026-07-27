type InstrumentEmbedProps = {
  title: string;
  source: string;
};

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
