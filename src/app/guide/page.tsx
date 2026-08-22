import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";

export const metadata = { title: "가이드 · AI Quant Lab" };

/**
 * Mirrors Streamlit 15_Guide.py:
 *   - Hero header (title + subtitle)
 *   - 4 tabs: Market Overview / Analysis / My Investing / Research
 *   - Each tab: 4-8 `<details>` expanders (Streamlit st.expander) with:
 *       - 한 줄 요약
 *       - 주요 기능 (bullet list)
 *       - 사용법 (step-block)
 *       - 팁 (tip-block, optional)
 *   - Research tab also has "빠른 참고" 2-col FAQ + workflow section
 */

type Expander = {
  emoji: string;
  title: string;
  summary: string;
  features: string[];
  usage?: string;   // step-block content (HTML: use <br> between steps)
  tip?: string;     // tip-block content
  loginRequired?: boolean;
  defaultOpen?: boolean;
};

// ───── Tab 1: Market Overview ─────
const OVERVIEW: Expander[] = [
  {
    emoji: "🏠",
    title: "Home — 대시보드 메인 화면",
    summary: "앱 진입 시 가장 먼저 보이는 요약 페이지로, 핵심 시장 지표와 빠른 이동 링크를 제공합니다.",
    features: [
      "주요 지수(S&P 500 / Nasdaq / Dow) 현재 시세 및 등락률",
      "Fear & Greed Index 현재 수치 (공포/탐욕 시장 심리)",
      "포트폴리오 요약 카드 (로그인 시)",
      "어닝 캘린더 주요 일정 미리보기",
      "각 메뉴로 바로 이동하는 퀵 액션 카드",
    ],
    tip: "💡 매일 앱을 열면 Home에서 시장 분위기를 30초 안에 파악할 수 있습니다.",
    defaultOpen: true,
  },
  {
    emoji: "📊",
    title: "Dashboard — 시장 종합 현황",
    summary: "지수 차트, 섹터 히트맵, 포트폴리오 요약, 뉴스 피드를 한 화면에서 확인합니다.",
    features: [
      "주요 4대 지수(S&P 500 / Nasdaq / Dow / VIX) 메트릭 + 당일 인트라데이 미니 차트",
      "기간 선택: 1D / 5D / 1M 차트 전환",
      "섹터별 자금 흐름 히트맵 (11개 GICS 섹터)",
      "포트폴리오 보유 종목 현황 (로그인 필요)",
      "실시간 시장 뉴스 피드",
    ],
    usage: "① 상단 지수 카드에서 오늘 주요 지수 흐름 확인<br>② 섹터 히트맵으로 자금이 몰리는 섹터 파악<br>③ 뉴스 피드에서 시장 이슈 스캔",
  },
  {
    emoji: "🗺️",
    title: "Heatmap — S&P 500 트리맵",
    summary: "S&P 500 전 종목을 섹터별 트리맵으로 시각화해 종목별 등락률을 한눈에 비교합니다.",
    features: [
      "섹터별 색상 코딩 트리맵 (초록=상승, 빨강=하락, 크기=시가총액)",
      "기간 선택: 1D / 1W / 1M / 3M / YTD / 1Y",
      "종목 로고 그리드 뷰 (트리맵 대안)",
      "캐시 상태 표시 및 수동 새로고침",
    ],
    usage: "① 기간 버튼으로 원하는 기간 선택<br>② 트리맵에서 큰 블록(=대형주)의 색상으로 시장 흐름 파악<br>③ 캐시가 오래됐다면 새로고침 버튼 클릭 (약 30초 소요)",
    tip: "💡 1D 기준 트리맵에서 대부분 빨간색 → 전반적 하락장 신호. 특정 섹터만 초록 → 순환매 포착.",
  },
  {
    emoji: "📅",
    title: "Calendar — 경제 지표 & 어닝 일정",
    summary: "예정된 경제 지표 발표(CPI, 금리 결정 등)와 기업 실적 발표 일정을 달력으로 확인합니다.",
    features: [
      "경제 이벤트 탭: Fed 금리, CPI, PMI, 고용지표 등 중요도별 필터",
      "어닝 캘린더 탭: 기업 실적 발표 예정일 및 심볼",
      "날짜 범위 선택 (연/월)",
      "중요도 배지 (High / Medium / Low)",
    ],
    usage: "① 경제 이벤트 탭 → 이번 주 High 중요도 이벤트 확인<br>② 어닝 탭 → 보유 종목의 실적 발표일 체크<br>③ 날짜를 변경해 다음 달 일정도 미리 확인 가능",
    tip: "💡 CPI, FOMC 발표일 전후는 변동성이 커집니다. 미리 캘린더에서 확인하고 포지션을 점검하세요.",
  },
];

