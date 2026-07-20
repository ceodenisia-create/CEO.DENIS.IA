import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  Bot, BrainCircuit, Eraser, Loader2, MessageSquareText, Plus, Send, ShieldCheck, Sparkles, Trash2, User, Globe,
} from 'lucide-react';
import MemoriaIA from './MemoriaIA';
import {
  type AiChatMessage,
  type AiConversation,
  type PmAiContext,
  createConversation,
  deleteConversation,
  getConversations,
  getConversationMessages,
  getPmAiContext,
  saveMessage,
  sendAiChat,
} from '../lib/planMaestro';
import { parseAiReply, executeAiActions } from '../lib/aiActions';

const QUICK_PROMPTS = [
  { label: '¿Qué hago hoy?',        prompt: '¿Qué debería hacer hoy según mis tareas, prioridades y lo que está vencido?' },
  { label: 'Objetivos atrasados',   prompt: '¿Qué objetivos (metas y proyectos) están atrasados o en riesgo?' },
  { label: 'Revisá mi Radar',       prompt: 'Revisá mi Radar y decime qué área tengo que mejorar primero y por qué.' },
  { label: 'Resumen del sistema',   prompt: 'Dame un resumen del sistema completo: prioridad principal, riesgos y próximas 3 acciones.' },
  { label: 'Cómo voy con hábitos',  prompt: '¿Cómo voy con mi disciplina hoy? ¿Qué hábito estoy fallando más?' },
];

const WELCOME: AiChatMessage = {
  role: 'assistant',
  content: 'Soy CEO DENIS, el sistema de control personal de Denis Espinoza. Puedo ayudarte a revisar tareas, metas, proyectos, disciplina, radar y visión para decidir qué hacer primero.',
};

