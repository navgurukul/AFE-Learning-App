import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ipc } from '../lib/ipc.ts';
import type { Student } from '@afe/shared';

interface AnalyticsSummary {
    totalWatchTime: number;
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

    const watchTimeMinutes = Math.floor((analytics?.totalWatchTime || 0) / 60);

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
            <div className="grid grid-4" style={{ marginBottom: 'var(--spacing-xl)' }}>
                <div className="stat-card">
                    <span className="stat-value">⏱️</span>
                    <span className="stat-value" style={{ fontSize: '2rem' }}>{watchTimeMinutes}</span>
                    <span className="stat-label">Minutes Watched</span>
                </div>

                <div className="stat-card">
                    <span className="stat-value">📚</span>
                    <span className="stat-value" style={{ fontSize: '2rem' }}>{analytics?.modulesStarted || 0}</span>
                    <span className="stat-label">Modules Started</span>
                </div>

                <div className="stat-card">
                    <span className="stat-value">✅</span>
                    <span className="stat-value" style={{ fontSize: '2rem' }}>{analytics?.modulesCompleted || 0}</span>
                    <span className="stat-label">Modules Completed</span>
                </div>

                <div className="stat-card">
                    <span className="stat-value">🎯</span>
                    <span className="stat-value" style={{ fontSize: '2rem' }}>
                        {analytics?.averageQuizScore.toFixed(0) || 0}%
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
