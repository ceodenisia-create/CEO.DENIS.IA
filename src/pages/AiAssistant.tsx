import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Eraser,
  Loader2,
  MessageSquareText,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  XCircle,
} from 'lucide-react';
import {
  AiChatMessage,
  AiConversation,
  AiSystemContext,
  createConversation,
  deleteConversation,
  getAiSystemContext,
  getConversationMessages,
  getConversations,
  saveMessage,
  sendAiChat,
} from '../lib/aiAssistant';

interface QuickPrompt { label: string; prompt: string; }

const QUICK_PROMPTS: QuickPrompt[] = [
  { label: 'Mensaje para cliente', prompt: 'Redactá un mensaje profesional para avisarle al cliente que ' },
  { label: 'Descripción de modelo', prompt: 'Creá una descripción comercial para catálogo de este modelo: ' },
  { label: 'Calcular precio', prompt: 'Ayudame a calcular el precio. Costo base: $; margen: %; adicionales: $. Mostrá la fórmula y el resultado.' },
  { label: 'Ordenar pedido', prompt: 'Ordená esta información de pedido en formato claro para producción: ' },
  { label: 'Texto para WhatsApp', prompt: 'Convertí este texto en un mensaje breve y profesional para WhatsApp: ' },
  { label: 'Resumen del día', prompt: 'Dame un resumen operativo del día usando los datos internos disponibles.' },
];

const WELCOME_MESSAGE: AiChatMessage = {
  role: 'assistant',
  content: 'Hola, soy el Asistente Operativo IA de CEO Modeltex. Puedo ayudarte a redactar mensajes, armar descripciones comerciales, ordenar pedidos, calcular precios simples y preparar resúmenes con datos de solo lectura del sistema.',
};

function looksLikeConfirmationRequest(content: string) {
  const n = content.toLowerCase();
  return n.includes('¿confirmás') || n.includes('confirmar') || n.includes('[confirmar]');
}

