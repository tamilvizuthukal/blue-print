import { useEffect, useState } from 'react';
import {
  BarChart3, Bell, BriefcaseBusiness, CalendarDays, ChevronDown,
  ChevronLeft, ChevronRight, CircleDollarSign, ClipboardList, Headphones, HelpCircle,
  LayoutDashboard, Menu, MoreVertical, Search, Settings, Star, Target, Users,
  Zap, type LucideIcon
} from 'lucide-react';
import '../src/sales-dashboard.css';

type NavItem = { label: string; icon: LucideIcon };

const navItems: NavItem[] = [
  { label: 'Sales overview', icon: LayoutDashboard }, { label: 'Teams', icon: Users },
  { label: 'Companies', icon: BriefcaseBusiness }, { label: 'Contacts', icon: Users },
  { label: 'Calendar', icon: CalendarDays }, { label: 'Deals', icon: CircleDollarSign },
  { label: 'Activities', icon: ClipboardList }, { label: 'Pipeline', icon: Target },
  { label: 'Reports', icon: BarChart3 }, { label: 'Goals', icon: Zap },
  { label: 'Support', icon: Headphones }, { label: 'Settings', icon: Settings },
];

function More() {
  const [isOpen, setIsOpen] = useState(false);
  return <span className="sd-more-wrap"><button className="sd-more" onClick={() => setIsOpen(value => !value)} aria-label="More options" aria-expanded={isOpen}><MoreVertical size={14} /></button>{isOpen && <span className="sd-mini-popover" role="status">More actions</span>}</span>;
}

function NavRail({ expanded, mobileOpen, onToggle, onNavigate }: { expanded: boolean; mobileOpen: boolean; onToggle: () => void; onNavigate: () => void }) {
  return <>
    <aside className={`sd-sidebar ${expanded ? 'is-expanded' : ''} ${mobileOpen ? 'is-mobile-open' : ''}`}>
      <div className="sd-brand"><span>⌘</span>{expanded && <strong>freeetext</strong>}</div>
      <nav aria-label="Sales navigation">
        {navItems.map(({ label, icon: Icon }, index) => <button key={label} onClick={onNavigate} className={`sd-navitem ${index === 0 ? 'is-active' : ''}`} title={label}>
          <Icon size={17} strokeWidth={index === 0 ? 2.5 : 1.9} /><span>{label}</span>
        </button>)}
      </nav>
      <button className="sd-collapse" onClick={onToggle} aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'} title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}>
        {expanded ? <ChevronLeft size={17} /> : <ChevronRight size={17} />}<span>{expanded ? 'Collapse' : 'Expand'}</span>
      </button>
    </aside>
    {mobileOpen && <button className="sd-backdrop" aria-label="Close navigation" onClick={onToggle} />}
  </>;
}

function Metric({ title, value, kind }: { title: string; value: string; kind?: 'forecast' }) {
  return <article className={`sd-card sd-metric ${kind === 'forecast' ? 'sd-forecast' : ''}`}><div className="sd-card-top"><h3>{title}</h3><More /></div>
    <div className="sd-metric-value"><small>{kind === 'forecast' ? 'Weighted amount' : title === 'Open sales this month' ? 'Actual amount' : 'Sold month to date'}</small><strong>{value}</strong><span>{title === 'Sold MTD' ? 'Target (All sales – John Smith): 0 EUR' : title === 'Open sales this month' ? 'Target (All sales – John Smith): 0 EUR' : 'Target (All sales – John Smith): 648K EUR (0%)'}</span></div>
  </article>;
}

