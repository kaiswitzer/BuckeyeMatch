import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import AppHeader from '../components/AppHeader'
import { useAuth } from '../context/AuthContext'

const SURVEY_QUESTIONS = [
  { key: 'work_style',          label: 'How do you prefer to work?',                       options: ['Independently', 'Collaboratively', 'Mix of both'] },
  { key: 'communication_style', label: 'How would you describe your communication style?',  options: ['Direct and concise', 'Thoughtful and detailed', 'Depends on the situation'] },
  { key: 'motivation',          label: 'What motivates you most in your career?',           options: ['Financial reward', 'Making an impact', 'Learning and growth', 'Status and prestige'] },
  { key: 'work_environment',    label: 'What work environment fits you best?',              options: ['Fast-paced and high pressure', 'Structured and stable', 'Creative and flexible'] },
  { key: 'strengths',           label: 'What is your biggest professional strength?',       options: ['Analytical thinking', 'Relationship building', 'Leadership', 'Creativity'] },
  { key: 'industry_interest',   label: 'Which industry excites you most?',                 options: ['Finance', 'Consulting', 'Tech', 'Healthcare', 'Marketing'] },
  { key: 'role_type',           label: 'What type of role appeals to you?',                options: ['Client-facing', 'Behind the scenes', 'Leadership / management', 'Technical / specialist'] },
  { key: 'company_size',        label: 'What company size do you prefer?',                 options: ['Large corporation', 'Mid-size company', 'Small startup'] },
  { key: 'networking_comfort',  label: 'How comfortable are you with networking?',         options: ['Very comfortable', 'Somewhat comfortable', 'Uncomfortable but trying', 'Very uncomfortable'] },
  { key: 'career_goal',         label: 'What is your long-term career goal?',              options: ['Corporate executive', 'Entrepreneur', 'Expert / specialist', 'Work-life balance focused'] },
]

function formatMessageTime(isoString) {
  const date = new Date(isoString)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' · ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function AdminMessageBubble({ body, sentAt, align, senderLabel }) {
  const isRight = align === 'right'
  return (
    <div className={`flex ${isRight ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-xs sm:max-w-sm lg:max-w-md">
        {senderLabel && (
          <p className={`text-xs text-gray-500 mb-1 ${isRight ? 'text-right' : 'text-left'}`}>
            {senderLabel}
          </p>
        )}
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
            isRight
              ? 'text-white rounded-br-sm'
              : 'bg-gray-100 text-gray-800 rounded-bl-sm'
          }`}
          style={isRight ? { backgroundColor: '#BB0000' } : {}}
        >
          {body}
        </div>
        <p className={`text-xs text-gray-400 mt-1 ${isRight ? 'text-right' : 'text-left'}`}>
          {formatMessageTime(sentAt)}
        </p>
      </div>
    </div>
  )
}

