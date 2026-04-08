// src/pages/Signup.jsx
// Handles account creation for both students and alumni.
// Reads ?type=student or ?type=alumni from the URL (set by the Landing buttons)
// and pre-selects the account type toggle.

import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/axios'

export default function Signup() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    email: '',
    password: '',
    password_confirm: '',
    account_type: searchParams.get('type') || 'student'
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (form.password !== form.password_confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)

    try {
      await api.post('/auth/signup', {
        email: form.email,
        password: form.password,
        account_type: form.account_type,
      })
      setSuccess('Account created! Check your OSU email to verify your address, then log in.')
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-md mx-auto w-full px-4 py-4 flex items-center justify-between">
          <Link
            to="/"
            state={{ allowLanding: true }}
            className="font-bold text-base tracking-tight hover:opacity-80 transition-opacity"
            style={{ color: '#BB0000' }}
          >
            Buckeye Match
          </Link>
          <span className="text-sm text-gray-400">Sign up</span>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4">

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-md p-8">

        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Buckeye Match</h1>
          <p className="text-gray-500 text-sm mt-1">Fisher College of Business</p>
        </div>

        {/* Account type toggle */}
        <div className="flex rounded-lg border border-gray-200 mb-6 overflow-hidden">
          <button
            type="button"
            onClick={() => setForm({ ...form, account_type: 'student' })}
            className={`flex-1 py-2.5 text-sm font-medium transition ${
              form.account_type === 'student'
                ? 'text-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            style={form.account_type === 'student' ? { backgroundColor: '#BB0000' } : {}}
          >
            I'm a Student
          </button>
          <button
            type="button"
            onClick={() => setForm({ ...form, account_type: 'alumni' })}
            className={`flex-1 py-2.5 text-sm font-medium transition ${
              form.account_type === 'alumni'
                ? 'text-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            style={form.account_type === 'alumni' ? { backgroundColor: '#BB0000' } : {}}
          >
            I'm an Alum
          </button>
        </div>

        {/* Form */}
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
                placeholder="At least 8 characters"
                required
                minLength={8}
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              name="password_confirm"
              value={form.password_confirm}
              onChange={handleChange}
              placeholder="Re-enter your password"
              required
              minLength={8}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
            />
          </div>

          {/* Error / success messages */}
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg text-white font-semibold text-sm transition disabled:opacity-50"
            style={{ backgroundColor: '#BB0000' }}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="font-medium" style={{ color: '#BB0000' }}>
            Log in
          </Link>
        </p>
        </div>
      </div>
    </div>
  )
}