// ───── Tab 2: Analysis ─────
const ANALYSIS: Expander[] = [
  {
    emoji: "📈",
    title: "Stock Detail — 개별 종목 상세 분석",
    summary: "특정 종목의 가격 차트, 재무, 뉴스, 애널리스트 목표가, 실적 서프라이즈, 내부거래를 심층 분석합니다.",
    features: [
      "TradingView 임베드 차트 (기술 지표 · 기간 조절)",
      "핵심 재무 메트릭 8개 (P/E, P/B, EPS, ROE, 배당, β 등)",
      "AI 시나리오 밸류에이션 (Bear/Base/Bull)",
      "애널리스트 컨센서스 및 개별 목표가 차트",
      "다중 PER 기반 공정가치 테이블",
      "실적 서프라이즈 히스토리 + Beat/Miss 비율",
      "SEC Form 4 기반 내부자 거래",
      "AI 실적 요약 (Gemini)",
    ],
    usage: "① 검색창에 티커 입력 (예: AAPL) 또는 회사명 검색<br>② TradingView 차트에서 원하는 기간·기술지표 조작<br>③ 애널리스트 목표가와 비교해 현재가 판단<br>④ AI 요약 버튼으로 최신 실적 인사이트 확인",
    defaultOpen: true,
  },
  {
    emoji: "🔎",
    title: "Screener — 펀더멘털 종목 스크리너",
    summary: "P/E · P/B · ROE · 배당 · 시총 · 거래량 조건으로 S&P 500 종목을 필터링합니다.",
    features: [
      "밸류에이션: P/E, P/B, P/S, 배당수익률",
      "퀄리티: ROE, 부채비율, EPS, β",
      "유동성: 시총 구간, 평균 거래량",
      "섹터/산업 다중 선택",
      "결과 정렬 (시총/티커/각 지표별)",
    ],
    usage: "① 필터 조건 설정 → Apply Filters 버튼 클릭<br>② 결과 테이블에서 관심 종목 확인<br>③ 티커 클릭 → Stock Detail로 이동",
    tip: "💡 조건이 너무 많으면 결과가 0건이 됩니다. 처음엔 2-3개 필터로 시작하세요.",
  },
  {
    emoji: "📊",
    title: "RS Screener — 상대 강도 스크리너",
    summary: "IBD 방식의 RS Rating(1~99)으로 시장 대비 상대 강도가 강한 종목을 발굴합니다.",
    features: [
      "RS Rating 분포 히스토그램",
      "섹터/시총 필터 + 최소 RS 슬라이더",
      "RS 90+ 종목 하이라이트 (강세 신호)",
      "1개월/3개월/12개월 수익률 비교 테이블",
    ],
    usage: "① 섹터 선택 → 실행 버튼<br>② RS 슬라이더로 최소 RS Rating 조정 (권장 70+)<br>③ RS 90+ 종목 우선 검토",
    tip: "💡 RS 90+ 종목은 최근 12개월 수익률이 시장 상위 10%에 속합니다. 모멘텀 투자의 시작점입니다.",
  },
  {
    emoji: "🔀",
    title: "Compare — 종목 비교",
    summary: "최대 5개 종목을 정규화 수익률, 펀더멘털, 레이더 차트로 비교합니다.",
    features: [
      "정규화 수익률 라인 차트 (시작=100)",
      "기간별 수익률 막대 차트",
      "펀더멘털 비교 테이블 (P/E · P/B · ROE · β 등)",
      "레이더 차트 (5개 지표 정규화)",
    ],
    usage: "① 티커 검색 → 최대 5개 선택<br>② 라인 차트로 상대 성과 비교<br>③ 레이더 차트로 각 종목의 특성 파악",
  },
  {
    emoji: "🧠",
    title: "Sentiment — 시장 심리 분석",
    summary: "Fear & Greed 지수, VIX, 시장 폭, 섹터 회전, 뉴스 감정 분석까지 시장 심리를 종합합니다.",
    features: [
      "Fear & Greed Index 게이지 + 구성 요소 (VIX/모멘텀/폭)",
      "VIX 트렌드 차트 (30일)",
      "Market Breadth (200일선 위 종목 비율)",
      "섹터 회전 맵 (RRG, 4-분면)",
      "Market/Stock 뉴스 워드클라우드 + 감정 배지",
      "AI 시장 리포트 생성",
    ],
    usage: "① Fear & Greed 수치로 큰 그림 파악<br>② VIX + Breadth로 위험 수준 확인<br>③ 뉴스 탭에서 시장 이슈 스캔",
  },
];

