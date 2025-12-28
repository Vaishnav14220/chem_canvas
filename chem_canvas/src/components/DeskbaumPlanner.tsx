import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bot,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  Github,
  Hand,
  LayoutGrid,
  Mail,
  Settings2,
  StretchHorizontal,
  StretchVertical,
  Target,
  Type,
  X
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import './deskbaumPlanner.css';

type WidgetOption = {
  id: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
};

type PlannerWidget = {
  id: string;
  type: string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
};

const sizeOptions: WidgetOption[] = [
  { id: 'single', label: 'Single', icon: LayoutGrid },
  { id: 'full-width', label: 'Full Width', icon: StretchHorizontal },
  { id: 'full-height', label: 'Full Height', icon: StretchVertical }
];

const widgetOptions: WidgetOption[] = [
  { id: 'greeting', label: 'Greeting', icon: Hand },
  { id: 'focus', label: "Today's Focus", icon: Target },
  { id: 'date-time', label: 'Date & Time', icon: CalendarClock },
  { id: 'custom-text', label: 'Custom Text', icon: Type },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, disabled: true },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare, disabled: true },
  { id: 'github', label: 'GitHub', icon: Github, disabled: true },
  { id: 'gmail', label: 'Gmail', icon: Mail, disabled: true }
];

const widgetCopy: Record<string, { title: string; subtitle: string }> = {
  greeting: { title: 'Greeting', subtitle: 'Welcome back, Avi' },
  focus: { title: "Today’s Focus", subtitle: 'Define your top objective' },
  'date-time': { title: 'Date & Time', subtitle: 'Stay in sync' },
  'custom-text': { title: 'Custom Text', subtitle: 'Add a note or quote' },
  calendar: { title: 'Calendar', subtitle: 'Connect your schedule' },
  tasks: { title: 'Tasks', subtitle: 'Track next steps' },
  github: { title: 'GitHub', subtitle: 'Sync repo activity' },
  gmail: { title: 'Gmail', subtitle: 'New messages at a glance' }
};

const gridRows = 4;

const sizeSpanMap: Record<string, { colSpan: number; rowSpan: number }> = {
  single: { colSpan: 1, rowSpan: 1 },
  'full-width': { colSpan: 2, rowSpan: 1 },
  'full-height': { colSpan: 1, rowSpan: 2 }
};

const getGridColumns = (width: number) => {
  if (width <= 520) return 3;
  if (width <= 720) return 4;
  return 6;
};

