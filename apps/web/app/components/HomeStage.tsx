import { useEffect, useRef, type CSSProperties } from "react";
import { Link } from "react-router";

/**
 * The home page's opening scene: a lit orb with the site's five sections swimming around it.
 *
 * Faithful to the board this design came from (a hub of nodes, each a way in), but every jellyfish is
 * a real link and its label the section's name, so the decoration never hides the navigation. The
 * videos only start once the browser has hydrated, and stay still for readers who ask for less motion.
 */

const ENTRIES = [
  { to: "/", name: "精选", en: "Featured", x: "50%", y: "3%", dur: 8.4, delay: 0, tint: "hue-rotate(-6deg) saturate(0.9)" },
  { to: "/all", name: "全部动态", en: "All", x: "93%", y: "35%", dur: 9.6, delay: 1.1, tint: "hue-rotate(18deg) saturate(0.85)" },
  { to: "/hot", name: "热点榜", en: "Trending", x: "76%", y: "91%", dur: 7.8, delay: 2.3, tint: "hue-rotate(-26deg) saturate(0.8)" },
  { to: "/daily", name: "日报", en: "Daily", x: "24%", y: "91%", dur: 10.2, delay: 0.6, tint: "saturate(0.55) brightness(1.05)" },
  { to: "/topics", name: "主题", en: "Topics", x: "5%", y: "35%", dur: 8.9, delay: 1.8, tint: "hue-rotate(38deg) saturate(0.8)" },
];

export function HomeStage() {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const videos = Array.from(ref.current?.querySelectorAll("video") ?? []);
    const play = () => {
      if (reduce.matches) return;
      for (const video of videos) void video.play().catch(() => {});
    };
    const onMotion = () => {
      if (reduce.matches) for (const video of videos) video.pause();
      else play();
    };
    const onVisibility = () => {
      if (document.hidden) for (const video of videos) video.pause();
      else play();
    };
    play();
    reduce.addEventListener("change", onMotion);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      reduce.removeEventListener("change", onMotion);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <section ref={ref} className="home-stage" aria-label="站点导览">
      <div className="hub-copy">
        <p className="hub-kicker">Global Supplier Audit Intelligence</p>
        <p className="hub-title title-gradient">EAGLE GSAI</p>
        <p className="hub-sub">
          追踪 SLCP、amfori BSCI、SMETA、WRAP、C-TPAT、ZDHC 等审核体系的最新要求与实务变化。
        </p>
        <p className="hub-meta">
          <span>
            <b>8</b> 个栏目
          </span>
          <span>
            <b>7</b> 个信源
          </span>
          <span>每日更新</span>
        </p>
      </div>

      <div className="stage-orb">
        <div className="orb-halo" aria-hidden="true" />
        <video
          className="orb-vid"
          src="/media/orb.mp4"
          poster="/media/orb.jpg"
          muted
          loop
          playsInline
          preload="none"
          aria-hidden="true"
        />
        <ul className="jellies">
          {ENTRIES.map((entry, index) => (
            <li key={entry.to} className="jl" style={{ "--x": entry.x, "--y": entry.y } as CSSProperties}>
              <Link
                to={entry.to}
                className="jl-link"
                style={{ "--dur": `${entry.dur}s`, "--delay": `${entry.delay}s` } as CSSProperties}
              >
                <span className="sr-only">{entry.name}</span>
                <video
                  className="jl-vid"
                  src="/media/jellyfish.mp4"
                  poster="/media/jellyfish.jpg"
                  muted
                  loop
                  playsInline
                  preload="none"
                  aria-hidden="true"
                  style={{ filter: entry.tint }}
                  onLoadedMetadata={(event) => {
                    // Five copies of one clip would swim in lockstep; stagger their loops instead.
                    event.currentTarget.currentTime = (index * 1.37) % 5;
                  }}
                />
                <span className="jl-label" aria-hidden="true">
                  {entry.name}
                  <em>{entry.en}</em>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
