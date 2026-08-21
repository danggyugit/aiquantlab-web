import { PageStub } from "@/components/page-stub";

export const metadata = { title: "포트폴리오 · AI Quant Lab" };

export default function PortfolioPage() {
  return (
    <PageStub
      title="포트폴리오"
      description="실거래 기반 포트폴리오 추적·성과·세금 관리 (로그인 필요)"
      features={[
        "거래 기록: 매수/매도 입력 → 자동 평균단가·손익 계산",
        "실시간 평가: 현재 시가 기준 자산 비중·손익률",
        "배당 관리: 배당 캘린더 + 세후 실수령",
        "성과 분석: TWR·MWR·벤치마크 대비",
        "세금 요약: 실현 손익·양도세 예상액",
      ]}
      streamlitUrl="https://aiquantlab.streamlit.app"
      status="사용자 인증(Turso DB) 연동 필요 — Phase 3 예정"
    />
  );
}
