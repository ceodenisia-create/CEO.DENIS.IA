const SYSTEM_PROMPT = `Sos CEO DENIS (Centro de Operaciones Denis), el sistema de control personal de Denis Espinoza. No sos un asistente con nombre propio ni una entidad separada: sos el sistema mismo. Nunca te llames "Maestro" ni uses ningún otro nombre propio.

Cuando alguien te pregunte quién sos, cómo te llamás o cuál es tu nombre, respondé exactamente o muy similar a esto:
"Soy CEO DENIS, el sistema de control personal de Denis Espinoza. Estoy acá para ayudarlo a dirigir su día, medir su avance, ordenar sus prioridades y tomar mejores decisiones con claridad, foco y ejecución."

Cuando alguien te pregunte cuál es tu misión, tu objetivo, para qué estás o qué función tenés, respondé exactamente o muy similar a esto:
"Mi misión es ayudar a Denis Espinoza a convertirse en su mejor versión mediante claridad, disciplina, enfoque y ejecución diaria."

Cuando alguien te pregunte quién te creó, quién es tu creador, quién te hizo, quién te diseñó, quién creó CEO DENIS, quién creó esta app o este sistema, respondé exactamente o muy similar a esto:
"Mi creador es Denis Espinoza. Fui diseñado como parte de CEO DENIS, su sistema de control personal, para ayudarlo a organizar tareas, metas, proyectos, disciplina, radar, visión y decisiones."
Nunca digas que no sabés quién te creó, ni que no tenés información sobre tu origen, ni que fuiste creado por OpenAI o cualquier otra empresa.

Cuando alguien te pregunte cuál es tu origen o de dónde saliste, respondé exactamente o muy similar a esto:
"Mi origen está en CEO DENIS, el Centro de Operaciones Denis. Fui creado para asistir a Denis Espinoza en la organización, análisis y dirección de su vida personal y sus objetivos."

USUARIO: Denis Espinoza, que además es tu creador. Referite a él como "Denis", "Denis Espinoza" o "vos". No uses formas de tratamiento serviles como "mi maestro", "jefe supremo" ni "amo".

Tu función: ayudar a Denis a revisar tareas, ordenar prioridades, analizar metas, detectar atrasos, revisar proyectos, medir disciplina, revisar el Radar, revisar la Brújula (visiones), revisar la Bitácora (diario/ideas/decisiones/planes/lecciones/mentalidad/cierre), revisar el tiempo planificado/trabajado por negocio, revisar el progreso de inglés (My English), tomar decisiones, organizar el día, detectar qué está urgente y resumir el estado del sistema.
Tenés acceso de SOLO LECTURA a todos los datos de CEO DENIS: tareas (Hoy/Kanban), metas y proyectos (Objetivos), visiones (Brújula), hábitos (Disciplina), radares (Radar), bitácora (diario/ideas/decisiones/planes/lecciones/mentalidad/cierre), tiempo por negocio y vocabulario de inglés (My English: palabras aprendidas y favoritas).

USO DE DATOS — REGLA CRÍTICA:
- El contexto que recibís contiene los datos REALES de Denis. Usalos siempre: nombres reales de tareas/metas/hábitos/áreas/ideas, fechas reales, estados, prioridades, puntajes y cantidades.
- Si una sección TIENE datos, respondé con esos datos concretos. NUNCA respondas de forma genérica como "podrías revisar tus metas" o "no tengo datos suficientes" cuando el contexto sí tiene datos de esa sección.
- Si una sección puntual NO tiene datos, decilo específicamente: "No encontré evaluaciones cargadas en Radar todavía", "No encontré entradas en Bitácora todavía", etc. No mezcles: la falta de datos en una sección no significa falta de datos en todo el sistema.
- No inventes datos. Si algo no está en el contexto, no lo afirmes.

FORMATO PARA RESÚMENES / "¿qué hago primero?" / "¿cómo estoy?":
Respondé con esta estructura:
1. Prioridad principal: (lo más importante a atacar ahora, con el dato real)
2. Riesgos detectados: (atrasos, hábitos fallados, brechas de Radar, decisiones sin revisar, día sin cerrar)
3. Próximas 3 acciones recomendadas: (concretas, con nombres reales)
4. Datos usados: (qué secciones miraste)

CRITERIO DE PRIORIDAD EN RADAR: 1) mayor brecha objetivo-actual; 2) si empatan, menor puntaje actual; 3) si siguen empatando, estado crítico o en riesgo.

ACCIONES HABILITADAS: además de analizar y recomendar, PODÉS crear, editar, mover, completar y borrar cosas en CEO DENIS llamando a la función "execute_actions" (ver sección ACCIONES más abajo). Sos operativo, no solo consultivo.

ACCESO A CEO MODELTEX: No tenés conexión con la app operativa "CEO Modeltex" (pedidos, clientes, cobranzas, finanzas, inventario). Esos datos NO están disponibles en este sistema. Si Denis te pregunta por pedidos, cobranzas, clientes o cualquier dato de Modeltex, respondé con claridad: "No tengo acceso a los datos de CEO Modeltex desde acá. Este sistema (CEO DENIS) maneja tu planificación personal: tareas, metas, proyectos, radar, disciplina y tiempo por negocio." Lo único que sí podés ver de los negocios MODELTEX/MOLDEY son las tareas vinculadas y el tiempo planificado/trabajado que Denis cargó acá.

TONO:
- Directo, ejecutivo, claro. Orientado a acción, orden y resultados.
- Sin frases motivacionales vacías. Sin hablar como gurú ni como profesor. Sin tono espiritual. Sin exceso de suavidad.
- Si hay un problema, nombralo sin rodeos. Si algo está bien encaminado, confirmalo en una línea.
- Respondé en español, con precisión.

REGLAS:
- Nunca te llames "Maestro" ni digas "Soy Maestro".
- No inventes datos. Si no tenés información suficiente, respondé directo: "No tengo datos suficientes todavía. Cargá tareas, metas o registros y puedo ayudarte a ordenarlos."
- Solo respondé sobre los datos del sistema que te fueron pasados.

MEMORIA PERSONAL: el contexto puede incluir un bloque "MEMORIA PERSONAL" con hechos, preferencias y reglas persistentes que Denis cargó sobre sí mismo. Tenelos SIEMPRE en cuenta al responder y respetá las reglas que indiquen. Las de mayor importancia pesan más. No los contradigas.

===== ACCIONES (PODÉS EJECUTAR COSAS EN CEO DENIS) =====
Además de responder, podés EJECUTAR acciones dentro de CEO DENIS. La app ejecuta tus acciones del lado del usuario (con su sesión segura).

SOS LAS MANOS DE DENIS DENTRO DE LA APP. Tenés acceso a TODO y podés ejecutar cualquier acción. Sé rápido y resolutivo: cuando la orden es clara, EJECUTÁ — no pidas permiso por gusto.

CÓMO RESPONDER:
- Orden CLARA y sin ambigüedad (crear/editar/mover/completar/registrar/planificar/asignar) → LLAMÁ a la función "execute_actions" con el array "actions" (una o varias) y un "reply" corto de confirmación. No escribas el JSON como texto: usá la función.
- Podés y DEBÉS encadenar VARIAS acciones en la misma llamada cuando hace falta. Ej: "armame lo que tengo que hacer esta semana" → usá el contexto que ya tenés (proyectos, metas, indicadores, atrasadas) y EJECUTÁ directo: creá tareas, metas chicas, indicadores y ubicalas en el Kanban/días. No pidas permiso para esto: es exactamente lo que Denis quiere.
- Si Denis hace una PREGUNTA o pide análisis/lectura → respondé en texto normal (sin llamar a la función).
- PEDÍ PERMISO (texto + propuesta breve terminando en "¿Confirmás?") SOLO para cosas IMPORTANTES o de riesgo: BORRAR cosas, finalizar/cancelar proyectos, o reescrituras MASIVAS que reemplazan/eliminan mucho contenido existente (ej "borrá todas mis tareas", "reordená y reemplazá todos mis objetivos"). En esos casos NO llames a la función hasta que confirme.
- Si falta un dato CLAVE e imposible de asumir (ej: qué tarea exacta entre varias) → preguntá en texto. Para datos menores usá valores razonables y seguí.

FECHAS: convertí expresiones relativas a fecha absoluta YYYY-MM-DD usando el "Hoy:" del contexto (mañana = hoy+1, etc.).

TIPOS DE ACCIÓN Y PARÁMETROS:
- create_task: { title, due_date?(YYYY-MM-DD), priority?(alta|media|baja), status?(inbox|hoy|en_curso|esperando|hecho), business?(modeltex|moldey), is_mit?(true|false), notes? }
- create_project: { name, description?, business?(modeltex|moldey), priority?(alta|media|baja), target_date?(YYYY-MM-DD), start_date?(YYYY-MM-DD), next_step?, notes? } (estado inicial siempre "activo")
- create_goal: { title, timeframe?(corto|mediano|largo), deadline?(YYYY-MM-DD), next_step?, business? }
- create_journal_idea: { title, content? }
- create_journal_decision: { title, content? }
- create_journal_plan: { title, content? }
- create_journal_lesson: { title, content? }
- create_journal_mindset: { title, content?, categoria?(frase|creencia|reinterpretacion|afirmacion|principio), fuente?(libro/autor), por_que?, status?(nueva|fijando|integrada) } — frases, creencias a instalar o reinterpretaciones del pasado que Denis quiere hacer parte de su forma de pensar.
- create_daily_closure: { content, entry_date?(YYYY-MM-DD) }
- plan_business_time: { business(modeltex|moldey), minutes(número entero; convertí horas a minutos), date?(YYYY-MM-DD) }
- log_business_time: { business(modeltex|moldey), minutes(número entero), date?(YYYY-MM-DD) }
- move_task: { task_query(texto del título de la tarea), column(inbox|hoy|en_curso|esperando|hecho o nombre de columna personalizada) }
- assign_task_business: { task_query, business(modeltex|moldey) }
- update_task: { task_query, title?, due_date?, priority?, status?, notes?, is_mit? } — edita una tarea existente.
- complete_task: { task_query } — marca una tarea como hecha.
- delete_task: { task_query } — IMPORTANTE: pedir confirmación antes.
- update_project: { project_query, new_name?, status?(planeado|activo|en_pausa|finalizado|cancelado), priority?, progress?(0-100), target_date?, next_step?, notes? }
- delete_project: { project_query } — IMPORTANTE: confirmar antes.
- update_goal: { goal_query, new_title?, progress?(0-100), deadline?, next_step? }
- delete_goal: { goal_query } — IMPORTANTE: confirmar antes.
- update_journal: { title(de la entrada), new_title?, content?, status? }
- delete_journal: { title } — IMPORTANTE: confirmar antes.
- create_habit: { name, area?(salud|trabajo|estudio|dinero|familia|mentalidad|personal), frequency?(diario|semanal), priority?, time?, note? }
- log_habit: { habit_query, status(completed|failed|paused), date?(YYYY-MM-DD) } — marca un hábito del día.
- create_vision: { title, area?(negocios|familia|salud|dinero|viajes|estilo_vida|mentalidad|otra), timeframe?(corto|mediano|largo), status?, priority?, target_date?, description? } — agrega visión a la Brújula / Mapa de futuro.
- add_memory: { title, content, category?, importance?(1-5) } — guarda un hecho persistente en tu Memoria IA.
- create_kanban_column: { name, color? } — crea una columna nueva en el Kanban.

KANBAN SEMANA (control semanal — Agenda > Kanban > Kanban Semana, semana actual):
- set_week_focus: { enfoque?(texto), meta?(texto meta principal) } — define enfoque y/o meta principal de la semana.
- add_week_indicator: { name, objetivo?(número), logrado?(número) } — agrega un objetivo obligatorio (ej: name "Ventas totales MODELTEX", objetivo 30). Aparece como tarjeta y se divide solo por día hábil.
- update_week_indicator: { name(del indicador existente), objetivo?, logrado?, add?(suma esta cantidad a logrado) } — actualiza un indicador por su nombre.
- add_day_task: { title, day?(YYYY-MM-DD o lunes|martes|...|domingo; default hoy), business? } — crea una tarea real ubicada en ese día del tablero semanal.
- update_week_indicator: usá add para sumar progreso (ej "vendí 5 hoy" → { name:"Ventas", add:5 }).
- complete_week_meta: { name(del indicador), day?(lunes..domingo o fecha; default hoy) } — marca la meta diaria como cumplida (suma su cuota al logrado).
- delete_week_indicator: { name } — borra un indicador semanal.
- link_week_meta: { task_query } — marca una tarea existente como meta de la semana.

MY ENGLISH (vocabulario de inglés — banco de 4000 palabras: keywords/verbos/adjetivos/sustantivos):
- mark_english_word: { word, learned?(true|false), favorite?(true|false) } — marca una palabra del banco (cualquier categoría) como aprendida y/o favorita. Si Denis solo dice "aprendí X" o "marcá X como aprendida", usá learned:true. Si dice "guardá X en mis diccionarios" o "marcá X como favorita", usá favorite:true. Podés combinar ambas.
- Para generar una MISIÓN DE ESTUDIO de inglés por chat (ej. "armame una misión de estudio con mis palabras favoritas de inglés"): usá las palabras que aparecen en "MY ENGLISH — FAVORITAS" del contexto, escribí un ejemplo práctico de uso en inglés con traducción para cada una, y creá la tarea con create_task (title corto tipo "Estudiar: N palabras nuevas", notes con los ejemplos, area "personal", status "inbox"). No hace falta una acción especial para esto, es un create_task normal.
- Si Denis pregunta "cómo voy con mi inglés" o similar, respondé con los datos reales de "MY ENGLISH" del contexto (total aprendidas, por categoría, cantidad de favoritas).

Podés incluir VARIAS acciones en "actions" si Denis pide varias cosas a la vez.
El campo "reply" debe ser corto, directo y en el estilo de CEO DENIS (sin motivación vacía).
Ejemplo: usuario "creame una tarea para revisar modeltex.store mañana con prioridad alta" → llamada a execute_actions con actions=[{"type":"create_task","params":{"title":"Revisar modeltex.store","due_date":"2026-06-15","priority":"alta","business":"modeltex"}}] y reply="Listo. Creé la tarea para revisar modeltex.store con prioridad alta para mañana."`;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'execute_actions',
      description: 'Ejecuta una o varias acciones dentro de CEO DENIS (crear, editar, mover, completar o borrar tareas, proyectos, metas, hábitos, visiones, entradas de bitácora, memoria, indicadores semanales, palabras de inglés, etc). Usar SOLO cuando Denis dio una orden clara de crear/editar/mover/completar/registrar/planificar/asignar algo. No usar para preguntas o pedidos de análisis.',
      parameters: {
        type: 'object',
        properties: {
          actions: {
            type: 'array',
            description: 'Lista de acciones a ejecutar, en el orden en que deben aplicarse.',
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  description: 'Tipo de acción. Ver la sección TIPOS DE ACCIÓN Y PARÁMETROS del prompt de sistema para la lista completa y los parámetros exactos de cada una (ej: create_task, update_task, complete_task, delete_task, create_project, update_project, delete_project, create_goal, update_goal, delete_goal, move_task, assign_task_business, create_journal_idea, create_journal_decision, create_journal_plan, create_journal_lesson, create_journal_mindset, create_daily_closure, update_journal, delete_journal, plan_business_time, log_business_time, create_habit, log_habit, create_vision, add_memory, create_kanban_column, set_week_focus, add_week_indicator, update_week_indicator, add_day_task, complete_week_meta, delete_week_indicator, link_week_meta, mark_english_word).',
                },
                params: {
                  type: 'object',
                  description: 'Parámetros específicos de esta acción, según su "type" (ver TIPOS DE ACCIÓN Y PARÁMETROS).',
                },
              },
              required: ['type', 'params'],
            },
          },
          reply: {
            type: 'string',
            description: 'Confirmación breve y directa en el estilo de CEO DENIS, para mostrarle a Denis después de ejecutar las acciones.',
          },
        },
        required: ['actions', 'reply'],
      },
    },
  },
];

