"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Trade = {
  id: string;
  ticker: string;
  side: "buy" | "sell";
  shares: number;
  price: number;      // USD per share
  fee: number;        // USD
  date: string;       // YYYY-MM-DD
  note?: string;
};

type Holding = {
  ticker: string;
  shares: number;
  avgCost: number;    // weighted-average buy price (USD)
  realizedPnl: number;
  currentPrice?: number;
  marketValue?: number;
  unrealizedPnl?: number;
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

function saveTrades(trades: Trade[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
}

/** Weighted-average buy price with realized P&L on sells (FIFO/average). */
function computeHoldings(trades: Trade[]): Holding[] {
  const map = new Map<string, Holding>();

  for (const t of [...trades].sort((a, b) => a.date.localeCompare(b.date))) {
    const h = map.get(t.ticker) ?? { ticker: t.ticker, shares: 0, avgCost: 0, realizedPnl: 0 };
    if (t.side === "buy") {
      const newShares = h.shares + t.shares;
      const totalCost = h.shares * h.avgCost + t.shares * t.price + t.fee;
      h.avgCost = newShares > 0 ? totalCost / newShares : 0;
      h.shares = newShares;
    } else {
      // sell
      const proceeds = t.shares * t.price - t.fee;
      const costBasis = t.shares * h.avgCost;
      h.realizedPnl += proceeds - costBasis;
      h.shares = Math.max(0, h.shares - t.shares);
    }
    map.set(t.ticker, h);
  }

  return Array.from(map.values());
}

export function PortfolioClient({ quotes }: { quotes: Record<string, number> }) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    ticker: "",
    side: "buy" as "buy" | "sell",
    shares: "",
    price: "",
    fee: "0",
    date: new Date().toISOString().slice(0, 10),
    note: "",
  });

  useEffect(() => {
    setTrades(loadTrades());
  }, []);

  const holdings = useMemo(() => {
    const raw = computeHoldings(trades);
    return raw
      .map((h) => {
        const currentPrice = quotes[h.ticker];
        if (currentPrice && h.shares > 0) {
          const marketValue = currentPrice * h.shares;
          const unrealizedPnl = (currentPrice - h.avgCost) * h.shares;
          return { ...h, currentPrice, marketValue, unrealizedPnl };
        }
        return h;
      })
      .sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0));
  }, [trades, quotes]);

  const totals = useMemo(() => {
    let mv = 0;
    let unreal = 0;
    let real = 0;
    for (const h of holdings) {
      mv += h.marketValue ?? 0;
      unreal += h.unrealizedPnl ?? 0;
      real += h.realizedPnl;
    }
    return { mv, unreal, real, total: unreal + real };
  }, [holdings]);

  function handleSubmit() {
    const shares = parseFloat(form.shares);
    const price = parseFloat(form.price);
    const fee = parseFloat(form.fee) || 0;
    if (!form.ticker || !shares || !price) {
      toast.error("티커·수량·가격은 필수입니다");
      return;
    }
    const trade: Trade = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ticker: form.ticker.toUpperCase().trim(),
      side: form.side,
      shares,
      price,
      fee,
      date: form.date,
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

  function handleClearAll() {
    if (!confirm("모든 거래 내역을 삭제할까요? (되돌릴 수 없음)")) return;
    setTrades([]);
    saveTrades([]);
    toast.info("전체 삭제 완료");
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-4">
        <SummaryCard label="평가액" value={fmt$(totals.mv)} />
        <SummaryCard
          label="평가손익"
          value={fmt$(totals.unreal)}
          color={totals.unreal >= 0 ? "text-success" : "text-destructive"}
        />
        <SummaryCard
          label="실현손익"
          value={fmt$(totals.real)}
          color={totals.real >= 0 ? "text-success" : "text-destructive"}
        />
        <SummaryCard
          label="총 손익"
          value={fmt$(totals.total)}
          color={totals.total >= 0 ? "text-success" : "text-destructive"}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          거래 {trades.length}건 · 보유 {holdings.filter((h) => h.shares > 0).length}종목
        </div>
        <div className="flex gap-2">
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger
              render={
                <Button size="sm">
                  <Plus className="mr-1 h-4 w-4" /> 거래 추가
                </Button>
              }
            />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>새 거래</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="ticker">티커</Label>
                    <Input
                      id="ticker"
                      value={form.ticker}
                      placeholder="AAPL"
                      onChange={(e) => setForm({ ...form, ticker: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="side">구분</Label>
                    <Select
                      value={form.side}
                      onValueChange={(v) => setForm({ ...form, side: ((v as string) ?? "buy") as "buy" | "sell" })}
                    >
                      <SelectTrigger id="side">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="buy">매수</SelectItem>
                        <SelectItem value="sell">매도</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="shares">수량</Label>
                    <Input
                      id="shares"
                      type="number"
                      value={form.shares}
                      onChange={(e) => setForm({ ...form, shares: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="price">가격 (USD)</Label>
                    <Input
                      id="price"
                      type="number"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="fee">수수료</Label>
                    <Input
                      id="fee"
                      type="number"
                      value={form.fee}
                      onChange={(e) => setForm({ ...form, fee: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="date">거래일</Label>
                    <Input
                      id="date"
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsOpen(false)}>취소</Button>
                <Button onClick={handleSubmit}>추가</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {trades.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleClearAll}>
              전체 삭제
            </Button>
          )}
        </div>
      </div>

      {/* Holdings */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">보유 종목</CardTitle>
          <CardDescription className="text-xs">
            현재가는 stock-dashboard 캐시(15분 TTL) 기준. 종목별 평균단가·평가손익 자동 계산.
          </CardDescription>
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
                <th className="px-3 py-2 text-right">평가손익</th>
                <th className="px-3 py-2 text-right">실현손익</th>
              </tr>
            </thead>
            <tbody>
              {holdings.filter((h) => h.shares > 0 || h.realizedPnl !== 0).map((h) => (
                <tr key={h.ticker} className="border-b border-border/30">
                  <td className="px-3 py-2 font-mono text-xs font-semibold text-primary">{h.ticker}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{h.shares}</td>
                  <td className="px-3 py-2 text-right tabular-nums">${h.avgCost.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {h.currentPrice ? `$${h.currentPrice.toFixed(2)}` : "-"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {h.marketValue ? fmt$(h.marketValue) : "-"}
                  </td>
                  <td className={cn(
                    "px-3 py-2 text-right tabular-nums",
                    (h.unrealizedPnl ?? 0) >= 0 ? "text-success" : "text-destructive",
                  )}>
                    {h.unrealizedPnl !== undefined ? fmt$(h.unrealizedPnl) : "-"}
                  </td>
                  <td className={cn(
                    "px-3 py-2 text-right tabular-nums",
                    h.realizedPnl >= 0 ? "text-success" : "text-destructive",
                  )}>
                    {h.realizedPnl !== 0 ? fmt$(h.realizedPnl) : "-"}
                  </td>
                </tr>
              ))}
              {holdings.filter((h) => h.shares > 0).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    거래를 추가하면 보유 종목이 표시됩니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Trade history */}
      {trades.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">거래 내역</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/20 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">날짜</th>
                  <th className="px-3 py-2">종목</th>
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
                    <td className={cn(
                      "px-3 py-2 text-xs font-semibold",
                      t.side === "buy" ? "text-success" : "text-destructive",
                    )}>
                      {t.side === "buy" ? "매수" : "매도"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{t.shares}</td>
                    <td className="px-3 py-2 text-right tabular-nums">${t.price.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">${t.fee.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(t.id)}
                        aria-label={`Delete ${t.ticker} ${t.side} on ${t.date}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-xs text-muted-foreground">
        <strong className="text-foreground">저장 위치:</strong> 브라우저 localStorage. 기기별 로컬 저장으로,
        서버에는 어떤 정보도 전송되지 않습니다. 다른 기기와 동기화는 향후 인증(Turso) 도입 후 지원됩니다.
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: { label: string; value: string; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={cn("mt-1 text-xl font-bold tabular-nums", color ?? "text-foreground")}>{value}</div>
      </CardContent>
    </Card>
  );
}

function fmt$(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
