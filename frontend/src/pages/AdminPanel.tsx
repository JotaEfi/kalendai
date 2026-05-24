import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Plus, Mail, Lock, CheckCircle, AlertTriangle, Copy, Trash2, Shield } from 'lucide-react';
import api from '../services/api';

interface GroupMember {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

interface UserGroup {
  id: string;
  name: string;
  createdAt: string;
  users: GroupMember[];
}

export default function AdminPanel() {
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  // New Group Form State
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  // New User Form State
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('USER');
  const [newUserGroupId, setNewUserGroupId] = useState('');
  const [manualMode, setManualMode] = useState(true); // default to manual fallback for local/dev
  const [newUserPassword, setNewUserPassword] = useState('');
  const [invitingUser, setInvitingUser] = useState(false);

  // Success Credentials Modal State
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; name: string; password?: string; method: 'smtp' | 'manual' } | null>(null);

  // Status Notification Banners
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch groups and members
  const fetchGroups = async () => {
    try {
      setLoadingGroups(true);
      const res = await api.get('/admin/groups');
      setGroups(res.data);
      if (res.data.length > 0 && !newUserGroupId) {
        setNewUserGroupId(res.data[0].id);
      }
    } catch (err) {
      console.error('Error fetching groups:', err);
      setErrorMsg('Erro ao carregar lista de grupos e membros.');
    } finally {
      setLoadingGroups(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    try {
      setCreatingGroup(true);
      setErrorMsg('');
      const res = await api.post('/admin/groups', { name: newGroupName });
      setSuccessMsg(`Grupo "${res.data.name}" criado com sucesso!`);
      setNewGroupName('');
      fetchGroups();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.response?.data?.error || 'Erro ao criar grupo.');
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserName || !newUserGroupId) return;

    try {
      setInvitingUser(true);
      setErrorMsg('');
      setSuccessMsg('');

      const payload: any = {
        email: newUserEmail,
        name: newUserName,
        groupId: newUserGroupId,
        role: newUserRole
      };

      if (manualMode) {
        if (!newUserPassword || newUserPassword.length < 6) {
          setErrorMsg('A senha inicial do usuário deve possuir no mínimo 6 caracteres.');
          setInvitingUser(false);
          return;
        }
        payload.password = newUserPassword;
      }

      const res = await api.post('/admin/users/invite', payload);

      if (res.data.success) {
        setNewUserEmail('');
        setNewUserName('');
        setNewUserPassword('');
        
        // Show created user details and temporary password if generated or set
        setCreatedCredentials({
          email: res.data.user.email,
          name: res.data.user.name,
          password: manualMode ? newUserPassword : res.data.temporaryPassword,
          method: res.data.sentEmail ? 'smtp' : 'manual'
        });
        setShowCredentialsModal(true);

        if (res.data.sentEmail) {
          setSuccessMsg(`Convite automatizado via SMTP enviado para ${res.data.user.email}!`);
        } else {
          setSuccessMsg(`Usuário "${res.data.user.name}" cadastrado manualmente com sucesso no grupo!`);
        }

        fetchGroups();
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.response?.data?.error || 'Erro ao convidar/cadastrar usuário.');
    } finally {
      setInvitingUser(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdCredentials) return;
    const text = `Acesso ao KalendAI:\nE-mail: ${createdCredentials.email}\nSenha: ${createdCredentials.password || 'Enviada por e-mail'}`;
    navigator.clipboard.writeText(text);
    alert('Credenciais copiadas para a área de transferência!');
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 overflow-y-auto h-full pb-16">
      
      {/* BANNER DE NOTIFICAÇÃO */}
      {successMsg && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 text-emerald-800 p-4 rounded-lg flex items-center gap-3 shadow-sm transition-all duration-300">
          <CheckCircle className="text-emerald-500 shrink-0" size={20} />
          <span className="text-sm font-medium">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 border-l-4 border-rose-500 text-rose-800 p-4 rounded-lg flex items-center gap-3 shadow-sm transition-all duration-300">
          <AlertTriangle className="text-rose-500 shrink-0" size={20} />
          <span className="text-sm font-medium">{errorMsg}</span>
        </div>
      )}

      {/* DASHBOARD GRID DE ADMIN */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLUNA 1: CONFIGURAÇÃO DE GRUPOS */}
        <div className="bg-white rounded-2xl border border-[#DFE1E6] shadow-sm p-6 flex flex-col gap-6 h-fit">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <Users size={20} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-800">Gerenciar Grupos</h3>
              <p className="text-xs text-gray-400">Criação de redes internas</p>
            </div>
          </div>

          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Nome do Novo Grupo</label>
              <input
                type="text"
                placeholder="Ex: Time Marketing, Suporte, etc."
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                className="w-full mt-1.5 px-4 py-2.5 text-sm border rounded-xl focus:outline-none focus:border-[#0079bf] bg-gray-50/50 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                required
              />
            </div>
            <button
              type="submit"
              disabled={creatingGroup || !newGroupName.trim()}
              className="w-full bg-[#0079bf] hover:bg-[#0079bf]/90 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Plus size={16} />
              {creatingGroup ? 'Criando...' : 'Criar Novo Grupo'}
            </button>
          </form>
        </div>

        {/* COLUNA 2: CADASTRO / CONVITE DE MEMBROS */}
        <div className="bg-white rounded-2xl border border-[#DFE1E6] shadow-sm p-6 flex flex-col gap-6 lg:col-span-2 h-fit">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sky-50 text-sky-600 rounded-xl flex items-center justify-center">
              <UserPlus size={20} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-800">Convidar & Adicionar Membros</h3>
              <p className="text-xs text-gray-400">Integre novos usuários ao sistema</p>
            </div>
          </div>

          {groups.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
              <Users className="mx-auto text-gray-300 mb-2" size={32} />
              <p className="text-sm text-gray-500 font-medium">Crie pelo menos um grupo na coluna ao lado para convidar membros.</p>
            </div>
          ) : (
            <form onSubmit={handleInviteUser} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Grupo da Rede Interna</label>
                  <select
                    value={newUserGroupId}
                    onChange={e => setNewUserGroupId(e.target.value)}
                    className="w-full mt-1.5 px-4 py-2.5 text-sm border rounded-xl focus:outline-none focus:border-[#0079bf] bg-gray-50/50"
                    required
                  >
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Nome Completo</label>
                  <input
                    type="text"
                    placeholder="Ex: João da Silva"
                    value={newUserName}
                    onChange={e => setNewUserName(e.target.value)}
                    className="w-full mt-1.5 px-4 py-2.5 text-sm border rounded-xl focus:outline-none focus:border-[#0079bf] bg-gray-50/50"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">E-mail do Usuário</label>
                  <input
                    type="email"
                    placeholder="Ex: joao@empresa.com"
                    value={newUserEmail}
                    onChange={e => setNewUserEmail(e.target.value)}
                    className="w-full mt-1.5 px-4 py-2.5 text-sm border rounded-xl focus:outline-none focus:border-[#0079bf] bg-gray-50/50"
                    required
                  />
                </div>
              </div>

              <div className="space-y-4 flex flex-col justify-between">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Privilégio no Sistema</label>
                  <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="radio" name="role" value="USER" checked={newUserRole === 'USER'} onChange={() => setNewUserRole('USER')} className="text-[#0079bf] focus:ring-[#0079bf]" />
                      Colaborador Comum (User)
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="radio" name="role" value="ADMIN" checked={newUserRole === 'ADMIN'} onChange={() => setNewUserRole('ADMIN')} className="text-[#0079bf] focus:ring-[#0079bf]" />
                      Administrador (Admin)
                    </label>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={manualMode}
                      onChange={e => setManualMode(e.target.checked)}
                      className="rounded text-[#0079bf] focus:ring-[#0079bf] w-4 h-4"
                    />
                    Cadastrar Manualmente (Definir Senha Inicial)
                  </label>
                  <p className="text-[10px] text-gray-400 mt-1">Desative caso queira enviar um convite de cadastro automatizado via SMTP.</p>
                </div>

                {manualMode ? (
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Senha Inicial Temporária</label>
                    <input
                      type="password"
                      placeholder="Senha com no mínimo 6 caracteres"
                      value={newUserPassword}
                      onChange={e => setNewUserPassword(e.target.value)}
                      className="w-full mt-1.5 px-4 py-2.5 text-sm border rounded-xl focus:outline-none focus:border-[#0079bf] bg-gray-50/50"
                      required={manualMode}
                    />
                  </div>
                ) : (
                  <div className="bg-sky-50 rounded-xl p-3 border border-sky-100 flex items-start gap-2.5">
                    <Mail className="text-sky-600 shrink-0 mt-0.5" size={16} />
                    <p className="text-xs text-sky-800 leading-normal"><strong>Modo SMTP ativo:</strong> Uma senha randômica super segura será gerada e o usuário receberá o link de acesso diretamente em seu e-mail.</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={invitingUser}
                  className="w-full bg-[#0079bf] hover:bg-[#0079bf]/90 text-white font-semibold py-3 px-4 rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2 mt-4"
                >
                  <Plus size={16} />
                  {invitingUser ? 'Cadastrando...' : (manualMode ? 'Cadastrar Manualmente' : 'Enviar E-mail de Convite')}
                </button>
              </div>

            </form>
          )}
        </div>

      </div>

      {/* SEÇÃO 3: LISTAGEM DE GRUPOS E SEUS MEMBROS */}
      <div className="bg-white rounded-2xl border border-[#DFE1E6] shadow-sm p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Shield className="text-gray-400" size={20} />
          <h3 className="font-bold text-lg text-gray-800">Redes Internas Ativas</h3>
        </div>

        {loadingGroups ? (
          <div className="text-center py-12 text-gray-400 text-sm font-medium">Carregando grupos e membros cadastrados...</div>
        ) : groups.length === 0 ? (
          <div className="text-center py-12 border border-dashed rounded-xl text-gray-400 text-sm">Nenhum grupo ou usuário cadastrado além do administrador principal.</div>
        ) : (
          <div className="space-y-6">
            {groups.map(group => (
              <div key={group.id} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-base text-gray-800">{group.name}</span>
                    <span className="text-[10px] text-gray-400 font-semibold uppercase">({group.users.length} membros)</span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-bold">CRIADO EM {new Date(group.createdAt).toLocaleDateString('pt-BR')}</span>
                </div>
                
                {group.users.length === 0 ? (
                  <p className="px-6 py-4 text-xs text-gray-400 italic">Nenhum usuário associado a este grupo ainda.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50/50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          <th className="px-6 py-3">Nome</th>
                          <th className="px-6 py-3">E-mail</th>
                          <th className="px-6 py-3">Nível de Acesso</th>
                          <th className="px-6 py-3">Integrado em</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                        {group.users.map(user => (
                          <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-3.5 font-semibold text-gray-800">{user.name}</td>
                            <td className="px-6 py-3.5 text-gray-500 font-mono text-xs">{user.email}</td>
                            <td className="px-6 py-3.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                                user.role === 'ADMIN' ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {user.role}
                              </span>
                            </td>
                            <td className="px-6 py-3.5 text-gray-400 text-xs">{new Date(user.createdAt).toLocaleDateString('pt-BR')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL DE EXIBIÇÃO DE CREDENCIAIS CADASTRADAS (POPUP) */}
      {showCredentialsModal && createdCredentials && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-6 border border-gray-100 flex flex-col gap-6 relative animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                <CheckCircle size={20} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-800">Usuário Integrado!</h3>
                <p className="text-xs text-gray-400">Compartilhe as credenciais geradas abaixo</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3 font-mono text-sm">
              <div className="flex flex-col gap-1 border-b border-gray-200 pb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-sans">Nome</span>
                <span className="text-gray-800 font-medium">{createdCredentials.name}</span>
              </div>
              <div className="flex flex-col gap-1 border-b border-gray-200 pb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-sans">E-mail</span>
                <span className="text-gray-800 font-medium">{createdCredentials.email}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-sans">Senha Temporária</span>
                <span className="text-rose-600 font-bold select-all">{createdCredentials.password || '(Enviada por e-mail automaticamente)'}</span>
              </div>
            </div>

            {createdCredentials.password && (
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-100 flex items-start gap-2.5">
                <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={16} />
                <p className="text-[11px] text-amber-800 leading-normal font-medium"><strong>Atenção:</strong> Esta senha não será exibida novamente por motivos de segurança. Copie agora e envie de forma privada ao novo membro.</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCredentialsModal(false);
                  setCreatedCredentials(null);
                }}
                className="flex-1 px-4 py-2.5 border border-gray-200 hover:bg-gray-50 rounded-xl font-bold text-sm text-gray-600 transition-colors"
              >
                Fechar
              </button>
              {createdCredentials.password && (
                <button
                  onClick={handleCopyCredentials}
                  className="flex-1 px-4 py-2.5 bg-[#0079bf] hover:bg-[#0079bf]/90 text-white rounded-xl font-bold text-sm shadow-sm flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Copy size={16} />
                  Copiar Acesso
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