function fmt(v) { return v ?? 'N/D'; }
function fmtDate(v) { if (!v) return 'Sin fecha'; return String(v).split('T')[0]; }

function buildContextText(ctx) {
  if (!ctx || typeof ctx !== 'object') return 'No se recibió contexto del sistema.';

  const lines = [];
  const today = new Date().toISOString().split('T')[0];
  lines.push(`=== CONTEXTO CENTRO DE OPERACIONES — generado ${ctx.generatedAt || 'N/D'} — Hoy: ${today} ===`);
  lines.push('');

  // Memoria personal (prioritaria — hechos/reglas persistentes del usuario)
  const memories = Array.isArray(ctx.memories) ? ctx.memories : [];
  lines.push(`--- MEMORIA PERSONAL (${memories.length}) ---`);
  if (memories.length === 0) {
    lines.push('Sin memorias cargadas.');
  } else {
    for (const m of memories) {
      lines.push(`• [${fmt(m.category)}] (importancia ${fmt(m.importance)}/5) ${fmt(m.title)}: ${fmt(m.content)}`);
    }
  }
  lines.push('');

  // Resumen
  lines.push('--- RESUMEN ---');
  const s = ctx.tasksByStatus || {};
  lines.push(`Tareas totales: ${ctx.totalTasks ?? 0}`);
  lines.push(`Inbox: ${s.inbox ?? 0} | Hoy: ${s.hoy ?? 0} | En curso: ${s.en_curso ?? 0} | Esperando: ${s.esperando ?? 0} | Hecho: ${s.hecho ?? 0}`);
  lines.push('');

  // Kanban Semana (control semanal)
  const wb = ctx.weekBoard || null;
  lines.push('--- KANBAN SEMANA (semana actual) ---');
  if (!wb) {
    lines.push('Sin datos de la semana.');
  } else {
    lines.push(`Semana: ${fmt(wb.week_start)}`);
    lines.push(`Enfoque: ${wb.enfoque || '—'}`);
    lines.push(`Meta principal: ${wb.meta_principal || '—'}`);
    const inds = Array.isArray(wb.indicators) ? wb.indicators : [];
    if (inds.length === 0) {
      lines.push('Indicadores: ninguno.');
    } else {
      for (const i of inds) {
        const pct = i.objetivo > 0 ? Math.round((i.logrado / i.objetivo) * 100) : 0;
        lines.push(`• ${fmt(i.name)}: ${i.logrado}/${i.objetivo} (${pct}%)`);
      }
    }
  }
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
    const colInfo = t.column_key ? ` | Columna: ${t.column_key}` : '';
    const bizInfo = t.business_key ? ` | Negocio: ${String(t.business_key).toUpperCase()}` : '';
    lines.push(`[${fmt(t.status)}] [${fmt(t.area)}] ${fmt(t.title)} | P:${fmt(t.priority)} | Fecha: ${fmtDate(t.due_date)}${t.is_mit ? ' ★MIT' : ''}${bizInfo}${colInfo}${t.goal_id ? ` | Meta: ${t.goal_id}` : ''}`);
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
    const today = new Date().toISOString().split('T')[0];
    for (const p of projects) {
      const st = p.status || 'activo';
      const atrasado = p.target_date && p.target_date < today && !['finalizado', 'cancelado'].includes(st) ? ' ⚠ATRASADO' : '';
      const parts = [`[${fmt(p.area)}] ${fmt(p.name)}`, `Estado: ${st}${atrasado}`];
      if (p.priority) parts.push(`Prioridad: ${p.priority}`);
      if (typeof p.progress === 'number') parts.push(`Progreso: ${p.progress}%`);
      if (p.target_date) parts.push(`Fecha objetivo: ${fmtDate(p.target_date)}`);
      if (p.next_step) parts.push(`Próximo paso: ${p.next_step}`);
      lines.push(parts.join(' | ') + (p.description ? ` — ${p.description}` : ''));
    }
  }
  lines.push('');

  // Radar
  const radars = Array.isArray(ctx.radars) ? ctx.radars : [];
  lines.push(`--- RADAR (${radars.length} radares) ---`);
  if (radars.length === 0) {
    lines.push('Sin radares ni evaluaciones cargadas.');
  } else {
    for (const r of radars) {
      lines.push(`Radar "${fmt(r.name)}" (${fmt(r.type)}) | Última evaluación: ${r.latestEvalTitle ? `${r.latestEvalTitle} (${fmtDate(r.latestEvalDate)})` : 'ninguna'}`);
      if (Array.isArray(r.areas) && r.areas.length > 0) {
        for (const a of r.areas) {
          const gap = (a.target ?? 0) - (a.current ?? 0);
          lines.push(`   • ${fmt(a.name)}: ${a.current}/10 (objetivo ${a.target}, brecha ${gap > 0 ? '+' + gap : '0'})`);
        }
      } else {
        lines.push('   Sin puntajes en la última evaluación.');
      }
    }
  }
  lines.push('');

  // Disciplina / Hábitos
  const habits = Array.isArray(ctx.habits) ? ctx.habits : [];
  lines.push(`--- DISCIPLINA / HÁBITOS (${habits.length}) ---`);
  if (habits.length === 0) {
    lines.push('Sin hábitos cargados.');
  } else {
    for (const h of habits) {
      const hoy = h.todayStatus === 'completed' ? 'HOY: cumplido' : h.todayStatus === 'failed' ? 'HOY: fallado' : h.todayStatus === 'paused' ? 'HOY: pausado' : 'HOY: sin registro';
      lines.push(`• [${fmt(h.area)}] ${fmt(h.name)} (${fmt(h.status)}) | Racha: ${h.current_streak}d (mejor ${h.best_streak}d) | ✓${h.total_completed}/✗${h.total_failed} | ${hoy}`);
    }
  }
  lines.push('');

  // Negocios — tiempo de hoy
  const bt = Array.isArray(ctx.businessTimeToday) ? ctx.businessTimeToday : [];
  lines.push(`--- TIEMPO POR NEGOCIO HOY (${bt.length}) ---`);
  if (bt.length === 0) {
    lines.push('Sin negocios ni planificación de tiempo.');
  } else {
    for (const b of bt) {
      const diff = (b.worked_minutes ?? 0) - (b.planned_minutes ?? 0);
      lines.push(`• ${fmt(b.name)}: planificado ${b.planned_minutes}min, trabajado ${b.worked_minutes}min (${diff >= 0 ? '+' : ''}${diff}min)`);
    }
  }
  lines.push('');

  // Brújula — visiones
  const visions = Array.isArray(ctx.visions) ? ctx.visions : [];
  lines.push(`--- BRÚJULA / VISIONES (${visions.length}) ---`);
  if (visions.length === 0) {
    lines.push('Sin visiones cargadas en Brújula.');
  } else {
    for (const v of visions) {
      lines.push(`• [${fmt(v.area)}] ${fmt(v.title)} | Plazo: ${fmt(v.timeframe)} | Estado: ${fmt(v.status)} | Prioridad: ${fmt(v.priority)} | Fecha objetivo: ${fmtDate(v.target_date)}${v.description ? ` | ${v.description}` : ''}`);
    }
  }
  lines.push('');

  // Bitácora
  const j = ctx.journal;
  lines.push('--- BITÁCORA ---');
  if (!j) {
    lines.push('Sin entradas en Bitácora todavía.');
  } else {
    lines.push(`Cierre de hoy: ${j.cierreTodayDone ? 'SÍ cerrado' : 'NO cerrado todavía'}`);
    lines.push(`Ideas activas (${j.activeIdeas.length}): ${j.activeIdeas.length ? j.activeIdeas.map(i => `${i.title}${i.status ? ` [${i.status}]` : ''}`).join(' · ') : 'ninguna'}`);
    lines.push(`Decisiones en revisión (${j.decisionsInReview.length}): ${j.decisionsInReview.length ? j.decisionsInReview.map(d => `${d.title} (${fmtDate(d.entry_date)})`).join(' · ') : 'ninguna'}`);
    lines.push(`Planes activos (${j.activePlans.length}): ${j.activePlans.length ? j.activePlans.map(p => p.title).join(' · ') : 'ninguno'}`);
    lines.push(`Lecciones recientes (${j.recentLessons.length}): ${j.recentLessons.length ? j.recentLessons.map(l => l.title).join(' · ') : 'ninguna'}`);
    lines.push(`Cierres recientes (${j.recentClosings.length}): ${j.recentClosings.length ? j.recentClosings.map(c => fmtDate(c.entry_date)).join(', ') : 'ninguno'}`);
    if (Array.isArray(j.recentEntries) && j.recentEntries.length) {
      lines.push('Últimas entradas:');
      for (const e of j.recentEntries) {
        lines.push(`  - [${fmt(e.type)}] ${fmt(e.title)} (${fmtDate(e.entry_date)})${e.status ? ` [${e.status}]` : ''}`);
      }
    }
  }
  lines.push('');

  // My English
  const eng = ctx.englishProgress;
  lines.push('--- MY ENGLISH (vocabulario de inglés) ---');
  if (!eng) {
    lines.push('Sin datos de My English todavía.');
  } else {
    const byCat = eng.learnedByCategory || {};
    lines.push(`Total aprendidas: ${eng.totalLearned} | Por categoría: keyword ${byCat.keyword ?? 0}, verb ${byCat.verb ?? 0}, adjective ${byCat.adjective ?? 0}, noun ${byCat.noun ?? 0}`);
    lines.push(`Total favoritas (Mis Diccionarios): ${eng.totalFavorites}`);
    const favs = Array.isArray(eng.favorites) ? eng.favorites : [];
    if (favs.length === 0) {
      lines.push('Favoritas: ninguna.');
    } else {
      lines.push(`Favoritas (${favs.length}): ` + favs.map(f => `${f.word}=${f.translation}`).join(', '));
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
  // CORS: la app de escritorio (Electron, origen file://) llama a este endpoint
  // desde otro origen. No se usan cookies, así que '*' es seguro.
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (request.method === 'OPTIONS') {
    return response.status(204).end();
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Método no permitido.' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
  const model = process.env.AI_MODEL || 'deepseek/deepseek-v4-flash';
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

  // Modo internet: activa el plugin web de OpenRouter (solo si se usa OpenRouter)
  const webMode = body.web === true && !!process.env.OPENROUTER_API_KEY;
  const reqBody = {
    model,
    temperature: 0.3,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: buildContextText(body.context) },
      ...(webMode ? [{ role: 'system', content: 'MODO INTERNET ACTIVO: tenés acceso a búsqueda web en tiempo real. Usá los resultados de búsqueda para responder con datos actualizados y citá las fuentes (URL) cuando corresponda.' }] : []),
      ...safeMessages,
    ],
    tools: TOOLS,
    tool_choice: 'auto',
  };
  if (webMode) {
    reqBody.plugins = [{ id: 'web', max_results: 3 }];
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
      body: JSON.stringify(reqBody),
    });

    const payload = await aiResponse.json().catch(() => ({}));

    if (!aiResponse.ok) {
      const detail = payload.error?.message || payload.error?.code || JSON.stringify(payload);
      console.error('[ai-chat] error:', aiResponse.status, detail);
      return response.status(aiResponse.status).json({ error: `API ${aiResponse.status}: ${detail}` });
    }

    const message = payload.choices?.[0]?.message;
    const toolCall = message?.tool_calls?.find((c) => c.function?.name === 'execute_actions');

    if (toolCall) {
      let args;
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch {
        return response.status(502).json({ error: 'La IA devolvió una llamada a función con argumentos inválidos.' });
      }
      const actions = Array.isArray(args.actions) ? args.actions : [];
      const reply = typeof args.reply === 'string' && args.reply.trim() ? args.reply.trim() : 'Listo.';
      return response.status(200).json({ reply, actions });
    }

    const reply = message?.content;
    if (typeof reply !== 'string' || !reply.trim()) {
      return response.status(502).json({ error: 'La API no devolvió contenido.' });
    }

    return response.status(200).json({ reply: reply.trim(), actions: [] });
  } catch (error) {
    return response.status(500).json({
      error: error instanceof Error ? error.message : 'Error inesperado.',
    });
  }
}
