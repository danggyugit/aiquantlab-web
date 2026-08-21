import { PageStub } from "@/components/page-stub";

export const metadata = { title: "종목 비교 · AI Quant Lab" };

export default function ComparePage() {
  return (
    <PageStub
      title="종목 비교"
      description="2~5개 종목 성과·펀더멘털 다각도 비교"
      features={[
        "정규화 수익률 선차트 (동일 시점 100으로 스케일링)",
        "펀더멘털 바차트: PER·PBR·ROE·매출성장률",
        "레이더 차트: 종합 스코어 비교",
        "가격 상관계수 매트릭스",
        "리스크 조정 수익률 (Sharpe·Sortino·MDD)",
      ]}
      streamlitUrl="https://aiquantlab.streamlit.app"
    />
  );
}