function formatRelativeDate(d: string) {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  if (diff < 7) return `Hace ${diff} días`;
  return new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

export default function AiAssistant() {
  const [activeTab, setActiveTab] = useState<'chat' | 'memoria'>('chat');
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [messages, setMessages] = useState<AiChatMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [webMode, setWebMode] = useState(false);
  const [context, setContext] = useState<PmAiContext | null>(null);
  const [contextLoading, setContextLoading] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadContext();
    loadConversations();
    const pending = sessionStorage.getItem('ai_pending_query');
    if (pending) {
      sessionStorage.removeItem('ai_pending_query');
      setInput(pending);
    }
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  async function loadContext() {
    setContextLoading(true);
    setContextError(null);
    try { setContext(await getPmAiContext()); }
    catch (e) { setContextError(e instanceof Error ? e.message : 'Error al cargar contexto.'); }
    finally { setContextLoading(false); }
  }

  async function loadConversations() {
    setHistoryLoading(true);
    try { setConversations(await getConversations()); }
    catch (e) { console.error(e); }
    finally { setHistoryLoading(false); }
  }

  function handleNewConversation() {
    setActiveConvId(null);
    setMessages([WELCOME]);
    setInput('');
  }

  async function handleSelectConversation(conv: AiConversation) {
    setActiveConvId(conv.id);
    setInput('');
    try {
      const msgs = await getConversationMessages(conv.id);
      setMessages(msgs.length ? msgs : [WELCOME]);
    } catch { setMessages([WELCOME]); }
  }

  async function handleDeleteConversation(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm('¿Eliminar esta conversación?')) return;
    await deleteConversation(id);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConvId === id) handleNewConversation();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const next: AiChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(next);
    setInput('');
    setLoading(true);

    let convId = activeConvId;
    if (!convId) {
      try {
        const conv = await createConversation(trimmed);
        convId = conv.id;
        setActiveConvId(convId);
        setConversations(prev => [conv, ...prev]);
      } catch (e) { console.error(e); }
    }

    if (convId) { try { await saveMessage(convId, 'user', trimmed); } catch (e) { console.error(e); } }

    try {
      const freshCtx = await getPmAiContext();
      setContext(freshCtx);
      const { reply, actions } = await sendAiChat(next, freshCtx, webMode);

      // Acciones vía tool calling nativo; si el modelo no llamó a la función pero
      // igual escribió el JSON en el texto (algún modelo sin soporte de tools),
      // parseAiReply lo agarra como respaldo.
      const fallbackParsed = actions.length === 0 ? parseAiReply(reply) : null;
      const pendingActions = actions.length > 0 ? actions : fallbackParsed?.actions ?? [];
      const baseReply = fallbackParsed ? fallbackParsed.reply : reply;

      let finalText = baseReply;
      if (pendingActions.length > 0) {
        const results = await executeAiActions(pendingActions);
        finalText = [baseReply, ...results].filter(Boolean).join('\n');
        if (!finalText.trim()) finalText = 'Listo.';
      }

      const final = [...next, { role: 'assistant' as const, content: finalText }];
      setMessages(final);
      if (convId) {
        try { await saveMessage(convId, 'assistant', finalText); } catch (e) { console.error(e); }
        setConversations(prev =>
          prev.map(c => c.id === convId ? { ...c, updated_at: new Date().toISOString() } : c)
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        );
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Error desconocido.';
      const errMsg = `No pude conectar con la IA. Error: ${detail}`;
      setMessages([...next, { role: 'assistant', content: errMsg }]);
      if (convId) { try { await saveMessage(convId, 'assistant', errMsg); } catch (e) { console.error(e); } }
    } finally { setLoading(false); }
  }

  const contextStats = context ? [
    { label: 'Tareas', value: context.totalTasks },
    { label: 'MIT', value: context.mitTasks.length },
    { label: 'Metas', value: context.goals.length },
    { label: 'Vencidas', value: context.overdueTasks.length },
  ] : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-bordo-500/30 bg-plata-900/80 p-4 shadow-pm-lg">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,26,46,0.18),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(184,146,42,0.12),transparent_35%)]" />
        <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-dorado-400/30 bg-dorado-400/10 p-2.5">
              <Sparkles className="h-6 w-6 text-dorado-300" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-dorado-300/80">CEO DENIS</p>
              <h1 className="text-xl font-bold text-white">Asistente Estratégico</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {contextStats && (
              <div className="hidden md:flex gap-3">
                {contextStats.map(item => (
                  <div key={item.label} className="rounded-lg border border-plata-700/60 bg-plata-800/80 px-3 py-1.5 text-center">
                    <p className="text-xs text-plata-400">{item.label}</p>
                    <p className={`text-lg font-bold ${item.label === 'Vencidas' && item.value > 0 ? 'text-red-400' : 'text-white'}`}>{item.value}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="rounded-xl border border-plata-700/70 bg-plata-950/60 p-2.5 text-sm text-plata-300">
              <div className="flex items-center gap-1.5 font-medium text-dorado-300">
                <ShieldCheck size={14} /> Operativo
              </div>
              <p className="text-xs text-plata-400">CEO DENIS</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Chat / Memoria IA */}
      <div className="flex gap-1.5 border-b border-plata-700/50 pb-px">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors -mb-px border-b-2 ${
            activeTab === 'chat'
              ? 'text-dorado-300 border-dorado-400'
              : 'text-plata-400 border-transparent hover:text-white'
          }`}
        >
          <Bot size={14} /> Chat
        </button>
        <button
          onClick={() => setActiveTab('memoria')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors -mb-px border-b-2 ${
            activeTab === 'memoria'
              ? 'text-dorado-300 border-dorado-400'
              : 'text-plata-400 border-transparent hover:text-white'
          }`}
        >
          <BrainCircuit size={14} /> Memoria IA
        </button>
      </div>

      {/* Tab: Memoria IA */}
      {activeTab === 'memoria' && <MemoriaIA />}

      {/* Tab: Chat — todo el contenido existente */}
      {activeTab === 'chat' && <>

      {contextError && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          No se pudo cargar el contexto: {contextError}
        </div>
      )}

      {/* Main layout */}
      <div className="flex gap-4 h-[620px]">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 shrink-0 rounded-2xl border border-plata-700/70 bg-plata-900/90 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-plata-700/70 bg-plata-950/60">
            <span className="text-sm font-semibold text-plata-200">Historial</span>
            <button
              onClick={handleNewConversation}
              className="flex items-center gap-1.5 rounded-lg border border-dorado-400/30 bg-dorado-400/10 px-2.5 py-1.5 text-xs font-medium text-dorado-300 hover:bg-dorado-400/20 transition-colors"
            >
              <Plus size={13} /> Nueva
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {historyLoading ? (
              <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-plata-500" /></div>
            ) : conversations.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-plata-500">Sin conversaciones guardadas</p>
            ) : (
              conversations.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`group relative flex flex-col px-4 py-2.5 cursor-pointer transition-colors hover:bg-plata-800/60 ${
                    activeConvId === conv.id ? 'bg-dorado-400/10 border-l-2 border-dorado-400' : 'border-l-2 border-transparent'
                  }`}
                >
                  <span className="text-xs font-medium text-plata-200 truncate pr-5 leading-snug">{conv.title}</span>
                  <span className="text-[11px] text-plata-500 mt-0.5">{formatRelativeDate(conv.updated_at)}</span>
                  <button
                    onClick={e => handleDeleteConversation(e, conv.id)}
                    className="absolute right-2 top-2.5 opacity-0 group-hover:opacity-100 p-1 text-plata-500 hover:text-red-400 transition-all rounded"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Chat */}
        <section className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-plata-700/70 bg-plata-900/90 shadow-xl">
          <div className="flex items-center justify-between border-b border-plata-700/70 bg-plata-950/60 px-4 py-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Bot size={16} className="text-dorado-300" />
                {activeConvId ? (conversations.find(c => c.id === activeConvId)?.title ?? 'Conversación') : 'Nueva conversación'}
              </h2>
              <p className="mt-0.5 text-xs text-plata-400">
                {contextLoading ? 'Cargando contexto...' : 'Datos actualizados'}
              </p>
            </div>
            <button
              onClick={handleNewConversation}
              className="inline-flex items-center gap-1.5 rounded-lg border border-plata-700 px-3 py-1.5 text-xs font-medium text-plata-300 transition-colors hover:bg-plata-800 hover:text-white"
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
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-dorado-500/15 text-dorado-300">
                      <Bot size={16} />
                    </div>
                  )}
                  <div className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed md:max-w-[78%] ${
                    isUser
                      ? 'bg-bordo-600 text-white shadow-lg shadow-bordo-950/20'
                      : 'border border-plata-700/70 bg-plata-800 text-plata-100'
                  }`}>
                    {msg.content}
                  </div>
                  {isUser && (
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-plata-700 text-plata-200">
                      <User size={16} />
                    </div>
                  )}
                </div>
              );
            })}
            {loading && (
              <div className="flex items-center gap-3 text-sm text-plata-300">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-dorado-500/15 text-dorado-300">
                  <Loader2 size={16} className="animate-spin" />
                </div>
                <span>Analizando...</span>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="border-t border-plata-700/70 bg-plata-950/70 p-4">
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setWebMode(w => !w)}
                title="Cuando está activo, el agente busca en internet (suma costo y demora)"
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  webMode
                    ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200'
                    : 'border-plata-700 bg-plata-800/60 text-plata-400 hover:text-white'
                }`}
              >
                <Globe size={13} /> Modo internet: {webMode ? 'ON' : 'OFF'}
              </button>
              <span className="w-px h-4 bg-plata-700" />
              {QUICK_PROMPTS.map(item => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setInput(item.prompt)}
                  className="rounded-full border border-dorado-400/20 bg-dorado-400/10 px-3 py-1 text-xs font-medium text-dorado-200 transition-colors hover:border-dorado-300/50 hover:bg-dorado-400/20"
                >
                  {item.label}
                </button>
              ))}
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-2 md:flex-row">
              <div className="relative flex-1">
                <MessageSquareText className="absolute left-3 top-3 h-4 w-4 text-plata-500" />
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as unknown as FormEvent); } }}
                  placeholder="Preguntá sobre tus tareas, metas o proyectos..."
                  rows={2}
                  className="min-h-[48px] w-full resize-none rounded-xl border border-plata-700 bg-plata-900 py-3 pl-9 pr-4 text-sm text-white outline-none transition-colors placeholder:text-plata-500 focus:border-dorado-400 focus:ring-2 focus:ring-dorado-400/20"
                />
              </div>
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-bordo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-bordo-950/20 transition-colors hover:bg-bordo-500 disabled:cursor-not-allowed disabled:bg-plata-700 disabled:text-plata-400"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Enviar
              </button>
            </form>
          </div>
        </section>
      </div>

      </>}
    </div>
  );
}
