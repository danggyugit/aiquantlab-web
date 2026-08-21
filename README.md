# AI Quant Lab Web

미국 주식 통합 리서치·퀀트 분석 웹앱 (사용자용 SPA).

- **관리자/분석 도구**: [stock-dashboard (Streamlit)](https://github.com/danggyugit/stock-dashboard) — 데이터 파이프라인, 백테스트, ML
- **이 저장소**: 일반 사용자용 모바일-우선 SPA 프론트엔드 (Next.js 16 + React 19)

## Getting Started

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 열기.

## 기술 스택

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui (Base UI + Nova preset)
- Lucide icons + Geist font
- (예정) TradingView Lightweight Charts, TanStack Query, Zustand

## 문서

- [CLAUDE.md](./CLAUDE.md) — 프로젝트 규칙 및 아키텍처 가이드
- [AGENTS.md](./AGENTS.md) — Next.js 자동 생성 (수정 금지)

## 배포

- Vercel 자동 배포: main branch push 시 프로덕션 반영, PR 시 프리뷰 URL 생성
