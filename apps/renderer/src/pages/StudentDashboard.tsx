import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ipc } from '../lib/ipc.ts';
import type { Student } from '@afe/shared';

interface AnalyticsSummary {
    totalWatchTime: number;
    totalReadTime: number;
    modulesStarted: number;
    modulesCompleted: number;
    quizzesTaken: number;
    averageQuizScore: number;
}

function StudentDashboard() {
    const { studentId } = useParams<{ studentId: string }>();
    const navigate = useNavigate();
    const [student, setStudent] = useState<Student | null>(null);
    const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (studentId) {
            loadDashboard();
        }
    }, [studentId]);

    async function loadDashboard() {
        if (!studentId) return;

        try {
            const [studentData, analyticsData] = await Promise.all([
                ipc.getStudentById(studentId),
                ipc.getAnalyticsSummary(studentId),
            ]);

            setStudent(studentData);
            setAnalytics(analyticsData);
        } catch (error) {
            console.error('Failed to load dashboard:', error);
        } finally {
            setLoading(false);
        }
    }

    function handleViewModules() {
        navigate(`/modules/${studentId}`);
    }

    if (loading) {
        return <div className="loading">Loading...</div>;
    }

    if (!student) {
        return <div className="container"><p>Student not found</p></div>;
    }

    function formatTime(seconds: number) {
        if (seconds < 60) return `${seconds}s`;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    }

    const watchTime = formatTime(Math.round(analytics?.totalWatchTime || 0));
    const readTime = formatTime(Math.round(analytics?.totalReadTime || 0));

    return (
        <div className="container">
            <div className="page-header">
                <div style={{ fontSize: '5rem', marginBottom: 'var(--spacing-sm)' }}>
                    {student.avatar}
                </div>
                <h1>Welcome back, {student.name}!</h1>
                <p style={{ fontSize: '1.125rem', color: 'var(--color-text-light)' }}>
                    Keep up the great work 🌟
                </p>
            </div>

            <div className="accent-bar"></div>

            <h2 style={{ marginBottom: 'var(--spacing-md)' }}>Your Progress</h2>
            <div className="grid grid-5" style={{ marginBottom: 'var(--spacing-xl)' }}>
                <div className="stat-card">
                    <span className="stat-value" style={{ fontSize: '3rem' }}>⏱️</span>
                    <span className="stat-value" style={{ fontSize: '2rem' }}>{watchTime}</span>
                    <span className="stat-label">Time Watched</span>
                </div>

                <div className="stat-card">
                    <span className="stat-value" style={{ fontSize: '3rem' }}>📖</span>
                    <span className="stat-value" style={{ fontSize: '2rem' }}>{readTime}</span>
                    <span className="stat-label">Time Read</span>
                </div>

                <div className="stat-card">
                    <span className="stat-value" style={{ fontSize: '3rem' }}>📚</span>
                    <span className="stat-value" style={{ fontSize: '2rem' }}>{analytics?.modulesStarted || 0}</span>
                    <span className="stat-label">Modules Started</span>
                </div>

                <div className="stat-card">
                    <span className="stat-value" style={{ fontSize: '3rem' }}>✅</span>
                    <span className="stat-value" style={{ fontSize: '2rem' }}>{analytics?.modulesCompleted || 0}</span>
                    <span className="stat-label">Modules Completed</span>
                </div>

                <div className="stat-card">
                    <span className="stat-value" style={{ fontSize: '3rem' }}>🎯</span>
                    <span className="stat-value" style={{ fontSize: '2rem' }}>
                        {analytics?.averageQuizScore ? analytics.averageQuizScore.toFixed(0) : 0}%
                    </span>
                    <span className="stat-label">Avg Quiz Score</span>
                </div>
            </div>

            <div style={{ textAlign: 'center', display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'center' }}>
                <button className="btn btn-primary btn-large" onClick={handleViewModules}>
                    📖 Browse Modules
                </button>
                <button
                    className="btn btn-ai btn-large"
                    onClick={() => navigate(`/ai-tutor/${studentId}`)}
                >
                    🤖 Learn with AI
                </button>
            </div>
        </div>
    );
}

export default StudentDashboard;
