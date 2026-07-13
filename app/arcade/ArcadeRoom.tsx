"use client";

import { useEffect, useState } from "react";

type Entry = { i: string; s: number };
type HofRow = Entry & { game: string };

const GAMES = [
  { slug: "spectral-manor-revenger",          title: "Revenger",         tag: "Defend the concert",   accent: "#c084fc", bg: "#0a0612" },
  { slug: "spectral-food-fight",              title: "Mess Hall",        tag: "Guard the buffet",     accent: "#f0abfc", bg: "#12091f" },
  { slug: "spectral-robotron",                title: "Swarm",            tag: "Save the fans",        accent: "#22d3ee", bg: "#0b0614" },
  { slug: "spectral-skyline",                 title: "Luno's Flight",    tag: "Joust the witches",    accent: "#fbbf24", bg: "#0a0618" },
  { slug: "spectral-manor-soul-circuit",      title: "Soul Circuit",     tag: "Haunted hedge maze",   accent: "#e879f9", bg: "#0a0614" },
  { slug: "spectral-manor-crystal-dimension", title: "Crystal Dimension",tag: "Zero-G survival",      accent: "#67e8f9", bg: "#06040f" },
  { slug: "spectral-manor-infestation",       title: "Infestation",      tag: "Blast the Hauntipede", accent: "#4ade80", bg: "#0d0618" },
  { slug: "spectral-manor-cruise",            title: "Cruise",           tag: "Monster grand prix",   accent: "#ef4444", bg: "#07040f" },
];

const SHOW = 3;

function readBoard(slug: string): Entry[] {
  try {
    return JSON.parse(localStorage.getItem("spectralArcade.scores." + slug) || "[]");
  } catch {
    return [];
  }
}

