import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAccounts, addAccount, updateAccount, deleteAccount } from '../services/api';
import { Trash2, Plus, Edit2, X } from 'lucide-react';

const Accounts = () => {
    const queryClient = useQueryClient();
    const defaultForm = { name: '', email: '', encrypted_app_password: '', daily_limit: 50, delay_min: 30, delay_max: 90 };
    const [formData, setFormData] = useState(defaultForm);
    const [editId, setEditId] = useState(null);
    const [error, setError] = useState('');

    const { data: accounts, isLoading } = useQuery({
        queryKey: ['accounts'],
        queryFn: async () => (await getAccounts()).data
    });

    const addMutation = useMutation({
        mutationFn: addAccount,
        onSuccess: () => {
            queryClient.invalidateQueries(['accounts']);
            setFormData(defaultForm);
            setError('');
        },
        onError: (err) => setError(err.response?.data?.detail || 'Failed to add account')
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => updateAccount(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['accounts']);
            setFormData(defaultForm);
            setEditId(null);
            setError('');
        },
        onError: (err) => setError(err.response?.data?.detail || 'Failed to update account')
    });

    const deleteMutation = useMutation({
        mutationFn: deleteAccount,
        onSuccess: () => queryClient.invalidateQueries(['accounts'])
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.email) {
            setError('Email is required');
            return;
        }
        if (!editId && !formData.encrypted_app_password) {
            setError('App Password is required for new accounts');
            return;
        }
        if (editId) {
            updateMutation.mutate({ id: editId, data: formData });
        } else {
            addMutation.mutate(formData);
        }
    };

    const handleEdit = (acc) => {
        setFormData({
            name: acc.name || '',
            email: acc.email,
            encrypted_app_password: '', // Don't pre-fill password for security/convenience
            daily_limit: acc.daily_limit,
            delay_min: acc.delay_min,
            delay_max: acc.delay_max
        });
        setEditId(acc.id);
        setError('');
    };

    const handleCancel = () => {
        setFormData(defaultForm);
        setEditId(null);
        setError('');
    };

    if (isLoading) return <div>Loading accounts...</div>;

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">Manage Accounts</h2>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">{editId ? 'Edit Account' : 'Add New Account'}</h3>
                    {editId && (
                        <button onClick={handleCancel} className="text-gray-500 hover:text-gray-700">
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
                {error && <div className="text-red-500 mb-4 text-sm">{error}</div>}
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Sender Name (Optional)</label>
                        <input
                            type="text"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border bg-gray-50"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g. Camellia"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Email Address</label>
                        <input
                            type="email"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border bg-gray-50"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="user@gmail.com"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">{editId ? 'New App Pwd (Optional)' : 'App Password'}</label>
                        <input
                            type="password"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border bg-gray-50"
                            value={formData.encrypted_app_password}
                            onChange={(e) => setFormData({ ...formData, encrypted_app_password: e.target.value })}
                            placeholder={editId ? "Leave blank to keep current" : "xxxx xxxx xxxx xxxx"}
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Daily Limit</label>
                        <input
                            type="number"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                            value={formData.daily_limit}
                            onChange={(e) => setFormData({ ...formData, daily_limit: parseInt(e.target.value) })}
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Min Gap (s)</label>
                        <input
                            type="number"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                            value={formData.delay_min}
                            onChange={(e) => setFormData({ ...formData, delay_min: parseInt(e.target.value) })}
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Max Gap (s)</label>
                        <input
                            type="number"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                            value={formData.delay_max}
                            onChange={(e) => setFormData({ ...formData, delay_max: parseInt(e.target.value) })}
                        />
                    </div>
                    <div className="md:col-span-6 flex justify-end gap-2">
                        {editId && (
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200"
                            >
                                Cancel
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={addMutation.isPending || updateMutation.isPending}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center justify-center"
                        >
                            {editId ? <Edit2 className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                            {addMutation.isPending || updateMutation.isPending ? 'Saving...' : (editId ? 'Save Changes' : 'Add Account')}
                        </button>
                    </div>
                </form>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gap (Min-Max)</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Limit</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sent Today</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {accounts?.map((acc) => (
                            <tr key={acc.id} className={editId === acc.id ? "bg-indigo-50" : ""}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    <div className="font-medium">{acc.name || <span className="text-gray-400 italic">No Display Name</span>}</div>
                                    <div className="text-gray-500">{acc.email}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{acc.delay_min}s - {acc.delay_max}s</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{acc.daily_limit}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{acc.sent_today}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 space-x-3">
                                    <button
                                        onClick={() => handleEdit(acc)}
                                        className="text-indigo-600 hover:text-indigo-900"
                                        title="Edit Account"
                                    >
                                        <Edit2 className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => deleteMutation.mutate(acc.id)}
                                        className="text-red-600 hover:text-red-900"
                                        title="Delete Account"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {accounts?.length === 0 && (
                            <tr>
                                <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">No accounts added yet.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Accounts;
