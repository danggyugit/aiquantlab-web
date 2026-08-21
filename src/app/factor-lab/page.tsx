import { PageStub } from "@/components/page-stub";

export const metadata = { title: "Factor Lab · AI Quant Lab" };

export default function FactorLabPage() {
  return (
    <PageStub
      title="Factor Lab"
      description="가치·모멘텀·저변동성 팩터 백테스트 워크벤치"
      features={[
        "10개 팩터 스코어 함수 (PE·PB·ROE·모멘텀·변동성 등)",
        "단일 팩터 백테스트 + 다중 팩터 조합",
        "리밸런싱 주기 선택 (월간·분기·반기)",
        "PIT 데이터 · 재무 보고 지연(연간 90일) 반영",
        "생존편향 보정: 상폐 종목 마지막가 / -30% 청산 시뮬",
      ]}
      streamlitUrl="https://aiquantlab.streamlit.app"
    />
  );
}
