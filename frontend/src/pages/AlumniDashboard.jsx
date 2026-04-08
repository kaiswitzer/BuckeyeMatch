// src/pages/AlumniDashboard.jsx
// Alumni dashboard — shows incoming student matches with accept/pass/undo.
//
// Changes in this version:
//   - Uses match.status === 'accepted' (not 'active') to detect prior accepts
//   - Undo button resets accepted/passed matches back to pending
//   - Shows alumni_explanation instead of the student-facing explanation
//   - Student name/avatar is clickable — navigates to their profile view

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

function YearBadge({ year }) {
  return (
    <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 capitalize">
      {year}
    </span>
  )
}

function MatchCard({ match, student, onRespond }) {
  const navigate = useNavigate()

  const [localStatus, setLocalStatus] = useState(null)
  const [loading, setLoading]         = useState(null)
  const [error, setError]             = useState('')

  const fullName = `${student.first_name} ${student.last_name}`
  const initials = `${student.first_name?.[0] ?? ''}${student.last_name?.[0] ?? ''}`.toUpperCase()

  // Determine current display state — prefer localStatus (optimistic) over DB status
  const effectiveStatus = localStatus ?? match.status
  const isPassed   = effectiveStatus === 'passed'
  const isAccepted = effectiveStatus === 'accepted'

  const handleRespond = async (action) => {
    setError('')
    setLoading(action)
    try {
      await api.post(`/matches/${match.id}/respond`, { action })
      const newStatus = action === 'accept' ? 'accepted' : 'passed'
      setLocalStatus(newStatus)
      onRespond(match.id, newStatus)
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong.')
    } finally {
      setLoading(null)
    }
  }

  const handleUndo = async () => {
    setError('')
    setLoading('undo')
    try {
      await api.post(`/matches/${match.id}/undo`)
      setLocalStatus('pending')
      onRespond(match.id, 'pending')
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong.')
    } finally {
      setLoading(null)
    }
  }

  // Use alumni_explanation if available, fall back to student explanation
  const explanation = match.alumni_explanation || match.explanation

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col gap-4 transition-opacity ${isPassed ? 'opacity-50' : ''}`}>

      {/* Top row — clicking name or avatar goes to student profile view */}
      <div className="flex items-start justify-between gap-4">
        <button
          className="flex items-center gap-4 text-left group"
          onClick={() => navigate(`/profile/view/student/${match.id}`)}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 group-hover:opacity-80 transition-opacity"
            style={{ backgroundColor: '#BB0000' }}
          >
            {initials}
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-base group-hover:underline">{fullName}</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {student.major}
              {student.minor && <> · Minor in {student.minor}</>}
            </p>
            {student.hometown && (
              <p className="text-xs text-gray-400 mt-0.5">from {student.hometown}</p>
            )}
          </div>
        </button>

        {student.year && <YearBadge year={student.year} />}
      </div>

      {/* Target companies */}
      {student.targets && student.targets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {student.targets.map((t, i) => (
            <span key={i} className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-600">
              {t.company_name}{t.role_name ? ` · ${t.role_name}` : ''}
            </span>
          ))}
        </div>
      )}

      {/* Match explanation — alumni-facing version */}
      <div className="bg-gray-50 rounded-xl px-4 py-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Why they matched with you</p>
        <p className="text-sm text-gray-700 leading-relaxed">{explanation}</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
      )}

      {/* ── Action area ── */}

      {/* Passed state — show dimmed label + undo */}
      {isPassed && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">You passed on this student</span>
          <button
            onClick={handleUndo}
            disabled={loading === 'undo'}
            className="text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors disabled:opacity-50"
          >
            {loading === 'undo' ? 'Undoing...' : 'Undo'}
          </button>
        </div>
      )}

      {/* Accepted state — message button + undo */}
      {isAccepted && (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => navigate(`/messages/${match.id}`)}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#BB0000' }}
          >
            Message {student.first_name}
          </button>
          <button
            onClick={handleUndo}
            disabled={loading === 'undo'}
            className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            {loading === 'undo' ? 'Undoing...' : 'Undo accept'}
          </button>
        </div>
      )}

      {/* Pending state — accept / pass buttons */}
      {!isPassed && !isAccepted && (
        <div className="flex gap-3">
          <button
            onClick={() => handleRespond('pass')}
            disabled={!!loading}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-800 transition disabled:opacity-50"
          >
            {loading === 'pass' ? 'Passing...' : 'Pass'}
          </button>
          <button
            onClick={() => handleRespond('accept')}
            disabled={!!loading}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#BB0000' }}
          >
            {loading === 'accept' ? 'Accepting...' : 'Accept'}
          </button>
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-8 py-14 flex flex-col items-center text-center gap-3">
      <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl" style={{ backgroundColor: '#FFF0F0' }}>
        📬
      </div>
      <p className="font-semibold text-gray-800 text-base">No student matches yet</p>
      <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
        When a student matches with you, they'll appear here. Make sure your
        availability is set to Open to receive matches.
      </p>
    </div>
  )
}

export default function AlumniDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    async function fetchMatches() {
      try {
        const res = await api.get('/matches/mine')
        setMatches(res.data.matches ?? [])
      } catch (err) {
        console.error('Failed to load matches:', err)
        setError('Something went wrong loading your matches. Try refreshing.')
      } finally {
        setLoading(false)
      }
    }
    fetchMatches()
  }, [])

  const handleRespond = (matchId, newStatus) => {
    // Could re-sort here in the future — for now cards update in place
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const firstName = user?.first_name ?? 'there'

  return (
    <div className="min-h-screen bg-gray-50">

      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            to="/"
            state={{ allowLanding: true }}
            className="font-bold text-base tracking-tight hover:opacity-80 transition-opacity"
            style={{ color: '#BB0000' }}
          >
            Buckeye Match
          </Link>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/profile/alumni')}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Edit profile
            </button>
            <button
              onClick={() => navigate('/profile/alumni')}
              className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              {user?.first_name} {user?.last_name}
            </button>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hey, {firstName} 👋</h1>
          <p className="text-sm text-gray-500 mt-1">
            These students matched with you based on your background and their target companies.
          </p>
        </div>

        {loading && (
          <div className="flex flex-col gap-4">
            {[1, 2].map(i => (
              <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-pulse">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gray-200" />
                  <div className="flex flex-col gap-2 flex-1">
                    <div className="h-3.5 bg-gray-200 rounded w-1/3" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
                <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                <div className="h-3 bg-gray-100 rounded w-4/5 mb-4" />
                <div className="flex gap-3">
                  <div className="flex-1 h-10 bg-gray-100 rounded-lg" />
                  <div className="flex-1 h-10 bg-gray-200 rounded-lg" />
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

        {!loading && !error && matches.length === 0 && <EmptyState />}

        {!loading && !error && matches.length > 0 && (
          <div className="flex flex-col gap-4">
            {matches.map(({ match, student }) => (
              <MatchCard
                key={match.id}
                match={match}
                student={student}
                onRespond={handleRespond}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}