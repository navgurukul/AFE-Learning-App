import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ipc } from '../lib/ipc.ts';
import type { Module } from '@afe/shared';

function ModuleList() {
    const { studentId } = useParams<{ studentId: string }>();
    const navigate = useNavigate();
    const [modules, setModules] = useState<Module[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadModules();
    }, []);

    async function loadModules() {
        try {
            const modulesData = await ipc.getModules();
            setModules(modulesData);
        } catch (error) {
            console.error('Failed to load modules:', error);
        } finally {
            setLoading(false);
        }
    }

    function handleModuleClick(moduleId: string) {
        navigate(`/module/${studentId}/${moduleId}`);
    }

    function handleBackToDashboard() {
        navigate(`/dashboard/${studentId}`);
    }

    if (loading) {
        return <div className="loading">Loading modules...</div>;
    }

    if (modules.length === 0) {
        return (
            <div className="container">
                <div className="page-header">
                    <h1>No Modules Available</h1>
                    <p>Please ensure content is installed in C:\ProgramData\OfflineLearningApp\content\</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <button className="btn btn-secondary" onClick={handleBackToDashboard}>
                        ← Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="container">
            <div className="page-header">
                <h1>📚 Learning Modules</h1>
                <p style={{ fontSize: '1.125rem', color: 'var(--color-text-light)' }}>
                    Choose a module to start learning
                </p>
            </div>

            <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <button className="btn btn-secondary" onClick={handleBackToDashboard}>
                    ← Back to Dashboard
                </button>
            </div>

            <div className="accent-bar"></div>

            <div className="grid grid-2">
                {modules.map((module) => (
                    <div
                        key={module.id}
                        className="module-card"
                        onClick={() => handleModuleClick(module.id)}
                    >
                        <div className="module-title">{module.title}</div>
                        <div className="module-description">{module.description}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                            <span className="tag">{module.lessons.length} Lessons</span>
                            <span className="tag" style={{ backgroundColor: 'var(--color-secondary)' }}>
                                v{module.version}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default ModuleList;
