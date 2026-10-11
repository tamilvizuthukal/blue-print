import React, { useState, useEffect, useRef } from 'react';
import { AlignLeft, AlignCenter, AlignRight, Type, Trash2, Settings, X, RefreshCw, Maximize } from 'lucide-react';
import Swal from 'sweetalert2';

interface ImageEditorOverlayProps {
    editorRef: React.RefObject<HTMLDivElement>;
    onUpdate: () => void;
    onActiveImageChange?: (img: HTMLImageElement | null) => void;
}

const ImageEditorOverlay: React.FC<ImageEditorOverlayProps> = ({ editorRef, onUpdate, onActiveImageChange }) => {
    const [activeImage, setActiveImage] = useState<HTMLImageElement | null>(null);
    const [imgRect, setImgRect] = useState<DOMRect | null>(null);
    const [isResizing, setIsResizing] = useState(false);
    const overlayRef = useRef<HTMLDivElement>(null);

    // Initial width/height during resize
    const startResize = useRef<{ x: number, y: number, w: number, h: number, ratio: number } | null>(null);

    useEffect(() => {
        const editor = editorRef.current;
        if (!editor) return;

        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'IMG') {
                e.preventDefault();
                // Prevent selecting the image natively if possible
                setActiveImage(target as HTMLImageElement);
                onActiveImageChange?.(target as HTMLImageElement);
                updateRect(target as HTMLImageElement);
            } else if (!target.closest('.image-overlay-container')) {
                setActiveImage(null);
                onActiveImageChange?.(null);
            }
        };

        const updateRect = (img: HTMLImageElement) => {
            const editorRect = editor.getBoundingClientRect();
            const rect = img.getBoundingClientRect();
            setImgRect({
                ...rect.toJSON(),
                top: rect.top - editorRect.top + editor.scrollTop,
                left: rect.left - editorRect.left + editor.scrollLeft,
                width: rect.width,
                height: rect.height,
            } as DOMRect);
        };

        const handleScroll = () => {
            if (activeImage && !isResizing) updateRect(activeImage);
        };

        editor.addEventListener('click', handleClick);
        editor.addEventListener('scroll', handleScroll);
        window.addEventListener('resize', handleScroll);

        const observer = new MutationObserver(() => {
            if (activeImage && !document.body.contains(activeImage)) {
                setActiveImage(null);
                onActiveImageChange?.(null);
            } else if (activeImage && !isResizing) {
                updateRect(activeImage);
            }
        });
        
        observer.observe(editor, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'width', 'height'] });

        return () => {
            editor.removeEventListener('click', handleClick);
            editor.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleScroll);
            observer.disconnect();
        };
    }, [editorRef, activeImage, isResizing]);

    // Handle Drag to Resize
    useEffect(() => {
        if (!isResizing || !activeImage) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!startResize.current) return;
            e.preventDefault();
            const { x, w, ratio } = startResize.current;
            const diffX = e.clientX - x;
            const newWidth = Math.max(50, w + diffX);
            const newHeight = newWidth / ratio;

            activeImage.style.width = `${newWidth}px`;
            activeImage.style.height = `${newHeight}px`;
            
            // Immediately update the overlay rectangle for smooth feedback
            if (editorRef.current) {
                const editorRect = editorRef.current.getBoundingClientRect();
                const rect = activeImage.getBoundingClientRect();
                setImgRect({
                    ...rect.toJSON(),
                    top: rect.top - editorRect.top + editorRef.current.scrollTop,
                    left: rect.left - editorRect.left + editorRef.current.scrollLeft,
                    width: rect.width,
                    height: rect.height,
                } as DOMRect);
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            startResize.current = null;
            onUpdate();
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, activeImage, onUpdate, editorRef]);

    const startResizing = (e: React.MouseEvent) => {
        if (!activeImage) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = activeImage.getBoundingClientRect();
        startResize.current = {
            x: e.clientX,
            y: e.clientY,
            w: rect.width,
            h: rect.height,
            ratio: rect.width / rect.height
        };
        setIsResizing(true);
    };

    if (!activeImage || !imgRect) return null;

    return (
        <div 
            ref={overlayRef}
            className="absolute z-50 pointer-events-none image-overlay-container"
            style={{
                top: imgRect.top,
                left: imgRect.left,
                width: imgRect.width,
                height: imgRect.height,
            }}
        >
            {/* Selection Border */}
            <div className={`absolute inset-0 border-2 border-blue-500 pointer-events-auto ${isResizing ? 'opacity-50' : 'opacity-100'}`} />

            {/* Resize Handles */}
            <div 
                className="absolute bottom-0 right-0 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-se-resize pointer-events-auto shadow-sm transform translate-x-1/2 translate-y-1/2"
                onMouseDown={startResizing}
            />
        </div>
    );
};

export default ImageEditorOverlay;
