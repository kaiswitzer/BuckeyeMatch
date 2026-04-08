// src/pages/StudentOnboarding.jsx
// 3-step onboarding flow for students.
// Step 1 — basic info (name, major, year, hometown)
// Step 2 — target companies and roles
// Step 3 — personality survey (10 questions)
//
// All three steps save to the backend before moving to the dashboard.
// Think of this like a multi-step Java wizard pattern — one component
// manages which "screen" is visible using a step counter in state.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'

// ─── SURVEY QUESTIONS ────────────────────────────────────────────────────────
// Each question has a key (stored in DB), a label, and answer options.
const SURVEY_QUESTIONS = [
  {
    key: 'work_style',
    label: 'How do you prefer to work?',
    options: ['Independently', 'Collaboratively', 'Mix of both']
  },
  {
    key: 'communication_style',
    label: 'How would you describe your communication style?',
    options: ['Direct and concise', 'Thoughtful and detailed', 'Depends on the situation']
  },
  {
    key: 'motivation',
    label: 'What motivates you most in your career?',
    options: ['Financial reward', 'Making an impact', 'Learning and growth', 'Status and prestige']
  },
  {
    key: 'work_environment',
    label: 'What work environment fits you best?',
    options: ['Fast-paced and high pressure', 'Structured and stable', 'Creative and flexible']
  },
  {
    key: 'strengths',
    label: 'What is your biggest professional strength?',
    options: ['Analytical thinking', 'Relationship building', 'Leadership', 'Creativity']
  },
  {
    key: 'industry_interest',
    label: 'Which industry excites you most?',
    options: ['Finance', 'Consulting', 'Tech', 'Healthcare', 'Marketing']
  },
  {
    key: 'role_type',
    label: 'What type of role appeals to you?',
    options: ['Client-facing', 'Behind the scenes', 'Leadership / management', 'Technical / specialist']
  },
  {
    key: 'company_size',
    label: 'What company size do you prefer?',
    options: ['Large corporation', 'Mid-size company', 'Small startup']
  },
  {
    key: 'networking_comfort',
    label: 'How comfortable are you with networking?',
    options: ['Very comfortable', 'Somewhat comfortable', 'Uncomfortable but trying', 'Very uncomfortable']
  },
  {
    key: 'career_goal',
    label: 'What is your long-term career goal?',
    options: ['Corporate executive', 'Entrepreneur', 'Expert / specialist', 'Work-life balance focused']
  }
]

