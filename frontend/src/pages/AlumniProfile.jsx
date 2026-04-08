// src/pages/AlumniProfile.jsx
// Edit page for alumni — lets them update all profile fields after onboarding.
// Accessible by clicking their name in the nav header on the dashboard.
//
// Four sections:
//   1. Basic info — name, company, role, career summary, bio, past experience
//   2. Availability — open / limited / closed
//   3. Privacy — toggle whether to show "X students helped" publicly

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'

// ─── SECTION WRAPPER ─────────────────────────────────────────────────────────
function Section({ title, subtitle, onSave, saving, saved, error, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
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

const AVAILABILITY_OPTIONS = [
  { value: 'open',    label: 'Open to connect',        description: 'Actively available to message with matched students.' },
  { value: 'limited', label: 'Limited availability',   description: 'Can respond but may be slow — busy season or travel.' },
  { value: 'closed',  label: 'Not available right now', description: 'Pause matches temporarily. Change this anytime.' },
]

export default function AlumniProfile() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // Section 1 — basic info + history
  const [basic, setBasic] = useState({
    first_name: '', last_name: '', current_company: '', current_role: '', career_summary: '', bio: ''
  })
  const [history, setHistory]             = useState([{ company: '', role: '', years: '' }])
  const [savingBasic, setSavingBasic]     = useState(false)
  const [savedBasic, setSavedBasic]       = useState(false)
  const [errorBasic, setErrorBasic]       = useState('')

  // Section 2 — availability
  const [availability, setAvailability]   = useState('open')
  const [savingAvail, setSavingAvail]     = useState(false)
  const [savedAvail, setSavedAvail]       = useState(false)
  const [errorAvail, setErrorAvail]       = useState('')

  // Section 3 — privacy
  const [showHelpedCount, setShowHelpedCount] = useState(true)
  const [helpedCount, setHelpedCount]         = useState(0)
  const [savingPrivacy, setSavingPrivacy]     = useState(false)
  const [savedPrivacy, setSavedPrivacy]       = useState(false)
  const [errorPrivacy, setErrorPrivacy]       = useState('')

  useEffect(() => {
    async function fetchProfile() {
      setLoadError('')
      try {
        const res = await api.get('/profiles/alumni/me')
        const p = res.data

        setBasic({
          first_name:      p.first_name      ?? '',
          last_name:       p.last_name       ?? '',
          current_company: p.current_company ?? '',
          current_role:    p.current_role    ?? '',
          career_summary:  p.career_summary  ?? '',
          bio:             p.bio             ?? '',
        })

        if (p.history && p.history.length > 0) {
          setHistory(p.history.map(h => ({
            company: h.company_name ?? '',
            role:    h.role_name    ?? '',
            years:   h.start_year ? String(h.start_year) : ''
          })))
        } else {
          setHistory([{ company: '', role: '', years: '' }])
        }

        setAvailability(p.availability ?? 'open')
        setShowHelpedCount(p.show_helped_count !== false)
        setHelpedCount(typeof p.helped_count === 'number' ? p.helped_count : 0)
      } catch (err) {
        console.error('Failed to load profile:', err)
        const status = err.response?.status
        if (status === 404) {
          setLoadError('')
        } else {
          setLoadError(err.response?.data?.error || 'Could not load your profile. Try refreshing the page.')
        }
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  // Basic info + history share one save — same endpoint as onboarding step 1
  const saveBasic = async () => {
    setErrorBasic('')
    setSavingBasic(true)
    try {
      const filledHistory = history.filter(h => h.company.trim()).map(h => ({
        company_name: h.company,
        role_name:    h.role,
        start_year:   h.years ? parseInt(h.years) : null,
      }))
      const res = await api.post('/profiles/alumni', { ...basic, history: filledHistory })
      const p = res.data?.profile
      if (p) {
        setBasic({
          first_name:      p.first_name      ?? '',
          last_name:       p.last_name       ?? '',
          current_company: p.current_company ?? '',
          current_role:    p.current_role    ?? '',
          career_summary:  p.career_summary  ?? '',
          bio:             p.bio             ?? '',
        })
        if (p.history && p.history.length > 0) {
          setHistory(p.history.map(h => ({
            company: h.company_name ?? '',
            role:    h.role_name    ?? '',
            years:   h.start_year ? String(h.start_year) : ''
          })))
        }
      }
      setSavedBasic(true)
      setTimeout(() => setSavedBasic(false), 2000)
    } catch (err) {
      setErrorBasic(err.response?.data?.error || 'Something went wrong.')
    } finally {
      setSavingBasic(false)
    }
  }

  const saveAvailability = async () => {
    setErrorAvail('')
    setSavingAvail(true)
    try {
      await api.post('/profiles/alumni/availability', { availability })
      setSavedAvail(true)
      setTimeout(() => setSavedAvail(false), 2000)
    } catch (err) {
      setErrorAvail(err.response?.data?.error || 'Something went wrong.')
    } finally {
      setSavingAvail(false)
    }
  }

  const savePrivacy = async () => {
    setErrorPrivacy('')
    setSavingPrivacy(true)
    try {
      await api.post('/profiles/alumni/privacy', { show_helped_count: showHelpedCount })
      setSavedPrivacy(true)
      setTimeout(() => setSavedPrivacy(false), 2000)
    } catch (err) {
      setErrorPrivacy(err.response?.data?.error || 'Something went wrong.')
    } finally {
      setSavingPrivacy(false)
    }
  }

  // History helpers — always allow delete on every row
  const addHistory    = () => setHistory([...history, { company: '', role: '', years: '' }])
  const updateHistory = (i, field, val) =>
    setHistory(history.map((h, idx) => idx === i ? { ...h, [field]: val } : h))
  const removeHistory = (i) => setHistory(history.filter((_, idx) => idx !== i))

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
            onClick={() => navigate('/dashboard/alumni')}
            className="text-gray-400 hover:text-gray-700 transition-colors text-lg"
          >←</button>
          <span className="font-bold text-base tracking-tight" style={{ color: '#BB0000' }}>
            Edit Profile
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">

        {loadError && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 rounded-xl">
            {loadError}
          </div>
        )}

        {/* ── Section 1: Basic Info + History ── */}
        <Section
          title="Your background"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Current company</label>
              <input
                value={basic.current_company}
                onChange={e => setBasic({ ...basic, current_company: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current role</label>
              <input
                value={basic.current_role}
                onChange={e => setBasic({ ...basic, current_role: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Career summary <span className="text-gray-400">(optional)</span>
              </label>
              <textarea
                value={basic.career_summary}
                onChange={e => setBasic({ ...basic, career_summary: e.target.value })}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bio <span className="text-gray-400">(optional — shown to matched students)</span>
              </label>
              <textarea
                value={basic.bio}
                onChange={e => setBasic({ ...basic, bio: e.target.value })}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
                placeholder="Tell students a bit about your path — what you wish you knew when you were in their shoes."
              />
            </div>

            {/* Past experience — "+ Add another role" lives inside Section
                so it never overlaps the Save button */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Past experience <span className="text-gray-400">(optional)</span>
              </label>
              <div className="space-y-3">
                {history.map((h, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1 space-y-2">
                      <input
                        value={h.company}
                        onChange={e => updateHistory(i, 'company', e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                        placeholder="Previous company"
                      />
                      <div className="flex gap-2">
                        <input
                          value={h.role}
                          onChange={e => updateHistory(i, 'role', e.target.value)}
                          className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                          placeholder="Role"
                        />
                        <input
                          value={h.years}
                          onChange={e => updateHistory(i, 'years', e.target.value)}
                          className="w-20 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                          placeholder="Year"
                        />
                      </div>
                    </div>
                    {/* Always show delete button on every row */}
                    <button
                      onClick={() => removeHistory(i)}
                      className="text-gray-300 hover:text-red-500 transition-colors mt-2 text-lg flex-shrink-0"
                    >✕</button>
                  </div>
                ))}
              </div>

              {/* Add link inside the section card, above Save button */}
              <button
                onClick={addHistory}
                className="mt-4 text-sm font-medium block"
                style={{ color: '#BB0000' }}
              >
                + Add another role
              </button>
            </div>
          </div>
        </Section>

        {/* ── Section 2: Availability ── */}
        <Section
          title="Availability"
          subtitle="Controls whether you receive new student matches."
          onSave={saveAvailability}
          saving={savingAvail}
          saved={savedAvail}
          error={errorAvail}
        >
          <div className="space-y-3">
            {AVAILABILITY_OPTIONS.map(opt => {
              const selected = availability === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAvailability(opt.value)}
                  className={`w-full text-left px-4 py-3.5 rounded-xl border text-sm transition ${
                    selected ? 'bg-red-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  style={selected ? { borderColor: '#BB0000' } : {}}
                >
                  <p className="font-semibold" style={selected ? { color: '#BB0000' } : { color: '#111827' }}>
                    {opt.label}
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5">{opt.description}</p>
                </button>
              )
            })}
          </div>
        </Section>

        {/* ── Section 3: Privacy ── */}
        <Section
          title="Privacy"
          subtitle="Control what other people can see on your profile."
          onSave={savePrivacy}
          saving={savingPrivacy}
          saved={savedPrivacy}
          error={errorPrivacy}
        >
          <div
            className="flex items-center justify-between px-4 py-4 rounded-xl border border-gray-100 bg-gray-50 cursor-pointer"
            onClick={() => setShowHelpedCount(!showHelpedCount)}
          >
            <div>
              <p className="text-sm font-medium text-gray-800">
                Show "students helped" count
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {helpedCount > 0
                  ? `You've helped ${helpedCount} student${helpedCount !== 1 ? 's' : ''} so far.`
                  : 'No students credited yet — updates as outcomes are logged.'}
              </p>
            </div>

            {/* Toggle switch */}
            <div
              className="w-11 h-6 rounded-full flex items-center px-0.5 flex-shrink-0 transition-colors"
              style={{ backgroundColor: showHelpedCount ? '#BB0000' : '#D1D5DB' }}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  showHelpedCount ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </div>
        </Section>

      </main>
    </div>
  )
}