// ───── Tab 3: My Investing ─────
const INVESTING: Expander[] = [
  {
    emoji: "💼",
    title: "Portfolio — 포트폴리오 관리",
    summary: "실거래 기록으로 보유 자산, 실현/미실현 손익, 성과, 배당, 세금까지 통합 관리합니다.",
    features: [
      "포트폴리오 다중 생성 · 관리",
      "매수/매도 거래 입력 (자동 가격 페치)",
      "보유 종목 카드/테이블 뷰",
      "섹터별 · 종목별 파이 차트 + 트리맵",
      "성과 분석 (기간별 수익률 + SPY/QQQ 벤치마크)",
      "리스크 지표 (MDD, 변동성, Sharpe)",
      "배당 캘린더",
      "세금 요약 (실현 손익 · 단기/장기 구분)",
    ],
    usage: "① 포트폴리오 생성<br>② 거래 탭에서 매수/매도 입력<br>③ 성과 탭에서 벤치마크 대비 수익률 확인",
    loginRequired: true,
    defaultOpen: true,
  },
  {
    emoji: "⭐",
    title: "Watchlist — 관심 종목 & 알림",
    summary: "관심 종목을 저장하고 가격/변화율 알림을 설정합니다.",
    features: [
      "관심 종목 카드 (현재가, 당일 변화, 등록일 이후 수익률)",
      "메모 첨부",
      "가격 알림: X 이상/이하, 변화율 X% 이상/이하",
      "발동된 알림 자동 표시",
    ],
    usage: "① Ticker 입력 → Add<br>② Alerts 탭 → 조건별 알림 생성<br>③ 페이지 방문 시 자동 체크",
    loginRequired: true,
  },
  {
    emoji: "🤖",
    title: "AI Quant Lab — AI 기반 퀀트 백테스트",
    summary: "ML 모델(RF/XGB/LightGBM)로 종목을 스코어링하고 리밸런싱하는 팩터 백테스트 워크벤치.",
    features: [
      "유니버스 필터 (섹터 · 시총 티어)",
      "리밸런싱 주기 · 롤링 학습 · 종목수 · 기간",
      "전략 옵션: Ensemble, 턴오버 버퍼, 모멘텀 필터, 가중치",
      "현금 전략: 없음/변동성 목표/레짐/결합",
      "결과 8탭: Summary/Live Picks/Performance/IC/History/Importance/Heatmap/Tracking",
      "일일 자동 계산 5개 대표 프리셋",
    ],
    tip: "💡 커스텀 config는 Python 백엔드가 필요해 가장 가까운 프리셋으로 매칭됩니다.",
    loginRequired: true,
  },
  {
    emoji: "🧪",
    title: "Factor Lab — 룰 기반 퀀트 백테스터",
    summary: "가치/모멘텀/저변동성 등 팩터를 조합해 백테스트 결과를 확인합니다.",
    features: [
      "10개 팩터 스코어 함수",
      "PIT 재무 데이터 + 21일 embargo",
      "생존편향 보정",
      "핵심 지표: CAGR · Sharpe · Sortino · MDD",
      "최신 편입 종목",
    ],
    loginRequired: true,
  },
  {
    emoji: "🔬",
    title: "Stock Lab — AI 종목 리포트",
    summary: "외부 서비스에서 AI 기반 종목 심층 리포트를 확인합니다.",
    features: [
      "종목별 자동 생성 AI 심층 리포트",
      "밸류에이션 · 성장성 · 재무건전성 종합 스코어",
      "리스크 · 촉매 요약",
    ],
    tip: "💡 별도 도메인(aiquantlab-stocklab.pages.dev)에서 열립니다.",
  },
];

