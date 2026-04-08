// src/pages/StudentProfileView.jsx
// Read-only profile page for a student — shown to the alumni they're matched with.
// Accessible by clicking the student's name/avatar on the alumni dashboard.
//
// URL: /profile/view/student/:matchId
// Fetches from GET /api/matches/:matchId/student

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import AppHeader from '../components/AppHeader'

export default function StudentProfileView() {
  const { matchId } = useParams()
  const navigate = useNavigate()

  const [student, setStudent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    async function fetchStudent() {
      try {
        const res = await api.get(`/matches/${matchId}/student`)
        setStudent(res.data.student)
      } catch (err) {
        setError('Could not load this student profile.')
      } finally {
        setLoading(false)
      }
    }
    fetchStudent()
  }, [matchId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading profile...</p>
      </div>
    )
  }

  if (error || !student) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-red-500">{error ?? 'Student not found.'}</p>
      </div>
    )
  }

  const fullName = `${student.first_name} ${student.last_name}`
  const initials = `${student.first_name?.[0] ?? ''}${student.last_name?.[0] ?? ''}`.toUpperCase()

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title="Student Profile"
        showBack
        onBack={() => navigate('/dashboard/alumni')}
        maxWidthClassName="max-w-2xl"
      />

      <main className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-4">

        {/* Identity card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-4 mb-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
              style={{ backgroundColor: '#BB0000' }}
            >
              {initials}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{fullName}</h1>
              <p className="text-sm text-gray-500 mt-0.5 capitalize">
                {student.year} · {student.major}
                {student.minor && ` · Minor in ${student.minor}`}
              </p>
              {student.hometown && (
                <p className="text-xs text-gray-400 mt-0.5">from {student.hometown}</p>
              )}
            </div>
          </div>

          {/* Bio */}
          {student.bio && (
            <p className="text-sm text-gray-700 leading-relaxed border-t border-gray-50 pt-4">
              {student.bio}
            </p>
          )}
        </div>

        {/* Target companies */}
        {student.targets && student.targets.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Target companies</h2>
            <div className="flex flex-col gap-2">
              {student.targets.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-800">{t.company_name}</span>
                  {t.role_name && (
                    <span className="text-sm text-gray-400">· {t.role_name}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Message button */}
        <button
          onClick={() => navigate(`/messages/${matchId}`)}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#BB0000' }}
        >
          Message {student.first_name}
        </button>

      </main>
    </div>
  )
}