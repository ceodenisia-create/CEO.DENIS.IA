import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Eraser,
  Loader2,
  MessageSquareText,
  Send,
  ShieldCheck,
  Sparkles,
  User,
  XCircle,
} from 'lucide-react';
import { AiChatMessage, AiSystemContext, getAiSystemContext, sendAiChat } from '../lib/aiAssistant';

interface QuickPrompt {
  label: string;
  prompt: string;
}

const QUICK_PROMPTS: QuickPrompt[] = [
  {
    label: 'Mensaje para cliente',
    prompt: 'Redactá un mensaje profesional para avisarle al cliente que ',
  },
  {
    label: 'Descripción de modelo',
    prompt: 'Creá una descripción comercial para catálogo de este modelo: ',
  },
  {
    label: 'Calcular precio',
    prompt: 'Ayudame a calcular el precio. Costo base: $; margen: %; adicionales: $. Mostrá la fórmula y el resultado.',
  },
  {
    label: 'Ordenar pedido',
    prompt: 'Ordená esta información de pedido en formato claro para producción: ',
  },
  {
    label: 'Texto para WhatsApp',
    prompt: 'Convertí este texto en un mensaje breve y profesional para WhatsApp: ',
  },
  {
    label: 'Resumen del día',
    prompt: 'Dame un resumen operativo del día usando los datos internos disponibles.',
  },
];

const WELCOME_MESSAGE: AiChatMessage = {
  role: 'assistant',
  content:
    'Hola, soy el Asistente Operativo IA de CEO Modeltex. Puedo ayudarte a redactar mensajes, armar descripciones comerciales, ordenar pedidos, calcular precios simples y preparar resúmenes con datos de solo lectura del sistema.',
};

function looksLikeConfirmationRequest(content: string) {
  const normalized = content.toLowerCase();
  return normalized.includes('¿confirmás') || normalized.includes('confirmar') || normalized.includes('[confirmar]');
}

function buildLocalFallback(userMessage: string, context: AiSystemContext | null) {
  const normalized = userMessage.toLowerCase();

  if (normalized.includes('resumen')) {
    if (!context) {
      return 'Puedo preparar el resumen del día, pero primero necesito que el contexto interno cargue correctamente.';
    }

    const recentOrders = context.allOrders.slice(0, 5);
    const latestOrders = recentOrders.length
      ? recentOrders
          .map(order => `• ${order.order_number}: ${order.customer_name} - ${order.garment_type} (${order.status})`)
          .join('\n')
      : '• No hay pedidos disponibles.';

    const lowStock = context.lowStockModels.length
      ? context.lowStockModels.map(model => `• ${model.code} - ${model.name}: ${model.quantity_available} disponibles`).join('\n')
      : '• No se detectaron modelos con stock bajo o cero.';

    return `Resumen operativo del día:\n\n• Pedidos pendientes: ${context.pendingOrders}\n• Modelos activos: ${context.activeModels}\n• Clientes registrados: ${context.totalClients}\n\nÚltimos pedidos:\n${latestOrders}\n\nStock bajo / cero:\n${lowStock}`;
  }

  if (normalized.includes('precio') || normalized.includes('calcular')) {
    return 'Para calcular el precio necesito estos datos concretos: costo base, margen o porcentaje de ganancia, adicionales y cantidad. Con eso te devuelvo fórmula y resultado.';
  }

  if (normalized.includes('crear') || normalized.includes('editar') || normalized.includes('modificar')) {
    return 'Puedo preparar una propuesta, pero no voy a modificar datos automáticamente. Indicame cliente, modelo, curva/talles, cantidad, precio y estado deseado para armar la confirmación.';
  }

  return 'Puedo ayudarte con ese texto. Si querés un resultado más preciso, pasame cliente, modelo, objetivo del mensaje y tono deseado. No voy a inventar datos internos que no estén indicados.';
}

