import React, { useState, useEffect, useRef } from 'react'
import { Send, MessageSquare, Sparkles, Loader2, Plus, MoreVertical, Pin, Trash2, Edit2, Check, X } from 'lucide-react'
import { useParams } from 'react-router-dom'
import aiService from '../../services/aiService.js'
import { useAuth } from '../../context/AuthContext'
import Spinner from '../common/Spinner'
import MarkdownRenderer from '../common/MarkdownRenderer.jsx'
import toast from 'react-hot-toast'

const ChatInterface = () => {
    const { id: documentId } = useParams()
    const { user } = useAuth()
    
    const [chatSessions, setChatSessions] = useState([])
    const [currentChatId, setCurrentChatId] = useState(null)
    const [history, setHistory] = useState([])
    
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(false)
    const [initialLoading, setInitialLoading] = useState(true)
    const [fetchingChat, setFetchingChat] = useState(false)
    
    // UI State for renaming and menus
    const [menuOpenId, setMenuOpenId] = useState(null)
    const [editingChatId, setEditingChatId] = useState(null)
    const [editTitle, setEditTitle] = useState('')
    
    const messagesEndRef = useRef(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    const fetchChatSessions = async () => {
        try {
            const response = await aiService.getChatHistory(documentId)
            const sessions = response.data || []
            setChatSessions(sessions)
            return sessions
        } catch (error) {
            if (error?.status !== 404) {
                console.error('Error fetching chat sessions:', error)
            }
            return []
        }
    }

    // Initial fetch
    useEffect(() => {
        const init = async () => {
            setInitialLoading(true)
            const sessions = await fetchChatSessions()
            if (sessions.length > 0) {
                setCurrentChatId(sessions[0]._id)
            }
            setInitialLoading(false)
        }
        init()
    }, [documentId])

    // Fetch specific chat history when currentChatId changes
    useEffect(() => {
        const fetchSpecificChat = async () => {
            if (!currentChatId) {
                setHistory([])
                return
            }
            try {
                setFetchingChat(true)
                const response = await aiService.getChatSession(currentChatId)
                setHistory(response.data || [])
            } catch (error) {
                console.error('Error fetching chat session messages:', error)
            } finally {
                setFetchingChat(false)
            }
        }

        fetchSpecificChat()
    }, [currentChatId])

    useEffect(() => {
        scrollToBottom()
    }, [history])

    const handleNewChat = () => {
        setCurrentChatId(null)
        setHistory([])
    }

    const handleSendMessage = async (e) => {
        e.preventDefault()
        if (!message.trim()) return

        const userMessage = {
            role: 'user',
            content: message.trim(),
            timestamp: new Date(),
        }

        setHistory((prev) => [...prev, userMessage])
        setMessage('')
        setLoading(true)

        try {
            const response = await aiService.chat(documentId, userMessage.content, currentChatId)
            const responseData = response.data
            
            const assistantMessage = {
                role: 'assistant',
                content: responseData.answer,
                timestamp: new Date(),
                relativeChunks: responseData.relativeChunks,
            }
            setHistory((prev) => [...prev, assistantMessage])

            // If it was a new chat, update the sessions list and currentChatId
            if (!currentChatId && responseData.chatHistoryId) {
                setCurrentChatId(responseData.chatHistoryId)
                await fetchChatSessions() // Refresh list to get the AI-generated title
            }
        } catch (error) {
            toast.error(error.message || 'Failed to send message')
        } finally {
            setLoading(false)
        }
    }

    const handlePinChat = async (chatId, currentPinStatus) => {
        setMenuOpenId(null)
        try {
            await aiService.updateChatSession(chatId, { pinned: !currentPinStatus })
            await fetchChatSessions()
            toast.success(currentPinStatus ? 'Chat unpinned' : 'Chat pinned')
        } catch (error) {
            toast.error('Failed to update pin status')
        }
    }

    const handleDeleteChat = async (chatId) => {
        setMenuOpenId(null)
        if (!window.confirm("Are you sure you want to delete this chat?")) return

        try {
            await aiService.deleteChatSession(chatId)
            if (currentChatId === chatId) {
                handleNewChat()
            }
            await fetchChatSessions()
            toast.success('Chat deleted')
        } catch (error) {
            toast.error('Failed to delete chat')
        }
    }

    const startEditing = (session) => {
        setMenuOpenId(null)
        setEditingChatId(session._id)
        setEditTitle(session.title)
    }

    const saveEdit = async () => {
        if (!editTitle.trim()) {
            setEditingChatId(null)
            return
        }
        try {
            await aiService.updateChatSession(editingChatId, { title: editTitle.trim() })
            await fetchChatSessions()
            setEditingChatId(null)
        } catch (error) {
            toast.error('Failed to rename chat')
        }
    }

    const renderMessage = (msg, index) => {
        const isUser = msg.role === 'user'

        return (
            <div key={index} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser && (
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center mr-3">
                        <Sparkles className="h-5 w-5 text-slate-600" />
                    </div>
                )}
                <div
                    className={`max-w-lg p-4 rounded-2xl shadow-sm ${isUser ? 'bg-violet-500 text-white' : 'bg-slate-100 text-slate-900'}`}
                >
                    {isUser ? <p>{msg.content}</p> : <MarkdownRenderer content={msg.content} />}
                    {isUser && user?.username && (
                        <div className="mt-3 text-xs font-semibold opacity-80">{user.username}</div>
                    )}
                </div>
            </div>
        )
    }

    if (initialLoading) {
        return (
            <div className="flex flex-col w-full h-[70vh] max-h-[70vh] bg-white/70 rounded-lg border border-slate-200 overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 flex items-center justify-center text-slate-500">
                    <div className="flex items-center gap-3">
                        <MessageSquare strokeWidth={2} />
                        <span>Loading chat interface...</span>
                    </div>
                </div>
                <div className="p-4 border-t border-slate-200 flex justify-center">
                    <Spinner />
                </div>
            </div>
        )
    }

    return (
        <div className="flex w-full h-[70vh] max-h-[70vh] bg-white/70 rounded-lg border border-slate-200 shadow-sm overflow-hidden" onClick={() => setMenuOpenId(null)}>
            
            {/* Sidebar for chat sessions */}
            <div className="w-1/3 md:w-1/4 min-w-[220px] border-r border-slate-200/60 bg-slate-50/50 flex flex-col">
                <div className="p-4 border-b border-slate-200/60">
                    <button
                        onClick={handleNewChat}
                        className="w-full flex items-center justify-center gap-2 rounded-lg bg-violet-100 text-violet-700 px-4 py-2 text-sm font-semibold hover:bg-violet-200 transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        New Chat
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {chatSessions.length === 0 ? (
                        <div className="text-center text-slate-400 text-xs mt-4">
                            No saved chats yet
                        </div>
                    ) : (
                        chatSessions.map((session) => (
                            <div key={session._id} className="relative group flex items-center">
                                {editingChatId === session._id ? (
                                    <div className="flex-1 flex items-center gap-1 p-1">
                                        <input
                                            type="text"
                                            value={editTitle}
                                            onChange={(e) => setEditTitle(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                                            className="flex-1 w-full text-sm px-2 py-1 border border-violet-300 rounded focus:outline-none focus:ring-1 focus:ring-violet-500"
                                            autoFocus
                                        />
                                        <button onClick={saveEdit} className="p-1 text-violet-600 hover:bg-violet-100 rounded">
                                            <Check className="h-4 w-4" />
                                        </button>
                                        <button onClick={() => setEditingChatId(null)} className="p-1 text-slate-400 hover:bg-slate-200 rounded">
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => setCurrentChatId(session._id)}
                                            className={`flex-1 text-left px-3 py-2 pr-8 rounded-lg text-sm flex items-center gap-2 truncate transition-colors ${
                                                currentChatId === session._id 
                                                    ? 'bg-slate-200 text-slate-900 font-medium' 
                                                    : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
                                            }`}
                                        >
                                            {session.pinned ? (
                                                <Pin className="h-3.5 w-3.5 flex-shrink-0 text-violet-600 fill-violet-600" />
                                            ) : (
                                                <MessageSquare className="h-4 w-4 flex-shrink-0 opacity-70" />
                                            )}
                                            <span className="truncate">{session.title}</span>
                                        </button>
                                        
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setMenuOpenId(menuOpenId === session._id ? null : session._id)
                                            }}
                                            className="absolute right-1 p-1.5 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-slate-700 hover:bg-slate-300/50 rounded-md transition-all"
                                        >
                                            <MoreVertical className="h-4 w-4" />
                                        </button>

                                        {menuOpenId === session._id && (
                                            <div 
                                                className="absolute right-2 top-8 z-10 w-32 bg-white rounded-lg shadow-lg border border-slate-200 py-1"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <button 
                                                    onClick={() => startEditing(session)}
                                                    className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                                                >
                                                    <Edit2 className="h-3.5 w-3.5" /> Rename
                                                </button>
                                                <button 
                                                    onClick={() => handlePinChat(session._id, session.pinned)}
                                                    className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                                                >
                                                    <Pin className="h-3.5 w-3.5" /> {session.pinned ? 'Unpin' : 'Pin'}
                                                </button>
                                                <div className="h-px bg-slate-200 my-1"></div>
                                                <button 
                                                    onClick={() => handleDeleteChat(session._id)}
                                                    className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" /> Delete
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Messages area */}
                <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
                    {fetchingChat ? (
                        <div className="flex h-full items-center justify-center">
                            <Spinner />
                        </div>
                    ) : history.length === 0 ? (
                        <div className="text-center text-slate-500 mt-10">
                            <Sparkles className="mx-auto mb-4 h-8 w-8 text-violet-500 opacity-50" />
                            <p className="font-medium text-slate-700 mb-1">Start a new conversation</p>
                            <p className="text-sm">Ask me anything about this document, or general questions!</p>
                        </div>
                    ) : (
                        history.map(renderMessage)
                    )}
                    <div ref={messagesEndRef} />
                    {loading && (
                        <div className="flex items-center justify-center p-4 text-slate-500 gap-3">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Thinking...</span>
                        </div>
                    )}
                </div>

                {/* Input area */}
                <form
                    onSubmit={handleSendMessage}
                    className="p-4 border-t border-slate-200/60 bg-white/80 flex items-center gap-3"
                >
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Type your message..."
                        disabled={loading || fetchingChat}
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-60"
                    />
                    <button
                        type="submit"
                        disabled={loading || fetchingChat || !message.trim()}
                        className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-violet-600 text-white shadow hover:bg-violet-700 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    </button>
                </form>
            </div>
        </div>
    )
}

export default ChatInterface