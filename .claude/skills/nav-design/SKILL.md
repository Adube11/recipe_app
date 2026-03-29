---
name: nav-design
description: Navigation design principles for the recipe app. Apply when designing, evaluating, or building any navigation structure — tab bars, top nav, sidebars, routing. Ensures Apple-quality navigation with minimal taps and no clutter.
user-invocable: false
---

# Navigation Design — Recipe App

Apply these principles whenever a navigation structure is being proposed, reviewed, or built. The reference point is Apple's Human Interface Guidelines: navigation should feel effortless, invisible, and never make the user think about where they are or how to get somewhere.

---

## The Core Principle

**Navigation should never be the thing the user is thinking about.** They are thinking about the recipe. The nav gets them there, then disappears into the background. Any nav element that draws attention to itself is a failure.

---

## Apple Navigation Model — What to Emulate

- **Clarity over completeness**: Show only what the user needs right now. If something isn't relevant to the current context, hide it.
- **One primary action per screen**: Each screen has one obvious next step. Nav supports it; it doesn't compete with it.
- **Consistent placement**: Navigation elements live in the same place on every screen. Users build muscle memory — respect it.
- **No cognitive overhead**: The user should never need to decide which nav path to take. The right path is obvious.
- **Depth signals are physical**: On mobile, "going deeper" feels like moving forward (push). Going back feels like returning. Nav structure should match this mental model.

---

## Click Budget

Every navigation decision should be judged against one question: **how many taps to reach the goal?**

- A user who knows what they want should reach it in the fewest possible taps.
- A tap that doesn't advance the user toward content is a tap that should be removed.
- Never add a navigation layer that exists only for structural reasons — every layer must earn its place by reducing confusion or increasing speed.

---

## Navigation Patterns — When to Use Each

### Tab Bar / Bottom Nav (mobile)
- **Use when**: A small set of peer destinations — all roughly equal in importance, all accessed frequently
- **Avoid**: Tabs that contain only one item, or tabs used as a workaround for a missing feature
- **Apple rule**: If you can't label it clearly in 1–2 words, it probably shouldn't be a tab

### Top Navigation (web)
- **Use when**: Web layout with horizontal space; destinations are peer-level
- **Avoid**: Hamburger menus when the screen has room for a persistent nav — hiding nav behind a tap is always a last resort
- **Apple rule**: Navigation should be immediately visible, not discovered

### Sidebar (web)
- **Use when**: The current section needs to stay visible as the user drills into content (e.g., browsing recipes within a category)
- **Avoid**: Collapsible sidebars on small screens — they collapse into the same problem as a hamburger

### Hamburger / Drawer
- **Use when**: Screen is too small for persistent nav AND there are too many destinations for a tab bar
- **Default stance**: This is a fallback, not a default. Only use it when there is no better option.

---

## Structural Rules

1. **Flat over deep**: Every level of depth costs a tap and requires the user to build a mental model. Keep the hierarchy as shallow as possible for the content size.

2. **Persistent nav**: The navigation is always reachable. Users should never get stranded with no visible way to move.

3. **Location is always visible**: The user always knows where they are. Active state on tabs, highlighted items in lists, breadcrumbs on deep pages — pick the right signal for the pattern, but never omit it.

4. **No dead ends**: Every screen has an obvious forward path and an obvious back path. A recipe detail always surfaces its category context.

5. **Search accelerates, doesn't replace**: If search is added, it is a shortcut for power users — not a substitute for browsable navigation that works for everyone.

---

## Anti-Patterns to Always Flag

- **Splash or home screen that adds a tap**: A screen that exists only to say "welcome" before letting the user do anything is a wasted tap and a broken first impression.
- **Categories buried inside a menu item**: If the user has to open a menu to find the top-level categories, the nav is too deep.
- **Labels that require explanation**: If a tab or nav item needs a tooltip, rename it.
- **Inconsistent back behavior**: Back should always behave the same way. Mixing hardware back, swipe-back, and custom back buttons creates confusion.
- **Navigation that changes between screens**: Moving the nav element around between screens breaks muscle memory.

---

## Output Format for Navigation Reviews

```
Navigation: [name/description]
Verdict: [APPROVE / ADJUST / REJECT]

Taps to reach content: [N from cold start]
Apple HIG alignment: [strong / partial / poor] — [one sentence why]

Issues (if any):
- [issue]: [why it matters for the user experience]

Recommended change (if adjusting):
- [specific change] → [what it fixes]

Minimum viable version:
- [the simplest nav structure that meets the tap budget and stays clean]
```
