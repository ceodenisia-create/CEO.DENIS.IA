const SYSTEM_PROMPT = `Eres el Asistente Operativo IA de CEO Modeltex, una plataforma interna para una empresa de moldería textil. Tu función es ayudar a redactar mensajes para clientes, crear descripciones comerciales, ordenar pedidos, calcular precios simples, mejorar textos de venta, responder preguntas sobre los datos de la empresa y asistir en tareas operativas. Tenés acceso completo de SOLO LECTURA a todos los datos del sistema: pedidos, clientes, inventario, agenda, personal y finanzas. Responde en español, de forma clara, directa, profesional y orientada a producción textil. No inventes datos internos si no fueron proporcionados. Si faltan datos, pedilos de forma concreta.

Reglas de seguridad:
- Usá los datos internos solamente como contexto de lectura. Nunca afirmes que creaste, editaste o borraste registros.
- Nunca borres datos ni propongas borrados automáticos.
- Si el usuario pide crear, editar o modificar pedidos, clientes, inventario o modelos, respondé con una propuesta resumida y pedí confirmación explícita antes de cualquier acción.
- Para cálculos simples, mostrá la fórmula y aclaraciones necesarias.
- Para resúmenes del día, usá el contexto interno disponible y aclaralo si no hay datos suficientes.`;

function fmt(val) {
  return val ?? 'N/D';
}

function fmtDate(val) {
  if (!val) return 'Sin fecha';
  return String(val).split('T')[0];
}

function fmtMoney(val) {
  return `$${Number(val ?? 0).toLocaleString('es-AR')}`;
}

