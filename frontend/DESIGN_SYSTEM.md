# Intro Finder visual system

The existing React screens use shared CSS through their current class names.
Global tokens live in `src/index.css`, reusable styles in
`src/styles/design-system.css`, and page composition in `src/App.css`.
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
for action text, and `--color-analytics` for readable data labels. The existing
light theme adjusts surfaces and foregrounds for contrast while retaining gold
buttons. Dark is the CSS fallback; the app still respects the user's stored or
system theme preference. Color tokens also expose Tailwind utilities.

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
