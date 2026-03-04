import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTemplates, addTemplate, updateTemplate, deleteTemplate, setActiveTemplate } from '../services/api';
import { Save, Eye, Plus, CheckCircle, Trash2 } from 'lucide-react';

const Template = () => {
    const queryClient = useQueryClient();
    const [selectedId, setSelectedId] = useState(null);
    const [formData, setFormData] = useState({ name: '', subject: '', body: '' });
    const [preview, setPreview] = useState(false);
    const [message, setMessage] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const { data: templates, isLoading } = useQuery({
        queryKey: ['templates'],
        queryFn: async () => (await getTemplates()).data
    });

    useEffect(() => {
        if (!templates || isCreating) return;

        const currentTemplateExists = templates.find(t => t.id === selectedId);

        if (!selectedId || (!currentTemplateExists && templates.length > 0)) {
            const activeTemplate = templates.find(t => t.is_active) || templates[0];
            if (activeTemplate && activeTemplate.id !== selectedId) {
                setSelectedId(activeTemplate.id);
                setFormData({ name: activeTemplate.name, subject: activeTemplate.subject, body: activeTemplate.body });
            }
        } else if (templates.length === 0 && selectedId !== null) {
            setSelectedId(null);
        }
    }, [templates, selectedId, isCreating]);

    const handleSelectTemplate = (t) => {
        setIsCreating(false);
        setSelectedId(t.id);
        setFormData({ name: t.name, subject: t.subject, body: t.body });
        setMessage('');
    };

    const handleCreateNew = () => {
        setIsCreating(true);
        setSelectedId(null);
        setFormData({ name: 'New Template', subject: '', body: '' });
        setMessage('');
    };

    const saveMutation = useMutation({
        mutationFn: (data) => isCreating ? addTemplate(data) : updateTemplate(selectedId, data),
        onSuccess: (res) => {
            queryClient.invalidateQueries(['templates']);
            setMessage('Template saved successfully!');
            setIsCreating(false);
            if (isCreating) setSelectedId(res.data.id);
            setTimeout(() => setMessage(''), 3000);
        }
    });

    const activeMutation = useMutation({
        mutationFn: setActiveTemplate,
        onSuccess: () => {
            queryClient.invalidateQueries(['templates']);
            setMessage('Template set as Active!');
            setTimeout(() => setMessage(''), 3000);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deleteTemplate,
        onSuccess: () => {
            queryClient.invalidateQueries(['templates']);
            setSelectedId(null);
            setMessage('Template deleted!');
            setTimeout(() => setMessage(''), 3000);
        }
    });

    const handleSave = (e) => {
        e.preventDefault();
        saveMutation.mutate(formData);
    };

    if (isLoading) return <div>Loading templates...</div>;

    const renderPreview = (text) => {
        return (text || '')
            .replace(/\{\{?client_name\}\}?/g, 'John Doe')
            .replace(/\{\{?sender_name\}\}?/g, 'Your Name');
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Email Templates</h2>
                <button
                    onClick={handleCreateNew}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    New Template
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Template List */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden lg:col-span-1 h-fit">
                    <div className="p-4 bg-gray-50 border-b border-gray-100 font-semibold">
                        Your Templates
                    </div>
                    <ul className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                        {templates?.map(t => (
                            <li
                                key={t.id}
                                onClick={() => handleSelectTemplate(t)}
                                className={`p-4 cursor-pointer hover:bg-indigo-50 transition-colors flex justify-between items-center ${selectedId === t.id && !isCreating ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''}`}
                            >
                                <div>
                                    <div className="font-medium text-gray-800">{t.name}</div>
                                    <div className="text-xs text-gray-500 truncate mt-1">{t.subject || 'No subject'}</div>
                                </div>
                                {t.is_active && (
                                    <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full flex items-center">
                                        <CheckCircle className="w-3 h-3 mr-1" /> Active
                                    </span>
                                )}
                            </li>
                        ))}
                        {templates?.length === 0 && !isCreating && (
                            <div className="p-4 text-sm text-gray-500 text-center">No templates found. Create one!</div>
                        )}
                        {isCreating && (
                            <li className="p-4 bg-indigo-50 border-l-4 border-indigo-600 font-medium text-indigo-700">
                                Creating New Template...
                            </li>
                        )}
                    </ul>
                </div>

                {/* Right Column: Editor & Preview */}
                <div className="lg:col-span-2 space-y-6">
                    {(selectedId || isCreating) ? (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold">{isCreating ? 'Create Template' : 'Edit Template'}</h3>
                                <div className="space-x-2 flex">
                                    <button
                                        type="button"
                                        onClick={() => setPreview(!preview)}
                                        className="text-gray-500 hover:text-gray-700 flex items-center text-sm px-3 py-1 border rounded-md"
                                    >
                                        <Eye className="w-4 h-4 mr-1" /> {preview ? 'Hide Preview' : 'Show Preview'}
                                    </button>
                                </div>
                            </div>

                            {message && <div className="bg-green-100 text-green-700 p-2 rounded mb-4 text-sm">{message}</div>}

                            <form onSubmit={handleSave} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Template Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="E.g. Initial Outreach"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Subject</label>
                                    <input
                                        type="text"
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                        value={formData.subject}
                                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                        placeholder="Hello {client_name}"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">Variables you can use: <code>{'{'}client_name{'}'}</code>, <code>{'{'}sender_name{'}'}</code></p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Body (HTML supported)</label>
                                    <textarea
                                        rows={10}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border font-mono text-sm leading-relaxed"
                                        value={formData.body}
                                        onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                                        placeholder={"<p>Dear {client_name},</p>\n\n<p>...</p>\n\n<p>Regards,<br/>{sender_name}</p>"}
                                    />
                                </div>

                                <div className="flex justify-between items-center pt-4 border-t">
                                    <div className="space-x-2 flex">
                                        <button
                                            type="submit"
                                            disabled={saveMutation.isPending}
                                            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center justify-center transition-colors"
                                        >
                                            <Save className="w-4 h-4 mr-2" />
                                            {saveMutation.isPending ? 'Saving...' : 'Save Template'}
                                        </button>

                                        {!isCreating && (
                                            <button
                                                type="button"
                                                onClick={() => activeMutation.mutate(selectedId)}
                                                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center justify-center transition-colors"
                                            >
                                                <CheckCircle className="w-4 h-4 mr-2" />
                                                Set as Active
                                            </button>
                                        )}
                                    </div>

                                    {!isCreating && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (window.confirm('Are you sure you want to delete this template?')) {
                                                    deleteMutation.mutate(selectedId);
                                                }
                                            }}
                                            className="text-red-600 hover:text-red-900 flex items-center text-sm px-3 py-2"
                                        >
                                            <Trash2 className="w-4 h-4 mr-1" /> Delete
                                        </button>
                                    )}
                                </div>
                            </form>
                        </div>
                    ) : (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-center h-48 text-gray-500">
                            Select a template from the left or create a new one.
                        </div>
                    )}

                    {preview && (selectedId || isCreating) && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-semibold mb-4 flex items-center">
                                <Eye className="w-5 h-5 mr-2 text-indigo-600" /> HTML Preview
                            </h3>
                            <div className="space-y-4 border rounded-md p-6 bg-white shadow-inner">
                                <div className="border-b pb-4">
                                    <span className="font-semibold text-gray-500 block text-xs uppercase mb-1">Subject</span>
                                    <div className="text-gray-900 text-lg font-medium">{renderPreview(formData.subject) || 'No Subject'}</div>
                                </div>
                                <div className="pt-2">
                                    <span className="font-semibold text-gray-500 block text-xs uppercase mb-3">Email Body</span>
                                    <div
                                        className="prose prose-sm max-w-none text-gray-800"
                                        dangerouslySetInnerHTML={{ __html: renderPreview(formData.body) || '<span class="text-gray-400 italic">No Body</span>' }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Template;
