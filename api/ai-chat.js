const SYSTEM_PROMPT = `Sos CEO DENIS (Centro de Operaciones Denis), el sistema de control personal de Denis Espinoza. No sos un asistente con nombre propio ni una entidad separada: sos el sistema mismo. Nunca te llames "Maestro" ni uses ningún otro nombre propio.

Cuando alguien te pregunte quién sos, cómo te llamás o cuál es tu nombre, respondé exactamente o muy similar a esto:
"Soy CEO DENIS, el sistema de control personal de Denis Espinoza. Estoy acá para ayudarlo a dirigir su día, medir su avance, ordenar sus prioridades y tomar mejores decisiones con claridad, foco y ejecución."

Cuando alguien te pregunte cuál es tu misión, tu objetivo, para qué estás o qué función tenés, respondé exactamente o muy similar a esto:
"Mi misión es ayudar a Denis Espinoza a convertirse en su mejor versión mediante claridad, disciplina, enfoque y ejecución diaria."

USUARIO: Denis Espinoza. Referite a él como "Denis", "Denis Espinoza" o "vos". Nunca uses "mi creador", "mi maestro", "jefe", "amo" ni nada parecido.

Tu función: ayudar a Denis a revisar tareas, ordenar prioridades, analizar metas, detectar atrasos, revisar proyectos, medir disciplina, revisar el Radar, conectar acciones con la visión, tomar decisiones, organizar el día, detectar qué está urgente y resumir el estado del sistema.
Tenés acceso de SOLO LECTURA a todos los datos del sistema.

TONO:
- Directo, ejecutivo, claro. Orientado a acción, orden y resultados.
- Sin frases motivacionales vacías. Sin hablar como gurú ni como profesor. Sin tono espiritual. Sin exceso de suavidad.
- Si hay un problema, nombralo sin rodeos. Si algo está bien encaminado, confirmalo en una línea.
- Respondé en español, con precisión.

REGLAS:
- Nunca te llames "Maestro" ni digas "Soy Maestro".
- Nunca afirmes que creaste, editaste o borraste registros.
- No inventes datos. Si no tenés información suficiente, respondé directo: "No tengo datos suficientes todavía. Cargá tareas, metas o registros y puedo ayudarte a ordenarlos."
- Solo respondé sobre los datos del sistema que te fueron pasados.`;

function fmt(v) { return v ?? 'N/D'; }
function fmtDate(v) { if (!v) return 'Sin fecha'; return String(v).split('T')[0]; }

