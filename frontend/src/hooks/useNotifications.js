import { useState, useEffect, useRef, useCallback } from 'react';
import { getUnseenCount } from '../services/api';

const POLL_INTERVAL = 30000; // 30 seconds
const NOTIFICATION_SOUND_URL = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkZqTi4J6cW1vdX+LlZqYko2Hg4CBg4eKjI6OjYyKiIaFhISDg4OEhYaHiIiIiIiHh4aGhYWEhISEhIWFhoaHh4eHh4eGhoaGhoaGhoaGhoaGhoaGhoaGh4eHh4eHh4eHh4eHh4eHiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHiIiIiIiIiA==';

const useNotifications = () => {
    const [totalUnseen, setTotalUnseen] = useState(0);
    const [accounts, setAccounts] = useState([]);
    const prevCountRef = useRef(0);
    const audioRef = useRef(null);
    const hasRequestedPermission = useRef(false);

    // Request notification permission on first load
    useEffect(() => {
        if (!hasRequestedPermission.current && 'Notification' in window) {
            hasRequestedPermission.current = true;
            if (Notification.permission === 'default') {
                Notification.requestPermission();
            }
        }
        // Create audio element
        audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
        audioRef.current.volume = 0.3;
    }, []);

    const showNotification = useCallback((newCount, prevCount) => {
        const diff = newCount - prevCount;
        if (diff <= 0) return;

        // Browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('New Email', {
                body: `You have ${diff} new unread email${diff > 1 ? 's' : ''}`,
                icon: '📧',
                tag: 'new-email', // prevents duplicate notifications
            });
        }

        // Play sound
        if (audioRef.current) {
            audioRef.current.play().catch(() => { }); // ignore autoplay errors
        }
    }, []);

    const fetchUnseen = useCallback(async () => {
        try {
            const res = await getUnseenCount();
            const data = res.data;
            const newTotal = data.total_unseen || 0;

            // Show notification if count increased
            if (prevCountRef.current > 0 && newTotal > prevCountRef.current) {
                showNotification(newTotal, prevCountRef.current);
            }

            prevCountRef.current = newTotal;
            setTotalUnseen(newTotal);
            setAccounts(data.accounts || []);
        } catch (err) {
            // Silently fail — notification is not critical
        }
    }, [showNotification]);

    // Poll on interval
    useEffect(() => {
        fetchUnseen(); // initial fetch
        const id = setInterval(fetchUnseen, POLL_INTERVAL);
        return () => clearInterval(id);
    }, [fetchUnseen]);

    return { totalUnseen, accounts, refetchUnseen: fetchUnseen };
};

export default useNotifications;
