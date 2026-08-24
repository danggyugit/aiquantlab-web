/**
 * 앱 전체 네비게이션 정의.
 * 사용자용 SPA IA — Streamlit 페이지 1:1 미러링에서 벗어나 기능별로 통합.
 * BottomNav, Sidebar, MoreDrawer가 모두 이 소스를 사용.
 *
 * 통합 이력 (Streamlit 원본 → SPA):
 *  - /dashboard      → 홈(/)에 흡수
 *  - /rs-screener,
 *    /breakout-screener → /screener 탭
 *  - /ai-quant-lab,
 *    /factor-lab      → /backtest 탭
 *  - /stock-lab       → 사이드바에서 제거 (외부 리다이렉트 라우트는 유지)
 *
 * 섹션 재구성 이력:
 *  - v1 (4섹션): Market Overview / Stock Research / Analysis / Guide
 *  - v2 (5섹션, 현재): 시장 / 리서치 / 내 자산 / 전략 / 가이드
 *    · SEC Intelligence: Analysis → 리서치 (13F 발굴 성격)
 *    · 관심목록: 리서치 → 내 자산 (개인 데이터로 재정의)
 *    · 포트폴리오: Analysis → 내 자산 (관심목록과 짝)
 *    · 백테스트: Analysis → 전략 (독립 섹션, premium 강조)
 *    · 리서치 순서: 발굴(스크리너) → 상세 → 비교 흐름 맞춤
 */

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BookOpen,
  Calendar,
  Compass,
  FlaskConical,
  FolderKanban,
  GitCompareArrows,
  Grid2X2,
  Home,
  Landmark,
  LineChart,
  ScanSearch,
  Star,
  TrendingUp,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** flagship 강조 표시 (premium 컬러) */
  premium?: boolean;
  /**
   * "Work in progress" — 이 페이지는 라우트/디자인은 있지만 데이터·기능이 제한적임.
   * 사이드바에서 WIP 배지 표시.
   */
  wip?: boolean;
  /** 외부 링크 여부 (Stock Lab처럼 서버 리다이렉트) */
  external?: boolean;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "시장",
    items: [
      { href: "/", label: "홈", icon: Home },
      { href: "/heatmap", label: "히트맵", icon: Grid2X2 },
      { href: "/macro", label: "매크로", icon: TrendingUp },
      { href: "/sentiment", label: "센티먼트", icon: Activity },
      { href: "/calendar", label: "캘린더", icon: Calendar },
    ],
  },
  {
    label: "리서치",
    items: [
      { href: "/top-down", label: "Top-Down 분석", icon: Compass, premium: true },
      { href: "/screener", label: "스크리너", icon: ScanSearch },
      { href: "/stock", label: "종목 상세", icon: LineChart },
      { href: "/compare", label: "종목 비교", icon: GitCompareArrows },
      { href: "/sec-intelligence", label: "SEC Intelligence", icon: Landmark },
    ],
  },
  {
    label: "내 자산",
    items: [
      { href: "/watchlist", label: "관심목록", icon: Star },
      { href: "/portfolio", label: "포트폴리오", icon: FolderKanban },
    ],
  },
  {
    label: "전략",
    items: [
      { href: "/backtest", label: "백테스트", icon: FlaskConical, premium: true },
    ],
  },
  {
    label: "가이드",
    items: [
      { href: "/guide", label: "가이드", icon: BookOpen },
    ],
  },
];

/** flatten 모든 아이템 (bottom nav 등에서 사용) */
export const ALL_NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
