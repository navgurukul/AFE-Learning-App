import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ipc } from '../lib/ipc.js';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure worker locally for offline support
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.wrapper.mjs';

interface PDFViewerProps {
    src: string;
    lessonId: string;
    studentId: string;
    initialProgress?: {
        watchedPercentage: number;
        totalWatchDuration: number; // Used as current page (floored)
        lastWatchedAt: string;
    };
    onCompleted?: () => void;
}

export default function PDFViewer({ src, lessonId, studentId, initialProgress, onCompleted }: PDFViewerProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [maxPageReached, setMaxPageReached] = useState<number>(1);

    useEffect(() => {
        // Restore progress
        if (initialProgress) {
            // we use 'totalWatchDuration' to store the last page number in the 'video_progress' table hack
            // or we can use watchedPercentage to derive it if accurate.
            // Let's assume we store page number in 'totalWatchDuration' for reading types.
            const savedPage = Math.floor(initialProgress.totalWatchDuration);
            if (savedPage > 1) {
                setPageNumber(savedPage);
                setMaxPageReached(savedPage);
            }
        }
    }, [initialProgress]);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
    }

    async function changePage(offset: number) {
        setPageNumber(prevPageNumber => {
            const newPage = prevPageNumber + offset;
            const validPage = Math.min(Math.max(1, newPage), numPages);

            // Update Max Reached
            if (validPage > maxPageReached) {
                setMaxPageReached(validPage);
            }

            // Update Progress in DB
            updateProgress(validPage, Math.max(validPage, maxPageReached), numPages);

            return validPage;
        });
    }

    async function updateProgress(current: number, max: number, total: number) {
        if (total === 0) return;

        const percentage = (max / total) * 100;

        // We use 'totalWatchDuration' field to store the Current Page Number for persistence
        // so when we reload, we jump there.
        try {
            await ipc.updateVideoProgress(studentId, lessonId, percentage, current);
        } catch (err) {
            console.error('Failed to update reading progress', err);
        }

        if (percentage >= 90 || current === total) {
            if (onCompleted) {
                // Debounce completion? or just call it.
                // onCompleted();
            }
        }
    }

    return (
        <div className="pdf-viewer-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="pdf-controls" style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <button
                    className="btn btn-secondary"
                    disabled={pageNumber <= 1}
                    onClick={() => changePage(-1)}
                >
                    Previous
                </button>
                <span>
                    Page {pageNumber} of {numPages}
                </span>
                <button
                    className="btn btn-secondary"
                    disabled={pageNumber >= numPages}
                    onClick={() => changePage(1)}
                >
                    Next
                </button>
            </div>

            <div className="pdf-document" style={{ border: '1px solid #ccc', maxHeight: '70vh', overflow: 'auto' }}>
                <Document
                    file={src}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={<div>Loading PDF...</div>}
                    error={<div>Failed to load PDF!</div>}
                >
                    <Page
                        pageNumber={pageNumber}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        width={Math.min(window.innerWidth * 0.8, 800)} // Responsive width
                    />
                </Document>
            </div>

            <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                Read {Math.round((maxPageReached / numPages) * 100 || 0)}%
            </p>
        </div>
    );
}