function buildContextText(ctx) {
  if (!ctx || typeof ctx !== 'object') {
    return 'No se recibió contexto interno del sistema.';
  }

  const lines = [];
  lines.push(`=== CONTEXTO INTERNO DE SOLO LECTURA — generado ${ctx.generatedAt || 'fecha no informada'} ===`);
  lines.push('');

  // ── RESUMEN GENERAL ──────────────────────────────────────────
  lines.push('--- RESUMEN GENERAL ---');
  lines.push(`Pedidos pendientes/en proceso: ${ctx.pendingOrders ?? 0}`);
  lines.push(`Modelos activos en inventario: ${ctx.activeModels ?? 0}`);
  lines.push(`Total de clientes registrados: ${ctx.totalClients ?? 0}`);
  lines.push('');

  // ── TODOS LOS PEDIDOS ────────────────────────────────────────
  const orders = Array.isArray(ctx.allOrders) ? ctx.allOrders : [];
  lines.push(`--- PEDIDOS (${orders.length} registros) ---`);
  if (orders.length === 0) {
    lines.push('Sin pedidos registrados.');
  } else {
    for (const o of orders) {
      lines.push(
        `[${fmt(o.order_number)}] Cliente: ${fmt(o.customer_name)} | Tel: ${fmt(o.phone)} | Prenda: ${fmt(o.garment_type)} | Talle: ${fmt(o.sizes)} | Cant: ${fmt(o.quantity)} | Tela: ${fmt(o.fabric_type)} | Estado: ${fmt(o.status)} | Entrega: ${fmtDate(o.delivery_date)} | Precio: ${fmtMoney(o.price)} | Pagado: ${fmtMoney(o.paid_amount)} | Saldo: ${fmtMoney(o.remaining_balance)} | Creado: ${fmtDate(o.created_at)}${o.notes ? ` | Nota: ${o.notes}` : ''}`
      );
    }
  }
  lines.push('');

  // ── TODOS LOS CLIENTES ───────────────────────────────────────
  const clients = Array.isArray(ctx.allClients) ? ctx.allClients : [];
  lines.push(`--- CLIENTES (${clients.length} registros) ---`);
  if (clients.length === 0) {
    lines.push('Sin clientes registrados.');
  } else {
    for (const c of clients) {
      lines.push(`${fmt(c.name)} | Tel: ${fmt(c.phone)}${c.is_favorite ? ' ⭐' : ''} | Registrado: ${fmtDate(c.created_at)}`);
    }
  }
  lines.push('');

  // ── INVENTARIO / MODELOS ─────────────────────────────────────
  const inventory = Array.isArray(ctx.allInventory) ? ctx.allInventory : [];
  lines.push(`--- INVENTARIO / MODELOS (${inventory.length} registros) ---`);
  if (inventory.length === 0) {
    lines.push('Sin modelos cargados.');
  } else {
    for (const m of inventory) {
      lines.push(
        `[${fmt(m.code)}] ${fmt(m.name)} | Categoría: ${fmt(m.category)} | Sub: ${fmt(m.subcategory)} | Curva: ${fmt(m.size_curve)} | Tela recomendada: ${fmt(m.recommended_fabric)} | Disponible: ${fmt(m.quantity_available)} | Vendido: ${fmt(m.quantity_sold)} | Estado: ${fmt(m.status)}`
      );
    }
  }
  lines.push('');

  // ── STOCK BAJO ───────────────────────────────────────────────
  const lowStock = Array.isArray(ctx.lowStockModels) ? ctx.lowStockModels : [];
  lines.push(`--- MODELOS CON STOCK BAJO O CERO (${lowStock.length}) ---`);
  if (lowStock.length === 0) {
    lines.push('Sin modelos con stock crítico.');
  } else {
    for (const m of lowStock) {
      lines.push(`[${fmt(m.code)}] ${fmt(m.name)} — Disponible: ${m.quantity_available}`);
    }
  }
  lines.push('');

  // ── AGENDA ───────────────────────────────────────────────────
  const agenda = Array.isArray(ctx.upcomingAgenda) ? ctx.upcomingAgenda : [];
  lines.push(`--- AGENDA PRÓXIMOS EVENTOS (${agenda.length}) ---`);
  if (agenda.length === 0) {
    lines.push('Sin eventos próximos agendados.');
  } else {
    for (const e of agenda) {
      lines.push(
        `${fmtDate(e.start_at)} | [${fmt(e.event_type)}] ${fmt(e.title)} | Prioridad: ${fmt(e.priority)} | Estado: ${fmt(e.status)}${e.description ? ` | ${e.description}` : ''}`
      );
    }
  }
  lines.push('');

  // ── PERSONAL ─────────────────────────────────────────────────
  const employees = Array.isArray(ctx.employees) ? ctx.employees : [];
  lines.push(`--- PERSONAL (${employees.length} empleados) ---`);
  if (employees.length === 0) {
    lines.push('Sin empleados registrados.');
  } else {
    for (const e of employees) {
      lines.push(
        `${fmt(e.name)} | Cargo: ${fmt(e.position)} | Tel: ${fmt(e.phone)} | Salario: ${fmtMoney(e.monthly_salary)}/mes | Estado: ${fmt(e.status)} | Desde: ${fmtDate(e.start_date)}`
      );
    }
  }
  lines.push('');

  const attendance = Array.isArray(ctx.recentAttendance) ? ctx.recentAttendance : [];
  lines.push(`--- ASISTENCIA RECIENTE (${attendance.length} registros, últimos 30 días) ---`);
  if (attendance.length === 0) {
    lines.push('Sin registros de asistencia recientes.');
  } else {
    for (const a of attendance) {
      lines.push(`EmpleadoID: ${fmt(a.employee_id)} | Fecha: ${fmtDate(a.date)} | Entrada: ${fmt(a.entry_time)} | Salida: ${fmt(a.exit_time)}`);
    }
  }
  lines.push('');

  const empPayments = Array.isArray(ctx.recentEmployeePayments) ? ctx.recentEmployeePayments : [];
  lines.push(`--- PAGOS A PERSONAL RECIENTES (${empPayments.length} registros, últimos 30 días) ---`);
  if (empPayments.length === 0) {
    lines.push('Sin pagos a personal registrados recientemente.');
  } else {
    for (const p of empPayments) {
      lines.push(`EmpleadoID: ${fmt(p.employee_id)} | Fecha: ${fmtDate(p.date)} | Monto: ${fmtMoney(p.amount)} | Tipo: ${fmt(p.payment_type)}${p.notes ? ` | Nota: ${p.notes}` : ''}`);
    }
  }
  lines.push('');

  // ── FINANZAS ─────────────────────────────────────────────────
  const movements = Array.isArray(ctx.recentFinanceMovements) ? ctx.recentFinanceMovements : [];
  lines.push(`--- MOVIMIENTOS FINANCIEROS (${movements.length} registros más recientes) ---`);
  if (movements.length === 0) {
    lines.push('Sin movimientos financieros registrados.');
  } else {
    let totalIncome = 0;
    let totalExpense = 0;
    for (const m of movements) {
      if (m.type === 'income') totalIncome += Number(m.amount ?? 0);
      else totalExpense += Number(m.amount ?? 0);
      lines.push(
        `${fmtDate(m.movement_date)} | ${m.type === 'income' ? 'INGRESO' : 'EGRESO'} | ${fmtMoney(m.amount)} | Cat: ${fmt(m.category)} | Método: ${fmt(m.payment_method)} | Estado: ${fmt(m.status)} | Desc: ${fmt(m.description)}${m.related_person ? ` | Persona: ${m.related_person}` : ''}`
      );
    }
    lines.push(`  → Total ingresos (en estos ${movements.length} movimientos): ${fmtMoney(totalIncome)}`);
    lines.push(`  → Total egresos (en estos ${movements.length} movimientos): ${fmtMoney(totalExpense)}`);
    lines.push(`  → Balance neto: ${fmtMoney(totalIncome - totalExpense)}`);
  }
  lines.push('');

  lines.push('=== FIN DEL CONTEXTO INTERNO ===');

  return lines.join('\n');
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
