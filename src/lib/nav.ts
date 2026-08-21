/**
 * 앱 전체 네비게이션 정의.
 * Streamlit `streamlit_app/app.py`의 PAGES dict를 미러링.
 * BottomNav, Sidebar, MoreDrawer가 모두 이 소스를 사용.
 */

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Beaker,
  BookOpen,
  Calendar,
  FlaskConical,
  FolderKanban,
  GitCompareArrows,
  Grid2X2,
  Home,
  Landmark,
  LayoutDashboard,
  LineChart,
  ScanSearch,
  Sparkles,
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
   * 사이드바에서 WIP 배지 표시. Streamlit 원본에서 대체 사용 안내.
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
    label: "Market Overview",
    items: [
      { href: "/", label: "홈", icon: Home },
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/heatmap", label: "히트맵", icon: Grid2X2 },
      { href: "/macro", label: "매크로", icon: TrendingUp },
      { href: "/sentiment", label: "센티먼트", icon: Activity },
      { href: "/calendar", label: "캘린더", icon: Calendar, wip: true },
    ],
  },
  {
    label: "Stock Research",
    items: [
      { href: "/stock", label: "종목 상세", icon: LineChart },
      { href: "/screener", label: "스크리너", icon: ScanSearch },
      { href: "/rs-screener", label: "RS 스크리너", icon: BarChart3, wip: true },
      { href: "/breakout-screener", label: "돌파 스크리너", icon: TrendingUp, wip: true },
      { href: "/compare", label: "종목 비교", icon: GitCompareArrows, wip: true },
      { href: "/watchlist", label: "관심목록", icon: Star },
    ],
  },
  {
    label: "Analysis Tools",
    items: [
      { href: "/ai-quant-lab", label: "AI Quant Lab", icon: Sparkles, premium: true },
      { href: "/factor-lab", label: "Factor Lab", icon: FlaskConical },
      { href: "/stock-lab", label: "Stock Lab", icon: Beaker, external: true },
      { href: "/sec-intelligence", label: "SEC Intelligence", icon: Landmark },
    ],
  },
  {
    label: "Portfolio",
    items: [{ href: "/portfolio", label: "포트폴리오", icon: FolderKanban }],
  },
  {
    label: "Guide",
    items: [{ href: "/guide", label: "가이드", icon: BookOpen }],
  },
];

/** flatten 모든 아이템 (bottom nav 등에서 사용) */
export const ALL_NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
