"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/**
 * Mirrors Streamlit 5_Portfolio.py — 5 tabs:
 *   보유(Holdings), 거래(Trades), 성과(Performance), 배당(Dividends), 세금(Tax)
 *
 * Uses localStorage (aiql:portfolio:trades:v1) since Turso auth is out
 * of scope. Dividends/Tax tabs show computed data where possible,
 * placeholder where external APIs are needed.
 */

type Trade = {
  id: string;
  ticker: string;
  side: "buy" | "sell";
  shares: number;
  price: number;
  fee: number;
  date: string;
  note?: string;
};

type Holding = {
  ticker: string;
  shares: number;
  avgCost: number;
  realizedPnl: number;
  currentPrice?: number;
  marketValue?: number;
  unrealizedPnl?: number;
  sector?: string;
};

const STORAGE_KEY = "aiql:portfolio:trades:v1";

function loadTrades(): Trade[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Trade[]) : [];
  } catch {
    return [];
  }
}
function saveTrades(t: Trade[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
}

function computeHoldings(trades: Trade[], quotes: Record<string, { price: number; sector: string }>): Holding[] {
  const map = new Map<string, Holding>();
  for (const t of [...trades].sort((a, b) => a.date.localeCompare(b.date))) {
    const h = map.get(t.ticker) ?? { ticker: t.ticker, shares: 0, avgCost: 0, realizedPnl: 0 };
    if (t.side === "buy") {
      const newShares = h.shares + t.shares;
      const totalCost = h.shares * h.avgCost + t.shares * t.price + t.fee;
      h.avgCost = newShares > 0 ? totalCost / newShares : 0;
      h.shares = newShares;
    } else {
      const proceeds = t.shares * t.price - t.fee;
      const costBasis = t.shares * h.avgCost;
      h.realizedPnl += proceeds - costBasis;
      h.shares = Math.max(0, h.shares - t.shares);
    }
    map.set(t.ticker, h);
  }
  return Array.from(map.values()).map((h) => {
    const q = quotes[h.ticker];
    if (q && h.shares > 0) {
      const marketValue = q.price * h.shares;
      const unrealizedPnl = (q.price - h.avgCost) * h.shares;
      return { ...h, currentPrice: q.price, marketValue, unrealizedPnl, sector: q.sector };
    }
    return { ...h, sector: q?.sector };
  });
}

const PIE_COLORS = [
  "oklch(0.623 0.214 259.815)",
  "oklch(0.777 0.152 163.223)",
  "oklch(0.71 0.213 303.9)",
  "oklch(0.828 0.189 84.429)",
  "oklch(0.704 0.191 22.216)",
  "oklch(0.55 0.22 30)",
  "oklch(0.5 0.19 210)",
  "oklch(0.6 0.14 320)",
];

export function PortfolioClient({ quotes }: { quotes: Record<string, { price: number; sector: string }> }) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    ticker: "", side: "buy" as "buy" | "sell",
    shares: "", price: "", fee: "0",
    date: new Date().toISOString().slice(0, 10),
    note: "",
  });

  useEffect(() => { setTrades(loadTrades()); }, []);

  const holdings = useMemo(
    () => computeHoldings(trades, quotes).sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0)),
    [trades, quotes],
  );

  const totals = useMemo(() => {
    let mv = 0, cost = 0, unreal = 0, real = 0;
    for (const h of holdings) {
      mv += h.marketValue ?? 0;
      if (h.shares > 0) cost += h.avgCost * h.shares;
      unreal += h.unrealizedPnl ?? 0;
      real += h.realizedPnl;
    }
    return { mv, cost, unreal, real, total: unreal + real };
  }, [holdings]);

  function handleAdd() {
    const shares = parseFloat(form.shares);
    const price = parseFloat(form.price);
    const fee = parseFloat(form.fee) || 0;
    if (!form.ticker || !shares || !price) { toast.error("티커·수량·가격은 필수"); return; }
    const trade: Trade = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ticker: form.ticker.toUpperCase().trim(),
      side: form.side, shares, price, fee, date: form.date,
      note: form.note.trim() || undefined,
    };
    const next = [...trades, trade];
    setTrades(next);
    saveTrades(next);
    toast.success(`${trade.side === "buy" ? "매수" : "매도"} 기록 추가: ${trade.ticker} × ${trade.shares}`);
    setIsOpen(false);
    setForm({ ...form, ticker: "", shares: "", price: "", fee: "0", note: "" });
  }
  function handleDelete(id: string) {
    const next = trades.filter((t) => t.id !== id);
    setTrades(next);
    saveTrades(next);
    toast.info("거래 삭제");
  }

  const activeHoldings = holdings.filter((h) => h.shares > 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Summary row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="총 평가액" value={fmt$(totals.mv)} />
        <SummaryCard label="총 원가" value={fmt$(totals.cost)} />
        <SummaryCard label="미실현 P&L" value={fmt$(totals.unreal)} tone={totals.unreal >= 0 ? "success" : "danger"} />
        <SummaryCard label="실현 P&L" value={fmt$(totals.real)} tone={totals.real >= 0 ? "success" : "danger"} />
      </div>

      <Tabs defaultValue="holdings">
        <TabsList className="flex flex-wrap gap-1 bg-transparent p-0">
          <TabsTrigger value="holdings" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">보유</TabsTrigger>
          <TabsTrigger value="trades" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">거래</TabsTrigger>
          <TabsTrigger value="performance" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">성과</TabsTrigger>
          <TabsTrigger value="dividends" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">배당</TabsTrigger>
          <TabsTrigger value="tax" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">세금</TabsTrigger>
        </TabsList>

        {/* ═══ Tab 1: 보유 (Holdings) ═══ */}
        <TabsContent value="holdings" className="mt-4 flex flex-col gap-4">
          {activeHoldings.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                보유 종목이 없습니다. 거래 탭에서 매수 기록을 추가하세요.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Pie charts */}
              <div className="grid gap-3 lg:grid-cols-2">
                <PieCard title="종목별 비중" data={activeHoldings.map((h) => ({ name: h.ticker, value: h.marketValue ?? 0 }))} />
                <PieCard title="섹터별 비중" data={aggregateBySector(activeHoldings)} />
              </div>
              {/* Holdings table */}
              <Card className="overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">보유 종목 ({activeHoldings.length})</CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border/60 bg-muted/20 text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Ticker</th>
                        <th className="px-3 py-2 text-right">수량</th>
                        <th className="px-3 py-2 text-right">평균단가</th>
                        <th className="px-3 py-2 text-right">현재가</th>
                        <th className="px-3 py-2 text-right">평가액</th>
                        <th className="px-3 py-2 text-right">평가 P&L</th>
                        <th className="px-3 py-2 text-right">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeHoldings.map((h) => {
                        const pnlPct = h.currentPrice ? ((h.currentPrice - h.avgCost) / h.avgCost) * 100 : 0;
                        return (
                          <tr key={h.ticker} className="border-b border-border/30">
                            <td className="px-3 py-2 font-mono text-xs font-semibold">
                              <Link href={`/stock/${h.ticker}`} className="text-primary hover:underline">{h.ticker}</Link>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">{h.shares}</td>
                            <td className="px-3 py-2 text-right tabular-nums">${h.avgCost.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{h.currentPrice ? `$${h.currentPrice.toFixed(2)}` : "-"}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{h.marketValue ? fmt$(h.marketValue) : "-"}</td>
                            <td className={cn("px-3 py-2 text-right tabular-nums", (h.unrealizedPnl ?? 0) >= 0 ? "text-success" : "text-destructive")}>
                              {h.unrealizedPnl !== undefined ? fmt$(h.unrealizedPnl) : "-"}
                            </td>
                            <td className={cn("px-3 py-2 text-right tabular-nums", pnlPct >= 0 ? "text-success" : "text-destructive")}>
                              {h.currentPrice ? `${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%` : "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ═══ Tab 2: 거래 (Trades) ═══ */}
        <TabsContent value="trades" className="mt-4 flex flex-col gap-3">
          {/* Add form */}
          <div className="flex items-center gap-2">
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger render={<Button size="sm"><Plus className="mr-1 h-4 w-4" /> 거래 추가</Button>} />
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>새 거래</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>티커</Label><Input value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} placeholder="AAPL" /></div>
                    <div><Label>구분</Label>
                      <Select value={form.side} onValueChange={(v) => setForm({ ...form, side: ((v as string) ?? "buy") as "buy" | "sell" })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="buy">매수</SelectItem><SelectItem value="sell">매도</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>수량</Label><Input type="number" value={form.shares} onChange={(e) => setForm({ ...form, shares: e.target.value })} /></div>
                    <div><Label>가격 ($)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>수수료</Label><Input type="number" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} /></div>
                    <div><Label>거래일</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsOpen(false)}>취소</Button>
                  <Button onClick={handleAdd}>추가</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <span className="text-xs text-muted-foreground">총 {trades.length}건</span>
          </div>
          {/* Trade history */}
          {trades.length > 0 ? (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/60 bg-muted/20 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">날짜</th>
                      <th className="px-3 py-2">Ticker</th>
                      <th className="px-3 py-2">구분</th>
                      <th className="px-3 py-2 text-right">수량</th>
                      <th className="px-3 py-2 text-right">가격</th>
                      <th className="px-3 py-2 text-right">수수료</th>
                      <th className="px-3 py-2 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...trades].sort((a, b) => b.date.localeCompare(a.date)).map((t) => (
                      <tr key={t.id} className="border-b border-border/30">
                        <td className="px-3 py-2 text-xs text-muted-foreground">{t.date}</td>
                        <td className="px-3 py-2 font-mono text-xs font-semibold">{t.ticker}</td>
                        <td className={cn("px-3 py-2 text-xs font-semibold", t.side === "buy" ? "text-success" : "text-destructive")}>
                          {t.side === "buy" ? "매수" : "매도"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{t.shares}</td>
                        <td className="px-3 py-2 text-right tabular-nums">${t.price.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">${t.fee.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                거래 내역이 없습니다.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ Tab 3: 성과 (Performance) ═══ */}
        <TabsContent value="performance" className="mt-4 flex flex-col gap-3">
          {activeHoldings.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">보유 종목이 없습니다.</CardContent></Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <SummaryCard label="총 수익률" value={totals.cost > 0 ? `${(((totals.mv + totals.real - totals.cost) / totals.cost) * 100).toFixed(2)}%` : "-"} tone={(totals.mv + totals.real - totals.cost) >= 0 ? "success" : "danger"} />
                <SummaryCard label="종합 P&L" value={fmt$(totals.total)} tone={totals.total >= 0 ? "success" : "danger"} />
                <SummaryCard label="종목 수" value={String(activeHoldings.length)} />
              </div>
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardHeader className="pb-2"><CardTitle className="text-sm">벤치마크 비교 (준비 중)</CardTitle></CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Streamlit은 SPY/QQQ 대비 성과 라인차트를 제공합니다.
                  현재 캐시는 5거래일 SPY만 있어서 미니 오버레이만 가능. 12M SPY 히스토리 캐시 확장 후 정식 활성화.
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ═══ Tab 4: 배당 (Dividends) ═══ */}
        <TabsContent value="dividends" className="mt-4">
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardHeader className="pb-2"><CardTitle className="text-sm">배당 캘린더 (준비 중)</CardTitle></CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              <p>Streamlit은 각 보유 종목의 예정 배당일과 배당액을 yfinance에서 조회해 표시합니다.</p>
              <p>- 연도별 필터</p>
              <p>- 월별 배당 막대 차트</p>
              <p>- 이벤트 리스트 (ticker · 배당일 · 배당액 · 주수)</p>
              <p className="mt-3 text-amber-400">배당 데이터 캐시 스크립트 (cache_dividends.py) 추가 후 활성화 예정.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Tab 5: 세금 (Tax) ═══ */}
        <TabsContent value="tax" className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label="실현 이득" value={fmt$(Math.max(0, totals.real))} tone="success" />
            <SummaryCard label="실현 손실" value={fmt$(Math.min(0, totals.real))} tone="danger" />
            <SummaryCard label="순 실현 P&L" value={fmt$(totals.real)} tone={totals.real >= 0 ? "success" : "danger"} />
            <SummaryCard label="예상 양도세 (25%)" value={fmt$(Math.max(0, totals.real) * 0.25)} tone="neutral" />
          </div>
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardHeader className="pb-2"><CardTitle className="text-sm">단기/장기 구분 (준비 중)</CardTitle></CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Streamlit은 매수-매도 매칭으로 보유기간 1년 기준 단기/장기 이득·손실을 구분합니다.
              현재는 순 실현 P&L만 표시. 상세 tax lot 계산 로직 추가 후 활성화.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-xs text-muted-foreground">
        <strong className="text-foreground">저장 위치:</strong> 브라우저 localStorage.
        Streamlit은 Turso DB에 저장하여 여러 기기에서 공유 가능. 웹 앱은 서버 인증 도입 후 동일 방식 지원 예정.
      </div>
    </div>
  );
}

// ─────────────── Sub-components ───────────────

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" | "neutral" }) {
  const color = tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : "text-foreground";
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={cn("mt-1 text-xl font-bold tabular-nums", color)}>{value}</div>
      </CardContent>
    </Card>
  );
}

function PieCard({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="text-xs">{data.length}개 항목</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                formatter={(v) => fmt$(Number(v))}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function aggregateBySector(holdings: Holding[]): { name: string; value: number }[] {
  const map = new Map<string, number>();
  for (const h of holdings) {
    const sec = h.sector ?? "Unknown";
    map.set(sec, (map.get(sec) ?? 0) + (h.marketValue ?? 0));
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function fmt$(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
