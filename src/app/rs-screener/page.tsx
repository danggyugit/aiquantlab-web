import { PageStub } from "@/components/page-stub";

export const metadata = { title: "RS 스크리너 · AI Quant Lab" };

export default function RsScreenerPage() {
  return (
    <PageStub
      title="RS 스크리너"
      description="IBD RS Rating 기반 상대강도 스크리너 (12개월 모멘텀 백분위)"
      features={[
        "RS Rating 1~99 백분위 계산 (12M 성과 기준)",
        "섹터/산업별 RS 분포 히스토그램",
        "상위 RS 종목 랭킹 (기본 90 이상)",
        "RS 상승/하락 종목 트래킹",
        "S&P500 전체 대비 상대 성과 시각화",
      ]}
      streamlitUrl="https://aiquantlab.streamlit.app"
    />
  );
}
