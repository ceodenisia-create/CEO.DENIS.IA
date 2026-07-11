import { useEffect, useMemo, useState } from 'react';
import {
  Briefcase, Plus, Pencil, Trash2, ExternalLink, Copy, Check, Search, X,
  Printer, PenTool, Share2, Globe, Folder, Wrench, Camera, ShoppingCart,
  Monitor, Film, BookOpen, Palette, type LucideIcon,
} from 'lucide-react';
import {
  type OfficeCard, type OfficeLink, OFFICE_COLORS,
  ensureOfficeCards, createOfficeCard, updateOfficeCard, deleteOfficeCard,
  getOfficeLinks, createOfficeLink, updateOfficeLink, deleteOfficeLink,
  openOfficeUrl,
} from '../lib/oficina';

// ─── Iconos disponibles para tarjetas ────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  printer: Printer, pen: PenTool, share: Share2, globe: Globe,
  folder: Folder, wrench: Wrench, camera: Camera, cart: ShoppingCart,
  monitor: Monitor, film: Film, book: BookOpen, palette: Palette,
};

function cardIcon(key: string): LucideIcon {
  return ICON_MAP[key] ?? Folder;
}

// ─── Modales ─────────────────────────────────────────────────────────────────

interface CardFormState { id?: string; name: string; icon: string; color: string }
interface LinkFormState { id?: string; cardId: string; label: string; url: string; detail: string }

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-plata-800 border border-plata-600/50 rounded-2xl p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-plata-700 transition-colors">
            <X size={16} className="text-plata-400" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 rounded-xl bg-plata-900/60 border border-plata-600/50 text-sm text-white placeholder-plata-500 focus:outline-none focus:border-dorado-400/60';

// ─── Página ──────────────────────────────────────────────────────────────────

