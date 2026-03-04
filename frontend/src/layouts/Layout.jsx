import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import useNotifications from '../hooks/useNotifications';

const Layout = () => {
    const { totalUnseen } = useNotifications();

    return (
        <div className="flex h-screen overflow-hidden bg-gray-50">
            <Sidebar unseenCount={totalUnseen} />
            <div className="flex-1 flex flex-col overflow-hidden">
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default Layout;
