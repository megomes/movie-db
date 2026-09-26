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
      <div className="grid grid-cols-4 gap-x-3 gap-y-5 sm:grid-cols-6 md:grid-cols-8">
        {providers.map((p) => {
          const on = value.has(p.id);
          return (
            <button
              key={p.id}
              onClick={() => toggle(p.id)}
              aria-pressed={on}
              className={`press relative flex flex-col items-center gap-1.5 text-center transition-opacity duration-150 ${on ? "" : "opacity-55 hover:opacity-90"}`}
            >
              <span className={`block h-16 w-16 overflow-hidden rounded-[18px] shadow-lg transition-all duration-200 ${on ? "ring-[3px] ring-accent ring-offset-2 ring-offset-bg" : "grayscale-[60%]"}`}>{p.logo && <img src={p.logo} alt="" className="h-full w-full object-cover" loading="lazy" />}</span>
              <span className="line-clamp-2 text-[11px] leading-tight text-text-2">{p.name}</span>
              {on && (
                <span className="btn-accent absolute -right-1 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full">
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
          <button onClick={disable} disabled={pending} className="glass tap flex h-10 items-center gap-2 rounded-full px-4 text-[14px]">
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
            className="glass tap flex h-10 items-center rounded-full px-4 text-[14px]"
          >
            Enviar teste
          </button>
          <span className="text-xs text-success">Ativadas neste aparelho</span>
        </>
      ) : (
        <button onClick={enable} disabled={pending} className="btn-accent tap flex h-11 items-center gap-2 rounded-full px-6 text-[15px] font-semibold">
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
      className="glass tap flex h-10 items-center gap-2 rounded-full px-4 text-[14px]"
    >
      <LogOut size={16} /> Sair
    </button>
  );
}
