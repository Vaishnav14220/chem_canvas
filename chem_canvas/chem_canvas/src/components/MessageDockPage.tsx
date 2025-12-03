import React from 'react';
import { MessageSquare, Sparkles, Smartphone, Shield, Zap, Gauge } from 'lucide-react';
import { MessageDock, type Character } from './ui/message-dock';

type TableRow = {
  prop: string;
  type: string;
  defaultValue?: string;
  description: string;
};

const featureBullets = [
  'Free open source React component built for Next.js applications with interactive messaging functionality',
  'Character-based messaging system featuring customizable avatars, emojis, and real-time status indicators',
  'TypeScript-first development with comprehensive type definitions and IntelliSense support',
  'Advanced Framer Motion animations with spring physics, stagger effects, and smooth expand/collapse transitions',
  'Tailwind CSS integration for seamless styling, gradient backgrounds, and responsive design patterns',
  'shadcn/ui compatibility following modern component architecture and design system conventions',
  'Dynamic theme support with light, dark, and auto modes featuring customizable gradient color schemes',
  'Complete keyboard navigation with Enter to send, Escape to close, and full accessibility compliance',
  'Intelligent interaction patterns including click outside to close and configurable auto-focus behavior',
  'Responsive adaptive design that works beautifully across all device sizes and orientations',
  'Performance optimized with reduced motion support, hardware acceleration, and efficient rendering',
  'Customizable configuration with extensive props for behavior, appearance, and animation control',
];

const useCases = [
  'Next.js chat applications',
  'Customer support platforms',
  'Gaming interfaces',
  'Creative portfolios',
  'SaaS applications',
  'Educational platforms',
  'Social applications',
];

const messageDockProps: TableRow[] = [
  { prop: 'characters', type: 'Character[]', defaultValue: 'defaultCharacters', description: 'Array of character objects' },
  { prop: 'onMessageSend', type: '(message, character, index) => void', description: 'Callback when message is sent' },
  { prop: 'onCharacterSelect', type: '(character, index) => void', description: 'Callback when character is selected' },
  { prop: 'onDockToggle', type: '(isExpanded) => void', description: 'Callback when dock expands/collapses' },
  { prop: 'className', type: 'string', description: 'Additional CSS classes' },
  { prop: 'expandedWidth', type: 'number', defaultValue: '448', description: 'Width when expanded (px)' },
  { prop: 'position', type: '"bottom" | "top"', defaultValue: '"bottom"', description: 'Dock position on screen' },
  { prop: 'showSparkleButton', type: 'boolean', defaultValue: 'true', description: 'Show sparkle button on left' },
  { prop: 'showMenuButton', type: 'boolean', defaultValue: 'true', description: 'Show menu/send button on right' },
  { prop: 'enableAnimations', type: 'boolean', defaultValue: 'true', description: 'Enable/disable animations' },
  { prop: 'animationDuration', type: 'number', defaultValue: '1', description: 'Animation duration multiplier' },
  { prop: 'placeholder', type: '(name) => string', defaultValue: '"Message {name}..."', description: 'Input placeholder function' },
  { prop: 'theme', type: '"light" | "dark" | "auto"', defaultValue: '"light"', description: 'Color theme' },
  { prop: 'autoFocus', type: 'boolean', defaultValue: 'true', description: 'Auto-focus input when expanded' },
  { prop: 'closeOnClickOutside', type: 'boolean', defaultValue: 'true', description: 'Close dock when clicking outside' },
  { prop: 'closeOnEscape', type: 'boolean', defaultValue: 'true', description: 'Close dock on Escape key' },
  { prop: 'closeOnSend', type: 'boolean', defaultValue: 'true', description: 'Close dock after sending message' },
];

const characterProps: TableRow[] = [
  { prop: 'id', type: 'string | number', description: 'Optional unique identifier' },
  { prop: 'emoji', type: 'string', description: 'Character emoji/icon' },
  { prop: 'name', type: 'string', description: 'Character display name' },
  { prop: 'online', type: 'boolean', description: 'Online status (shows green dot)' },
  { prop: 'backgroundColor', type: 'string', description: 'Tailwind background class' },
  { prop: 'gradientColors', type: 'string', description: 'CSS gradient colors for expanded state' },
  { prop: 'avatar', type: 'string', description: 'Optional image URL (future feature)' },
];

