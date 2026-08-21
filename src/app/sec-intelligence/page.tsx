import { PageStub } from "@/components/page-stub";

export const metadata = { title: "SEC Intelligence · AI Quant Lab" };

export default function SecIntelligencePage() {
  return (
    <PageStub
      title="SEC Intelligence"
      description="SEC 공시 데이터 인텔리전스 (13F · Form 4 · AI 요약)"
      features={[
        "13F: 유명 헤지펀드 포트폴리오 홀딩 추적 (분기별)",
        "Form 4: 내부자 대량 매수/매도 알림",
        "13F 컨센서스: 여러 슈퍼투자자가 공통 보유한 종목 순위",
        "공시 diff 하이라이팅 (전분기 대비 신규/증감)",
        "10-K/10-Q 텍스트 AI 요약 (Claude · Gemini)",
      ]}
      streamlitUrl="https://aiquantlab.streamlit.app"
    />
  );
}
