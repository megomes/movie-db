/* eslint-disable @next/next/no-img-element -- logos do TMDB */
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff, Check, LogOut, Loader2 } from "lucide-react";
import { removePushSubscription, savePushSubscription, saveProviders, sendTestPush } from "@/app/actions";
import { authClient } from "@/lib/auth/client";
import type { Provider } from "@/lib/db/schema";

export function ProviderPicker({ providers, selected }: { providers: Provider[]; selected: number[] }) {
  const [value, setValue] = useState(new Set(selected));
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  function toggle(id: number) {
    const next = new Set(value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setValue(next);
    setSaved(false);
    start(async () => {
      await saveProviders([...next]);
      setSaved(true);
    });
  }

  return (
    <div>
      <div className="grid grid-cols-4 gap-x-3 gap-y-4 sm:grid-cols-6 md:grid-cols-8">
        {providers.map((p) => {
          const on = value.has(p.id);
          return (
            <button
              key={p.id}
              onClick={() => toggle(p.id)}
              aria-pressed={on}
              className={`press relative flex flex-col items-center gap-1.5 text-center transition-opacity duration-150 ${on ? "" : "opacity-45"}`}
            >
              <span className={`block h-14 w-14 overflow-hidden rounded-[12px] ${on ? "ring-2 ring-success" : ""}`}>{p.logo && <img src={p.logo} alt="" className="h-full w-full object-cover" loading="lazy" />}</span>
              <span className="line-clamp-2 text-[11px] leading-tight text-text-2">{p.name}</span>
              {on && (
                <span className="absolute -right-0.5 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-success text-bg">
                  <Check size={11} strokeWidth={3.5} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-3 h-4 text-xs text-text-3">{pending ? "Salvando…" : saved ? "Salvo." : ""}</p>
    </div>
  );
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function PushManager({ vapidKey }: { vapidKey: string }) {
  const [state, setState] = useState<"loading" | "unsupported" | "ios-install" | "off" | "on" | "denied">("loading");
  const [sub, setSub] = useState<PushSubscription | null>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setState(ios && !standalone ? "ios-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      const existing = await reg.pushManager.getSubscription();
      setSub(existing);
      setState(existing ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  function enable() {
    start(async () => {
      const reg = await navigator.serviceWorker.ready;
      try {
        const s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
        const json = s.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
        await savePushSubscription({ endpoint: json.endpoint, keys: json.keys });
        setSub(s);
        setState("on");
      } catch {
        setState(Notification.permission === "denied" ? "denied" : "off");
      }
    });
  }

  function disable() {
    start(async () => {
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setSub(null);
      setState("off");
    });
  }

  if (state === "loading") return <Loader2 size={18} className="animate-spin text-text-3" />;
  if (state === "ios-install")
    return <p className="text-[14px] text-text-2">No iPhone, primeiro instale: toque em Compartilhar → “Adicionar à Tela de Início” e abra o app por lá.</p>;
  if (state === "unsupported") return <p className="text-[14px] text-text-2">Este navegador não suporta notificações.</p>;
  if (state === "denied") return <p className="text-[14px] text-text-2">Notificações bloqueadas. Libere nas configurações do navegador.</p>;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {state === "on" ? (
        <>
          <button onClick={disable} disabled={pending} className="tap flex h-9 items-center gap-2 rounded-full border border-line px-4 text-[14px]">
            <BellOff size={16} /> Desativar
          </button>
          <button
            onClick={() =>
              start(async () => {
                const r = await sendTestPush();
                setMsg(r.sent ? "Enviada!" : "Não enviou; verifique as chaves VAPID.");
              })
            }
            disabled={pending}
            className="tap flex h-9 items-center rounded-full border border-line px-4 text-[14px]"
          >
            Enviar teste
          </button>
          <span className="text-xs text-success">Ativadas neste aparelho</span>
        </>
      ) : (
        <button onClick={enable} disabled={pending} className="tap flex h-10 items-center gap-2 rounded-full bg-pill px-5 text-[15px] font-medium text-white">
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />} Ativar notificações
        </button>
      )}
      {msg && <span className="text-xs text-text-2">{msg}</span>}
    </div>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      onClick={async () => {
        setPending(true);
        await authClient.signOut();
        router.replace("/auth/sign-in");
        router.refresh();
      }}
      disabled={pending}
      className="tap flex h-9 items-center gap-2 rounded-full border border-line px-4 text-[14px]"
    >
      <LogOut size={16} /> Sair
    </button>
  );
}