function WeightedChart() { return <article className="sd-card sd-chart-card sd-weighted"><div className="sd-card-top"><h3>Sales forecast - weighted</h3><More /></div><div className="sd-chart plot-grid"><span className="axis a4">400K</span><span className="axis a3">300K</span><span className="axis a2">200K</span><span className="axis a1">100K</span><div className="weighted-bar b1"><b>175K EUR</b></div><div className="weighted-bar b2"><b>342K EUR</b></div><i className="line-path" /><i className="dot d1" /><i className="dot d2" /></div><div className="sd-legend"><span><i className="open" />Open</span><span><i className="sold" />Sold</span><span><i className="count" />Count</span></div></article> }
function DonutChart() { return <article className="sd-card sd-chart-card sd-donut-card"><div className="sd-card-top"><h3>Won sales by reason</h3><More /></div><div className="sd-donut-wrap"><div className="sd-donut"><div><b>4.14M</b><small>EUR</small></div></div><span className="donut-label l1">225 EUR</span><span className="donut-label l2">1.78M EUR</span><span className="donut-label l3">1.35M EUR</span><span className="donut-label l4">781k EUR</span></div><div className="sd-legend"><span><i className="price" />Price</span><span><i className="solution" />Solution</span><span><i className="personality" />Personality</span><span><i className="performance" />Performance</span></div></article> }
function AreaChart() { const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return <article className="sd-card sd-chart-card sd-area-card"><div className="sd-card-top"><h3>Sold this year compared to last year</h3><More /></div><div className="area-frame"><div className="area-y"><span>200K</span><span>150K</span><span>100K</span><span>50K</span><span>0</span></div><svg viewBox="0 0 600 170" preserveAspectRatio="none" aria-label="Sales chart for 2024 and 2025" role="img"><path className="area-2025" d="M10 145 L10 53 L55 63 L100 160 L145 110 L190 145 L235 105 L280 140 L325 170 L370 164 L415 112 L460 26 L505 45 L550 32 L590 38 L590 145 Z"/><path className="area-2024" d="M10 145 L10 51 L55 60 L100 160 L145 108 L190 142 L235 104 L280 140 L325 168 L370 164"/><polyline className="area-line" points="10,51 55,60 100,160 145,108 190,142 235,104 280,140 325,168 370,164"/></svg><div className="month-row">{months.map(month => <span key={month}>{month}</span>)}</div></div><div className="sd-legend centered"><span><i className="year24" />2024</span><span><i className="year25" />2025</span></div></article> }
function Reps() { return <article className="sd-card sd-list-card"><div className="sd-card-top"><h3>Top sales reps against individual target</h3><More /></div><div className="rep"><i className="avatar a1">DS</i><span>Daniela Shannon</span><b>119%</b></div><div className="rep"><i className="avatar a2">CM</i><span>Carmela McSmith</span><b>107%</b></div></article> }
function Behind() { return <article className="sd-card sd-list-card"><div className="sd-card-top"><h3>Sales falling behind - Act now</h3><More /></div>{[['16/9/2025','336K EUR'],['28/9/2025','221K EUR']].map(([date,value]) => <div className="behind" key={date}><i><CircleDollarSign size={15}/></i><span><b>{date}</b><small>Closing target</small></span><strong>{value}</strong></div>)}</article> }
function Pipeline() { return <article className="sd-card sd-pipeline"><div className="sd-card-top"><h3>Number of open sales in pipeline this month</h3><More /></div><div className="pipeline-chart">{[4,2,5,3,4].map((n,i)=><div key={i}><b>{n}</b><i style={{height:`${n * 18}px`}} /></div>)}</div></article> }

export default function SalesAnalyticsDashboard() {
  const [expanded, setExpanded] = useState(false); const [mobileOpen, setMobileOpen] = useState(false); const [activeTab, setActiveTab] = useState('Sales');
  useEffect(() => { const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileOpen(false); }; window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown); }, []);
  const toggle = () => { if (window.innerWidth < 640) setMobileOpen(value => !value); else setExpanded(value => !value); };
  return <main className={`sales-dashboard ${expanded ? 'sidebar-expanded' : ''}`}><NavRail expanded={expanded} mobileOpen={mobileOpen} onToggle={toggle} onNavigate={() => setMobileOpen(false)} />
    <section className="sd-shell"><header className="sd-header"><div className="sd-header-left"><button className="sd-mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={18}/></button><button className="sd-new">⌂ <b>New</b><ChevronDown size={13}/></button><button className="sd-quick"><LayoutDashboard size={13}/></button></div><label className="sd-search"><Search size={13}/><input aria-label="Freetext search" placeholder="Freetext search" /></label><div className="sd-tools"><Bell size={17}/><Users size={17}/><Menu size={17}/><span>Help</span></div></header>
      <div className="sd-tabs" role="tablist" aria-label="Dashboard sections">{['Sales', 'Marketing ↗', 'Service ⌁', 'Status ⌁', 'My Sales KPIs'].map(tab => <button key={tab} role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tab === 'Sales' ? <>Sales <span>★</span> <span>★</span></> : tab}</button>)}<div><button className="sd-edit" aria-label="Edit dashboard">✎</button><button className="sd-more-outline" aria-label="More dashboard options"><MoreVertical size={16}/></button></div></div>
      <div className="sd-content"><h1>Key sales figures for the Sales team <Star size={16} fill="#f47431" strokeWidth={0} /><span>⟳</span></h1><section className="sd-grid sd-top"><Metric title="Sold MTD" value="0 EUR"/><Metric title="Open sales this month" value="185K EUR"/><Metric title="My forecast next month" value="2M EUR" kind="forecast"/></section><section className="sd-grid sd-middle"><WeightedChart/><DonutChart/><AreaChart/></section><section className="sd-grid sd-bottom"><Reps/><Behind/><Pipeline/></section></div>
    </section></main>;
}
