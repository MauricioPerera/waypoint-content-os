"use client";

import { useState } from "react";

type Layout = { id: string; name: string; slug: string; regions: string[]; rules: { fontFamily: string; headingScale: string; accent: string; maxWidth: string; spacing: string; radius: string } };

const makeId = () => "layout_" + Math.random().toString(16).slice(2, 8).toUpperCase();

export function LayoutAdmin({ layouts, createLayout, updateLayout }: { layouts: Layout[]; createLayout: (layout: Layout) => void; updateLayout: (layout: Layout) => void }) {
  const [editing, setEditing] = useState<Layout>();
  const [name, setName] = useState("");
  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    createLayout({ id: makeId(), name: trimmed, slug: trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-"), regions: ["header", "main", "footer"], rules: { fontFamily: "Inter", headingScale: "1.2", accent: "#d7ff4f", maxWidth: "1180px", spacing: "24px", radius: "18px" } });
    setName("");
  };
  return <section className="page layout-admin"><div className="card entries-card"><div className="card-heading"><div><p className="eyebrow">LAYOUT ADMINISTRATION</p><h2>Design rules</h2></div></div>{layouts.map((layout) => <div className="taxonomy-summary" key={layout.id}><div><b>{layout.name}</b><small>{layout.slug} · {layout.rules.maxWidth} max · {layout.rules.spacing} spacing</small></div><button className="text-button" onClick={() => setEditing(layout)}>Edit</button></div>)}<div className="builder-add"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="New layout name" /><button className="primary-button" disabled={!name.trim()} onClick={create}>New layout</button></div></div>{editing && <div className="card entries-card" style={{ marginTop: 16 }}><div className="card-heading"><h2>Edit {editing.name}</h2><button className="text-button" onClick={() => setEditing(undefined)}>Close</button></div><div className="modal" style={{ width: "100%", boxShadow: "none", borderRadius: 0 }}><label>Name<input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label><label>Max width<input value={editing.rules.maxWidth} onChange={(event) => setEditing({ ...editing, rules: { ...editing.rules, maxWidth: event.target.value } })} /></label><label>Spacing<input value={editing.rules.spacing} onChange={(event) => setEditing({ ...editing, rules: { ...editing.rules, spacing: event.target.value } })} /></label><label>Accent<input type="color" value={editing.rules.accent} onChange={(event) => setEditing({ ...editing, rules: { ...editing.rules, accent: event.target.value } })} /></label><label>Radius<input value={editing.rules.radius} onChange={(event) => setEditing({ ...editing, rules: { ...editing.rules, radius: event.target.value } })} /></label><div className="modal-actions"><button className="primary-button" onClick={() => { updateLayout(editing); setEditing(undefined); }}>Save layout</button></div></div></div>}</section>;
}
