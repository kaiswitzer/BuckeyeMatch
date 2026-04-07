// src/pages/AlumniOnboarding.jsx
// 2-step onboarding flow for alumni.
// Step 1 — identity + background (name, company, role, career summary, past history)
// Step 2 — availability preference (open / limited / closed)
//
// Follows the exact same pattern as StudentOnboarding.jsx:
// one component, a step counter in state, each step submits to the backend
// before advancing. Think of it like a Java wizard pattern.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'

// ─── STEP INDICATOR ──────────────────────────────────────────────────────────
// Same component pattern as StudentOnboarding — dots that fill as you progress.
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

// ─── AVAILABILITY OPTIONS ────────────────────────────────────────────────────
// Each option has a value (sent to backend), a label, and a description
// so alumni understand what they're committing to.
const AVAILABILITY_OPTIONS = [
  {
    value: 'open',
    label: 'Open to connect',
    description: 'I am actively available to message with matched students.'
  },
  {
    value: 'limited',
    label: 'Limited availability',
    description: 'I can respond but may be slow — busy season or travel.'
  },
  {
    value: 'closed',
    label: 'Not available right now',
    description: 'Pause my matches temporarily. I can change this later.'
  }
]

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function AlumniOnboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Step 1 state — identity and background fields
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    current_company: '',
    current_role: '',
    career_summary: '',
  })

  // Step 1 — past history entries, same add/remove pattern as student targets
  // Each entry is { company, role, years } — a previous job
  const [history, setHistory] = useState([{ company: '', role: '', years: '' }])

  // Step 2 state — single selection
  const [availability, setAvailability] = useState('open')

  // ── Step 1 field handler ──
  // Spread operator here works like Java's copy constructor — keep all existing
  // fields and just update the one that changed
  const handleProfileChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value })
  }

  // ── History handlers ──
  const addHistory = () => {
    setHistory([...history, { company: '', role: '', years: '' }])
  }

  const updateHistory = (index, field, value) => {
    const updated = history.map((h, i) =>
      i === index ? { ...h, [field]: value } : h
    )
    setHistory(updated)
  }

  const removeHistory = (index) => {
    setHistory(history.filter((_, i) => i !== index))
  }

  // ── Step 1 submit ──
  // Sends profile + history together to POST /api/profiles/alumni
  const submitStep1 = async () => {
    setError('')

    // Basic validation — name, company, role are required
    if (!profile.first_name.trim() || !profile.last_name.trim()) {
      setError('Please enter your first and last name.')
      return
    }
    if (!profile.current_company.trim() || !profile.current_role.trim()) {
      setError('Please enter your current company and role.')
      return
    }

    setLoading(true)
    try {
      // Filter out empty history rows before sending
      const filledHistory = history.filter(h => h.company.trim())

      await api.post('/profiles/alumni', {
        ...profile,
        history: filledHistory
      })
      setStep(1)
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2 submit ──
  // Sends availability to PATCH /api/profiles/alumni/availability
  const submitStep2 = async () => {
    setError('')
    setLoading(true)
    try {
      await api.post('/profiles/alumni/availability', { availability })
      navigate('/dashboard/alumni')
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-lg p-8">

        <StepIndicator current={step} total={2} />

        {/* ── STEP 1: Profile ── */}
        {step === 0 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Tell us about yourself</h2>
            <p className="text-gray-500 text-sm mb-6">Step 1 of 2 · Your background helps us match you with the right students</p>

            <div className="space-y-4">

              {/* Name row */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
                  <input
                    name="first_name"
                    value={profile.first_name}
                    onChange={handleProfileChange}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                    placeholder="Sarah"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                  <input
                    name="last_name"
                    value={profile.last_name}
                    onChange={handleProfileChange}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                    placeholder="Chen"
                  />
                </div>
              </div>

              {/* Current company */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current company</label>
                <input
                  name="current_company"
                  value={profile.current_company}
                  onChange={handleProfileChange}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                  placeholder="Goldman Sachs"
                />
              </div>

              {/* Current role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current role</label>
                <input
                  name="current_role"
                  value={profile.current_role}
                  onChange={handleProfileChange}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                  placeholder="Vice President"
                />
              </div>

              {/* Career summary */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Career summary <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  name="career_summary"
                  value={profile.career_summary}
                  onChange={handleProfileChange}
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
                  placeholder="Fisher Finance grad, 8 years in investment banking..."
                />
              </div>

              {/* Past history — add/remove rows */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Past experience <span className="text-gray-400">(optional)</span>
                </label>

                <div className="space-y-3">
                  {history.map((entry, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <div className="flex-1 space-y-2">
                        <input
                          value={entry.company}
                          onChange={(e) => updateHistory(i, 'company', e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                          placeholder="Previous company (e.g. J.P. Morgan)"
                        />
                        <div className="flex gap-2">
                          <input
                            value={entry.role}
                            onChange={(e) => updateHistory(i, 'role', e.target.value)}
                            className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                            placeholder="Role"
                          />
                          <input
                            value={entry.years}
                            onChange={(e) => updateHistory(i, 'years', e.target.value)}
                            className="w-20 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                            placeholder="Years"
                          />
                        </div>
                      </div>
                      {/* Only show remove button if there's more than one row */}
                      {history.length > 1 && (
                        <button
                          onClick={() => removeHistory(i)}
                          className="text-gray-400 hover:text-red-500 mt-2 text-lg"
                        >✕</button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={addHistory}
                  className="mt-3 text-sm font-medium"
                  style={{ color: '#BB0000' }}
                >
                  + Add another role
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mt-4">{error}</div>
            )}

            <button
              onClick={submitStep1}
              disabled={loading}
              className="w-full mt-6 py-3 rounded-lg text-white font-semibold text-sm disabled:opacity-50"
              style={{ backgroundColor: '#BB0000' }}
            >
              {loading ? 'Saving...' : 'Next →'}
            </button>
          </div>
        )}

        {/* ── STEP 2: Availability ── */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">How available are you?</h2>
            <p className="text-gray-500 text-sm mb-6">Step 2 of 2 · You can change this anytime from your dashboard</p>

            <div className="space-y-3">
              {AVAILABILITY_OPTIONS.map((opt) => {
                const selected = availability === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAvailability(opt.value)}
                    className={`w-full text-left px-4 py-3.5 rounded-xl border text-sm transition ${
                      selected
                        ? 'bg-red-50'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                    style={selected ? { borderColor: '#BB0000' } : {}}
                  >
                    <p
                      className="font-semibold"
                      style={selected ? { color: '#BB0000' } : { color: '#111827' }}
                    >
                      {opt.label}
                    </p>
                    <p className="text-gray-500 text-xs mt-0.5">{opt.description}</p>
                  </button>
                )
              })}
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mt-4">{error}</div>
            )}

            <button
              onClick={submitStep2}
              disabled={loading}
              className="w-full mt-6 py-3 rounded-lg text-white font-semibold text-sm disabled:opacity-50"
              style={{ backgroundColor: '#BB0000' }}
            >
              {loading ? 'Finishing up...' : 'Go to my dashboard →'}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}