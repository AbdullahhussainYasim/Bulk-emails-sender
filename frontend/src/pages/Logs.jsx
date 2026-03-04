import { useQuery } from '@tanstack/react-query';
import { getLogs } from '../services/api';
import clsx from 'clsx';

const Logs = () => {
    const { data: logs, isLoading } = useQuery({
        queryKey: ['logs'],
        queryFn: async () => (await getLogs()).data,
        refetchInterval: 5000 // Poll logs
    });

    if (isLoading) return <div>Loading logs...</div>;

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">Email Logs</h2>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Error Message</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account ID</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {logs?.map((log) => (
                            <tr key={log.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {new Date(log.timestamp).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <span className={clsx(
                                        'px-2 inline-flex text-xs leading-5 font-semibold rounded-full',
                                        log.status === 'sent' && 'bg-green-100 text-green-800',
                                        log.status === 'failed' && 'bg-red-100 text-red-800'
                                    )}>
                                        {log.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={log.error_message}>
                                    {log.error_message || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.client_id}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.account_id}</td>
                            </tr>
                        ))}
                        {logs?.length === 0 && (
                            <tr>
                                <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">No logs found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Logs;
