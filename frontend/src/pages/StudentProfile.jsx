// src/pages/StudentProfile.jsx
// Edit page for students — lets them update all profile fields after onboarding.
// Accessible by clicking their name in the nav header on the dashboard.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

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

// ─── SECTION WRAPPER ─────────────────────────────────────────────────────────
// Each section is a white card. The save button lives inside the card,
// below the children, so it never overlaps sibling elements outside the card.
function Section({ title, onSave, saving, saved, error, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-5">{title}</h2>
      {children}
      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mt-4">{error}</div>
      )}
      <button
        onClick={onSave}
        disabled={saving}
        className="mt-5 px-6 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
        style={{ backgroundColor: saved ? '#16a34a' : '#BB0000' }}
      >
        {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save changes'}
      </button>
    </div>
  )
}

export default function StudentProfile() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)

  // Section 1 — basic info
  const [basic, setBasic] = useState({
    first_name: '', last_name: '', major: '', minor: '', year: 'junior', hometown: '', bio: ''
  })
  const [savingBasic, setSavingBasic] = useState(false)
  const [savedBasic, setSavedBasic]   = useState(false)
  const [errorBasic, setErrorBasic]   = useState('')

  // Section 2 — targets
  const [targets, setTargets]             = useState([{ company_name: '', role_name: '' }])
  const [savingTargets, setSavingTargets] = useState(false)
  const [savedTargets, setSavedTargets]   = useState(false)
  const [errorTargets, setErrorTargets]   = useState('')

  // Section 3 — survey
  const [survey, setSurvey]             = useState({})
  const [savingSurvey, setSavingSurvey] = useState(false)
  const [savedSurvey, setSavedSurvey]   = useState(false)
  const [errorSurvey, setErrorSurvey]   = useState('')

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await api.get('/profiles/student/me')
        const p = res.data

        setBasic({
          first_name: p.first_name ?? '',
          last_name:  p.last_name  ?? '',
          major:      p.major      ?? '',
          minor:      p.minor      ?? '',
          year:       p.year       ?? 'junior',
          hometown:   p.hometown   ?? '',
          bio:        p.bio        ?? '',
        })

        if (p.targets && p.targets.length > 0) {
          setTargets(p.targets.map(t => ({
            company_name: t.company_name ?? '',
            role_name:    t.role_name    ?? ''
          })))
        }

        if (p.survey?.responses) {
          setSurvey(p.survey.responses)
        }
      } catch (err) {
        console.error('Failed to load profile:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  const saveBasic = async () => {
    setErrorBasic('')
    setSavingBasic(true)
    try {
      await api.post('/profiles/student', basic)
      setSavedBasic(true)
      setTimeout(() => setSavedBasic(false), 2000)
    } catch (err) {
      setErrorBasic(err.response?.data?.error || 'Something went wrong.')
    } finally {
      setSavingBasic(false)
    }
  }

  const saveTargets = async () => {
    setErrorTargets('')
    const filled = targets.filter(t => t.company_name.trim())
    if (filled.length === 0) {
      setErrorTargets('Add at least one target company.')
      return
    }
    setSavingTargets(true)
    try {
      await api.post('/profiles/student/targets', { targets: filled })
      setSavedTargets(true)
      setTimeout(() => setSavedTargets(false), 2000)
    } catch (err) {
      setErrorTargets(err.response?.data?.error || 'Something went wrong.')
    } finally {
      setSavingTargets(false)
    }
  }

  const saveSurvey = async () => {
    setErrorSurvey('')
    const answered = Object.keys(survey).length
    if (answered < SURVEY_QUESTIONS.length) {
      setErrorSurvey(`Please answer all questions. (${answered}/${SURVEY_QUESTIONS.length} answered)`)
      return
    }
    setSavingSurvey(true)
    try {
      await api.post('/profiles/student/survey', { responses: survey })
      setSavedSurvey(true)
      setTimeout(() => setSavedSurvey(false), 2000)
    } catch (err) {
      setErrorSurvey(err.response?.data?.error || 'Something went wrong.')
    } finally {
      setSavingSurvey(false)
    }
  }

  const addTarget = () => setTargets([...targets, { company_name: '', role_name: '' }])
  const updateTarget = (i, field, val) =>
    setTargets(targets.map((t, idx) => idx === i ? { ...t, [field]: val } : t))
  // Always allow delete — if they remove the last one, the save will catch it
  const removeTarget = (i) => setTargets(targets.filter((_, idx) => idx !== i))

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading your profile...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Nav ── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard/student')}
            className="text-gray-400 hover:text-gray-700 transition-colors text-lg"
          >←</button>
          <span className="font-bold text-base tracking-tight" style={{ color: '#BB0000' }}>
            Edit Profile
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">

        {/* ── Section 1: Basic Info ── */}
        <Section
          title="Basic info"
          onSave={saveBasic}
          saving={savingBasic}
          saved={savedBasic}
          error={errorBasic}
        >
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
                <input
                  value={basic.first_name}
                  onChange={e => setBasic({ ...basic, first_name: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                <input
                  value={basic.last_name}
                  onChange={e => setBasic({ ...basic, last_name: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Major</label>
              <input
                value={basic.major}
                onChange={e => setBasic({ ...basic, major: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minor <span className="text-gray-400">(optional)</span>
              </label>
              <input
                value={basic.minor}
                onChange={e => setBasic({ ...basic, minor: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
              <select
                value={basic.year}
                onChange={e => setBasic({ ...basic, year: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
              >
                <option value="junior">Junior</option>
                <option value="senior">Senior</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hometown <span className="text-gray-400">(optional)</span>
              </label>
              <input
                value={basic.hometown}
                onChange={e => setBasic({ ...basic, hometown: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                placeholder="Columbus, OH"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bio <span className="text-gray-400">(optional — shown to your matched alumni)</span>
              </label>
              <textarea
                value={basic.bio}
                onChange={e => setBasic({ ...basic, bio: e.target.value })}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
                placeholder="Tell your alumni a bit about yourself — your goals, interests, or why you're excited about your target companies."
              />
            </div>
          </div>
        </Section>

        {/* ── Section 2: Target Companies ── */}
        {/* The "+ Add another company" link lives INSIDE the Section so it
            never overlaps the Save button which is rendered by Section itself */}
        <Section
          title="Target companies"
          onSave={saveTargets}
          saving={savingTargets}
          saved={savedTargets}
          error={errorTargets}
        >
          <div className="space-y-3">
            {targets.map((t, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1 space-y-2">
                  <input
                    value={t.company_name}
                    onChange={e => updateTarget(i, 'company_name', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                    placeholder="Company (e.g. Goldman Sachs)"
                  />
                  <input
                    value={t.role_name}
                    onChange={e => updateTarget(i, 'role_name', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                    placeholder="Role (e.g. Investment Banking Analyst)"
                  />
                </div>
                {/* Always show delete — lets the user remove any row including the last one */}
                <button
                  onClick={() => removeTarget(i)}
                  className="text-gray-300 hover:text-red-500 transition-colors mt-2 text-lg flex-shrink-0"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Add link sits flush inside the card, above the save button */}
          <button
            onClick={addTarget}
            className="mt-4 text-sm font-medium block"
            style={{ color: '#BB0000' }}
          >
            + Add another company
          </button>
        </Section>

        {/* ── Section 3: Personality Survey ── */}
        <Section
          title="Personality survey"
          onSave={saveSurvey}
          saving={savingSurvey}
          saved={savedSurvey}
          error={errorSurvey}
        >
          <div className="space-y-6">
            {SURVEY_QUESTIONS.map(q => (
              <div key={q.key}>
                <p className="text-sm font-medium text-gray-800 mb-2">{q.label}</p>
                <div className="space-y-2">
                  {q.options.map(opt => {
                    const val = opt.toLowerCase().replace(/ /g, '-')
                    const selected = survey[q.key] === val
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setSurvey({ ...survey, [q.key]: val })}
                        className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition ${
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
        </Section>

      </main>
    </div>
  )
}