function formatUserLabel({ first_name, last_name, email, id, profile_id, account_type }) {
  const name = (first_name && last_name) ? `${first_name} ${last_name}` : (email || 'Unknown')
  const profLabel = profile_id != null
    ? `${account_type === 'alumni' ? 'alumni_profile' : 'student_profile'} ${profile_id}`
    : 'profile —'
  const userLabel = id != null ? `user ${id}` : 'user —'
  return `${name} (${userLabel}, ${profLabel})`
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
        active ? 'bg-red-50' : 'hover:bg-gray-50'
      }`}
      style={active ? { color: '#BB0000' } : { color: '#4B5563' }}
    >
      {children}
    </button>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  )
}

export default function Admin() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [tab, setTab] = useState('users') // users | profiles | messages | wins | matches | matching
  const [error, setError] = useState('')

  // Users
  const [q, setQ] = useState('')
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [newUser, setNewUser] = useState({ email: '', password: '', account_type: 'student', is_admin: false })
  const [creatingUser, setCreatingUser] = useState(false)
  const [pwUserId, setPwUserId] = useState(null)
  const [pwForm, setPwForm] = useState({ password: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState('')

  // Profiles
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileLoadedUser, setProfileLoadedUser] = useState(null)
  const [profileAccountType, setProfileAccountType] = useState(null)

  const [studentBasic, setStudentBasic] = useState({
    first_name: '', last_name: '', major: '', minor: '', year: 'junior', hometown: '', bio: ''
  })
  const [studentTargets, setStudentTargets] = useState([{ company_name: '', role_name: '' }])
  const [studentSurvey, setStudentSurvey] = useState({})

  const [alumniBasic, setAlumniBasic] = useState({
    first_name: '', last_name: '', current_company: '', current_role: '', career_summary: '', bio: ''
  })
  const [alumniHistory, setAlumniHistory] = useState([{ company_name: '', role_name: '', start_year: '', end_year: '' }])
  const [alumniAvailability, setAlumniAvailability] = useState('open')
  const [alumniShowHelpedCount, setAlumniShowHelpedCount] = useState(true)

  // Messages (per-user threads + global search)
  const [messageUserId, setMessageUserId] = useState(null)
  const [threadsLoading, setThreadsLoading] = useState(false)
  const [threads, setThreads] = useState([])
  const [selectedMatchId, setSelectedMatchId] = useState(null)
  const [threadLoading, setThreadLoading] = useState(false)
  // [{ message: Message.to_dict, sender: User.to_dict|null }]
  const [threadMessages, setThreadMessages] = useState([])
  const [threadLeftSenderId, setThreadLeftSenderId] = useState(null)

  const [messageSearchQ, setMessageSearchQ] = useState('')
  const [messageSearching, setMessageSearching] = useState(false)
  const [messageSearchResults, setMessageSearchResults] = useState([])

  // Wins / milestones
  const [winsUserId, setWinsUserId] = useState(null)
  const [winsLoading, setWinsLoading] = useState(false)
  const [milestones, setMilestones] = useState([]) // enriched items from /admin/milestones
  const [winsMatchesLoading, setWinsMatchesLoading] = useState(false)
  const [winsMatches, setWinsMatches] = useState([])

  // Matches
  const [matches, setMatches] = useState([])
  const [loadingMatches, setLoadingMatches] = useState(false)

  // Nightly matching run
  const [runSummary, setRunSummary] = useState(null)
  const [running, setRunning] = useState(false)

  const fetchUserProfile = async (userId) => {
    if (!userId) return
    setError('')
    setProfileLoading(true)
    try {
      const res = await api.get(`/admin/users/${userId}/profile`)
      const accountType = res.data.account_type
      const p = res.data.profile
      const extras = res.data.extras || {}

      setProfileLoadedUser(res.data.user || null)
      setProfileAccountType(accountType)

      if (accountType === 'student') {
        setStudentBasic({
          first_name: p?.first_name ?? '',
          last_name: p?.last_name ?? '',
          major: p?.major ?? '',
          minor: p?.minor ?? '',
          year: p?.year ?? 'junior',
          hometown: p?.hometown ?? '',
          bio: p?.bio ?? '',
        })
        const t = extras.targets ?? p?.targets ?? []
        setStudentTargets(
          Array.isArray(t) && t.length > 0
            ? t.map(x => ({ company_name: x.company_name ?? '', role_name: x.role_name ?? '' }))
            : [{ company_name: '', role_name: '' }]
        )
        setStudentSurvey(extras.survey?.responses ?? {})
      } else {
        setAlumniBasic({
          first_name: p?.first_name ?? '',
          last_name: p?.last_name ?? '',
          current_company: p?.current_company ?? '',
          current_role: p?.current_role ?? '',
          career_summary: p?.career_summary ?? '',
          bio: p?.bio ?? '',
        })
        const h = extras.history ?? p?.history ?? []
        setAlumniHistory(
          Array.isArray(h) && h.length > 0
            ? h.map(x => ({
              company_name: x.company_name ?? '',
              role_name: x.role_name ?? '',
              start_year: x.start_year != null ? String(x.start_year) : '',
              end_year: x.end_year != null ? String(x.end_year) : '',
            }))
            : [{ company_name: '', role_name: '', start_year: '', end_year: '' }]
        )
        setAlumniAvailability(p?.availability ?? 'open')
        setAlumniShowHelpedCount(p?.show_helped_count !== false)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load profile.')
    } finally {
      setProfileLoading(false)
    }
  }

  const saveSelectedUserProfile = async () => {
    if (!selectedUserId || !profileAccountType) return
    setError('')
    setProfileSaving(true)
    try {
      if (profileAccountType === 'student') {
        const filledTargets = (studentTargets || []).filter(t => (t.company_name || '').trim())
        const payload = {
          ...studentBasic,
          targets: filledTargets,
          survey: { responses: studentSurvey || {} },
        }
        await api.patch(`/admin/users/${selectedUserId}/profile`, payload)
      } else {
        const filledHistory = (alumniHistory || []).filter(h => (h.company_name || '').trim()).map(h => ({
          company_name: h.company_name,
          role_name: h.role_name,
          start_year: h.start_year ? parseInt(h.start_year) : null,
          end_year: h.end_year ? parseInt(h.end_year) : null,
        }))
        const payload = {
          ...alumniBasic,
          availability: alumniAvailability,
          show_helped_count: alumniShowHelpedCount,
          history: filledHistory,
        }
        await api.patch(`/admin/users/${selectedUserId}/profile`, payload)
      }
      await fetchUserProfile(selectedUserId)
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save profile.')
    } finally {
      setProfileSaving(false)
    }
  }

  const fetchThreadsForUser = async (userId) => {
    if (!userId) return
    setError('')
    setThreadsLoading(true)
    setSelectedMatchId(null)
    setThreadMessages([])
    setThreadLeftSenderId(null)
    try {
      const res = await api.get(`/admin/users/${userId}/matches`)
      setThreads(res.data.matches ?? [])
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load threads.')
    } finally {
      setThreadsLoading(false)
    }
  }

  const openThread = async (matchId) => {
    if (!matchId) return
    setError('')
    setSelectedMatchId(matchId)
    setThreadLoading(true)
    try {
      const res = await api.get('/admin/messages', { params: { match_id: matchId } })
      const items = res.data.messages ?? []
      setThreadMessages(items)
      const firstSenderId = items?.[0]?.message?.sender_id ?? null
      setThreadLeftSenderId(firstSenderId)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load messages.')
    } finally {
      setThreadLoading(false)
    }
  }

  const searchMessages = async () => {
    setError('')
    setMessageSearching(true)
    try {
      const res = await api.get('/admin/messages/search', { params: { q: messageSearchQ, limit: 50, offset: 0 } })
      setMessageSearchResults(res.data.results ?? [])
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to search messages.')
    } finally {
      setMessageSearching(false)
    }
  }

  const fetchMilestones = async ({ userId } = {}) => {
    setError('')
    setWinsLoading(true)
    try {
      const res = await api.get('/admin/milestones', {
        params: userId ? { user_id: userId } : {},
      })
      setMilestones(res.data.milestones ?? [])
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load wins.')
    } finally {
      setWinsLoading(false)
    }
  }

  const fetchWinsMatches = async ({ userId } = {}) => {
    setError('')
    setWinsMatchesLoading(true)
    try {
      const res = userId
        ? await api.get(`/admin/users/${userId}/matches`)
        : await api.get('/admin/matches')
      setWinsMatches(res.data.matches ?? [])
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load match outcomes.')
    } finally {
      setWinsMatchesLoading(false)
    }
  }

  const fetchUsers = async () => {
    setError('')
    setLoadingUsers(true)
    try {
      const res = await api.get('/admin/users', { params: q ? { q } : {} })
      setUsers(res.data.users ?? [])
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load users.')
    } finally {
      setLoadingUsers(false)
    }
  }

  const fetchMatches = async () => {
    setError('')
    setLoadingMatches(true)
    try {
      const res = await api.get('/admin/matches')
      setMatches(res.data.matches ?? [])
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load matches.')
    } finally {
      setLoadingMatches(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    if (tab === 'matches') fetchMatches()
  }, [tab])

  const handleCreateUser = async () => {
    setError('')
    setCreatingUser(true)
    try {
      await api.post('/admin/users', {
        email: newUser.email,
        password: newUser.password,
        account_type: newUser.account_type,
        is_admin: newUser.is_admin,
        is_verified: true,
      })
      setNewUser({ email: '', password: '', account_type: 'student', is_admin: false })
      await fetchUsers()
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create user.')
    } finally {
      setCreatingUser(false)
    }
  }

  const toggleAdmin = async (u) => {
    setError('')
    try {
      await api.patch(`/admin/users/${u.id}`, { is_admin: !u.is_admin })
      await fetchUsers()
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update user.')
    }
  }

  const openPasswordReset = (u) => {
    setPwError('')
    setPwUserId(u.id)
    setPwForm({ password: '', confirm: '' })
  }

  const cancelPasswordReset = () => {
    setPwError('')
    setPwUserId(null)
    setPwForm({ password: '', confirm: '' })
  }

  const savePasswordReset = async () => {
    if (!pwUserId) return
    setPwError('')
    if (pwForm.password !== pwForm.confirm) {
      setPwError('Passwords do not match.')
      return
    }
    if ((pwForm.password || '').length < 8) {
      setPwError('Password must be at least 8 characters.')
      return
    }
    setPwSaving(true)
    try {
      await api.patch(`/admin/users/${pwUserId}/password`, { password: pwForm.password })
      cancelPasswordReset()
    } catch (err) {
      setPwError(err.response?.data?.error || 'Could not update password.')
    } finally {
      setPwSaving(false)
    }
  }

  const deleteUser = async (u) => {
    if (!window.confirm(`Delete user ${u.email}? This removes their profile and matches.`)) return
    setError('')
    try {
      await api.delete(`/admin/users/${u.id}`)
      await fetchUsers()
    } catch (err) {
      setError(err.response?.data?.error || 'Could not delete user.')
    }
  }

  const deleteMatch = async (m) => {
    if (!window.confirm(`Delete match #${m.match.id}?`)) return
    setError('')
    try {
      await api.delete(`/admin/matches/${m.match.id}`)
      await fetchMatches()
    } catch (err) {
      setError(err.response?.data?.error || 'Could not delete match.')
    }
  }

  const runNightly = async () => {
    setError('')
    setRunning(true)
    setRunSummary(null)
    try {
      const res = await api.post('/admin/matches/run_nightly', { max_students: 200, skip_if_pending: true })
      setRunSummary(res.data.summary ?? null)
    } catch (err) {
      setError(err.response?.data?.error || 'Could not run nightly matching.')
    } finally {
      setRunning(false)
    }
  }

  const filteredUsersCount = useMemo(() => users.length, [users])

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title="Admin"
        right={(
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const dest = user?.account_type === 'alumni' ? '/dashboard/alumni' : '/dashboard/student'
                navigate(dest)
              }}
              className="text-sm font-medium px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
            >
              Dashboard
            </button>
            <TabButton active={tab === 'users'} onClick={() => setTab('users')}>Users</TabButton>
            <TabButton active={tab === 'profiles'} onClick={() => setTab('profiles')}>Profiles</TabButton>
            <TabButton active={tab === 'messages'} onClick={() => setTab('messages')}>Messages</TabButton>
            <TabButton active={tab === 'wins'} onClick={() => {
              setTab('wins')
              fetchMilestones({ userId: winsUserId })
              fetchWinsMatches({ userId: winsUserId })
            }}>Wins</TabButton>
            <TabButton active={tab === 'matches'} onClick={() => setTab('matches')}>Matches</TabButton>
            <TabButton active={tab === 'matching'} onClick={() => setTab('matching')}>Matching</TabButton>
          </div>
        )}
        maxWidthClassName="max-w-4xl"
      />

      <main className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {tab === 'users' && (
          <>
            <Section title="Create user">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm"
                  placeholder="email@osu.edu"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                />
                <input
                  className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm"
                  placeholder="temp password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                />
                <select
                  className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm"
                  value={newUser.account_type}
                  onChange={(e) => setNewUser({ ...newUser, account_type: e.target.value })}
                >
                  <option value="student">student</option>
                  <option value="alumni">alumni</option>
                </select>
              </div>
              <div className="flex items-center justify-between mt-3">
                <label className="text-sm text-gray-600 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newUser.is_admin}
                    onChange={(e) => setNewUser({ ...newUser, is_admin: e.target.checked })}
                  />
                  Admin
                </label>
                <button
                  type="button"
                  onClick={handleCreateUser}
                  disabled={creatingUser}
                  className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: '#BB0000' }}
                >
                  {creatingUser ? 'Creating…' : 'Create'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-3">Creates a verified user with a password (for testing).</p>
            </Section>

            <Section title={`Users (${filteredUsersCount})`}>
              <div className="flex items-center gap-3 mb-4">
                <input
                  className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm"
                  placeholder="Search email…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <button
                  type="button"
                  onClick={fetchUsers}
                  disabled={loadingUsers}
                  className="px-4 py-2.5 rounded-lg text-sm font-semibold border border-gray-200 text-gray-700 disabled:opacity-50"
                >
                  {loadingUsers ? '…' : 'Search'}
                </button>
              </div>
              <div className="space-y-2">
                {users.map(u => (
                  <div key={u.id} className="px-4 py-3 rounded-xl border border-gray-100 bg-gray-50">
                    <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {formatUserLabel(u)}
                      </p>
                      <p className="text-xs text-gray-500">
                        verified {String(u.is_verified)} · admin {String(u.is_admin)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={async () => {
                          setSelectedUserId(u.id)
                          setTab('profiles')
                          await fetchUserProfile(u.id)
                        }}
                        className="text-xs font-medium text-gray-600 hover:text-gray-900"
                      >
                        Edit profile
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setMessageUserId(u.id)
                          setTab('messages')
                          await fetchThreadsForUser(u.id)
                        }}
                        className="text-xs font-medium text-gray-600 hover:text-gray-900"
                      >
                        View messages
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleAdmin(u)}
                        className="text-xs font-medium text-gray-600 hover:text-gray-900"
                      >
                        Toggle admin
                      </button>
                      <button
                        type="button"
                        onClick={() => openPasswordReset(u)}
                        className="text-xs font-medium text-gray-600 hover:text-gray-900"
                      >
                        Reset password
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteUser(u)}
                        className="text-xs font-medium text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </div>
                    </div>

                    {pwUserId === u.id && (
                      <div className="mt-3 bg-white border border-gray-100 rounded-xl p-4">
                        <p className="text-sm font-semibold text-gray-900">Set new password</p>
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm"
                            placeholder="New password (min 8)"
                            value={pwForm.password}
                            onChange={(e) => setPwForm({ ...pwForm, password: e.target.value })}
                          />
                          <input
                            className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm"
                            placeholder="Confirm password"
                            value={pwForm.confirm}
                            onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                          />
                        </div>
                        {pwError && (
                          <div className="mt-3 text-sm text-red-600">
                            {pwError}
                          </div>
                        )}
                        <div className="mt-3 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={cancelPasswordReset}
                            className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={savePasswordReset}
                            disabled={pwSaving}
                            className="px-3 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                            style={{ backgroundColor: '#BB0000' }}
                          >
                            {pwSaving ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}

        {tab === 'profiles' && (
          <>
            <Section title="Select a user">
              <div className="flex items-center gap-3">
                <select
                  className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm"
                  value={selectedUserId ?? ''}
                  onChange={async (e) => {
                    const id = e.target.value ? Number(e.target.value) : null
                    setSelectedUserId(id)
                    if (id) await fetchUserProfile(id)
                  }}
                >
                  <option value="">Choose a user…</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {formatUserLabel(u)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => selectedUserId && fetchUserProfile(selectedUserId)}
                  disabled={!selectedUserId || profileLoading}
                  className="px-4 py-2.5 rounded-lg text-sm font-semibold border border-gray-200 text-gray-700 disabled:opacity-50"
                >
                  {profileLoading ? '…' : 'Refresh'}
                </button>
              </div>
              {profileLoadedUser && (
                <p className="text-xs text-gray-500 mt-3">
                  Editing {profileLoadedUser.email} · {profileAccountType}
                </p>
              )}
            </Section>

            {selectedUserId && profileAccountType === 'student' && (
              <Section title="Student profile (admin edit)">
                {profileLoading ? (
                  <p className="text-sm text-gray-400">Loading…</p>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm"
                        placeholder="First name"
                        value={studentBasic.first_name}
                        onChange={(e) => setStudentBasic({ ...studentBasic, first_name: e.target.value })}
                      />
                      <input
                        className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm"
                        placeholder="Last name"
                        value={studentBasic.last_name}
                        onChange={(e) => setStudentBasic({ ...studentBasic, last_name: e.target.value })}
                      />
                      <input
                        className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm sm:col-span-2"
                        placeholder="Major"
                        value={studentBasic.major}
                        onChange={(e) => setStudentBasic({ ...studentBasic, major: e.target.value })}
                      />
                      <input
                        className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm"
                        placeholder="Minor (optional)"
                        value={studentBasic.minor}
                        onChange={(e) => setStudentBasic({ ...studentBasic, minor: e.target.value })}
                      />
                      <select
                        className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm"
                        value={studentBasic.year}
                        onChange={(e) => setStudentBasic({ ...studentBasic, year: e.target.value })}
                      >
                        <option value="freshman">freshman</option>
                        <option value="sophomore">sophomore</option>
                        <option value="junior">junior</option>
                        <option value="senior">senior</option>
                      </select>
                      <input
                        className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm sm:col-span-2"
                        placeholder="Hometown (optional)"
                        value={studentBasic.hometown}
                        onChange={(e) => setStudentBasic({ ...studentBasic, hometown: e.target.value })}
                      />
                      <textarea
                        className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm sm:col-span-2"
                        placeholder="Bio (optional)"
                        rows={3}
                        value={studentBasic.bio}
                        onChange={(e) => setStudentBasic({ ...studentBasic, bio: e.target.value })}
                      />
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-gray-900 mb-2">Targets</p>
                      <div className="space-y-2">
                        {studentTargets.map((t, i) => (
                          <div key={i} className="flex gap-2">
                            <input
                              className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm"
                              placeholder="Company"
                              value={t.company_name}
                              onChange={(e) => setStudentTargets(studentTargets.map((x, idx) => idx === i ? { ...x, company_name: e.target.value } : x))}
                            />
                            <input
                              className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm"
                              placeholder="Role"
                              value={t.role_name}
                              onChange={(e) => setStudentTargets(studentTargets.map((x, idx) => idx === i ? { ...x, role_name: e.target.value } : x))}
                            />
                            <button
                              type="button"
                              onClick={() => setStudentTargets(studentTargets.filter((_, idx) => idx !== i))}
                              className="text-xs font-medium text-gray-500 hover:text-red-700 px-2"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setStudentTargets([...studentTargets, { company_name: '', role_name: '' }])}
                        className="mt-3 text-sm font-medium"
                        style={{ color: '#BB0000' }}
                      >
                        + Add target
                      </button>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-gray-900 mb-2">Survey</p>
                      <div className="space-y-5">
                        {SURVEY_QUESTIONS.map(q => (
                          <div key={q.key}>
                            <p className="text-sm font-medium text-gray-800 mb-2">{q.label}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {q.options.map(opt => {
                                const val = opt.toLowerCase().replace(/ /g, '-')
                                const selected = studentSurvey?.[q.key] === val
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => setStudentSurvey({ ...(studentSurvey || {}), [q.key]: val })}
                                    className={`px-4 py-2.5 rounded-lg border text-sm transition ${
                                      selected ? 'bg-red-50' : 'border-gray-200 text-gray-700 hover:border-gray-300'
                                    }`}
                                    style={selected ? { borderColor: '#BB0000', color: '#BB0000' } : {}}
                                  >
                                    {opt}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-3">
                        Survey is required for matching; leaving answers blank will prevent saving.
                      </p>
                    </div>

                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={saveSelectedUserProfile}
                        disabled={profileSaving}
                        className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                        style={{ backgroundColor: '#BB0000' }}
                      >
                        {profileSaving ? 'Saving…' : 'Save profile'}
                      </button>
                    </div>
                  </div>
                )}
              </Section>
            )}

            {selectedUserId && profileAccountType === 'alumni' && (
              <Section title="Alumni profile (admin edit)">
                {profileLoading ? (
                  <p className="text-sm text-gray-400">Loading…</p>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm"
                        placeholder="First name"
                        value={alumniBasic.first_name}
                        onChange={(e) => setAlumniBasic({ ...alumniBasic, first_name: e.target.value })}
                      />
                      <input
                        className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm"
                        placeholder="Last name"
                        value={alumniBasic.last_name}
                        onChange={(e) => setAlumniBasic({ ...alumniBasic, last_name: e.target.value })}
                      />
                      <input
                        className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm sm:col-span-2"
                        placeholder="Current company"
                        value={alumniBasic.current_company}
                        onChange={(e) => setAlumniBasic({ ...alumniBasic, current_company: e.target.value })}
                      />
                      <input
                        className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm sm:col-span-2"
                        placeholder="Current role"
                        value={alumniBasic.current_role}
                        onChange={(e) => setAlumniBasic({ ...alumniBasic, current_role: e.target.value })}
                      />
                      <textarea
                        className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm sm:col-span-2"
                        placeholder="Career summary (optional)"
                        rows={3}
                        value={alumniBasic.career_summary}
                        onChange={(e) => setAlumniBasic({ ...alumniBasic, career_summary: e.target.value })}
                      />
                      <textarea
                        className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm sm:col-span-2"
                        placeholder="Bio (optional)"
                        rows={3}
                        value={alumniBasic.bio}
                        onChange={(e) => setAlumniBasic({ ...alumniBasic, bio: e.target.value })}
                      />
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-gray-900 mb-2">Availability</p>
                      <select
                        className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm"
                        value={alumniAvailability}
                        onChange={(e) => setAlumniAvailability(e.target.value)}
                      >
                        <option value="open">open</option>
                        <option value="limited">limited</option>
                        <option value="closed">closed</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-sm text-gray-700 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={alumniShowHelpedCount}
                          onChange={(e) => setAlumniShowHelpedCount(e.target.checked)}
                        />
                        Show “students helped” count
                      </label>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-gray-900 mb-2">History</p>
                      <div className="space-y-2">
                        {alumniHistory.map((h, i) => (
                          <div key={i} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
                            <input
                              className="sm:col-span-4 border border-gray-200 rounded-lg px-4 py-2.5 text-sm"
                              placeholder="Company"
                              value={h.company_name}
                              onChange={(e) => setAlumniHistory(alumniHistory.map((x, idx) => idx === i ? { ...x, company_name: e.target.value } : x))}
                            />
                            <input
                              className="sm:col-span-4 border border-gray-200 rounded-lg px-4 py-2.5 text-sm"
                              placeholder="Role"
                              value={h.role_name}
                              onChange={(e) => setAlumniHistory(alumniHistory.map((x, idx) => idx === i ? { ...x, role_name: e.target.value } : x))}
                            />
                            <div className="sm:col-span-4 flex flex-wrap gap-2 justify-start sm:justify-end">
                              <input
                                className="w-24 border border-gray-200 rounded-lg px-3 py-2.5 text-sm"
                                placeholder="Start"
                                value={h.start_year}
                                onChange={(e) => setAlumniHistory(alumniHistory.map((x, idx) => idx === i ? { ...x, start_year: e.target.value } : x))}
                              />
                              <input
                                className="w-24 border border-gray-200 rounded-lg px-3 py-2.5 text-sm"
                                placeholder="End"
                                value={h.end_year}
                                onChange={(e) => setAlumniHistory(alumniHistory.map((x, idx) => idx === i ? { ...x, end_year: e.target.value } : x))}
                              />
                              <button
                                type="button"
                                onClick={() => setAlumniHistory(alumniHistory.filter((_, idx) => idx !== i))}
                                className="text-xs font-medium text-gray-500 hover:text-red-700 px-2 py-2.5"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setAlumniHistory([...alumniHistory, { company_name: '', role_name: '', start_year: '', end_year: '' }])}
                        className="mt-3 text-sm font-medium"
                        style={{ color: '#BB0000' }}
                      >
                        + Add history row
                      </button>
                    </div>

                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={saveSelectedUserProfile}
                        disabled={profileSaving}
                        className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                        style={{ backgroundColor: '#BB0000' }}
                      >
                        {profileSaving ? 'Saving…' : 'Save profile'}
                      </button>
                    </div>
                  </div>
                )}
              </Section>
            )}
          </>
        )}

        {tab === 'messages' && (
          <>
            <Section title="Global message search">
              <div className="flex items-center gap-3">
                <input
                  className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm"
                  placeholder="Search message body…"
                  value={messageSearchQ}
                  onChange={(e) => setMessageSearchQ(e.target.value)}
                />
                <button
                  type="button"
                  onClick={searchMessages}
                  disabled={messageSearching}
                  className="px-4 py-2.5 rounded-lg text-sm font-semibold border border-gray-200 text-gray-700 disabled:opacity-50"
                >
                  {messageSearching ? '…' : 'Search'}
                </button>
              </div>
              <div className="mt-4 space-y-2">
                {messageSearchResults.map(r => (
                  <button
                    key={r.message?.id}
                    type="button"
                    onClick={() => openThread(r.message?.match_id)}
                    className="w-full text-left px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 transition"
                  >
                    <p className="text-xs text-gray-500">
                      match {r.message?.match_id} · sender {r.sender?.email ?? `id ${r.message?.sender_id}`}
                    </p>
                    <p className="text-sm text-gray-900 truncate">{r.message?.body}</p>
                  </button>
                ))}
                {messageSearchResults.length === 0 && (
                  <p className="text-sm text-gray-400">No results yet.</p>
                )}
              </div>
            </Section>

            <Section title="Browse user threads">
              <div className="flex items-center gap-3">
                <select
                  className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm"
                  value={messageUserId ?? ''}
                  onChange={async (e) => {
                    const id = e.target.value ? Number(e.target.value) : null
                    setMessageUserId(id)
                    if (id) await fetchThreadsForUser(id)
                  }}
                >
                  <option value="">Choose a user…</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {formatUserLabel(u)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => messageUserId && fetchThreadsForUser(messageUserId)}
                  disabled={!messageUserId || threadsLoading}
                  className="px-4 py-2.5 rounded-lg text-sm font-semibold border border-gray-200 text-gray-700 disabled:opacity-50"
                >
                  {threadsLoading ? '…' : 'Load'}
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-900">Threads</p>
                  {threadsLoading ? (
                    <p className="text-sm text-gray-400">Loading…</p>
                  ) : (
                    <div className="space-y-2">
                      {threads.map(t => (
                        <button
                          key={t.match?.id}
                          type="button"
                          onClick={() => openThread(t.match?.id)}
                          className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                            String(selectedMatchId) === String(t.match?.id)
                              ? 'bg-red-50 border-red-100'
                              : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                          }`}
                        >
                          <p className="text-sm font-medium text-gray-900">
                            Match #{t.match?.id} · {t.match?.status}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            Student: {t.student?.first_name} {t.student?.last_name} · Alumni: {t.alumni?.first_name} {t.alumni?.last_name}
                          </p>
                        </button>
                      ))}
                      {threads.length === 0 && (
                        <p className="text-sm text-gray-400">No threads for this user.</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-900">Messages</p>
                  {threadLoading ? (
                    <p className="text-sm text-gray-400">Loading…</p>
                  ) : (
                    <div className="space-y-3">
                      {threadMessages.map(item => {
                        const msg = item.message
                        const sender = item.sender
                        const senderName = sender?.first_name && sender?.last_name
                          ? `${sender.first_name} ${sender.last_name}`
                          : (sender?.email || (msg?.sender_id != null ? `User ${msg.sender_id}` : 'Unknown'))

                        const leftId = threadLeftSenderId
                        const align = leftId != null && String(msg?.sender_id) === String(leftId) ? 'left' : 'right'

                        return (
                          <AdminMessageBubble
                            key={msg?.id}
                            body={msg?.body}
                            sentAt={msg?.sent_at}
                            align={align}
                            senderLabel={senderName}
                          />
                        )
                      })}
                      {threadMessages.length === 0 && (
                        <p className="text-sm text-gray-400">Select a thread to view messages.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Section>
          </>
        )}

        {tab === 'wins' && (
          <>
            <Section title="Match outcomes">
              {(() => {
                const counts = winsMatches.reduce((acc, item) => {
                  const status = item?.match?.status || 'unknown'
                  acc[status] = (acc[status] || 0) + 1
                  return acc
                }, {})
                const total = winsMatches.length
                const accepted = (counts.accepted || 0) + (counts.active || 0)
                const acceptanceRate = total > 0 ? Math.round((accepted / total) * 100) : 0

                return (
                  <>
                    <div className="flex items-center gap-3">
                      <select
                        className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm"
                        value={winsUserId ?? ''}
                        onChange={async (e) => {
                          const id = e.target.value ? Number(e.target.value) : null
                          setWinsUserId(id)
                          await Promise.all([
                            fetchMilestones({ userId: id }),
                            fetchWinsMatches({ userId: id }),
                          ])
                        }}
                      >
                        <option value="">All users</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>
                            {formatUserLabel(u)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          fetchMilestones({ userId: winsUserId })
                          fetchWinsMatches({ userId: winsUserId })
                        }}
                        disabled={winsLoading || winsMatchesLoading}
                        className="px-4 py-2.5 rounded-lg text-sm font-semibold border border-gray-200 text-gray-700 disabled:opacity-50"
                      >
                        {(winsLoading || winsMatchesLoading) ? '…' : 'Refresh'}
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                        <p className="text-xs text-gray-500">Total</p>
                        <p className="text-lg font-semibold text-gray-900">{total}</p>
                      </div>
                      <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                        <p className="text-xs text-gray-500">Pending</p>
                        <p className="text-lg font-semibold text-gray-900">{counts.pending || 0}</p>
                      </div>
                      <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                        <p className="text-xs text-gray-500">Accepted</p>
                        <p className="text-lg font-semibold text-gray-900">{counts.accepted || 0}</p>
                      </div>
                      <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                        <p className="text-xs text-gray-500">Passed</p>
                        <p className="text-lg font-semibold text-gray-900">{counts.passed || 0}</p>
                      </div>
                      <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                        <p className="text-xs text-gray-500">Acceptance</p>
                        <p className="text-lg font-semibold text-gray-900">{acceptanceRate}%</p>
                      </div>
                    </div>

                    <p className="text-xs text-gray-400 mt-3">
                      Acceptance counts `accepted` + `active` as successful outcomes.
                    </p>
                  </>
                )
              })()}
            </Section>

            <Section title="Wins (milestones)">
              <div className="mt-4 space-y-2">
                {winsLoading ? (
                  <p className="text-sm text-gray-400">Loading…</p>
                ) : milestones.length === 0 ? (
                  <p className="text-sm text-gray-400">No wins found.</p>
                ) : (
                  milestones.map(item => {
                    const m = item.milestone
                    const studentUser = item.student_user
                    const studentProfile = item.student_profile
                    const alumniUser = item.alumni_user
                    const alumniProfile = item.alumni_profile

                    const studentLabel = studentUser
                      ? formatUserLabel({
                        ...studentUser,
                        account_type: 'student',
                        profile_id: studentProfile?.id ?? null,
                      })
                      : (studentProfile?.id != null ? `student_profile ${studentProfile.id}` : 'student —')

                    const alumniLabel = alumniUser
                      ? formatUserLabel({
                        ...alumniUser,
                        account_type: 'alumni',
                        profile_id: alumniProfile?.id ?? null,
                      })
                      : (alumniProfile?.id != null ? `alumni_profile ${alumniProfile.id}` : null)

                    return (
                    <div key={m.id} className="px-4 py-3 rounded-xl border border-gray-100 bg-gray-50">
                      <p className="text-sm font-medium text-gray-900">
                        {m.outcome_type} · {studentLabel}
                        {m.match_id ? ` · match ${m.match_id}` : ''}
                        {alumniLabel ? ` · credited_to ${alumniLabel}` : ''}
                      </p>
                      {m.notes && (
                        <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{m.notes}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {m.logged_at ? new Date(m.logged_at).toLocaleString() : ''}
                      </p>
                    </div>
                    )
                  })}
                )}
              </div>
            </Section>
          </>
        )}

        {tab === 'matches' && (
          <Section title="Matches">
            {loadingMatches ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : (
              <div className="space-y-2">
                {matches.map(m => (
                  <div key={m.match.id} className="px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        Match #{m.match.id} · status {m.match.status} · score {m.match.score}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        Student: {m.student?.first_name} {m.student?.last_name} · Alumni: {m.alumni?.first_name} {m.alumni?.last_name}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteMatch(m)}
                      className="text-xs font-medium text-red-600 hover:text-red-800 flex-shrink-0"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {tab === 'matching' && (
          <Section title="Nightly matching">
            <p className="text-sm text-gray-600 mb-4">
              Runs matching for up to 200 students (skips students with pending matches).
            </p>
            <button
              type="button"
              onClick={runNightly}
              disabled={running}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: '#BB0000' }}
            >
              {running ? 'Running…' : 'Run now'}
            </button>
            {runSummary && (
              <div className="mt-4 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-700">
                processed {runSummary.processed} · created {runSummary.created} · skipped {runSummary.skipped} · no_match {runSummary.no_match}
              </div>
            )}
          </Section>
        )}
      </main>
    </div>
  )
}

