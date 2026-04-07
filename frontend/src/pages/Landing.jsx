// src/pages/Landing.jsx
// The first thing a user sees. OSU-branded, simple, two clear paths:
// sign up as a student or as an alumni.

import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

export default function Landing() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // If already logged in, skip landing and go straight to their dashboard
  useEffect(() => {
    if (user && !location.state?.allowLanding) {
      navigate(user.account_type === 'student'
        ? '/dashboard/student'
        : '/dashboard/alumni'
      )
    }
  }, [user, location.state, navigate])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header */}
      <header className="bg-scarlet px-8 py-5 flex items-center justify-between"
        style={{ backgroundColor: '#BB0000' }}>
        <div>
          <Link
            to="/"
            state={{ allowLanding: true }}
            className="inline-block text-white text-2xl font-bold tracking-tight hover:opacity-90 transition-opacity"
          >
            Buckeye Match
          </Link>
          <p className="text-red-200 text-sm">Fisher College of Business</p>
        </div>
        <Link
          to="/login"
          className="text-white border border-white px-4 py-2 rounded-lg text-sm hover:bg-white hover:text-red-700 transition"
        >
          Log in
        </Link>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="max-w-xl">
          <h2 className="text-4xl font-bold text-gray-900 mb-4 leading-tight">
            Get a warm intro to someone at your dream company
          </h2>
          <p className="text-gray-500 text-lg mb-10">
            Buckeye Match connects Fisher students with OSU alumni at their target companies —
            no cold outreach, no awkward LinkedIn messages.
          </p>

          {/* Two signup paths */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/signup?type=student"
              className="px-8 py-4 rounded-xl text-white font-semibold text-lg transition"
              style={{ backgroundColor: '#BB0000' }}
            >
              I'm a Student
            </Link>
            <Link
              to="/signup?type=alumni"
              className="px-8 py-4 rounded-xl border-2 font-semibold text-lg transition hover:bg-gray-100"
              style={{ borderColor: '#BB0000', color: '#BB0000' }}
            >
              I'm an Alum
            </Link>
          </div>

          <p className="text-gray-400 text-sm mt-6">
            OSU email required · Free for students and alumni
          </p>
        </div>
      </main>

      {/* How it works — 3 steps */}
      <section className="bg-white border-t border-gray-100 py-14 px-6">
        <div className="max-w-3xl mx-auto">
          <h3 className="text-center text-xl font-semibold text-gray-700 mb-10">
            How it works
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-3xl mb-3">📋</div>
              <h4 className="font-semibold text-gray-800 mb-1">Build your profile</h4>
              <p className="text-gray-500 text-sm">
                Tell us your target companies, major, and a quick personality survey.
                Takes under 5 minutes.
              </p>
            </div>
            <div>
              <div className="text-3xl mb-3">🎯</div>
              <h4 className="font-semibold text-gray-800 mb-1">Get matched</h4>
              <p className="text-gray-500 text-sm">
                We find an OSU alum at one of your target companies who shares
                your background and interests.
              </p>
            </div>
            <div>
              <div className="text-3xl mb-3">💬</div>
              <h4 className="font-semibold text-gray-800 mb-1">Start the conversation</h4>
              <p className="text-gray-500 text-sm">
                Message your match inside the app. No awkward cold outreach —
                they already know why you're reaching out.
              </p>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}