export default function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex border-b border-border mb-5">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-all duration-150 cursor-pointer ${
            active === tab.key
              ? "text-accent border-accent"
              : "text-muted border-transparent hover:text-text"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
