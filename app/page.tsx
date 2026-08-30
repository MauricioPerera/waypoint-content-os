"use client";
/* The app hydrates persisted local workspace state and synchronizes UI filters through effects. */
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { WebmcpRegistrar } from "../src/mcp/register";

type View =
  | "overview"
  | "pages"
  | "entries"
  | "schema"
  | "taxonomies"
  | "relations"
  | "users"
  | "plugins"
  | "media"
  | "comments"
  | "menus"
  | "settings"
  | "activity"
  | "roles";
type Entry = {
  id: string;
  title: string;
  slug?: string;
  type: string;
  status: "Published" | "Draft";
  updated: string;
  updatedAt?: string;
  relation: string;
  authorUserId?: string;
  scheduledAt?: string;
  deletedAt?: string;
  metadata?: Record<string, unknown>;
  data?: Record<string, unknown>;
};
type ContentType = {
  icon: string;
  name: string;
  count: number;
  tone: string;
  desc: string;
  slug: string;
  fields: string[];
  fieldTypes?: Record<
    string,
    "text" | "number" | "boolean" | "url" | "date" | "json"
  >;
  requiredFields?: string[];
};
type Term = {
  id: string;
  name: string;
  slug: string;
  parent: string | null;
  description?: string;
};
type Taxonomy = {
  name: string;
  slug: string;
  hierarchical: boolean;
  terms: Term[];
};
type Relation = {
  id: string;
  name: string;
  slug: string;
  fromType: string;
  toType: string;
  cardinality: "one" | "many";
};
type Connection = {
  id: string;
  relation: string;
  fromEntryId: string;
  toEntryId: string;
  createdAt: string;
};
type TermAssignment = {
  entryId: string;
  taxonomy: string;
  termIds: string[];
  updatedAt: string;
};
type Revision = {
  id: string;
  entryId: string;
  createdAt: string;
  action: string;
  before: Entry;
  after: Entry;
};
type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "Active" | "Invited";
  metadata?: Record<string, unknown>;
  capabilities: string[];
};
type AuthUser = { id: string; name: string; email: string; role: string };
type Role = {
  id: string;
  name: string;
  slug: string;
  description: string;
  capabilities: string[];
  system?: boolean;
};
type Plugin = {
  id: string;
  name: string;
  slug: string;
  version: string;
  author: string;
  description: string;
  status: "Active" | "Inactive";
  capabilities: string[];
};
type Hook = {
  id: string;
  name: string;
  event: string;
  priority: number;
  enabled: boolean;
  pluginSlug?: string;
  description?: string;
};
type Action = {
  id: string;
  name: string;
  label: string;
  description: string;
  pluginSlug?: string;
  capabilities?: string[];
};
type MediaAsset = {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  alt?: string;
  metadata?: Record<string, unknown>;
  attachedEntryIds: string[];
  createdAt: string;
};
type Comment = {
  id: string;
  entryId: string;
  authorUserId?: string;
  authorName: string;
  authorEmail?: string;
  content: string;
  status: "Pending" | "Approved" | "Spam";
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};
type MenuItem = {
  id: string;
  label: string;
  url?: string;
  entryId?: string;
  parentId?: string;
  order: number;
  openInNewTab?: boolean;
};
type Menu = {
  id: string;
  name: string;
  slug: string;
  location?: string;
  items: MenuItem[];
};
type SiteSettings = {
  siteName: string;
  description: string;
  url: string;
  timezone: string;
  options?: Record<string, unknown>;
};
type PageBlock = {
  id: string;
  type: "text" | "image" | "button" | "columns" | "divider" | "html";
  content: string;
  settings?: Record<string, unknown>;
};
type VisualPage = {
  id: string;
  title: string;
  slug: string;
  status: "Draft" | "Published" | "Archived";
  templateId?: string;
  blocks: PageBlock[];
  metadata?: Record<string, unknown>;
  updatedAt: string;
};
type PageTemplate = {
  id: string;
  name: string;
  slug: string;
  description: string;
  blocks: PageBlock[];
  layoutId?: string;
};
type LayoutRule = { fontFamily: string; headingScale: string; accent: string; maxWidth: string; spacing: string; radius: string };
type PageLayout = { id: string; name: string; slug: string; regions: string[]; rules: LayoutRule };

const seedEntries: Entry[] = [
  {
    id: "ent_01H8",
    title: "The quiet architecture of everyday tools",
    type: "Article",
    status: "Published",
    updated: "",
    updatedAt: "2026-08-30T08:18:00.000Z",
    relation: "Design / Essay",
    authorUserId: "usr_editor",
  },
  {
    id: "ent_01G4",
    title: "Mara Hoffmann",
    type: "Author",
    status: "Published",
    updated: "",
    updatedAt: "2026-08-30T06:30:00.000Z",
    relation: "3 articles",
  },
  {
    id: "ent_019D",
    title: "Field Notes — Issue 04",
    type: "Article",
    status: "Draft",
    updated: "",
    updatedAt: "2026-08-29T10:00:00.000Z",
    relation: "Culture / Field Notes",
  },
];
const seedTypes: ContentType[] = [
  {
    icon: "Aa",
    name: "Article",
    count: 128,
    tone: "yellow",
    desc: "Long-form editorial content",
    slug: "article",
    fields: ["title", "slug", "body", "reading_time", "authors", "topics"],
  },
  {
    icon: "◎",
    name: "Author",
    count: 24,
    tone: "green",
    desc: "People behind the work",
    slug: "author",
    fields: ["name", "bio", "avatar"],
  },
  {
    icon: "▦",
    name: "Project",
    count: 36,
    tone: "lavender",
    desc: "Selected work and case studies",
    slug: "project",
    fields: ["title", "summary", "url"],
  },
];
const seedTaxonomies: Taxonomy[] = [
  {
    name: "Topics",
    slug: "topics",
    hierarchical: true,
    terms: [
      { id: "term_design", name: "Design", slug: "design", parent: null },
      {
        id: "term_architecture",
        name: "Architecture",
        slug: "architecture",
        parent: "term_design",
      },
    ],
  },
];
const seedRelations: Relation[] = [
  {
    id: "rel_authored",
    name: "Authored by",
    slug: "authored-by",
    fromType: "Article",
    toType: "Author",
    cardinality: "one",
  },
  {
    id: "rel_featured",
    name: "Featured in",
    slug: "featured-in",
    fromType: "Article",
    toType: "Project",
    cardinality: "many",
  },
];
const seedUsers: User[] = [
  {
    id: "usr_owner",
    name: "Ana García",
    email: "ana@northstar.example",
    role: "Owner",
    status: "Active",
    capabilities: ["content.manage", "schema.manage", "users.manage"],
    metadata: { timezone: "America/Mexico_City" },
  },
  {
    id: "usr_editor",
    name: "Luis Ortega",
    email: "luis@northstar.example",
    role: "Editor",
    status: "Active",
    capabilities: ["content.manage"],
    metadata: { specialty: "Culture" },
  },
];
const seedPlugins: Plugin[] = [
  {
    id: "plg_webmcp",
    name: "WebMCP Core",
    slug: "webmcp-core",
    version: "0.5.0",
    author: "Waypoint",
    description: "Agent tool registration and content operations.",
    status: "Active",
    capabilities: ["tools.register", "content.extend"],
  },
];
const seedRoles: Role[] = [
  {
    id: "role_owner",
    name: "Owner",
    slug: "owner",
    description: "Full workspace control.",
    capabilities: [
      "content.manage",
      "schema.manage",
      "users.manage",
      "plugins.manage",
    ],
    system: true,
  },
  {
    id: "role_editor",
    name: "Editor",
    slug: "editor",
    description: "Manage editorial content.",
    capabilities: ["content.manage"],
    system: true,
  },
  {
    id: "role_author",
    name: "Author",
    slug: "author",
    description: "Create and edit own content.",
    capabilities: ["content.create", "content.edit_own"],
    system: true,
  },
];
const seedMedia: MediaAsset[] = [
  {
    id: "med_cover",
    name: "quiet-tools-cover.jpg",
    url: "https://images.example/quiet-tools-cover.jpg",
    mimeType: "image/jpeg",
    size: 248000,
    width: 1600,
    height: 900,
    alt: "Abstract architecture detail",
    metadata: { credit: "Northstar Studio" },
    attachedEntryIds: ["ent_01H8"],
    createdAt: "2026-08-29T10:00:00.000Z",
  },
];
const seedComments: Comment[] = [
  {
    id: "cmt_01",
    entryId: "ent_01H8",
    authorUserId: "usr_editor",
    authorName: "Luis Ortega",
    authorEmail: "luis@northstar.example",
    content: "Una lectura muy sugerente sobre diseño cotidiano.",
    status: "Approved",
    createdAt: "2026-08-29T11:00:00.000Z",
    updatedAt: "2026-08-29T11:00:00.000Z",
  },
];
const seedMenus: Menu[] = [
  {
    id: "menu_main",
    name: "Main navigation",
    slug: "main-navigation",
    location: "header",
    items: [
      { id: "mi_home", label: "Home", url: "/", order: 0 },
      { id: "mi_journal", label: "Journal", url: "/journal", order: 1 },
    ],
  },
];
const defaultSiteSettings: SiteSettings = {
  siteName: "Northstar Journal",
  description: "A publication about design and culture.",
  url: "http://localhost:3001",
  timezone: "America/Mexico_City",
  options: {},
};
const seedLayouts: PageLayout[] = [{ id: "layout_editorial", name: "Editorial canvas", slug: "editorial-canvas", regions: ["header", "main", "footer"], rules: { fontFamily: "Inter", headingScale: "1.2", accent: "#D7FF4F", maxWidth: "1180px", spacing: "24px", radius: "18px" } }];
const seedTemplates: PageTemplate[] = [{ id: "tpl_landing", name: "Editorial landing", slug: "editorial-landing", description: "A clear hero, story and call to action.", layoutId: "layout_editorial", blocks: [{ id: "blk_hero", type: "text", content: "A thoughtful headline", settings: { variant: "hero" } }, { id: "blk_copy", type: "text", content: "Introduce the idea behind this page." }, { id: "blk_cta", type: "button", content: "Explore more", settings: { url: "/journal" } }] }];
const seedPages: VisualPage[] = [{ id: "page_home", title: "Homepage", slug: "home", status: "Published", templateId: "tpl_landing", blocks: [{ id: "blk_home_hero", type: "text", content: "Make the next idea easier to find.", settings: { variant: "hero" } }, { id: "blk_home_copy", type: "text", content: "Northstar Journal is a calm space for design and culture." }, { id: "blk_home_cta", type: "button", content: "Read the journal", settings: { url: "/journal" } }], updatedAt: "2026-08-30T10:00:00.000Z" }];
type PersistedModel = Partial<{
  entries: Entry[];
  types: ContentType[];
  taxonomies: Taxonomy[];
  relations: Relation[];
  connections: Connection[];
  termAssignments: TermAssignment[];
  revisions: Revision[];
  users: User[];
  roles: Role[];
  plugins: Plugin[];
  media: MediaAsset[];
  comments: Comment[];
  menus: Menu[];
  activeType: string;
  activeStatus: string;
  pages: VisualPage[];
  templates: PageTemplate[];
  layouts: PageLayout[];
}>;

function emitRegisteredHooks(event: string, payload: Record<string, unknown>) {
  try {
    const raw = window.localStorage.getItem("waypoint.hooks");
    const hooks = raw ? (JSON.parse(raw) as Hook[]) : [];
    hooks
      .filter((hook) => hook.enabled && hook.event === event)
      .sort((a, b) => a.priority - b.priority)
      .forEach((hook) =>
        window.dispatchEvent(
          new CustomEvent("waypoint-hook", {
            detail: {
              hook,
              event,
              payload,
              emittedAt: new Date().toISOString(),
            },
          }),
        ),
      );
  } catch {
    // Invalid registry data must never interrupt content persistence.
  }
}

