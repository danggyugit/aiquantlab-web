import { PageStub } from "@/components/page-stub";

export const metadata = { title: "Stock Lab · AI Quant Lab" };

export default function StockLabPage() {
  return (
    <PageStub
      title="Stock Lab"
      description="AI 종목 리포트 서비스 (외부 도메인 연동)"
      features={[
        "종목별 자동 생성 AI 심층 리포트",
        "밸류에이션 · 성장성 · 재무건전성 종합 스코어",
        "동종업계 비교 분석",
        "리스크 · 촉매(catalyst) 요약",
      ]}
      externalUrl="https://aiquantlab-stocklab.pages.dev"
      streamlitUrl="https://aiquantlab.streamlit.app"
    />
  );
}
