import { useEffect, useRef, useState } from 'react';
import { Bot, Building2, Image, Loader2, Package, Search, ClipboardList, X } from 'lucide-react';
import { globalSearch, looksLikeAiQuery, SearchResult, SearchResults } from '../lib/globalSearch';

type Page = 'dashboard' | 'orders' | 'new-order' | 'finance' | 'order-detail' |
  'clients' | 'inventory' | 'library' | 'catalog' | 'personal' | 'agenda' |
  'ai-assistant' | 'users';

interface GlobalSearchProps {
  onNavigate: (page: Page, orderId?: string, clientId?: string, modelId?: string) => void;
  onOpenAi: (query: string) => void;
  currentPage: Page;
}

const CATEGORY_CONFIG = {
  client:    { label: 'Clientes',          icon: Building2,    color: 'text-violet-400' },
  order:     { label: 'Pedidos',           icon: ClipboardList, color: 'text-teal-400'  },
  inventory: { label: 'Inventario',        icon: Package,       color: 'text-amber-400' },
  catalog:   { label: 'Catálogo Interno',  icon: Image,         color: 'text-pink-400'  },
} as const;

export default function GlobalSearch({ onNavigate, onOpenAi, currentPage }: GlobalSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cerrar cuando cambia la página activa
  useEffect(() => { setOpen(false); }, [currentPage]);

  // Ctrl+K / Cmd+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults(null);
      setSelected(0);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || query.length < 2) { setResults(null); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await globalSearch(query);
        setResults(res);
        setSelected(0);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Build flat list of all results + AI option for keyboard navigation
  const isAi = query.trim().length > 1 && looksLikeAiQuery(query);
  const flatResults: (SearchResult | 'ai')[] = [
    ...(results?.clients ?? []),
    ...(results?.orders ?? []),
    ...(results?.inventory ?? []),
    ...(results?.catalog ?? []),
    ...(query.trim().length > 1 ? ['ai' as const] : []),
  ];

  const handleSelect = (item: SearchResult | 'ai') => {
    if (item === 'ai') {
      onOpenAi(query.trim());
      setOpen(false);
      return;
    }
    onNavigate(item.page as Page, item.orderId, undefined, item.modelId);
    setOpen(false);
  };

  // Keyboard navigation inside modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, flatResults.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === 'Enter' && flatResults[selected]) { handleSelect(flatResults[selected]); }
  };

  const hasResults = results && results.total > 0;
  const showAiSuggestion = query.trim().length > 1;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700/60 bg-slate-800/60 text-slate-400 text-sm hover:border-teal-500/40 hover:text-slate-300 transition-colors w-56"
      >
        <Search size={14} />
        <span className="flex-1 text-left">Buscar...</span>
        <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 font-mono">Ctrl K</kbd>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Modal */}
      <div className="fixed top-[10%] left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4">
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl shadow-black/50 overflow-hidden">

          {/* Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/60">
            {loading
              ? <Loader2 size={18} className="text-teal-400 animate-spin shrink-0" />
              : <Search size={18} className="text-slate-400 shrink-0" />
            }
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar clientes, pedidos, modelos... o hacer una pregunta"
              className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 outline-none"
            />
            {query && (
              <button onClick={() => { setQuery(''); setResults(null); }} className="text-slate-500 hover:text-slate-300">
                <X size={16} />
              </button>
            )}
            <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 font-mono shrink-0">Esc</kbd>
          </div>

          {/* Results */}
          <div className="max-h-[420px] overflow-y-auto">
            {!query.trim() && (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                Escribí para buscar en toda la app
              </div>
            )}

            {query.trim().length === 1 && (
              <div className="px-4 py-6 text-center text-sm text-slate-500">
                Seguí escribiendo para ver resultados…
              </div>
            )}

            {query.trim().length > 1 && !loading && results && !hasResults && !isAi && (
              <div className="px-4 py-6 text-center text-sm text-slate-500">
                Sin resultados para <span className="text-white">"{query}"</span>
              </div>
            )}

            {/* Categorized results */}
            {(['client', 'order', 'inventory', 'catalog'] as const).map(cat => {
              const items = results?.[cat === 'client' ? 'clients' : cat === 'order' ? 'orders' : cat === 'inventory' ? 'inventory' : 'catalog'] ?? [];
              if (!items.length) return null;
              const { label, icon: Icon, color } = CATEGORY_CONFIG[cat];
              return (
                <div key={cat}>
                  <div className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider ${color} bg-slate-800/40`}>
                    <Icon size={13} /> {label}
                  </div>
                  {items.map(item => {
                    const idx = flatResults.indexOf(item);
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setSelected(idx)}
                        className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors ${
                          selected === idx ? 'bg-teal-500/15' : 'hover:bg-slate-800/60'
                        }`}
                      >
                        <Icon size={15} className={`mt-0.5 shrink-0 ${color}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-100 truncate">{item.title}</p>
                          {item.subtitle && <p className="text-xs text-slate-400 truncate mt-0.5">{item.subtitle}</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}

            {/* AI suggestion — always shown when there's a query */}
            {showAiSuggestion && (
              <>
                <div className="mx-4 my-1 border-t border-slate-700/50" />
                <button
                  onClick={() => handleSelect('ai')}
                  onMouseEnter={() => setSelected(flatResults.indexOf('ai'))}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    selected === flatResults.indexOf('ai') ? 'bg-teal-500/15' : 'hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-500/15">
                    <Bot size={15} className="text-teal-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-teal-300">
                      {isAi ? 'Preguntar al Asistente IA' : 'Consultar al Asistente IA'}
                    </p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">"{query}"</p>
                  </div>
                </button>
              </>
            )}
          </div>

          {/* Footer hint */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-700/60 bg-slate-950/50">
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-slate-800 font-mono text-[10px]">↑↓</kbd> navegar
            </span>
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-slate-800 font-mono text-[10px]">Enter</kbd> abrir
            </span>
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-slate-800 font-mono text-[10px]">Esc</kbd> cerrar
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
