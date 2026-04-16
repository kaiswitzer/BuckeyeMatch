// Student peer discovery by company — purpose-driven intros, not a social graph.

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import AppHeader from '../components/AppHeader'

export default function StudentPeers() {
  const navigate = useNavigate()
  const [company, setCompany] = useState('')
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [peers, setPeers] = useState([])
  const [searchError, setSearchError] = useState('')
  const [targets, setTargets] = useState([])

  const [lists, setLists] = useState({ incoming: [], outgoing: [] })
  const [loadingLists, setLoadingLists] = useState(true)

  const [modalPeer, setModalPeer] = useState(null)
  const [introBody, setIntroBody] = useState('')
  const [sendingIntro, setSendingIntro] = useState(false)
  const [introError, setIntroError] = useState('')

  const loadLists = async () => {
    try {
      const res = await api.get('/peers/introductions')
      setLists({
        incoming: res.data.incoming ?? [],
        outgoing: res.data.outgoing ?? [],
      })
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingLists(false)
    }
  }

  useEffect(() => {
    loadLists()
  }, [])

  useEffect(() => {
    async function loadTargets() {
      try {
        const res = await api.get('/profiles/student/me')
        const t = res.data?.targets ?? []
        setTargets(t)
        setCompany(prev => {
          if (prev.trim()) return prev
          if (t.length > 0 && t[0].company_name) return t[0].company_name
          return prev
        })
      } catch {
        /* ignore */
      }
    }
    loadTargets()
  }, [])

  const runSearch = async () => {
    const q = company.trim()
    if (!q) {
      setSearchError('Enter a company name to search.')
      return
    }
    setSearchError('')
    setSearching(true)
    setHasSearched(true)
    setPeers([])
    try {
      const res = await api.get('/peers/by-company', { params: { company: q } })
      setPeers(res.data.peers ?? [])
    } catch (err) {
      setSearchError(err.response?.data?.error || 'Could not load peers.')
    } finally {
      setSearching(false)
    }
  }

  const openIntro = (peer) => {
    setModalPeer(peer)
    setIntroBody('')
    setIntroError('')
  }

  const sendIntro = async () => {
    if (!modalPeer) return
    const body = introBody.trim()
    if (!body) {
      setIntroError('Write a short note about what you want to ask.')
      return
    }
    setSendingIntro(true)
    setIntroError('')
    try {
      await api.post('/peers/introductions', {
        recipient_student_id: modalPeer.student_id,
        company_name: modalPeer.company_name,
        body,
      })
      setModalPeer(null)
      await loadLists()
    } catch (err) {
      setIntroError(err.response?.data?.error || 'Could not send intro.')
    } finally {
      setSendingIntro(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title="Student peers"
        showBack
        onBack={() => navigate('/dashboard/student')}
        maxWidthClassName="max-w-2xl"
      />

      <main className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ask a past intern</h1>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            Find other students who have shared where they&apos;ve worked and opted in to help peers.
            This isn&apos;t a public feed or a connection count — just short, company-focused
            conversations.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Find by company</h2>
          <p className="text-xs text-gray-500 mb-4">
            Search matches the employer name on a peer&apos;s shared experience (same idea as your
            target companies).
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={company}
              onChange={e => setCompany(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runSearch()}
              placeholder="e.g. JPMorgan Chase"
              className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
            />
            <button
              type="button"
              onClick={runSearch}
              disabled={searching}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: '#BB0000' }}
            >
              {searching ? 'Searching…' : 'Search'}
            </button>
          </div>
          {targets.length > 0 && (
            <p className="text-xs text-gray-400 mt-3">
              Tip: one of your targets is{' '}
              <button
                type="button"
                className="text-gray-600 underline"
                onClick={() => {
                  setCompany(targets[0].company_name)
                }}
              >
                {targets[0].company_name}
              </button>
              .
            </p>
          )}
          {searchError && (
            <p className="text-sm text-red-600 mt-3">{searchError}</p>
          )}

          {!searching && hasSearched && peers.length === 0 && company.trim() && !searchError && (
            <p className="text-sm text-gray-500 mt-4">
              No peers with visible experience at that company yet. Lists stay small because peers
              choose whether to appear — try another spelling or check back later.
            </p>
          )}

          {peers.length > 0 && (
            <ul className="mt-6 space-y-3">
              {peers.map(p => (
                <li
                  key={p.student_id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-gray-900">{p.display_name}</p>
                    <p className="text-sm text-gray-600">
                      {p.major} · {p.year}
                    </p>
                    {(p.role_name || p.term_label) && (
                      <p className="text-xs text-gray-500 mt-1">
                        {[p.role_name, p.term_label].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => openIntro(p)}
                    className="text-sm font-semibold px-4 py-2 rounded-lg text-white shrink-0"
                    style={{ backgroundColor: '#BB0000' }}
                  >
                    Request intro
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Your intro requests</h2>
          <p className="text-xs text-gray-500 mb-5">
            Incoming requests need a quick accept or decline before messaging opens.
          </p>

          {loadingLists ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Incoming
                </p>
                {(lists.incoming ?? []).length === 0 ? (
                  <p className="text-sm text-gray-500">None right now.</p>
                ) : (
                  <ul className="space-y-2">
                    {lists.incoming.map(row => (
                      <li key={row.id}>
                        <Link
                          to={`/peers/introductions/${row.id}`}
                          className="block rounded-xl border border-gray-100 px-4 py-3 hover:bg-gray-50 transition-colors"
                        >
                          <p className="font-medium text-gray-900">{row.other_student.display_name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{row.company_name}</p>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{row.preview}</p>
                          <p className="text-xs text-gray-400 mt-2 capitalize">{row.status}</p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Sent
                </p>
                {(lists.outgoing ?? []).length === 0 ? (
                  <p className="text-sm text-gray-500">You haven&apos;t sent an intro yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {lists.outgoing.map(row => (
                      <li key={row.id}>
                        <Link
                          to={`/peers/introductions/${row.id}`}
                          className="block rounded-xl border border-gray-100 px-4 py-3 hover:bg-gray-50 transition-colors"
                        >
                          <p className="font-medium text-gray-900">{row.other_student.display_name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{row.company_name}</p>
                          <p className="text-xs text-gray-400 mt-2 capitalize">{row.status}</p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        <p className="text-sm text-center text-gray-500">
          <Link to="/profile/student" className="font-medium" style={{ color: '#BB0000' }}>
            Edit profile
          </Link>{' '}
          to add internship experience and choose visibility.
        </p>
      </main>

      {modalPeer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => !sendingIntro && setModalPeer(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900">Intro request</h3>
            <p className="text-sm text-gray-500 mt-1">
              To {modalPeer.display_name} about {modalPeer.company_name}
            </p>
            <textarea
              value={introBody}
              onChange={e => setIntroBody(e.target.value)}
              rows={5}
              placeholder="Say what you’re hoping to learn (interview process, team culture, etc.)."
              className="mt-4 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
            />
            {introError && <p className="text-sm text-red-600 mt-2">{introError}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                className="text-sm text-gray-600 px-3 py-2"
                onClick={() => setModalPeer(null)}
                disabled={sendingIntro}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={sendIntro}
                disabled={sendingIntro}
                className="text-sm font-semibold text-white px-4 py-2 rounded-lg disabled:opacity-50"
                style={{ backgroundColor: '#BB0000' }}
              >
                {sendingIntro ? 'Sending…' : 'Send intro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
