export default function Footer() {
  return (
    <footer id="about" className="bg-moonlit-900/80 px-6 py-20">
      <div className="flex flex-col items-center">
        <img
          src="/assets/headshot-02.png"
          alt="G — Studio Owner"
          className="mb-6 w-32 rounded-full border-4 border-moonlit-800 shadow-lg"
        />
        <h2 className="mb-4 font-display text-2xl font-semibold">About Plumbmonkey</h2>
        <p className="mb-6 max-w-2xl text-center text-lg">
          Audio-visual alchemy for the algorithmic age — offering pure human craft, ethical AI, or a
          fusion of both.
          <br />
          <span className="opacity-80">All music by Gregg — creative lifer, open to all projects.</span>
        </p>
        <div className="flex space-x-6">
          <a
            href="https://www.youtube.com/@PlumbmonkeyMedia"
            target="_blank"
            rel="noopener"
            aria-label="YouTube"
            className="text-moonlit-50 transition hover:text-brass-400"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="36" height="36" viewBox="0 0 24 24">
              <path d="M23.498 6.186a2.959 2.959 0 0 0-2.085-2.098C19.382 3.547 12 3.547 12 3.547s-7.382 0-9.413.541A2.959 2.959 0 0 0 .502 6.186C0 8.228 0 12 0 12s0 3.772.502 5.814a2.959 2.959 0 0 0 2.085 2.098c2.031.541 9.413.541 9.413.541s7.382 0 9.413-.541a2.959 2.959 0 0 0 2.085-2.098C24 15.772 24 12 24 12s0-3.772-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
          </a>
          <a
            href="https://www.facebook.com/plumbmonkeymedia/"
            target="_blank"
            rel="noopener"
            aria-label="Facebook"
            className="text-moonlit-50 transition hover:text-brass-400"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="36" height="36" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.849.07 1.366.062 2.633.354 3.608 1.329.974.975 1.267 2.243 1.329 3.608.058 1.265.069 1.645.069 4.83s-.012 3.565-.069 4.83c-.062 1.366-.354 2.633-1.329 3.608-.975.974-2.243 1.267-3.608 1.329-1.265.058-1.645.069-4.83.069s-3.565-.012-4.83-.069c-1.366-.062-2.633-.354-3.608-1.329-.974-.975-1.267-2.243-1.329-3.608C2.175 15.634 2.163 15.254 2.163 12s.012-3.565.069-4.83c.062-1.366.354-2.633 1.329-3.608.975-.974 2.243-1.267 3.608-1.329C8.435 2.175 8.815 2.163 12 2.163zm0-2.163C8.741 0 8.332.012 7.053.07 5.678.127 4.415.423 3.393 1.445c-1.023 1.022-1.319 2.285-1.375 3.66C1.012 8.334 1 8.742 1 12c0 3.259.012 3.668.07 4.947.056 1.375.352 2.638 1.375 3.66 1.022 1.023 2.285 1.319 3.66 1.375C8.334 22.988 8.742 23 12 23c3.259 0 3.668-.012 4.947-.07 1.375-.056 2.638-.352 3.66-1.375 1.023-1.022 1.319-2.285 1.375-3.66.058-1.279.07-1.688.07-4.947 0-3.259-.012-3.668-.07-4.947-.056-1.375-.352-2.638-1.375-3.66C19.334 1.423 18.072 1.127 16.697 1.07 15.418 1.012 15.009 1 12 1z" />
              <circle cx="12" cy="12" r="3.5" />
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
}
