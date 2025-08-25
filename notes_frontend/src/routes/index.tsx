import {
  component$,
  useSignal,
  useTask$,
  $,
  useVisibleTask$,
} from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";

type Note = {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
};

const STORAGE_KEY = "notes_app_items_v1";

// Helper to generate ids
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

// PUBLIC_INTERFACE
export default component$(() => {
  // Signals (reactive state)
  const notesSig = useSignal<Note[]>([]);
  const selectedIdSig = useSignal<string | null>(null);
  const searchSig = useSignal("");
  const titleSig = useSignal("");
  const contentSig = useSignal("");

  // Load from localStorage on client
  useVisibleTask$(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as Note[];
        notesSig.value = Array.isArray(arr) ? arr : [];
      }
    } catch {
      notesSig.value = [];
    }
    // If there are notes, select the most recent by updatedAt
    if (notesSig.value.length > 0) {
      const latest = [...notesSig.value].sort((a, b) => b.updatedAt - a.updatedAt)[0];
      selectNote(latest.id);
    }
  });

  // Keep editor fields in sync with selection
  useTask$(({ track }) => {
    const selectedId = track(() => selectedIdSig.value);
    const notes = track(() => notesSig.value);
    const selected = notes.find((n) => n.id === selectedId);
    titleSig.value = selected?.title ?? "";
    contentSig.value = selected?.content ?? "";
  });

  // Persist to localStorage whenever notes list changes
  useVisibleTask$(({ track }) => {
    const notes = track(() => notesSig.value);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch {
      // ignore persistence errors
    }
  });

  // Actions
  const selectNote = $( (id: string) => {
    selectedIdSig.value = id;
  });

  const createNote = $(() => {
    const newNote: Note = {
      id: uid(),
      title: "Untitled",
      content: "",
      updatedAt: Date.now(),
    };
    notesSig.value = [newNote, ...notesSig.value];
    selectedIdSig.value = newNote.id;
  });

  const deleteNote = $((id: string) => {
    const idx = notesSig.value.findIndex((n) => n.id === id);
    if (idx !== -1) {
      const next = [...notesSig.value];
      next.splice(idx, 1);
      notesSig.value = next;
      if (selectedIdSig.value === id) {
        selectedIdSig.value = next[0]?.id ?? null;
      }
    }
  });

  const saveNote = $(() => {
    const id = selectedIdSig.value;
    if (!id) return;
    notesSig.value = notesSig.value.map((n) =>
      n.id === id
        ? {
            ...n,
            title: titleSig.value.trim() || "Untitled",
            content: contentSig.value,
            updatedAt: Date.now(),
          }
        : n
    );
  });

  // Derived lists
  const filteredNotes = () => {
    const q = searchSig.value.trim().toLowerCase();
    if (!q) return notesSig.value;
    return notesSig.value.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q)
    );
  };

  // Wrap selected in $() so it can be safely referenced in event scopes
  const selected = $(
    () => notesSig.value.find((n) => n.id === selectedIdSig.value) || null,
  );

  // Render
  return (
    <div class="app">
      {/* Sidebar */}
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="brand">
            <div class="brand-badge" />
            <div class="brand-title">Notes</div>
          </div>
          <button class="new-btn" onClick$={createNote} aria-label="Create new note">
            + New
          </button>
        </div>

        <div class="row" style={{ justifyContent: "space-between" }}>
          <div class="badge">Local</div>
          <small style={{ color: "var(--color-text-muted)" }}>
            {notesSig.value.length} total
          </small>
        </div>

        <div class="search">
          <input
            placeholder="Search notes..."
            value={searchSig.value}
            onInput$={(e) => (searchSig.value = (e.target as HTMLInputElement).value)}
            aria-label="Search notes"
          />
        </div>

        <div class="note-list" role="list">
          {filteredNotes().map((n) => (
            <div
              role="listitem"
              key={n.id}
              class={{
                "note-item": true,
                active: selectedIdSig.value === n.id,
              }}
              onClick$={() => selectNote(n.id)}
            >
              <div>
                <div class="note-title" title={n.title}>
                  {n.title || "Untitled"}
                </div>
                <div class="note-meta">
                  {new Date(n.updatedAt).toLocaleString()}
                </div>
              </div>
              <button
                class="btn"
                onClick$={(ev) => {
                  ev.stopPropagation();
                  deleteNote(n.id);
                }}
                aria-label="Delete note"
                title="Delete note"
              >
                Delete
              </button>
            </div>
          ))}
          {filteredNotes().length === 0 && (
            <div class="empty">
              <div>No notes found</div>
              <div class="cta">
                <button class="btn primary" onClick$={createNote}>
                  Create your first note
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Editor */}
      <section class="editor">
        {/* Evaluate selection once for rendering */}
        {(() => {
          const s = notesSig.value.find((n) => n.id === selectedIdSig.value) || null;
          return s ? (
            <>
              <div class="editor-header">
                <input
                  class="title-input"
                  placeholder="Note title"
                  value={titleSig.value}
                  onInput$={(e) => (titleSig.value = (e.target as HTMLInputElement).value)}
                  onBlur$={saveNote}
                  aria-label="Note title"
                />
                <div class="toolbar">
                  <button class="btn accent" onClick$={saveNote}>
                    Save
                  </button>
                  <button
                    class="btn"
                    onClick$={$(async () => {
                      const cur = await selected();
                      if (cur) {
                        titleSig.value = cur.title;
                        contentSig.value = cur.content;
                      }
                    })}
                  >
                    Reset
                  </button>
                  <button
                    class="btn secondary"
                    onClick$={() => selectedIdSig.value && deleteNote(selectedIdSig.value)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <textarea
                class="content-input"
                placeholder="Start typing your note here..."
                value={contentSig.value}
                onInput$={(e) =>
                  (contentSig.value = (e.target as HTMLTextAreaElement).value)
                }
                onBlur$={saveNote}
                aria-label="Note content"
              />
            </>
          ) : (
            <div class="empty">
              <div>Select or create a note to begin</div>
              <div class="cta">
                <button class="btn primary" onClick$={createNote}>
                  + New note
                </button>
              </div>
            </div>
          );
        })()}
      </section>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Notes",
  meta: [
    {
      name: "description",
      content: "Minimalistic notes app built with Qwik. Create, edit, and manage notes locally.",
    },
    {
      name: "theme-color",
      content: "#ffffff",
    },
  ],
};
