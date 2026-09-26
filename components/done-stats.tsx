/* eslint-disable @next/next/no-img-element -- capas externas */
"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { CalendarCheck, Check, CircleCheckBig, Flame, Lock, Plus, Zap } from "lucide-react";
import type { Kind } from "@/lib/db/schema";
import { coverSrc } from "@/lib/img";
import { ptGenre } from "@/lib/genres";
import { KIND_META, KINDS } from "@/lib/kinds";
import type { LiteItem } from "@/lib/queries";
import { KIND_ICONS } from "./kind-icon";

// Cores por tipo (paleta categórica validada p/ daltonismo no fundo escuro; ordem fixa, nunca reciclada)
export const KIND_COLOR: Record<Kind, string> = { movie: "#3987e5", series: "#d95926", game: "#199e70", book: "#c98500" };
const ONE = "#3987e5"; // série única (dia da semana, gêneros)
const MIN = 5; // abaixo disso, mostra o esqueleto explicando
const DAY = 86_400_000;
const WEEK = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const WEEK_FULL = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const monthShort = new Intl.DateTimeFormat("pt-BR", { month: "short" });
const monthLong = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

function useStats(list: LiteItem[]) {
  return useMemo(() => {
    const now = new Date();
    const dates = list.map((i) => new Date(i.doneAt!));

    // Últimos 12 meses, empilhado por tipo
    const months = Array.from({ length: 12 }, (_, k) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + k, 1);
      const inMonth = list.filter((i) => {
        const x = new Date(i.doneAt!);
        return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth();
      });
      return { date: d, total: inMonth.length, byKind: KINDS.map((kind) => ({ kind, n: inMonth.filter((i) => i.kind === kind).length })) };
    });

    const weekday = WEEK.map((_, w) => dates.filter((d) => d.getDay() === w).length);
    const kinds = KINDS.map((kind) => ({ kind, n: list.filter((i) => i.kind === kind).length })).filter((k) => k.n);

    const g = new Map<string, number>();
    for (const i of list) for (const x of new Set(i.genres.map(ptGenre))) if (!/^(general|geral)$/i.test(x)) g.set(x, (g.get(x) ?? 0) + 1);
    const genres = [...g.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Maior sequência de semanas seguidas terminando alguma coisa
    const weeks = [...new Set(dates.map((d) => Math.floor((d.getTime() - d.getDay() * DAY) / (7 * DAY))))].sort((a, b) => a - b);
    let streak = weeks.length ? 1 : 0;
    for (let i = 1, run = 1; i < weeks.length; i++) {
      run = weeks[i] === weeks[i - 1] + 1 ? run + 1 : 1;
      streak = Math.max(streak, run);
    }

    const movieMin = list.filter((i) => i.kind === "movie").reduce((s, i) => s + (i.minutes ?? 0), 0);
    const gameMin = list.filter((i) => i.kind === "game").reduce((s, i) => s + (i.minutes ?? 0), 0);
    const seriesSeasons = list.filter((i) => i.kind === "series").reduce((s, i) => s + (i.seasons ?? 1), 0);
    const pages = list.filter((i) => i.kind === "book").reduce((s, i) => s + (i.pages ?? 0), 0);
    const first = dates.length ? Math.min(...dates.map((d) => d.getTime())) : now.getTime();
    const span = Math.max(1, Math.round((now.getTime() - first) / DAY));
    const thisMonth = dates.filter((d) => d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()).length;

    return { months, weekday, kinds, genres, streak, movieMin, gameMin, seriesSeasons, pages, span, thisMonth };
  }, [list]);
}

