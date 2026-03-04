import React, { useState, useRef, useCallback } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { getAccounts, getInbox, getThread, replyToEmail } from '../services/api';
import {
    Mail, RefreshCw, ChevronLeft, ChevronRight, X, Loader2,
    MessageSquare, ChevronDown, ChevronUp, Reply, ReplyAll,
    Send, Bold, Italic, List, Link, CheckCircle, AlertCircle
} from 'lucide-react';

const Inbox = () => {
    const queryClient = useQueryClient();
    const [selectedAccount, setSelectedAccount] = useState('');
    const [page, setPage] = useState(1);
    const limit = 125;
    const [selectedThreadId, setSelectedThreadId] = useState(null);
    const [selectedThreadMeta, setSelectedThreadMeta] = useState(null);
    const [expandedMessages, setExpandedMessages] = useState({});

    // Reply state
    const [replyingTo, setReplyingTo] = useState(null); // message being replied to
    const [isReplyAll, setIsReplyAll] = useState(false);
    const [replySending, setReplySending] = useState(false);
    const [replyStatus, setReplyStatus] = useState(null); // 'success' | 'error' | null
    const editorRef = useRef(null);

    const { data: accountsData, isLoading: accountsLoading } = useQuery({
        queryKey: ['accounts'],
        queryFn: async () => {
            const res = await getAccounts();
            if (res.data && res.data.length > 0 && !selectedAccount) {
                setSelectedAccount(res.data[0].id.toString());
            }
            return res.data;
        }
    });

    const { data: inboxData, isLoading: inboxLoading, isFetching: inboxFetching, isError, error, refetch } = useQuery({
        queryKey: ['inbox', selectedAccount, page],
        queryFn: async () => {
            if (!selectedAccount) return null;
            const res = await getInbox(selectedAccount, page, limit);
            return res.data;
        },
        enabled: !!selectedAccount,
        retry: false,
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        placeholderData: keepPreviousData
    });

    const { data: threadDetail, isLoading: threadLoading } = useQuery({
        queryKey: ['thread', selectedAccount, selectedThreadId],
        queryFn: async () => {
            const res = await getThread(selectedAccount, selectedThreadId);
            return res.data;
        },
        enabled: !!selectedThreadId && !!selectedAccount,
        staleTime: 10 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
    });

    const handleAccountChange = (e) => {
        setSelectedAccount(e.target.value);
        setPage(1);
    };

    const handleNextPage = () => {
        if (inboxData && page < inboxData.total_pages) setPage(prev => prev + 1);
    };

    const handlePrevPage = () => {
        if (page > 1) setPage(prev => prev - 1);
    };

    const handleThreadClick = (thread) => {
        setSelectedThreadMeta(thread);
        setSelectedThreadId(thread.thread_id);
        setExpandedMessages({});
        setReplyingTo(null);
        setReplyStatus(null);

        // Optimistically mark as read in the inbox cache
        if (!thread.is_read) {
            queryClient.setQueryData(['inbox', selectedAccount, page], (old) => {
                if (!old) return old;
                return {
                    ...old,
                    threads: old.threads.map(t =>
                        t.thread_id === thread.thread_id ? { ...t, is_read: true } : t
                    )
                };
            });
        }
    };

    const handleCloseModal = () => {
        setSelectedThreadId(null);
        setSelectedThreadMeta(null);
        setExpandedMessages({});
        setReplyingTo(null);
        setReplyStatus(null);
    };

    const toggleMessage = (msgId) => {
        setExpandedMessages(prev => ({ ...prev, [msgId]: !prev[msgId] }));
    };

    // Extract email address from "Name <email@domain.com>" format
    const extractEmail = (fromStr) => {
        if (!fromStr) return '';
        const match = fromStr.match(/<([^>]+)>/);
        return match ? match[1] : fromStr;
    };

    const extractName = (fromStr) => {
        if (!fromStr) return '';
        const match = fromStr.match(/^"?([^"<]+)"?\s*</);
        return match ? match[1].trim() : fromStr;
    };

    const handleReply = (msg, replyAll = false) => {
        setReplyingTo(msg);
        setIsReplyAll(replyAll);
        setReplyStatus(null);
        // Focus editor after it renders
        setTimeout(() => {
            if (editorRef.current) {
                editorRef.current.focus();
            }
        }, 100);
    };

    const handleCancelReply = () => {
        setReplyingTo(null);
        setIsReplyAll(false);
        setReplyStatus(null);
    };

    const execCommand = (command, value = null) => {
        document.execCommand(command, false, value);
        if (editorRef.current) editorRef.current.focus();
    };

    const handleInsertLink = () => {
        const url = prompt('Enter URL:');
        if (url) execCommand('createLink', url);
    };

    const handleSendReply = async () => {
        if (!editorRef.current || !replyingTo) return;

        const replyBody = editorRef.current.innerHTML;
        if (!replyBody || replyBody === '<br>' || replyBody === '<div><br></div>') {
            alert('Please type a reply before sending.');
            return;
        }

        // Find the current account email
        const currentAccount = accountsData?.find(a => a.id.toString() === selectedAccount);
        const currentEmail = currentAccount?.email || '';

        // Build the To field
        const originalSenderEmail = extractEmail(replyingTo.from);
        let toField = originalSenderEmail;
        let ccField = '';

        if (isReplyAll) {
            // Gather all recipients except the current account
            const allRecipients = new Set();
            allRecipients.add(originalSenderEmail);

            // Add original To recipients
            if (replyingTo.to) {
                replyingTo.to.split(',').forEach(r => {
                    const email = extractEmail(r.trim());
                    if (email && email !== currentEmail) allRecipients.add(email);
                });
            }
            // Original Cc
            if (replyingTo.cc) {
                replyingTo.cc.split(',').forEach(r => {
                    const email = extractEmail(r.trim());
                    if (email && email !== currentEmail) allRecipients.add(email);
                });
            }
            toField = [...allRecipients].join(', ');
        }

        // Build subject
        let subject = replyingTo.subject || '';
        if (!subject.toLowerCase().startsWith('re:')) {
            subject = `Re: ${subject}`;
        }

        // Build References header (chain of Message-IDs)
        let references = replyingTo.references || '';
        if (replyingTo.message_id) {
            references = references ? `${references} ${replyingTo.message_id}` : replyingTo.message_id;
        }

        // Build quoted original
        const originalDate = replyingTo.date ? new Date(replyingTo.date).toLocaleString() : '';
        const quotedHtml = `
            <br><br>
            <div style="border-left: 2px solid #ccc; padding-left: 12px; margin-left: 0; color: #555;">
                <p style="margin: 0 0 8px 0; color: #888;">On ${originalDate}, ${replyingTo.from} wrote:</p>
                <blockquote style="margin: 0;">${replyingTo.body || '(original message)'}</blockquote>
            </div>
        `;

        const fullBody = replyBody + quotedHtml;

        setReplySending(true);
        setReplyStatus(null);

        try {
            await replyToEmail(selectedAccount, {
                to: toField,
                subject: subject,
                body: fullBody,
                in_reply_to: replyingTo.message_id || '',
                references: references,
                cc: ccField || undefined,
            });

            setReplyStatus('success');
            setReplyingTo(null);

            // Optimistically add the sent reply to the thread view immediately
            const currentAccount = accountsData?.find(a => a.id.toString() === selectedAccount);
            queryClient.setQueryData(['thread', selectedAccount, selectedThreadId], (old) => {
                if (!old) return old;
                const optimisticMsg = {
                    id: `sent-${Date.now()}`,
                    subject: subject,
                    from: currentAccount?.email || 'You',
                    date: new Date().toUTCString(),
                    body: fullBody,
                    message_id: '',
                    to: toField,
                    cc: ccField || '',
                    references: references,
                    folder: 'sent',
                };
                return {
                    ...old,
                    messages: [...old.messages, optimisticMsg],
                    message_count: old.message_count + 1
                };
            });

            // Also refresh from server after a short delay (IMAP sync)
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ['thread', selectedAccount, selectedThreadId] });
                queryClient.invalidateQueries({ queryKey: ['inbox', selectedAccount] });
            }, 3000);

            // Clear success after 3 seconds
            setTimeout(() => setReplyStatus(null), 3000);
        } catch (err) {
            console.error('Reply failed:', err);
            setReplyStatus('error');
        } finally {
            setReplySending(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-theme('spacing.12'))] bg-gray-50">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                    <Mail className="mr-2 h-6 w-6 text-indigo-600" />
                    Inbox
                </h2>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    {accountsLoading ? (
                        <div className="text-sm text-gray-500">Loading accounts...</div>
                    ) : (
                        <select
                            value={selectedAccount}
                            onChange={handleAccountChange}
                            className="block w-full sm:w-64 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md border"
                        >
                            {accountsData?.length === 0 && <option value="">No Accounts</option>}
                            {accountsData?.map(account => (
                                <option key={account.id} value={account.id}>{account.email}</option>
                            ))}
                        </select>
                    )}
                    <button
                        onClick={() => window.location.reload()}
                        disabled={!selectedAccount || inboxLoading}
                        className="inline-flex items-center p-2 border border-transparent rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                        title="Hard Refresh"
                    >
                        <RefreshCw className={`h-5 w-5 ${inboxLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col flex-1 overflow-hidden min-h-0 relative">
                {isError && (
                    <div className="p-4 bg-red-50 border-b border-red-100 text-red-700">
                        Error: {error?.response?.data?.detail || error.message}
                    </div>
                )}

                {!selectedAccount && !accountsLoading && (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500">
                        <Mail className="h-12 w-12 text-gray-300 mb-3" />
                        <p className="text-lg font-medium text-gray-900">No account selected</p>
                        <p className="mt-1">Please select an account or add one in the Accounts tab.</p>
                    </div>
                )}

                {inboxLoading && selectedAccount && (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-gray-500">
                        <RefreshCw className="h-8 w-8 animate-spin text-indigo-500 mb-2" />
                        <p>Loading conversations...</p>
                    </div>
                )}

                {/* Thread List */}
                {!inboxLoading && inboxData && inboxData.threads && inboxData.threads.length > 0 && (
                    <div className={`flex-1 overflow-y-auto min-h-0 ${inboxFetching ? 'opacity-60' : ''}`}>
                        <ul className="divide-y divide-gray-200">
                            {inboxData.threads.map((thread) => (
                                <li key={thread.thread_id} onClick={() => handleThreadClick(thread)} className={`hover:bg-gray-50 cursor-pointer transition-colors ${!thread.is_read ? 'bg-blue-50/40' : ''}`}>
                                    <div className="px-4 py-4 sm:px-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                {!thread.is_read && (
                                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" title="Unread"></span>
                                                )}
                                                <p className={`text-sm truncate ${!thread.is_read ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                                                    {thread.participants?.join(', ') || thread.latest_from}
                                                </p>
                                                {thread.message_count > 1 && (
                                                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 flex-shrink-0">
                                                        {thread.message_count}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="ml-2 flex-shrink-0">
                                                <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                                    {new Date(thread.latest_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                </p>
                                            </div>
                                        </div>
                                        <div className={`mt-1 ${!thread.is_read ? 'ml-[18px]' : ''}`}>
                                            <p className={`flex items-center text-sm truncate ${!thread.is_read ? 'font-semibold text-gray-800' : 'font-medium text-gray-500'}`}>
                                                {thread.message_count > 1 && <MessageSquare className="h-3.5 w-3.5 mr-1.5 text-gray-400 flex-shrink-0" />}
                                                {thread.subject}
                                            </p>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {!inboxLoading && inboxData && inboxData.threads && inboxData.threads.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500">
                        <Mail className="h-12 w-12 text-gray-300 mb-3" />
                        <p className="text-lg font-medium text-gray-900">Inbox is empty</p>
                    </div>
                )}

                {/* Pagination */}
                {!inboxLoading && inboxData && (
                    <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 sm:px-6 flex items-center justify-between z-10">
                        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                            <p className="text-sm text-gray-700">
                                Page <span className="font-medium">{inboxData.page}</span> of{' '}
                                <span className="font-medium">{inboxData.total_pages}</span>
                                {' '}({inboxData.total_emails || inboxData.total_threads} total emails)
                                {inboxFetching && <span className="ml-2 text-indigo-500">Loading...</span>}
                            </p>
                            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                                <button onClick={handlePrevPage} disabled={page === 1} className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">
                                    <ChevronLeft className="h-5 w-5" />
                                </button>
                                <button onClick={handleNextPage} disabled={page >= inboxData.total_pages} className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">
                                    <ChevronRight className="h-5 w-5" />
                                </button>
                            </nav>
                        </div>
                    </div>
                )}
            </div>

            {/* Thread Modal */}
            {selectedThreadId && (
                <div className="fixed inset-0 z-[9999]" role="dialog" aria-modal="true">
                    <div className="fixed inset-0 bg-black bg-opacity-50" onClick={handleCloseModal}></div>
                    <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
                        <div className="bg-white rounded-lg shadow-2xl flex flex-col pointer-events-auto relative" style={{ width: '95vw', height: '95vh' }}>

                            {/* Close */}
                            <div className="absolute top-3 right-3 z-10">
                                <button className="bg-white rounded-full p-1 text-gray-400 hover:text-gray-600 shadow-sm border border-gray-200" onClick={handleCloseModal}>
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Header */}
                            <div className="border-b border-gray-200 px-6 py-4 flex-shrink-0">
                                <h3 className="text-lg font-bold text-gray-900 pr-8 break-words">
                                    {selectedThreadMeta?.subject || 'Loading...'}
                                </h3>
                                <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                                    {selectedThreadMeta?.participants && <span>{selectedThreadMeta.participants.join(', ')}</span>}
                                    {selectedThreadMeta?.message_count > 1 && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                                            {selectedThreadMeta.message_count} messages
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Reply Status Toast */}
                            {replyStatus === 'success' && (
                                <div className="mx-6 mt-3 flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                                    <CheckCircle className="h-4 w-4" /> Reply sent successfully!
                                </div>
                            )}
                            {replyStatus === 'error' && (
                                <div className="mx-6 mt-3 flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                    <AlertCircle className="h-4 w-4" /> Failed to send reply. Please try again.
                                </div>
                            )}

                            {/* Thread Messages */}
                            <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
                                {threadLoading ? (
                                    <div className="flex items-center justify-center py-16">
                                        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                                        <span className="ml-3 text-gray-500">Loading conversation...</span>
                                    </div>
                                ) : threadDetail && threadDetail.messages ? (
                                    <div className="space-y-3">
                                        {threadDetail.messages.map((msg, index) => {
                                            const isLatest = index === threadDetail.messages.length - 1;
                                            const isExpanded = expandedMessages[msg.id] !== undefined ? expandedMessages[msg.id] : isLatest;
                                            const currentAccount = accountsData?.find(a => a.id.toString() === selectedAccount);
                                            const fromContainsUserEmail = currentAccount && msg.from.toLowerCase().includes(currentAccount.email.toLowerCase());
                                            const isSent = msg.folder === 'sent' || fromContainsUserEmail;
                                            const senderName = isSent ? 'You' : extractName(msg.from);
                                            const isReplyTarget = replyingTo?.id === msg.id;

                                            return (
                                                <div key={msg.id} className={`border rounded-lg overflow-hidden ${isSent ? 'border-green-200' : 'border-gray-200'}`}>
                                                    {/* Message Header */}
                                                    <div
                                                        className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${isSent ? 'bg-green-50 hover:bg-green-100' : 'bg-gray-50 hover:bg-gray-100'}`}
                                                        onClick={() => toggleMessage(msg.id)}
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${isSent ? 'bg-green-500 text-white' : 'bg-indigo-500 text-white'}`}>
                                                                {senderName.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-semibold text-gray-900 truncate">
                                                                    {senderName}
                                                                    {isSent && <span className="ml-1.5 text-xs font-normal text-green-600">(sent)</span>}
                                                                </p>
                                                                <p className="text-xs text-gray-500">{msg.date ? new Date(msg.date).toLocaleString() : ''}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                                            {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                                                        </div>
                                                    </div>

                                                    {/* Message Body */}
                                                    {isExpanded && (
                                                        <>
                                                            <div className="border-t border-gray-200">
                                                                <iframe
                                                                    srcDoc={msg.body}
                                                                    sandbox="allow-same-origin"
                                                                    title={`Message from ${senderName}`}
                                                                    style={{ width: '100%', minHeight: '200px', height: '400px', border: 'none', display: 'block' }}
                                                                />
                                                            </div>

                                                            {/* Reply Buttons */}
                                                            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-t border-gray-200">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleReply(msg, false); }}
                                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:border-indigo-300 transition-colors"
                                                                >
                                                                    <Reply className="h-3.5 w-3.5" /> Reply
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleReply(msg, true); }}
                                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:border-indigo-300 transition-colors"
                                                                >
                                                                    <ReplyAll className="h-3.5 w-3.5" /> Reply All
                                                                </button>
                                                            </div>

                                                            {/* Inline Reply Compose Area */}
                                                            {isReplyTarget && (
                                                                <div className="border-t-2 border-indigo-300 bg-white px-4 py-4">
                                                                    <div className="mb-2 text-xs text-gray-500">
                                                                        {isReplyAll ? 'Reply All' : 'Reply'} to: <span className="font-medium text-gray-700">{extractEmail(msg.from)}</span>
                                                                        {isReplyAll && msg.to && (
                                                                            <span className="ml-1 text-gray-400">
                                                                                + {msg.to.split(',').filter(r => extractEmail(r) !== accountsData?.find(a => a.id.toString() === selectedAccount)?.email).length} others
                                                                            </span>
                                                                        )}
                                                                    </div>

                                                                    {/* Formatting Toolbar */}
                                                                    <div className="flex items-center gap-1 mb-2 p-1 bg-gray-50 rounded-md border border-gray-200">
                                                                        <button onClick={() => execCommand('bold')} className="p-1.5 rounded hover:bg-gray-200 text-gray-600" title="Bold">
                                                                            <Bold className="h-4 w-4" />
                                                                        </button>
                                                                        <button onClick={() => execCommand('italic')} className="p-1.5 rounded hover:bg-gray-200 text-gray-600" title="Italic">
                                                                            <Italic className="h-4 w-4" />
                                                                        </button>
                                                                        <button onClick={() => execCommand('insertUnorderedList')} className="p-1.5 rounded hover:bg-gray-200 text-gray-600" title="Bullet List">
                                                                            <List className="h-4 w-4" />
                                                                        </button>
                                                                        <button onClick={handleInsertLink} className="p-1.5 rounded hover:bg-gray-200 text-gray-600" title="Insert Link">
                                                                            <Link className="h-4 w-4" />
                                                                        </button>
                                                                    </div>

                                                                    {/* Editor */}
                                                                    <div
                                                                        ref={editorRef}
                                                                        contentEditable
                                                                        className="min-h-[120px] max-h-[250px] overflow-y-auto p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-gray-800 bg-white"
                                                                        style={{ lineHeight: '1.6' }}
                                                                        data-placeholder="Type your reply..."
                                                                        suppressContentEditableWarning={true}
                                                                    ></div>

                                                                    {/* Send / Cancel */}
                                                                    <div className="flex items-center justify-between mt-3">
                                                                        <button
                                                                            onClick={handleCancelReply}
                                                                            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                        <button
                                                                            onClick={handleSendReply}
                                                                            disabled={replySending}
                                                                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                                                                        >
                                                                            {replySending ? (
                                                                                <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
                                                                            ) : (
                                                                                <><Send className="h-4 w-4" /> Send Reply</>
                                                                            )}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center text-gray-400 py-16">
                                        Failed to load conversation.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inbox;
