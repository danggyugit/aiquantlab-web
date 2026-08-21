import { PageStub } from "@/components/page-stub";

export const metadata = { title: "매크로 · AI Quant Lab" };

export default function MacroPage() {
  return (
    <PageStub
      title="매크로"
      description="미국 거시경제 지표 대시보드 (FRED API 기반)"
      features={[
        "유동성: M2, RRP, TGA, WALCL 등 Fed 유동성 지표",
        "금리: 2Y·10Y 국채, 회사채 스프레드, 실효 정책금리(EFFR)",
        "인플레이션: CPI, PCE, PPI + 근원 지표 시계열",
        "고용: 실업률, 비농업 고용, 신규 실업급여 청구",
        "상품/환율: DXY, WTI, 금·구리 상대강도",
      ]}
      streamlitUrl="https://aiquantlab.streamlit.app"
    />
  );
}
