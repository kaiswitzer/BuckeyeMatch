// src/pages/Messages.jsx
// Async message thread between a student and alumni for a given match.
// The match ID comes from the URL: /messages/:matchId
//
// This is like a simple email thread — not live chat. The user sends a
// message, it posts to the backend, and the thread refreshes to show it.
//
// Two endpoints used:
//   GET  /api/messages/<matchId>  — fetch all messages in the thread
//   POST /api/messages/<matchId>  — send a new message

import { useEffect, useState, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

// ─── SINGLE MESSAGE BUBBLE ───────────────────────────────────────────────────
// Renders one message. If the logged-in user sent it, it appears on the right
// in OSU red. If the other person sent it, it appears on the left in gray.
// This is like CSS conditional classes based on a boolean — same pattern
// you'd use in Java with a ternary for style logic.
function MessageBubble({ message, isMine }) {
  // Format the timestamp — just time if today, date + time if older
  const formatTime = (isoString) => {
    const date = new Date(isoString)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
      ' · ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-xs sm:max-w-sm lg:max-w-md`}>
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
            isMine
              ? 'text-white rounded-br-sm'
              : 'bg-gray-100 text-gray-800 rounded-bl-sm'
          }`}
          style={isMine ? { backgroundColor: '#BB0000' } : {}}
        >
          {message.body}
        </div>
        <p className={`text-xs text-gray-400 mt-1 ${isMine ? 'text-right' : 'text-left'}`}>
          {formatTime(message.sent_at)}
        </p>
      </div>
    </div>
  )
}

// ─── EMPTY THREAD STATE ──────────────────────────────────────────────────────
// Shown when the match exists but no messages have been sent yet
function EmptyThread({ otherName, isStudent }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 text-center px-8 py-16 gap-3">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
        style={{ backgroundColor: '#FFF0F0' }}
      >
        💬
      </div>
      <p className="font-semibold text-gray-800">Start the conversation</p>
      <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
        {isStudent
          ? `Say hi to ${otherName} — introduce yourself and what you're hoping to learn.`
          : `${otherName} is looking forward to hearing from you.`}
      </p>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function Messages() {
  // useParams reads the :matchId from the URL — like reading a path variable
  // in a Java Spring @PathVariable
  const { matchId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [messages, setMessages]   = useState([])
  const [body, setBody]           = useState('')
  const [loading, setLoading]     = useState(true)
  const [sending, setSending]     = useState(false)
  const [error, setError]         = useState(null)
  const [sendError, setSendError] = useState('')
  const [otherName, setOtherName] = useState('')
  const [matchStatus, setMatchStatus] = useState(null)

  // Ref to the bottom of the message list — used to auto-scroll after
  // new messages arrive. Like calling scrollIntoView() in plain JS.
  const bottomRef = useRef(null)

  // Fetch messages on mount and derive the other person's name
  useEffect(() => {
    async function fetchMessages() {
      try {
        const [msgRes, matchRes] = await Promise.all([
          api.get(`/messages/${matchId}`),
          api.get('/matches/mine')
        ])

        setMessages(msgRes.data.messages ?? [])

        // Find this specific match in the mine list to get the other person's name.
        // We fetch /matches/mine because that's the endpoint that returns the
        // full student/alumni profile alongside the match object.
        const allMatches = matchRes.data.matches ?? []
        const thisMatch = allMatches.find(
          m => String(m.match.id) === String(matchId)
        )

        if (thisMatch) {
          setMatchStatus(thisMatch.match?.status ?? null)
          if (user?.account_type === 'student' && thisMatch.alumni) {
            setOtherName(`${thisMatch.alumni.first_name} ${thisMatch.alumni.last_name}`)
          } else if (user?.account_type === 'alumni' && thisMatch.student) {
            setOtherName(`${thisMatch.student.first_name} ${thisMatch.student.last_name}`)
          }
        }
      } catch (err) {
        console.error('Failed to load messages:', err)
        setError('Could not load this conversation. Try refreshing.')
      } finally {
        setLoading(false)
      }
    }
    fetchMessages()
  }, [matchId, user])

  // Auto-scroll to bottom whenever messages change —
  // same behavior as iMessage or Slack
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    setSendError('')
    const trimmed = body.trim()
    if (!trimmed) return

    setSending(true)
    try {
      const res = await api.post(`/messages/${matchId}`, { body: trimmed })
      // Append the new message to the thread immediately
      setMessages(prev => [...prev, res.data.data])
      setBody('')
    } catch (err) {
      setSendError(err.response?.data?.error || 'Failed to send. Try again.')
    } finally {
      setSending(false)
    }
  }

  // Allow sending with Enter key (Shift+Enter for newline)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const isStudent = user?.account_type === 'student'
  const canSend = !isStudent || matchStatus === 'accepted' || matchStatus === 'active'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Top nav ── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">

          {/* Back button — goes to their dashboard */}
          <button
            onClick={() => navigate(isStudent ? '/dashboard/student' : '/dashboard/alumni')}
            className="text-gray-400 hover:text-gray-700 transition-colors text-lg leading-none"
          >
            ←
          </button>

          {/* Other person's avatar + name */}
          {otherName && (
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                style={{ backgroundColor: '#BB0000' }}
              >
                {otherName.split(' ').map(n => n[0]).join('').toUpperCase()}
              </div>
              <span className="font-semibold text-gray-900 text-sm">{otherName}</span>
            </div>
          )}

          {/* Wordmark pushed to right */}
          <Link
            to="/"
            state={{ allowLanding: true }}
            className="ml-auto font-bold text-sm tracking-tight hover:opacity-80 transition-opacity"
            style={{ color: '#BB0000' }}
          >
            Buckeye Match
          </Link>
        </div>
      </header>

      {/* ── Message thread ── */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 flex flex-col">

        {loading && (
          // Skeleton for loading state
          <div className="flex flex-col gap-4 flex-1">
            {[1, 2, 3].map(i => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                <div className={`h-10 rounded-2xl animate-pulse bg-gray-200 ${i % 2 === 0 ? 'w-48' : 'w-64'}`} />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-6 py-5 text-sm text-red-600">
            {error}
          </div>
        )}

        {!loading && !error && messages.length === 0 && (
          <EmptyThread otherName={otherName} isStudent={isStudent} />
        )}

        {!loading && !error && messages.length > 0 && (
          <div className="flex flex-col gap-3 flex-1">
            {messages.map(msg => (
              <MessageBubble
                key={msg.id}
                message={msg}
                // A message is "mine" if the logged-in user's ID matches sender_id
                isMine={msg.sender_id === user?.id}
              />
            ))}
            {/* Invisible div at the bottom — scrolled into view after new messages */}
            <div ref={bottomRef} />
          </div>
        )}
      </main>

      {/* ── Compose box — sticky at bottom ── */}
      <div className="bg-white border-t border-gray-100 sticky bottom-0">
        <div className="max-w-2xl mx-auto px-4 py-3">

          {!loading && !error && isStudent && !canSend && (
            <p className="text-xs text-gray-500 mb-2">
              Waiting for the alumni to accept before you can message.
            </p>
          )}

          {sendError && (
            <p className="text-xs text-red-600 mb-2">{sendError}</p>
          )}

          <div className="flex items-end gap-3">
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!canSend}
              rows={1}
              placeholder="Write a message..."
              className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-200 disabled:bg-gray-50 disabled:text-gray-400"
              // Auto-grow the textarea up to 5 rows as the user types
              style={{ maxHeight: '120px', overflowY: 'auto' }}
            />
            <button
              onClick={handleSend}
              disabled={sending || !body.trim() || !canSend}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 flex-shrink-0"
              style={{ backgroundColor: '#BB0000' }}
            >
              {sending ? '...' : 'Send'}
            </button>
          </div>

          <p className="text-xs text-gray-400 mt-2">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>

    </div>
  )
}