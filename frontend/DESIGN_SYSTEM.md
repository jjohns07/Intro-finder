# Intro Finder visual system

The existing React screens use shared CSS through their current class names.
Global tokens live in `src/index.css` and reusable styles in
`src/styles/design-system.css`. Auth and presentation-dashboard composition live
in `src/styles/auth.css` and `src/styles/dashboard.css`. The latest section and
data-visualisation refinements extend those styles in
`src/styles/dashboard-refinements.css`; shared legacy composition remains in
`src/App.css`.
The design system does not change routes, data, or authentication.

## Color roles

| Token | Dark value | Use |
| --- | --- | --- |
| `--color-surface` | `#101014` | Main background |
| `--color-surface-strong` | `#17171D` | Secondary background, input wells |
| `--color-surface-raised` | `#202027` | Cards and panels |
| `--color-surface-elevated` | `#25252D` | Elevated controls and dropdowns |
| `--color-text` | `#F5F5F5` | Primary text |
| `--color-text-soft` / `--color-text-muted` | `#A3A3AD` | Supporting text and metadata |
| `--color-gold` / `--color-primary` | `#E8B982` | Important actions |
| `--color-teal` / `--color-analytics` | `#55C5B7` | Analytics and connection visuals |

Use `--color-on-primary` for text on gold buttons, `--color-primary-strong`
for action text, and `--color-analytics` for readable data labels. The optional
light palette adjusts surfaces and foregrounds for contrast while retaining gold
buttons. Authentication and the presentation dashboard use the requested dark
palette consistently. Color tokens also expose Tailwind utilities.

## Typography and rhythm

Inter remains the font. Use `type-display`, `type-heading`, `type-section`,
`type-title`, `type-body`, `type-supporting`, `type-label`, `type-metadata`,
and `type-eyebrow` to express hierarchy. Choose semantic HTML headings separately.
Heading sizes scale with the viewport. Body text is 16px; metadata is 12px.

Spacing uses `--space-1` through `--space-24` on a 4px scale.
`--panel-padding` and `--section-gap` are fluid. Use `--radius-sm/md/lg/xl/pill`
and `--shadow-sm/panel/dropdown` instead of local values. Surfaces are opaque;
hover transitions use shared duration and easing tokens, with reduced-motion CSS.

## Shared class recipes

| Element | Classes |
| --- | --- |
| Primary action | `button button--primary` |
| Secondary / quiet / destructive action | `button button--secondary`, `button button--quiet`, `button button--danger` |
| Full-width action | Add `button--full` |
| Icon control | `icon-button`, with an accessible label |
| Form controls | `field`, `input`, `select`, `textarea`, `checkbox` |
| Surfaces | `card`, `panel`; add `card--elevated` or `panel--elevated` |
| Stacked sections | `panel-stack` |
| Navigation | `nav-item`, with `aria-current="page"` for the active destination |
| Data | `analytics-value`, `analytics-surface`, `icon--analytics` |
| Icons | `icon`; add `icon--small` or `icon--large` |
| Feedback | `notice`; add `notice--error` or `notice--success` |

Fields support visible focus, disabled, and `aria-invalid="true"` states.
Use native `disabled` on buttons. Styling `aria-disabled` alone does not disable
an action. Associate inputs with labels and error descriptions.

Dropdown styles are available without adding a menu to any current page:

```html
<details class="dropdown">
  <summary class="button button--secondary dropdown-trigger">Account</summary>
  <div class="dropdown-content">
    <a class="dropdown-item" href="/dashboard">Dashboard</a>
  </div>
</details>
```

Native details supplies disclosure behavior. Custom popovers must supply their
own open state, dismissal, focus handling, and appropriate semantics. Dropdown
surfaces are viewport-constrained and scrollable. Icon styles preserve SVG
stroke/fill choices and multicolor artwork.

## Presentation dashboard

The dashboard uses a lightweight header with profile and navigation disclosures,
followed by overview, company search, network activity, platform status, recent
searches, introduction opportunities, and a closing discovery action. Components
in `src/components/dashboard` share the existing tokens and use native SVG for
diagrams and charts. Headings, paragraphs, bars, lines, and feed entries use
distinct viewport-triggered animations. All respect reduced motion.

Overview metrics accept nullable values; unavailable data displays an em dash.
`AnimatedMetric` counts supplied numerical values once on entering the viewport,
while assistive technology receives the final number immediately.

The momentum chart accepts activity records, renders gaps for missing values,
and supports line and search-bar views, 30/90-day controls, pointer/touch/keyboard
tooltips, and a data table. When data is unavailable, it offers an explicitly
labeled example preview. Example values never populate the account overview.

Contracts in `src/components/dashboard/data.ts` distinguish unavailable data
(`null`) from known empty results (`[]`) and genuine zeroes. Network distribution,
platform connection counts, search metadata, and introduction panels render only
supplied records. Introduction steps are derived from a complete ordered path;
strength is shown only when supplied with a valid score and calculation
explanation. The fallback path diagram is explicitly an illustration.

The backend currently exposes authentication, with no dashboard/discovery data
endpoints. LinkedIn and X are unavailable integrations. Company search retains
its unavailable-service feedback; revisit and discovery actions focus the
existing search field. Authentication and JWT handling remain unchanged.
