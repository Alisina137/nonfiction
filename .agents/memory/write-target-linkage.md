---
name: Write target linkage
description: Durable contract for keeping generated prose attached to the exact outline subsection.
---

The Write pipeline must carry both the exact subsection title and its purpose from the outline node into first generation, regeneration/repair, Improve, and Edit. A title alone is insufficient when outline labels are numeric or terse. Saved prose must also retain that target binding; otherwise renamed outline nodes can display stale content.

**Why:** Outline generation stores the teaching purpose separately from the display title. Dropping that field makes the model rely on broad chapter context, producing prose that appears unrelated to the visible subsection.

**How to apply:** When adding or changing a Write caller, preserve the target title and purpose as explicit request fields, keep the server output title canonical, treat legacy/unbound entries as needing regeneration, and exclude stale entries from manuscript context.