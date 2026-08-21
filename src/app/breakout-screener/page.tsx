import { PageStub } from "@/components/page-stub";

export const metadata = { title: "돌파 스크리너 · AI Quant Lab" };

export default function BreakoutScreenerPage() {
  return (
    <PageStub
      title="돌파 스크리너"
      description="월봉 추세채널 돌파 종목 스캔"
      features={[
        "월봉 회귀 채널 계산 (선형 회귀 + 표준편차 밴드)",
        "채널 상단 돌파 종목 자동 감지",
        "거래량 급증 필터 (평균 대비 N배)",
        "돌파 강도 스코어링 (지속성·변동성 반영)",
        "S&P500 스캔 결과 정렬 테이블",
      ]}
      streamlitUrl="https://aiquantlab.streamlit.app"
    />
  );
}
