import { PageStub } from "@/components/page-stub";

export const metadata = { title: "스크리너 · AI Quant Lab" };

export default function ScreenerPage() {
  return (
    <PageStub
      title="스크리너"
      description="펀더멘털 조건 기반 종목 필터링 (Finviz 스타일)"
      features={[
        "필터: 시가총액·PER·PBR·ROE·배당수익률·부채비율 등",
        "섹터·산업 필터 (11개 SPDR 섹터)",
        "결과 테이블: 정렬·페이지네이션",
        "CSV 내보내기",
        "저장된 필터 프리셋 (성장·가치·배당 등)",
      ]}
      streamlitUrl="https://aiquantlab.streamlit.app"
    />
  );
}