export default function Home() {
  const [view, setView] = useState<View>("overview"),
    [pages, setPages] = useState(seedPages),
    [templates, setTemplates] = useState(seedTemplates),
    [layouts, setLayouts] = useState(seedLayouts),
    [entries, setEntries] = useState(seedEntries),
    [types, setTypes] = useState(seedTypes),
    [taxonomies, setTaxonomies] = useState(seedTaxonomies),
    [relations, setRelations] = useState(seedRelations),
    [connections, setConnections] = useState<Connection[]>([]),
    [termAssignments, setTermAssignments] = useState<TermAssignment[]>([]),
    [revisions, setRevisions] = useState<Revision[]>([]),
    [users, setUsers] = useState(seedUsers),
    [roles, setRoles] = useState(seedRoles),
    [plugins, setPlugins] = useState(seedPlugins),
    [media, setMedia] = useState(seedMedia),
    [comments, setComments] = useState(seedComments),
    [menus, setMenus] = useState(seedMenus),
    [settings, setSettings] = useState(defaultSiteSettings),
    [activeType, setActiveType] = useState("All content"),
    [activeStatus, setActiveStatus] = useState("All statuses"),
    [toast, setToast] = useState("");
  const [remoteReady, setRemoteReady] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showEntry, setShowEntry] = useState(false),
    [showTaxonomy, setShowTaxonomy] = useState(false),
    [showTerm, setShowTerm] = useState(false),
    [showType, setShowType] = useState(false),
    [showRelation, setShowRelation] = useState(false),
    [termTaxonomy, setTermTaxonomy] = useState("");
  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetch("/api/auth/me", { credentials: "same-origin" }),
      fetch("/api/auth/status", { credentials: "same-origin" }),
    ])
      .then(async ([meResponse, statusResponse]) => {
        if (!mounted) return;
        if (meResponse.ok) {
          const payload = (await meResponse.json()) as { user?: AuthUser };
          setAuthUser(payload.user || null);
        } else if (meResponse.status === 404) {
          setAuthUser({ id: "local", name: "Local admin", email: "admin@localhost", role: "administrator" });
        }
        if (statusResponse.ok) {
          const payload = (await statusResponse.json()) as { setupRequired?: boolean };
          setSetupRequired(Boolean(payload.setupRequired));
        }
        if (meResponse.ok)
          fetch("/api/auth/users", { credentials: "same-origin" })
            .then((response) => (response.ok ? response.json() : null))
            .then((payload) => {
              const remote = (payload as { users?: Array<Partial<User> & { id: string; email: string; name: string; role: string }> } | null)?.users;
              if (!remote?.length) return;
              setUsers((current) => {
                const remoteEmails = new Set(remote.map((user) => user.email.toLowerCase()));
                const mapped = remote.map((user) => ({
                  id: user.id,
                  name: user.name,
                  email: user.email,
                  role: user.role,
                  status: "Active" as const,
                  capabilities: user.capabilities || [],
                  metadata: user.metadata,
                }));
                return [...mapped, ...current.filter((user) => !remoteEmails.has(user.email.toLowerCase()))];
              });
            })
            .catch(() => undefined);
      })
      .catch(() => {
        if (window.location.hostname === "localhost")
          setAuthUser({ id: "local", name: "Local admin", email: "admin@localhost", role: "administrator" });
      })
      .finally(() => mounted && setAuthLoading(false));
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    const raw = window.localStorage.getItem("waypoint.model");
    if (raw)
      try {
        const data = JSON.parse(raw);
        if (data.entries)
          setEntries(
            data.entries.map((entry: Entry) =>
              entry.updatedAt
                ? entry
                : {
                    ...entry,
                    updated: "",
                    updatedAt: new Date().toISOString(),
                  },
            ),
          );
        if (data.pages) setPages(data.pages);
        if (data.templates) setTemplates(data.templates);
        if (data.layouts) setLayouts(data.layouts);
        if (data.types) setTypes(data.types);
        if (data.taxonomies) setTaxonomies(data.taxonomies);
        if (data.relations) setRelations(data.relations);
        if (data.connections) setConnections(data.connections);
        if (data.termAssignments) setTermAssignments(data.termAssignments);
        if (data.revisions) setRevisions(data.revisions);
        if (data.users) setUsers(data.users);
        if (data.roles) setRoles(data.roles);
        if (data.plugins) setPlugins(data.plugins);
        if (data.media) setMedia(data.media);
        if (data.comments) setComments(data.comments);
        if (data.menus) setMenus(data.menus);
        if (data.activeType) setActiveType(data.activeType);
        if (data.activeStatus) setActiveStatus(data.activeStatus);
      } catch {
        /* keep seed */
      }
  }, []);
  useEffect(() => {
    if (!authUser) return;
    const syncSettings = () => {
      const raw = window.localStorage.getItem("waypoint.settings");
      if (raw)
        try {
          setSettings({ ...defaultSiteSettings, ...JSON.parse(raw) });
        } catch {
          /* keep defaults */
        }
    };
    syncSettings();
    fetch("/api/registry/settings", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        const remote = payload as { data?: Partial<SiteSettings> } | null;
        if (remote?.data)
          setSettings({ ...defaultSiteSettings, ...remote.data });
      })
      .catch(() => undefined);
    window.addEventListener("waypoint-settings-updated", syncSettings);
    return () =>
      window.removeEventListener("waypoint-settings-updated", syncSettings);
  }, [authUser]);
  useEffect(() => {
    if (!authUser) return;
    let mounted = true;
    fetch("/api/state", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        const data = (payload as { state?: PersistedModel })?.state;
        if (!data || !mounted) return;
        if (data.entries) setEntries(data.entries);
        if (data.pages) setPages(data.pages);
        if (data.templates) setTemplates(data.templates);
        if (data.layouts) setLayouts(data.layouts);
        if (data.types) setTypes(data.types);
        if (data.taxonomies) setTaxonomies(data.taxonomies);
        if (data.relations) setRelations(data.relations);
        if (data.connections) setConnections(data.connections);
        if (data.termAssignments) setTermAssignments(data.termAssignments);
        if (data.revisions) setRevisions(data.revisions);
        if (data.users) setUsers(data.users);
        if (data.roles) setRoles(data.roles);
        if (data.plugins) setPlugins(data.plugins);
        if (data.media) setMedia(data.media);
        if (data.comments) setComments(data.comments);
        if (data.menus) setMenus(data.menus);
        if (data.activeType) setActiveType(data.activeType);
        if (data.activeStatus) setActiveStatus(data.activeStatus);
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setRemoteReady(true);
      });
    return () => {
      mounted = false;
    };
  }, [authUser]);
  useEffect(() => {
    if (!remoteReady || !authUser) return;
    const state = {
      pages,
      templates,
      layouts,
      entries,
      types,
      taxonomies,
      relations,
      connections,
      termAssignments,
      revisions,
      users,
      roles,
      plugins,
      media,
      comments,
      menus,
      activeType,
      activeStatus,
    };
    window.localStorage.setItem(
      "waypoint.model",
      JSON.stringify(state),
    );
    fetch("/api/state", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    }).catch(() => undefined);
    window.dispatchEvent(new Event("waypoint-model-updated"));
  }, [
    pages,
    templates,
    layouts,
    entries,
    types,
    taxonomies,
    relations,
    connections,
    termAssignments,
    revisions,
    users,
    roles,
    plugins,
    media,
    comments,
    menus,
    activeType,
    activeStatus,
    remoteReady,
    authUser,
  ]);
  useEffect(() => {
    const onModelUpdated = () =>
      emitRegisteredHooks("content.changed", { source: "workspace-model" });
    window.addEventListener("waypoint-model-updated", onModelUpdated);
    return () =>
      window.removeEventListener("waypoint-model-updated", onModelUpdated);
  }, []);
  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };
  const createEntry = (
    title: string,
    type: string,
    data: Record<string, unknown> = {},
  ): Entry => {
    const entry: Entry = {
      id: "ent_" + Math.random().toString(16).slice(2, 8).toUpperCase(),
      title,
      type,
      status: "Draft",
      updated: "",
      updatedAt: new Date().toISOString(),
      relation: "No relations yet",
      data,
    };
    setEntries((x) => [entry, ...x]);
    emitRegisteredHooks("entry.created", { entry });
    setShowEntry(false);
    notify("Draft created");
    return entry;
  };
  const updateEntry = (next: Entry) => {
    const updated = { ...next, updatedAt: new Date().toISOString(), updated: "" };
    setEntries((all) => all.map((entry) => (entry.id === updated.id ? updated : entry)));
    emitRegisteredHooks("entry.updated", { entry: updated });
    notify("Entry updated");
  };
  const removeEntry = (entry: Entry) => {
    setEntries((all) => all.filter((item) => item.id !== entry.id));
    emitRegisteredHooks("entry.deleted", { entryId: entry.id });
    notify("Entry deleted");
  };
  const createPage = (page: VisualPage) => { setPages((all) => [page, ...all]); emitRegisteredHooks("page.created", { page }); notify("Page created"); };
  const updatePage = (page: VisualPage) => { setPages((all) => all.map((item) => item.id === page.id ? page : item)); emitRegisteredHooks("page.updated", { page }); notify("Page updated"); };
  const removePage = (page: VisualPage) => { if (!window.confirm(`Delete page ${page.title}?`)) return; setPages((all) => all.filter((item) => item.id !== page.id)); emitRegisteredHooks("page.deleted", { pageId: page.id }); notify("Page deleted"); };
  const createTemplate = (template: PageTemplate) => { setTemplates((all) => [template, ...all]); notify("Template created"); };
  const updateTemplate = (template: PageTemplate) => { setTemplates((all) => all.map((item) => item.id === template.id ? template : item)); notify("Template updated"); };
  const removeTemplate = (template: PageTemplate) => { if (!window.confirm(`Delete template ${template.name}?`)) return; setTemplates((all) => all.filter((item) => item.id !== template.id)); notify("Template deleted"); };
  const createLayout = (layout: PageLayout) => { setLayouts((all) => [layout, ...all]); notify("Layout created"); };
  const updateLayout = (layout: PageLayout) => { setLayouts((all) => all.map((item) => item.id === layout.id ? layout : item)); notify("Layout updated"); };
  const removeType = (type: ContentType) => {
    if (!window.confirm(`Delete content type ${type.name}?`)) return;
    setTypes((all) => all.filter((item) => item.slug !== type.slug));
    setEntries((all) => all.filter((entry) => entry.type !== type.name));
    emitRegisteredHooks("content_type.deleted", { slug: type.slug });
    notify("Content type deleted");
  };
  const updateType = (type: ContentType) => { setTypes((all) => all.map((item) => item.slug === type.slug ? type : item)); emitRegisteredHooks("content_type.updated", { contentType: type }); notify("Content type updated"); };
  const removeTaxonomy = (taxonomy: Taxonomy) => {
    if (!window.confirm(`Delete taxonomy ${taxonomy.name}?`)) return;
    setTaxonomies((all) => all.filter((item) => item.slug !== taxonomy.slug));
    setTermAssignments((all) => all.filter((item) => item.taxonomy !== taxonomy.slug));
    emitRegisteredHooks("taxonomy.deleted", { slug: taxonomy.slug });
    notify("Taxonomy deleted");
  };
  const updateTaxonomy = (taxonomy: Taxonomy) => { setTaxonomies((all) => all.map((item) => item.slug === taxonomy.slug ? taxonomy : item)); emitRegisteredHooks("taxonomy.updated", { taxonomy }); notify("Taxonomy updated"); };
  const removeTerm = (taxonomy: Taxonomy, term: Term) => {
    setTaxonomies((all) => all.map((item) => item.slug === taxonomy.slug ? { ...item, terms: item.terms.filter((candidate) => candidate.id !== term.id && candidate.parent !== term.id) } : item));
    emitRegisteredHooks("term.deleted", { taxonomy: taxonomy.slug, termId: term.id });
    notify("Term deleted");
  };
  const removeRelation = (relation: Relation) => {
    if (!window.confirm(`Delete relation ${relation.name}?`)) return;
    setRelations((all) => all.filter((item) => item.id !== relation.id));
    setConnections((all) => all.filter((item) => item.relation !== relation.slug));
    emitRegisteredHooks("relation.deleted", { relationId: relation.id });
    notify("Relation deleted");
  };
  const updateRelation = (relation: Relation) => { setRelations((all) => all.map((item) => item.id === relation.id ? relation : item)); emitRegisteredHooks("relation.updated", { relation }); notify("Relation updated"); };
  const updateComment = (comment: Comment) => { setComments((all) => all.map((item) => item.id === comment.id ? { ...comment, updatedAt: new Date().toISOString() } : item)); notify("Comment updated"); };
  const createComment = (comment: Comment) => { setComments((all) => [comment, ...all]); emitRegisteredHooks("comment.created", { comment }); notify("Comment created"); };
  const removeComment = (comment: Comment) => { if (!window.confirm("Delete this comment?")) return; setComments((all) => all.filter((item) => item.id !== comment.id)); notify("Comment deleted"); };
  const removeMedia = (asset: MediaAsset) => { if (!window.confirm(`Delete ${asset.name}?`)) return; setMedia((all) => all.filter((item) => item.id !== asset.id)); notify("Media deleted"); };
  const createMedia = (asset: MediaAsset) => { setMedia((all) => [asset, ...all]); emitRegisteredHooks("media.created", { media: asset }); notify("Media registered"); };
  const updateMedia = (asset: MediaAsset) => { setMedia((all) => all.map((item) => item.id === asset.id ? asset : item)); emitRegisteredHooks("media.updated", { media: asset }); notify("Media updated"); };
  const removeMenu = (menu: Menu) => { if (!window.confirm(`Delete menu ${menu.name}?`)) return; setMenus((all) => all.filter((item) => item.id !== menu.id)); notify("Menu deleted"); };
  const createMenu = (menu: Menu) => { setMenus((all) => [menu, ...all]); emitRegisteredHooks("menu.created", { menu }); notify("Menu created"); };
  const updateMenu = (menu: Menu) => { setMenus((all) => all.map((item) => item.id === menu.id ? menu : item)); emitRegisteredHooks("menu.updated", { menu }); notify("Menu updated"); };
  const createContentType = (
    name: string,
    slug: string,
    fields: string[],
    fieldTypes: Record<
      string,
      "text" | "number" | "boolean" | "url" | "date" | "json"
    > = {},
    requiredFields: string[] = [],
  ): ContentType => {
    const s = slug.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(s) || types.some((t) => t.slug === s))
      throw Error("Slug inválido o duplicado");
    const created: ContentType = {
      icon: "◇",
      name: name.trim(),
      count: 0,
      tone: "lavender",
      desc: "Agent-created content type",
      slug: s,
      fields,
      fieldTypes,
      requiredFields,
    };
    setTypes((x) => [...x, created]);
    emitRegisteredHooks("content_type.created", { contentType: created });
    notify("Content type created");
    return created;
  };
  const createTerm = (
    taxonomy: string,
    name: string,
    slug: string,
    parent: string | null,
    description: string,
  ) => {
    const s = slug.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(s)) throw Error("Slug inválido");
    if (
      taxonomies
        .find((t) => t.slug === taxonomy)
        ?.terms.some((term) => term.slug === s)
    )
      throw Error("El término ya existe");
    setTaxonomies((x) =>
      x.map((t) =>
        t.slug === taxonomy
          ? {
              ...t,
              terms: [
                ...t.terms,
                {
                  id:
                    "term_" +
                    Math.random().toString(16).slice(2, 8).toUpperCase(),
                  name: name.trim(),
                  slug: s,
                  parent,
                  description,
                },
              ],
            }
          : t,
      ),
    );
    setShowTerm(false);
    notify("Term created");
  };
  const state = {
    pages,
    setPages,
    templates,
    setTemplates,
    layouts,
    setLayouts,
    entries,
    setEntries,
    contentTypes: types,
    setContentTypes: setTypes,
    taxonomies,
    setTaxonomies,
    relations,
    setRelations,
    connections,
    setConnections,
    termAssignments,
    setTermAssignments,
    revisions,
    setRevisions,
    users,
    setUsers,
    roles,
    setRoles,
    plugins,
    setPlugins,
    media,
    setMedia,
    comments,
    setComments,
    menus,
    setMenus,
    activeType,
    setActiveType: (value: string) => {
      setActiveType(value);
      window.dispatchEvent(
        new CustomEvent("waypoint-type-filter", { detail: value }),
      );
    },
    activeStatus,
    setActiveStatus: (value: string) => {
      setActiveStatus(value);
      window.dispatchEvent(
        new CustomEvent("waypoint-status-filter", { detail: value }),
      );
    },
    createEntry,
    createContentType,
    notify,
  };
  if (authLoading)
    return <div className="auth-shell"><div className="auth-card"><span className="brand-mark">W</span><p>Loading Waypoint…</p></div></div>;
  if (!authUser)
    return <AuthScreen setupRequired={setupRequired} onAuthenticated={(user) => { setAuthUser(user); setSetupRequired(false); }} />;
  return (
    <>
      <WebmcpRegistrar state={state} />
      <div className="app-shell">
        <Sidebar
          view={view}
          setView={setView}
          siteName={settings.siteName}
          entryCount={entries.length}
          currentUser={users[0]}
        />
        <main className="main-content">
          <header className="topbar">
            <div className="breadcrumbs">
              <span>{settings.siteName}</span>
              <b>/</b>
              <strong>{label(view)}</strong>
            </div>
            <div className="topbar-actions">
              <button className="icon-button" aria-label="Search entries" onClick={() => setSearchOpen(true)}>⌕</button>
              <button className="icon-button" aria-label="Open agent activity" onClick={() => setView("activity")}>
                ♧<i />
              </button>
              <button className="help-button" onClick={() => setHelpOpen(true)}>
                ? <span>Help</span>
              </button>
              <button
                className="secondary-button"
                onClick={() => fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).finally(() => { setAuthUser(null); setSetupRequired(false); })}
              >
                Sign out
              </button>
              <button
                className="primary-button"
                onClick={() => setShowEntry(true)}
              >
                ＋ New entry
              </button>
            </div>
          </header>
          {view === "overview" && (
            <Overview
              types={types}
              entries={entries}
              relations={relations}
              taxonomies={taxonomies}
              revisions={revisions}
              currentUser={users[0]}
              go={setView}
              create={() => setShowEntry(true)}
            />
          )}{" "}
          {view === "entries" && (
            <Entries
              entries={entries}
              types={types}
              searchQuery={searchQuery}
              create={() => setShowEntry(true)}
              update={updateEntry}
              remove={removeEntry}
            />
          )}{" "}
          {view === "schema" && (
            <Schema
              types={types}
              entries={entries}
              create={() => setShowType(true)}
              remove={removeType}
              update={updateType}
            />
          )}{" "}
          {view === "taxonomies" && (
            <Taxonomies
              taxonomies={taxonomies}
              remove={removeTaxonomy}
              removeTerm={removeTerm}
              update={updateTaxonomy}
              create={() => setShowTaxonomy(true)}
              addTerm={(taxonomy) => {
                setTermTaxonomy(taxonomy);
                setShowTerm(true);
              }}
            />
          )}{" "}
          {view === "relations" && (
            <Relations
              siteName={settings.siteName}
              types={types}
              entries={entries}
              relations={relations}
              create={() => setShowRelation(true)}
              remove={removeRelation}
              update={updateRelation}
            />
          )}{" "}
          {view === "users" && (
            <Users
              users={users}
              roles={roles}
              create={(user) => {
                if (
                  users.some(
                    (item) =>
                      item.email.toLowerCase() === user.email.toLowerCase(),
                  )
                )
                  return;
                setUsers((all) => [user, ...all]);
                emitRegisteredHooks("user.created", { user });
                notify("User created");
              }}
              update={(next) => {
                setUsers((all) =>
                  all.map((user) => (user.id === next.id ? next : user)),
                );
                emitRegisteredHooks("user.updated", { user: next });
                notify("User updated");
              }}
              remove={(user) => {
                if (!window.confirm(`Delete user ${user.name}?`)) return;
                setUsers((all) => all.filter((item) => item.id !== user.id));
                setEntries((all) =>
                  all.map((entry) =>
                    entry.authorUserId === user.id
                      ? { ...entry, authorUserId: undefined }
                      : entry,
                  ),
                );
                emitRegisteredHooks("user.deleted", { userId: user.id });
                notify("User deleted");
              }}
            />
          )}{" "}
          {view === "roles" && (
            <Roles
              roles={roles}
              create={(role) => {
                if (roles.some((item) => item.slug === role.slug)) return;
                setRoles((all) => [role, ...all]);
                emitRegisteredHooks("role.created", { role });
                notify("Role created");
              }}
              update={(role) => {
                if (role.system) return;
                setRoles((all) =>
                  all.map((item) => (item.id === role.id ? role : item)),
                );
                emitRegisteredHooks("role.updated", { role });
                notify("Role updated");
              }}
              remove={(role) => {
                if (role.system) return;
                if (users.some((user) => user.role === role.slug)) {
                  notify("Role is assigned to users");
                  return;
                }
                if (!window.confirm(`Delete role ${role.name}?`)) return;
                setRoles((all) => all.filter((item) => item.id !== role.id));
                emitRegisteredHooks("role.deleted", { roleId: role.id });
                notify("Role deleted");
              }}
            />
          )}
          {view === "pages" && <PageBuilder pages={pages} templates={templates} layouts={layouts} createPage={createPage} updatePage={updatePage} removePage={removePage} createTemplate={createTemplate} updateTemplate={updateTemplate} removeTemplate={removeTemplate} createLayout={createLayout} updateLayout={updateLayout} />}
          {view === "plugins" && (
            <Plugins
              plugins={plugins}
              install={(plugin) => {
                if (plugins.some((item) => item.slug === plugin.slug)) return;
                setPlugins((all) => [plugin, ...all]);
                emitRegisteredHooks("plugin.installed", { plugin });
                notify("Plugin installed");
              }}
              remove={(plugin) => {
                if (!window.confirm(`Uninstall plugin ${plugin.name}?`)) return;
                setPlugins((all) =>
                  all.filter((item) => item.id !== plugin.id),
                );
                emitRegisteredHooks("plugin.uninstalled", { plugin });
                notify("Plugin uninstalled");
              }}
              toggle={(plugin) => {
                const updated = {
                  ...plugin,
                  status:
                    plugin.status === "Active"
                      ? ("Inactive" as const)
                      : ("Active" as const),
                };
                setPlugins((all) =>
                  all.map((item) => (item.id === plugin.id ? updated : item)),
                );
                emitRegisteredHooks("plugin.status_changed", {
                  plugin: updated,
                });
                notify(
                  updated.status === "Active"
                    ? "Plugin enabled"
                    : "Plugin disabled",
                );
              }}
              update={(plugin) => {
                setPlugins((all) => all.map((item) => item.id === plugin.id ? plugin : item));
                emitRegisteredHooks("plugin.updated", { plugin });
                notify("Plugin updated");
              }}
            />
          )}{" "}
          {view === "media" && <Media media={media} remove={removeMedia} create={createMedia} update={updateMedia} />} {" "}
          {view === "comments" && (
            <Comments comments={comments} entries={entries} update={updateComment} remove={removeComment} create={createComment} />
          )}{" "}
          {view === "menus" && <Menus menus={menus} remove={removeMenu} create={createMenu} update={updateMenu} />}
          {view === "settings" && (
            <Settings
              settings={settings}
              changePassword={async (currentPassword, password) => {
                const response = await fetch("/api/auth/password", {
                  method: "POST",
                  credentials: "same-origin",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ currentPassword, password }),
                });
                const payload = (await response.json()) as { error?: string };
                if (!response.ok) throw new Error(payload.error || "No se pudo cambiar la contraseña");
                notify("Password updated");
              }}
              save={(next) => {
                setSettings(next);
                window.localStorage.setItem(
                  "waypoint.settings",
                  JSON.stringify(next),
                );
                window.dispatchEvent(new Event("waypoint-settings-updated"));
                fetch("/api/registry/settings", {
                  method: "PUT",
                  credentials: "same-origin",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(next),
                }).catch(() => undefined);
                emitRegisteredHooks("settings.updated", { settings: next });
                notify("Settings saved");
              }}
            />
          )}
          {view === "activity" && (
            <ActivityLog revisions={revisions} entries={entries} />
          )}
        </main>
        {showEntry && (
          <EntryModal
            types={types}
            close={() => setShowEntry(false)}
            create={createEntry}
          />
        )}{" "}
        {showTaxonomy && (
          <TaxonomyModal
            close={() => setShowTaxonomy(false)}
            create={(name, slug, hierarchical) => {
              const s = slug.trim().toLowerCase();
              if (
                !/^[a-z0-9-]+$/.test(s) ||
                taxonomies.some((t) => t.slug === s)
              )
                throw Error("Slug inválido o duplicado");
              setTaxonomies((x) => [
                ...x,
                { name, slug: s, hierarchical, terms: [] },
              ]);
              setShowTaxonomy(false);
              notify("Taxonomy created");
            }}
          />
        )}{" "}
        {showTerm && (
          <TermModal
            taxonomy={taxonomies.find((t) => t.slug === termTaxonomy)}
            close={() => setShowTerm(false)}
            create={(name, slug, parent, description) =>
              createTerm(termTaxonomy, name, slug, parent, description)
            }
          />
        )}{" "}
        {showType && (
          <TypeModal
            close={() => setShowType(false)}
            create={(name, slug, fields) => {
              createContentType(name, slug, fields);
              setShowType(false);
            }}
          />
        )}{" "}
        {showRelation && (
          <RelationModal
            types={types}
            close={() => setShowRelation(false)}
            create={(name, slug, fromType, toType, cardinality) => {
              setRelations((x) => [
                ...x,
                {
                  id:
                    "rel_" +
                    Math.random().toString(16).slice(2, 8).toUpperCase(),
                  name,
                  slug,
                  fromType,
                  toType,
                  cardinality,
                },
              ]);
              setShowRelation(false);
              notify("Relation created");
            }}
          />
        )}{" "}
          {toast && (
          <div className="toast">
            <span>✓</span>
            {toast}
          </div>
        )}
        {helpOpen && (
          <div className="modal-backdrop" onClick={() => setHelpOpen(false)}>
            <div className="modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-top"><div><p className="eyebrow">WAYPOINT GUIDE</p><h2>Agent-ready workspace</h2></div><button onClick={() => setHelpOpen(false)}>×</button></div>
              <p className="subhead">Use the sidebar to manage entries, content types, taxonomies, terms, relations, users and plugins.</p>
              <p className="subhead">Agents can use the WebMCP tools to create and update structured content through the same workspace logic.</p>
              <div className="modal-actions"><button className="primary-button" onClick={() => setHelpOpen(false)}>Got it</button></div>
            </div>
          </div>
        )}
        {searchOpen && (
          <div className="modal-backdrop" onClick={() => setSearchOpen(false)}>
            <form className="modal" onSubmit={(event) => { event.preventDefault(); setView("entries"); window.dispatchEvent(new CustomEvent("waypoint-entry-search", { detail: searchQuery })); setSearchOpen(false); }} onClick={(event) => event.stopPropagation()}>
              <div className="modal-top"><div><p className="eyebrow">QUICK SEARCH</p><h2>Find content</h2></div><button type="button" onClick={() => setSearchOpen(false)}>×</button></div>
              <input autoFocus aria-label="Search entries, fields, relations" placeholder="Search entries, fields, relations…" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
              <div className="modal-actions"><button type="button" className="ghost-button" onClick={() => setSearchOpen(false)}>Cancel</button><button className="primary-button" type="submit">Search</button></div>
            </form>
          </div>
        )}
      </div>
    </>
  );
}