// ─── STEP INDICATOR ──────────────────────────────────────────────────────────
function StepIndicator({ current, total }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all ${
            i < current ? 'w-8' : i === current ? 'w-8' : 'w-4 bg-gray-200'
          }`}
          style={i <= current ? { backgroundColor: '#BB0000' } : {}}
        />
      ))}
    </div>
  )
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function StudentOnboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Step 1 state
  const [basicInfo, setBasicInfo] = useState({
    first_name: '', last_name: '', major: '', minor: '', year: 'junior', hometown: ''
  })

  // Step 2 state — list of { company_name, role_name } objects
  const [targets, setTargets] = useState([{ company_name: '', role_name: '' }])

  // Step 3 state — { question_key: answer }
  const [survey, setSurvey] = useState({})

  // ── Step 1 handlers ──
  const handleBasicChange = (e) => {
    setBasicInfo({ ...basicInfo, [e.target.name]: e.target.value })
  }

  const submitStep1 = async () => {
    setError('')
    setLoading(true)
    try {
      await api.post('/profiles/student', basicInfo)
      setStep(1)
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2 handlers ──
  const addTarget = () => {
    setTargets([...targets, { company_name: '', role_name: '' }])
  }

  const updateTarget = (index, field, value) => {
    const updated = targets.map((t, i) =>
      i === index ? { ...t, [field]: value } : t
    )
    setTargets(updated)
  }

  const removeTarget = (index) => {
    setTargets(targets.filter((_, i) => i !== index))
  }

  const submitStep2 = async () => {
    setError('')
    const filled = targets.filter(t => t.company_name.trim())
    if (filled.length === 0) {
      setError('Add at least one target company.')
      return
    }
    setLoading(true)
    try {
      await api.post('/profiles/student/targets', { targets: filled })
      setStep(2)
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 3 handlers ──
  const handleSurveyAnswer = (key, value) => {
    setSurvey({ ...survey, [key]: value.toLowerCase().replace(/ /g, '-') })
  }

  const submitStep3 = async () => {
    setError('')
    const answered = Object.keys(survey).length
    if (answered < SURVEY_QUESTIONS.length) {
      setError(`Please answer all questions. (${answered}/${SURVEY_QUESTIONS.length} answered)`)
      return
    }
    setLoading(true)
    try {
      await api.post('/profiles/student/survey', { responses: survey })
      // Run matching engine immediately after onboarding completes
      await api.post('/matches/run')
      navigate('/dashboard/student')
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  // ─── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-lg p-8">

        <StepIndicator current={step} total={3} />

        {/* ── STEP 1: Basic Info ── */}
        {step === 0 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Tell us about yourself</h2>
            <p className="text-gray-500 text-sm mb-6">Step 1 of 3 · Takes about 1 minute</p>

            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
                  <input name="first_name" value={basicInfo.first_name} onChange={handleBasicChange}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                    placeholder="Kai" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                  <input name="last_name" value={basicInfo.last_name} onChange={handleBasicChange}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                    placeholder="Switzer" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Major</label>
                <input name="major" value={basicInfo.major} onChange={handleBasicChange}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                  placeholder="Finance" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Minor <span className="text-gray-400">(optional)</span></label>
                <input name="minor" value={basicInfo.minor} onChange={handleBasicChange}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                  placeholder="Economics" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                <select name="year" value={basicInfo.year} onChange={handleBasicChange}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200">
                  <option value="freshman">Freshman</option>
                  <option value="sophomore">Sophomore</option>
                  <option value="junior">Junior</option>
                  <option value="senior">Senior</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hometown <span className="text-gray-400">(optional)</span></label>
                <input name="hometown" value={basicInfo.hometown} onChange={handleBasicChange}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                  placeholder="Columbus, OH" />
              </div>
            </div>

            {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mt-4">{error}</div>}

            <button onClick={submitStep1} disabled={loading}
              className="w-full mt-6 py-3 rounded-lg text-white font-semibold text-sm disabled:opacity-50"
              style={{ backgroundColor: '#BB0000' }}>
              {loading ? 'Saving...' : 'Next →'}
            </button>
          </div>
        )}

        {/* ── STEP 2: Target Companies ── */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Where do you want to work?</h2>
            <p className="text-gray-500 text-sm mb-6">Step 2 of 3 · Add your target companies</p>

            <div className="space-y-3">
              {targets.map((target, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-2">
                    <input
                      value={target.company_name}
                      onChange={(e) => updateTarget(i, 'company_name', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                      placeholder="Company (e.g. Goldman Sachs)" />
                    <input
                      value={target.role_name}
                      onChange={(e) => updateTarget(i, 'role_name', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                      placeholder="Role (e.g. Investment Banking Analyst)" />
                  </div>
                  {targets.length > 1 && (
                    <button onClick={() => removeTarget(i)}
                      className="text-gray-400 hover:text-red-500 mt-2 text-lg">✕</button>
                  )}
                </div>
              ))}
            </div>

            <button onClick={addTarget}
              className="mt-3 text-sm font-medium"
              style={{ color: '#BB0000' }}>
              + Add another company
            </button>

            {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mt-4">{error}</div>}

            <button onClick={submitStep2} disabled={loading}
              className="w-full mt-6 py-3 rounded-lg text-white font-semibold text-sm disabled:opacity-50"
              style={{ backgroundColor: '#BB0000' }}>
              {loading ? 'Saving...' : 'Next →'}
            </button>
          </div>
        )}

        {/* ── STEP 3: Survey ── */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Quick personality survey</h2>
            <p className="text-gray-500 text-sm mb-6">Step 3 of 3 · Helps us find your best match</p>

            <div className="space-y-6">
              {SURVEY_QUESTIONS.map((q) => (
                <div key={q.key}>
                  <p className="text-sm font-medium text-gray-800 mb-2">{q.label}</p>
                  <div className="space-y-2">
                    {q.options.map((opt) => {
                      const val = opt.toLowerCase().replace(/ /g, '-')
                      const selected = survey[q.key] === val
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleSurveyAnswer(q.key, opt)}
                          className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition ${
                            selected
                              ? 'border-red-700 text-red-700 bg-red-50'
                              : 'border-gray-200 text-gray-700 hover:border-gray-300'
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

            {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mt-4">{error}</div>}

            <button onClick={submitStep3} disabled={loading}
              className="w-full mt-8 py-3 rounded-lg text-white font-semibold text-sm disabled:opacity-50"
              style={{ backgroundColor: '#BB0000' }}>
              {loading ? 'Finding your match...' : 'Find My Match →'}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}