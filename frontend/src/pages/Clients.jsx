import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getClients, uploadClients, deleteClient, resetClient } from '../services/api';
import { Upload, Trash2, Filter, RefreshCcw } from 'lucide-react';
import clsx from 'clsx';

const Clients = () => {
    const queryClient = useQueryClient();
    const [file, setFile] = useState(null);
    const [uploadError, setUploadError] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    const { data: clients, isLoading } = useQuery({
        queryKey: ['clients', filterStatus],
        queryFn: async () => (await getClients({ status: filterStatus || undefined })).data
    });

    const uploadMutation = useMutation({
        mutationFn: uploadClients,
        onSuccess: (data) => {
            queryClient.invalidateQueries(['clients']);
            setFile(null);
            alert(data.data.message);
        },
        onError: (err) => setUploadError(err.response?.data?.detail || 'Upload failed')
    });

    const deleteMutation = useMutation({
        mutationFn: deleteClient,
        onSuccess: () => queryClient.invalidateQueries(['clients'])
    });

    const resetMutation = useMutation({
        mutationFn: resetClient,
        onSuccess: () => {
            queryClient.invalidateQueries(['clients']);
            alert("Client reset to pending state successfully.");
        },
        onError: (err) => alert(err.response?.data?.detail || 'Failed to reset client')
    });

    const handleUpload = (e) => {
        e.preventDefault();
        if (!file) {
            setUploadError('Please select a CSV file');
            return;
        }
        const formData = new FormData();
        formData.append('file', file);
        uploadMutation.mutate(formData);
    };

    if (isLoading) return <div>Loading clients...</div>;

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">Manage Clients</h2>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold mb-4">Upload Clients (CSV)</h3>
                <div className="mb-2 text-sm text-gray-500">
                    CSV should have headers: <code className="bg-gray-100 px-1">client_email</code>, <code className="bg-gray-100 px-1">client_name</code>
                </div>
                {uploadError && <div className="text-red-500 mb-4 text-sm">{uploadError}</div>}
                <form onSubmit={handleUpload} className="flex items-end space-x-4">
                    <div className="flex-1">
                        <input
                            type="file"
                            accept=".csv"
                            onChange={(e) => setFile(e.target.files[0])}
                            className="block w-full text-sm text-gray-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-md file:border-0
                                file:text-sm file:font-semibold
                                file:bg-indigo-50 file:text-indigo-700
                                hover:file:bg-indigo-100"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={uploadMutation.isPending || !file}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center justify-center disabled:opacity-50"
                    >
                        <Upload className="w-4 h-4 mr-2" />
                        {uploadMutation.isPending ? 'Uploading...' : 'Upload CSV'}
                    </button>
                </form>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <Filter className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">Filter Status:</span>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-1 border"
                        >
                            <option value="">All</option>
                            <option value="pending">Pending</option>
                            <option value="sent">Sent</option>
                            <option value="failed">Failed</option>
                        </select>
                    </div>
                    <div className="text-sm text-gray-500">
                        Total: {clients?.length}
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attempts</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {clients?.map((client) => (
                                <tr key={client.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{client.name || '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{client.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={clsx(
                                            'px-2 inline-flex text-xs leading-5 font-semibold rounded-full',
                                            client.status === 'sent' && 'bg-green-100 text-green-800',
                                            client.status === 'pending' && 'bg-yellow-100 text-yellow-800',
                                            client.status === 'failed' && 'bg-red-100 text-red-800'
                                        )}>
                                            {client.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{client.retry_count}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 space-x-3">
                                        {(client.status === 'sent' || client.status === 'failed') && (
                                            <button
                                                onClick={() => resetMutation.mutate(client.id)}
                                                className="text-yellow-600 hover:text-yellow-900"
                                                title="Reset to Pending"
                                            >
                                                <RefreshCcw className="w-5 h-5" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => deleteMutation.mutate(client.id)}
                                            className="text-red-600 hover:text-red-900"
                                            title="Delete Client"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {clients?.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">No clients found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Clients;
