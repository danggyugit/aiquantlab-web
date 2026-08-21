import { PageStub } from "@/components/page-stub";

export const metadata = { title: "AI Quant Lab · AI Quant Lab" };

export default function AiQuantLabPage() {
  return (
    <PageStub
      title="AI Quant Lab"
      description="LLM 기반 리서치 워크벤치 + ML 백테스트 (플래그십 기능)"
      features={[
        "LLM 리서치: Claude/Gemini로 종목·섹터 자동 리포트 생성",
        "ML 백테스트: XGBoost·LightGBM·hmmlearn 기반 알파 팩터 검증",
        "실시간 종목 추천 (스코어 순위표)",
        "백테스트 성과 지표: Sharpe·Sortino·CAGR·MDD·Calmar",
        "PIT (Point-in-Time) 데이터 + 21일 embargo로 lookahead bias 방지",
      ]}
      streamlitUrl="https://aiquantlab.streamlit.app"
      status="플래그십 기능 — 이식 우선순위 최상위"
    />
  );
}
