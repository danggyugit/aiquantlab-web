import { PageStub } from "@/components/page-stub";

export const metadata = { title: "종목 상세 · AI Quant Lab" };

export default function StockPage() {
  return (
    <PageStub
      title="종목 상세"
      description="개별 종목 심층 분석 (가격·재무·밸류·뉴스·인사이더)"
      features={[
        "가격 차트: 캔들 + RSI/MACD/볼린저 밴드",
        "재무제표: 손익·재무상태·현금흐름 (5년)",
        "밸류에이션: PE/PB/DCF 멀티모델 공정가치 계산",
        "애널리스트 컨센서스: 목표가·매수/매도 등급 분포",
        "뉴스 피드 + 인사이더 거래 이력",
      ]}
      streamlitUrl="https://aiquantlab.streamlit.app"
    />
  );
}
