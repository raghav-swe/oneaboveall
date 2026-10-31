"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Overview", icon: "⌂", live: true },
  { href: "/history", label: "Flight history", icon: "◷" },
  { href: "/config", label: "Control center", icon: "⌘" },
  { href: "/support", label: "Support desk", icon: "?" },
];
export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <div className="brand"><img src="/logo.svg" alt="OneAboveAll" className="brand-logo" width={31} height={31} /><span><b>oneaboveall</b><small>AI OPERATIONS</small></span></div>
      <div className="workspace-pill"><span className="live-dot" /> production <span className="chevron">⌄</span></div>
      <nav aria-label="Main navigation">
        <p className="nav-label">Workspace</p>
        {links.map((link) => <Link key={link.href} href={link.href} className={`nav-link ${pathname.startsWith(link.href) ? "active" : ""}`}><span className="nav-icon">{link.icon}</span>{link.label}{link.live && <span className="nav-live">LIVE</span>}</Link>)}
      </nav>
      <div className="sidebar-spacer" />
      <div className="profile"><div className="avatar">NS</div><div><b>Naitik Sharma</b><small>Platform engineer</small></div><span className="profile-more">•••</span></div>
    </aside>
  );
}
