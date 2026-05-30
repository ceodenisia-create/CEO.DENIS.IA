import { useState, useEffect, useMemo } from 'react';
import {
  getClientsWithStats,
  createClient,
  updateClient,
  deleteClient,
  getClientOrders,
  getClientStats,
  toggleClientFavorite,
} from '../lib/clients';
import { getWhatsAppLink } from '../lib/clients';
import type { Client, ClientType, ClientStatus, Order } from '../lib/types';
import { CLIENT_TYPE_CONFIG, CLIENT_STATUS_CONFIG, CLIENT_TYPE_OPTIONS, CLIENT_STATUS_OPTIONS, STATUS_CONFIG } from '../lib/types';
import { Search, Plus, CreditCard as Edit3, Phone, MapPin, Star, MessageCircle, X, Save, Loader2, Building, Eye } from 'lucide-react';

interface ClientsProps {
  onNavigate: (page: string, orderId?: string, clientId?: string) => void;
}

interface ClientWithStats extends Client {
  orderCount: number;
  lastOrder: Order | null;
}

export default function Clients({ onNavigate }: ClientsProps) {
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<ClientType | ''>('');
  const [filterStatus, setFilterStatus] = useState<ClientStatus | ''>('');
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [showDetail, setShowDetail] = useState<ClientWithStats | null>(null);
  const [clientOrders, setClientOrders] = useState<Order[]>([]);
  const [clientStats, setClientStats] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [form, setForm] = useState({
    business_name: '',
    contact_name: '',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    locality: '',
    province: '',
    client_type: 'otro' as ClientType,
    industry: '',
    notes: '',
    status: 'active' as ClientStatus,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const data = await getClientsWithStats();
      setClients(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = useMemo(() => {
    let result = clients;
    const q = search.toLowerCase();

    if (search) {
      result = result.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.business_name?.toLowerCase().includes(q) ||
        c.contact_name?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.whatsapp?.includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.locality?.toLowerCase().includes(q)
      );
    }

    if (filterType) {
      result = result.filter(c => c.client_type === filterType);
    }

    if (filterStatus) {
      result = result.filter(c => c.status === filterStatus);
    }

    return result;
  }, [clients, search, filterType, filterStatus]);

  const openNewClient = () => {
    setEditingClient(null);
    setForm({
      business_name: '',
      contact_name: '',
      phone: '',
      whatsapp: '',
      email: '',
      address: '',
      locality: '',
      province: '',
      client_type: 'otro',
      industry: '',
      notes: '',
      status: 'active',
    });
    setShowModal(true);
  };

  const openEditClient = (client: Client) => {
    setEditingClient(client);
    setForm({
      business_name: client.business_name || '',
      contact_name: client.contact_name || '',
      phone: client.phone || '',
      whatsapp: client.whatsapp || '',
      email: client.email || '',
      address: client.address || '',
      locality: client.locality || '',
      province: client.province || '',
      client_type: (client.client_type as ClientType) || 'otro',
      industry: client.industry || '',
      notes: client.notes || '',
      status: (client.status as ClientStatus) || 'active',
    });
    setShowModal(true);
  };

  const openClientDetail = async (client: ClientWithStats) => {
    setShowDetail(client);
    try {
      const [orders, stats] = await Promise.all([
        getClientOrders(client.id),
        getClientStats(client.id),
      ]);
      setClientOrders(orders);
      setClientStats(stats);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    if (!form.business_name.trim() && !form.contact_name.trim()) return;
    setSaving(true);
    try {
      if (editingClient) {
        await updateClient(editingClient.id, {
          name: form.business_name || form.contact_name,
          ...form,
        });
      } else {
        await createClient({
          name: form.business_name || form.contact_name,
          ...form,
        });
      }
      setShowModal(false);
      loadClients();
    } catch (err) {
      console.error(err);
      alert('Error al guardar cliente');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteClient(id);
      setDeleteConfirm(null);
      loadClients();
    } catch (err) {
      console.error(err);
      alert('Error al eliminar cliente');
    }
  };

  const handleToggleFavorite = async (client: Client) => {
    try {
      await toggleClientFavorite(client.id, !client.is_favorite);
      loadClients();
    } catch (err) {
      console.error(err);
    }
  };

  // Reserved for future use - client status change
  // const _handleStatusChange = async (clientId: string, status: ClientStatus) => {
  //   try {
  //     await setClientStatus(clientId, status);
  //     loadClients();
  //   } catch (err) {
  //     console.error(err);
  //   }
  // };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-petrol-800 dark:text-white">Clientes</h1>
          <p className="text-sm text-petrol-600 dark:text-petrol-400 mt-1">{filteredClients.length} clientes registrados</p>
        </div>
        <button
          onClick={openNewClient}
          className="px-4 py-2.5 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm flex items-center gap-2"
        >
          <Plus size={18} /> Nuevo Cliente
        </button>
      </div>

      {/* Search and filters */}
      <div className="bg-crudo-50 dark:bg-slate-800 rounded-xl p-4 border border-petrol-200 dark:border-slate-700 space-y-3">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-petrol-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, teléfono, localidad..."
              className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-petrol-800 dark:text-white placeholder-petrol-400 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm transition-colors"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as ClientType | '')}
            className="px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm text-petrol-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">Todos los tipos</option>
            {CLIENT_TYPE_OPTIONS.map(t => (
              <option key={t} value={t}>{CLIENT_TYPE_CONFIG[t].label}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as ClientStatus | '')}
            className="px-3 py-2 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm text-petrol-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">Todos los estados</option>
            {CLIENT_STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{CLIENT_STATUS_CONFIG[s].label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Clients grid */}
      {filteredClients.length === 0 ? (
        <div className="bg-crudo-50 dark:bg-slate-800 rounded-xl p-12 border border-petrol-200 dark:border-slate-700 text-center">
          <Building size={40} className="mx-auto text-petrol-300 mb-3" />
          <p className="text-petrol-500 dark:text-petrol-400 text-sm">No se encontraron clientes</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map(client => (
            <div
              key={client.id}
              className="bg-crudo-50 dark:bg-slate-800 rounded-xl p-4 border border-petrol-200 dark:border-slate-700 hover:shadow-md transition-all duration-150"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-petrol-800 dark:text-white truncate">
                      {client.business_name || client.name}
                    </h3>
                    <button
                      onClick={() => handleToggleFavorite(client)}
                      className={`flex-shrink-0 ${client.is_favorite ? 'text-yellow-500' : 'text-petrol-300 hover:text-yellow-500'}`}
                    >
                      <Star size={14} fill={client.is_favorite ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                  {client.contact_name && (
                    <p className="text-xs text-petrol-500 dark:text-petrol-400 truncate">{client.contact_name}</p>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${CLIENT_STATUS_CONFIG[client.status as ClientStatus]?.bgClass} ${CLIENT_STATUS_CONFIG[client.status as ClientStatus]?.textClass}`}>
                  {CLIENT_STATUS_CONFIG[client.status as ClientStatus]?.label}
                </span>
              </div>

              <div className="mt-3 space-y-1.5 text-xs text-petrol-600 dark:text-petrol-400">
                {client.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone size={12} />
                    <span>{client.phone}</span>
                  </div>
                )}
                {client.locality && (
                  <div className="flex items-center gap-1.5">
                    <MapPin size={12} />
                    <span>{client.locality}{client.province ? `, ${client.province}` : ''}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <span className={CLIENT_TYPE_CONFIG[client.client_type as ClientType] ? 'text-violet-600 dark:text-violet-400' : ''}>
                    {CLIENT_TYPE_CONFIG[client.client_type as ClientType]?.label || 'Sin tipo'}
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-petrol-200 dark:border-slate-700 flex items-center justify-between">
                <div className="text-xs">
                  <span className="text-petrol-500 dark:text-petrol-400">{client.orderCount} pedidos</span>
                  {client.lastOrder && (
                    <span className="ml-2 text-violet-600 dark:text-violet-400">
                      Último: {STATUS_CONFIG[client.lastOrder.status as keyof typeof STATUS_CONFIG]?.label || client.lastOrder.status}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => openClientDetail(client)}
                  className="flex-1 px-3 py-2 bg-petrol-600 hover:bg-petrol-700 text-white rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                >
                  <Eye size={14} /> Ver
                </button>
                {client.whatsapp && (
                  <a
                    href={getWhatsAppLink(client.whatsapp, `Hola ${client.business_name || client.name}, te escribimos de CEO MODELTEX.`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium transition-colors flex items-center justify-center"
                  >
                    <MessageCircle size={14} />
                  </a>
                )}
                <button
                  onClick={() => openEditClient(client)}
                  className="px-3 py-2 bg-white dark:bg-slate-700 hover:bg-petrol-100 dark:hover:bg-slate-600 text-petrol-600 dark:text-petrol-300 border border-petrol-200 dark:border-slate-600 rounded-lg text-xs font-medium transition-colors flex items-center justify-center"
                >
                  <Edit3 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Client Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-xl bg-crudo-50 dark:bg-slate-800 rounded-2xl shadow-xl border border-petrol-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-petrol-200 dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-petrol-800 dark:text-white">
                {editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-petrol-400 hover:text-petrol-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Razón social / Empresa</label>
                  <input
                    type="text"
                    value={form.business_name}
                    onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm text-petrol-800 dark:text-white focus:ring-2 focus:ring-violet-500"
                    placeholder="Empresa S.A."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Nombre de contacto</label>
                  <input
                    type="text"
                    value={form.contact_name}
                    onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm text-petrol-800 dark:text-white focus:ring-2 focus:ring-violet-500"
                    placeholder="Juan Pérez"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm text-petrol-800 dark:text-white focus:ring-2 focus:ring-violet-500"
                    placeholder="+54 9 11 1234 5678"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">WhatsApp</label>
                  <input
                    type="tel"
                    value={form.whatsapp}
                    onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm text-petrol-800 dark:text-white focus:ring-2 focus:ring-violet-500"
                    placeholder="5491112345678"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm text-petrol-800 dark:text-white focus:ring-2 focus:ring-violet-500"
                    placeholder="email@empresa.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Localidad</label>
                  <input
                    type="text"
                    value={form.locality}
                    onChange={e => setForm(f => ({ ...f, locality: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm text-petrol-800 dark:text-white focus:ring-2 focus:ring-violet-500"
                    placeholder="Buenos Aires"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Dirección</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm text-petrol-800 dark:text-white focus:ring-2 focus:ring-violet-500"
                    placeholder="Calle 123, Piso 4, Depto B"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Provincia / País</label>
                  <input
                    type="text"
                    value={form.province}
                    onChange={e => setForm(f => ({ ...f, province: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm text-petrol-800 dark:text-white focus:ring-2 focus:ring-violet-500"
                    placeholder="Argentina"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Tipo de cliente</label>
                  <select
                    value={form.client_type}
                    onChange={e => setForm(f => ({ ...f, client_type: e.target.value as ClientType }))}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm text-petrol-800 dark:text-white focus:ring-2 focus:ring-violet-500"
                  >
                    {CLIENT_TYPE_OPTIONS.map(t => (
                      <option key={t} value={t}>{CLIENT_TYPE_CONFIG[t].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Estado</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as ClientStatus }))}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm text-petrol-800 dark:text-white focus:ring-2 focus:ring-violet-500"
                  >
                    {CLIENT_STATUS_OPTIONS.map(s => (
                      <option key={s} value={s}>{CLIENT_STATUS_CONFIG[s].label}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Rubro / Tipo de prendas</label>
                  <input
                    type="text"
                    value={form.industry}
                    onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm text-petrol-800 dark:text-white focus:ring-2 focus:ring-violet-500"
                    placeholder="Remeras, pantalones, ropa deportiva..."
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-petrol-600 dark:text-petrol-400 mb-1">Observaciones</label>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm text-petrol-800 dark:text-white focus:ring-2 focus:ring-violet-500 resize-none"
                    placeholder="Notas internas sobre el cliente..."
                  />
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-petrol-200 dark:border-slate-700 flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 bg-white dark:bg-slate-700 text-petrol-600 dark:text-petrol-300 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm font-medium hover:bg-petrol-50 dark:hover:bg-slate-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2.5 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Client Detail Modal */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-2xl bg-crudo-50 dark:bg-slate-800 rounded-2xl shadow-xl border border-petrol-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-petrol-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-petrol-800 dark:text-white">
                  {showDetail.business_name || showDetail.name}
                </h2>
                <p className="text-xs text-petrol-500 dark:text-petrol-400">{showDetail.contact_name}</p>
              </div>
              <button onClick={() => setShowDetail(null)} className="text-petrol-400 hover:text-petrol-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-5">
              {/* Contact info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-petrol-500 dark:text-petrol-400">Teléfono</p>
                  <p className="text-petrol-800 dark:text-white">{showDetail.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-petrol-500 dark:text-petrol-400">WhatsApp</p>
                  <p className="text-petrol-800 dark:text-white">{showDetail.whatsapp || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-petrol-500 dark:text-petrol-400">Email</p>
                  <p className="text-petrol-800 dark:text-white">{showDetail.email || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-petrol-500 dark:text-petrol-400">Localidad</p>
                  <p className="text-petrol-800 dark:text-white">{showDetail.locality || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-petrol-500 dark:text-petrol-400">Tipo</p>
                  <p className="text-violet-600 dark:text-violet-400">{CLIENT_TYPE_CONFIG[showDetail.client_type as ClientType]?.label || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-petrol-500 dark:text-petrol-400">Rubro</p>
                  <p className="text-petrol-800 dark:text-white">{showDetail.industry || '-'}</p>
                </div>
              </div>

              {showDetail.address && (
                <div className="text-sm">
                  <p className="text-xs text-petrol-500 dark:text-petrol-400">Dirección</p>
                  <p className="text-petrol-800 dark:text-white">{showDetail.address}</p>
                </div>
              )}

              {showDetail.notes && (
                <div className="text-sm">
                  <p className="text-xs text-petrol-500 dark:text-petrol-400">Observaciones</p>
                  <p className="text-petrol-800 dark:text-white whitespace-pre-wrap">{showDetail.notes}</p>
                </div>
              )}

              {/* Stats */}
              {clientStats && (
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-white dark:bg-slate-700 rounded-lg p-3 border border-petrol-200 dark:border-slate-600">
                    <p className="text-xs text-petrol-500 dark:text-petrol-400">Pedidos</p>
                    <p className="text-xl font-bold text-petrol-800 dark:text-white">{clientStats.totalOrders}</p>
                  </div>
                  <div className="bg-white dark:bg-slate-700 rounded-lg p-3 border border-petrol-200 dark:border-slate-600">
                    <p className="text-xs text-petrol-500 dark:text-petrol-400">Entregados</p>
                    <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{clientStats.deliveredCount}</p>
                  </div>
                  <div className="bg-white dark:bg-slate-700 rounded-lg p-3 border border-petrol-200 dark:border-slate-600">
                    <p className="text-xs text-petrol-500 dark:text-petrol-400">Total gastado</p>
                    <p className="text-lg font-bold text-violet-600 dark:text-violet-400">${clientStats.totalSpent.toLocaleString()}</p>
                  </div>
                  <div className="bg-white dark:bg-slate-700 rounded-lg p-3 border border-petrol-200 dark:border-slate-600">
                    <p className="text-xs text-petrol-500 dark:text-petrol-400">Pendiente</p>
                    <p className="text-lg font-bold text-amber-600 dark:text-amber-400">${clientStats.pendingBalance.toLocaleString()}</p>
                  </div>
                </div>
              )}

              {/* Orders list */}
              <div>
                <h3 className="text-sm font-semibold text-petrol-700 dark:text-petrol-300 mb-2">Historial de pedidos</h3>
                {clientOrders.length === 0 ? (
                  <p className="text-xs text-petrol-400">Sin pedidos registrados</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {clientOrders.map(order => (
                      <button
                        key={order.id}
                        onClick={() => { setShowDetail(null); onNavigate('order-detail', order.id); }}
                        className="w-full text-left px-3 py-2 bg-white dark:bg-slate-700 rounded-lg border border-petrol-200 dark:border-slate-600 hover:border-violet-400 transition-colors text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-violet-600 dark:text-violet-400">{order.order_number}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG]?.bgClass} ${STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG]?.textClass}`}>
                            {STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG]?.label}
                          </span>
                        </div>
                        <div className="text-xs text-petrol-500 dark:text-petrol-400 mt-0.5">
                          {order.article_name || order.garment_type} - ${Number(order.price).toLocaleString()}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="p-5 border-t border-petrol-200 dark:border-slate-700 flex gap-3 justify-end">
              {showDetail.whatsapp && (
                <a
                  href={getWhatsAppLink(showDetail.whatsapp, `Hola ${showDetail.business_name || showDetail.name}, te escribimos de CEO MODELTEX.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <MessageCircle size={16} /> WhatsApp
                </a>
              )}
              <button
                onClick={() => { setShowDetail(null); openEditClient(showDetail); }}
                className="px-4 py-2.5 bg-petrol-600 hover:bg-petrol-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Edit3 size={16} /> Editar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-sm bg-crudo-50 dark:bg-slate-800 rounded-xl shadow-xl border border-petrol-200 dark:border-slate-700 p-5">
            <h3 className="text-lg font-semibold text-petrol-800 dark:text-white mb-2">Eliminar cliente</h3>
            <p className="text-sm text-petrol-600 dark:text-petrol-400 mb-4">
              ¿Estás seguro de que querés eliminar este cliente? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-white dark:bg-slate-700 text-petrol-600 dark:text-petrol-300 border border-petrol-200 dark:border-slate-600 rounded-lg text-sm font-medium hover:bg-petrol-50 dark:hover:bg-slate-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