// ───── Tab 4: Research ─────
const RESEARCH: Expander[] = [
  {
    emoji: "📉",
    title: "Macro — 거시경제 지표 대시보드",
    summary: "FRED 기반 유동성 · 금리 · 인플레이션 · 달러/상품 시계열을 통합 대시보드로 제공합니다.",
    features: [
      "유동성: Net Liquidity, RRP, TGA, Reserves, HY Spread, M1/M2, Fed Balance Sheet",
      "금리: Fed Funds Rate, 10Y/2Y Treasury + Spread",
      "인플레이션: CPI YoY, Core PCE YoY (Fed 목표 2% 참조선)",
      "달러/상품: DXY, WTI",
    ],
    usage: "① Net Liquidity vs S&P 500 오버레이로 유동성 흐름 파악<br>② 10Y-2Y Spread 음수 → 경기침체 시그널<br>③ CPI 3% 이상 → 인플레이션 압력",
    defaultOpen: true,
  },
];

export default function GuidePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
      {/* Hero */}
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.10] via-transparent to-transparent p-6 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">가이드</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          AI Quant Lab의 모든 기능을 카테고리별로 안내합니다. Streamlit 15_Guide.py 미러링.
        </p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap gap-1 bg-transparent p-0">
          <TabsTrigger value="overview" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            🌐 Market Overview
          </TabsTrigger>
          <TabsTrigger value="analysis" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            🔍 Analysis
          </TabsTrigger>
          <TabsTrigger value="investing" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            💼 My Investing
          </TabsTrigger>
          <TabsTrigger value="research" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            📈 Research
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 flex flex-col gap-3">
          <TabIntro
            tag="Overview"
            text="시장 전체 현황을 빠르게 파악하는 페이지 모음입니다."
          />
          {OVERVIEW.map((e) => <ExpanderCard key={e.title} data={e} />)}
        </TabsContent>

        <TabsContent value="analysis" className="mt-4 flex flex-col gap-3">
          <TabIntro
            tag="Analysis"
            text="개별 종목 분석, 스크리닝, 비교, 심리 지표를 다루는 페이지 모음입니다."
          />
          {ANALYSIS.map((e) => <ExpanderCard key={e.title} data={e} />)}
        </TabsContent>

        <TabsContent value="investing" className="mt-4 flex flex-col gap-3">
          <TabIntro
            tag="My Investing"
            text="실제 투자와 연결된 개인화 도구입니다. 대부분 로그인이 필요합니다."
          />
          {INVESTING.map((e) => <ExpanderCard key={e.title} data={e} />)}
        </TabsContent>

        <TabsContent value="research" className="mt-4 flex flex-col gap-3">
          <TabIntro
            tag="Research"
            text="거시경제와 자금 흐름을 깊이 있게 분석합니다."
          />
          {RESEARCH.map((e) => <ExpanderCard key={e.title} data={e} />)}

          {/* Quick Reference */}
          <div className="mt-4">
            <h2 className="mb-3 text-lg font-semibold">📌 빠른 참고</h2>
            <div className="grid gap-3 lg:grid-cols-2">
              <FaqCard />
              <WorkflowCard />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TabIntro({ tag, text }: { tag: string; text: string }) {
  return (
    <div className="text-sm text-muted-foreground">
      <Badge className="mr-2 bg-primary/15 text-primary">{tag}</Badge>
      {text}
    </div>
  );
}

