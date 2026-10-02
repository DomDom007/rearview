// Rearview: scans a creator's back catalogue for anything a sponsor might flinch at, before the contract lands.
import { useMemo, useState } from "react";
import { download, useStored } from "./lib/store";
import { ImportBox, Section, Stat, Stats } from "./ui/kit";

const T = "rearview";
type Cat = { id: string; label: string; weight: number; words: string[] };
const CATS: Cat[] = [
  { id: "profanity", label: "Strong language", weight: 2, words: ["fuck", "shit", "bitch", "bastard", "asshole", "damn", "wtf", "putain", "merde"] },
  { id: "alcohol", label: "Alcohol and drugs", weight: 2, words: ["drunk", "vodka", "beer", "wine", "tequila", "weed", "cannabis", "high af", "shots", "hangover", "cocaine"] },
  { id: "gambling", label: "Gambling", weight: 3, words: ["casino", "betting", "bet365", "poker", "slots", "sportsbook", "parlay", "odds boost"] },
  { id: "politics", label: "Politics and religion", weight: 2, words: ["election", "vote for", "president", "government", "left wing", "right wing", "protest", "religion", "party leader"] },
  { id: "violence", label: "Violence", weight: 3, words: ["kill", "shoot", "gun", "fight", "blood", "weapon", "punch", "stab"] },
  { id: "health", label: "Health claims", weight: 3, words: ["cure", "cures", "detox", "lose 10kg", "guaranteed results", "miracle", "no side effects", "weight loss"] },
  { id: "finance", label: "Money promises", weight: 3, words: ["get rich", "passive income", "crypto", "guaranteed return", "financial freedom", "100x", "forex signals"] },
  { id: "disclosure", label: "Missing ad disclosure", weight: 2, words: ["use my code", "discount code", "link in bio for", "affiliate", "promo code"] },
];

type Item = { title: string; date: string; text: string };
const SAMPLE = `title,date,text
"Day in my life as a potter",2025-03-02,"Morning coffee, wheel throwing, and yes I burned my hand again lol. Use my code HANA10 for 10% off glazes."
"Trying the cheapest kiln on the internet",2025-05-18,"This kiln is a disaster, what the fuck was I thinking. Also shoutout to the betting app that texted me mid-firing."
"My studio tour",2025-07-09,"A calm tour of the studio with every tool I use."
"Pottery with friends",2025-08-21,"We opened a bottle of wine and threw terrible bowls. Hangover level: high."
"Clay that cures stress",2025-09-30,"Clay is a miracle, it basically cures anxiety. Guaranteed results."`;

