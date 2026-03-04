import { useQuery } from '@tanstack/react-query';
import { getStats } from '../services/api';
import { Users, Send, AlertCircle, CheckCircle, Mail } from 'lucide-react';

const Dashboard = () => {
    const { data: stats, isLoading, error } = useQuery({
        queryKey: ['stats'],
        queryFn: async () => {
            const res = await getStats();
            return res.data;
        }
    });

    if (isLoading) return <div className="p-4">Loading stats...</div>;
    if (error) return <div className="p-4 text-red-500">Error loading stats</div>;

    const cards = [
        { label: 'Total Clients', value: stats.total_clients, icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
        { label: 'Pending', value: stats.pending, icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-100' },
        { label: 'Sent Today', value: stats.sent_today, icon: Send, color: 'text-green-600', bg: 'bg-green-100' },
        { label: 'Failed', value: stats.failed, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100' },
    ];

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {cards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <div key={card.label} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
                            <div className={`p-4 rounded-full ${card.bg} mr-4`}>
                                <Icon className={`w-6 h-6 ${card.color}`} />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 font-medium">{card.label}</p>
                                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Account Usage Today</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Limit</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sent</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remaining</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usage</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {stats.accounts.map((acc) => (
                                <tr key={acc.email}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{acc.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{acc.daily_limit}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{acc.sent_today}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{acc.remaining}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <div className="w-full bg-gray-200 rounded-full h-2.5 max-w-[100px]">
                                            <div
                                                className="bg-indigo-600 h-2.5 rounded-full"
                                                style={{ width: `${(acc.sent_today / acc.daily_limit) * 100}%` }}
                                            ></div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
