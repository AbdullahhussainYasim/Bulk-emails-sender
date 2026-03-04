import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStatus, startSending, stopSending, getStats } from '../services/api';
import { Play, Square, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

const Send = () => {
    const queryClient = useQueryClient();
    const [actionMessage, setActionMessage] = useState('');

    const { data: statusData, isLoading: isLoadingStatus } = useQuery({
        queryKey: ['status'],
        queryFn: async () => (await getStatus()).data,
        refetchInterval: 2000
    });

    const { data: stats, isLoading: isLoadingStats } = useQuery({
        queryKey: ['stats'],
        queryFn: async () => (await getStats()).data,
        refetchInterval: 5000
    });

    const startMutation = useMutation({
        mutationFn: startSending,
        onSuccess: (data) => {
            queryClient.invalidateQueries(['status']);
            setActionMessage(data.data.message);
            setTimeout(() => setActionMessage(''), 3000);
        }
    });

    const stopMutation = useMutation({
        mutationFn: stopSending,
        onSuccess: (data) => {
            queryClient.invalidateQueries(['status']);
            setActionMessage(data.data.message);
            setTimeout(() => setActionMessage(''), 3000);
        }
    });

    const isRunning = statusData?.status === 'Running';

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">Control Center</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Control Panel */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold mb-4">Actions</h3>
                    <div className="flex items-center space-x-4 mb-4">
                        <div className={clsx(
                            "px-3 py-1 rounded-full text-sm font-medium flex items-center",
                            isRunning ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                        )}>
                            Status: {statusData?.status || 'Unknown'}
                            {isRunning && <RefreshCw className="w-3 h-3 ml-2 animate-spin" />}
                        </div>
                    </div>

                    {actionMessage && <div className="mb-4 text-sm text-blue-600 bg-blue-50 p-2 rounded">{actionMessage}</div>}

                    <div className="flex space-x-4">
                        <button
                            onClick={() => startMutation.mutate()}
                            disabled={isRunning || startMutation.isPending}
                            className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center font-medium"
                        >
                            <Play className="w-5 h-5 mr-2" />
                            Start Sending
                        </button>
                        <button
                            onClick={() => stopMutation.mutate()}
                            disabled={!isRunning || stopMutation.isPending}
                            className="flex-1 bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center font-medium"
                        >
                            <Square className="w-5 h-5 mr-2" />
                            Stop Sending
                        </button>
                    </div>
                    <p className="mt-4 text-sm text-gray-500">
                        {isRunning
                            ? "System is currently processing the queue. Emails are being sent securely via your configured accounts."
                            : "System is idle. Click Start to begin sending emails to pending clients."}
                    </p>
                </div>

                {/* Live Stats */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold mb-4">Live Session Stats</h3>
                    {isLoadingStats ? (
                        <div>Loading stats...</div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center border-b pb-2">
                                <span className="text-gray-600">Pending Clients</span>
                                <span className="font-bold text-lg">{stats?.pending}</span>
                            </div>
                            <div className="flex justify-between items-center border-b pb-2">
                                <span className="text-gray-600">Sent Today</span>
                                <span className="font-bold text-green-600 text-lg">{stats?.sent_today}</span>
                            </div>
                            <div className="flex justify-between items-center border-b pb-2">
                                <span className="text-gray-600">Failed</span>
                                <span className="font-bold text-red-600 text-lg">{stats?.failed}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-gray-600">Active Accounts</span>
                                <span className="font-bold text-lg">{stats?.accounts?.filter(a => a.remaining > 0).length} / {stats?.total_accounts}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Simple Active Account Indicator (derived from stats) */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold mb-4">Account Utilization</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {stats?.accounts.map(acc => (
                        <div key={acc.email} className={clsx(
                            "p-3 rounded-lg border",
                            acc.sent_today >= acc.daily_limit ? "bg-red-50 border-red-100" : "bg-gray-50 border-gray-200"
                        )}>
                            <div className="text-sm font-medium truncate" title={acc.email}>{acc.email}</div>
                            <div className="flex justify-between text-xs mt-2 text-gray-500">
                                <span>{acc.sent_today} / {acc.daily_limit}</span>
                                <span>{acc.remaining} left</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                                <div
                                    className={clsx("h-1.5 rounded-full", acc.sent_today >= acc.daily_limit ? "bg-red-500" : "bg-green-500")}
                                    style={{ width: `${(acc.sent_today / acc.daily_limit) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Send;
