import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, UserPlus, FileEdit, Send, FileText, Mail, LogOut } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ unseenCount = 0 }) => {
    const location = useLocation();
    const { user, logoutUser } = useAuth();

    const links = [
        { name: 'Dashboard', path: '/', icon: LayoutDashboard },
        { name: 'Inbox', path: '/inbox', icon: Mail },
        { name: 'Accounts', path: '/accounts', icon: UserPlus },
        { name: 'Clients', path: '/clients', icon: Users },
        { name: 'Template', path: '/template', icon: FileEdit },
        { name: 'Send', path: '/send', icon: Send },
        { name: 'Logs', path: '/logs', icon: FileText },
    ];

    return (
        <div className="w-64 bg-white h-screen border-r border-gray-200 flex flex-col">
            <div className="p-6 border-b border-gray-200">
                <h1 className="text-2xl font-bold text-indigo-600">ColdMail</h1>
                {user && <p className="text-sm text-gray-500 mt-1 truncate">{user.email}</p>}
            </div>
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                {links.map((link) => {
                    const Icon = link.icon;
                    const isActive = location.pathname === link.path;
                    const showBadge = link.name === 'Inbox' && unseenCount > 0;
                    return (
                        <Link
                            key={link.path}
                            to={link.path}
                            className={clsx(
                                'flex items-center px-4 py-3 rounded-lg transition-colors',
                                isActive
                                    ? 'bg-indigo-50 text-indigo-700'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            )}
                        >
                            <Icon className="w-5 h-5 mr-3" />
                            <span className="font-medium">{link.name}</span>
                            {showBadge && (
                                <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold bg-red-500 text-white animate-pulse">
                                    {unseenCount > 99 ? '99+' : unseenCount}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </nav>
            <div className="p-4 border-t border-gray-200">
                <button
                    onClick={logoutUser}
                    className="flex w-full items-center px-4 py-3 rounded-lg transition-colors text-red-600 hover:bg-red-50"
                >
                    <LogOut className="w-5 h-5 mr-3" />
                    <span className="font-medium">Logout</span>
                </button>
                <div className="text-xs text-gray-400 text-center mt-4">
                    v1.0.0
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