function ExpanderCard({ data }: { data: Expander }) {
  return (
    <details className="group" open={data.defaultOpen}>
      <summary className="flex cursor-pointer items-center justify-between rounded-lg border border-border/40 bg-card/50 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-primary/[0.03]">
        <div className="flex items-center gap-2">
          <span className="text-lg">{data.emoji}</span>
          <span className="font-semibold">{data.title}</span>
          {data.loginRequired && (
            <Badge className="ml-2 bg-amber-500/20 text-amber-400 text-[10px]">로그인 필요</Badge>
          )}
        </div>
        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-2 rounded-lg border border-border/30 bg-card/30 p-4 text-sm">
        <div className="text-foreground">
          <strong>한 줄 요약</strong>: {data.summary}
        </div>
        <div className="mt-3">
          <strong>주요 기능</strong>
          <ul className="mt-1 flex flex-col gap-1 text-xs text-muted-foreground">
            {data.features.map((f) => (
              <li key={f} className="flex items-start gap-1.5">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
        {data.usage && (
          <div className="mt-3 border-l-4 border-primary/60 bg-primary/[0.06] p-3 text-xs text-foreground/90">
            <strong className="mb-1 block text-primary">사용법</strong>
            <span dangerouslySetInnerHTML={{ __html: data.usage }} />
          </div>
        )}
        {data.tip && (
          <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/[0.08] p-3 text-xs text-amber-100/90">
            {data.tip}
          </div>
        )}
      </div>
    </details>
  );
}

function FaqCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">❓ FAQ</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-xs">
        <FaqItem
          q="데이터는 얼마나 자주 갱신되나요?"
          a="가격/펀더멘털은 15분, 백테스트 프리셋은 매일 자정, FRED 매크로는 매일 시장 마감 후 갱신됩니다."
        />
        <FaqItem
          q="AI Quant Lab vs Factor Lab 차이?"
          a="AI Quant Lab은 ML 모델(RF/XGB/LightGBM)로 스코어링, Factor Lab은 규칙 기반 팩터 조합. AI Quant Lab이 더 flexible하지만 계산 비용이 큽니다."
        />
        <FaqItem
          q="RS Rating은 어떻게 활용?"
          a="RS 90+ 종목은 최근 12개월 수익률이 시장 상위 10%. 모멘텀 종목 발굴에 사용. 단, 반전 리스크 있음 (평균회귀)."
        />
      </CardContent>
    </Card>
  );
}

function WorkflowCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">📅 투자 워크플로우</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-xs">
        <WorkflowItem
          title="🌅 아침 루틴 (5분)"
          steps={["Home에서 지수·F&G 확인", "Sentiment에서 시장 심리 체크", "Portfolio 손익 확인"]}
        />
        <WorkflowItem
          title="🔎 종목 발굴 (30분)"
          steps={["Heatmap → 강한 섹터 파악", "Screener → 조건 필터", "RS Screener → 모멘텀 종목", "Stock Detail → 심층 분석"]}
        />
        <WorkflowItem
          title="📊 월간 점검 (1시간)"
          steps={["Portfolio Performance 탭 → 벤치마크 대비", "AI Quant Lab 백테스트 결과 확인", "리밸런싱 결정"]}
        />
      </CardContent>
    </Card>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <div className="font-semibold text-foreground">Q. {q}</div>
      <div className="mt-0.5 text-muted-foreground">{a}</div>
    </div>
  );
}

function WorkflowItem({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div>
      <div className="font-semibold text-foreground">{title}</div>
      <ol className="mt-0.5 ml-4 list-decimal text-muted-foreground">
        {steps.map((s) => <li key={s}>{s}</li>)}
      </ol>
    </div>
  );
}
