"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, ChevronDown, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// Mirrors streamlit_app/app_pages/10_Watchlist.py — 2-tab layout with
// Watchlist (add/remove/track) and Alerts (create/delete/reactivate).
// Uses browser localStorage instead of Turso DB.

export type WatchlistItem = {
  id: string;
  ticker: string;
  note?: string;
  addedAt: string;         // ISO
  priceAtAdd?: number;     // captured on add
};

export type AlertCondition = "above" | "below" | "change_above" | "change_below";

export type PriceAlert = {
  id: string;
  ticker: string;
  condition: AlertCondition;
  threshold: number;
  note?: string;
  createdAt: string;
  triggered: boolean;
  triggeredAt?: string;
};

const WL_KEY = "aiql:watchlist:v1";
const AL_KEY = "aiql:alerts:v1";

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON<T>(key: string, val: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(val));
}

const CONDITIONS: { value: AlertCondition; label: string; sym: string }[] = [
  { value: "above",         label: "가격이 X 초과",  sym: "≥" },
  { value: "below",         label: "가격이 X 미만",  sym: "≤" },
  { value: "change_above",  label: "변화율 X% 초과", sym: "Δ≥" },
  { value: "change_below",  label: "변화율 X% 미만", sym: "Δ≤" },
];

export function WatchlistClient({ quotes }: { quotes: Record<string, { price: number; changePct: number; name: string; sector: string }> }) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [wlForm, setWlForm] = useState({ ticker: "", note: "" });
  const [alForm, setAlForm] = useState({ ticker: "", condition: "above" as AlertCondition, threshold: "0.00", note: "" });
  const [addOpen, setAddOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    setItems(loadJSON<WatchlistItem[]>(WL_KEY, []));
    setAlerts(loadJSON<PriceAlert[]>(AL_KEY, []));
  }, []);

  // Auto-check alerts on load (Streamlit does this too via check_alerts).
  // Depend on alerts.length + quotes so re-check happens on add/delete;
  // not on `alerts` array reference (would infinite-loop on setAlerts).
  const activeAlertsCount = alerts.filter((a) => !a.triggered).length;
  useEffect(() => {
    let updated = false;
    const next = alerts.map((a) => {
      if (a.triggered) return a;
      const q = quotes[a.ticker];
      if (!q) return a;
      const cond =
        (a.condition === "above" && q.price >= a.threshold) ||
        (a.condition === "below" && q.price <= a.threshold) ||
        (a.condition === "change_above" && q.changePct >= a.threshold) ||
        (a.condition === "change_below" && q.changePct <= a.threshold);
      if (cond) {
        updated = true;
        toast.success(`🔔 ${a.ticker} ${CONDITIONS.find((c) => c.value === a.condition)?.sym} ${a.threshold} — trigger!`);
        return { ...a, triggered: true, triggeredAt: new Date().toISOString() };
      }
      return a;
    });
    if (updated) {
      setAlerts(next);
      saveJSON(AL_KEY, next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAlertsCount, quotes]);

  const activeAlerts = alerts.filter((a) => !a.triggered);
  const triggeredAlerts = alerts.filter((a) => a.triggered);

  function addToWatchlist() {
    const ticker = wlForm.ticker.trim().toUpperCase();
    if (!ticker) { toast.error("티커를 입력하세요"); return; }
    if (items.some((i) => i.ticker === ticker)) { toast.warning("이미 관심목록에 있음"); return; }
    const q = quotes[ticker];
    const item: WatchlistItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ticker,
      note: wlForm.note.trim() || undefined,
      addedAt: new Date().toISOString(),
      priceAtAdd: q?.price,
    };
    const next = [...items, item];
    setItems(next);
    saveJSON(WL_KEY, next);
    setWlForm({ ticker: "", note: "" });
    setAddOpen(false);
    toast.success(`${ticker} 관심목록 추가`);
  }

  function removeItem(id: string) {
    const next = items.filter((i) => i.id !== id);
    setItems(next);
    saveJSON(WL_KEY, next);
  }

  function createAlert() {
    const ticker = alForm.ticker.trim().toUpperCase();
    const th = parseFloat(alForm.threshold);
    if (!ticker || isNaN(th)) { toast.error("티커와 임계값을 확인하세요"); return; }
    const alert: PriceAlert = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ticker,
      condition: alForm.condition,
      threshold: th,
      note: alForm.note.trim() || undefined,
      createdAt: new Date().toISOString(),
      triggered: false,
    };
    const next = [...alerts, alert];
    setAlerts(next);
    saveJSON(AL_KEY, next);
    setAlForm({ ticker: "", condition: "above", threshold: "0.00", note: "" });
    setCreateOpen(false);
    toast.success(`${ticker} 알림 생성`);
  }

  function deleteAlert(id: string) {
    const next = alerts.filter((a) => a.id !== id);
    setAlerts(next);
    saveJSON(AL_KEY, next);
  }

  function reactivateAlert(id: string) {
    const next = alerts.map((a) =>
      a.id === id ? { ...a, triggered: false, triggeredAt: undefined } : a,
    );
    setAlerts(next);
    saveJSON(AL_KEY, next);
  }

  return (
    <Tabs defaultValue="watchlist">
      <TabsList className="flex gap-1 bg-transparent p-0">
        <TabsTrigger
          value="watchlist"
          className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
        >
          Watchlist
          <Badge variant="secondary" className="ml-2 text-[10px]">{items.length}</Badge>
        </TabsTrigger>
        <TabsTrigger
          value="alerts"
          className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
        >
          Alerts
          <Badge variant="secondary" className="ml-2 text-[10px]">
            {activeAlerts.length}/{alerts.length}
          </Badge>
        </TabsTrigger>
      </TabsList>

      {/* ═══ Tab 1: Watchlist ═══ */}
      <TabsContent value="watchlist" className="mt-4 flex flex-col gap-3">
        {/* Add form (expander) */}
        <Card>
          <CardHeader className="cursor-pointer pb-2" onClick={() => setAddOpen(!addOpen)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">➕ 관심목록에 추가</CardTitle>
              <ChevronDown className={cn("h-4 w-4 transition-transform", addOpen && "rotate-180")} />
            </div>
          </CardHeader>
          {addOpen && (
            <CardContent className="flex flex-col gap-3 border-t border-border/30 pt-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
                <div>
                  <Label className="mb-1 block text-xs text-muted-foreground">Ticker</Label>
                  <Input
                    placeholder="AAPL"
                    value={wlForm.ticker}
                    onChange={(e) => setWlForm({ ...wlForm, ticker: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="mb-1 block text-xs text-muted-foreground">Note (optional)</Label>
                  <Input
                    placeholder="예: earnings play"
                    value={wlForm.note}
                    onChange={(e) => setWlForm({ ...wlForm, note: e.target.value })}
                  />
                </div>
              </div>
              <Button size="sm" onClick={addToWatchlist}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add
              </Button>
            </CardContent>
          )}
        </Card>

        {/* Card grid */}
        {items.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              관심목록이 비어있습니다. 위에서 티커를 추가하세요.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it) => {
              const q = quotes[it.ticker];
              const sinceAdd = q && it.priceAtAdd ? ((q.price - it.priceAtAdd) / it.priceAtAdd) * 100 : null;
              return (
                <Card key={it.id}>
                  <CardContent className="flex flex-col gap-2 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/stock/${it.ticker}`}
                          className="font-mono text-sm font-bold text-primary hover:underline"
                        >
                          {it.ticker}
                        </Link>
                        <div className="truncate text-[10px] text-muted-foreground">
                          {q?.name ?? it.ticker}
                        </div>
                        {it.note && (
                          <div className="mt-1 truncate text-[10px] italic text-muted-foreground">
                            {it.note}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <Stat label="Current" value={q ? `$${q.price.toFixed(2)}` : "-"} />
                      <Stat
                        label="Day"
                        value={q ? `${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2)}%` : "-"}
                        color={q && q.changePct >= 0 ? "text-success" : "text-destructive"}
                      />
                      <Stat label="Added" value={new Date(it.addedAt).toLocaleDateString()} />
                      <Stat
                        label="Since Add"
                        value={sinceAdd !== null ? `${sinceAdd >= 0 ? "+" : ""}${sinceAdd.toFixed(2)}%` : "-"}
                        color={sinceAdd !== null && sinceAdd >= 0 ? "text-success" : "text-destructive"}
                      />
                    </div>
                    <Button variant="outline" size="sm" className="w-full" onClick={() => removeItem(it.id)}>
                      <Trash2 className="mr-1 h-3 w-3" /> Remove
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </TabsContent>

      {/* ═══ Tab 2: Alerts ═══ */}
      <TabsContent value="alerts" className="mt-4 flex flex-col gap-3">
        {/* Create alert form */}
        <Card>
          <CardHeader className="cursor-pointer pb-2" onClick={() => setCreateOpen(!createOpen)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">🔔 새 알림 생성</CardTitle>
              <ChevronDown className={cn("h-4 w-4 transition-transform", createOpen && "rotate-180")} />
            </div>
          </CardHeader>
          {createOpen && (
            <CardContent className="flex flex-col gap-3 border-t border-border/30 pt-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label className="mb-1 block text-xs text-muted-foreground">Ticker</Label>
                  <Input
                    placeholder="AAPL"
                    value={alForm.ticker}
                    onChange={(e) => setAlForm({ ...alForm, ticker: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="mb-1 block text-xs text-muted-foreground">Condition</Label>
                  <Select
                    value={alForm.condition}
                    onValueChange={(v) => setAlForm({ ...alForm, condition: ((v as string) ?? "above") as AlertCondition })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONDITIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 block text-xs text-muted-foreground">Threshold</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={alForm.threshold}
                    onChange={(e) => setAlForm({ ...alForm, threshold: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label className="mb-1 block text-xs text-muted-foreground">Note (optional)</Label>
                <Input
                  placeholder="예: 사고 싶은 가격"
                  value={alForm.note}
                  onChange={(e) => setAlForm({ ...alForm, note: e.target.value })}
                />
              </div>
              <Button size="sm" onClick={createAlert}>
                <Bell className="mr-1 h-3.5 w-3.5" /> Create Alert
              </Button>
            </CardContent>
          )}
        </Card>

        {/* Summary */}
        <div className="text-xs text-muted-foreground">
          Active: <strong className="text-foreground">{activeAlerts.length}</strong> ·
          Triggered: <strong className="text-foreground">{triggeredAlerts.length}</strong>
        </div>

        {/* Active alerts */}
        {activeAlerts.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Active Alerts</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              {activeAlerts.map((a) => {
                const sym = CONDITIONS.find((c) => c.value === a.condition)?.sym ?? "?";
                const isPct = a.condition.startsWith("change_");
                return (
                  <div key={a.id} className="flex items-center justify-between gap-2 rounded-md border border-border/30 px-2.5 py-1.5 text-xs">
                    <div className="min-w-0 flex-1">
                      <span className="font-mono font-bold text-primary">{a.ticker}</span>
                      <span className="ml-2 text-muted-foreground">
                        {sym} <strong className="text-foreground">{a.threshold}{isPct ? "%" : ""}</strong>
                      </span>
                      {a.note && <span className="ml-2 italic text-muted-foreground">— {a.note}</span>}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => deleteAlert(a.id)}>Delete</Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Triggered alerts */}
        {triggeredAlerts.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Triggered Alerts</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              {triggeredAlerts.map((a) => {
                const sym = CONDITIONS.find((c) => c.value === a.condition)?.sym ?? "?";
                const isPct = a.condition.startsWith("change_");
                return (
                  <div key={a.id} className="flex items-center justify-between gap-2 rounded-md border border-border/30 bg-muted/20 px-2.5 py-1.5 text-xs line-through opacity-70">
                    <div className="min-w-0 flex-1">
                      <span className="font-mono font-bold text-muted-foreground">{a.ticker}</span>
                      <span className="ml-2 text-muted-foreground">
                        {sym} {a.threshold}{isPct ? "%" : ""}
                      </span>
                      {a.triggeredAt && (
                        <span className="ml-2 text-[10px] text-muted-foreground">
                          @ {new Date(a.triggeredAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => reactivateAlert(a.id)}>
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteAlert(a.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {alerts.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              생성된 알림이 없습니다. 위에서 새 알림을 만드세요.
            </CardContent>
          </Card>
        )}

        <div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-xs text-muted-foreground">
          알림은 페이지 로드 시 현재가와 비교해 체크됩니다. 백그라운드 지속 알림은 Turso DB + 서버 스케줄러 도입 후 지원.
        </div>
      </TabsContent>
    </Tabs>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("font-semibold tabular-nums", color ?? "text-foreground")}>{value}</div>
    </div>
  );
}