export default function AiAssistant() {
  const [messages, setMessages] = useState<AiChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [contextLoading, setContextLoading] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);
  const [systemContext, setSystemContext] = useState<AiSystemContext | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadContext();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const contextSummary = useMemo(() => {
    if (!systemContext) return null;

    return [
      { label: 'Pedidos pendientes', value: systemContext.pendingOrders },
      { label: 'Modelos activos', value: systemContext.activeModels },
      { label: 'Clientes', value: systemContext.totalClients },
      { label: 'Stock bajo', value: systemContext.lowStockModels.length },
    ];
  }, [systemContext]);

  const loadContext = async () => {
    setContextLoading(true);
    setContextError(null);

    try {
      const data = await getAiSystemContext();
      setSystemContext(data);
    } catch (error) {
      setContextError(error instanceof Error ? error.message : 'No se pudo cargar el contexto interno.');
    } finally {
      setContextLoading(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
  };

  const handleClear = () => {
    setMessages([WELCOME_MESSAGE]);
    setPendingAction(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const trimmedInput = input.trim();
    if (!trimmedInput || loading) return;

    const nextMessages: AiChatMessage[] = [...messages, { role: 'user', content: trimmedInput }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    setPendingAction(null);

    try {
      const freshContext = await getAiSystemContext();
      setSystemContext(freshContext);
      const reply = await sendAiChat(nextMessages, freshContext);
      setMessages([...nextMessages, { role: 'assistant', content: reply }]);
      if (looksLikeConfirmationRequest(reply)) {
        setPendingAction(reply);
      }
    } catch (error) {
      const fallback = buildLocalFallback(trimmedInput, systemContext);
      const errorDetail = error instanceof Error ? error.message : 'Error desconocido.';
      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          content: `${fallback}\n\nNota técnica: no pude conectar con la IA en este momento (${errorDetail}).`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = () => {
    setMessages(current => [
      ...current,
      {
        role: 'assistant',
        content:
          'Confirmación recibida. Esta primera versión solo deja preparada la acción y no modifica registros. Cuando se habilite la automatización, se ejecutará únicamente después de una confirmación explícita.',
      },
    ]);
    setPendingAction(null);
  };

  const handleCancelAction = () => {
    setMessages(current => [
      ...current,
      {
        role: 'assistant',
        content: 'Acción cancelada. No se modificó ningún dato del sistema.',
      },
    ]);
    setPendingAction(null);
  };

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-teal-400/20 bg-slate-900/80 p-5 shadow-2xl shadow-teal-950/30">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.16),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(139,92,246,0.12),transparent_35%)]" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl border border-teal-400/30 bg-teal-400/10 p-3">
              <Sparkles className="h-7 w-7 text-teal-300" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-300/80">CEO Modeltex</p>
              <h1 className="mt-1 text-2xl font-bold text-white md:text-3xl">Asistente Operativo IA</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Chat interno para producción textil: redacta, ordena, calcula y consulta datos básicos sin modificar registros automáticamente.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-3 text-sm text-slate-300">
            <div className="flex items-center gap-2 font-medium text-teal-300">
              <ShieldCheck size={16} /> Modo seguro
            </div>
            <p className="mt-1 text-xs text-slate-400">Solo lectura. Acciones futuras requieren confirmación.</p>
          </div>
        </div>
      </div>

      {contextSummary && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {contextSummary.map(item => (
            <div key={item.label} className="rounded-xl border border-slate-700/60 bg-slate-800/80 p-4">
              <p className="text-xs text-slate-400">{item.label}</p>
              <p className="mt-1 text-2xl font-bold text-white">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {contextError && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          No se pudo cargar el contexto interno: {contextError}
        </div>
      )}

      <section className="flex min-h-[620px] flex-col overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/90 shadow-xl">
        <div className="flex flex-col gap-3 border-b border-slate-700/70 bg-slate-950/60 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-white">
              <Bot size={18} className="text-teal-300" /> Chat operativo
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {contextLoading ? 'Cargando datos internos...' : 'Listo para consultas de redacción, pedidos y resumen operativo.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <Eraser size={16} /> Limpiar conversación
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-5">
          {messages.map((message, index) => {
            const isUser = message.role === 'user';
            return (
              <div key={`${message.role}-${index}`} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser && (
                  <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-500/15 text-teal-300">
                    <Bot size={18} />
                  </div>
                )}
                <div
                  className={`max-w-[92%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed md:max-w-[78%] ${
                    isUser
                      ? 'bg-teal-600 text-white shadow-lg shadow-teal-950/20'
                      : 'border border-slate-700/70 bg-slate-800 text-slate-100'
                  }`}
                >
                  {message.content}
                </div>
                {isUser && (
                  <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-slate-200">
                    <User size={18} />
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-500/15 text-teal-300">
                <Loader2 size={18} className="animate-spin" />
              </div>
              <span>El asistente está preparando la respuesta...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {pendingAction && (
          <div className="border-t border-amber-500/20 bg-amber-500/10 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-2 text-sm text-amber-100">
                <ClipboardCheck size={18} className="mt-0.5 shrink-0" />
                <span>Hay una propuesta pendiente. Esta versión no ejecuta cambios reales sin confirmación ni automatización habilitada.</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleConfirmAction}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                >
                  <CheckCircle2 size={16} /> Confirmar
                </button>
                <button
                  type="button"
                  onClick={handleCancelAction}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
                >
                  <XCircle size={16} /> Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="border-t border-slate-700/70 bg-slate-950/70 p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {QUICK_PROMPTS.map(item => (
              <button
                key={item.label}
                type="button"
                onClick={() => handleQuickPrompt(item.prompt)}
                className="rounded-full border border-teal-400/20 bg-teal-400/10 px-3 py-1.5 text-xs font-medium text-teal-200 transition-colors hover:border-teal-300/50 hover:bg-teal-400/20"
              >
                {item.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <MessageSquareText className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
              <textarea
                value={input}
                onChange={event => setInput(event.target.value)}
                placeholder="Escribí una consulta, por ejemplo: Dame un resumen del día..."
                rows={2}
                className="min-h-[52px] w-full resize-none rounded-xl border border-slate-700 bg-slate-900 py-3 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20"
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-950/20 transition-colors hover:bg-teal-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              Enviar
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
