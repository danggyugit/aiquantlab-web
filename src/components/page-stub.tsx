import Link from "next/link";
import { ArrowRight, Construction, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketBadge } from "@/components/market-badge";

type PageStubProps = {
  title: string;
  description: string;
  /** 어떤 데이터/서비스가 필요한지, 무엇을 보여줄지 요약 */
  features: string[];
  /** 기존 Streamlit 앱의 해당 페이지 URL (직접 링크로 안내) */
  streamlitUrl?: string;
  /** 외부 서비스 링크 (Stock Lab처럼 다른 도메인인 경우) */
  externalUrl?: string;
  /** Coming Soon 대신 상태 문구 커스터마이즈 */
  status?: string;
};

export function PageStub({
  title,
  description,
  features,
  streamlitUrl,
  externalUrl,
  status = "이 페이지는 아직 이식 중입니다",
}: PageStubProps) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          <MarketBadge />
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-500/15 p-2">
              <Construction className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-base">{status}</CardTitle>
              <CardDescription className="mt-0.5">
                Streamlit 원본에서 계속 이용하실 수 있습니다
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              구현 예정 기능
            </div>
            <ul className="flex flex-col gap-1.5 text-sm">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="text-foreground/90">{f}</span>
                </li>
              ))}
            </ul>
          </div>
          {(streamlitUrl || externalUrl) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {streamlitUrl && (
                <Link
                  href={streamlitUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                >
                  Streamlit에서 열기
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
              {externalUrl && (
                <Link
                  href={externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-premium/40 bg-premium/10 px-3 py-1.5 text-xs font-medium text-premium hover:bg-premium/20"
                >
                  외부 서비스 열기
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
