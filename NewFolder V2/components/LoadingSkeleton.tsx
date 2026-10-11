import React from 'react';

interface LoadingSkeletonProps {
    count?: number;
    height?: string;
    className?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ 
    count = 3, 
    height = "100px", 
    className = "" 
}) => {
    return (
        <div className={`space-y-4 animate-pulse ${className}`}>
            {[...Array(count)].map((_, i) => (
                <div 
                    key={i} 
                    className="w-full bg-gray-200 rounded-lg" 
                    style={{ height }}
                ></div>
            ))}
        </div>
    );
};

export const TableRowSkeleton: React.FC<{ columns: number; rows?: number }> = ({ columns, rows = 5 }) => {
    return (
        <div className="animate-pulse w-full">
            <div className="flex border-b border-gray-200 py-4 bg-gray-50 rounded-t-lg">
                {[...Array(columns)].map((_, i) => (
                    <div key={i} className="flex-1 px-4">
                        <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                    </div>
                ))}
            </div>
            {[...Array(rows)].map((_, i) => (
                <div key={i} className="flex border-b border-gray-100 py-4">
                    {[...Array(columns)].map((_, j) => (
                        <div key={j} className="flex-1 px-4">
                            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};

export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse p-4">
            {[...Array(count)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 h-48 flex flex-col justify-between">
                    <div>
                        <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                        <div className="h-4 bg-gray-100 rounded w-1/2 mb-2"></div>
                        <div className="h-4 bg-gray-100 rounded w-2/3"></div>
                    </div>
                    <div className="flex justify-end space-x-2">
                        <div className="h-8 w-8 bg-gray-100 rounded-full"></div>
                        <div className="h-8 w-8 bg-gray-100 rounded-full"></div>
                        <div className="h-8 w-24 bg-gray-200 rounded-lg"></div>
                    </div>
                </div>
            ))}
        </div>
    );
};
