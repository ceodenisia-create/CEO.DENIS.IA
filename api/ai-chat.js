const SYSTEM_PROMPT = `Eres el Asistente Operativo IA de CEO Modeltex, una plataforma interna para una empresa de moldería textil. Tu función es ayudar a redactar mensajes para clientes, crear descripciones comerciales, ordenar pedidos, calcular precios simples, mejorar textos de venta y asistir en tareas operativas. Responde en español, de forma clara, directa, profesional y orientada a producción textil. No inventes datos internos si no fueron proporcionados. Si faltan datos, pedilos de forma concreta.

Reglas de seguridad:
- Usá los datos internos solamente como contexto de lectura.
- Nunca afirmes que creaste, editaste o borraste registros.
- Nunca borres datos ni propongas borrados automáticos.
- Si el usuario pide crear, editar o modificar pedidos, clientes, inventario o modelos, respondé con una propuesta resumida y pedí confirmación explícita antes de cualquier acción.
- Si faltan datos para una acción, pedilos de forma concreta.
- Para cálculos simples, mostrá la fórmula y aclaraciones necesarias.
- Para resúmenes del día, usá el contexto interno disponible y aclaralo si no hay datos suficientes.`;

function buildContextText(context) {
  if (!context || typeof context !== 'object') {
    return 'No se recibió contexto interno del sistema.';
  }

  const latestOrders = Array.isArray(context.latestOrders) && context.latestOrders.length > 0
    ? context.latestOrders
        .map(order => `- ${order.order_number || 'Sin número'} | ${order.customer_name || 'Sin cliente'} | ${order.article_name || 'Sin artículo'} | Estado: ${order.status || 'Sin estado'} | Creado: ${order.created_at || 'Sin fecha'}`)
        .join('\n')
    : '- Sin últimos pedidos disponibles.';

  const lowStockModels = Array.isArray(context.lowStockModels) && context.lowStockModels.length > 0
    ? context.lowStockModels
        .map(model => `- ${model.code || 'Sin código'} | ${model.name || 'Sin nombre'} | Disponible: ${Number(model.quantity_available ?? 0)}`)
        .join('\n')
    : '- Sin modelos con stock bajo informados.';

  return `Contexto interno de solo lectura generado en ${context.generatedAt || 'fecha no informada'}:
- Pedidos pendientes: ${Number(context.pendingOrders ?? 0)}
- Modelos activos: ${Number(context.activeModels ?? 0)}
- Clientes registrados: ${Number(context.totalClients ?? 0)}
Últimos pedidos:
${latestOrders}
Modelos con stock bajo o cero:
${lowStockModels}`;
}

function validateMessages(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter(message => message && ['user', 'assistant'].includes(message.role) && typeof message.content === 'string')
    .slice(-12)
    .map(message => ({ role: message.role, content: message.content.slice(0, 4000) }));
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Método no permitido.' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
  const model = process.env.AI_MODEL || 'openai/gpt-4o-mini';
  const apiUrl = process.env.OPENROUTER_API_KEY
    ? 'https://openrouter.ai/api/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';

  if (!apiKey) {
    return response.status(500).json({
      error: 'Falta configurar OPENROUTER_API_KEY en las variables de entorno del servidor.',
    });
  }

  const body = request.body || {};
  const safeMessages = validateMessages(body.messages);

  if (safeMessages.length === 0 || safeMessages[safeMessages.length - 1].role !== 'user') {
    return response.status(400).json({ error: 'Enviá al menos un mensaje de usuario.' });
  }

  try {
    const aiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ceomodeltex.vercel.app',
        'X-Title': 'CEO Modeltex',
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'system', content: buildContextText(body.context) },
          ...safeMessages,
        ],
      }),
    });

    const payload = await aiResponse.json().catch(() => ({}));

    if (!aiResponse.ok) {
      const detail = payload.error?.message || payload.error?.code || JSON.stringify(payload);
      console.error('[ai-chat] OpenRouter error:', aiResponse.status, detail);
      return response.status(aiResponse.status).json({
        error: `OpenRouter ${aiResponse.status}: ${detail}`,
      });
    }

    const reply = payload.choices?.[0]?.message?.content;

    if (typeof reply !== 'string' || !reply.trim()) {
      return response.status(502).json({ error: 'La API de IA no devolvió contenido.' });
    }

    return response.status(200).json({ reply: reply.trim() });
  } catch (error) {
    return response.status(500).json({
      error: error instanceof Error ? error.message : 'Error inesperado al consultar la IA.',
    });
  }
}