function AuthScreen({
  setupRequired,
  onAuthenticated,
}: {
  setupRequired: boolean;
  onAuthenticated: (user: AuthUser) => void;
}) {
  const [mode, setMode] = useState<"login" | "register" | "request" | "reset">(setupRequired ? "register" : "login");
  const [resetToken, setResetToken] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("reset");
    if (token) { setResetToken(token); setMode("reset"); }
  }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const endpoint = mode === "register" ? "register" : mode === "request" ? "reset-request" : mode === "reset" ? "reset" : "login";
      const body = mode === "request" ? { email } : mode === "reset" ? { token: resetToken, password } : { name, email, password };
      const response = await fetch(`/api/auth/${endpoint}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { user?: AuthUser; error?: string };
      if (!response.ok) throw new Error(payload.error || "No se pudo completar la solicitud");
      if (mode === "request") { setError("Si el correo existe, recibirás un enlace de recuperación."); return; }
      if (mode === "reset") { setMode("login"); setPassword(""); setError("Contraseña actualizada. Ya puedes iniciar sesión."); return; }
      if (!payload.user) throw new Error("No se pudo iniciar sesión");
      onAuthenticated(payload.user);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo iniciar sesión");
    } finally { setBusy(false); }
  };
  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <span className="brand-mark">W</span>
        <h1>{mode === "register" ? "Create your Waypoint workspace" : mode === "request" ? "Recover your password" : mode === "reset" ? "Set a new password" : "Welcome back"}</h1>
        <p>{mode === "register" ? "Set up the administrator account to begin." : "Sign in to manage your content and agent tools."}</p>
        {mode === "register" && <input aria-label="Name" placeholder="Full name" value={name} onChange={(event) => setName(event.target.value)} required />}
        {mode !== "reset" && <input aria-label="Email" type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} required />}
        {mode !== "request" && <input aria-label="Password" type="password" minLength={12} placeholder="Password (12+ characters)" value={password} onChange={(event) => setPassword(event.target.value)} required />}
        {error && <div className="auth-error">{error}</div>}
        <button className="primary-button" type="submit" disabled={busy}>{busy ? "Working…" : mode === "register" ? "Create account" : mode === "request" ? "Send recovery link" : mode === "reset" ? "Update password" : "Sign in"}</button>
        {mode === "login" && <button className="ghost-button" type="button" onClick={() => setMode("request")}>Forgot password?</button>}
        {!setupRequired && mode !== "reset" && <button className="ghost-button" type="button" onClick={() => setMode((value) => value === "register" ? "login" : "register")}>{mode === "register" ? "Already have an account? Sign in" : "First-time setup"}</button>}
      </form>
    </div>
  );
}
const label = (v: View) =>
  v === "overview" ? "Overview" : v[0].toUpperCase() + v.slice(1);
function Sidebar({
  view,
  setView,
  siteName,
  entryCount,
  currentUser,
}: {
  view: View;
  setView: (v: View) => void;
  siteName: string;
  entryCount: number;
  currentUser?: User;
}) {
  const initials = (currentUser?.name || "WS")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">W</span>
        <span>
          waypoint<small>content OS</small>
        </span>
      </div>
      <div className="workspace-switch">
        <span className="workspace-avatar">
          {siteName.slice(0, 1).toUpperCase()}
        </span>
        <span>
          <b>{siteName}</b>
          <small>Personal workspace</small>
        </span>
        <span className="chevron">⌄</span>
      </div>
      <nav>
        <p className="nav-label">Workspace</p>
        <Nav
          icon="⌂"
          text="Overview"
          active={view === "overview"}
          on={() => setView("overview")}
        />
        <Nav
          icon="▤"
          text="Entries"
          badge={String(entryCount)}
          active={view === "entries"}
          on={() => setView("entries")}
        />
        <Nav
          icon="▥"
          text="Pages"
          active={view === "pages"}
          on={() => setView("pages")}
        />
        <Nav
          icon="⌘"
          text="Schema"
          active={view === "schema"}
          on={() => setView("schema")}
        />
        <Nav
          icon="⊞"
          text="Taxonomies"
          active={view === "taxonomies"}
          on={() => setView("taxonomies")}
        />
        <Nav
          icon="↗"
          text="Relations"
          active={view === "relations"}
          on={() => setView("relations")}
        />
        <Nav
          icon="▧"
          text="Media"
          active={view === "media"}
          on={() => setView("media")}
        />
        <Nav
          icon="♧"
          text="Comments"
          active={view === "comments"}
          on={() => setView("comments")}
        />
        <Nav
          icon="☰"
          text="Menus"
          active={view === "menus"}
          on={() => setView("menus")}
        />
        <p className="nav-label nav-label-spaced">System</p>
        <Nav
          icon="♙"
          text="Users"
          active={view === "users"}
          on={() => setView("users")}
        />
        <Nav
          icon="⚿"
          text="Roles"
          active={view === "roles"}
          on={() => setView("roles")}
        />
        <Nav
          icon="▣"
          text="Plugins"
          active={view === "plugins"}
          on={() => setView("plugins")}
        />
        <Nav
          icon="✦"
          text="Agent activity"
          active={view === "activity"}
          on={() => setView("activity")}
        />
        <Nav
          icon="⚙"
          text="Settings"
          active={view === "settings"}
          on={() => setView("settings")}
        />
      </nav>
      <div className="sidebar-bottom">
        <div className="agent-status">
          <span className="pulse" />
          <span>
            <b>Agent-ready</b>
            <small>WebMCP connected</small>
          </span>
        </div>
        <div className="user-row">
          <span className="user-avatar">{initials}</span>
          <span>
            <b>{currentUser?.name || "Workspace owner"}</b>
            <small>{currentUser?.role || "Owner"}</small>
          </span>
        </div>
      </div>
    </aside>
  );
}
function Nav({
  icon,
  text,
  badge,
  active,
  on,
}: {
  icon: string;
  text: string;
  badge?: string;
  active?: boolean;
  on?: () => void;
}) {
  return (
    <button className={"nav-item " + (active ? "active" : "")} onClick={on}>
      <span>{icon}</span>
      {text}
      {badge && <em>{badge}</em>}
    </button>
  );
}
function Settings({
  settings,
  save,
  changePassword,
}: {
  settings: SiteSettings;
  save: (settings: SiteSettings) => void;
  changePassword: (currentPassword: string, password: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(settings);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  useEffect(() => setDraft(settings), [settings]);
  return (
    <div className="page">
      <div className="page-heading compact">
        <div>
          <p className="kicker">WORKSPACE CONFIGURATION</p>
          <h1>Settings</h1>
          <p className="subhead">
            Control the public identity and runtime context available to your
            content agent.
          </p>
        </div>
      </div>
      <section className="card entries-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">SITE IDENTITY</p>
            <h2>Public settings</h2>
          </div>
        </div>
        <div
          className="modal"
          style={{ width: "100%", boxShadow: "none", borderRadius: 0 }}
        >
          <label>
            Site name
            <input
              value={draft.siteName}
              onChange={(event) =>
                setDraft({ ...draft, siteName: event.target.value })
              }
            />
          </label>
          <label>
            Description
            <input
              value={draft.description}
              onChange={(event) =>
                setDraft({ ...draft, description: event.target.value })
              }
            />
          </label>
          <label>
            URL
            <input
              type="url"
              value={draft.url}
              onChange={(event) =>
                setDraft({ ...draft, url: event.target.value })
              }
            />
          </label>
          <label>
            Timezone
            <input
              value={draft.timezone}
              onChange={(event) =>
                setDraft({ ...draft, timezone: event.target.value })
              }
            />
          </label>
          <div className="modal-actions">
            <button
              className="primary-button"
              disabled={!draft.siteName.trim() || !draft.url.trim()}
              onClick={() =>
                save({
                  ...draft,
                  siteName: draft.siteName.trim(),
                  description: draft.description.trim(),
                  url: draft.url.trim().replace(/\/$/, ""),
                  timezone: draft.timezone.trim(),
                })
              }
            >
              Save settings
            </button>
          </div>
        </div>
      </section>
      <section className="card entries-card">
        <div className="card-heading"><div><p className="eyebrow">SECURITY</p><h2>Change password</h2></div></div>
        <div className="modal" style={{ width: "100%", boxShadow: "none", borderRadius: 0 }}>
          <label>Current password<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
          <label>New password<input type="password" minLength={12} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="12+ characters" /></label>
          {passwordMessage && <p className="subhead">{passwordMessage}</p>}
          <div className="modal-actions"><button className="primary-button" disabled={passwordBusy || currentPassword.length === 0 || newPassword.length < 12} onClick={async () => { setPasswordBusy(true); setPasswordMessage(""); try { await changePassword(currentPassword, newPassword); setCurrentPassword(""); setNewPassword(""); setPasswordMessage("Password updated successfully."); } catch (error) { setPasswordMessage(error instanceof Error ? error.message : "Could not update password."); } finally { setPasswordBusy(false); } }}>{passwordBusy ? "Updating…" : "Update password"}</button></div>
        </div>
      </section>
    </div>
  );
}
function Roles({
  roles,
  create,
  update,
  remove,
}: {
  roles: Role[];
  create: (role: Role) => void;
  update: (role: Role) => void;
  remove: (role: Role) => void;
}) {
  const [draft, setDraft] = useState({
    name: "",
    slug: "",
    description: "",
    capabilities: "",
  });
  const [editing, setEditing] = useState<Role>();
  const save = () => {
    const slug = draft.slug.trim().toLowerCase();
    if (!draft.name.trim() || !/^[a-z0-9-]+$/.test(slug)) return;
    create({
      id: "role_" + Math.random().toString(16).slice(2, 8).toUpperCase(),
      name: draft.name.trim(),
      slug,
      description: draft.description.trim(),
      capabilities: [
        ...new Set(
          draft.capabilities
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      ],
    });
    setDraft({ name: "", slug: "", description: "", capabilities: "" });
  };
  return (
    <div className="page">
      <div className="page-heading compact">
        <div>
          <p className="kicker">ACCESS CONTROL</p>
          <h1>Roles</h1>
          <p className="subhead">
            Reusable capability bundles for users and agent operations.
          </p>
        </div>
        <span className="live-chip">
          <i />
          {roles.length} roles
        </span>
      </div>
      <section className="card entries-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">ROLE REGISTRY</p>
            <h2>Available roles</h2>
          </div>
        </div>
        <div className="type-list">
          {roles.map((role) => (
            <div className="type-row" key={role.id}>
              <span className="entry-icon lavender">⚿</span>
              <span>
                <b>{role.name}</b>
                <small>
                  {role.slug} · {role.description || "No description"}
                </small>
              </span>
              <strong>{role.capabilities.length} capabilities</strong>
              {!role.system && (
                <>
                  <button
                    className="text-button"
                    onClick={() => setEditing(role)}
                  >
                    Edit
                  </button>
                  <button className="text-button" onClick={() => remove(role)}>
                    Delete
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </section>
      {editing && (
        <section className="card entries-card" style={{ marginTop: 16 }}>
          <div className="card-heading">
            <div>
              <p className="eyebrow">EDIT ROLE</p>
              <h2>{editing.name}</h2>
            </div>
            <button
              className="text-button"
              onClick={() => setEditing(undefined)}
            >
              Close
            </button>
          </div>
          <div
            className="modal"
            style={{ width: "100%", boxShadow: "none", borderRadius: 0 }}
          >
            <label>
              Description
              <input
                value={editing.description}
                onChange={(event) =>
                  setEditing({ ...editing, description: event.target.value })
                }
              />
            </label>
            <label>
              Capabilities
              <input
                value={editing.capabilities.join(", ")}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    capabilities: event.target.value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>
            <div className="modal-actions">
              <button
                className="primary-button"
                onClick={() => {
                  update(editing);
                  setEditing(undefined);
                }}
              >
                Save role
              </button>
            </div>
          </div>
        </section>
      )}
      <section className="card entries-card" style={{ marginTop: 16 }}>
        <div className="card-heading">
          <div>
            <p className="eyebrow">NEW ROLE</p>
            <h2>Create capability bundle</h2>
          </div>
        </div>
        <div
          className="modal"
          style={{ width: "100%", boxShadow: "none", borderRadius: 0 }}
        >
          <label>
            Name
            <input
              value={draft.name}
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
            />
          </label>
          <label>
            Slug
            <input
              value={draft.slug}
              onChange={(event) =>
                setDraft({ ...draft, slug: event.target.value })
              }
              placeholder="reviewer"
            />
          </label>
          <label>
            Description
            <input
              value={draft.description}
              onChange={(event) =>
                setDraft({ ...draft, description: event.target.value })
              }
            />
          </label>
          <label>
            Capabilities
            <input
              value={draft.capabilities}
              onChange={(event) =>
                setDraft({ ...draft, capabilities: event.target.value })
              }
              placeholder="content.read, content.review"
            />
          </label>
          <div className="modal-actions">
            <button
              className="primary-button"
              disabled={!draft.name.trim() || !draft.slug.trim()}
              onClick={save}
            >
              Create role
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
function Users({
  users,
  roles,
  create,
  update,
  remove,
}: {
  users: User[];
  roles: Role[];
  create: (user: User) => void;
  update: (user: User) => void;
  remove: (user: User) => void;
}) {
  const [editing, setEditing] = useState<User>();
  const [metadataText, setMetadataText] = useState("");
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    role: roles[0]?.slug || "",
    status: "Invited" as "Active" | "Invited",
    metadata: "{}",
  });
  const openEditor = (user: User) => {
    setEditing(user);
    setMetadataText(JSON.stringify(user.metadata || {}, null, 2));
  };
  const saveEditor = () => {
    if (!editing) return;
    let metadata: Record<string, unknown>;
    try {
      metadata = JSON.parse(metadataText || "{}");
    } catch {
      return;
    }
    if (!metadata || Array.isArray(metadata) || typeof metadata !== "object")
      return;
    update({
      ...editing,
      name: editing.name.trim(),
      email: editing.email.trim().toLowerCase(),
      metadata,
    });
    setEditing(undefined);
  };
  return (
    <div className="page">
      <div className="page-heading compact">
        <div>
          <p className="kicker">WORKSPACE ACCESS</p>
          <h1>Users</h1>
          <p className="subhead">
            People, roles and capabilities available to your content agent.
          </p>
        </div>
        <button className="primary-button" onClick={() => setCreating(true)}>
          ＋ New user
        </button>
        <span className="live-chip">
          <i />
          {users.length} members
        </span>
      </div>
      <section className="card entries-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">DIRECTORY</p>
            <h2>Workspace members</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Capabilities</th>
                <th>Metadata</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <span className="user-avatar">
                      {user.name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)}
                    </span>
                    <span className="entry-name">
                      <b>{user.name}</b>
                      <small>{user.email}</small>
                    </span>
                  </td>
                  <td>{user.role}</td>
                  <td>
                    <Status label={user.status} />
                  </td>
                  <td>{user.capabilities.length} granted</td>
                  <td>{Object.keys(user.metadata || {}).length} keys</td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => openEditor(user)}
                    >
                      Edit
                    </button>
                    <button
                      className="text-button"
                      onClick={() => remove(user)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {creating && (
        <section className="card entries-card" style={{ marginTop: 16 }}>
          <div className="card-heading">
            <div>
              <p className="eyebrow">NEW MEMBER</p>
              <h2>Invite user</h2>
            </div>
            <button className="text-button" onClick={() => setCreating(false)}>
              Close
            </button>
          </div>
          <div
            className="modal"
            style={{ width: "100%", boxShadow: "none", borderRadius: 0 }}
          >
            <label>
              Name
              <input
                value={newUser.name}
                onChange={(event) =>
                  setNewUser({ ...newUser, name: event.target.value })
                }
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={newUser.email}
                onChange={(event) =>
                  setNewUser({ ...newUser, email: event.target.value })
                }
              />
            </label>
            <label>
              Role
              <select
                value={newUser.role}
                onChange={(event) =>
                  setNewUser({ ...newUser, role: event.target.value })
                }
              >
                {roles.map((role) => (
                  <option key={role.slug} value={role.slug}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                value={newUser.status}
                onChange={(event) =>
                  setNewUser({
                    ...newUser,
                    status: event.target.value as "Active" | "Invited",
                  })
                }
              >
                <option>Invited</option>
                <option>Active</option>
              </select>
            </label>
            <label>
              Metadata (JSON)
              <textarea
                rows={5}
                value={newUser.metadata}
                onChange={(event) =>
                  setNewUser({ ...newUser, metadata: event.target.value })
                }
              />
            </label>
            <div className="modal-actions">
              <button
                className="primary-button"
                disabled={!newUser.name.trim() || !newUser.email.includes("@")}
                onClick={() => {
                  let metadata: Record<string, unknown>;
                  try {
                    metadata = JSON.parse(newUser.metadata || "{}");
                  } catch {
                    return;
                  }
                  const role =
                    roles.find((item) => item.slug === newUser.role) ||
                    roles[0];
                  if (!role) return;
                  create({
                    id:
                      "usr_" +
                      Math.random().toString(16).slice(2, 8).toUpperCase(),
                    name: newUser.name.trim(),
                    email: newUser.email.trim().toLowerCase(),
                    role: role.slug,
                    status: newUser.status,
                    capabilities: role.capabilities,
                    metadata,
                  });
                  setNewUser({
                    name: "",
                    email: "",
                    role: roles[0]?.slug || "",
                    status: "Invited",
                    metadata: "{}",
                  });
                  setCreating(false);
                }}
              >
                Create user
              </button>
            </div>
          </div>
        </section>
      )}
      {editing && (
        <section className="card entries-card" style={{ marginTop: 16 }}>
          <div className="card-heading">
            <div>
              <p className="eyebrow">USER PROFILE</p>
              <h2>Edit {editing.name}</h2>
            </div>
            <button
              className="text-button"
              onClick={() => setEditing(undefined)}
            >
              Close
            </button>
          </div>
          <div
            className="modal"
            style={{ width: "100%", boxShadow: "none", borderRadius: 0 }}
          >
            <label>
              Name
              <input
                value={editing.name}
                onChange={(event) =>
                  setEditing({ ...editing, name: event.target.value })
                }
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={editing.email}
                onChange={(event) =>
                  setEditing({ ...editing, email: event.target.value })
                }
              />
            </label>
            <label>
              Metadata (JSON)
              <textarea
                rows={7}
                value={metadataText}
                onChange={(event) => setMetadataText(event.target.value)}
              />
            </label>
            <div className="modal-actions">
              <button className="primary-button" onClick={saveEditor}>
                Save user
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
function Media({ media, remove, create, update }: { media: MediaAsset[]; remove: (asset: MediaAsset) => void; create: (asset: MediaAsset) => void; update: (asset: MediaAsset) => void }) {
  const [draft, setDraft] = useState({ name: "", url: "", alt: "" });
  const [editing, setEditing] = useState<MediaAsset>();
  return (
    <div className="page">
      <div className="page-heading compact">
        <div>
          <p className="kicker">CONTENT ASSETS</p>
          <h1>Media library</h1>
          <p className="subhead">
            Reusable files and media metadata available to your agent.
          </p>
        </div>
        <span className="live-chip">
          <i />
          {media.length} assets
        </span>
      </div>
      <section className="card entries-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">LIBRARY</p>
            <h2>Registered assets</h2>
          </div>
        </div>
        <div className="type-list">
          {media.map((asset) => (
            <div className="type-row" key={asset.id}>
              <span className="entry-icon green">
                {asset.mimeType.startsWith("image/") ? "▧" : "◫"}
              </span>
              <span>
                <b>{asset.name}</b>
                <small>
                  {asset.mimeType} ·{" "}
                  {asset.width && asset.height
                    ? `${asset.width} × ${asset.height} · `
                    : ""}
                  {asset.attachedEntryIds.length} linked entries
                </small>
              </span>
              <strong>{asset.alt || "No alt text"}</strong>
              <button className="text-button" onClick={() => setEditing(asset)}>Edit</button>
              <button className="text-button" onClick={() => remove(asset)}>Delete</button>
            </div>
          ))}
        </div>
      </section>
      {editing && <section className="card entries-card" style={{ marginTop: 16 }}><div className="card-heading"><h2>Edit media</h2><button className="text-button" onClick={() => setEditing(undefined)}>Close</button></div><div className="modal" style={{ width: "100%", boxShadow: "none", borderRadius: 0 }}><label>Name<input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label><label>URL<input value={editing.url} onChange={(event) => setEditing({ ...editing, url: event.target.value })} /></label><label>Alt text<input value={editing.alt || ""} onChange={(event) => setEditing({ ...editing, alt: event.target.value })} /></label><label>Metadata (JSON)<textarea rows={4} value={JSON.stringify(editing.metadata || {}, null, 2)} onChange={(event) => { try { setEditing({ ...editing, metadata: JSON.parse(event.target.value) }); } catch {} }} /></label><div className="modal-actions"><button className="primary-button" onClick={() => { update(editing); setEditing(undefined); }}>Save media</button></div></div></section>}
      <section className="card entries-card" style={{ marginTop: 16 }}><div className="card-heading"><div><p className="eyebrow">REGISTER ASSET</p><h2>Add media</h2></div></div><div className="modal" style={{ width: "100%", boxShadow: "none", borderRadius: 0 }}><label>Name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="cover.jpg" /></label><label>URL<input type="url" value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} placeholder="https://…" /></label><label>Alt text<input value={draft.alt} onChange={(event) => setDraft({ ...draft, alt: event.target.value })} /></label><div className="modal-actions"><button className="primary-button" disabled={!draft.name.trim() || !draft.url.trim()} onClick={() => { create({ id: "med_" + Math.random().toString(16).slice(2, 8).toUpperCase(), name: draft.name.trim(), url: draft.url.trim(), mimeType: "application/octet-stream", size: 0, alt: draft.alt.trim(), attachedEntryIds: [], createdAt: new Date().toISOString() }); setDraft({ name: "", url: "", alt: "" }); }}>Register media</button></div></div></section>
    </div>
  );
}
function Comments({
  comments,
  entries,
  update,
  remove,
  create,
}: {
  comments: Comment[];
  entries: Entry[];
  update: (comment: Comment) => void;
  remove: (comment: Comment) => void;
  create: (comment: Comment) => void;
}) {
  const [draft, setDraft] = useState({ entryId: entries[0]?.id || "", authorName: "", content: "" });
  return (
    <div className="page">
      <div className="page-heading compact">
        <div>
          <p className="kicker">COMMUNITY</p>
          <h1>Comments</h1>
          <p className="subhead">
            Review and moderate feedback before it reaches your content.
          </p>
        </div>
        <span className="live-chip">
          <i />
          {
            comments.filter((comment) => comment.status === "Pending").length
          }{" "}
          pending
        </span>
      </div>
      <section className="card entries-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">MODERATION QUEUE</p>
            <h2>Recent comments</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Comment</th>
                <th>Entry</th>
                <th>Author</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {comments.map((comment) => (
                <tr key={comment.id}>
                  <td>
                    <span className="entry-name">
                      <b>{comment.content}</b>
                      <small>{comment.id}</small>
                    </span>
                  </td>
                  <td>
                    {entries.find((entry) => entry.id === comment.entryId)
                      ?.title || comment.entryId}
                  </td>
                  <td>{comment.authorName}</td>
                  <td>
                    <Status label={comment.status} />
                    <select className="filter-button" value={comment.status} onChange={(event) => update({ ...comment, status: event.target.value as Comment["status"] })}>
                      <option>Pending</option><option>Approved</option><option>Spam</option>
                    </select>
                    <button className="text-button" onClick={() => remove(comment)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card entries-card" style={{ marginTop: 16 }}><div className="card-heading"><div><p className="eyebrow">NEW COMMENT</p><h2>Add feedback</h2></div></div><div className="modal" style={{ width: "100%", boxShadow: "none", borderRadius: 0 }}><label>Entry<select value={draft.entryId} onChange={(event) => setDraft({ ...draft, entryId: event.target.value })}>{entries.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}</select></label><label>Author<input value={draft.authorName} onChange={(event) => setDraft({ ...draft, authorName: event.target.value })} /></label><label>Comment<textarea rows={3} value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} /></label><div className="modal-actions"><button className="primary-button" disabled={!draft.entryId || !draft.authorName.trim() || !draft.content.trim()} onClick={() => { const now = new Date().toISOString(); create({ id: "cmt_" + Math.random().toString(16).slice(2, 8).toUpperCase(), entryId: draft.entryId, authorName: draft.authorName.trim(), content: draft.content.trim(), status: "Pending", createdAt: now, updatedAt: now }); setDraft({ ...draft, authorName: "", content: "" }); }}>Add comment</button></div></div></section>
    </div>
  );
}
function Menus({ menus, remove, create, update }: { menus: Menu[]; remove: (menu: Menu) => void; create: (menu: Menu) => void; update: (menu: Menu) => void }) {
  const [draft, setDraft] = useState({ name: "", slug: "", location: "header" });
  const [itemDraft, setItemDraft] = useState({ menuId: menus[0]?.id || "", label: "", url: "" });
  const [editingItem, setEditingItem] = useState<{ menu: Menu; item: MenuItem }>();
  return (
    <div className="page">
      <div className="page-heading compact">
        <div>
          <p className="kicker">SITE NAVIGATION</p>
          <h1>Menus</h1>
          <p className="subhead">
            Build ordered navigation structures your agent can maintain.
          </p>
        </div>
        <span className="live-chip">
          <i />
          {menus.length} menus
        </span>
      </div>
      <div className="taxonomy-grid">
        {menus.map((menu) => (
          <section className="card taxonomy-card" key={menu.id}>
            <div className="taxonomy-card-head">
              <span className="taxonomy-symbol">☰</span>
              <div>
                <h2>{menu.name}</h2>
                <small>
                  menu.{menu.slug} · {menu.location || "unassigned"}
                </small>
              </div>
              <button className="text-button" onClick={() => remove(menu)}>Delete</button>
            </div>
            <div className="terms-list">
              {menu.items
                .sort((a, b) => a.order - b.order)
                .map((item) => (
                  <div
                    className={"term-row " + (item.parentId ? "child" : "")}
                    key={item.id}
                  >
                    <span className="term-branch">
                      {item.parentId ? "└" : "•"}
                    </span>
                    <span>
                      <b>{item.label}</b>
                    <small>{item.entryId || item.url}</small>
                  </span>
                  <span className="term-count">#{item.order + 1}</span>
                  <button className="text-button" onClick={() => setEditingItem({ menu, item })}>Edit</button>
                  <button className="text-button" onClick={() => update({ ...menu, items: menu.items.filter((candidate) => candidate.id !== item.id) })}>Delete</button>
                  </div>
                ))}
            </div>
          </section>
        ))}
      </div>
      {editingItem && <section className="card entries-card" style={{ marginTop: 16 }}><div className="card-heading"><h2>Edit menu item</h2><button className="text-button" onClick={() => setEditingItem(undefined)}>Close</button></div><div className="modal" style={{ width: "100%", boxShadow: "none", borderRadius: 0 }}><label>Label<input value={editingItem.item.label} onChange={(event) => setEditingItem({ ...editingItem, item: { ...editingItem.item, label: event.target.value } })} /></label><label>URL<input value={editingItem.item.url || ""} onChange={(event) => setEditingItem({ ...editingItem, item: { ...editingItem.item, url: event.target.value } })} /></label><div className="modal-actions"><button className="primary-button" onClick={() => { update({ ...editingItem.menu, items: editingItem.menu.items.map((item) => item.id === editingItem.item.id ? editingItem.item : item) }); setEditingItem(undefined); }}>Save item</button></div></div></section>}
      <section className="card entries-card" style={{ marginTop: 16 }}><div className="card-heading"><h2>Add menu item</h2></div><div className="modal" style={{ width: "100%", boxShadow: "none", borderRadius: 0 }}><label>Menu<select value={itemDraft.menuId} onChange={(event) => setItemDraft({ ...itemDraft, menuId: event.target.value })}>{menus.map((menu) => <option key={menu.id} value={menu.id}>{menu.name}</option>)}</select></label><label>Label<input value={itemDraft.label} onChange={(event) => setItemDraft({ ...itemDraft, label: event.target.value })} /></label><label>URL<input value={itemDraft.url} onChange={(event) => setItemDraft({ ...itemDraft, url: event.target.value })} placeholder="/about" /></label><div className="modal-actions"><button className="primary-button" disabled={!itemDraft.menuId || !itemDraft.label.trim() || !itemDraft.url.trim()} onClick={() => { const menu = menus.find((candidate) => candidate.id === itemDraft.menuId); if (!menu) return; update({ ...menu, items: [...menu.items, { id: "mi_" + Math.random().toString(16).slice(2, 8).toUpperCase(), label: itemDraft.label.trim(), url: itemDraft.url.trim(), order: menu.items.length }] }); setItemDraft({ ...itemDraft, label: "", url: "" }); }}>Add item</button></div></div></section>
      <section className="card entries-card" style={{ marginTop: 16 }}><div className="card-heading"><div><p className="eyebrow">NEW MENU</p><h2>Create navigation</h2></div></div><div className="modal" style={{ width: "100%", boxShadow: "none", borderRadius: 0 }}><label>Name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label>Slug<input value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: event.target.value })} /></label><label>Location<input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} /></label><div className="modal-actions"><button className="primary-button" disabled={!draft.name.trim() || !draft.slug.trim()} onClick={() => { create({ id: "menu_" + Math.random().toString(16).slice(2, 8).toUpperCase(), name: draft.name.trim(), slug: draft.slug.trim(), location: draft.location.trim(), items: [] }); setDraft({ name: "", slug: "", location: "header" }); }}>Create menu</button></div></div></section>
    </div>
  );
}
function PageBuilder({
  pages, templates, layouts, createPage, updatePage, removePage, createTemplate, updateTemplate, removeTemplate, createLayout, updateLayout,
}: {
  pages: VisualPage[]; templates: PageTemplate[]; layouts: PageLayout[];
  createPage: (page: VisualPage) => void; updatePage: (page: VisualPage) => void; removePage: (page: VisualPage) => void;
  createTemplate: (template: PageTemplate) => void; updateTemplate: (template: PageTemplate) => void; removeTemplate: (template: PageTemplate) => void;
  createLayout: (layout: PageLayout) => void; updateLayout: (layout: PageLayout) => void;
}) {
  const [selectedId, setSelectedId] = useState(pages[0]?.id || "");
  const [newBlock, setNewBlock] = useState<PageBlock["type"]>("text");
  const [blockText, setBlockText] = useState("");
  const [editingBlock, setEditingBlock] = useState<PageBlock>();
  const [previewWidth, setPreviewWidth] = useState("1180px");
  const [templateName, setTemplateName] = useState("");
  const [layoutDraft, setLayoutDraft] = useState<PageLayout>(layouts[0] || { id: "", name: "", slug: "", regions: ["header", "main", "footer"], rules: { fontFamily: "Inter", headingScale: "1.2", accent: "#D7FF4F", maxWidth: "1180px", spacing: "24px", radius: "18px" } });
  const page = pages.find((item) => item.id === selectedId) || pages[0];
  const changePage = (next: VisualPage) => { updatePage({ ...next, updatedAt: new Date().toISOString() }); setSelectedId(next.id); };
  const addBlock = () => { if (!page || !blockText.trim()) return; changePage({ ...page, blocks: [...page.blocks, { id: "blk_" + Math.random().toString(16).slice(2, 8).toUpperCase(), type: newBlock, content: blockText.trim(), settings: newBlock === "button" ? { url: "/" } : undefined }] }); setBlockText(""); };
  const createBlankPage = () => { const now = new Date().toISOString(); const next: VisualPage = { id: "page_" + Math.random().toString(16).slice(2, 8).toUpperCase(), title: "Untitled page", slug: "untitled-page", status: "Draft", blocks: [], updatedAt: now }; createPage(next); setSelectedId(next.id); };
  const createFromTemplate = (template: PageTemplate) => { const now = new Date().toISOString(); const next: VisualPage = { id: "page_" + Math.random().toString(16).slice(2, 8).toUpperCase(), title: template.name, slug: template.slug + "-page", status: "Draft", templateId: template.id, blocks: template.blocks.map((block) => ({ ...block, id: "blk_" + Math.random().toString(16).slice(2, 8).toUpperCase() })), updatedAt: now }; createPage(next); setSelectedId(next.id); };
  const saveTemplate = () => { if (!page || !templateName.trim()) return; createTemplate({ id: "tpl_" + Math.random().toString(16).slice(2, 8).toUpperCase(), name: templateName.trim(), slug: templateName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), description: "Saved from the visual editor.", blocks: page.blocks, layoutId: layoutDraft.id || undefined }); setTemplateName(""); };
  const previewBlock = (block: PageBlock) => block.type === "button" ? <a className="visual-preview-button" href={String(block.settings?.url || "#")} onClick={(event) => event.preventDefault()}>{block.content}</a> : block.type === "image" ? <img className="visual-preview-image" src={block.content} alt={String(block.settings?.alt || "")} /> : block.type === "divider" ? <hr /> : <div className={block.settings?.variant === "hero" ? "visual-preview-hero" : "visual-preview-copy"}>{block.content}</div>;
  return <div className="page">
    <div className="page-heading compact"><div><p className="kicker">VISUAL STUDIO</p><h1>Pages</h1><p className="subhead">Compose pages with reusable blocks, layouts and design rules.</p></div><button className="primary-button" onClick={createBlankPage}>＋ New page</button></div>
    <div className="content-grid">
      <section className="card entries-card"><div className="card-heading"><div><p className="eyebrow">PAGE LIBRARY</p><h2>{pages.length} pages</h2></div></div>{pages.map((item) => <div className="type-row" key={item.id} onClick={() => setSelectedId(item.id)} style={{ cursor: "pointer", outline: item.id === page?.id ? "2px solid #D7FF4F" : undefined }}><span className="entry-icon yellow">▥</span><span><b>{item.title}</b><small>/{item.slug} · {item.blocks.length} blocks</small></span><span className="status">{item.status}</span><button className="text-button" onClick={(event) => { event.stopPropagation(); removePage(item); }}>Delete</button></div>)}</section>
      <section className="card entries-card"><div className="card-heading"><div><p className="eyebrow">CANVAS</p><h2>{page?.title || "Select a page"}</h2></div>{page && <select value={page.status} onChange={(event) => changePage({ ...page, status: event.target.value as VisualPage["status"] })}><option>Draft</option><option>Published</option><option>Archived</option></select>}</div>{page && <><div className="modal" style={{ width: "100%", boxShadow: "none", borderRadius: 0 }}><label>Page title<input value={page.title} onChange={(event) => changePage({ ...page, title: event.target.value })} /></label><label>Slug<input value={page.slug} onChange={(event) => changePage({ ...page, slug: event.target.value })} /></label></div><div className="terms-list">{page.blocks.map((block, index) => <div className="term-row" key={block.id}><span className="term-count">{index + 1}</span><span><b>{block.type}</b><small>{block.content}</small></span><button className="text-button" onClick={() => setEditingBlock(block)}>Edit</button><button className="text-button" onClick={() => changePage({ ...page, blocks: page.blocks.filter((item) => item.id !== block.id) })}>Delete</button></div>)}</div>{editingBlock && <div className="modal" style={{ width: "100%", boxShadow: "none", borderRadius: 0 }}><label>Edit block content<textarea rows={4} value={editingBlock.content} onChange={(event) => setEditingBlock({ ...editingBlock, content: event.target.value })} /></label><div className="modal-actions"><button className="ghost-button" onClick={() => setEditingBlock(undefined)}>Cancel</button><button className="primary-button" onClick={() => { changePage({ ...page, blocks: page.blocks.map((item) => item.id === editingBlock.id ? editingBlock : item) }); setEditingBlock(undefined); }}>Save block</button></div></div>}<div className="modal" style={{ width: "100%", boxShadow: "none", borderRadius: 0 }}><label>New block<select value={newBlock} onChange={(event) => setNewBlock(event.target.value as PageBlock["type"])}><option value="text">Text</option><option value="image">Image</option><option value="button">Button</option><option value="columns">Columns</option><option value="divider">Divider</option><option value="html">Safe HTML</option></select></label><label>Content<input value={blockText} onChange={(event) => setBlockText(event.target.value)} placeholder="Write the block content…" /></label><button className="primary-button" disabled={!blockText.trim()} onClick={addBlock}>＋ Add block</button></div></>}</section>
    </div>
    <section className="card visual-preview-card" style={{ marginTop: 16 }}><div className="card-heading"><div><p className="eyebrow">LIVE PREVIEW</p><h2>Responsive canvas</h2></div><div className="preview-device-pills"><button className={previewWidth === "1180px" ? "selected" : ""} onClick={() => setPreviewWidth("1180px")}>Desktop</button><button className={previewWidth === "768px" ? "selected" : ""} onClick={() => setPreviewWidth("768px")}>Tablet</button><button className={previewWidth === "390px" ? "selected" : ""} onClick={() => setPreviewWidth("390px")}>Mobile</button></div></div><div className="visual-preview" style={{ maxWidth: previewWidth }}>{page?.blocks.length ? page.blocks.map((block) => <div key={block.id} className="visual-preview-block">{previewBlock(block)}</div>) : <p className="subhead">Add a block to see the page preview.</p>}</div></section>
    <div className="lower-grid" style={{ marginTop: 16 }}><section className="card relation-card"><div className="card-heading"><div><p className="eyebrow">TEMPLATES</p><h2>Reusable patterns</h2></div></div>{templates.map((template) => <div className="taxonomy-summary" key={template.id}><div><b>{template.name}</b><small>{template.blocks.length} blocks · {template.description}</small></div><button className="text-button" onClick={() => page && updateTemplate({ ...template, blocks: page.blocks })}>Update</button><button className="text-button" onClick={() => removeTemplate(template)}>Delete</button><button className="text-button" onClick={() => createFromTemplate(template)}>Use</button></div>)}<div className="modal" style={{ width: "100%", boxShadow: "none", borderRadius: 0 }}><label>Save current page as template<input value={templateName} onChange={(event) => setTemplateName(event.target.value)} /></label><button className="primary-button" disabled={!page || !templateName.trim()} onClick={saveTemplate}>Save template</button></div></section><section className="card relation-card"><div className="card-heading"><div><p className="eyebrow">LAYOUT RULES</p><h2>{layoutDraft.name || "Design system"}</h2></div></div><div className="modal" style={{ width: "100%", boxShadow: "none", borderRadius: 0 }}><label>Font<input value={layoutDraft.rules.fontFamily} onChange={(event) => setLayoutDraft({ ...layoutDraft, rules: { ...layoutDraft.rules, fontFamily: event.target.value } })} /></label><label>Accent color<input type="color" value={layoutDraft.rules.accent} onChange={(event) => setLayoutDraft({ ...layoutDraft, rules: { ...layoutDraft.rules, accent: event.target.value } })} /></label><label>Max width<input value={layoutDraft.rules.maxWidth} onChange={(event) => setLayoutDraft({ ...layoutDraft, rules: { ...layoutDraft.rules, maxWidth: event.target.value } })} /></label><label>Spacing<input value={layoutDraft.rules.spacing} onChange={(event) => setLayoutDraft({ ...layoutDraft, rules: { ...layoutDraft.rules, spacing: event.target.value } })} /></label><div className="modal-actions"><button className="primary-button" onClick={() => { const next = { ...layoutDraft, id: layoutDraft.id || "layout_" + Math.random().toString(16).slice(2, 8).toUpperCase(), name: layoutDraft.name || "Custom layout", slug: layoutDraft.slug || "custom-layout" }; (layoutDraft.id ? updateLayout(next) : createLayout(next)); setLayoutDraft(next); }}>Save layout rules</button></div></div></section></div>
  </div>;
}
function Plugins({
  plugins,
  install,
  remove,
  toggle,
  update,
}: {
  plugins: Plugin[];
  install: (plugin: Plugin) => void;
  remove: (plugin: Plugin) => void;
  toggle: (plugin: Plugin) => void;
  update: (plugin: Plugin) => void;
}) {
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [editingPlugin, setEditingPlugin] = useState<Plugin>();
  const [editingHook, setEditingHook] = useState<Hook>();
  const [editingAction, setEditingAction] = useState<Action>();
  const [hookName, setHookName] = useState("");
  const [hookEvent, setHookEvent] = useState("content.changed");
  const [actionName, setActionName] = useState("");
  const [actionLabel, setActionLabel] = useState("");
  const [pluginDraft, setPluginDraft] = useState({
    name: "",
    slug: "",
    version: "1.0.0",
    author: "",
    capabilities: "",
  });
  const persistRegistry = (kind: "hooks" | "actions", value: Hook[] | Action[]) => {
    window.localStorage.setItem(`waypoint.${kind}`, JSON.stringify(value));
    fetch(`/api/registry/${kind}`, {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    }).catch(() => undefined);
    window.dispatchEvent(new Event("waypoint-model-updated"));
  };
  useEffect(() => {
    const sync = () => {
      try {
        setHooks(
          JSON.parse(window.localStorage.getItem("waypoint.hooks") || "[]"),
        );
        setActions(
          JSON.parse(window.localStorage.getItem("waypoint.actions") || "[]"),
        );
      } catch {
        setHooks([]);
        setActions([]);
      }
    };
    sync();
    fetch("/api/registry/hooks", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        const remote = payload as { data?: Hook[] } | null;
        if (Array.isArray(remote?.data)) setHooks(remote.data);
      })
      .catch(() => undefined);
    fetch("/api/registry/actions", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        const remote = payload as { data?: Action[] } | null;
        if (Array.isArray(remote?.data)) setActions(remote.data);
      })
      .catch(() => undefined);
    window.addEventListener("waypoint-model-updated", sync);
    return () => window.removeEventListener("waypoint-model-updated", sync);
  }, []);
  const registerHook = () => {
    if (!hookName.trim() || hooks.some((hook) => hook.name === hookName.trim()))
      return;
    const hook: Hook = {
      id: "hook_" + Math.random().toString(16).slice(2, 8).toUpperCase(),
      name: hookName.trim(),
      event: hookEvent,
      priority: 10,
      enabled: true,
    };
    persistRegistry("hooks", [...hooks, hook]);
    setHookName("");
  };
  const registerAction = () => {
    if (
      !actionName.trim() ||
      !actionLabel.trim() ||
      actions.some((action) => action.name === actionName.trim())
    )
      return;
    const action: Action = {
      id: "act_" + Math.random().toString(16).slice(2, 8).toUpperCase(),
      name: actionName.trim(),
      label: actionLabel.trim(),
      description: actionLabel.trim(),
      capabilities: [],
    };
    persistRegistry("actions", [...actions, action]);
    setActionName("");
    setActionLabel("");
  };
  const toggleHook = (hook: Hook) => {
    persistRegistry(
      "hooks",
      hooks.map((item) =>
        item.id === hook.id ? { ...item, enabled: !item.enabled } : item,
      ),
    );
  };
  const removeHook = (hook: Hook) => {
    if (!window.confirm(`Remove hook ${hook.name}?`)) return;
    persistRegistry("hooks", hooks.filter((item) => item.id !== hook.id));
  };
  const removeAction = (action: Action) => {
    if (!window.confirm(`Remove action ${action.label}?`)) return;
    persistRegistry("actions", actions.filter((item) => item.id !== action.id));
  };
  const installPlugin = () => {
    const slug = pluginDraft.slug.trim().toLowerCase();
    if (
      !pluginDraft.name.trim() ||
      !/^[a-z0-9-]+$/.test(slug) ||
      !pluginDraft.version.trim() ||
      !pluginDraft.author.trim()
    )
      return;
    install({
      id: "plg_" + Math.random().toString(16).slice(2, 8).toUpperCase(),
      name: pluginDraft.name.trim(),
      slug,
      version: pluginDraft.version.trim(),
      author: pluginDraft.author.trim(),
      description: "Declarative plugin manifest",
      status: "Inactive",
      capabilities: [
        ...new Set(
          pluginDraft.capabilities
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      ],
    });
    setPluginDraft({
      name: "",
      slug: "",
      version: "1.0.0",
      author: "",
      capabilities: "",
    });
  };
  return (
    <div className="page">
      <div className="page-heading compact">
        <div>
          <p className="kicker">EXTENSIONS</p>
          <h1>Plugins</h1>
          <p className="subhead">
            Declarative capabilities that extend the content model safely.
          </p>
        </div>
        <span className="live-chip">
          <i />
          {plugins.filter((plugin) => plugin.status === "Active").length} active
        </span>
      </div>
      <section className="card entries-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">PLUGIN REGISTRY</p>
            <h2>Installed manifests</h2>
          </div>
        </div>
        <div className="type-list">
          {plugins.map((plugin) => (
            <div className="type-row" key={plugin.id}>
              <span className="entry-icon lavender">✦</span>
              <span>
                <b>{plugin.name}</b>
                <small>
                  {plugin.slug} · v{plugin.version} · {plugin.author}
                </small>
              </span>
              <span className={"status " + plugin.status.toLowerCase()}>
                <i />
                {plugin.status}
              </span>
              <strong>{plugin.capabilities.length} caps</strong>
              <button className="text-button" onClick={() => setEditingPlugin(plugin)}>
                Edit
              </button>
              <button className="text-button" onClick={() => toggle(plugin)}>
                {plugin.status === "Active" ? "Disable" : "Enable"}
              </button>
              <button className="text-button" onClick={() => remove(plugin)}>
                Uninstall
              </button>
            </div>
          ))}
        </div>
      </section>
      <div className="lower-grid" style={{ marginTop: 16 }}>
        <section className="card relation-card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">EVENT SUBSCRIPTIONS</p>
              <h2>Hooks</h2>
            </div>
            <span className="live-chip">
              <i />
              {hooks.filter((hook) => hook.enabled).length} enabled
            </span>
          </div>
          {hooks.length ? (
            hooks.map((hook) => (
              <div className="taxonomy-summary" key={hook.id}>
                <span className="taxonomy-symbol">↗</span>
                <div>
                  <b>{hook.name}</b>
                  <small>
                    {hook.event} · priority {hook.priority}
                  </small>
                </div>
                <span className={hook.enabled ? "live-chip" : "status"}>
                  {hook.enabled ? "Enabled" : "Disabled"}
                </span>
                <button
                  className="text-button"
                  onClick={() => toggleHook(hook)}
                >
                  {hook.enabled ? "Disable" : "Enable"}
                </button>
                <button className="text-button" onClick={() => setEditingHook(hook)}>
                  Edit
                </button>
                <button
                  className="text-button"
                  onClick={() => removeHook(hook)}
                >
                  Remove
                </button>
              </div>
            ))
          ) : (
            <p className="subhead" style={{ padding: "0 21px 20px" }}>
              No hooks registered yet.
            </p>
          )}
        </section>
        <section className="card relation-card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">DECLARATIVE COMMANDS</p>
              <h2>Actions</h2>
            </div>
            <span className="live-chip">
              <i />
              {actions.length} registered
            </span>
          </div>
          {actions.length ? (
            actions.map((action) => (
              <div className="taxonomy-summary" key={action.id}>
                <span className="taxonomy-symbol">✦</span>
                <div>
                  <b>{action.label}</b>
                  <small>
                    {action.name} · {(action.capabilities || []).length}{" "}
                    capabilities
                  </small>
                </div>
                <button className="text-button" onClick={() => setEditingAction(action)}>
                  Edit
                </button>
                <button
                  className="text-button"
                  onClick={() => removeAction(action)}
                >
                  Remove
                </button>
              </div>
            ))
          ) : (
            <p className="subhead" style={{ padding: "0 21px 20px" }}>
              No actions registered yet.
            </p>
          )}
        </section>
      </div>
      {editingPlugin && <section className="card entries-card" style={{ marginTop: 16 }}><div className="card-heading"><div><p className="eyebrow">PLUGIN MANIFEST</p><h2>Edit {editingPlugin.name}</h2></div><button className="text-button" onClick={() => setEditingPlugin(undefined)}>Close</button></div><div className="modal" style={{ width: "100%", boxShadow: "none", borderRadius: 0 }}><label>Name<input value={editingPlugin.name} onChange={(event) => setEditingPlugin({ ...editingPlugin, name: event.target.value })} /></label><label>Version<input value={editingPlugin.version} onChange={(event) => setEditingPlugin({ ...editingPlugin, version: event.target.value })} /></label><label>Author<input value={editingPlugin.author} onChange={(event) => setEditingPlugin({ ...editingPlugin, author: event.target.value })} /></label><label>Description<textarea rows={3} value={editingPlugin.description} onChange={(event) => setEditingPlugin({ ...editingPlugin, description: event.target.value })} /></label><label>Capabilities<input value={editingPlugin.capabilities.join(", ")} onChange={(event) => setEditingPlugin({ ...editingPlugin, capabilities: [...new Set(event.target.value.split(",").map((value) => value.trim()).filter(Boolean))] })} /></label><div className="modal-actions"><button className="primary-button" onClick={() => { update(editingPlugin); setEditingPlugin(undefined); }}>Save plugin</button></div></div></section>}
      {editingHook && <section className="card entries-card" style={{ marginTop: 16 }}><div className="card-heading"><h2>Edit hook</h2><button className="text-button" onClick={() => setEditingHook(undefined)}>Close</button></div><div className="modal" style={{ width: "100%", boxShadow: "none", borderRadius: 0 }}><label>Name<input value={editingHook.name} onChange={(event) => setEditingHook({ ...editingHook, name: event.target.value })} /></label><label>Event<input value={editingHook.event} onChange={(event) => setEditingHook({ ...editingHook, event: event.target.value })} /></label><label>Priority<input type="number" value={editingHook.priority} onChange={(event) => setEditingHook({ ...editingHook, priority: Number(event.target.value) || 0 })} /></label><label>Description<textarea rows={3} value={editingHook.description || ""} onChange={(event) => setEditingHook({ ...editingHook, description: event.target.value })} /></label><div className="modal-actions"><button className="primary-button" onClick={() => { persistRegistry("hooks", hooks.map((item) => item.id === editingHook.id ? editingHook : item)); setEditingHook(undefined); }}>Save hook</button></div></div></section>}
      {editingAction && <section className="card entries-card" style={{ marginTop: 16 }}><div className="card-heading"><h2>Edit action</h2><button className="text-button" onClick={() => setEditingAction(undefined)}>Close</button></div><div className="modal" style={{ width: "100%", boxShadow: "none", borderRadius: 0 }}><label>Label<input value={editingAction.label} onChange={(event) => setEditingAction({ ...editingAction, label: event.target.value })} /></label><label>Description<textarea rows={3} value={editingAction.description} onChange={(event) => setEditingAction({ ...editingAction, description: event.target.value })} /></label><label>Capabilities<input value={(editingAction.capabilities || []).join(", ")} onChange={(event) => setEditingAction({ ...editingAction, capabilities: [...new Set(event.target.value.split(",").map((value) => value.trim()).filter(Boolean))] })} /></label><div className="modal-actions"><button className="primary-button" onClick={() => { persistRegistry("actions", actions.map((item) => item.id === editingAction.id ? editingAction : item)); setEditingAction(undefined); }}>Save action</button></div></div></section>}
      <section className="card entries-card" style={{ marginTop: 16 }}>
        <div className="card-heading">
          <div>
            <p className="eyebrow">NEW MANIFEST</p>
            <h2>Install declarative plugin</h2>
          </div>
        </div>
        <div
          className="modal"
          style={{ width: "100%", boxShadow: "none", borderRadius: 0 }}
        >
          <label>
            Name
            <input
              value={pluginDraft.name}
              onChange={(event) =>
                setPluginDraft({ ...pluginDraft, name: event.target.value })
              }
              placeholder="Editorial tools"
            />
          </label>
          <label>
            Slug
            <input
              value={pluginDraft.slug}
              onChange={(event) =>
                setPluginDraft({ ...pluginDraft, slug: event.target.value })
              }
              placeholder="editorial-tools"
            />
          </label>
          <label>
            Version
            <input
              value={pluginDraft.version}
              onChange={(event) =>
                setPluginDraft({ ...pluginDraft, version: event.target.value })
              }
            />
          </label>
          <label>
            Author
            <input
              value={pluginDraft.author}
              onChange={(event) =>
                setPluginDraft({ ...pluginDraft, author: event.target.value })
              }
              placeholder="Your team"
            />
          </label>
          <label>
            Capabilities
            <input
              value={pluginDraft.capabilities}
              onChange={(event) =>
                setPluginDraft({
                  ...pluginDraft,
                  capabilities: event.target.value,
                })
              }
              placeholder="content.extend, tools.register"
            />
          </label>
          <div className="modal-actions">
            <button
              className="primary-button"
              disabled={
                !pluginDraft.name.trim() ||
                !pluginDraft.slug.trim() ||
                !pluginDraft.author.trim()
              }
              onClick={installPlugin}
            >
              Install plugin
            </button>
          </div>
        </div>
      </section>
      <div className="lower-grid" style={{ marginTop: 16 }}>
        <section className="card relation-card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">NEW SUBSCRIPTION</p>
              <h2>Register hook</h2>
            </div>
          </div>
          <div
            className="modal"
            style={{ width: "100%", boxShadow: "none", borderRadius: 0 }}
          >
            <label>
              Name
              <input
                value={hookName}
                onChange={(event) => setHookName(event.target.value)}
                placeholder="e.g. notify_editor"
              />
            </label>
            <label>
              Event
              <select
                value={hookEvent}
                onChange={(event) => setHookEvent(event.target.value)}
              >
                {[
                  "content.changed",
                  "entry.created",
                  "content_type.created",
                  "user.updated",
                  "plugin.status_changed",
                  "settings.updated",
                ].map((event) => (
                  <option key={event}>{event}</option>
                ))}
              </select>
            </label>
            <div className="modal-actions">
              <button
                className="primary-button"
                disabled={!hookName.trim()}
                onClick={registerHook}
              >
                Register hook
              </button>
            </div>
          </div>
        </section>
        <section className="card relation-card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">NEW COMMAND</p>
              <h2>Register action</h2>
            </div>
          </div>
          <div
            className="modal"
            style={{ width: "100%", boxShadow: "none", borderRadius: 0 }}
          >
            <label>
              Internal name
              <input
                value={actionName}
                onChange={(event) => setActionName(event.target.value)}
                placeholder="e.g. refresh_cache"
              />
            </label>
            <label>
              Label
              <input
                value={actionLabel}
                onChange={(event) => setActionLabel(event.target.value)}
                placeholder="Refresh cache"
              />
            </label>
            <div className="modal-actions">
              <button
                className="primary-button"
                disabled={!actionName.trim() || !actionLabel.trim()}
                onClick={registerAction}
              >
                Register action
              </button>
            </div>
          </div>
        </section>
      </div>
      <div className="health-note">
        <span>ⓘ</span>
        <p>
          <b>Safe registry mode</b>
          <small>
            Plugins declare capabilities here; external code is never executed
            by the browser.
          </small>
        </p>
      </div>
    </div>
  );
}
function Icon({ type }: { type: ContentType }) {
  return <span className={"entry-icon " + type.tone}>{type.icon}</span>;
}
function Overview({
  types,
  entries,
  relations,
  taxonomies,
  revisions,
  currentUser,
  go,
  create,
}: {
  types: ContentType[];
  entries: Entry[];
  relations: Relation[];
  taxonomies: Taxonomy[];
  revisions: Revision[];
  currentUser?: User;
  go: (v: View) => void;
  create: () => void;
}) {
  const recent = revisions.slice(-3).reverse();
  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
    .format(new Date())
    .toUpperCase();
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="kicker">{today}</p>
          <h1>
            Good morning, {currentUser?.name || "there"} <span>✦</span>
          </h1>
          <p className="subhead">
            Your content model is healthy. Here’s what’s happening across the
            workspace.
          </p>
        </div>
        <button className="ghost-button" onClick={create}>
          ＋ Create entry
        </button>
      </div>
      <div className="stat-grid">
        <Stat
          value={String(entries.length)}
          label="Loaded entries"
          trend="Persisted locally"
          icon="▤"
        />
        <Stat
          value={String(types.length)}
          label="Content types"
          trend="All healthy"
          icon="⌘"
        />
        <Stat
          value={String(relations.length)}
          label="Relations"
          trend="Live model"
          icon="↗"
        />
      </div>
      <div className="content-grid">
        <section className="card">
          <CardHead
            eyebrow="RECENTLY UPDATED"
            title="Keep the story moving"
            action="View all ↗"
            onClick={() => go("entries")}
          />
          <Table entries={entries.slice(0, 3)} types={types} />
        </section>
        <section className="card activity-card">
          <CardHead eyebrow="AGENT ACTIVITY" title="Recent changes" />
          <div className="activity-list">
            {recent.length ? (
              recent.map((revision) => (
                <Activity
                  key={revision.id}
                  icon="✦"
                  title={revision.action.replaceAll("_", " ")}
                  detail={revision.after.title}
                  time={new Date(revision.createdAt).toLocaleString()}
                />
              ))
            ) : (
              <p className="subhead">No tracked changes yet.</p>
            )}
          </div>
          <button className="activity-footer" onClick={() => go("entries")}>
            Open entries <span>↗</span>
          </button>
        </section>
      </div>
      <div className="lower-grid">
        <section className="card">
          <CardHead
            eyebrow="CONTENT MODEL"
            title="Your building blocks"
            action="Manage schema ↗"
            onClick={() => go("schema")}
          />
          <div className="type-list">
            {types.map((t) => (
              <button
                className="type-row"
                key={t.slug}
                onClick={() => go("schema")}
              >
                <Icon type={t} />
                <span>
                  <b>{t.name}</b>
                  <small>{t.desc}</small>
                </span>
                <strong>
                  {
                    entries.filter(
                      (entry) => entry.type === t.name && !entry.deletedAt,
                    ).length
                  }
                </strong>
                <span className="row-arrow">→</span>
              </button>
            ))}
          </div>
        </section>
        <section className="card relation-card">
          <CardHead
            eyebrow="TAXONOMIES"
            title="Organize meaning"
            action="Explore ↗"
            onClick={() => go("taxonomies")}
          />
          {taxonomies.length ? (
            taxonomies.slice(0, 2).map((taxonomy, index) => (
              <div className="taxonomy-summary" key={taxonomy.slug}>
                <span className="taxonomy-symbol">{index ? "#" : "⊞"}</span>
                <div>
                  <b>{taxonomy.name}</b>
                  <small>
                    {taxonomy.terms.length} terms ·{" "}
                    {taxonomy.hierarchical ? "hierarchical" : "flat"}
                  </small>
                </div>
                <span className="live-chip">
                  <i />
                  Synced
                </span>
              </div>
            ))
          ) : (
            <div className="taxonomy-summary">
              <span className="taxonomy-symbol">⊞</span>
              <div>
                <b>No taxonomies</b>
                <small>Create one for agent classification</small>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
function CardHead({
  eyebrow,
  title,
  action,
  onClick,
}: {
  eyebrow: string;
  title: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="card-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {action && (
        <button className="text-button" onClick={onClick}>
          {action}
        </button>
      )}
    </div>
  );
}
function Stat({
  value,
  label,
  trend,
  icon,
  warn,
}: {
  value: string;
  label: string;
  trend: string;
  icon: string;
  warn?: boolean;
}) {
  return (
    <div className="stat card">
      <span className="stat-icon">{icon}</span>
      <div>
        <strong>{value}</strong>
        <p>{label}</p>
        <small className={warn ? "warning" : ""}>
          {warn ? "● " : "↗ "}
          {trend}
        </small>
      </div>
    </div>
  );
}
function relativeTime(value?: string) {
  if (!value) return "—";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  const seconds = Math.round((timestamp - Date.now()) / 1000);
  const divisions: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.34524, "week"],
    [12, "month"],
  ];
  let amount = seconds;
  let unit: Intl.RelativeTimeFormatUnit = "second";
  for (const [threshold, nextUnit] of divisions) {
    if (Math.abs(amount) < threshold) break;
    amount = Math.round(amount / threshold);
    unit = nextUnit;
  }
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
    amount,
    unit,
  );
}
function Table({
  entries,
  types,
  onSelect,
}: {
  entries: Entry[];
  types: ContentType[];
  onSelect?: (entry: Entry) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Entry</th>
            <th>Type</th>
            <th>Status</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const slug = e.slug || e.title.toLowerCase().replaceAll(" ", "-");
            return (
              <tr key={e.id} onClick={() => onSelect?.(e)}>
                <td>
                  <Icon
                    type={types.find((t) => t.name === e.type) || types[0]}
                  />
                  <span className="entry-name">
                    <b>{e.title}</b>
                    <small>
                      {e.id} · /{e.type.toLowerCase()}/{slug}
                    </small>
                  </span>
                </td>
                <td>{e.type}</td>
                <td>
                  <Status label={e.status} />
                </td>
                <td>{relativeTime(e.updatedAt || e.updated)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
function Status({ label }: { label: string }) {
  return (
    <span className={"status " + label.toLowerCase()}>
      <i />
      {label}
    </span>
  );
}
function ActivityLog({
  revisions,
  entries,
}: {
  revisions: Revision[];
  entries: Entry[];
}) {
  const ordered = revisions
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <div className="page">
      <div className="page-heading compact">
        <div>
          <p className="kicker">AUDIT TRAIL</p>
          <h1>Agent activity</h1>
          <p className="subhead">
            A chronological record of changes made through the CMS and its
            agents.
          </p>
        </div>
        <span className="live-chip">
          <i />
          {revisions.length} events
        </span>
      </div>
      <section className="card entries-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">REVISION HISTORY</p>
            <h2>Workspace changes</h2>
          </div>
        </div>
        {ordered.length ? (
          <div className="activity-list">
            {ordered.map((revision) => (
              <Activity
                key={revision.id}
                icon="✦"
                title={revision.action.replaceAll("_", " ")}
                detail={`${entries.find((entry) => entry.id === revision.entryId)?.title || revision.after.title} · ${revision.id}`}
                time={new Date(revision.createdAt).toLocaleString()}
              />
            ))}
          </div>
        ) : (
          <p className="subhead" style={{ padding: "0 21px 20px" }}>
            No tracked changes yet.
          </p>
        )}
      </section>
    </div>
  );
}
function Activity({
  icon,
  title,
  detail,
  time,
}: {
  icon: string;
  title: string;
  detail: string;
  time: string;
}) {
  return (
    <div className="activity-row">
      <span className="activity-icon">{icon}</span>
      <span>
        <b>{title}</b>
        <small>{detail}</small>
      </span>
      <time>{time}</time>
    </div>
  );
}
function Entries({
  entries,
  types,
  searchQuery,
  create,
  update,
  remove,
}: {
  entries: Entry[];
  types: ContentType[];
  searchQuery: string;
  create: () => void;
  update: (entry: Entry) => void;
  remove: (entry: Entry) => void;
}) {
  const [q, setQ] = useState("");
  const [visibleType, setVisibleType] = useState("All content");
  const [visibleStatus, setVisibleStatus] = useState("All statuses");
  const [selected, setSelected] = useState<Entry>();
  useEffect(() => setQ(searchQuery), [searchQuery]);
  useEffect(() => {
    const raw = window.localStorage.getItem("waypoint.model");
    if (raw)
      try {
        const data = JSON.parse(raw);
        if (data.activeType) setVisibleType(data.activeType);
        if (data.activeStatus) setVisibleStatus(data.activeStatus);
      } catch {}
    const handleType = (event: Event) =>
      setVisibleType((event as CustomEvent<string>).detail);
    const handleStatus = (event: Event) =>
      setVisibleStatus((event as CustomEvent<string>).detail);
    const handleSearch = (event: Event) =>
      setQ((event as CustomEvent<string>).detail);
    window.addEventListener("waypoint-type-filter", handleType);
    window.addEventListener("waypoint-status-filter", handleStatus);
    window.addEventListener("waypoint-entry-search", handleSearch);
    return () => {
      window.removeEventListener("waypoint-type-filter", handleType);
      window.removeEventListener("waypoint-status-filter", handleStatus);
      window.removeEventListener("waypoint-entry-search", handleSearch);
    };
  }, []);
  const typeNames = Array.from(new Set(entries.map((entry) => entry.type)));
  const shown = entries.filter(
    (e) =>
      (visibleType === "All content" || e.type === visibleType) &&
      (visibleStatus === "All statuses" || e.status === visibleStatus) &&
      JSON.stringify({
        title: e.title,
        type: e.type,
        relation: e.relation,
        data: e.data || {},
        metadata: e.metadata || {},
      })
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  return (
    <div className="page">
      <div className="page-heading compact">
        <div>
          <p className="kicker">CONTENT WORKSPACE</p>
          <h1>Entries</h1>
          <p className="subhead">
            Every piece of content, structured and ready for your agent.
          </p>
        </div>
        <button className="primary-button" onClick={create}>
          ＋ New entry
        </button>
      </div>
      <section className="card entries-card">
        <div className="entries-toolbar">
          <div className="search-box">
            ⌕
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search entries, fields, relations..."
            />
          </div>
          <select
            className="filter-button"
            value={visibleType}
            onChange={(e) => {
              setVisibleType(e.target.value);
              window.dispatchEvent(
                new CustomEvent("waypoint-type-filter", {
                  detail: e.target.value,
                }),
              );
            }}
          >
            <option>All content</option>
            {typeNames.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
          <select
            className="filter-button"
            value={visibleStatus}
            onChange={(e) => {
              setVisibleStatus(e.target.value);
              window.dispatchEvent(
                new CustomEvent("waypoint-status-filter", {
                  detail: e.target.value,
                }),
              );
            }}
          >
            <option>All statuses</option>
            <option>Published</option>
            <option>Draft</option>
          </select>
        </div>
        <Table entries={shown} types={types} onSelect={setSelected} />
      </section>
      {selected && (
        <EntryInspector entry={selected} types={types} update={update} remove={remove} close={() => setSelected(undefined)} />
      )}
    </div>
  );
}
function EntryInspector({ entry, types, update, remove, close }: { entry: Entry; types: ContentType[]; update: (entry: Entry) => void; remove: (entry: Entry) => void; close: () => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(entry.title);
  const [status, setStatus] = useState(entry.status);
  const [data, setData] = useState(entry.data || {});
  const schema = types.find((type) => type.name === entry.type);
  const save = () => { update({ ...entry, title: title.trim(), status, data }); setEditing(false); };
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-top">
          <div>
            <p className="eyebrow">ENTRY CONTEXT</p>
            <h2>{editing ? "Edit entry" : entry.title}</h2>
          </div>
          <button onClick={close}>×</button>
        </div>
        <p className="subhead">{entry.type} · {entry.status} · {entry.id}</p>
        {editing ? <>
          <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label>Status<select value={status} onChange={(event) => setStatus(event.target.value as Entry["status"])}><option>Draft</option><option>Published</option></select></label>
          {(schema?.fields || []).filter((field) => field !== "title" && field !== "slug").map((field) => <label key={field}>{field}<input value={String(data[field] ?? "")} onChange={(event) => setData({ ...data, [field]: event.target.value })} /></label>)}
        </> : <>
          <label>Structured fields<pre>{JSON.stringify(entry.data || {}, null, 2)}</pre></label>
          <label>Metadata<pre>{JSON.stringify(entry.metadata || {}, null, 2)}</pre></label>
          <div className="modal-hint">✦ Edit any field defined by the {entry.type} schema.</div>
        </>}
        <div className="modal-actions">
          {!editing && <button className="ghost-button" onClick={() => { if (window.confirm("Delete this entry?")) { remove(entry); close(); } }}>Delete</button>}
          {editing ? <><button className="ghost-button" onClick={() => setEditing(false)}>Cancel</button><button className="primary-button" disabled={!title.trim()} onClick={save}>Save changes</button></> : <><button className="ghost-button" onClick={() => setEditing(true)}>Edit entry</button><button className="primary-button" onClick={close}>Done</button></>}
        </div>
      </div>
    </div>
  );
}
function Schema({
  types,
  entries,
  create,
  remove,
  update,
}: {
  types: ContentType[];
  entries: Entry[];
  create: () => void;
  remove: (type: ContentType) => void;
  update: (type: ContentType) => void;
}) {
  const primary = types[0];
  const [editing, setEditing] = useState<ContentType>();
  const [fieldsText, setFieldsText] = useState("");
  const [newField, setNewField] = useState("");
  return (
    <div className="page">
      <div className="page-heading compact">
        <div>
          <p className="kicker">CONTENT MODEL</p>
          <h1>Schema</h1>
          <p className="subhead">
            Define the nouns, fields, and rules your agent can work with.
          </p>
        </div>
        <button className="primary-button" onClick={create}>
          ＋ New content type
        </button>
      </div>
      <div className="schema-layout">
        <section className="card schema-list">
          <CardHead
            eyebrow="CONTENT TYPES"
            title={types.length + " active types"}
          />
          {types.map((t) => (
            <div className="schema-row" key={t.slug}>
              <Icon type={t} />
              <span>
                <b>{t.name}</b>
                <small>{t.desc}</small>
              </span>
              <strong>
                {
                  entries.filter(
                    (entry) => entry.type === t.name && !entry.deletedAt,
                  ).length
                }{" "}
                entries
              </strong>
              <button className="text-button" onClick={() => { setEditing(t); setFieldsText(t.fields.join(", ")); }}>Edit</button><button className="text-button" onClick={() => remove(t)}>Delete</button>
            </div>
          ))}
        </section>
        <section className="card field-card">
          <div className="field-header">
            <div>
              <p className="eyebrow">
                {primary?.name.toUpperCase() || "CONTENT"} · SCHEMA
              </p>
              <h2>Fields & validation</h2>
            </div>
          </div>
          <p className="field-intro">
            Exposed to WebMCP as <code>content.{primary?.slug || "type"}</code>
          </p>
          {(primary?.fields || []).map((field, i) => {
            const kind = primary?.fieldTypes?.[field] || "text";
            const required = primary?.requiredFields?.includes(field);
            return (
              <div className="field-row" key={field}>
                <span className="field-number">0{i + 1}</span>
                <b>{field}</b>
                <span>
                  {kind} · {required ? "required" : "optional"}
                </span>
                <span className="field-check">{required ? "✓" : "◇"}</span>
              </div>
            );
          })}
          <div className="modal" style={{ width: "100%", boxShadow: "none", borderRadius: 0, padding: "15px 21px" }}><label>Add field<input value={newField} onChange={(event) => setNewField(event.target.value)} placeholder="e.g. featured_image" /></label><button className="add-field" disabled={!newField.trim() || !primary} onClick={() => { if (!primary) return; update({ ...primary, fields: [...primary.fields, newField.trim()] }); setNewField(""); }}>＋ Add field</button></div>
        </section>
      </div>
      {editing && <section className="card entries-card" style={{ marginTop: 16 }}><div className="card-heading"><div><p className="eyebrow">CONTENT TYPE</p><h2>Edit {editing.name}</h2></div><button className="text-button" onClick={() => setEditing(undefined)}>Close</button></div><div className="modal" style={{ width: "100%", boxShadow: "none", borderRadius: 0 }}><label>Name<input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label><label>Description<input value={editing.desc} onChange={(event) => setEditing({ ...editing, desc: event.target.value })} /></label><label>Fields (comma separated)<input value={fieldsText} onChange={(event) => setFieldsText(event.target.value)} /></label><div className="modal-actions"><button className="primary-button" onClick={() => { update({ ...editing, fields: fieldsText.split(",").map((field) => field.trim()).filter(Boolean) }); setEditing(undefined); }}>Save type</button></div></div></section>}
    </div>
  );
}
function Taxonomies({
  taxonomies,
  remove,
  removeTerm,
  update,
  create,
  addTerm,
}: {
  taxonomies: Taxonomy[];
  remove: (taxonomy: Taxonomy) => void;
  removeTerm: (taxonomy: Taxonomy, term: Term) => void;
  update: (taxonomy: Taxonomy) => void;
  create: () => void;
  addTerm: (slug: string) => void;
}) {
  const [assignments, setAssignments] = useState<TermAssignment[]>([]);
  const [editing, setEditing] = useState<Taxonomy>();
  const [termEditing, setTermEditing] = useState<{ taxonomy: Taxonomy; term: Term }>();
  useEffect(() => {
    const raw = window.localStorage.getItem("waypoint.model");
    if (raw)
      try {
        const data = JSON.parse(raw);
        if (data.termAssignments) setAssignments(data.termAssignments);
      } catch {}
  }, [taxonomies]);
  return (
    <div className="page">
      <div className="page-heading compact">
        <div>
          <p className="kicker">CONTENT MODEL</p>
          <h1>Taxonomies</h1>
          <p className="subhead">
            Give your content a vocabulary agents can understand and reuse.
          </p>
        </div>
        <button className="primary-button" onClick={create}>
          ＋ New taxonomy
        </button>
      </div>
      <div className="taxonomy-grid">
        {taxonomies.map((t) => (
          <section className="card taxonomy-card" key={t.slug}>
            <div className="taxonomy-card-head">
              <span className="taxonomy-symbol">⊞</span>
              <div>
                <h2>{t.name}</h2>
                <small>
                  taxonomy.{t.slug} · {t.hierarchical ? "Hierarchical" : "Flat"}
                </small>
              </div>
              <button className="text-button" onClick={() => setEditing(t)}>Edit</button><button className="text-button" onClick={() => remove(t)}>Delete</button>
              <button className="dots">•••</button>
            </div>
            <div className="terms-list">
              {t.terms.map((term) => (
                <div
                  className={"term-row " + (term.parent ? "child" : "")}
                  key={term.id}
                >
                  <span className="term-branch">{term.parent ? "└" : "•"}</span>
                  <span>
                    <b>{term.name}</b>
                    <small>{term.slug}</small>
                  </span>
                  <span className="term-count">
                    {
                      assignments.filter(
                        (assignment) =>
                          assignment.taxonomy === t.slug &&
                          assignment.termIds.includes(term.id),
                      ).length
                    }{" "}
                    entries
                  </span>
                  <button className="text-button" onClick={() => setTermEditing({ taxonomy: t, term })}>Edit</button><button className="text-button" onClick={() => removeTerm(t, term)}>Delete</button>
                </div>
              ))}
            </div>
            <button className="add-field" onClick={() => addTerm(t.slug)}>
              ＋ Add term
            </button>
          </section>
        ))}
        <section className="card empty-taxonomy" onClick={create}>
          <span>＋</span>
          <b>Create another taxonomy</b>
          <small>Categories, tags, collections or any vocabulary.</small>
        </section>
      </div>
      {editing && <section className="card entries-card" style={{ marginTop: 16 }}><div className="card-heading"><h2>Edit taxonomy</h2><button className="text-button" onClick={() => setEditing(undefined)}>Close</button></div><div className="modal" style={{ width: "100%", boxShadow: "none", borderRadius: 0 }}><label>Name<input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label><label><input type="checkbox" checked={editing.hierarchical} onChange={(event) => setEditing({ ...editing, hierarchical: event.target.checked })} /> Hierarchical</label><div className="modal-actions"><button className="primary-button" onClick={() => { update(editing); setEditing(undefined); }}>Save taxonomy</button></div></div></section>}
      {termEditing && <section className="card entries-card" style={{ marginTop: 16 }}><div className="card-heading"><h2>Edit term</h2><button className="text-button" onClick={() => setTermEditing(undefined)}>Close</button></div><div className="modal" style={{ width: "100%", boxShadow: "none", borderRadius: 0 }}><label>Name<input value={termEditing.term.name} onChange={(event) => setTermEditing({ ...termEditing, term: { ...termEditing.term, name: event.target.value } })} /></label><label>Description<input value={termEditing.term.description || ""} onChange={(event) => setTermEditing({ ...termEditing, term: { ...termEditing.term, description: event.target.value } })} /></label><div className="modal-actions"><button className="primary-button" onClick={() => { const next = { ...termEditing.taxonomy, terms: termEditing.taxonomy.terms.map((term) => term.id === termEditing.term.id ? termEditing.term : term) }; update(next); setTermEditing(undefined); }}>Save term</button></div></div></section>}
    </div>
  );
}
function Relations({
  siteName,
  types,
  entries,
  relations,
  create,
  remove,
  update,
}: {
  siteName: string;
  types: ContentType[];
  entries: Entry[];
  relations: Relation[];
  create: () => void;
  remove: (relation: Relation) => void;
  update: (relation: Relation) => void;
}) {
  const [editing, setEditing] = useState<Relation>();
  return (
    <div className="page">
      <div className="page-heading compact">
        <div>
          <p className="kicker">CONTENT MODEL</p>
          <h1>Relations</h1>
          <p className="subhead">
            A readable graph of how your content connects.
          </p>
        </div>
        <button className="ghost-button" onClick={create}>
          ＋ New relation
        </button>
      </div>
      <section className="card graph-card">
        <CardHead eyebrow="RELATIONSHIP GRAPH" title={`${siteName} model`} />
        <div className="big-graph">
          {types.slice(0, 3).map((type, index) => (
            <div
              className={
                "big-node " +
                (index === 0
                  ? "article-node"
                  : index === 1
                    ? "author-node"
                    : "project-node")
              }
              key={type.slug}
            >
              <span className="entry-icon yellow">
                {index === 0 ? "Aa" : index === 1 ? "◎" : "▦"}
              </span>
              <b>{type.name}</b>
              <small>
                {
                  entries.filter(
                    (entry) => entry.type === type.name && !entry.deletedAt,
                  ).length
                }{" "}
                entries
              </small>
            </div>
          ))}
          {relations.slice(0, 3).map((relation, index) => (
            <div
              className={
                "graph-link link-" +
                (index === 0 ? "a" : index === 1 ? "b" : "c")
              }
              key={relation.id}
            >
              <span>{relation.name}</span>
            </div>
          ))}
        </div>
        <div className="graph-footer">
          <span>{types.length} content types</span>
          <span>{relations.length} relations</span>
          <span className="graph-health">✓ All healthy</span>
        </div>
        <div className="relation-list">
          {relations.map((relation) => (
            <div className="relation-summary" key={relation.id}>
              <b>{relation.name}</b>
              <span>
                {relation.fromType} → {relation.toType}
              </span>
              <small>{relation.cardinality === "one" ? "One" : "Many"}</small>
              <button className="text-button" onClick={() => setEditing(relation)}>Edit</button>
              <button className="text-button" onClick={() => remove(relation)}>Delete</button>
            </div>
          ))}
        </div>
      </section>
      {editing && <section className="card entries-card" style={{ marginTop: 16 }}><div className="card-heading"><h2>Edit relation</h2><button className="text-button" onClick={() => setEditing(undefined)}>Close</button></div><div className="modal" style={{ width: "100%", boxShadow: "none", borderRadius: 0 }}><label>Name<input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label><label>Cardinality<select value={editing.cardinality} onChange={(event) => setEditing({ ...editing, cardinality: event.target.value as Relation["cardinality"] })}><option value="one">One</option><option value="many">Many</option></select></label><div className="modal-actions"><button className="primary-button" onClick={() => { update(editing); setEditing(undefined); }}>Save relation</button></div></div></section>}
    </div>
  );
}
function EntryModal({
  types,
  close,
  create,
}: {
  types: ContentType[];
  close: () => void;
  create: (title: string, type: string, data: Record<string, unknown>) => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState(types[0]?.name || "Article");
  const [data, setData] = useState<Record<string, unknown>>({});
  const selected = types.find((t) => t.name === type) || types[0];
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-top">
          <div>
            <p className="eyebrow">NEW ENTRY</p>
            <h2>Create a content entry</h2>
          </div>
          <button onClick={close}>×</button>
        </div>
        <label>
          Content type
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setData({});
            }}
          >
            {types.map((t) => (
              <option key={t.name}>{t.name}</option>
            ))}
          </select>
        </label>
        <label>
          Title
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give this entry a name..."
          />
        </label>
        {selected.fields
          .filter((field) => field !== "title" && field !== "slug")
          .slice(0, 4)
          .map((field) => (
            <label key={field}>
              {field}
              <input
                value={String(data[field] || "")}
                onChange={(e) => setData({ ...data, [field]: e.target.value })}
                placeholder={"Add " + field + "..."}
              />
            </label>
          ))}
        <div className="modal-hint">
          ✦ These fields come directly from the selected content schema.
        </div>
        <div className="modal-actions">
          <button className="ghost-button" onClick={close}>
            Cancel
          </button>
          <button
            className="primary-button"
            disabled={!title.trim()}
            onClick={() => create(title.trim(), type, data)}
          >
            Create draft
          </button>
        </div>
      </div>
    </div>
  );
}
function TaxonomyModal({
  close,
  create,
}: {
  close: () => void;
  create: (name: string, slug: string, hierarchical: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [hierarchical, setHierarchical] = useState(true);
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-top">
          <div>
            <p className="eyebrow">NEW TAXONOMY</p>
            <h2>Create a vocabulary</h2>
          </div>
          <button onClick={close}>×</button>
        </div>
        <label>
          Name
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Topics"
          />
        </label>
        <label>
          Slug
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="topics"
          />
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={hierarchical}
            onChange={(e) => setHierarchical(e.target.checked)}
          />{" "}
          Allow parent / child terms
        </label>
        <div className="modal-hint">
          ✦ Agents can use this vocabulary to classify and query entries.
        </div>
        <div className="modal-actions">
          <button className="ghost-button" onClick={close}>
            Cancel
          </button>
          <button
            className="primary-button"
            disabled={!name.trim() || !slug.trim()}
            onClick={() => create(name.trim(), slug.trim(), hierarchical)}
          >
            Create taxonomy
          </button>
        </div>
      </div>
    </div>
  );
}
function TermModal({
  taxonomy,
  close,
  create,
}: {
  taxonomy?: Taxonomy;
  close: () => void;
  create: (
    name: string,
    slug: string,
    parent: string | null,
    description: string,
  ) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [parent, setParent] = useState("");
  const [description, setDescription] = useState("");
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-top">
          <div>
            <p className="eyebrow">NEW TERM · {taxonomy?.name.toUpperCase()}</p>
            <h2>Add a vocabulary term</h2>
          </div>
          <button onClick={close}>×</button>
        </div>
        <label>
          Name
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Editorial"
          />
        </label>
        <label>
          Slug
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="editorial"
          />
        </label>
        {taxonomy?.hierarchical && (
          <label>
            Parent term
            <select value={parent} onChange={(e) => setParent(e.target.value)}>
              <option value="">No parent (top level)</option>
              {taxonomy.terms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Description
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional context for agents..."
          />
        </label>
        <div className="modal-hint">
          ✦ This term will be immediately available for classification.
        </div>
        <div className="modal-actions">
          <button className="ghost-button" onClick={close}>
            Cancel
          </button>
          <button
            className="primary-button"
            disabled={!name.trim() || !slug.trim()}
            onClick={() =>
              create(
                name.trim(),
                slug.trim(),
                parent || null,
                description.trim(),
              )
            }
          >
            Create term
          </button>
        </div>
      </div>
    </div>
  );
}
function TypeModal({
  close,
  create,
}: {
  close: () => void;
  create: (name: string, slug: string, fields: string[]) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [fields, setFields] = useState("title");
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-top">
          <div>
            <p className="eyebrow">NEW CONTENT TYPE</p>
            <h2>Define a new building block</h2>
          </div>
          <button onClick={close}>×</button>
        </div>
        <label>
          Name
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Product"
          />
        </label>
        <label>
          Slug
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="product"
          />
        </label>
        <label>
          Fields <small className="field-help">separate with commas</small>
          <input
            value={fields}
            onChange={(e) => setFields(e.target.value)}
            placeholder="title, price, description"
          />
        </label>
        <div className="modal-hint">
          ✦ The agent will be able to create entries of this type immediately.
        </div>
        <div className="modal-actions">
          <button className="ghost-button" onClick={close}>
            Cancel
          </button>
          <button
            className="primary-button"
            disabled={!name.trim() || !slug.trim()}
            onClick={() =>
              create(
                name.trim(),
                slug.trim(),
                fields
                  .split(",")
                  .map((field) => field.trim())
                  .filter(Boolean),
              )
            }
          >
            Create type
          </button>
        </div>
      </div>
    </div>
  );
}
function RelationModal({
  types,
  close,
  create,
}: {
  types: ContentType[];
  close: () => void;
  create: (
    name: string,
    slug: string,
    fromType: string,
    toType: string,
    cardinality: "one" | "many",
  ) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [fromType, setFromType] = useState(types[0]?.name || "");
  const [toType, setToType] = useState(types[1]?.name || types[0]?.name || "");
  const [cardinality, setCardinality] = useState<"one" | "many">("many");
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-top">
          <div>
            <p className="eyebrow">NEW RELATION</p>
            <h2>Connect two content types</h2>
          </div>
          <button onClick={close}>×</button>
        </div>
        <label>
          Name
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Authored by"
          />
        </label>
        <label>
          Slug
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="authored-by"
          />
        </label>
        <div className="relation-form-grid">
          <label>
            From
            <select
              value={fromType}
              onChange={(e) => setFromType(e.target.value)}
            >
              {types.map((type) => (
                <option key={type.slug}>{type.name}</option>
              ))}
            </select>
          </label>
          <label>
            To
            <select value={toType} onChange={(e) => setToType(e.target.value)}>
              {types.map((type) => (
                <option key={type.slug}>{type.name}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Cardinality
          <select
            value={cardinality}
            onChange={(e) => setCardinality(e.target.value as "one" | "many")}
          >
            <option value="many">Many</option>
            <option value="one">One</option>
          </select>
        </label>
        <div className="modal-hint">
          ✦ Agents can resolve this connection from either content type.
        </div>
        <div className="modal-actions">
          <button className="ghost-button" onClick={close}>
            Cancel
          </button>
          <button
            className="primary-button"
            disabled={!name.trim() || !slug.trim()}
            onClick={() =>
              create(name.trim(), slug.trim(), fromType, toType, cardinality)
            }
          >
            Create relation
          </button>
        </div>
      </div>
    </div>
  );
}
