import {
  CirclesIcon,
  CameraIcon,
  HistoryIcon,
  BookmarkIcon,
  UserIcon,
} from "./icons";

const tabs = [
  { key: "circles", label: "Circles", Icon: CirclesIcon, match: ["circles", "circle"] },
  { key: "history", label: "History", Icon: HistoryIcon, match: ["history"] },
  { key: "saved", label: "Saved", Icon: BookmarkIcon, match: ["saved"] },
  { key: "profile", label: "You", Icon: UserIcon, match: ["profile"] },
];

export default function BottomNav({ currentView, onNavigate, onSnap }) {
  const renderTab = (tab) => {
    const isActive = tab.match.includes(currentView);
    const { Icon } = tab;
    return (
      <button
        key={tab.key}
        type="button"
        className={`nav-item ${isActive ? "is-active" : ""}`}
        aria-current={isActive ? "page" : undefined}
        onClick={() => onNavigate(tab.key)}
      >
        <Icon size={24} strokeWidth={isActive ? 2.4 : 2} />
        <span className="nav-item__label">{tab.label}</span>
      </button>
    );
  };

  return (
    <nav className="bottom-nav" aria-label="Primary">
      <div className="bottom-nav__inner">
        {renderTab(tabs[0])}
        {renderTab(tabs[1])}
        <button type="button" className="nav-snap" aria-label="Snap ingredients" onClick={onSnap}>
          <span className="nav-snap__ring" />
          <CameraIcon size={26} strokeWidth={2.4} />
        </button>
        {renderTab(tabs[2])}
        {renderTab(tabs[3])}
      </div>
    </nav>
  );
}
