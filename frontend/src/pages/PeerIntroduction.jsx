// Async thread for a student peer intro (separate from alumni match messages).

import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import AppHeader from '../components/AppHeader'

function Bubble({ body, sentAt, isMine }) {
  const formatTime = isoString => {
    const date = new Date(isoString)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return (
      date.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
      ' · ' +
      date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    )
  }

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-xs sm:max-w-sm lg:max-w-md">
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
            isMine ? 'text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'
          }`}
          style={isMine ? { backgroundColor: '#BB0000' } : {}}
        >
          {body}
        </div>
        <p className={`text-xs text-gray-400 mt-1 ${isMine ? 'text-right' : 'text-left'}`}>
          {formatTime(sentAt)}
        </p>
      </div>
    </div>
  )
}

export default function PeerIntroduction() {
  const { introId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [acting, setActing] = useState(false)

  const bottomRef = useRef(null)

  const load = async () => {
    setError('')
    try {
      const res = await api.get(`/peers/introductions/${introId}`)
      setDetail(res.data)
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.error || 'Could not load this intro.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [introId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [detail?.messages])

  const intro = detail?.introduction
  const status = intro?.status
  const isRequester = detail?.is_requester
  const canMessage = status === 'accepted'
  const other = detail?.other_student

  const handleSend = async () => {
    const trimmed = body.trim()
    if (!trimmed) return
    setSendError('')
    setSending(true)
    try {
      await api.post(`/peers/introductions/${introId}/messages`, { body: trimmed })
      setBody('')
      await load()
    } catch (err) {
      setSendError(err.response?.data?.error || 'Failed to send.')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const accept = async () => {
    setActing(true)
    try {
      await api.post(`/peers/introductions/${introId}/accept`)
      await load()
    } catch (err) {
      setError(err.response?.data?.error || 'Could not accept.')
    } finally {
      setActing(false)
    }
  }

  const decline = async () => {
    setActing(true)
    try {
      await api.post(`/peers/introductions/${introId}/decline`)
      await load()
    } catch (err) {
      setError(err.response?.data?.error || 'Could not decline.')
    } finally {
      setActing(false)
    }
  }

  const title = other?.display_name || 'Peer conversation'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppHeader
        title={title}
        showBack
        onBack={() => navigate('/peers')}
        maxWidthClassName="max-w-2xl"
      />

      <div className="max-w-2xl w-full mx-auto px-4 pt-4 pb-2">
        {detail?.company_name && (
          <p className="text-xs text-gray-500">
            Topic: <span className="font-medium text-gray-700">{detail.company_name}</span>
          </p>
        )}
        {status === 'pending' && !isRequester && (
          <div className="mt-3 flex flex-wrap gap-2 items-center">
            <button
              type="button"
              onClick={accept}
              disabled={acting}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: '#BB0000' }}
            >
              Accept intro
            </button>
            <button
              type="button"
              onClick={decline}
              disabled={acting}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 disabled:opacity-50"
            >
              Decline
            </button>
            <span className="text-xs text-gray-500">You can message after you accept.</span>
          </div>
        )}
        {status === 'pending' && isRequester && (
          <p className="mt-3 text-sm text-gray-500">Waiting for them to accept your intro.</p>
        )}
        {status === 'declined' && (
          <p className="mt-3 text-sm text-gray-500">This intro was declined. Messaging stays closed.</p>
        )}
      </div>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-4 flex flex-col">
        {loading && (
          <div className="flex flex-col gap-3 flex-1">
            {[1, 2].map(i => (
              <div key={i} className={`flex ${i % 2 ? 'justify-end' : 'justify-start'}`}>
                <div className="h-10 w-48 rounded-2xl bg-gray-200 animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {!loading && !error && detail?.messages?.length > 0 && (
          <div className="flex flex-col gap-3 flex-1">
            {detail.messages.map((msg, idx) => (
              <Bubble
                key={msg.id ?? `init-${idx}`}
                body={msg.body}
                sentAt={msg.sent_at}
                isMine={msg.sender_id === user?.id}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </main>

      <div className="bg-white border-t border-gray-100 sticky bottom-0">
        <div className="max-w-2xl mx-auto px-4 py-3">
          {sendError && <p className="text-xs text-red-600 mb-2">{sendError}</p>}
          <div className="flex items-end gap-3">
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!canMessage}
              rows={1}
              placeholder={canMessage ? 'Write a message…' : 'Messaging opens when the intro is accepted.'}
              className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-200 disabled:bg-gray-50 disabled:text-gray-400"
              style={{ maxHeight: '120px', overflowY: 'auto' }}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !body.trim() || !canMessage}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 flex-shrink-0"
              style={{ backgroundColor: '#BB0000' }}
            >
              {sending ? '…' : 'Send'}
            </button>
          </div>
          {canMessage && (
            <p className="text-xs text-gray-400 mt-2">Enter to send · Shift+Enter for new line</p>
          )}
        </div>
      </div>
    </div>
  )
}