const DeskbaumPlanner: React.FC = () => {
  const [selectedSize, setSelectedSize] = useState('single');
  const [selectedWidget, setSelectedWidget] = useState('greeting');
  const [showWidgetPanel, setShowWidgetPanel] = useState(true);
  const [widgets, setWidgets] = useState<PlannerWidget[]>([]);
  const [gridColumns, setGridColumns] = useState(6);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const getNextPlacement = useCallback(
    (col: number, row: number, colSpan: number, rowSpan: number) => {
      const safeCol = Math.min(col, gridColumns - colSpan + 1);
      const safeRow = Math.min(row, gridRows - rowSpan + 1);
      return { col: Math.max(1, safeCol), row: Math.max(1, safeRow) };
    },
    [gridColumns]
  );

  const handleBoardClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target.closest('.deskbaum-planner__card') || target.closest('.deskbaum-planner__widget')) {
        return;
      }

      const gridElement = gridRef.current;
      if (!gridElement) return;
      const rect = gridElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

      const columns = getGridColumns(rect.width);
      setGridColumns(columns);
      const col = Math.floor((x / rect.width) * columns) + 1;
      const row = Math.floor((y / rect.height) * gridRows) + 1;
      const span = sizeSpanMap[selectedSize] ?? sizeSpanMap.single;
      const placement = getNextPlacement(col, row, span.colSpan, span.rowSpan);

      setWidgets(prev => [
        {
          id: `widget-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          type: selectedWidget,
          col: placement.col,
          row: placement.row,
          colSpan: span.colSpan,
          rowSpan: span.rowSpan
        },
        ...prev
      ]);
    },
    [getNextPlacement, selectedSize, selectedWidget]
  );

  const handleRemoveWidget = useCallback((id: string) => {
    setWidgets(prev => prev.filter(widget => widget.id !== id));
  }, []);

  useEffect(() => {
    const updateColumns = () => {
      const width = gridRef.current?.getBoundingClientRect().width ?? window.innerWidth;
      setGridColumns(getGridColumns(width));
    };
    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  return (
    <div className="deskbaum-planner">
      <div className="deskbaum-planner__frame">
        <div className="deskbaum-planner__topbar">
          <div className="deskbaum-planner__brand">
            <Bot aria-hidden="true" />
            Deskbaum
          </div>
        </div>

        <div className="deskbaum-planner__board" onClick={handleBoardClick}>
          <div className="deskbaum-planner__board-grid" aria-hidden="true" />
          <div className="deskbaum-planner__greeting">Good morning, Avi</div>
          <div
            className="deskbaum-planner__widgets"
            ref={gridRef}
            style={{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }}
          >
            {widgets.map(widget => {
              const meta = widgetCopy[widget.type] ?? widgetCopy.greeting;
              return (
                <div
                  key={widget.id}
                  className="deskbaum-planner__widget"
                  style={{
                    gridColumn: `${widget.col} / span ${widget.colSpan}`,
                    gridRow: `${widget.row} / span ${widget.rowSpan}`
                  }}
                >
                  <div className="deskbaum-planner__widget-header">
                    <div className="deskbaum-planner__widget-title">{meta.title}</div>
                    <button
                      type="button"
                      className="deskbaum-planner__widget-close"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleRemoveWidget(widget.id);
                      }}
                      aria-label="Remove widget"
                    >
                      <X />
                    </button>
                  </div>
                  <div className="deskbaum-planner__widget-meta">{meta.subtitle}</div>
                </div>
              );
            })}
          </div>

          {showWidgetPanel ? (
            <div
              className="deskbaum-planner__card"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="deskbaum-planner__card-header">
                <h3>Add Widget</h3>
                <button
                  type="button"
                  className="deskbaum-planner__close"
                  onClick={() => setShowWidgetPanel(false)}
                  aria-label="Close widget panel"
                >
                  <X />
                </button>
              </div>

              <div className="deskbaum-planner__section">
                <div className="deskbaum-planner__section-title">Widget Size</div>
                <div className="deskbaum-planner__options deskbaum-planner__options--sizes">
                  {sizeOptions.map(option => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSelectedSize(option.id)}
                        className={`deskbaum-planner__option ${selectedSize === option.id ? 'is-selected' : ''}`}
                        aria-pressed={selectedSize === option.id}
                      >
                        <span className="deskbaum-planner__option-icon">
                          <Icon aria-hidden="true" />
                        </span>
                        <span className="deskbaum-planner__option-label">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="deskbaum-planner__section">
                <div className="deskbaum-planner__section-title">Widget Type</div>
                <div className="deskbaum-planner__options deskbaum-planner__options--types">
                  {widgetOptions.map(option => {
                    const Icon = option.icon;
                    const isSelected = selectedWidget === option.id;
                    const isDisabled = Boolean(option.disabled);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          if (isDisabled) return;
                          setSelectedWidget(option.id);
                        }}
                        className={`deskbaum-planner__option ${isSelected ? 'is-selected' : ''} ${isDisabled ? 'is-disabled' : ''}`}
                        aria-pressed={isSelected}
                      >
                        <span className="deskbaum-planner__option-icon">
                          <Icon aria-hidden="true" />
                        </span>
                        <span className="deskbaum-planner__option-label">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowWidgetPanel(true)}
              className="deskbaum-planner__open"
            >
              Add Widget
            </button>
          )}

          <div className="deskbaum-planner__hint">Click any cell to add or edit a widget</div>
        </div>

        <div className="deskbaum-planner__footer">
          <div className="deskbaum-planner__theme">
            <div className="deskbaum-planner__chip">
              <span className="deskbaum-planner__chip-swatch" aria-hidden="true" />
              <div>
                <div className="deskbaum-planner__chip-title">Gradient</div>
                <div className="deskbaum-planner__chip-sub">Built-in</div>
              </div>
            </div>
            <button type="button" className="deskbaum-planner__ghost">
              Change...
            </button>
          </div>
          <div className="deskbaum-planner__actions">
            <button type="button" className="deskbaum-planner__ghost">
              <Settings2 aria-hidden="true" />
              Settings
            </button>
            <button type="button" className="deskbaum-planner__primary">
              Apply to Desktop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeskbaumPlanner;
