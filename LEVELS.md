# How to Add a Level

This is the plain guide to adding a new **level** (a place with a fight) to the
adventure. Adding a level = adding one **data entry**. No deep coding needed.

There are **two parts** to every level:

1. **The story + fight** — lives in code, in one file: `src/lib/adventureData.ts`
2. **Where it sits on the map** — placed with the visual **Map Pin Editor**, and
   saved to the cloud so **everyone** sees it.

You can do them in either order. Below is the easy path.

---

## The 3 words you need

- **Chapter** = one level. It has a title, an intro, and one or more fights.
- **Encounter** = one fight inside a level.
- **Region** = a map you can zoom into (the World, then Londa, then a city, etc).

---

## Part 1 — Add the level (story + fight)

Open **`src/lib/adventureData.ts`**. Find the big list called
**`ADVENTURE_CHAPTERS`**. Copy this block and paste it **inside** that list (put a
comma after the block before it):

```ts
{
  id: "my-new-level",                 // unique short name, lowercase-with-dashes
  title: "My New Level",              // shown to the player
  intro: "Write what the player sees when they arrive here.",
  image: "/adventure-level1.webp",    // background picture (see public/ folder)
  requires: ["newbsberd"],            // must finish THIS level first (use its id)
  mapPin: { x: 50, y: 50, region: "londa" },  // position on the map (Part 2 sets this)
  encounters: [
    {
      name: "The Fight",
      description: "Write what happens in the fight.",
      aiDeckBias: "balanced",         // balanced | aggressive | defensive | magic
      aiStrength: 0.6,                // 0.2 = easy, 1.0 = normal, 1.5 = very hard
      mftReward: 800,                 // reward for winning this fight
      npcAddresses: [
        "0x99b772412C0D6E0fB31f227eCFf4E92B98379Fa8",  // enemy NFT(s) — repeat for more
      ],
    },
  ],
  completionBonus: 500,               // extra reward for finishing the whole level
}
```

Change the words in quotes to make it your level. **That is the whole level.**

### Common extra options (all optional)

- **More fights:** add more `{ ... }` blocks inside `encounters: [ ... ]`.
- **Unlock after ANY of several levels** (not all): use `requiresAny: ["or", "nr"]`.
- **An enemy that JOINS your party when you win:**
  add `joinsParty: "0x...the-npc-address"` to that encounter.
- **Give the player an item on win:**
  ```ts
  rewardItems: [
    { id: "shiny-key", name: "Shiny Key", category: "equipment", weight: 0.1, icon: "🔑" },
  ],
  ```
- **Lock a fight until the player holds an item:**
  `gateRequiresAnyItem: ["shiny-key"]`.

> Tip: copy a level that already works (like `"path-1"` or `"newbsberd"`) and
> change it. That is the safest way.

---

## Part 2 — Place it on the map (and save for everyone)

1. Make sure `.env.local` has `NEXT_PUBLIC_MAP_EDITOR=1`, then run `npm run dev`.
2. Open **http://localhost:3000/map-editor** and connect the **admin wallet**.
3. Use the folder list on the right to open the map your level belongs to
   (for example: World → Londa).
4. Drag the pin for your level to where you want it. To **connect a path**
   between two pins, click a pin, press **+ Path**, then click the other pin.
5. Click the green **Publish to Cloud** button (top right).

That last click is the important one. **Publish to Cloud** saves the pins to the
shared database, so the level shows up in the right spot for **every player on
every device** — not just your browser.

> If you ever see "Cloud save failed", the database table is missing. Run the
> file **`supabase-map-pins.sql`** once in Supabase (SQL editor), then publish
> again. Until then, pins still save on your own computer.

### Making a brand-new level pin in the editor

If you place a pin for a level that doesn't exist in `adventureData.ts` yet, open
the **Code** panel in the editor. At the top you'll see **"New level(s) →
adventureData.ts"** with a green **Copy** button. That gives you a **complete,
ready-to-paste level block** (like the one in Part 1) already filled with your
pin's id, title, position and paths. Paste it into `ADVENTURE_CHAPTERS` and just
write the story and pick the enemies.

---

## Where everything is saved (so you can trust it)

When the game draws the map, it looks for pin positions in this order:

1. **Cloud** (Supabase `map_pins`) — shared with everyone. *(set by Publish to Cloud)*
2. **Your browser** (localStorage) — your own unsaved edits.
3. **The code** (`mapPin` in `adventureData.ts`) — the built-in fallback.

So: the **story and fights** always live in the code (`adventureData.ts`), and the
**pin positions** are kept safe in the cloud after you Publish. Adding a level is
just: paste one block + drop a pin + Publish.

---

## Quick checklist for each new level

- [ ] Pasted a `{ ... }` block into `ADVENTURE_CHAPTERS` in `src/lib/adventureData.ts`
- [ ] Gave it a unique `id`
- [ ] Set `requires` (or `requiresAny`) so it unlocks at the right time
- [ ] Placed and connected its pin in `/map-editor`
- [ ] Clicked **Publish to Cloud**
- [ ] Ran the game and walked to it to make sure it works