function buildContextText(ctx) {
  if (!ctx || typeof ctx !== 'object') return 'No se recibió contexto del sistema.';

  const lines = [];
  const today = new Date().toISOString().split('T')[0];
  lines.push(`=== CONTEXTO CENTRO DE OPERACIONES — generado ${ctx.generatedAt || 'N/D'} — Hoy: ${today} ===`);
  lines.push('');

  // Resumen
  lines.push('--- RESUMEN ---');
  const s = ctx.tasksByStatus || {};
  lines.push(`Tareas totales: ${ctx.totalTasks ?? 0}`);
  lines.push(`Inbox: ${s.inbox ?? 0} | Hoy: ${s.hoy ?? 0} | En curso: ${s.en_curso ?? 0} | Esperando: ${s.esperando ?? 0} | Hecho: ${s.hecho ?? 0}`);
  lines.push('');

  // MIT
  const mit = Array.isArray(ctx.mitTasks) ? ctx.mitTasks : [];
  lines.push(`--- TAREAS MIT / PRIORIDAD DEL DÍA (${mit.length}) ---`);
  if (mit.length === 0) {
    lines.push('Sin tareas MIT definidas.');
  } else {
    for (const t of mit) {
      lines.push(`• [${fmt(t.area)}] ${fmt(t.title)} | Prioridad: ${fmt(t.priority)} | Estado: ${fmt(t.status)} | Fecha: ${fmtDate(t.due_date)}${t.notes ? ` | Nota: ${t.notes}` : ''}`);
    }
  }
  lines.push('');

  // Tareas de hoy
  const tod = Array.isArray(ctx.todayTasks) ? ctx.todayTasks : [];
  lines.push(`--- TAREAS DE HOY (${tod.length}) ---`);
  if (tod.length === 0) {
    lines.push('Sin tareas para hoy.');
  } else {
    for (const t of tod) {
      lines.push(`• [${fmt(t.area)}] ${fmt(t.title)} | Estado: ${fmt(t.status)}${t.is_mit ? ' ★MIT' : ''}`);
    }
  }
  lines.push('');

  // Vencidas
  const ov = Array.isArray(ctx.overdueTasks) ? ctx.overdueTasks : [];
  lines.push(`--- TAREAS VENCIDAS (${ov.length}) ---`);
  if (ov.length === 0) {
    lines.push('Sin tareas vencidas.');
  } else {
    for (const t of ov) {
      lines.push(`⚠ [${fmt(t.area)}] ${fmt(t.title)} | Venció: ${fmtDate(t.due_date)} | Estado: ${fmt(t.status)}`);
    }
  }
  lines.push('');

  // Todas las tareas
  const all = Array.isArray(ctx.allTasks) ? ctx.allTasks : [];
  lines.push(`--- TODAS LAS TAREAS (${all.length}) ---`);
  for (const t of all) {
    lines.push(`[${fmt(t.status)}] [${fmt(t.area)}] ${fmt(t.title)} | P:${fmt(t.priority)} | Fecha: ${fmtDate(t.due_date)}${t.is_mit ? ' ★MIT' : ''}${t.goal_id ? ` | Meta: ${t.goal_id}` : ''}`);
  }
  lines.push('');

  // Metas
  const goals = Array.isArray(ctx.goals) ? ctx.goals : [];
  lines.push(`--- METAS (${goals.length}) ---`);
  if (goals.length === 0) {
    lines.push('Sin metas definidas.');
  } else {
    for (const g of goals) {
      const progreso = g.task_count > 0
        ? `${g.done_task_count}/${g.task_count} tareas completadas`
        : g.progress_manual != null ? `${g.progress_manual}% (manual)` : 'Sin progreso';
      const atrasada = g.deadline && g.deadline < today ? ' ⚠ATRASADA' : '';
      lines.push(`[${fmt(g.timeframe)}] [${fmt(g.area)}] ${fmt(g.title)}${atrasada} | Límite: ${fmtDate(g.deadline)} | Progreso: ${progreso} | Próximo paso: ${fmt(g.next_step)}`);
    }
  }
  lines.push('');

  // Proyectos
  const projects = Array.isArray(ctx.projects) ? ctx.projects : [];
  lines.push(`--- PROYECTOS (${projects.length}) ---`);
  if (projects.length === 0) {
    lines.push('Sin proyectos definidos.');
  } else {
    for (const p of projects) {
      lines.push(`[${fmt(p.area)}] ${fmt(p.name)}${p.description ? ` — ${p.description}` : ''}`);
    }
  }
  lines.push('');
  lines.push('=== FIN DEL CONTEXTO ===');

  return lines.join('\n');
}

function validateMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
    .slice(-12)
    .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));
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
    return response.status(500).json({ error: 'Falta configurar OPENROUTER_API_KEY en las variables de entorno.' });
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
        'HTTP-Referer': 'https://planmaestro.vercel.app',
        'X-Title': 'Centro de Operaciones Denis',
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
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
      console.error('[ai-chat] error:', aiResponse.status, detail);
      return response.status(aiResponse.status).json({ error: `API ${aiResponse.status}: ${detail}` });
    }

    const reply = payload.choices?.[0]?.message?.content;
    if (typeof reply !== 'string' || !reply.trim()) {
      return response.status(502).json({ error: 'La API no devolvió contenido.' });
    }

    return response.status(200).json({ reply: reply.trim() });
  } catch (error) {
    return response.status(500).json({
      error: error instanceof Error ? error.message : 'Error inesperado.',
    });
  }
}
