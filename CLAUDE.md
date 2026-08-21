@AGENTS.md

# AI Quant Lab Web — 프로젝트 규칙

## 프로젝트 개요
`aiquantlab.streamlit.app` (Streamlit 기반)의 사용자용 SPA 프론트엔드 재구현.
Streamlit은 관리자/분석 도구로 유지, 이 앱은 **일반 사용자용 모바일-우선 웹앱**.

- **참고 UI**: easyinvesting.app (레이아웃·정보 밀도 벤치마킹, 오리지널 디자인은 별도)
- **관련 repo**: [stock-dashboard](https://github.com/danggyugit/stock-dashboard) (기존 Streamlit + 데이터 파이프라인)
- **정책**: 무료 공개 앱 (Google AdSense 등 광고 허용)

## 기술 스택
- **프레임워크**: Next.js 16 (App Router) + React 19 + TypeScript
- **스타일**: Tailwind CSS v4 + shadcn/ui (Base UI + Nova preset, Lucide icons, Geist font)
- **차트**: TradingView Lightweight Charts (금융) + Recharts (일반) *(추후 설치)*
- **상태 관리**: Zustand + TanStack Query *(추후 설치)*
- **백엔드 API**: 별도 FastAPI 서버 (stock-dashboard `services/` 재사용 예정)
- **DB**: 기존 Turso 재사용 (사용자·포트폴리오)
- **인증**: Clerk 또는 Supabase Auth *(추후 결정)*
- **호스팅**: Vercel (프론트) + Render Starter (백엔드)
- **분석**: Vercel Analytics + Google Analytics 4

## 디렉터리 구조
```
src/
├── app/              # App Router 페이지 (route 별 폴더)
│   ├── layout.tsx    # 루트 레이아웃 (Geist 폰트, ThemeProvider 등)
│   ├── page.tsx      # 홈
│   └── globals.css   # Tailwind + shadcn CSS 변수
├── components/
│   └── ui/           # shadcn 컴포넌트 (수동 편집 금지 — CLI로 관리)
├── lib/
│   └── utils.ts      # cn() 등 공용 유틸
└── (features)/       # 도메인별 폴더 (heatmap, watchlist, macro 등) — 추가 예정
```

## 개발 규칙

### 컴포넌트
- shadcn/ui 컴포넌트는 `npx shadcn@latest add <name>` 로 추가, 직접 편집 지양
- 도메인 컴포넌트는 `src/features/<도메인>/components/` 하위에 배치
- 서버 컴포넌트가 기본. 인터랙션 필요 시에만 `"use client"` 지시

### 데이터 페칭
- 정적/거의 변하지 않는 데이터: Server Component에서 `fetch()` + `revalidate`
- 인터랙티브 데이터: 클라이언트에서 TanStack Query
- 초기 단계에서는 stock-dashboard의 `data/cache/*.json` GitHub raw 직접 사용 가능

### 스타일
- Tailwind 유틸리티 우선. 반복 시 컴포넌트로 추출
- 색상·간격은 shadcn CSS 변수 (`--background`, `--foreground`, `--primary` 등) 사용
- 다크 모드는 shadcn 기본 (`class` 전략)

### 코딩 규칙
- 컴포넌트 파일 `PascalCase.tsx`, 유틸 `camelCase.ts`
- 함수형 컴포넌트 + TypeScript 명시적 타입
- 서버 액션은 `"use server"` 명시, `app/actions/` 하위에 배치
- import 경로는 `@/*` 절대 경로 사용

## Git 규칙
- 커밋 메시지 영문, conventional commits (`feat:`, `fix:`, `chore:`, `docs:`)
- `.env.local` · `.env*.local` 커밋 금지 (.gitignore 이미 처리)
- Vercel 자동 배포: main push 시 프로덕션 배포, PR은 프리뷰 URL 생성

## 데이터 소스 (초기 단계)
stock-dashboard repo의 GitHub raw JSON 캐시를 활용:
```
https://raw.githubusercontent.com/danggyugit/stock-dashboard/main/streamlit_app/data/cache/<파일>.json
```
- 15분 TTL로 캐시 (Next.js `fetch(url, { next: { revalidate: 900 } })`)
- 나중에 FastAPI 백엔드가 준비되면 그쪽으로 전환

## 로드맵 (Phase)
1. **Phase 1 (진행 중)**: 프로젝트 초기 설정, 디자인 시스템, 홈·관심목록 프로토타입
2. **Phase 2**: FastAPI 백엔드 (stock-dashboard services 래핑)
3. **Phase 3**: 전체 페이지 이관 (히트맵·매크로·스크리너·차트 등)
4. **Phase 4**: 인증, 개인 포트폴리오, 광고, 도메인 연결
