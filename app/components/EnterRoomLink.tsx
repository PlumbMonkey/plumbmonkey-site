"use client";

import { useRef } from "react";

type EnterRoomLinkProps = {
  /** The viewer page, e.g. /gallery/viewer.html */
  href: string;
  /** The model that viewer will download, e.g. /gallery/gallery-web.glb */
  model: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * The "Enter the …" button for a 3D room, which starts fetching the room's
 * model as soon as the visitor shows intent.
 *
 * Both rooms are multi-megabyte glTF downloads, and measurement showed the wait
 * is dominated by that transfer for real visitors (locally, where there is no
 * network, the same model parses in ~200 ms). Nothing about the model can be
 * made much smaller without hurting what people came to look at — so instead
 * the download starts on hover/focus rather than on click, which buys back the
 * time between "thinking about it" and "clicking".
 *
 * Deliberately NOT prefetched on page load: these are several MB, and most of
 * the room page's visitors never click through. Hover, focus and touchstart are
 * all real intent signals; touchstart only gives a moment's head start, but it
 * costs nothing.
 */
export default function EnterRoomLink({ href, model, className, children }: EnterRoomLinkProps) {
  const started = useRef(false);

  const warm = () => {
    if (started.current) return;
    started.current = true;

    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "fetch";
    link.href = model;
    // Must match how GLTFLoader requests it, or the browser keeps two copies
    // and the prefetch is wasted.
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  };

  return (
    <a
      href={href}
      className={className}
      onPointerEnter={warm}
      onFocus={warm}
      onTouchStart={warm}
    >
      {children}
    </a>
  );
}
