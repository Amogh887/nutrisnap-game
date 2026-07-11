# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** NutriSnap Game
**Generated:** 2026-07-11 (manually overridden after user rejected the auto-generated rose/gaming-font direction)
**Category:** Social Media App — Instagram-style light neutral + gradient accent

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Background | `#FAFAFA` | `--color-background` |
| Surface (cards) | `#FFFFFF` | `--color-surface` |
| Border (hairline) | `#EBEBEB` | `--color-border` |
| Text | `#16161A` | `--color-text` |
| Text muted | `#6B6B70` | `--color-text-muted` |
| Accent gradient stop 1 | `#F58529` | `--gradient-1` |
| Accent gradient stop 2 | `#DD2A7B` | `--gradient-2` |
| Accent gradient stop 3 | `#8134AF` | `--gradient-3` |

**Color Notes:** Everyday chrome is near-monochrome (white/off-white surfaces, near-black text). The orange→pink→purple gradient is reserved for moments of achievement/action only: the camera FAB, streak flame, rank #1 badge, win/celebration states, and the primary CTA. It must never be used as a full-page or full-card background — sparing use is what makes it read as premium rather than loud. Solid single-color fallbacks (e.g. `#DD2A7B`) may be used for small elements like icons where a gradient would be visually noisy.

### Typography

- **Heading Font:** Inter (700/800)
- **Body Font:** Inter (400/500/600)
- **Mood:** clean, modern, native-app, legible at small sizes — same grotesque-sans register as Instagram/BeReal/Strava's own UI type, close enough to Roboto to feel native on Android
- **Google Fonts:** https://fonts.google.com/share?selection.family=Inter:wght@400;500;600;700;800

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
```

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button — gradient reserved for the single most important action on screen */
.btn-primary {
  background: linear-gradient(135deg, #F58529, #DD2A7B, #8134AF);
  color: white;
  padding: 12px 24px;
  border-radius: 12px;
  font-weight: 600;
  transition: transform 150ms ease, opacity 150ms ease;
  cursor: pointer;
}

.btn-primary:active {
  transform: scale(0.97);
  opacity: 0.92;
}

/* Secondary Button — flat, near-monochrome */
.btn-secondary {
  background: transparent;
  color: #16161A;
  border: 1.5px solid #EBEBEB;
  padding: 12px 24px;
  border-radius: 12px;
  font-weight: 600;
  transition: background 150ms ease;
  cursor: pointer;
}

.btn-secondary:hover {
  background: #F5F5F5;
}
```

### Cards

```css
.card {
  background: #FFFFFF;
  border: 1px solid #EBEBEB;
  border-radius: 14px;
  padding: 16px;
  box-shadow: var(--shadow-sm);
  transition: box-shadow 150ms ease;
  cursor: pointer;
}

.card:active {
  box-shadow: none;
  background: #FAFAFA;
}
```

No double/inset shadows, no thick 3-4px borders, no bounce easing — this is a flat, hairline-bordered, single-subtle-shadow system. Elevation communicates via one soft shadow level, not decoration.

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #EBEBEB;
  border-radius: 10px;
  font-size: 16px;
  background: #FAFAFA;
  transition: border-color 150ms ease;
}

.input:focus {
  border-color: #8134AF;
  outline: none;
  box-shadow: 0 0 0 3px rgba(129, 52, 175, 0.12);
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 20px;
  padding: 24px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Social-media-native flat UI (Instagram/BeReal/Strava register)

**Keywords:** Camera-first, photo-is-the-hero, near-monochrome chrome, gradient reserved for achievement moments, hairline borders, single soft shadow, native mobile app feel (not "web page in a browser")

**Best For:** Camera/photo-driven social apps, competitive/leaderboard apps, Android-first mobile web apps

**Key Effects:** Subtle 150ms transitions (never bouncy), press states via opacity/scale(0.97) not translateY, bottom tab bar with an elevated gradient-filled camera FAB as the visual anchor, full-bleed photos with minimal chrome around them

### App Flow Pattern (not a landing page — this is a logged-in mobile app)

- **Cold start (unauthenticated):** Auth screen — Google sign-in primary, email fallback, camera-app-adjacent visual (large logo, minimal copy, one CTA)
- **First login only (has_onboarded === false):** Name confirm (pre-filled from Google displayName, editable) → Preferences survey (existing component) → mark has_onboarded, proceed
- **Returning / post-onboarding:** Land directly on Circles/Leaderboard (not the scan screen) — bottom tab bar visible: Leaderboard/Circles, History, gradient camera FAB (Snap) elevated center, Profile
- **Camera FAB:** primary way to start a scan/submission from anywhere in the app, not just a "home" screen

---

## Anti-Patterns (Do NOT Use)

- ❌ Heavy skeuomorphism
- ❌ Accessibility ignored

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
