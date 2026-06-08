# Record Shelf - Asset Integration Plan

Reference doc for using assets from `C:\Users\potte\source\repos\assets\` in Record Shelf.

All assets have commercial use rights.

---

## 1. Profile Badges (Replace Emoji Badges with Illustrated Icons)

**Current state:** Badges are text-only colored pills (e.g. "Explorer", "90s kid", "Vinyl purist"). No icons, just text + CSS background color.

**Location in app:** `src/routes/u/[username]/+page.svelte` lines 253-322, rendered at line 367-370.

**Badge types and proposed icon mappings:**

| Badge Style | Examples | Asset Pack | Suggested Icons |
|-------------|----------|------------|-----------------|
| `primary` (collector type) | Explorer, Devotee, Eclectic, Curator | RPG Class Badges | `Badge_hunter.PNG` (Explorer), `Badge_priest.PNG` (Devotee), `Badge_mage.png` (Eclectic), `Badge_paladin.PNG` (Curator) |
| `era` (decade) | Modern era, 90s kid, 70s purist, 60s head | Magic Badges | Pick 7 visually distinct badges for 7 era tiers |
| `size` (collection count) | Getting started, Growing, Serious, Hoarder | Trophy Icons | `TrophyIcons_01_t.png` through `_04_t.png` (4 tiers: bronze/silver/gold/platinum) |
| `format` (vinyl/CD/cassette) | Vinyl purist, CD collector, Tape head | Fantasy Badges | 4 distinct badges from the 35 available |
| `special` (genre/span/crate) | Rock specialist, Time traveler, Crate digger, Label explorer | Fantasy Badges or Magic Badges | Pick 4 more visually unique badges |

**Asset paths:**
- `assets/unzipped_assets/rpgclassbadges_windows/rpgclassbadges/Badge_png/` (9 class badges with PSD sources)
- `assets/unzipped_assets/magicbadges_windows/magicbadges/MagicBadges_png/` (10 badges, `01.PNG`-`10.png`)
- `assets/unzipped_assets/fantasybadges_windows/fantasybadges/` (35 badges, `Tex_badge_01.png`-`Tex_badge_35.PNG`)
- `assets/unzipped_assets/trophyicons/trophyicons/TrophyIcons_transparent/` (115 trophy icons, transparent BG)

**Implementation notes:**
- Copy selected PNGs into `static/badges/` at reduced size (48x48 or 64x64)
- Update Badge interface to include an `icon` field (path to PNG)
- Render `<img>` inside each `.badge` span alongside the label text
- Keep the text label for accessibility (`alt` text on image, or `aria-label`)
- Badge images should have transparent backgrounds (use `_t` variants from trophy pack)

---

## 2. Milestone Icons (Replace Number Icons)

**Current state:** Milestones show plain numbers in colored circles (e.g. "1", "50", "100"). The milestone targets are:

| Count | Label | Current Icon |
|-------|-------|-------------|
| 10 | First Ten | "1" |
| 50 | Fifty Club | "50" |
| 100 | Century | "100" |
| 250 | Quarter Grand | "250" |
| 500 | 500 Club | "500" |
| 750 | Three Quarters | "750" |
| 1000 | Grand Master | "1K" |
| 2500 | Elite | "2.5K" |

**Location in app:** `src/lib/components/Milestones.svelte`

**Proposed assets:**
- Trophy Icons (115 available, transparent backgrounds) — pick 8 that suggest progression
- Path: `assets/unzipped_assets/trophyicons/trophyicons/TrophyIcons_transparent/`
- Example progression: small medal -> shield -> sword -> crown -> etc.
- Or use Gems Icons for a gem-tier system (common -> rare -> legendary)
  - Path: `assets/unzipped_assets/gemsicons/gemsicons/` (160+ gem icons)

**Implementation notes:**
- Copy 8 selected PNGs into `static/milestones/`
- Replace the text `{milestone.icon}` with an `<img>` element
- Keep the `40x40` circle container, size the icon to fit

---

## 3. Collection Value Estimator — Potion Icon Flair

**Current state:** The value estimator (`src/lib/components/ValueEstimate.svelte`) is a plain card with text and a button.

**Proposed use:** Add a decorative potion/flask icon next to the value estimate heading or result. The potions look like "distilled value" which fits the concept of distilling a collection down to a number.

**Asset path:** `assets/potionicons_windows/potionicons/` (200 potion bottles)
- `t_01.PNG` through `t_180.PNG` — various colorful potion bottles
- Also `PotionIconsAdd_01.png` through `_10.png` and `az_bottle1.png` through `_10.png`

**Implementation notes:**
- Pick 1-3 potion images as decorative elements
- Could show different potions based on value tier (cheap = small bottle, expensive = ornate flask)
- Place as a decorative `<img>` beside the value total, or as a section header icon
- Resize to 48-64px display size

---

## 4. Random Picker Spinner — Coin Animation

**Current state:** `src/lib/components/RandomPicker.svelte` has a text-based "Spin" button with a record SVG icon.

**Proposed use:** Use the golden coin rotate animation as a spinning feedback element when the picker is active.

**Asset path:** `assets/unzipped_assets/goldencoinrotatesequence_windows/`
- `Coin.gif` — animated GIF of spinning coin (8 frames)
- `Coin.png` — spritesheet of all 8 frames

**Implementation notes:**
- Could use as an alternative spinner during the "spinning" state
- The GIF can be shown directly, or the spritesheet used with CSS `steps()` animation
- Small novelty touch — the spinning coin = "flipping through the collection"

---

## 5. Pixel Font for Shareable Stats Card

**Current state:** `src/lib/components/ShareableCard.svelte` uses standard web fonts for the shareable image/card.

**Proposed use:** Use a pixel font for headings or the username on the shareable card for a distinctive retro/record-store aesthetic.

**Asset path:** `assets/unzipped_assets/pixelfontpack_windows/Pixel_Font_Pack01_28_10_18/`

**Best candidates:**
- `Gold Box 8x16.ttf` — classic RPG feel, good for headings
- `Centurion Bold 8x16.ttf` — bolder variant, readable at small sizes
- `Bandwidth 8x8.ttf` — compact, good for stats numbers
- `Seven Oh Ess` / `Terminus` / `Jamma` — other options to try

**Implementation notes:**
- Add selected TTF to `static/fonts/`
- Register with `@font-face` in a scoped style or `app.css`
- Use sparingly — only on the shareable card or specific decorative headings
- Pixel fonts render best at integer multiples of their base size (16px, 24px, 32px)

---

## 6. Textures for Card Backgrounds

**Current state:** Cards use flat `var(--color-bg-card)` background with a border.

**Proposed use:** Subtle tiled texture overlay on certain special cards (e.g. the Collection DNA card, the shareable card, or section headers) for a tactile feel — like shelf wood grain or vinyl grooves.

**Asset path:** `assets/unzipped_assets/textures_windows/`
- `Textures.png` — master sheet of 80+ tileable pixel textures at 16x16, 24x24, 32x32
- `Textures.psd` — layered source (can extract individual textures)
- `Textures_v02.png` — additional textures

**Implementation notes:**
- Extract individual tileable textures from the master sheet
- Apply as `background-image` with `background-repeat: repeat` at low opacity (0.03-0.05) to keep readability
- Only use on 1-2 feature cards, not globally — too much texture kills the clean look
- Works well in dark mode for a subtle noise/grain effect

---

## 7. Interaction Sound Effects (Optional, Opt-In)

**Current state:** No audio. The app is silent.

**Proposed use:** Small, opt-in sound effects for interactive moments. User toggles sound on/off in settings.

**Asset path:** `assets/unzipped_assets/8-bitmusicandsfx/8-bitmusicandsfx/SFX_OGG/`

**Suggested sound mappings:**

| Interaction | Sound File | Why |
|-------------|-----------|-----|
| Random Picker spin | `SFX_-_coin_01.ogg` through `_10.ogg` | Slot machine / flip sound |
| Quiz correct answer | `SFX_-_beep_01.ogg` (positive tone) | Confirmation feedback |
| Quiz wrong answer | `SFX_-_alarm_01.ogg` (short buzz) | Error feedback |
| Milestone reached notification | One of the coin or beep sounds | Achievement unlocked feel |
| Collection fully loaded | A subtle beep | Loading complete signal |

**Implementation notes:**
- Add a `soundEnabled` setting to the settings store
- Copy only the 5-6 selected OGG files to `static/sfx/`
- Use the Web Audio API or simple `<audio>` elements
- Must be opt-in, default OFF — never auto-play audio on a website
- Keep file sizes tiny (OGG files are already small)
- Respect `prefers-reduced-motion` — if motion is reduced, skip audio too

---

## 8. Gem Icons for Collection DNA / Stats

**Current state:** `src/lib/components/CollectionDNA.svelte` visualizes collection personality as a set of traits.

**Proposed use:** Use gem icons as visual representations of rarity or trait strength. Different colored gems for different genre concentrations or collection traits.

**Asset path:** `assets/unzipped_assets/gemsicons/gemsicons/` (160+ faceted gemstones)

**Implementation notes:**
- Pick 6-8 gems in distinct colors matching the genre color scheme in `constants.ts`
- Use as decorative icons beside DNA traits or stat breakdowns
- Could also work in the quiz results or recommendations section

---

## Priority Order

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| 1 | Profile Badges (illustrated icons) | Medium | High — most visible change, replaces plain text pills |
| 2 | Milestone Icons | Low | Medium — small visual upgrade to a fun feature |
| 3 | Pixel Font on Shareable Card | Low | Medium — makes shared cards distinctive and memorable |
| 4 | Value Estimator Potion Icon | Low | Low-Medium — fun decorative touch |
| 5 | Coin Animation for Random Picker | Low | Low — novelty |
| 6 | Card Textures | Low | Low — subtle polish |
| 7 | Gem Icons for DNA/Stats | Medium | Low — decorative |
| 8 | Sound Effects | Medium | Low — nice-to-have, must be opt-in |

---

## Asset Preparation Checklist

Before integrating any assets:
1. Create `static/assets/` directory structure (`badges/`, `milestones/`, `fonts/`, etc.)
2. Resize PNGs to web-appropriate sizes (48-64px for inline icons, 128px max)
3. Run through an image optimizer (pngquant, oxipng) to minimize file size
4. Ensure all selected assets have transparent backgrounds
5. Test in both light and dark themes — some icons may need a subtle glow or shadow to be visible in dark mode