const MessageDockPage: React.FC = () => {
  const characters: Character[] = [
    { emoji: '✨', name: 'Sparkle', online: false, backgroundColor: 'bg-amber-200', gradientColors: '#fde68a, #fffbeb' },
    { emoji: '🧙‍♂️', name: 'Wizard', online: true, backgroundColor: 'bg-emerald-200 dark:bg-emerald-300', gradientColors: '#a7f3d0, #ecfdf5' },
    { emoji: '🦄', name: 'Unicorn', online: true, backgroundColor: 'bg-violet-200 dark:bg-violet-300', gradientColors: '#c4b5fd, #f5f3ff' },
    { emoji: '🐵', name: 'Monkey', online: true, backgroundColor: 'bg-amber-200 dark:bg-amber-300', gradientColors: '#fde68a, #fffbeb' },
    { emoji: '🤖', name: 'Robot', online: false, backgroundColor: 'bg-rose-200 dark:bg-rose-300', gradientColors: '#fecaca, #fef2f2' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-slate-950/20 text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 shadow-sm">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-semibold tracking-tight text-white">Message Dock</span>
              <span className="text-xs text-muted-foreground/80 font-medium">Always-on messaging control for every page</span>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-500">
              <Sparkles className="h-4 w-4" /> Framer Motion physics
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-500">
              <Smartphone className="h-4 w-4" /> Responsive bottom dock
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 space-y-10">
        {/* Hero */}
        <section className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3 max-w-3xl">
              <h1 className="text-4xl font-bold tracking-tight">Interactive Message Dock</h1>
              <p className="text-lg text-muted-foreground">
                Interactive messaging interface with character avatars and smooth expanding animations. A free open source React component for Next.js featuring TypeScript integration and Framer Motion physics.
              </p>
              <div className="flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-semibold">
                  <Shield className="h-4 w-4" /> Accessible keyboard navigation
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-semibold">
                  <Zap className="h-4 w-4" /> Spring physics animations
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-semibold">
                  <Gauge className="h-4 w-4" /> Performance optimized
                </span>
              </div>
            </div>
            <div className="rounded-2xl border bg-card px-4 py-4 shadow-sm">
              <div className="text-sm font-semibold mb-2">Quick Stats</div>
              <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                <div>
                  <div className="text-2xl font-bold text-foreground">TypeScript</div>
                  <p>Full typings & IntelliSense</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">Next.js</div>
                  <p>Drop-in ready component</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">Framer</div>
                  <p>Stagger, springs, presence</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">Tailwind</div>
                  <p>Gradient-first styling</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-card/70 px-6 py-5 shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Live at the bottom of every page</p>
                <p className="text-sm text-muted-foreground">
                  The dock below is fixed to the viewport, so it stays visible as you explore this page.
                </p>
              </div>
              <a
                href="https://www.framer.com/motion/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-blue-200/60 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:shadow-sm dark:border-blue-900/60 dark:bg-blue-900/20 dark:text-blue-200"
              >
                <Sparkles className="h-4 w-4" />
                Powered by Framer Motion
              </a>
            </div>
          </div>
        </section>

        {/* Installation */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-500" />
            <h2 className="text-2xl font-bold">Installation</h2>
          </div>
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <pre className="text-sm overflow-x-auto">
              <code>npm install message-dock</code>
            </pre>
          </div>
        </section>

        {/* Features */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <h2 className="text-2xl font-bold">Features</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {featureBullets.map((feature) => (
              <div key={feature} className="flex items-start gap-3 rounded-xl border bg-card/70 p-3 shadow-sm">
                <div className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                <p className="text-sm text-foreground">{feature}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Usage */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-purple-500" />
            <h2 className="text-2xl font-bold">Usage</h2>
          </div>
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <pre className="text-sm overflow-x-auto whitespace-pre-wrap">
{`import { MessageDock, type Character } from '@/components/ui/message-dock';

const characters: Character[] = [
  { emoji: "✨", name: "Sparkle", online: false },
  {
    emoji: "🧙‍♂️",
    name: "Wizard",
    online: true,
    backgroundColor: "bg-green-300",
    gradientColors: "#86efac, #dcfce7",
  },
  // ... more characters
];

<MessageDock
  characters={characters}
  onMessageSend={(message, character, index) => {
    console.log('Message:', message, 'to', character.name);
  }}
  onCharacterSelect={(character) => {
    console.log('Selected:', character.name);
  }}
  expandedWidth={500}
  placeholder={(name) => \`Send a message to \${name}...\`}
  theme="light"
/>`}
            </pre>
          </div>
        </section>

        {/* Props */}
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-500" />
            <h2 className="text-2xl font-bold">Props</h2>
          </div>

          <div className="space-y-3">
            <h3 className="text-xl font-semibold">MessageDock</h3>
            <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-muted/60 text-left">
                    <th className="border border-border p-3 font-semibold">Prop</th>
                    <th className="border border-border p-3 font-semibold">Type</th>
                    <th className="border border-border p-3 font-semibold">Default</th>
                    <th className="border border-border p-3 font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {messageDockProps.map((row, index) => (
                    <tr key={row.prop} className={index % 2 === 0 ? 'bg-background/80' : 'bg-muted/40'}>
                      <td className="border border-border p-3 font-mono">{row.prop}</td>
                      <td className="border border-border p-3 font-mono">{row.type}</td>
                      <td className="border border-border p-3 font-mono">{row.defaultValue ?? '-'}</td>
                      <td className="border border-border p-3">{row.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xl font-semibold">Character Interface</h3>
            <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-muted/60 text-left">
                    <th className="border border-border p-3 font-semibold">Property</th>
                    <th className="border border-border p-3 font-semibold">Type</th>
                    <th className="border border-border p-3 font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {characterProps.map((row, index) => (
                    <tr key={row.prop} className={index % 2 === 0 ? 'bg-background/80' : 'bg-muted/40'}>
                      <td className="border border-border p-3 font-mono">{row.prop}</td>
                      <td className="border border-border p-3 font-mono">{row.type}</td>
                      <td className="border border-border p-3">{row.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-blue-500" />
            <h2 className="text-2xl font-bold">Use Cases</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {useCases.map((useCase) => (
              <div key={useCase} className="rounded-xl border bg-card/70 p-4 shadow-sm">
                <p className="text-sm font-semibold text-foreground">{useCase}</p>
                <p className="text-xs text-muted-foreground mt-1">Pair avatars, gradients, and physics to fit the experience.</p>
              </div>
            ))}
          </div>
        </section>

        {/* Technical Details */}
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            <h2 className="text-2xl font-bold">Technical Details</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border bg-card/70 p-4 shadow-sm space-y-2">
              <h3 className="text-lg font-semibold">Advanced Animation System</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Spring physics calculations with configurable stiffness, damping, and mass.</li>
                <li>Stagger effect sequencing for polished character reveals.</li>
                <li>Smooth gradient morphing for dynamic expanded states.</li>
                <li>Reduced motion compliance honors user preferences automatically.</li>
              </ul>
            </div>
            <div className="rounded-xl border bg-card/70 p-4 shadow-sm space-y-2">
              <h3 className="text-lg font-semibold">Performance Optimizations</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Hardware-accelerated transforms for 60fps motion.</li>
                <li>Efficient DOM measurements and minimal recalculations.</li>
                <li>TypeScript-optimized structure with strong prop validation.</li>
                <li>Smart re-rendering with refs and AnimatePresence.</li>
              </ul>
            </div>
            <div className="rounded-xl border bg-card/70 p-4 shadow-sm space-y-2">
              <h3 className="text-lg font-semibold">Interactive Features</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Dynamic width calculations with automatic collapsed/expanded states.</li>
                <li>Real-time status indicators with online/offline states.</li>
                <li>Keyboard bindings for Enter to send and Escape to close.</li>
                <li>Click outside detection with configurable cleanup.</li>
              </ul>
            </div>
            <div className="rounded-xl border bg-card/70 p-4 shadow-sm space-y-2">
              <h3 className="text-lg font-semibold">Accessibility</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Complete ARIA-minded markup with labels and roles.</li>
                <li>Tab order and focus indicators for keyboard users.</li>
                <li>High contrast compatibility and gradient theming.</li>
                <li>Screen reader friendly copy and reduced motion support.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Animation Features */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-pink-500" />
            <h2 className="text-2xl font-bold">Animation Features</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border bg-card/70 p-4 shadow-sm">
              <p className="text-sm font-semibold text-foreground">Reduced Motion Support</p>
              <p className="text-sm text-muted-foreground mt-1">Respects user preferences without losing clarity.</p>
            </div>
            <div className="rounded-xl border bg-card/70 p-4 shadow-sm">
              <p className="text-sm font-semibold text-foreground">Spring Physics</p>
              <p className="text-sm text-muted-foreground mt-1">Natural feel with tuned stiffness and damping.</p>
            </div>
            <div className="rounded-xl border bg-card/70 p-4 shadow-sm">
              <p className="text-sm font-semibold text-foreground">Stagger Effects</p>
              <p className="text-sm text-muted-foreground mt-1">Characters animate in sequence for focus.</p>
            </div>
            <div className="rounded-xl border bg-card/70 p-4 shadow-sm">
              <p className="text-sm font-semibold text-foreground">Smooth Transitions</p>
              <p className="text-sm text-muted-foreground mt-1">Expand/collapse with gradient morphing and hardware acceleration.</p>
            </div>
          </div>
        </section>
      </main>

      {/* Dock Preview - sticks to bottom of the viewport */}
      <MessageDock
        characters={characters}
        onMessageSend={(message, character) => {
          console.log('Message:', message, 'to', character.name);
        }}
        onCharacterSelect={(character) => {
          console.log('Selected:', character.name);
        }}
        expandedWidth={500}
        placeholder={(name) => `Send a message to ${name}...`}
        theme="light"
      />
    </div>
  );
};

export default MessageDockPage;
