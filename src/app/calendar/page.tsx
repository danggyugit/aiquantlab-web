import { PageStub } from "@/components/page-stub";

export const metadata = { title: "캘린더 · AI Quant Lab" };

export default function CalendarPage() {
  return (
    <PageStub
      title="캘린더"
      description="경제지표 발표 및 어닝 캘린더"
      features={[
        "경제지표: CPI/PCE/고용지표/FOMC 등 주요 발표 일정 (Finnhub)",
        "어닝 캘린더: S&P500 종목 실적 발표 일정 (yfinance)",
        "월간 그리드 뷰 + 종목 필터",
        "중요도별 하이라이트 (high/medium/low)",
        "이번주 · 다음주 · 특정 월 필터",
      ]}
      streamlitUrl="https://aiquantlab.streamlit.app"
    />
  );
}