export default function ArcadeRoom() {
  const [boards, setBoards] = useState<Record<string, Entry[]>>({});
  const [hof, setHof] = useState<HofRow[]>([]);
  const [live, setLive] = useState(false); // desktop → live iframes

  function refresh() {
    const b: Record<string, Entry[]> = {};
    const all: HofRow[] = [];
    GAMES.forEach((g) => {
      const rows = readBoard(g.slug);
      b[g.slug] = rows;
      rows.forEach((e) => all.push({ ...e, game: g.title }));
    });
    all.sort((x, y) => y.s - x.s);
    setBoards(b);
    setHof(all.slice(0, 9));
  }

  useEffect(() => {
    refresh();
    // live gameplay previews only on roomy, fine-pointer (desktop) screens
    const mq = window.matchMedia("(min-width: 900px) and (pointer: fine)");
    const apply = () => setLive(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    // re-read boards when returning from a game
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      mq.removeEventListener?.("change", apply);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  return (
    <div className="sm-room">
      <style>{CSS}</style>

      <div className="sm-cabinets">
        {GAMES.map((g) => {
          const rows = boards[g.slug] || [];
          return (
            <div className="sm-cab" key={g.slug} style={{ ["--accent" as string]: g.accent }}>
              {/* marquee */}
              <div className="sm-marquee">{g.title}</div>

              {/* screen */}
              <div className="sm-screen-wrap">
                <div className="sm-screen" style={{ background: g.bg }}>
                  {live ? (
                    <iframe
                      className="sm-frame"
                      src={`/arcade/games/${g.slug}/index.html?attract=1`}
                      title={g.title}
                      loading="lazy"
                      scrolling="no"
                      tabIndex={-1}
                    />
                  ) : (
                    <div className="sm-static">
                      <div className="sm-static-title">{g.title}</div>
                      <div className="sm-static-tag">{g.tag}</div>
                      <div className="sm-static-cta">▶ TAP TO PLAY</div>
                    </div>
                  )}
                  <div className="sm-scan" />
                </div>
                {/* full-cabinet click target → play the real game */}
                <a className="sm-play" href={`/arcade/games/${g.slug}/index.html`} aria-label={`Play ${g.title}`} />
              </div>

              {/* control panel */}
              <div className="sm-panel">
                <div className="sm-stick" />
                <div className="sm-btns">
                  <span /><span /><span />
                </div>
              </div>

              {/* per-cabinet top 3 */}
              <div className="sm-cabboard">
                {[0, 1, 2].map((i) => (
                  <div className="sm-row" key={i}>
                    <span className="sm-rank">{i + 1}</span>
                    <span className="sm-who">{rows[i] ? rows[i].i : "---"}</span>
                    <span className="sm-score">{rows[i] ? rows[i].s.toLocaleString() : "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* combined Hall of Fame */}
      <section className="sm-hof">
        <h2>Hall of Fame</h2>
        <p className="sm-hof-sub">Top 9 scores across the whole arcade</p>
        {hof.length === 0 ? (
          <div className="sm-hof-empty">No scores yet — set the first record!</div>
        ) : (
          <ol className="sm-hof-list">
            {hof.map((e, i) => (
              <li key={i}>
                <span className="sm-hof-rank">{i + 1}</span>
                <span className="sm-hof-who">{e.i}</span>
                <span className="sm-hof-score">{e.s.toLocaleString()}</span>
                <span className="sm-hof-game">{e.game}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

const CSS = `
.sm-room { max-width: 1100px; margin: 0 auto; padding: 0 1rem 4rem; }

.sm-cabinets {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.6rem;
}
@media (max-width: 900px) { .sm-cabinets { grid-template-columns: repeat(2, 1fr); gap: 1rem; } }
@media (max-width: 520px) { .sm-cabinets { grid-template-columns: 1fr 1fr; gap: .7rem; } }

.sm-cab {
  position: relative; display: flex; flex-direction: column; align-items: stretch;
  background: linear-gradient(180deg, #241436 0%, #160c26 60%, #0f0a18 100%);
  border: 2px solid #3b2660; border-radius: 16px 16px 10px 10px;
  padding: .5rem .5rem .7rem; box-shadow: 0 10px 30px rgba(0,0,0,.5), inset 0 0 30px rgba(124,58,237,.08);
  transition: transform .2s, box-shadow .2s, border-color .2s;
}
.sm-cab:hover { transform: translateY(-4px); border-color: var(--accent);
  box-shadow: 0 16px 40px rgba(0,0,0,.6), 0 0 30px color-mix(in srgb, var(--accent) 40%, transparent); }

.sm-marquee {
  text-align: center; font-family: 'Cinzel', Georgia, serif; font-weight: 700;
  font-size: .82rem; letter-spacing: 1px; color: #0f0a18;
  background: linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 60%, #fff));
  border-radius: 8px; padding: .32rem .3rem; margin-bottom: .5rem;
  text-shadow: 0 1px 0 rgba(255,255,255,.3);
  box-shadow: 0 0 16px color-mix(in srgb, var(--accent) 55%, transparent);
}

.sm-screen-wrap { position: relative; }
.sm-screen {
  position: relative; aspect-ratio: 16 / 10; border-radius: 6px; overflow: hidden;
  border: 4px solid #05030b; box-shadow: inset 0 0 22px rgba(0,0,0,.9);
}
.sm-frame { width: 100%; height: 100%; border: 0; display: block; pointer-events: none; }
.sm-scan { position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(0deg, rgba(0,0,0,.16) 0, rgba(0,0,0,.16) 1px, transparent 1px, transparent 3px);
  border-radius: 6px; }
.sm-play { position: absolute; inset: 0; z-index: 3; cursor: pointer; }

.sm-static { position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; text-align: center; gap: .25rem; }
.sm-static-title { font-family: 'Cinzel', Georgia, serif; font-weight: 700; font-size: 1rem;
  color: var(--accent); text-shadow: 0 0 14px var(--accent); }
.sm-static-tag { font-size: .68rem; color: #a78bfa; }
.sm-static-cta { margin-top: .4rem; font-size: .62rem; letter-spacing: 2px; color: #e0d4ff;
  border: 1px solid #7c3aed; border-radius: 4px; padding: .18rem .5rem; }

.sm-panel { display: flex; align-items: center; justify-content: center; gap: .6rem;
  padding: .5rem 0 .35rem; }
.sm-stick { width: 14px; height: 14px; border-radius: 50%; background: #ef4444;
  box-shadow: 0 6px 0 -2px #7f1d1d, 0 0 10px rgba(239,68,68,.5); }
.sm-btns { display: flex; gap: 5px; }
.sm-btns span { width: 9px; height: 9px; border-radius: 50%;
  background: color-mix(in srgb, var(--accent) 80%, #000); box-shadow: 0 0 8px var(--accent); }

.sm-cabboard { border-top: 1px solid #2b1c47; margin-top: .2rem; padding-top: .4rem;
  font-family: ui-monospace, 'Courier New', monospace; font-size: .68rem; }
.sm-row { display: flex; align-items: center; gap: .4rem; padding: .06rem 0; }
.sm-rank { color: #7c6aa0; width: 1em; }
.sm-who { color: #f0abfc; letter-spacing: 1px; }
.sm-score { margin-left: auto; color: #e0d4ff; }
.sm-row:first-child .sm-who { color: #fbbf24; }

.sm-hof { margin-top: 3rem; text-align: center; border-top: 1px solid rgba(124,58,237,.3); padding-top: 2rem; }
.sm-hof h2 { font-family: 'Cinzel', Georgia, serif; font-size: 1.8rem; color: #e9d5ff;
  text-shadow: 0 0 20px #c084fc; letter-spacing: 2px; }
.sm-hof-sub { color: #a78bfa; font-size: .85rem; margin-bottom: 1.2rem; }
.sm-hof-empty { color: #7c6aa0; font-style: italic; }
.sm-hof-list { list-style: none; max-width: 520px; margin: 0 auto; padding: 0;
  font-family: ui-monospace, 'Courier New', monospace; }
.sm-hof-list li { display: flex; align-items: center; gap: .8rem; padding: .45rem .8rem;
  border-bottom: 1px solid rgba(124,58,237,.14); font-size: .95rem; }
.sm-hof-list li:nth-child(1) { background: rgba(251,191,36,.08); }
.sm-hof-rank { color: #a78bfa; width: 1.5em; text-align: right; font-weight: 700; }
.sm-hof-who { color: #f0abfc; letter-spacing: 2px; width: 3.2em; }
.sm-hof-list li:nth-child(1) .sm-hof-who { color: #fbbf24; }
.sm-hof-score { color: #e9d5ff; min-width: 5em; text-align: right; }
.sm-hof-game { margin-left: auto; color: #8b7bb0; font-size: .8rem; }
`;
