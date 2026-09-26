"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motion } from "motion/react";
import { Eye, HeartHandshake } from "lucide-react";
import { KIND_META, KINDS } from "@/lib/kinds";
import type { LiteItem } from "@/lib/queries";
import { useBacklog } from "./backlog-context";
import { Avatar } from "./people-switch";
import { Poster } from "./poster";
import { GUTTER, Rail } from "./rail";

export function JuntosView({ discover }: { discover: Record<string, LiteItem[]> }) {
  const { me, items, shared } = useBacklog();

  return (
    <div className="mx-auto max-w-[1600px] space-y-14 pb-10 pt-[calc(env(safe-area-inset-top)+20px)] lg:pt-28">
      {shared.map((p) => (
        <Together key={p.userId} person={p} mine={items.filter((i) => p.mineIds.includes(i.id))} discover={discover[p.userId] ?? []} meImage={me.image} meName={me.name} />
      ))}
      {!shared.length && <p className={`${GUTTER} text-text-2`}>Ainda não tem mais ninguém usando o Backlog.</p>}
    </div>
  );
}

function Together({
  person,
  mine,
  discover,
  meImage,
  meName,
}: {
  person: { userId: string; name: string | null; image: string | null; count: number };
  mine: LiteItem[];
  discover: LiteItem[];
  meImage: string | null;
  meName: string | null;
}) {
  const first = person.name?.split(" ")[0] ?? "a outra pessoa";
  const groups = useMemo(() => KINDS.map((k) => ({ kind: k, items: mine.filter((i) => i.kind === k).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)) })).filter((g) => g.items.length), [mine]);

  return (
    <section className="space-y-10">
      <header className={`flex flex-col items-start gap-5 sm:flex-row sm:items-center ${GUTTER}`}>
        {/* Os dois avatares se aproximam e "se encaixam" */}
        <div className="relative flex h-20 w-32 shrink-0 items-center">
          <motion.span initial={{ x: -14, rotate: -8 }} animate={{ x: 0, rotate: -4 }} transition={{ type: "spring", stiffness: 180, damping: 14 }} className="absolute left-0">
            <Avatar src={meImage} name={meName} size={72} ring="ring-[#06080d]" />
          </motion.span>
          <motion.span initial={{ x: 14, rotate: 8 }} animate={{ x: 0, rotate: 4 }} transition={{ type: "spring", stiffness: 180, damping: 14 }} className="absolute left-[52px]">
            <Avatar src={person.image} name={person.name} size={72} ring="ring-[#06080d]" />
          </motion.span>
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.35, type: "spring", stiffness: 400, damping: 12 }}
            className="btn-accent absolute bottom-0 left-[50px] flex h-8 w-8 items-center justify-center rounded-full"
          >
            <HeartHandshake size={16} />
          </motion.span>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[34px] font-bold leading-none tracking-tight lg:text-[52px]">Você e {first}</h1>
          <p className="mt-2 text-[15px] text-text-2">
            {person.count ? `${person.count} ${person.count === 1 ? "coisa" : "coisas"} que os dois querem ver` : "Nada em comum ainda — dá uma espiada abaixo"}
          </p>
        </div>
        <Link href={`/pessoa/${person.userId}`} className="glass tap flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-medium">
          <Eye size={16} /> Backlog completo de {first}
        </Link>
      </header>

      {groups.map((g) => (
        <div key={g.kind}>
          <h2 className={`mb-3 text-[20px] font-bold tracking-tight lg:text-[22px] ${GUTTER}`}>
            {KIND_META[g.kind].plural} pra ver juntos <span className="text-[14px] font-semibold text-text-3">{g.items.length}</span>
          </h2>
          <div className={`grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 lg:gap-5 2xl:grid-cols-8 ${GUTTER}`}>
            {g.items.map((i) => (
              <Poster key={i.id} item={i} morph />
            ))}
          </div>
        </div>
      ))}

      <Rail title={`No backlog de ${first}, e não no seu`} subtitle="Toque para espiar e trazer pro seu backlog" items={discover} />
    </section>
  );
}