function parseItems(text: string): Item[] {
  const lines = text.trim().split("\n");
  if (/^title\s*,/i.test(lines[0])) {
    return lines.slice(1).map(l => { const m = [...l.matchAll(/"((?:[^"]|"")*)"|([^,]+)/g)].map(x => (x[1] ?? x[2] ?? "").replace(/""/g, '"').trim()); return { title: m[0] ?? "", date: m[1] ?? "", text: m.slice(2).join(", ") }; });
  }
  return text.split(/\n\s*\n/).map((b, i) => ({ title: b.split("\n")[0].slice(0, 80) || `Item ${i + 1}`, date: "", text: b }));
}

export default function Rearview() {
  const [raw, setRaw] = useStored(T, "raw", SAMPLE);
  const [brand, setBrand] = useStored(T, "brand", "");
  const [competitors, setCompetitors] = useStored(T, "comp", "");
  const [off, setOff] = useStored<string[]>(T, "off", []);
  const [show, setShow] = useState<"all" | "flagged">("flagged");

  const cats = useMemo(() => {
    const comp = competitors.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
    return [...CATS, ...(comp.length ? [{ id: "competitors", label: `Competitors of ${brand || "the sponsor"}`, weight: 3, words: comp }] : [])].filter(c => !off.includes(c.id));
  }, [competitors, brand, off]);

  const items = useMemo(() => parseItems(raw).map(it => {
    const hay = ` ${it.title} ${it.text} `.toLowerCase();
    const hits = cats.flatMap(c => c.words.filter(w => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`, "i").test(hay)).map(w => ({ cat: c, word: w })));
    const score = hits.reduce((a, h) => a + h.cat.weight, 0);
    return { ...it, hits, score };
  }), [raw, cats]);
  const flagged = items.filter(i => i.hits.length);
  const risk = flagged.reduce((a, i) => a + i.score, 0);
  const level = risk === 0 ? ["Clean", "good"] : risk < 8 ? ["Low", "good"] : risk < 20 ? ["Medium", "warn"] : ["High", "bad"];
  const mark = (text: string, words: string[]) => {
    if (!words.length) return text;
    const rx = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
    return text.split(rx).map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p));
  };
  const report = () => [
    `Rearview brand-safety report${brand ? ` for ${brand}` : ""}`, `Items scanned: ${items.length}. Items flagged: ${flagged.length}. Risk: ${level[0]}.`, "",
    ...flagged.map(i => `- ${i.date ? i.date + " " : ""}${i.title}: ${[...new Set(i.hits.map(h => h.cat.label))].join(", ")} (${i.hits.map(h => h.word).join(", ")})`),
  ].join("\n");

  return (
    <div className="stack">
      <div className="grid2">
        <Section title="Back catalogue">
          <ImportBox label="CSV with title, date, text (captions, descriptions or transcripts), or plain text blocks separated by blank lines" onText={setRaw} rows={4} />
          <p className="note" style={{ marginTop: 8 }}>{items.length} items loaded.</p>
        </Section>
        <Section title="The deal">
          <div className="stack" style={{ gap: 10 }}>
            <label className="field"><span>Sponsor</span><input id="rv-brand" className="input" value={brand} onChange={e => setBrand(e.target.value)} placeholder="Glazeco" /></label>
            <label className="field"><span>Their competitors, separated by commas</span><input id="rv-comp" className="input" value={competitors} onChange={e => setCompetitors(e.target.value)} placeholder="Kilnworks, Claymart" /></label>
            <div className="row" style={{ gap: 8 }}>{CATS.map(c => <label key={c.id} className="check note"><input type="checkbox" checked={!off.includes(c.id)} onChange={e => setOff(e.target.checked ? off.filter(x => x !== c.id) : [...off, c.id])} />{c.label}</label>)}</div>
          </div>
        </Section>
      </div>

      <Section title="Report" aside={<>
        <div className="seg-mini"><button aria-pressed={show === "flagged"} onClick={() => setShow("flagged")}>Flagged</button><button aria-pressed={show === "all"} onClick={() => setShow("all")}>All</button></div>
        <button className="btn small" onClick={() => download("rearview-report.txt", report(), "text/plain")}>Download report</button>
      </>}>
        <Stats><Stat value={items.length} label="Items scanned" /><Stat value={flagged.length} label="Flagged" tone={flagged.length ? "warn" : "good"} /><Stat value={level[0]} label="Overall risk" tone={level[1] as "good"} /></Stats>
        <div className="row" style={{ gap: 8, marginTop: 14 }}>
          {cats.map(c => { const n = flagged.filter(i => i.hits.some(h => h.cat.id === c.id)).length; return n ? <span key={c.id} className="pill bad">{c.label}: {n}</span> : null; })}
        </div>
        <div className="stack" style={{ gap: 12, marginTop: 16 }}>
          {(show === "all" ? items : flagged).sort((a, b) => b.score - a.score).map((i, k) => (
            <div key={k} className="rv-item" style={{ borderLeftColor: i.score >= 6 ? "var(--bad)" : i.score ? "var(--warn)" : "var(--good)" }}>
              <div className="row" style={{ justifyContent: "space-between" }}><strong>{i.title}</strong><span className="note">{i.date}</span></div>
              <p style={{ fontSize: 14, marginTop: 4 }}>{mark(i.text, i.hits.map(h => h.word))}</p>
              {i.hits.length > 0 && <div className="row" style={{ gap: 6, marginTop: 6 }}>{[...new Set(i.hits.map(h => h.cat.label))].map(l => <span key={l} className="pill bad">{l}</span>)}</div>}
            </div>
          ))}
          {show === "flagged" && flagged.length === 0 && <p className="empty-note">Nothing flagged. This catalogue looks safe for this sponsor.</p>}
        </div>
        <p className="note" style={{ marginTop: 14 }}>Word matching finds likely problems quickly. Check each flag yourself, since context matters.</p>
      </Section>
      <style>{`.rv-item{border-left:4px solid;padding:8px 12px;background:var(--sunk);border-radius:0 8px 8px 0}.rv-item mark{background:#FFE800;color:#151933;padding:0 2px;border-radius:2px}`}</style>
    </div>
  );
}
