// src/pages/AlumniProfileView.jsx
// Read-only profile page for an alumni — shown to the student they're matched with.
// Accessible by clicking the alumni's name/avatar on the student dashboard.
//
// URL: /profile/view/alumni/:matchId
// Fetches from GET /api/matches/:matchId/alumni

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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

export default function AlumniProfileView() {
  const { matchId } = useParams()
  const navigate = useNavigate()

  const [alumni, setAlumni]   = useState(null)
  const [matchStatus, setMatchStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    async function fetchAlumni() {
      try {
        const [alumniRes, matchesRes] = await Promise.all([
          api.get(`/matches/${matchId}/alumni`),
          api.get('/matches/mine')
        ])
        setAlumni(alumniRes.data.alumni)

        const allMatches = matchesRes.data.matches ?? []
        const thisMatch = allMatches.find(m => String(m.match.id) === String(matchId))
        setMatchStatus(thisMatch?.match?.status ?? null)
      } catch (err) {
        setError('Could not load this alumni profile.')
      } finally {
        setLoading(false)
      }
    }
    fetchAlumni()
  }, [matchId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading profile...</p>
      </div>
    )
  }

  if (error || !alumni) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-red-500">{error ?? 'Alumni not found.'}</p>
      </div>
    )
  }

  const fullName = `${alumni.first_name} ${alumni.last_name}`
  const initials = `${alumni.first_name?.[0] ?? ''}${alumni.last_name?.[0] ?? ''}`.toUpperCase()
  const canMessage = matchStatus === 'accepted' || matchStatus === 'active'

  return (
    <div className="min-h-screen bg-gray-50">

      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard/student')}
            className="text-gray-400 hover:text-gray-700 transition-colors text-lg"
          >←</button>
          <span className="font-bold text-base tracking-tight" style={{ color: '#BB0000' }}>
            Alumni Profile
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-4">

        {/* Identity card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                style={{ backgroundColor: '#BB0000' }}
              >
                {initials}
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{fullName}</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {alumni.current_role}
                  {alumni.current_company && (
                    <> · <span className="font-medium text-gray-700">{alumni.current_company}</span></>
                  )}
                </p>
              </div>
            </div>
            <AvailabilityBadge availability={alumni.availability} />
          </div>

          {/* Bio */}
          {alumni.bio && (
            <p className="text-sm text-gray-700 leading-relaxed border-t border-gray-50 pt-4">
              {alumni.bio}
            </p>
          )}

          {/* Career summary */}
          {alumni.career_summary && (
            <p className="text-sm text-gray-600 leading-relaxed mt-3">
              {alumni.career_summary}
            </p>
          )}

          {/* Students helped — only shown if alumni opted in */}
          {alumni.helped_count != null && alumni.helped_count > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-50">
              <p className="text-sm text-gray-500">
                🎓 Helped <span className="font-semibold text-gray-800">{alumni.helped_count}</span>{' '}
                {alumni.helped_count === 1 ? 'student' : 'students'} land opportunities
              </p>
            </div>
          )}
        </div>

        {/* Past experience */}
        {alumni.history && alumni.history.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Past experience</h2>
            <div className="flex flex-col gap-3">
              {alumni.history.map((h, i) => (
                <div key={i} className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{h.company_name}</p>
                    {h.role_name && (
                      <p className="text-xs text-gray-500 mt-0.5">{h.role_name}</p>
                    )}
                  </div>
                  {h.start_year && (
                    <span className="text-xs text-gray-400">{h.start_year}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Message button */}
        {canMessage ? (
          <button
            onClick={() => navigate(`/messages/${matchId}`)}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#BB0000' }}
          >
            Message {alumni.first_name}
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="w-full py-3 rounded-xl text-sm font-semibold bg-gray-100 text-gray-400 cursor-not-allowed"
          >
            Waiting for alumni to accept
          </button>
        )}

      </main>
    </div>
  )
}