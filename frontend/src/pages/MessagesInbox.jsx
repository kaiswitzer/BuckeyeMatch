import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import AppHeader from '../components/AppHeader'

function formatListTime(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function previewLine(lastMessage, matchStatus) {
  if (!lastMessage) {
    if (matchStatus === 'pending') {
      return 'Waiting for alumni to accept — messaging opens after they respond.'
    }
    return 'No messages yet'
  }
  const t = lastMessage.body || ''
  return t.length > 100 ? `${t.slice(0, 97)}…` : t
}

function inboxErrorMessage(err) {
  const status = err.response?.status
  const server = err.response?.data?.error
  if (status === 401) return 'Your session expired. Log in again.'
  if (status === 404) {
    return (
      'The messages inbox API was not found (404). If you are on production, deploy the latest ' +
      'backend that includes GET /api/messages/inbox. In local dev, run the Flask app on port 5001 ' +
      'so the Vite proxy can reach it.'
    )
  }
  if (!err.response && err.message) {
    return `Could not reach the server (${err.message}). Is the API running?`
  }
  return server || err.message || 'Could not load messages. Try again.'
}

function peerIntroPreview(row) {
  if (row.perspective === 'admin') {
    const req = row.requester_student?.display_name
    const rec = row.recipient_student?.display_name
    return [req && rec ? `${req} → ${rec}` : row.other_student?.display_name, row.company_name, row.status]
      .filter(Boolean)
      .join(' · ')
  }
  const st = row.status || 'pending'
  const who = row.other_student?.display_name || 'Peer'
  if (st === 'pending' && row.perspective === 'incoming') {
    return `${who} wants to connect · ${row.company_name || 'Company'}`
  }
  if (st === 'pending') {
    return `Waiting on ${who} · ${row.company_name || 'Company'}`
  }
  return `${row.preview || 'Peer thread'} · ${st}`
}

export default function MessagesInbox() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [conversations, setConversations] = useState([])
  const [totalUnread, setTotalUnread] = useState(0)
  const [peerRows, setPeerRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const isStudent = user?.account_type === 'student'
  const isAdmin = !!user?.is_admin
  const dashboardPath = isAdmin ? '/admin' : isStudent ? '/dashboard/student' : '/dashboard/alumni'
  const showPeerHub = isStudent || isAdmin

  const loadInbox = useCallback(async () => {
    if (!user) return
    setError(null)
    setLoading(true)
    try {
      const res = await api.get('/messages/inbox')
      setConversations(res.data.conversations ?? [])
      setTotalUnread(res.data.total_unread ?? 0)
    } catch (err) {
      console.error('Failed to load inbox:', err)
      setError(inboxErrorMessage(err))
      setConversations([])
      setTotalUnread(0)
    }

    if (isStudent || isAdmin) {
      try {
        const pr = await api.get('/peers/introductions')
        if (isAdmin) {
          const all = pr.data.all ?? []
          setPeerRows([...all].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
        } else {
          const incoming = pr.data.incoming ?? []
          const outgoing = pr.data.outgoing ?? []
          const merged = [...incoming, ...outgoing].sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
          )
          setPeerRows(merged)
        }
      } catch (e) {
        console.error('Failed to load peer introductions:', e)
        setPeerRows([])
      }
    } else {
      setPeerRows([])
    }

    setLoading(false)
  }, [user, isStudent, isAdmin])

  useEffect(() => {
    const t = setTimeout(() => loadInbox(), 0)
    return () => clearTimeout(t)
  }, [loadInbox])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadInbox()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [loadInbox])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppHeader
        title="Messages"
        showBack
        onBack={() => navigate(dashboardPath)}
        maxWidthClassName="max-w-2xl"
      />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 flex flex-col gap-6">
        {showPeerHub && !loading && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <span className="font-medium text-gray-800">Alumni messages</span>
            <span className="text-gray-300">·</span>
            <Link
              to="/peers"
              className="font-medium hover:underline"
              style={{ color: '#BB0000' }}
            >
              {isAdmin ? 'Peer intros (view all)' : 'Find student peers by company'}
            </Link>
          </div>
        )}

        {loading && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-4 animate-pulse"
              >
                <div className="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-6 py-5 text-sm text-red-600">
            {error}
          </div>
        )}

        {!loading && !error && conversations.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-8 py-14 flex flex-col items-center text-center gap-3">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
              style={{ backgroundColor: '#FFF0F0' }}
            >
              💬
            </div>
            <p className="font-semibold text-gray-800 text-base">No alumni conversations yet</p>
            <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
              When you match with an alum and exchange messages, they will appear here.
            </p>
          </div>
        )}

        {!loading && !error && conversations.length > 0 && (
          <ul className="flex flex-col gap-2">
            {conversations.map(row => {
              const initials = row.other_name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map(p => p[0])
                .join('')
                .toUpperCase()
              const ts = row.last_message?.sent_at
              return (
                <li key={row.match_id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/messages/${row.match_id}`)}
                    className="w-full text-left bg-white rounded-2xl border border-gray-100 p-4 flex gap-4 hover:border-gray-200 transition-colors"
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
                      style={{ backgroundColor: '#BB0000' }}
                    >
                      {initials || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-gray-900 truncate">
                          {row.other_name}
                        </span>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {formatListTime(ts)}
                        </span>
                      </div>
                      <p
                        className={`text-sm mt-0.5 truncate ${
                          row.unread_count > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'
                        }`}
                      >
                        {previewLine(row.last_message, row.match_status)}
                      </p>
                    </div>
                    {row.unread_count > 0 && (
                      <span
                        className="flex-shrink-0 min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-semibold text-white flex items-center justify-center"
                        style={{ backgroundColor: '#BB0000' }}
                      >
                        {row.unread_count > 99 ? '99+' : row.unread_count}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {showPeerHub && !loading && peerRows.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              {isAdmin ? 'All peer intros' : 'Peer students'}
            </h2>
            <p className="text-xs text-gray-500 -mt-1">
              {isAdmin
                ? 'Read-only overview of student-to-student introductions.'
                : 'Introductions with other students (separate from alum matching).'}
            </p>
            <ul className="flex flex-col gap-2">
              {peerRows.map(row => (
                <li key={`peer-${row.id}-${row.perspective}`}>
                  <Link
                    to={`/peers/introductions/${row.id}`}
                    className="w-full flex text-left bg-white rounded-2xl border border-gray-100 p-4 gap-4 hover:border-gray-200 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 bg-gray-700">
                      {row.perspective === 'admin'
                        ? `${(row.requester_student?.display_name || 'P').slice(0, 1)}${(row.recipient_student?.display_name || 'P').slice(0, 1)}`.toUpperCase()
                        : (row.other_student?.display_name || 'P').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-gray-900 truncate">
                          {row.perspective === 'admin'
                            ? row.other_student?.display_name || 'Peer intro'
                            : row.other_student?.display_name || 'Peer'}
                        </span>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {formatListTime(row.created_at)}
                        </span>
                      </div>
                      <p
                        className={`text-sm mt-0.5 truncate ${
                          !isAdmin &&
                          row.status === 'pending' &&
                          row.perspective === 'incoming'
                            ? 'text-gray-900 font-medium'
                            : 'text-gray-500'
                        }`}
                      >
                        {peerIntroPreview(row)}
                      </p>
                    </div>
                    {!isAdmin && row.status === 'pending' && row.perspective === 'incoming' && (
                      <span
                        className="flex-shrink-0 w-2 h-2 rounded-full bg-amber-400 mt-2"
                        title="Needs your response"
                        aria-hidden
                      />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!loading && !error && totalUnread > 0 && (
          <p className="text-xs text-gray-400 text-center">
            Unread messages are marked read when you open a conversation.
          </p>
        )}
      </main>
    </div>
  )
}