export function DoneStats({ list, kind }: { list: LiteItem[]; kind: Kind | "all" }) {
  const s = useStats(list);
  if (list.length < MIN) return <StatsSkeleton list={list} />;

  const best = s.weekday.indexOf(Math.max(...s.weekday));
  const hours = Math.round((s.movieMin + s.gameMin) / 60);
  const facts = [
    s.movieMin > 0 && { emoji: "🍿", big: `${Math.round(s.movieMin / 60)}h`, text: `de filme. Numa maratona sem parar, seriam ${(s.movieMin / 1440).toFixed(1).replace(".", ",")} dias no sofá.` },
    s.gameMin > 0 && { emoji: "🎮", big: `${Math.round(s.gameMin / 60)}h`, text: `de jogo: dá pra voar de São Paulo a Tóquio ${Math.max(1, Math.round(s.gameMin / 60 / 24))}× nesse tempo.` },
    s.pages > 0 && { emoji: "📚", big: `${s.pages.toLocaleString("pt-BR")} pág.`, text: `lidas. Empilhadas, as folhas dariam uns ${Math.max(1, Math.round((s.pages / 2) * 0.01))} cm de altura.` },
    s.seriesSeasons > 0 && { emoji: "📺", big: `${s.seriesSeasons} temp.`, text: `de série maratonadas até o fim.` },
  ].filter(Boolean) as { emoji: string; big: string; text: string }[];

  return (
    <div className="space-y-3">
      {/* Números de destaque */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Tile icon={CircleCheckBig} tone="#67d87a" value={String(list.length)} label="concluídos" />
        <Tile icon={CalendarCheck} value={String(s.thisMonth)} label="este mês" />
        <Tile icon={Flame} tone="#ff8a4c" value={`${s.streak} sem.`} label="maior sequência" />
        <Tile icon={Zap} value={`${Math.max(1, Math.round(s.span / list.length))} dias`} label="entre um e outro" />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
        <Card title="Seu ano" subtitle={hours ? `${hours}h de tela nos últimos 12 meses` : "Últimos 12 meses"}>
          <MonthChart months={s.months} kind={kind} />
        </Card>
        <div className="grid gap-3">
          {kind === "all" && s.kinds.length > 1 && (
            <Card title="Do que você mais gosta">
              <KindSplit kinds={s.kinds} total={list.length} />
            </Card>
          )}
          <Card title={`${WEEK_FULL[best][0].toUpperCase()}${WEEK_FULL[best].slice(1)} é o seu dia`} subtitle="Quando você mais termina as coisas">
            <WeekChart values={s.weekday} best={best} />
          </Card>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_1.5fr]">
        {s.genres.length > 1 && (
          <Card title="Gêneros no topo">
            <GenreBars genres={s.genres} />
          </Card>
        )}
        {facts.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {facts.map((f, i) => (
              <motion.div key={f.emoji} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.06 }} className="glass flex items-start gap-3 rounded-3xl p-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-[26px]">{f.emoji}</span>
                <span>
                  <span className="block text-[20px] font-bold leading-tight tracking-tight">{f.big}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-text-2">{f.text}</span>
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Tile({ icon: Icon, value, label, tone }: { icon: typeof Zap; value: string; label: string; tone?: string }) {
  return (
    <div className="glass min-w-0 rounded-2xl p-3.5">
      <Icon size={17} style={{ color: tone ?? "rgb(255 255 255 / 0.6)" }} />
      <p className="mt-2 truncate text-[22px] font-bold leading-tight tracking-tight">{value}</p>
      <p className="mt-0.5 text-[12px] text-text-2">{label}</p>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="glass flex flex-col rounded-3xl p-4 lg:p-5">
      <h3 className="text-[16px] font-bold tracking-tight">{title}</h3>
      {subtitle && <p className="text-[12.5px] text-text-2">{subtitle}</p>}
      <div className="mt-4 flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

// Colunas por mês, empilhadas por tipo; hover mostra o detalhe
function MonthChart({ months, kind }: { months: ReturnType<typeof useStats>["months"]; kind: Kind | "all" }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...months.map((m) => m.total));
  const kindsShown = kind === "all" ? KINDS.filter((k) => months.some((m) => m.byKind.find((b) => b.kind === k)!.n)) : [kind];
  // Altura flexível: preenche o cartão (mín. 170px), barras em % da área do gráfico
  return (
    <div className="flex flex-1 flex-col">
      <div className="relative flex min-h-[170px] flex-1 items-stretch gap-1.5" onMouseLeave={() => setHover(null)}>
        {/* grade recessiva */}
        <div className="pointer-events-none absolute inset-x-0 bottom-[22px] top-0 border-t border-dashed border-white/10">
          <span className="absolute -top-2.5 right-0 bg-transparent text-[10px] text-white/35">{max}</span>
        </div>
        {months.map((m, i) => (
          <div key={i} className="relative flex flex-1 flex-col items-center" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
            <div className="flex w-full flex-1 flex-col items-center justify-end">
            <div className="flex w-full max-w-[28px] flex-col-reverse gap-[2px]" style={{ height: `${(m.total / max) * 100}%` }}>
              {m.byKind
                .filter((b) => b.n)
                .map((b, j, arr) => (
                  <motion.div
                    key={b.kind}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ delay: i * 0.03, type: "spring", stiffness: 200, damping: 24 }}
                    className={`w-full origin-bottom ${j === arr.length - 1 ? "rounded-t-[4px]" : ""}`}
                    style={{ flex: b.n, background: KIND_COLOR[b.kind], opacity: hover === null || hover === i ? 1 : 0.45 }}
                  />
                ))}
            </div>
            </div>
            <span className={`mt-1.5 h-[14px] text-[10px] leading-[14px] ${hover === i ? "text-white" : "text-white/45"}`}>{monthShort.format(m.date).replace(".", "")}</span>
            {hover === i && m.total > 0 && (
              <div className={`glass-strong pointer-events-none absolute bottom-full z-10 mb-1 w-max rounded-xl px-3 py-2 text-[12px] ${i > 8 ? "right-0" : i < 3 ? "left-0" : "left-1/2 -translate-x-1/2"}`}>
                <p className="font-semibold capitalize">{monthLong.format(m.date)}</p>
                {m.byKind
                  .filter((b) => b.n)
                  .map((b) => (
                    <p key={b.kind} className="flex items-center gap-1.5 text-white/75">
                      <span className="h-2 w-2 rounded-full" style={{ background: KIND_COLOR[b.kind] }} /> {b.n} {KIND_META[b.kind].plural.toLowerCase()}
                    </p>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {kindsShown.length > 1 && <Legend kinds={kindsShown} />}
      <table className="sr-only">
        <caption>Concluídos por mês</caption>
        <tbody>
          {months.map((m, i) => (
            <tr key={i}>
              <th>{monthLong.format(m.date)}</th>
              <td>{m.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Legend({ kinds }: { kinds: Kind[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
      {kinds.map((k) => (
        <span key={k} className="flex items-center gap-1.5 text-[12px] text-text-2">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: KIND_COLOR[k] }} /> {KIND_META[k].plural}
        </span>
      ))}
    </div>
  );
}

// Barra 100% com a divisão por tipo, rótulos diretos
function KindSplit({ kinds, total }: { kinds: { kind: Kind; n: number }[]; total: number }) {
  return (
    <div>
      <div className="flex h-4 gap-[2px] overflow-hidden rounded-[4px]">
        {kinds.map((k, i) => (
          <motion.div key={k.kind} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: i * 0.08, duration: 0.5 }} className="origin-left" style={{ flex: k.n, background: KIND_COLOR[k.kind] }} title={`${KIND_META[k.kind].plural}: ${k.n}`} />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {kinds.map((k) => {
          const Icon = KIND_ICONS[k.kind];
          return (
            <div key={k.kind} className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${KIND_COLOR[k.kind]}33`, color: KIND_COLOR[k.kind] }}>
                <Icon size={14} />
              </span>
              <span className="text-[13px]">
                <span className="font-semibold">{Math.round((k.n / total) * 100)}%</span> <span className="text-text-2">{KIND_META[k.kind].plural.toLowerCase()}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekChart({ values, best }: { values: number[]; best: number }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-[92px] items-end gap-2">
      {values.map((v, i) => (
        <div key={i} className="flex h-full flex-1 flex-col items-center justify-end" title={`${WEEK_FULL[i]}: ${v}`}>
          {i === best && <span className="mb-1 text-[11px] font-semibold">{v}</span>}
          <motion.div
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: i * 0.04, type: "spring", stiffness: 220, damping: 22 }}
            className="w-full max-w-[22px] origin-bottom rounded-t-[4px]"
            style={{ height: `${Math.max(4, (v / max) * 64)}px`, background: ONE, opacity: i === best ? 1 : 0.45 }}
          />
          <span className={`mt-1.5 text-[10px] ${i === best ? "text-white" : "text-white/45"}`}>{WEEK[i]}</span>
        </div>
      ))}
    </div>
  );
}

function GenreBars({ genres }: { genres: [string, number][] }) {
  const max = genres[0]?.[1] ?? 1;
  return (
    <div className="space-y-2.5">
      {genres.map(([g, n], i) => (
        <div key={g}>
          <div className="mb-1 flex justify-between text-[12.5px]">
            <span>{g}</span>
            <span className="text-text-2">{n}</span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.06]">
            <motion.div initial={{ width: 0 }} animate={{ width: `${(n / max) * 100}%` }} transition={{ delay: i * 0.06, duration: 0.5 }} className="h-full rounded-full" style={{ background: ONE, opacity: 1 - i * 0.12 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Poucos dados: prévia nítida do que vem (sem borrão), com as capas já marcadas preenchendo os espaços
function StatsSkeleton({ list }: { list: LiteItem[] }) {
  const have = list.length;
  const missing = MIN - have;
  return (
    <div className="glass relative overflow-hidden rounded-[28px] p-5 lg:p-7">
      <div className="pointer-events-none absolute -left-16 -top-24 h-64 w-64 rounded-full bg-accent/20 blur-[90px]" />
      <div className="relative grid gap-7 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:gap-10">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-accent-2">Estatísticas</p>
          <h3 className="mt-2 text-[24px] font-bold leading-tight tracking-tight lg:text-[30px]">
            {missing === MIN ? "Marque 5 coisas como vistas" : `Faltam ${missing} pra liberar`}
          </h3>
          <p className="mt-2 max-w-md text-[14px] leading-relaxed text-text-2">
            Aí aparecem o seu ano mês a mês, o dia da semana em que você mais termina coisas, seus gêneros favoritos e umas curiosidades.
          </p>

          {/* 5 espaços: capas do que já foi visto + vagas tracejadas */}
          <div className="mt-5 flex gap-2.5">
            {Array.from({ length: MIN }, (_, i) => {
              const it = list[i];
              return it ? (
                <motion.div
                  key={it.id}
                  initial={{ y: 12, opacity: 0, rotate: -4 }}
                  animate={{ y: 0, opacity: 1, rotate: 0 }}
                  transition={{ delay: i * 0.08, type: "spring", stiffness: 300, damping: 20 }}
                  className="relative h-[84px] w-[58px] shrink-0 overflow-hidden rounded-xl bg-bg-3 shadow-[0_10px_24px_rgb(0_0_0/0.45)] ring-1 ring-white/10 lg:h-[96px] lg:w-[66px]"
                >
                  {it.coverUrl && <img src={coverSrc(it.coverUrl, "sm")!} alt={it.title} className="h-full w-full object-cover" />}
                  <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-success text-black ring-2 ring-bg">
                    <Check size={11} strokeWidth={3.5} />
                  </span>
                </motion.div>
              ) : (
                <div
                  key={i}
                  className={`flex h-[84px] w-[58px] shrink-0 items-center justify-center rounded-xl border-2 border-dashed lg:h-[96px] lg:w-[66px] ${i === have ? "slot-next border-accent/60 text-accent-2" : "border-white/12 text-white/25"}`}
                >
                  <Plus size={18} />
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[12.5px] text-text-2">
            <span className="font-semibold text-white">{have}</span> de {MIN} · toque em “Já vi” num item do backlog
          </p>
        </div>

        {/* Prévias dos gráficos: traço fino e nítido, apagadas e com cadeado */}
        <div className="grid grid-cols-2 gap-2.5">
          <Teaser title="Seu ano">
            <div className="flex h-full items-end gap-[3px]">
              {[3, 5, 2, 6, 4, 8, 5, 3, 7, 4, 6, 9].map((v, i) => (
                <div key={i} className="flex-1 rounded-t-[3px] bg-white/[0.14]" style={{ height: `${v * 10}%` }} />
              ))}
            </div>
          </Teaser>
          <Teaser title="Seu dia">
            <div className="flex h-full items-end gap-1.5">
              {[3, 5, 4, 4, 5, 3, 8].map((v, i) => (
                <div key={i} className={`flex-1 rounded-t-[3px] ${i === 6 ? "bg-accent/70" : "bg-white/[0.14]"}`} style={{ height: `${v * 11}%` }} />
              ))}
            </div>
          </Teaser>
          <Teaser title="Divisão por tipo">
            <div className="flex h-full flex-col justify-center gap-2.5">
              <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full">
                {KINDS.map((k, i) => (
                  <div key={k} style={{ flex: [4, 1, 2, 3][i], background: KIND_COLOR[k], opacity: 0.55 }} />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {KINDS.map((k) => (
                  <div key={k} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: KIND_COLOR[k], opacity: 0.7 }} />
                    <span className="h-1.5 flex-1 rounded-full bg-white/[0.1]" />
                  </div>
                ))}
              </div>
            </div>
          </Teaser>
          <Teaser title="Curiosidades">
            <div className="flex h-full flex-col justify-center gap-2">
              {["🍿", "🎮", "📚"].map((e, i) => (
                <div key={e} className="flex items-center gap-2">
                  <span className="text-[15px] leading-none opacity-80">{e}</span>
                  <span className="h-1.5 rounded-full bg-white/[0.12]" style={{ width: `${[70, 52, 62][i]}%` }} />
                </div>
              ))}
            </div>
          </Teaser>
        </div>
      </div>
    </div>
  );
}

function Teaser({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="relative rounded-2xl bg-white/[0.03] p-3.5 ring-1 ring-white/[0.07]">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-white/55">{title}</span>
        <Lock size={12} className="text-white/35" />
      </div>
      <div className="mt-3 h-[64px] lg:h-[76px]">{children}</div>
    </div>
  );
}