function buildLocalFallback(userMessage: string, context: AiSystemContext | null) {
  const n = userMessage.toLowerCase();
  if (n.includes('resumen')) {
    if (!context) return 'Puedo preparar el resumen del día, pero primero necesito que el contexto interno cargue correctamente.';
    const latestOrders = context.allOrders.slice(0, 5).length
      ? context.allOrders.slice(0, 5).map(o => `• ${o.order_number}: ${o.customer_name} - ${o.garment_type} (${o.status})`).join('\n')
      : '• No hay pedidos disponibles.';
    const lowStock = context.lowStockModels.length
      ? context.lowStockModels.map(m => `• ${m.code} - ${m.name}: ${m.quantity_available} disponibles`).join('\n')
      : '• No se detectaron modelos con stock bajo.';
    return `Resumen operativo:\n\n• Pedidos pendientes: ${context.pendingOrders}\n• Modelos activos: ${context.activeModels}\n• Clientes: ${context.totalClients}\n\nÚltimos pedidos:\n${latestOrders}\n\nStock bajo:\n${lowStock}`;
  }
  if (n.includes('precio') || n.includes('calcular')) return 'Para calcular el precio necesito: costo base, margen o % de ganancia, adicionales y cantidad.';
  if (n.includes('crear') || n.includes('editar') || n.includes('modificar')) return 'Puedo preparar una propuesta, pero no voy a modificar datos automáticamente.';
  return 'Puedo ayudarte con ese texto. Pasame más contexto para un resultado más preciso.';
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

export default function AiAssistant() {
  // Conversation list
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Active chat
  const [messages, setMessages] = useState<AiChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  // System context
  const [contextLoading, setContextLoading] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);
  const [systemContext, setSystemContext] = useState<AiSystemContext | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadContext();
    loadConversations();
    // Pick up query forwarded from the global search bar
    const pending = sessionStorage.getItem('ai_pending_query');
    if (pending) {
      sessionStorage.removeItem('ai_pending_query');
      setInput(pending);
      // Auto-submit after context loads (small delay)
      setTimeout(() => {
        const form = document.getElementById('ai-chat-form') as HTMLFormElement | null;
        form?.requestSubmit();
      }, 800);
    }
  }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const contextSummary = useMemo(() => {
    if (!systemContext) return null;
    return [
      { label: 'Pendientes', value: systemContext.pendingOrders },
      { label: 'Modelos', value: systemContext.activeModels },
      { label: 'Clientes', value: systemContext.totalClients },
      { label: 'Stock bajo', value: systemContext.lowStockModels.length },
    ];
  }, [systemContext]);

  const loadContext = async () => {
    setContextLoading(true);
    setContextError(null);
    try { setSystemContext(await getAiSystemContext()); }
    catch (e) { setContextError(e instanceof Error ? e.message : 'Error al cargar contexto.'); }
    finally { setContextLoading(false); }
  };

  const loadConversations = async () => {
    setHistoryLoading(true);
    try { setConversations(await getConversations()); }
    catch (e) { console.error(e); }
    finally { setHistoryLoading(false); }
  };

  const handleNewConversation = () => {
    setActiveConvId(null);
    setMessages([WELCOME_MESSAGE]);
    setInput('');
    setPendingAction(null);
  };

  const handleSelectConversation = async (conv: AiConversation) => {
    setActiveConvId(conv.id);
    setPendingAction(null);
    setInput('');
    try {
      const msgs = await getConversationMessages(conv.id);
      const chatMsgs: AiChatMessage[] = msgs.map(m => ({ role: m.role, content: m.content }));
      setMessages(chatMsgs.length ? chatMsgs : [WELCOME_MESSAGE]);
    } catch (e) {
      console.error(e);
      setMessages([WELCOME_MESSAGE]);
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    if (!confirm('¿Eliminar esta conversación?')) return;
    try {
      await deleteConversation(convId);
      setConversations(prev => prev.filter(c => c.id !== convId));
      if (activeConvId === convId) handleNewConversation();
    } catch (err) { console.error(err); }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const nextMessages: AiChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    setPendingAction(null);

    // Create conversation on first real user message
    let convId = activeConvId;
    if (!convId) {
      try {
        const conv = await createConversation(trimmed);
        convId = conv.id;
        setActiveConvId(convId);
        setConversations(prev => [conv, ...prev]);
      } catch (e) { console.error('Error creando conversación:', e); }
    }

    // Save user message
    if (convId) {
      try { await saveMessage(convId, 'user', trimmed); } catch (e) { console.error(e); }
    }

    try {
      const freshContext = await getAiSystemContext();
      setSystemContext(freshContext);
      const reply = await sendAiChat(nextMessages, freshContext);
      const finalMessages = [...nextMessages, { role: 'assistant' as const, content: reply }];
      setMessages(finalMessages);
      if (looksLikeConfirmationRequest(reply)) setPendingAction(reply);

      // Save assistant reply
      if (convId) {
        try { await saveMessage(convId, 'assistant', reply); } catch (e) { console.error(e); }
      }

      // Update conversation title/timestamp in sidebar
      if (convId) setConversations(prev =>
        prev.map(c => c.id === convId ? { ...c, updated_at: new Date().toISOString() } : c)
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      );
    } catch (error) {
      const fallback = buildLocalFallback(trimmed, systemContext);
      const detail = error instanceof Error ? error.message : 'Error desconocido.';
      const errMsg = `${fallback}\n\nNota técnica: no pude conectar con la IA (${detail}).`;
      setMessages([...nextMessages, { role: 'assistant', content: errMsg }]);
      if (convId) {
        try { await saveMessage(convId, 'assistant', errMsg); } catch (e) { console.error(e); }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = () => {
    setMessages(cur => [...cur, { role: 'assistant', content: 'Confirmación recibida. Esta versión no ejecuta cambios automáticamente.' }]);
    setPendingAction(null);
  };

  const handleCancelAction = () => {
    setMessages(cur => [...cur, { role: 'assistant', content: 'Acción cancelada. No se modificó ningún dato.' }]);
    setPendingAction(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-teal-400/20 bg-slate-900/80 p-4 shadow-2xl shadow-teal-950/30">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.16),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(139,92,246,0.12),transparent_35%)]" />
        <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-teal-400/30 bg-teal-400/10 p-2.5">
              <Sparkles className="h-6 w-6 text-teal-300" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-teal-300/80">CEO Modeltex</p>
              <h1 className="text-xl font-bold text-white">Asistente Operativo IA</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {contextSummary && (
              <div className="hidden md:flex gap-3">
                {contextSummary.map(item => (
                  <div key={item.label} className="rounded-lg border border-slate-700/60 bg-slate-800/80 px-3 py-1.5 text-center">
                    <p className="text-xs text-slate-400">{item.label}</p>
                    <p className="text-lg font-bold text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-2.5 text-sm text-slate-300">
              <div className="flex items-center gap-1.5 font-medium text-teal-300">
                <ShieldCheck size={14} /> Modo seguro
              </div>
              <p className="text-xs text-slate-400">Solo lectura</p>
            </div>
          </div>
        </div>
      </div>

      {contextError && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          No se pudo cargar el contexto: {contextError}
        </div>
      )}

      {/* Main layout: sidebar + chat */}
      <div className="flex gap-4 min-h-[620px]">

        {/* ── Sidebar historial ── */}
        <aside className="hidden lg:flex flex-col w-64 shrink-0 rounded-2xl border border-slate-700/70 bg-slate-900/90 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/70 bg-slate-950/60">
            <span className="text-sm font-semibold text-slate-200">Historial</span>
            <button
              onClick={handleNewConversation}
              className="flex items-center gap-1.5 rounded-lg border border-teal-400/30 bg-teal-400/10 px-2.5 py-1.5 text-xs font-medium text-teal-300 hover:bg-teal-400/20 transition-colors"
            >
              <Plus size={13} /> Nueva
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {historyLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 size={18} className="animate-spin text-slate-500" />
              </div>
            ) : conversations.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-slate-500">
                Todavía no hay conversaciones guardadas
              </p>
            ) : (
              conversations.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`group relative flex flex-col px-4 py-2.5 cursor-pointer transition-colors hover:bg-slate-800/60 ${
                    activeConvId === conv.id ? 'bg-teal-400/10 border-l-2 border-teal-400' : 'border-l-2 border-transparent'
                  }`}
                >
                  <span className="text-xs font-medium text-slate-200 truncate pr-5 leading-snug">
                    {conv.title}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5">
                    {formatRelativeDate(conv.updated_at)}
                  </span>
                  <button
                    onClick={e => handleDeleteConversation(e, conv.id)}
                    className="absolute right-2 top-2.5 opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-all rounded"
                    title="Eliminar"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* ── Chat panel ── */}
        <section className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/90 shadow-xl">
          {/* Chat header */}
          <div className="flex items-center justify-between border-b border-slate-700/70 bg-slate-950/60 px-4 py-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Bot size={16} className="text-teal-300" />
                {activeConvId
                  ? (conversations.find(c => c.id === activeConvId)?.title ?? 'Conversación')
                  : 'Nueva conversación'}
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                {contextLoading ? 'Cargando datos internos...' : 'Listo para consultas'}
              </p>
            </div>
            <button
              onClick={handleNewConversation}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <Eraser size={13} /> Nueva
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map((msg, i) => {
              const isUser = msg.role === 'user';
              return (
                <div key={i} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {!isUser && (
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-500/15 text-teal-300">
                      <Bot size={16} />
                    </div>
                  )}
                  <div className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed md:max-w-[78%] ${
                    isUser
                      ? 'bg-teal-600 text-white shadow-lg shadow-teal-950/20'
                      : 'border border-slate-700/70 bg-slate-800 text-slate-100'
                  }`}>
                    {msg.content}
                  </div>
                  {isUser && (
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-slate-200">
                      <User size={16} />
                    </div>
                  )}
                </div>
              );
            })}
            {loading && (
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500/15 text-teal-300">
                  <Loader2 size={16} className="animate-spin" />
                </div>
                <span>Preparando respuesta...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Pending action */}
          {pendingAction && (
            <div className="border-t border-amber-500/20 bg-amber-500/10 p-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-2 text-sm text-amber-100">
                  <ClipboardCheck size={16} className="mt-0.5 shrink-0" />
                  <span>Hay una propuesta pendiente. Esta versión no ejecuta cambios sin confirmación.</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleConfirmAction} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500">
                    <CheckCircle2 size={14} /> Confirmar
                  </button>
                  <button onClick={handleCancelAction} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800">
                    <XCircle size={14} /> Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Input area */}
          <div className="border-t border-slate-700/70 bg-slate-950/70 p-4">
            <div className="mb-2.5 flex flex-wrap gap-2">
              {QUICK_PROMPTS.map(item => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setInput(item.prompt)}
                  className="rounded-full border border-teal-400/20 bg-teal-400/10 px-3 py-1 text-xs font-medium text-teal-200 transition-colors hover:border-teal-300/50 hover:bg-teal-400/20"
                >
                  {item.label}
                </button>
              ))}
            </div>
            <form id="ai-chat-form" onSubmit={handleSubmit} className="flex flex-col gap-2 md:flex-row">
              <div className="relative flex-1">
                <MessageSquareText className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as unknown as FormEvent); } }}
                  placeholder="Escribí una consulta... (Enter para enviar, Shift+Enter para nueva línea)"
                  rows={2}
                  className="min-h-[48px] w-full resize-none rounded-xl border border-slate-700 bg-slate-900 py-3 pl-9 pr-4 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20"
                />
              </div>
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-950/20 transition-colors hover:bg-teal-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Enviar
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
