interface TabDef {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: TabDef[];
  activeId: string;
  onChange: (id: string) => void;
}

/** Hairline tab strip used for the top-level SETUP / MATCH switch. */
export function Tabs({ tabs, activeId, onChange }: TabsProps) {
  return (
    <div className="sp-tabs" role="tablist" aria-label="Sections">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === activeId}
          className="sp-tab"
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