export default function Oficina() {
  const [cards, setCards] = useState<OfficeCard[]>([]);
  const [links, setLinks] = useState<OfficeLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [cardForm, setCardForm] = useState<CardFormState | null>(null);
  const [linkForm, setLinkForm] = useState<LinkFormState | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    try {
      setLoading(true);
      const [c, l] = await Promise.all([ensureOfficeCards(), getOfficeLinks()]);
      setCards(c);
      setLinks(l);
      setError(null);
    } catch (e) {
      setError((e as Error)?.message ?? 'Error cargando Oficina');
    } finally {
      setLoading(false);
    }
  }

  const linksByCard = useMemo(() => {
    const map = new Map<string, OfficeLink[]>();
    const q = search.trim().toLowerCase();
    for (const l of links) {
      if (q && !l.label.toLowerCase().includes(q) && !(l.detail ?? '').toLowerCase().includes(q)) continue;
      const arr = map.get(l.card_id) ?? [];
      arr.push(l);
      map.set(l.card_id, arr);
    }
    return map;
  }, [links, search]);

  const visibleCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter(c => c.name.toLowerCase().includes(q) || (linksByCard.get(c.id)?.length ?? 0) > 0);
  }, [cards, search, linksByCard]);

  // ── Acciones tarjetas ──

  async function saveCard() {
    if (!cardForm || !cardForm.name.trim()) return;
    setSaving(true);
    try {
      if (cardForm.id) {
        await updateOfficeCard(cardForm.id, { name: cardForm.name.trim(), icon: cardForm.icon, color: cardForm.color });
        setCards(prev => prev.map(c => c.id === cardForm.id ? { ...c, name: cardForm.name.trim(), icon: cardForm.icon, color: cardForm.color } : c));
      } else {
        const created = await createOfficeCard(cardForm.name, cardForm.icon, cardForm.color, cards.length);
        setCards(prev => [...prev, created]);
      }
      setCardForm(null);
    } catch (e) {
      alert((e as Error)?.message ?? 'No se pudo guardar la tarjeta');
    } finally {
      setSaving(false);
    }
  }

  async function removeCard(card: OfficeCard) {
    const n = links.filter(l => l.card_id === card.id).length;
    if (!confirm(`¿Borrar la tarjeta "${card.name}"${n ? ` y sus ${n} accesos` : ''}?`)) return;
    try {
      await deleteOfficeCard(card.id);
      setCards(prev => prev.filter(c => c.id !== card.id));
      setLinks(prev => prev.filter(l => l.card_id !== card.id));
    } catch (e) {
      alert((e as Error)?.message ?? 'No se pudo borrar');
    }
  }

  // ── Acciones botones ──

  async function saveLink() {
    if (!linkForm || !linkForm.label.trim() || !linkForm.url.trim()) return;
    setSaving(true);
    try {
      if (linkForm.id) {
        const patch = { label: linkForm.label.trim(), url: linkForm.url.trim(), detail: linkForm.detail.trim() || null };
        await updateOfficeLink(linkForm.id, patch);
        setLinks(prev => prev.map(l => l.id === linkForm.id ? { ...l, ...patch } : l));
      } else {
        const inCard = links.filter(l => l.card_id === linkForm.cardId).length;
        const created = await createOfficeLink(linkForm.cardId, { label: linkForm.label, url: linkForm.url, detail: linkForm.detail }, inCard);
        setLinks(prev => [...prev, created]);
      }
      setLinkForm(null);
    } catch (e) {
      alert((e as Error)?.message ?? 'No se pudo guardar el acceso');
    } finally {
      setSaving(false);
    }
  }

  async function removeLink(link: OfficeLink) {
    if (!confirm(`¿Borrar "${link.label}"?`)) return;
    try {
      await deleteOfficeLink(link.id);
      setLinks(prev => prev.filter(l => l.id !== link.id));
    } catch (e) {
      alert((e as Error)?.message ?? 'No se pudo borrar');
    }
  }

  function copyDetail(link: OfficeLink) {
    if (!link.detail) return;
    void navigator.clipboard.writeText(link.detail).then(() => {
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }

  // ── Render ──

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-dorado-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-bordo-600/30 border border-bordo-500/40">
            <Briefcase size={18} className="text-dorado-300" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">Oficina</h1>
            <p className="text-xs text-plata-400">Acceso rápido a tus programas, sitios y redes</p>
          </div>
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-plata-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar acceso…"
            className={`${inputCls} pl-8 w-48 sm:w-56`}
          />
        </div>
        <button
          onClick={() => setCardForm({ name: '', icon: 'folder', color: OFFICE_COLORS[0] })}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-bordo-600 hover:bg-bordo-500 text-white text-sm font-medium transition-colors"
        >
          <Plus size={15} /> Nueva tarjeta
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-900/30 border border-red-600/40 text-sm text-red-300">{error}</div>
      )}

      {/* Grid de tarjetas */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {visibleCards.map(card => {
          const Icon = cardIcon(card.icon);
          const cardLinks = linksByCard.get(card.id) ?? [];
          const accent = card.color ?? '#868E96';
          return (
            <div key={card.id} className="flex flex-col bg-plata-800/40 border border-plata-700/40 rounded-2xl overflow-hidden">
              {/* Header de tarjeta */}
              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-plata-700/40">
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
                  style={{ backgroundColor: `${accent}26`, border: `1px solid ${accent}55` }}
                >
                  <Icon size={16} style={{ color: accent }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{card.name}</p>
                  <p className="text-[11px] text-plata-500">{cardLinks.length} acceso{cardLinks.length === 1 ? '' : 's'}</p>
                </div>
                <button
                  onClick={() => setLinkForm({ cardId: card.id, label: '', url: '', detail: '' })}
                  title="Agregar acceso"
                  className="p-1.5 rounded-lg hover:bg-plata-700/60 transition-colors"
                >
                  <Plus size={15} className="text-dorado-300" />
                </button>
                <button
                  onClick={() => setCardForm({ id: card.id, name: card.name, icon: card.icon, color: accent })}
                  title="Editar tarjeta"
                  className="p-1.5 rounded-lg hover:bg-plata-700/60 transition-colors"
                >
                  <Pencil size={13} className="text-plata-400" />
                </button>
                <button
                  onClick={() => void removeCard(card)}
                  title="Borrar tarjeta"
                  className="p-1.5 rounded-lg hover:bg-red-900/40 transition-colors"
                >
                  <Trash2 size={13} className="text-plata-500 hover:text-red-400" />
                </button>
              </div>

              {/* Lista de accesos: scroll interno para muchos botones */}
              <div className="flex-1 max-h-80 overflow-y-auto p-2.5 space-y-1.5">
                {cardLinks.length === 0 && (
                  <button
                    onClick={() => setLinkForm({ cardId: card.id, label: '', url: '', detail: '' })}
                    className="w-full py-6 rounded-xl border border-dashed border-plata-600/50 text-xs text-plata-500 hover:text-dorado-300 hover:border-dorado-400/50 transition-colors"
                  >
                    + Agregar el primer acceso
                  </button>
                )}
                {cardLinks.map(link => (
                  <div
                    key={link.id}
                    className="group flex items-center gap-2 px-3 py-2 rounded-xl bg-plata-900/40 border border-plata-700/40 hover:border-dorado-400/40 hover:bg-plata-800/60 transition-colors cursor-pointer"
                    onClick={() => openOfficeUrl(link.url)}
                    title={link.url}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{link.label}</p>
                      {link.detail && (
                        <p className="text-[11px] text-plata-500 truncate">{link.detail}</p>
                      )}
                    </div>
                    {link.detail && (
                      <button
                        onClick={e => { e.stopPropagation(); copyDetail(link); }}
                        title="Copiar dato"
                        className="p-1.5 rounded-lg hover:bg-plata-700/70 transition-colors shrink-0"
                      >
                        {copiedId === link.id
                          ? <Check size={13} className="text-emerald-400" />
                          : <Copy size={13} className="text-plata-400" />}
                      </button>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); setLinkForm({ id: link.id, cardId: link.card_id, label: link.label, url: link.url, detail: link.detail ?? '' }); }}
                      title="Editar"
                      className="p-1.5 rounded-lg hover:bg-plata-700/70 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                    >
                      <Pencil size={12} className="text-plata-400" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); void removeLink(link); }}
                      title="Borrar"
                      className="p-1.5 rounded-lg hover:bg-red-900/40 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={12} className="text-plata-500" />
                    </button>
                    <ExternalLink size={13} className="text-dorado-400/70 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {visibleCards.length === 0 && (
        <div className="text-center py-16 text-plata-500 text-sm">
          {search ? 'Sin resultados para tu búsqueda.' : 'Creá tu primera tarjeta con el botón de arriba.'}
        </div>
      )}

      {/* Modal tarjeta */}
      {cardForm && (
        <ModalShell title={cardForm.id ? 'Editar tarjeta' : 'Nueva tarjeta'} onClose={() => setCardForm(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-plata-400 mb-1.5">Nombre</label>
              <input
                autoFocus
                value={cardForm.name}
                onChange={e => setCardForm(f => f && { ...f, name: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') void saveCard(); }}
                placeholder="Producción, Diseño, Redes…"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-plata-400 mb-1.5">Ícono</label>
              <div className="grid grid-cols-6 gap-1.5">
                {Object.entries(ICON_MAP).map(([key, Icon]) => (
                  <button
                    key={key}
                    onClick={() => setCardForm(f => f && { ...f, icon: key })}
                    className={`flex items-center justify-center h-9 rounded-lg border transition-colors ${
                      cardForm.icon === key
                        ? 'border-dorado-400/70 bg-dorado-900/30'
                        : 'border-plata-600/40 hover:border-plata-500/60'
                    }`}
                  >
                    <Icon size={15} className={cardForm.icon === key ? 'text-dorado-300' : 'text-plata-400'} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-plata-400 mb-1.5">Color</label>
              <div className="flex flex-wrap gap-1.5">
                {OFFICE_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setCardForm(f => f && { ...f, color: c })}
                    className={`w-7 h-7 rounded-lg border-2 transition-transform ${
                      cardForm.color === c ? 'border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <button
              onClick={() => void saveCard()}
              disabled={saving || !cardForm.name.trim()}
              className="w-full py-2.5 rounded-xl bg-bordo-600 hover:bg-bordo-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              {saving ? 'Guardando…' : cardForm.id ? 'Guardar cambios' : 'Crear tarjeta'}
            </button>
          </div>
        </ModalShell>
      )}

      {/* Modal acceso */}
      {linkForm && (
        <ModalShell title={linkForm.id ? 'Editar acceso' : 'Nuevo acceso'} onClose={() => setLinkForm(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-plata-400 mb-1.5">Nombre del botón</label>
              <input
                autoFocus
                value={linkForm.label}
                onChange={e => setLinkForm(f => f && { ...f, label: e.target.value })}
                placeholder="Fragmentar en A4, Instagram…"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-plata-400 mb-1.5">Dirección web</label>
              <input
                value={linkForm.url}
                onChange={e => setLinkForm(f => f && { ...f, url: e.target.value })}
                placeholder="https://…"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-plata-400 mb-1.5">Dato asociado (opcional)</label>
              <input
                value={linkForm.detail}
                onChange={e => setLinkForm(f => f && { ...f, detail: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') void saveLink(); }}
                placeholder="@usuario, teléfono, email…"
                className={inputCls}
              />
              <p className="text-[11px] text-plata-500 mt-1">Se muestra debajo del botón con opción de copiar.</p>
            </div>
            <button
              onClick={() => void saveLink()}
              disabled={saving || !linkForm.label.trim() || !linkForm.url.trim()}
              className="w-full py-2.5 rounded-xl bg-bordo-600 hover:bg-bordo-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              {saving ? 'Guardando…' : linkForm.id ? 'Guardar cambios' : 'Agregar acceso'}
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
