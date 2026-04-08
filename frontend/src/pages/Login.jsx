// src/pages/Login.jsx
// Handles login for both students and alumni.
// On success, saves the token + user to AuthContext and redirects
// to the correct place based on account type AND whether they've
// already completed onboarding.

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import AppHeader from '../components/AppHeader'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const payload = {
        ...form,
        email: form.email.trim().toLowerCase(),
      }
      const res = await api.post('/auth/login', payload)
      const { token, user } = res.data

      // Save to AuthContext + localStorage
      login(token, user)

      if (user?.is_admin) {
        navigate('/admin')
        return
      }

      // Route based on account type AND whether they've completed onboarding.
      // has_profile is true if the user has at least submitted step 1 of onboarding.
      // If they have a profile → go to dashboard.
      // If they don't → go to onboarding.
      // Think of this like a Java switch on two conditions at once.
      if (user.account_type === 'student') {
        navigate(user.has_profile ? '/dashboard/student' : '/onboarding/student')
      } else {
        navigate(user.has_profile ? '/dashboard/alumni' : '/onboarding/alumni')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppHeader
        title="Log in"
        maxWidthClassName="max-w-md"
      />

      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-md p-8">

        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Buckeye Match</h1>
          <p className="text-gray-500 text-sm mt-1">Fisher College of Business</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              OSU Email
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="buckeye.1@osu.edu"
              required
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Your password"
                required
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg text-white font-semibold text-sm transition disabled:opacity-50"
            style={{ backgroundColor: '#BB0000' }}
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Don't have an account?{' '}
          <Link to="/signup" className="font-medium" style={{ color: '#BB0000' }}>
            Sign up
          </Link>
        </p>
        </div>
      </div>
    </div>
  )
}