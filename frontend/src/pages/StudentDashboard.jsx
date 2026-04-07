// src/pages/StudentDashboard.jsx
// Student dashboard — shows match cards and lets the student log milestones.
// Alumni name and avatar are now clickable — navigate to alumni profile view.

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

function AvailabilityBadge({ availability }) {
  const config = {
    open:    { label: 'Open to connect',      dot: 'bg-green-400',  text: 'text-green-700',  bg: 'bg-green-50'  },
    limited: { label: 'Limited availability', dot: 'bg-yellow-400', text: 'text-yellow-700', bg: 'bg-yellow-50' },
    closed:  { label: 'Not available',        dot: 'bg-gray-300',   text: 'text-gray-500',   bg: 'bg-gray-50'   },
  }
  const c = config[availability] ?? config.closed
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

function MatchCard({ match, alumni }) {
  const navigate = useNavigate()
  const fullName = `${alumni.first_name} ${alumni.last_name}`
  const initials = `${alumni.first_name?.[0] ?? ''}${alumni.last_name?.[0] ?? ''}`.toUpperCase()
  const canMessage = match.status === 'accepted' || match.status === 'active'

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col gap-4">

      {/* Top row — clicking name or avatar goes to alumni profile view */}
      <div className="flex items-start justify-between gap-4">
        <button
          className="flex items-center gap-4 text-left group"
          onClick={() => navigate(`/profile/view/alumni/${match.id}`)}
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
              {alumni.current_role}
              {alumni.current_company && (
                <> · <span className="text-gray-700 font-medium">{alumni.current_company}</span></>
              )}
            </p>
          </div>
        </button>
        <AvailabilityBadge availability={alumni.availability} />
      </div>

      {alumni.career_summary && (
        <p className="text-sm text-gray-600 leading-relaxed border-t border-gray-50 pt-4">
          {alumni.career_summary}
        </p>
      )}

      <div className="bg-gray-50 rounded-xl px-4 py-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Why you matched</p>
        <p className="text-sm text-gray-700 leading-relaxed">{match.explanation}</p>
      </div>

      {canMessage ? (
        <button
          onClick={() => navigate(`/messages/${match.id}`)}
          className="w-full mt-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
          style={{ backgroundColor: '#BB0000' }}
        >
          Message {alumni.first_name}
        </button>
      ) : (
        <button
          type="button"
          disabled
          className="w-full mt-1 py-2.5 rounded-lg text-sm font-semibold bg-gray-100 text-gray-400 cursor-not-allowed"
        >
          Waiting for alumni to accept
        </button>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-8 py-14 flex flex-col items-center text-center gap-3">
      <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl" style={{ backgroundColor: '#FFF0F0' }}>
        🔍
      </div>
      <p className="font-semibold text-gray-800 text-base">Your matches are being prepared</p>
      <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
        We're finding the best alumni for your goals. Check back soon — matches
        are generated based on your profile and target companies.
      </p>
    </div>
  )
}

function MilestoneModal({ matches, onClose }) {
  const [screen, setScreen]             = useState('form')
  const [outcomeType, setOutcomeType]   = useState('')
  const [matchId, setMatchId]           = useState('')
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [savedOutcome, setSavedOutcome] = useState('')
  const [priorMilestones, setPriorMilestones] = useState([])
  const [loadingPrior, setLoadingPrior]       = useState(true)

  const OUTCOMES = [
    { value: 'interview', emoji: '📅', label: 'Got an interview' },
    { value: 'offer',     emoji: '📄', label: 'Got an offer'     },
    { value: 'job',       emoji: '🏆', label: 'Got the job'      },
  ]
  const OUTCOME_LABELS = {
    interview: { emoji: '📅', label: 'Interview' },
    offer:     { emoji: '📄', label: 'Offer'     },
    job:       { emoji: '🏆', label: 'Job'        },
  }
  const CELEBRATION = {
    interview: { emoji: '📅', headline: 'You landed an interview!',  sub: "That's a huge step. Keep going."               },
    offer:     { emoji: '📄', headline: 'You got an offer!',         sub: 'All that work is paying off.'                  },
    job:       { emoji: '🏆', headline: 'You got the job!',          sub: "This is what it's all about. Congratulations."  },
  }

  useEffect(() => {
    async function fetchPrior() {
      try {
        const res = await api.get('/milestones')
        setPriorMilestones(res.data.milestones ?? [])
      } catch (err) {
        console.error('Could not load prior milestones:', err)
      } finally {
        setLoadingPrior(false)
      }
    }
    fetchPrior()
  }, [])

  const formatDate = (iso) =>
    new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })

  const getMatchLabel = (mid) => {
    if (!mid) return null
    const found = matches.find(({ match }) => match.id === mid)
    if (!found) return null
    return `${found.alumni.first_name} ${found.alumni.last_name} · ${found.alumni.current_company}`
  }

  const handleSubmit = async () => {
    if (!outcomeType) { setError('Please select an outcome.'); return }
    setError('')
    setLoading(true)
    try {
      await api.post('/milestones', {
        outcome_type: outcomeType,
        match_id: matchId ? parseInt(matchId) : null,
      })
      setSavedOutcome(outcomeType)
      setScreen('celebration')
      setTimeout(() => onClose(), 2500)
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const cel = CELEBRATION[savedOutcome]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md relative overflow-y-auto"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-8">
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>

          {screen === 'form' && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Log a win 🎉</h2>
              <p className="text-sm text-gray-500 mb-6">Tell us how it's going. This helps us improve your matches.</p>

              {!loadingPrior && priorMilestones.length > 0 && (
                <div className="mb-6">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Your wins so far</p>
                  <div className="space-y-2">
                    {priorMilestones.map(m => {
                      const ol = OUTCOME_LABELS[m.outcome_type]
                      const matchLabel = getMatchLabel(m.match_id)
                      return (
                        <div key={m.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{ol?.emoji}</span>
                            <div>
                              <p className="text-sm font-medium text-gray-800">{ol?.label}</p>
                              {matchLabel && <p className="text-xs text-gray-400">{matchLabel}</p>}
                            </div>
                          </div>
                          <span className="text-xs text-gray-400">{formatDate(m.logged_at)}</span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="border-t border-gray-100 mt-5 mb-5" />
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Log another win</p>
                </div>
              )}

              <div className="space-y-3 mb-6">
                {OUTCOMES.map(opt => {
                  const selected = outcomeType === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setOutcomeType(opt.value)}
                      className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition flex items-center gap-3 ${selected ? 'bg-red-50' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}
                      style={selected ? { borderColor: '#BB0000', color: '#BB0000' } : {}}
                    >
                      <span className="text-lg">{opt.emoji}</span>
                      {opt.label}
                    </button>
                  )
                })}
              </div>

              {matches.length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Which match helped? <span className="text-gray-400">(optional)</span>
                  </label>
                  <select
                    value={matchId}
                    onChange={e => setMatchId(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                  >
                    <option value="">Not sure / no match involved</option>
                    {matches.map(({ match, alumni }) => (
                      <option key={match.id} value={match.id}>
                        {alumni.first_name} {alumni.last_name} · {alumni.current_company}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}

              <button
                onClick={handleSubmit}
                disabled={loading || !outcomeType}
                className="w-full py-3 rounded-lg text-white font-semibold text-sm disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#BB0000' }}
              >
                {loading ? 'Saving...' : 'Log it'}
              </button>
            </div>
          )}

          {screen === 'celebration' && cel && (
            <div className="flex flex-col items-center text-center py-6 gap-4">
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl" style={{ backgroundColor: '#FFF0F0' }}>
                {cel.emoji}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{cel.headline}</h2>
                <p className="text-gray-500 text-sm mt-2">{cel.sub}</p>
              </div>
              <div className="flex gap-1 mt-2">
                {['🎉', '⭐', '🎊'].map((e, i) => (
                  <span key={i} className="text-2xl animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}>{e}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function StudentDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [matches, setMatches]             = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [showMilestone, setShowMilestone] = useState(false)

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

  const handleLogout = () => { logout(); navigate('/') }
  const firstName = user?.first_name ?? 'there'
  const visibleMatches = matches.filter(({ match }) => match?.status !== 'passed')

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
              onClick={() => setShowMilestone(true)}
              className="text-sm font-medium px-3 py-1.5 rounded-lg border transition hover:bg-gray-50"
              style={{ borderColor: '#BB0000', color: '#BB0000' }}
            >
              Log a win 🎉
            </button>
            <button
              onClick={() => navigate('/profile/student')}
              className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              {user?.first_name} {user?.last_name}
            </button>
            <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hey, {firstName} 👋</h1>
          <p className="text-sm text-gray-500 mt-1">Here are your alumni matches based on your profile and target companies.</p>
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
                <div className="h-3 bg-gray-100 rounded w-4/5" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-6 py-5 text-sm text-red-600">{error}</div>
        )}

        {!loading && !error && visibleMatches.length === 0 && <EmptyState />}

        {!loading && !error && visibleMatches.length > 0 && (
          <div className="flex flex-col gap-4">
            {visibleMatches.map(({ match, alumni }) => (
              <MatchCard key={match.id} match={match} alumni={alumni} />
            ))}
          </div>
        )}
      </main>

      {showMilestone && (
        <MilestoneModal matches={matches} onClose={() => setShowMilestone(false)} />
      )}
    </div>
  )
}