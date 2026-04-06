import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  fetchAdminUsers,
  fetchAdminFlags,
  updateAdminUser,
  updateAdminFlag,
  type AdminUser,
  type AdminFlag,
} from '../api/admin'
import { Shield, Users, ToggleLeft, ToggleRight } from 'lucide-react'

export default function Admin() {
  const { t } = useTranslation()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [flags, setFlags] = useState<AdminFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'users' | 'flags'>('users')

  useEffect(() => {
    async function load() {
      try {
        const [u, f] = await Promise.all([fetchAdminUsers(), fetchAdminFlags()])
        setUsers(u)
        setFlags(f)
      } catch {
        // handled by interceptor
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function toggleUserActive(user: AdminUser) {
    await updateAdminUser(user.id, { is_active: !user.is_active })
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, is_active: !u.is_active } : u)),
    )
  }

  async function changeRole(userId: string, role: string) {
    await updateAdminUser(userId, { role })
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role } : u)),
    )
  }

  async function toggleFlag(flag: AdminFlag) {
    await updateAdminFlag(flag.id, !flag.is_enabled)
    setFlags((prev) =>
      prev.map((f) => (f.id === flag.id ? { ...f, is_enabled: !f.is_enabled } : f)),
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">{t('admin.title')}</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'users' ? 'bg-primary text-primary-foreground' : 'glass text-foreground hover:bg-muted'
          }`}
        >
          <Users className="w-4 h-4" />
          {t('admin.users')}
        </button>
        <button
          onClick={() => setTab('flags')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'flags' ? 'bg-primary text-primary-foreground' : 'glass text-foreground hover:bg-muted'
          }`}
        >
          <ToggleLeft className="w-4 h-4" />
          {t('admin.featureFlags')}
        </button>
      </div>

      {/* Users Tab */}
      {tab === 'users' && (
        <div className="glass rounded-2xl p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-start pb-3 font-medium">{t('admin.name')}</th>
                  <th className="text-start pb-3 font-medium">{t('admin.emailCol')}</th>
                  <th className="text-start pb-3 font-medium">{t('admin.org')}</th>
                  <th className="text-start pb-3 font-medium">{t('admin.role')}</th>
                  <th className="text-start pb-3 font-medium">{t('admin.status')}</th>
                  <th className="text-start pb-3 font-medium">{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                    <td className="py-3 text-foreground">{user.full_name}</td>
                    <td className="py-3 text-foreground">{user.email}</td>
                    <td className="py-3 text-muted-foreground">{user.organization_name}</td>
                    <td className="py-3">
                      <select
                        value={user.role}
                        onChange={(e) => changeRole(user.id, e.target.value)}
                        className="glass rounded-md px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="viewer">viewer</option>
                        <option value="manager">manager</option>
                        <option value="admin">admin</option>
                        <option value="system_admin">system_admin</option>
                      </select>
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          user.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {user.is_active ? t('admin.active') : t('admin.inactive')}
                      </span>
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => toggleUserActive(user)}
                        className="text-xs text-primary hover:underline"
                      >
                        {user.is_active ? t('admin.deactivate') : t('admin.activate')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Feature Flags Tab */}
      {tab === 'flags' && (
        <div className="glass rounded-2xl p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-start pb-3 font-medium">{t('admin.planTier')}</th>
                  <th className="text-start pb-3 font-medium">{t('admin.feature')}</th>
                  <th className="text-start pb-3 font-medium">{t('admin.enabled')}</th>
                </tr>
              </thead>
              <tbody>
                {flags.map((flag) => (
                  <tr key={flag.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                    <td className="py-3">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground">
                        {flag.plan_tier}
                      </span>
                    </td>
                    <td className="py-3 text-foreground">{flag.feature_name}</td>
                    <td className="py-3">
                      <button onClick={() => toggleFlag(flag)} className="text-primary">
                        {flag.is_enabled ? (
                          <ToggleRight className="w-6 h-6" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-muted-foreground" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
