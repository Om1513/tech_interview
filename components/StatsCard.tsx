'use client';

import { ReactNode } from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray';
  trend?: {
    value: number;
    label: string;
    isPositive?: boolean;
  };
  onClick?: () => void;
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    icon: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
    value: 'text-blue-900 dark:text-blue-100'
  },
  green: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    icon: 'text-green-600 dark:text-green-400',
    border: 'border-green-200 dark:border-green-800',
    value: 'text-green-900 dark:text-green-100'
  },
  yellow: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    icon: 'text-yellow-600 dark:text-yellow-400',
    border: 'border-yellow-200 dark:border-yellow-800',
    value: 'text-yellow-900 dark:text-yellow-100'
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    icon: 'text-red-600 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
    value: 'text-red-900 dark:text-red-100'
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    icon: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800',
    value: 'text-purple-900 dark:text-purple-100'
  },
  gray: {
    bg: 'bg-gray-50 dark:bg-gray-800',
    icon: 'text-gray-600 dark:text-gray-400',
    border: 'border-gray-200 dark:border-gray-700',
    value: 'text-gray-900 dark:text-gray-100'
  }
};

export default function StatsCard({
  title,
  value,
  description,
  icon,
  color = 'gray',
  trend,
  onClick
}: StatsCardProps) {
  const colors = colorClasses[color];
  const isClickable = !!onClick;

  return (
    <div
      className={`
        ${colors.bg} ${colors.border} border rounded-lg p-6 
        ${isClickable ? 'cursor-pointer hover:shadow-md transition-shadow duration-200' : ''}
      `}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3">
            {icon && (
              <div className={`${colors.icon} flex-shrink-0`}>
                {icon}
              </div>
            )}
            <div>
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {title}
              </h3>
              <p className={`text-2xl font-semibold ${colors.value}`}>
                {typeof value === 'number' ? value.toLocaleString() : value}
              </p>
            </div>
          </div>

          {description && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {description}
            </p>
          )}

          {trend && (
            <div className="mt-2 flex items-center space-x-1">
              <span
                className={`text-sm font-medium ${
                  trend.isPositive 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {trend.label}
              </span>
            </div>
          )}
        </div>

        {isClickable && (
          <div className="ml-4">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
